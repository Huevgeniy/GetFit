/**
 * Внесение данных из свободного текста Telegram-бота.
 *
 * Пользователь не выбирает раздел: бот сам раскладывает информацию по всем
 * местам, где она имеет смысл —
 *  - тренировка → история тренировок, личные рекорды, прогресс;
 *  - подходы → личные рекорды (с пересчётом расчётного максимума);
 *  - шаги/вес/сон/еда → профиль, питание, сон и марафоны целей;
 *  - замеры → свои показатели в Лаборатории;
 *  - запущенные исследования → ежедневные замеры зависимых и независимых метрик.
 *
 * Идентификаторы детерминированные: повторная обработка того же сообщения
 * (Telegram умеет повторять вебхуки) не создаёт дубликаты.
 */
import crypto from 'node:crypto';
import type {
  CompletedSet,
  DailyNutritionRecord,
  ExerciseLog,
  GoalMarathon,
  LoggedMealItem,
  PersonalRecord,
  SleepRecord,
  UserProfile,
  WorkoutRecord,
} from '../src/types.ts';
import { BASE_FOODS_DATABASE } from '../src/data/foodsData.ts';
import {
  getUserState,
  listCollection,
  saveUserState,
  upsertCollectionItem,
} from './storage.ts';

export interface BotAction {
  function: string;
  args?: Record<string, any>;
}

export interface IngestTurnResult {
  /** 'applied' — данные записаны, 'staged' — ждём команду «внеси», 'none' — нечего сохранять. */
  mode: 'applied' | 'staged' | 'none';
  notices: string[];
  preview: string[];
  /** Стало ли меньше/больше данных — для текста ответа. */
  hasPending: boolean;
}

type StoredState = Record<string, any>;

const TZ_OFFSET_HOURS = Number(process.env.NOTIFY_TZ_OFFSET_HOURS || 3);
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const PENDING_TTL_HOURS = 12;

/* ------------------------------------------------------------------ */
/* Утилиты                                                             */
/* ------------------------------------------------------------------ */

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** Локальная дата пользователя (по умолчанию Москва), а не UTC. */
export function localDayKey(value: Date = new Date()): string {
  const shifted = new Date(value.getTime() + TZ_OFFSET_HOURS * HOUR_MS);
  return shifted.toISOString().slice(0, 10);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.').replace(/[^\d.\-]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function numOpt(value: unknown): number | undefined {
  const parsed = num(value, NaN);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function hashId(...parts: Array<string | number>): string {
  return crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 10);
}

function normalizeName(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim();
}

/**
 * Сравнивает названия упражнений и показателей мягко: «жим лёжа» должно
 * находить «жим штанги лёжа», а «приседания» — «приседания со штангой».
 */
function namesMatch(left: string, right: string): boolean {
  const a = normalizeName(left);
  const b = normalizeName(right);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const wordsA = a.split(' ').filter((word) => word.length > 2);
  const wordsB = new Set(b.split(' ').filter((word) => word.length > 2));
  if (wordsA.length === 0 || wordsB.size === 0) return false;
  const common = wordsA.filter((word) => wordsB.has(word)).length;
  return common >= Math.min(2, wordsA.length, wordsB.size);
}

function humanDate(value: Date = new Date()): string {
  const shifted = new Date(value.getTime() + TZ_OFFSET_HOURS * HOUR_MS);
  return `${pad2(shifted.getUTCDate())}.${pad2(shifted.getUTCMonth() + 1)}.${shifted.getUTCFullYear()}`;
}

function parseDay(value: unknown): string {
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (/^(вчера|yesterday)$/i.test(value.trim())) return localDayKey(new Date(Date.now() - DAY_MS));
    if (/^(позавчера)$/i.test(value.trim())) return localDayKey(new Date(Date.now() - 2 * DAY_MS));
  }
  return localDayKey();
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('ru-RU');
}

function addHoursToTime(time: string, hours: number): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return '07:00';
  const total = (Number(match[1]) * 60 + Number(match[2]) + Math.round(hours * 60) + 24 * 60) % (24 * 60);
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

function isoForDay(day: string, hour = 12): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour - TZ_OFFSET_HOURS, 0, 0)).toISOString();
}

function daysBetween(startDay: string, endDay: string): number {
  const start = Date.parse(`${startDay}T00:00:00Z`);
  const end = Date.parse(`${endDay}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1;
  return Math.max(1, Math.round((end - start) / DAY_MS) + 1);
}

/* ------------------------------------------------------------------ */
/* Описание действий (для предпросмотра и ответа)                      */
/* ------------------------------------------------------------------ */

interface IngestSet {
  weight: number;
  reps: number;
  rpe?: number;
}

interface IngestExercise {
  name: string;
  sets: IngestSet[];
  notes?: string;
}

function extractExercises(args: Record<string, any> = {}): IngestExercise[] {
  const result: IngestExercise[] = [];

  const pushExercise = (raw: any) => {
    const name = String(raw?.name || raw?.exercise || '').trim();
    if (!name) return;
    const sets: IngestSet[] = [];
    const rawSets = raw?.sets;
    if (Array.isArray(rawSets)) {
      for (const entry of rawSets) {
        if (typeof entry === 'number' || typeof entry === 'string') {
          const reps = Math.round(num(entry));
          if (reps > 0) sets.push({ weight: Math.max(0, num(raw?.weight)), reps });
          continue;
        }
        if (entry && typeof entry === 'object') {
          const reps = Math.round(num(entry.reps ?? entry.repeats ?? raw?.reps));
          if (reps <= 0) continue;
          sets.push({
            weight: Math.max(0, num(entry.weight ?? raw?.weight)),
            reps,
            rpe: numOpt(entry.rpe ?? raw?.rpe),
          });
        }
      }
    }
    if (sets.length === 0) {
      const reps = Math.round(num(raw?.reps ?? args.reps, 1));
      const weight = Math.max(0, num(raw?.weight ?? args.weight));
      const countRaw = num(raw?.sets_count ?? raw?.set_count ?? (typeof rawSets === 'number' ? rawSets : 1), 1);
      const count = Math.max(1, Math.min(20, Math.round(countRaw)));
      for (let i = 0; i < count; i += 1) {
        sets.push({ weight, reps: Math.max(1, reps), rpe: numOpt(raw?.rpe ?? args.rpe) });
      }
    }
    if (sets.length > 0) {
      result.push({ name, sets, notes: typeof raw?.notes === 'string' ? raw.notes : undefined });
    }
  };

  if (Array.isArray(args.exercises)) args.exercises.forEach(pushExercise);
  if (result.length === 0 && (args.exercise || args.name)) {
    pushExercise({ ...args, name: args.exercise || args.name });
  }
  return result;
}

function describeSet(set: IngestSet): string {
  return set.weight > 0 ? `${set.weight} кг × ${set.reps}` : `${set.reps} раз`;
}

function describeExercises(exercises: IngestExercise[]): string {
  return exercises
    .map((exercise) => {
      const groups = new Map<string, number>();
      for (const set of exercise.sets) groups.set(describeSet(set), (groups.get(describeSet(set)) || 0) + 1);
      const parts = [...groups.entries()].map(([text, count]) => (count > 1 ? `${text} (${count} подх.)` : text));
      return `${exercise.name}: ${parts.join(', ')}`;
    })
    .join('; ');
}

function describeOneAction(action: BotAction): string[] {
  const args = action.args || {};
  const lines: string[] = [];

  if (action.function === 'log_workout') {
    const exercises = extractExercises(args);
    if (exercises.length > 0) lines.push(`🏋️ ${describeExercises(exercises)}`);
  } else if (action.function === 'log_daily' || action.function === 'log_daily_state') {
    if (numOpt(args.sleep_hours) !== undefined) {
      lines.push(`😴 Сон: ${round1(num(args.sleep_hours))} ч`);
    }
    if (numOpt(args.steps) !== undefined) {
      lines.push(`👟 Шаги: ${formatNumber(num(args.steps))}`);
    }
    if (numOpt(args.water_liters ?? args.water) !== undefined) {
      lines.push(`💧 Вода: ${round1(num(args.water_liters ?? args.water))} л`);
    }
    if (numOpt(args.weight_kg ?? args.weight) !== undefined) {
      lines.push(`⚖️ Вес: ${round1(num(args.weight_kg ?? args.weight))} кг`);
    }
    if (Array.isArray(args.meals)) {
      for (const meal of args.meals) {
        const name = String(meal?.name || '').trim();
        if (!name) continue;
        const grams = numOpt(meal?.grams ?? meal?.weight);
        lines.push(`🍽 ${name}${grams ? ` — ${Math.round(grams)} г` : ''}`);
      }
    }
    if (numOpt(args.stress_level) !== undefined) {
      lines.push(`🧠 Стресс: ${round1(num(args.stress_level))}/10`);
    }
    if (args.notes) lines.push(`📝 ${String(args.notes).slice(0, 160)}`);
  } else if (action.function === 'log_metric') {
    const name = String(args.name || 'Показатель').trim();
    lines.push(`📏 ${name}: ${args.value ?? '—'} ${args.unit || ''}`.trim());
  } else if (action.function === 'update_user') {
    if (numOpt(args.dailyStepGoal) !== undefined) {
      lines.push(`🎯 Цель по шагам: ${formatNumber(num(args.dailyStepGoal))}`);
    }
    if (numOpt(args.currentWeight) !== undefined) {
      lines.push(`⚖️ Текущий вес: ${round1(num(args.currentWeight))} кг`);
    }
  } else if (action.function === 'create_experiment') {
    lines.push(`🔬 Новый эксперимент: «${String(args.title || 'Исследование').slice(0, 80)}»`);
  } else if (action.function === 'add_penalty') {
    lines.push(`⚠️ Штраф: «${String(args.penaltyTask || args.reason || 'Задание').slice(0, 80)}»`);
  }

  return lines;
}

export function describeActions(actions: BotAction[]): string[] {
  const lines: string[] = [];
  const workoutExercises: IngestExercise[] = [];
  for (const action of actions) {
    if (action.function === 'log_workout') {
      workoutExercises.push(...extractExercises(action.args || {}));
    } else {
      lines.push(...describeOneAction(action));
    }
  }
  if (workoutExercises.length > 0) {
    lines.unshift(`🏋️ Тренировка — ${describeExercises(workoutExercises)}`);
  }
  return [...new Set(lines)];
}

export function isDataAction(action: BotAction): boolean {
  return ['log_workout', 'log_daily', 'log_daily_state', 'log_metric'].includes(action.function);
}

export function isCommandAction(action: BotAction): boolean {
  return ['update_user', 'create_experiment', 'add_penalty'].includes(action.function);
}

export function sanitizeActions(raw: unknown): BotAction[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set([
    'log_workout',
    'log_daily',
    'log_daily_state',
    'log_metric',
    'update_user',
    'create_experiment',
    'add_penalty',
  ]);
  return raw
    .filter((item) => item && typeof item === 'object' && known.has(String((item as any).function)))
    .map((item) => ({
      function: String((item as any).function),
      args: (item as any).args && typeof (item as any).args === 'object' ? (item as any).args : {},
    }));
}

/* ------------------------------------------------------------------ */
/* Норма питания                                                       */
/* ------------------------------------------------------------------ */

function calculateTargets(user: UserProfile) {
  const weight = num(user.currentWeight) > 0 ? num(user.currentWeight) : 75;
  const height = num(user.heightCm) > 0 ? num(user.heightCm) : 175;
  const age = num(user.age) > 0 ? num(user.age) : 30;
  const goal = user.weightGoalType || 'maintain';

  const baseMetabolism = 10 * weight + 6.25 * height - 5 * age + (user.gender === 'female' ? -161 : 5);
  const activityFactor =
    user.activityLevel === 'sedentary'
      ? 1.2
      : user.activityLevel === 'active'
        ? 1.55
        : user.activityLevel === 'very_active'
          ? 1.725
          : 1.375;
  const maintenanceCalories = Math.round(baseMetabolism * activityFactor);

  let calories = maintenanceCalories;
  let proteinPerKg = 1.8;
  let fatPerKg = 1.0;
  let fiberTarget = 30;

  if (goal === 'gain') {
    calories = Math.round(maintenanceCalories * 1.12);
    proteinPerKg = 1.8;
    fatPerKg = 1.1;
    fiberTarget = 28;
  } else if (goal === 'lose') {
    calories = Math.round(maintenanceCalories * 0.82);
    proteinPerKg = 2.2;
    fatPerKg = 0.8;
    fiberTarget = 35;
  } else if (goal === 'recomp') {
    calories = Math.round(maintenanceCalories * 0.95);
    proteinPerKg = 2.4;
    fatPerKg = 0.9;
    fiberTarget = 32;
  }

  const protein = num(user.customProteinTarget) || Math.round(weight * proteinPerKg);
  const fat = num(user.customFatTarget) || Math.round(weight * fatPerKg);
  const effectiveCalories = num(user.customCalorieTarget) || calories;
  const remaining = effectiveCalories - (protein * 4 + fat * 9);
  return {
    calories: effectiveCalories,
    protein,
    fat,
    carbs: num(user.customCarbsTarget) || Math.max(80, Math.round(remaining / 4)),
    fiber: num(user.customFiberTarget) || fiberTarget,
  };
}

function emptyNutritionDay(user: UserProfile, day: string): DailyNutritionRecord {
  const targets = calculateTargets(user);
  return {
    date: day,
    meals: [],
    totalCalories: 0,
    totalProtein: 0,
    totalFat: 0,
    totalCarbs: 0,
    totalFiber: 0,
    targetCalories: targets.calories,
    targetProtein: targets.protein,
    targetFat: targets.fat,
    targetCarbs: targets.carbs,
    targetFiber: targets.fiber,
    status: 'open',
  };
}

/* ------------------------------------------------------------------ */
/* Еда                                                                 */
/* ------------------------------------------------------------------ */

function findFood(name: string) {
  const target = normalizeName(name);
  if (!target) return null;
  let best: (typeof BASE_FOODS_DATABASE)[number] | null = null;
  let bestScore = 0;
  for (const food of BASE_FOODS_DATABASE) {
    const foodName = normalizeName(food.name);
    if (!foodName) continue;
    let score = 0;
    if (target === foodName) score = 100;
    else if (target.includes(foodName)) score = 60 + foodName.length;
    else if (foodName.includes(target) && target.length >= 4) score = 40 + target.length;
    else {
      const firstWord = foodName.split(' ')[0];
      if (firstWord.length >= 4 && target.includes(firstWord)) score = 20 + firstWord.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = food;
    }
  }
  return best;
}

const ROUGH_100G: Array<[RegExp, number, number, number, number]> = [
  [/суп|борщ|щи/i, 60, 3, 3, 6],
  [/салат/i, 90, 2, 6, 6],
  [/пицц/i, 270, 11, 10, 33],
  [/бургер|шаурм|донер/i, 250, 12, 12, 24],
  [/шоколад|конфет/i, 540, 6, 32, 57],
  [/печень|печен/i, 400, 6, 18, 55],
  [/блин|оладь/i, 230, 6, 9, 30],
  [/паст|макарон|спагетти/i, 350, 12, 2, 70],
  [/рис/i, 340, 7, 1, 75],
  [/греч/i, 340, 13, 3, 62],
  [/овсян|геркулес/i, 370, 13, 6, 62],
  [/картош|картофел/i, 160, 4, 4, 26],
  [/куриц|курин/i, 165, 31, 4, 0],
  [/говядин/i, 190, 26, 10, 0],
  [/рыб|лосос|треск/i, 180, 20, 10, 0],
  [/творог/i, 120, 17, 5, 3],
  [/йогурт/i, 90, 5, 3, 10],
  [/молок/i, 60, 3, 3, 5],
  [/яйц/i, 155, 13, 11, 1],
  [/банан/i, 95, 1.5, 0.2, 21],
  [/яблок/i, 52, 0.3, 0.2, 12],
  [/хлеб/i, 250, 8, 3, 48],
];

function mealMacros(meal: Record<string, any>, grams: number) {
  const food = findFood(String(meal?.name || ''));
  if (food) {
    const ratio = grams / 100;
    return {
      calories: Math.round(food.caloriesPer100g * ratio),
      protein: round1(food.proteinPer100g * ratio),
      fat: round1(food.fatPer100g * ratio),
      carbs: round1(food.carbsPer100g * ratio),
      fiber: round1(food.fiberPer100g * ratio),
      foodId: food.id,
    };
  }

  const providedCalories = numOpt(meal?.calories ?? meal?.kcal);
  const providedProtein = numOpt(meal?.protein);
  const providedFat = numOpt(meal?.fat);
  const providedCarbs = numOpt(meal?.carbs);
  if (
    providedCalories !== undefined ||
    providedProtein !== undefined ||
    providedFat !== undefined ||
    providedCarbs !== undefined
  ) {
    return {
      calories: Math.round(providedCalories || (providedProtein || 0) * 4 + (providedFat || 0) * 9 + (providedCarbs || 0) * 4),
      protein: round1(providedProtein || 0),
      fat: round1(providedFat || 0),
      carbs: round1(providedCarbs || 0),
      fiber: round1(numOpt(meal?.fiber) || 0),
      foodId: undefined,
    };
  }

  const name = String(meal?.name || '');
  const rough = ROUGH_100G.find(([pattern]) => pattern.test(name));
  const per100 = rough ? { calories: rough[1], protein: rough[2], fat: rough[3], carbs: rough[4] } : { calories: 120, protein: 4, fat: 4, carbs: 12 };
  const ratio = grams / 100;
  return {
    calories: Math.round(per100.calories * ratio),
    protein: round1(per100.protein * ratio),
    fat: round1(per100.fat * ratio),
    carbs: round1(per100.carbs * ratio),
    fiber: 0,
    foodId: undefined,
  };
}

function mealTypeForNow(): LoggedMealItem['mealType'] {
  const hour = new Date(Date.now() + TZ_OFFSET_HOURS * HOUR_MS).getUTCHours();
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 20) return 'dinner';
  return 'snack';
}

/**
 * Запасной разбор еды без ИИ: ищем знакомые продукты в тексте.
 * Нужен, когда внешняя модель недоступна, а человек всё равно хочет
 * записать «съел овсянку и два яйца».
 */
const MEAL_TEXT_HINT = /(съел|съела|ел|ела|поел|поела|завтрак|обед|ужин|перекус|выпил|выпила)/i;

const COMMON_FOOD_PATTERNS: Array<[RegExp, string, number]> = [
  [/овсян|геркулес|овсянк/i, 'Овсяная каша / хлопья Геркулес (сухие)', 60],
  [/греч/i, 'Гречневая крупа ядрица (сухая)', 80],
  [/рис/i, 'Рис белый длиннозерный (сухой)', 80],
  [/макарон|паст[аы]|спагетти/i, 'Макароны из твердых сортов пшеницы (сухие)', 100],
  [/куриц|курин|куриное/i, 'Куриное филе (грудка сырая)', 150],
  [/говядин/i, 'Говядина нежирная (вырезка)', 150],
  [/свинин/i, 'Свинина нежирная (корейка)', 120],
  [/яйц|яиц/i, 'Яйцо куриное (C1 цельное)', 100],
  [/творог/i, 'Творог 5%', 150],
  [/молок/i, 'Молоко коровье 2.5%', 200],
  [/сыр/i, 'Сыр твердый (Российский / Гауда)', 40],
  [/хлеб|батон|тост/i, 'Хлеб цельнозерновой', 50],
  [/банан/i, 'Банан спелый', 120],
  [/яблок/i, 'Яблоко свежее с кожурой', 150],
  [/апельсин/i, 'Апельсин свежий', 150],
  [/ягод|клубник|черник/i, 'Ягоды свежие / замороженные (клубника, черника)', 100],
  [/орех|миндал|арахис/i, 'Грецкий орех', 30],
  [/масл[оа].*(слив|подсол|олив)/i, 'Масло оливковое Extra Virgin', 15],
];

export function heuristicMeals(text: string): Array<{ name: string; grams: number }> {
  if (!MEAL_TEXT_HINT.test(text)) return [];
  const found: Array<{ name: string; grams: number }> = [];
  const seen = new Set<string>();
  for (const [pattern, name, defaultGrams] of COMMON_FOOD_PATTERNS) {
    if (!pattern.test(text) || seen.has(name)) continue;
    const explicit = /(\d{2,4})\s*(?:г|гр|грамм)/i.exec(text);
    const grams = explicit ? Math.max(10, Math.min(1500, Number(explicit[1]))) : defaultGrams;
    found.push({ name, grams });
    seen.add(name);
    if (found.length >= 6) break;
  }
  return found;
}

function applyMeals(state: StoredState, day: string, meals: any[], notices: string[]) {
  if (!Array.isArray(meals) || meals.length === 0) return;
  const user = state.user as UserProfile;
  state.dailyNutritionRecords = Array.isArray(state.dailyNutritionRecords) ? state.dailyNutritionRecords : [];
  let record: DailyNutritionRecord | undefined = state.dailyNutritionRecords.find((item: any) => item?.date === day);
  if (!record) {
    record = emptyNutritionDay(user, day);
    state.dailyNutritionRecords.unshift(record);
  }

  const added: string[] = [];
  for (const raw of meals) {
    const name = String(raw?.name || raw?.dish || '').trim();
    if (!name) continue;
    const grams = Math.max(1, Math.round(numOpt(raw?.grams ?? raw?.weight ?? raw?.amount) || 100));
    const mealType = ['breakfast', 'lunch', 'dinner', 'snack'].includes(String(raw?.meal_type))
      ? (raw.meal_type as LoggedMealItem['mealType'])
      : mealTypeForNow();
    const macros = mealMacros(raw, grams);
    const id = `meal_tg_${day}_${hashId(name.toLowerCase(), grams, mealType)}`;
    if (record.meals.some((meal) => meal.id === id)) continue;
    record.meals.push({
      id,
      foodId: macros.foodId,
      name,
      grams,
      calories: macros.calories,
      protein: macros.protein,
      fat: macros.fat,
      carbs: macros.carbs,
      fiber: macros.fiber,
      mealType,
      timestamp: new Date().toISOString(),
    });
    added.push(`${name}${grams ? ` ${grams} г` : ''}`);
  }

  if (added.length === 0) return;

  record.totalCalories = record.meals.reduce((sum, meal) => sum + meal.calories, 0);
  record.totalProtein = round1(record.meals.reduce((sum, meal) => sum + meal.protein, 0));
  record.totalFat = round1(record.meals.reduce((sum, meal) => sum + meal.fat, 0));
  record.totalCarbs = round1(record.meals.reduce((sum, meal) => sum + meal.carbs, 0));
  record.totalFiber = round1(record.meals.reduce((sum, meal) => sum + meal.fiber, 0));
  const targets = calculateTargets(user);
  record.targetCalories = targets.calories;
  record.targetProtein = targets.protein;
  record.targetFat = targets.fat;
  record.targetCarbs = targets.carbs;
  record.targetFiber = targets.fiber;

  notices.push(`🍽 Записано в питание: ${added.join(', ')} (${record.totalCalories} ккал за день)`);
}

/* ------------------------------------------------------------------ */
/* Личные рекорды                                                      */
/* ------------------------------------------------------------------ */

function estimateRecordValue(record: PersonalRecord): number {
  const text = String(record.currentBest || '');
  const kgMatch = /(\d+(?:[.,]\d+)?)\s*кг\s*[×xх*]\s*(\d+)/i.exec(text);
  if (kgMatch) {
    const weight = Number(kgMatch[1].replace(',', '.'));
    const reps = Number(kgMatch[2]);
    return weight * (1 + reps / 30);
  }
  if (typeof (record as any).numericValue === 'number') return (record as any).numericValue;
  const plain = /(\d+(?:[.,]\d+)?)/.exec(text);
  return plain ? Number(plain[1].replace(',', '.')) : 0;
}

interface RecordUpdate {
  records: PersonalRecord[];
  isNew: boolean;
  improved: boolean;
  title: string;
  valueText: string;
}

function updatePersonalRecord(records: PersonalRecord[], exercise: ExerciseLog): RecordUpdate {
  const bestSet = exercise.sets.reduce<CompletedSet | null>((best, set) => {
    if (!best) return set;
    const score = set.weight > 0 ? set.weight * (1 + set.reps / 30) : set.reps;
    const bestScore = best.weight > 0 ? best.weight * (1 + best.reps / 30) : best.reps;
    return score > bestScore ? set : best;
  }, null);

  if (!bestSet) {
    return { records, isNew: false, improved: false, title: exercise.name, valueText: '' };
  }

  const numeric = bestSet.weight > 0 ? bestSet.weight * (1 + bestSet.reps / 30) : bestSet.reps;
  const valueText = bestSet.weight > 0 ? `${bestSet.weight} кг × ${bestSet.reps}` : `${bestSet.reps} повторов`;
  const unit = bestSet.weight > 0 ? 'кг' : 'раз';
  const normalized = normalizeName(exercise.name);
  const nowIso = new Date().toISOString();
  const dateText = humanDate();

  const existing = records.find((record) => namesMatch(record.title, exercise.name));

  if (!existing) {
    const record: PersonalRecord = {
      id: `pr_tg_${hashId(normalized)}`,
      title: exercise.name,
      category: 'strength',
      currentBest: valueText,
      unit,
      numericValue: round1(numeric),
      history: [
        {
          id: `hist_tg_${hashId(normalized, nowIso)}`,
          date: dateText,
          value: valueText,
          numericValue: round1(numeric),
          notes: 'Записано из Telegram',
        },
      ],
      isPublic: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    } as PersonalRecord;
    return { records: [record, ...records], isNew: true, improved: true, title: exercise.name, valueText };
  }

  const previous = estimateRecordValue(existing);
  if (numeric <= previous + 0.01) {
    return { records, isNew: false, improved: false, title: existing.title, valueText };
  }

  const updated: PersonalRecord = {
    ...existing,
    currentBest: valueText,
    unit,
    numericValue: round1(numeric),
    history: [
      {
        id: `hist_tg_${hashId(normalized, nowIso)}`,
        date: dateText,
        value: valueText,
        numericValue: round1(numeric),
        notes: 'Новый рекорд из Telegram',
      },
      ...(Array.isArray(existing.history) ? existing.history : []),
    ],
    updatedAt: nowIso,
  } as PersonalRecord;

  return {
    records: records.map((record) => (record.id === existing.id ? updated : record)),
    isNew: false,
    improved: true,
    title: existing.title,
    valueText,
  };
}

/* ------------------------------------------------------------------ */
/* Марафоны                                                            */
/* ------------------------------------------------------------------ */

interface MarathonData {
  day: string;
  steps?: number;
  weightKg?: number;
  workout?: WorkoutRecord;
  metrics: Array<{ name: string; value: number }>;
}

function marathonValue(marathon: GoalMarathon, data: MarathonData): number | undefined {
  if (marathon.category === 'steps' && data.steps !== undefined) return data.steps;
  if (marathon.category === 'weight_loss' && data.weightKg !== undefined) return data.weightKg;
  if (marathon.category === 'strength' && data.workout) {
    const exercise = data.workout.exercises.find((item) => namesMatch(item.name, marathon.targetMetricName));
    return exercise?.best1RM || data.workout.totalTonnageKg;
  }
  if (marathon.category === 'cardio') {
    if (data.workout) return data.workout.durationMinutes;
    if (data.steps !== undefined) return data.steps;
  }
  if (marathon.category === 'custom') {
    const metric = data.metrics.find((item) => namesMatch(item.name, marathon.targetMetricName));
    return metric?.value;
  }
  return undefined;
}

function isMarathonHit(marathon: GoalMarathon, value: number): boolean {
  if (marathon.category === 'weight_loss') return value > 0 && value <= marathon.targetGoalValue;
  return value >= marathon.targetGoalValue;
}

function applyMarathons(state: StoredState, data: MarathonData, notices: string[]): void {
  if (!Array.isArray(state.marathons) || state.marathons.length === 0) return;
  const updated: GoalMarathon[] = [];

  for (const marathon of state.marathons as GoalMarathon[]) {
    if (!marathon || marathon.status !== 'active') {
      updated.push(marathon);
      continue;
    }
    const dayNumber = daysBetween(marathon.startDate, data.day);
    if (dayNumber > marathon.durationDays) {
      updated.push(marathon);
      continue;
    }
    const value = marathonValue(marathon, data);
    if (value === undefined || !Number.isFinite(value)) {
      updated.push(marathon);
      continue;
    }

    const hit = isMarathonHit(marathon, value);
    const logs = Array.isArray(marathon.dailyLogs) ? [...marathon.dailyLogs] : [];
    const index = logs.findIndex((log) => log.date === data.day || log.dayNumber === dayNumber);
    const entry = {
      dayNumber,
      date: data.day,
      value: round1(value),
      target: marathon.targetGoalValue,
      isHit: hit,
      note: logs[index]?.note || 'Обновлено из Telegram',
    };
    if (index >= 0) logs[index] = { ...logs[index], ...entry };
    else logs.push(entry);

    const next: GoalMarathon = {
      ...marathon,
      currentDay: Math.max(marathon.currentDay || 1, Math.min(marathon.durationDays, dayNumber)),
      dailyLogs: logs,
    };
    updated.push(next);

    if (hit) {
      notices.push(`🏁 Марафон «${marathon.title}»: цель дня выполнена (${round1(value)} ${marathon.unit}).`);
    }
  }

  state.marathons = updated;
}

/* ------------------------------------------------------------------ */
/* Свои показатели                                                     */
/* ------------------------------------------------------------------ */

async function saveCustomMetric(
  userId: string,
  metric: { name: string; value: number | boolean; unit?: string; category?: string },
  day: string,
  notices: string[],
): Promise<void> {
  try {
    const metrics = await listCollection('custom_metrics', userId);
    const normalized = normalizeName(metric.name);
    const existing = metrics.find((item: any) => normalizeName(String(item?.name || '')) === normalized);
    const nowIso = new Date().toISOString();
    if (existing) {
      const next = {
        ...existing,
        values: {
          ...(existing.values || {}),
          [day]: { date: day, value: metric.value },
        },
        unit: existing.unit || metric.unit || '',
        updatedAt: nowIso,
      };
      await upsertCollectionItem('custom_metrics', userId, next);
    } else {
      await upsertCollectionItem('custom_metrics', userId, {
        id: `cm_${hashId(userId, normalized)}`,
        name: metric.name,
        category: metric.category || 'physical',
        type: typeof metric.value === 'boolean' ? 'boolean' : 'numeric',
        unit: metric.unit || '',
        values: { [day]: { date: day, value: metric.value } },
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
    notices.push(`📏 Сохранён показатель «${metric.name}»: ${metric.value}${metric.unit ? ` ${metric.unit}` : ''}`);
  } catch (err: any) {
    console.warn('[bot-ingestion] custom metric:', err?.message);
  }
}

/* ------------------------------------------------------------------ */
/* Исследования                                                        */
/* ------------------------------------------------------------------ */

interface ExperimentData {
  day: string;
  sleepHours?: number;
  steps?: number;
  waterLiters?: number;
  weightKg?: number;
  workout?: WorkoutRecord;
  nutrition?: DailyNutritionRecord;
  metrics: Array<{ name: string; value: number }>;
  rawText: string;
}

function matchIndependentMetric(name: string, data: ExperimentData): number | boolean | undefined {
  const key = normalizeName(name);
  if (/сон|sleep/.test(key) && data.sleepHours !== undefined) return data.sleepHours;
  if (/вод|water|гидрат/.test(key) && data.waterLiters !== undefined) return data.waterLiters;
  if (/шаг|steps/.test(key) && data.steps !== undefined) return data.steps;
  if (/вес|weight|масса/.test(key) && data.weightKg !== undefined) return data.weightKg;
  if (/стресс|stress/.test(key) && /стресс|stress/.test(normalizeName(data.rawText))) {
    const match = /стресс[^\d]{0,12}(\d+(?:[.,]\d+)?)/i.exec(data.rawText);
    if (match) return Number(match[1].replace(',', '.'));
  }
  if (/калор|calorie|ккал/.test(key) && data.nutrition) return data.nutrition.totalCalories;
  if (/бел|protein/.test(key) && data.nutrition) return data.nutrition.totalProtein;
  if (/жир|fat/.test(key) && data.nutrition) return data.nutrition.totalFat;
  if (/углев|carb/.test(key) && data.nutrition) return data.nutrition.totalCarbs;
  if (/клетчат|fiber/.test(key) && data.nutrition) return data.nutrition.totalFiber;
  if (/трениров|workout|нагрузк/.test(key) && data.workout) return data.workout.totalTonnageKg;
  if (/длительн|duration|время тренировк/.test(key) && data.workout) return data.workout.durationMinutes;
  if (/добавк|креатин|creatine|supplement|витамин/.test(key)) {
    return /креатин|creatine|добавк|витамин|принял|выпил/i.test(data.rawText) ? 1 : undefined;
  }
  const metric = data.metrics.find((item) => namesMatch(item.name, name));
  return metric?.value;
}

function matchDependentMetric(name: string, data: ExperimentData): number | undefined {
  if (data.workout) {
    const exercise = data.workout.exercises.find((item) => namesMatch(item.name, name));
    if (exercise?.best1RM) return exercise.best1RM;
    if (/объ[её]м|тоннаж|tonnage/.test(normalizeName(name))) return data.workout.totalTonnageKg;
  }
  const key = normalizeName(name);
  if (data.weightKg !== undefined && /вес|weight|масса/.test(key)) return data.weightKg;
  if (data.steps !== undefined && /шаг|steps/.test(key)) return data.steps;
  if (data.sleepHours !== undefined && /сон|sleep/.test(key)) return data.sleepHours;
  const metric = data.metrics.find((item) => namesMatch(item.name, name));
  return metric?.value;
}

async function autofillExperiments(userId: string, data: ExperimentData, notices: string[]): Promise<void> {
  try {
    const experiments = await listCollection('experiments', userId);
    for (const experiment of experiments as any[]) {
      if (!experiment || experiment.status !== 'active') continue;
      const start = String(experiment.startDate || '');
      const end = String(experiment.endDate || '');
      if (start && data.day < start) continue;
      if (end && data.day > end) continue;

      const independentValues: Record<string, number | boolean> = {};
      for (const metric of experiment.independentMetrics || []) {
        const name = String(metric?.name || '').trim();
        if (!name) continue;
        const value = matchIndependentMetric(name, data);
        if (value !== undefined) independentValues[name] = value;
      }

      const dependentValue = matchDependentMetric(String(experiment.dependentMetric?.name || ''), data);
      if (Object.keys(independentValues).length === 0 && dependentValue === undefined) continue;

      const dailyLogs = experiment.dailyLogs && typeof experiment.dailyLogs === 'object' ? experiment.dailyLogs : {};
      const existing = dailyLogs[data.day] || {};
      const merged = {
        date: data.day,
        independentValues: { ...(existing.independentValues || {}), ...independentValues },
        dependentValue: dependentValue !== undefined ? dependentValue : existing.dependentValue,
        notes: existing.notes || 'Заполнено из Telegram',
        loggedAt: new Date().toISOString(),
      };
      if (
        JSON.stringify(merged.independentValues) === JSON.stringify(existing.independentValues || {}) &&
        merged.dependentValue === existing.dependentValue
      ) {
        continue;
      }
      await upsertCollectionItem('experiments', userId, {
        ...experiment,
        dailyLogs: { ...dailyLogs, [data.day]: merged },
      });
      notices.push(`🔬 Исследование «${String(experiment.title || 'Эксперимент').slice(0, 60)}»: замер за ${data.day} обновлён.`);
    }
  } catch (err: any) {
    console.warn('[bot-ingestion] experiments:', err?.message);
  }
}

/* ------------------------------------------------------------------ */
/* Применение                                                          */
/* ------------------------------------------------------------------ */

interface Aggregate {
  workout?: WorkoutRecord;
  dailyByDay: Map<string, {
    sleepHours?: number;
    sleepQuality?: number;
    bedtime?: string;
    wakeTime?: string;
    sleepNotes?: string;
    steps?: number;
    waterLiters?: number;
    weightKg?: number;
    meals: any[];
    notes?: string;
    stress?: number;
  }>;
  metrics: Array<{ name: string; value: number; unit?: string; category?: string }>;
  profilePatch: Partial<UserProfile>;
  experiments: Array<Record<string, any>>;
  penalties: Array<Record<string, any>>;
}

function aggregateActions(actions: BotAction[]): Aggregate {
  const aggregate: Aggregate = {
    dailyByDay: new Map(),
    metrics: [],
    profilePatch: {},
    experiments: [],
    penalties: [],
  };

  const workoutArgs: Record<string, any> = {};
  const workoutExercises: IngestExercise[] = [];

  for (const action of actions) {
    const args = action.args || {};

    if (action.function === 'log_workout') {
      workoutExercises.push(...extractExercises(args));
      for (const key of ['title', 'workout_title', 'duration_minutes', 'duration', 'date', 'notes', 'started_at']) {
        if (workoutArgs[key] === undefined && args[key] !== undefined) workoutArgs[key] = args[key];
      }
      continue;
    }

    if (action.function === 'log_daily' || action.function === 'log_daily_state') {
      const day = parseDay(args.date ?? args.day);
      const bucket = aggregate.dailyByDay.get(day) || { meals: [] };
      if (numOpt(args.sleep_hours) !== undefined) bucket.sleepHours = Math.max(0, Math.min(24, num(args.sleep_hours)));
      if (numOpt(args.sleep_quality) !== undefined) bucket.sleepQuality = Math.max(1, Math.min(10, Math.round(num(args.sleep_quality))));
      if (args.bedtime) bucket.bedtime = String(args.bedtime);
      if (args.wake_time ?? args.wakeTime) bucket.wakeTime = String(args.wake_time ?? args.wakeTime);
      if (args.sleep_notes) bucket.sleepNotes = String(args.sleep_notes);
      if (numOpt(args.steps) !== undefined) bucket.steps = Math.max(0, Math.round(num(args.steps)));
      if (numOpt(args.water_liters ?? args.water) !== undefined) bucket.waterLiters = Math.max(0, num(args.water_liters ?? args.water));
      if (numOpt(args.weight_kg ?? args.weight) !== undefined) bucket.weightKg = Math.max(0, num(args.weight_kg ?? args.weight));
      if (numOpt(args.stress_level) !== undefined) bucket.stress = Math.max(1, Math.min(10, num(args.stress_level)));
      if (Array.isArray(args.meals)) bucket.meals.push(...args.meals);
      if (args.notes) bucket.notes = String(args.notes);
      aggregate.dailyByDay.set(day, bucket);
      continue;
    }

    if (action.function === 'log_metric') {
      const name = String(args.name || '').trim();
      const value = numOpt(args.value);
      if (name && value !== undefined) {
        aggregate.metrics.push({
          name,
          value,
          unit: args.unit ? String(args.unit) : undefined,
          category: args.category ? String(args.category) : undefined,
        });
        if (/вес|масса тела/i.test(name)) aggregate.profilePatch.currentWeight = value;
      }
      continue;
    }

    if (action.function === 'update_user') {
      const allowed: Array<keyof UserProfile> = [
        'currentWeight',
        'targetWeight',
        'heightCm',
        'age',
        'gender',
        'activityLevel',
        'weightGoalType',
        'dailyStepGoal',
        'targetRankTitle',
        'customCalorieTarget',
        'customProteinTarget',
        'customFatTarget',
        'customCarbsTarget',
        'customFiberTarget',
      ];
      for (const key of allowed) {
        if (args[key] !== undefined && args[key] !== null && args[key] !== '') {
          (aggregate.profilePatch as any)[key] = args[key];
        }
      }
      if (numOpt(args.currentWeight) !== undefined) {
        const day = parseDay(args.date);
        const bucket = aggregate.dailyByDay.get(day) || { meals: [] };
        if (bucket.weightKg === undefined) bucket.weightKg = num(args.currentWeight);
        aggregate.dailyByDay.set(day, bucket);
      }
      continue;
    }

    if (action.function === 'create_experiment') {
      const title = String(args.title || args.hypothesis || 'Эксперимент из Telegram').slice(0, 120);
      const duration = Math.max(1, Math.round(numOpt(args.duration_days) || 21));
      const startDate = parseDay(args.start_date);
      const endDate = parseDay(args.end_date) === localDayKey()
        ? new Date(Date.parse(`${startDate}T00:00:00Z`) + duration * DAY_MS).toISOString().slice(0, 10)
        : parseDay(args.end_date);
      aggregate.experiments.push({
        id: `exp_tg_${hashId(title, startDate)}`,
        title,
        hypothesis: String(args.hypothesis || title),
        startDate,
        endDate,
        durationDays: duration,
        status: 'active',
        dependentMetric: {
          name: String(args.dependent_metric || 'Сила'),
          unit: String(args.dependent_unit || 'кг'),
          type: 'performance',
        },
        independentMetrics: (Array.isArray(args.independent_metrics) ? args.independent_metrics : ['Фактор'])
          .map((name: string, index: number) => ({
            id: `metric_${index}_${hashId(String(name))}`,
            name: String(name),
            unit: 'ед.',
            type: 'numeric',
          })),
        baselineValue: args.baseline_value !== undefined ? args.baseline_value : 'База',
        dailyLogs: {},
        createdAt: new Date().toISOString(),
      });
      continue;
    }

    if (action.function === 'add_penalty') {
      aggregate.penalties.push({
        id: `pen_tg_${hashId(String(args.penaltyTask || args.reason || 'штраф'), localDayKey())}`,
        workoutDate: localDayKey(),
        reason: String(args.reason || 'Самодисциплина'),
        penaltyTask: String(args.penaltyTask || 'Штрафное задание'),
        status: 'pending',
        date: 'Сегодня',
        pointsDeducted: Math.max(1, Math.round(numOpt(args.pointsDeducted) || 5)),
      });
    }
  }

  if (workoutExercises.length > 0) {
    const day = parseDay(workoutArgs.date);
    const signature = workoutExercises
      .map((exercise) => `${normalizeName(exercise.name)}:${exercise.sets.map((set) => `${set.weight}x${set.reps}`).join(',')}`)
      .join(';');
    const id = `w_tg_${day}_${hashId(signature)}`;
    const startedAt = workoutArgs.started_at && typeof workoutArgs.started_at === 'string'
      ? workoutArgs.started_at
      : isoForDay(day, 12);

    const exercises: ExerciseLog[] = workoutExercises.map((exercise) => {
      const sets: CompletedSet[] = exercise.sets.map((set, index) => {
        const oneRM = round1(set.weight * (1 + set.reps / 30));
        return {
          id: `set_tg_${hashId(exercise.name, set.weight, set.reps, index)}`,
          setNumber: index + 1,
          weight: set.weight,
          reps: set.reps,
          ...(set.rpe !== undefined ? { rpe: set.rpe } : {}),
          timestamp: startedAt,
          calculated1RM: oneRM,
          normalizedRepsAt100kg: Math.max(0, Math.round(set.reps * (set.weight / 100))),
        };
      });
      const best1RM = sets.reduce((best, set) => Math.max(best, set.calculated1RM), 0);
      return {
        exerciseId: `ex_tg_${hashId(normalizeName(exercise.name))}`,
        name: exercise.name,
        sets,
        ...(exercise.notes ? { notes: exercise.notes } : {}),
        best1RM,
      };
    });

    const totalTonnageKg = round1(
      exercises.reduce((sum, exercise) => sum + exercise.sets.reduce((inner, set) => inner + set.weight * set.reps, 0), 0),
    );
    aggregate.workout = {
      id,
      title: String(workoutArgs.title || workoutArgs.workout_title || 'Тренировка из Telegram').slice(0, 100),
      date: day,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMinutes: Math.max(1, Math.round(numOpt(workoutArgs.duration_minutes ?? workoutArgs.duration) || Math.max(20, exercises.length * 12))),
      exercises,
      totalTonnageKg,
      status: 'completed',
    };
  }

  return aggregate;
}

function ensureState(state: StoredState, userId: string, userName?: string, username?: string): void {
  if (!state.user) {
    state.user = {
      id: userId,
      name: userName || 'Атлет',
      telegramUsername: username ? `@${username.replace(/^@/, '')}` : '',
      currentWeight: 0,
      targetWeight: 0,
      weightGoalType: 'maintain',
      stepGoalEnabled: true,
      dailyStepGoal: 10000,
      dailySteps: {},
      disciplineScore: 100,
      streakDays: 0,
      longestStreak: 0,
      selectedDisciplines: ['powerlifting', 'streetlifting'],
      inBodyRecords: [],
    };
  }
  if (!state.user.dailySteps || typeof state.user.dailySteps !== 'object') state.user.dailySteps = {};
  if (!Array.isArray(state.pastWorkouts)) state.pastWorkouts = [];
  if (!Array.isArray(state.sleepRecords)) state.sleepRecords = [];
  if (!Array.isArray(state.dailyNutritionRecords)) state.dailyNutritionRecords = [];
  if (!Array.isArray(state.personalRecords)) state.personalRecords = [];
  if (!Array.isArray(state.penalties)) state.penalties = [];
  if (!Array.isArray(state.marathons)) state.marathons = [];
}

async function applyAggregate(
  state: StoredState,
  userId: string,
  aggregate: Aggregate,
  actions: BotAction[],
  rawText: string,
): Promise<{ notices: string[]; hasMeaningfulData: boolean }> {
  const notices: string[] = [];
  const user = state.user as UserProfile;
  let hasMeaningfulData = false;
  const savedMetricKeys = new Set<string>();

  // 1. Тренировка
  if (aggregate.workout) {
    const workout = aggregate.workout;
    if (!state.pastWorkouts.some((item: any) => item?.id === workout.id)) {
      state.pastWorkouts.unshift(workout);
      hasMeaningfulData = true;
      notices.push(
        `🏋️ Тренировка записана в историю: ${describeExercises(
          workout.exercises.map((exercise) => ({
            name: exercise.name,
            sets: exercise.sets.map((set) => ({ weight: set.weight, reps: set.reps, rpe: set.rpe })),
          })),
        )}`,
      );

      // Личные рекорды по каждому упражнению
      let records = Array.isArray(state.personalRecords) ? state.personalRecords : [];
      for (const exercise of workout.exercises) {
        const update = updatePersonalRecord(records, exercise);
        records = update.records;
        if (update.improved) {
          notices.push(
            update.isNew
              ? `🏆 Новый личный рекорд: ${update.title} — ${update.valueText}`
              : `🔥 Рекорд обновлён: ${update.title} — ${update.valueText}`,
          );
        }
      }
      state.personalRecords = records;
    }
  }

  // 2. Дневные данные: сон, шаги, вес, еда
  const days = [...aggregate.dailyByDay.keys()].sort();
  for (const day of days) {
    const bucket = aggregate.dailyByDay.get(day)!;

    if (bucket.sleepHours !== undefined) {
      const bedtime = bucket.bedtime || '23:30';
      const wakeTime = bucket.wakeTime || addHoursToTime(bedtime, bucket.sleepHours);
      const hours = bucket.sleepHours;
      const quality = bucket.sleepQuality ?? (hours >= 8 ? 9 : hours >= 7 ? 8 : hours >= 6 ? 6 : 4);
      const feeling: SleepRecord['feeling'] =
        hours >= 8 && quality >= 8 ? 'peak' : hours >= 7 ? 'rested' : hours >= 6 ? 'normal' : 'exhausted';
      const record: SleepRecord = {
        id: `sleep_tg_${day}`,
        date: day,
        bedtime,
        wakeTime,
        durationHours: round1(hours),
        qualityScore: quality,
        feeling,
        notes: bucket.sleepNotes || 'Записано из Telegram',
      };
      const index = state.sleepRecords.findIndex((item: any) => item?.date === day);
      if (index >= 0) state.sleepRecords[index] = record;
      else state.sleepRecords.unshift(record);
      hasMeaningfulData = true;
      notices.push(`😴 Сон за ${day}: ${round1(hours)} ч, качество ${quality}/10.`);
    }

    if (bucket.steps !== undefined) {
      state.user.dailySteps[day] = bucket.steps;
      hasMeaningfulData = true;
      notices.push(`👟 Шаги за ${day}: ${formatNumber(bucket.steps)}.`);
    }

    if (bucket.weightKg !== undefined && bucket.weightKg > 0) {
      user.currentWeight = round1(bucket.weightKg);
      const nutrition = state.dailyNutritionRecords.find((item: any) => item?.date === day);
      if (nutrition) nutrition.morningWeightKg = round1(bucket.weightKg);
      else {
        const record = emptyNutritionDay(user, day);
        record.morningWeightKg = round1(bucket.weightKg);
        state.dailyNutritionRecords.unshift(record);
      }
      savedMetricKeys.add(`вес тела|${day}`);
      await saveCustomMetric(
        userId,
        { name: 'Вес тела', value: round1(bucket.weightKg), unit: 'кг', category: 'body' },
        day,
        [],
      );
      hasMeaningfulData = true;
      notices.push(`⚖️ Вес: ${round1(bucket.weightKg)} кг.`);
    }

    if (bucket.meals.length > 0) {
      applyMeals(state, day, bucket.meals, notices);
      hasMeaningfulData = true;
    }

    if (bucket.waterLiters !== undefined) {
      savedMetricKeys.add(`вода|${day}`);
      await saveCustomMetric(userId, { name: 'Вода', value: round1(bucket.waterLiters), unit: 'л', category: 'nutrition_supps' }, day, notices);
      hasMeaningfulData = true;
    }
  }

  // 3. Замеры → свои показатели
  for (const metric of aggregate.metrics) {
    const key = `${normalizeName(metric.name)}|${localDayKey()}`;
    if (savedMetricKeys.has(key)) continue;
    savedMetricKeys.add(key);
    await saveCustomMetric(userId, metric, localDayKey(), notices);
    hasMeaningfulData = true;
  }

  // 4. Профиль
  if (Object.keys(aggregate.profilePatch).length > 0) {
    Object.assign(user, aggregate.profilePatch);
    hasMeaningfulData = true;
    if (numOpt(aggregate.profilePatch.dailyStepGoal) !== undefined) {
      notices.push(`🎯 Цель по шагам: ${formatNumber(num(aggregate.profilePatch.dailyStepGoal))}.`);
    }
  }

  // 5. Эксперименты и штрафы
  for (const experiment of aggregate.experiments) {
    try {
      const existing = await listCollection('experiments', userId);
      if (!existing.some((item: any) => item?.id === experiment.id)) {
        await upsertCollectionItem('experiments', userId, experiment);
        notices.push(`🔬 Эксперимент создан: «${experiment.title}».`);
        hasMeaningfulData = true;
      }
    } catch (err: any) {
      console.warn('[bot-ingestion] create experiment:', err?.message);
    }
  }
  for (const penalty of aggregate.penalties) {
    if (!state.penalties.some((item: any) => item?.id === penalty.id)) {
      state.penalties.unshift(penalty);
      notices.push(`⚠️ Назначено штрафное задание: «${penalty.penaltyTask}».`);
      hasMeaningfulData = true;
    }
  }

  // 6. Марафоны: шаги, тренировки, вес, свои показатели
  const marathonDays = new Set<string>([
    ...days,
    ...(aggregate.workout ? [aggregate.workout.date || localDayKey()] : []),
  ]);
  for (const day of marathonDays) {
    const bucket = aggregate.dailyByDay.get(day);
    applyMarathons(
      state,
      {
        day,
        steps: bucket?.steps,
        weightKg: bucket?.weightKg,
        workout: aggregate.workout && (aggregate.workout.date || localDayKey()) === day ? aggregate.workout : undefined,
        metrics: aggregate.metrics.map((metric) => ({ name: metric.name, value: metric.value })),
      },
      notices,
    );
  }

  // 7. Дисциплина: одно начисление за день, сколько бы действий ни пришло
  if (hasMeaningfulData) {
    const today = localDayKey();
    if (user.lastBotLogDate !== today) {
      user.lastBotLogDate = today;
      user.streakDays = Math.max(1, (user.streakDays || 0) + 1);
      user.longestStreak = Math.max(user.longestStreak || 0, user.streakDays);
      user.disciplineScore = Math.min(100, (user.disciplineScore || 85) + 2);
      notices.push(`🔥 Дисциплина: серия ${user.streakDays} дн., показатель ${user.disciplineScore}%.`);
    }
  }

  // 8. Активные исследования: подставляем сон, воду, шаги, вес и результат
  if (hasMeaningfulData) {
    const day = aggregate.workout?.date || days[days.length - 1] || localDayKey();
    const bucket = aggregate.dailyByDay.get(day);
    const nutrition = state.dailyNutritionRecords.find((item: any) => item?.date === day);
    await autofillExperiments(
      userId,
      {
        day,
        sleepHours: bucket?.sleepHours,
        steps: bucket?.steps,
        waterLiters: bucket?.waterLiters,
        weightKg: bucket?.weightKg ?? aggregate.profilePatch.currentWeight,
        workout: aggregate.workout,
        nutrition,
        metrics: aggregate.metrics.map((metric) => ({ name: metric.name, value: metric.value })),
        rawText,
      },
      notices,
    );
  }

  // Подсказка, если распознали только вопрос без данных
  if (!hasMeaningfulData && actions.length === 0) {
    // ничего не добавляем — ответ сформирует ИИ
  }

  return { notices, hasMeaningfulData };
}

/* ------------------------------------------------------------------ */
/* Публичная точка входа                                               */
/* ------------------------------------------------------------------ */

export interface IngestTurnOptions {
  userId: string;
  userName?: string;
  username?: string;
  text: string;
  actions: BotAction[];
  /** Пользователь явно попросил сохранить: «внеси», «запиши», «сохрани». */
  wantsSave: boolean;
}

/**
 * Один ход диалога с ботом.
 *
 * - данные + «внеси» → сохраняем сразу;
 * - данные без «внеси» → показываем предпросмотр и ждём подтверждения;
 * - «внеси» без новых данных → сохраняем ранее показанный предпросмотр;
 * - команды (цель, эксперимент, штраф) применяются сразу.
 */
export async function ingestBotTurn(options: IngestTurnOptions): Promise<IngestTurnResult> {
  const stored = await getUserState(options.userId);
  const state: StoredState = stored?.state && typeof stored.state === 'object' ? stored.state : {};
  ensureState(state, options.userId, options.userName, options.username);

  const incoming = sanitizeActions(options.actions);
  const dataActions = incoming.filter(isDataAction);
  const commandActions = incoming.filter(isCommandAction);

  const pending = state.botPending && Array.isArray(state.botPending.actions) ? state.botPending : null;
  const pendingFresh =
    pending && typeof pending.createdAt === 'string'
      ? Date.now() - Date.parse(pending.createdAt) < PENDING_TTL_HOURS * HOUR_MS
      : false;

  let toApply: BotAction[] = [];
  let mode: IngestTurnResult['mode'] = 'none';
  let preview: string[] = [];

  if (options.wantsSave) {
    if (dataActions.length > 0) {
      toApply = incoming;
      delete state.botPending;
    } else if (pendingFresh) {
      toApply = sanitizeActions(pending.actions);
      delete state.botPending;
    } else {
      toApply = commandActions;
    }
  } else {
    if (commandActions.length > 0) toApply = commandActions;
    if (dataActions.length > 0) {
      state.botPending = {
        actions: dataActions,
        rawText: options.text.slice(0, 2000),
        createdAt: new Date().toISOString(),
      };
      preview = describeActions(dataActions);
      mode = 'staged';
    }
  }

  let notices: string[] = [];
  if (toApply.length > 0) {
    const aggregate = aggregateActions(toApply);
    const applied = await applyAggregate(state, options.userId, aggregate, toApply, options.text);
    notices = applied.notices;
    if (notices.length > 0 && mode !== 'staged') mode = 'applied';
  }

  // pending мог быть создан в этом же ходе — сохраняем состояние один раз
  if (toApply.length > 0 || state.botPending) {
    await saveUserState(options.userId, state);
  }

  return {
    mode,
    notices,
    preview,
    hasPending: Boolean(state.botPending),
  };
}

/** Очищает предпросмотр (пользователь передумал). */
export async function clearPendingActions(userId: string): Promise<boolean> {
  const stored = await getUserState(userId);
  if (!stored?.state || !stored.state.botPending) return false;
  const state = stored.state as StoredState;
  delete state.botPending;
  await saveUserState(userId, state);
  return true;
}

/**
 * Текст-подтверждение для предпросмотра. Отдельно, чтобы бот не сохранял
 * данные, которые ИИ распознал с ошибкой.
 */
export function pendingReply(preview: string[]): string {
  if (preview.length === 0) return '';
  return `Понял, подготовил запись:\n${preview.join('\n')}\n\nЕсли всё верно, напиши «внеси» — сохраню во все разделы.`;
}
