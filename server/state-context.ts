/**
 * Ответы бота по данным приложения.
 *
 * Telegram-бот не имеет отдельной базы: он читает тот же снимок состояния,
 * который синхронизирует Mini App. Здесь мы собираем компактный контекст для
 * ИИ и отвечаем детерминированно на частые вопросы — калории, белок, шаги,
 * сон, вес, последняя тренировка, подходы с конкретным весом и рекорды.
 *
 * Модуль намеренно не зависит от Express и от хранилища: его легко тестировать.
 */
import type {
  CompletedSet,
  DailyNutritionRecord,
  ExerciseLog,
  FoodItem,
  PersonalRecord,
  SleepRecord,
  UserProfile,
  WorkoutRecord,
} from '../src/types.ts';
import { sanitizeCustomFoods } from '../src/lib/customFoods.ts';
import { BASE_FOODS_DATABASE } from '../src/data/foodsData.ts';

const TZ_OFFSET_HOURS = Number(process.env.NOTIFY_TZ_OFFSET_HOURS || 3);
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type StoredState = Record<string, any>;

/* ------------------------------------------------------------------ */
/* Даты и форматирование                                                */
/* ------------------------------------------------------------------ */

function dayKey(value: Date = new Date()): string {
  return new Date(value.getTime() + TZ_OFFSET_HOURS * HOUR_MS).toISOString().slice(0, 10);
}

function shiftDay(day: string, deltaDays: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + deltaDays * DAY_MS).toISOString().slice(0, 10);
}

function humanDate(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day || '—';
  const [y, m, d] = day.split('-');
  return `${d}.${m}.${y}`;
}

function humanDateFromIso(value: unknown): string {
  if (typeof value !== 'string' || !value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : humanDate(dayKey(parsed));
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('ru-RU');
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function plural(value: number, forms: [string, string, string]): string {
  const abs = Math.abs(Math.round(value)) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

function num(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.').replace(/[^\d.\-]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalize(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim();
}

function namesMatch(left: string, right: string): boolean {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const wordsA = a.split(' ').filter((word) => word.length > 2);
  const wordsB = new Set(b.split(' ').filter((word) => word.length > 2));
  if (wordsA.length === 0 || wordsB.size === 0) return false;
  const common = wordsA.filter((word) => wordsB.has(word)).length;
  return common >= Math.min(2, wordsA.length, wordsB.size);
}

function dayFromQuestion(text: string, fallback = dayKey()): string {
  const normalized = normalize(text);
  if (normalized.includes('позавчера')) return shiftDay(fallback, -2);
  if (normalized.includes('вчера')) return shiftDay(fallback, -1);

  const explicit = /(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?/.exec(text);
  if (explicit) {
    const now = new Date();
    const day = Number(explicit[1]);
    const month = Number(explicit[2]);
    const yearRaw = explicit[3] ? Number(explicit[3]) : now.getFullYear();
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return fallback;
}

/* ------------------------------------------------------------------ */
/* Тренировки                                                          */
/* ------------------------------------------------------------------ */

function workoutDay(workout: WorkoutRecord): string {
  if (workout.date && /^\d{4}-\d{2}-\d{2}$/.test(workout.date)) return workout.date;
  return workout.startedAt ? dayKey(new Date(workout.startedAt)) : '';
}

function sortWorkouts(workouts: WorkoutRecord[]): WorkoutRecord[] {
  return [...workouts]
    .filter((workout) => workout && Array.isArray(workout.exercises))
    .sort((a, b) => {
      const left = `${workoutDay(a)} ${a.startedAt || ''}`;
      const right = `${workoutDay(b)} ${b.startedAt || ''}`;
      return right.localeCompare(left);
    });
}

interface ExerciseHit {
  name: string;
  workout: WorkoutRecord;
  exercise: ExerciseLog;
  day: string;
}

function collectExerciseHits(workouts: WorkoutRecord[], exerciseName: string): ExerciseHit[] {
  const hits: ExerciseHit[] = [];
  for (const workout of sortWorkouts(workouts)) {
    for (const exercise of workout.exercises) {
      if (!namesMatch(exercise.name, exerciseName)) continue;
      hits.push({ name: exercise.name, workout, exercise, day: workoutDay(workout) });
    }
  }
  return hits;
}

function uniqueExerciseNames(workouts: WorkoutRecord[]): string[] {
  const names: string[] = [];
  for (const workout of sortWorkouts(workouts)) {
    for (const exercise of workout.exercises || []) {
      if (exercise?.name && !names.some((name) => namesMatch(name, exercise.name))) {
        names.push(exercise.name);
      }
    }
  }
  return names;
}

const EXERCISE_HINTS: Array<[RegExp, RegExp]> = [
  [/жим\s*(?:стоя|армейск)|армейск|жим\s*над\s*голов/i, /жим.*стоя|армейск|жим.*голов/i],
  [/жим|жал|пожал|бенч|bench/i, /жим|бенч|bench/i],
  [/присед|присел|присяд|squat/i, /присед|присяд|squat/i],
  [/станов|deadlift|тягу|тяга/i, /станов|тяг|deadlift/i],
  [/подтяг|подтян|pull.?up/i, /подтяг|подтян|pull.?up/i],
  [/брус|dip/i, /брус|dip/i],
  [/отжим|push.?up/i, /отжим|push.?up/i],
  [/жим\s*ног|leg\s*press/i, /жим.*ног|leg\s*press/i],
  [/планк|plank/i, /планк|plank/i],
  [/выпад|lunge/i, /выпад|lunge/i],
  [/тяга\s*(?:верхн|блок)|lat\s*pull/i, /тяга.*верхн|lat\s*pull/i],
];

function detectExercise(text: string, workouts: WorkoutRecord[]): string | null {
  const names = uniqueExerciseNames(workouts);

  // Сначала точное совпадение с названием упражнения из истории.
  for (const name of names) {
    const words = normalize(name).split(' ').filter((word) => word.length > 2);
    const textWords = new Set(normalize(text).split(' '));
    const common = words.filter((word) => textWords.has(word)).length;
    if (common >= Math.min(2, words.length)) return name;
  }

  // Затем — по характерному слову: «жал» → жим, «присел» → приседания.
  for (const [textPattern, historyPattern] of EXERCISE_HINTS) {
    if (!textPattern.test(text)) continue;
    const match = names.find((name) => historyPattern.test(name));
    if (match) return match;
  }

  // Если истории ещё нет, но человек спросил про известное движение —
  // отвечаем «записей нет» по каноническому названию.
  for (const [textPattern, historyPattern] of EXERCISE_HINTS) {
    if (!textPattern.test(text)) continue;
    if (historyPattern.test('жим штанги лежа')) return 'жим штанги лежа';
    if (historyPattern.test('приседания со штангой')) return 'приседания со штангой';
    if (historyPattern.test('становая тяга')) return 'становая тяга';
    if (historyPattern.test('подтягивания')) return 'подтягивания';
  }
  return null;
}

function extractQueryWeight(text: string): number | undefined {
  const withUnit = /(\d{2,3}(?:[.,]\d+)?)\s*(?:кг|килограмм|кило)\b/i.exec(text);
  if (withUnit) return Number(withUnit[1].replace(',', '.'));

  const afterExercise =
    /(?:жим|жал|пожал|присед|присел|тяг|станов|брус|подтяг|отжим|планк|выпад)\w*\D{0,14}(\d{2,3}(?:[.,]\d+)?)(?!\s*(?:раз|повтор|подход|мин|сек|км|м\b))/i.exec(
      text,
    );
  if (afterExercise) return Number(afterExercise[1].replace(',', '.'));
  return undefined;
}

function setText(set: CompletedSet): string {
  if (num(set.weight) > 0) return `${round1(num(set.weight))} кг × ${Math.round(num(set.reps))}`;
  return `${Math.round(num(set.reps))} раз`;
}

function bestSetOf(exercise: ExerciseLog): CompletedSet | null {
  let best: CompletedSet | null = null;
  let bestScore = -1;
  for (const set of exercise.sets || []) {
    const score = num(set.calculated1RM) || num(set.weight) * (1 + num(set.reps) / 30);
    if (score > bestScore) {
      bestScore = score;
      best = set;
    }
  }
  return best;
}

function exerciseLastSummary(hits: ExerciseHit[]): string[] {
  if (hits.length === 0) return [];
  const latest = hits[0];
  const sets = (latest.exercise.sets || []).map(setText);
  const best = bestSetOf(latest.exercise);
  const lines = [
    `Последний раз — ${humanDate(latest.day)}: ${latest.exercise.name}${sets.length ? `, ${sets.join(', ')}` : ''}.`,
  ];
  if (best) {
    const oneRm = num(best.calculated1RM) || num(best.weight) * (1 + num(best.reps) / 30);
    if (oneRm > 0) lines.push(`Лучший подход этой тренировки: ${setText(best)} (~${Math.round(oneRm)} кг расчётный максимум).`);
  }
  return lines;
}

/* ------------------------------------------------------------------ */
/* Контекст для ИИ                                                     */
/* ------------------------------------------------------------------ */

export function buildStateContext(state: StoredState): Record<string, any> {
  const today = dayKey();
  const user = (state.user || {}) as UserProfile;
  const nutrition = sortNutrition(asArray<DailyNutritionRecord>(state.dailyNutritionRecords));
  const sleep = asArray<SleepRecord>(state.sleepRecords)
    .filter((item) => item && item.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const workouts = sortWorkouts(asArray<WorkoutRecord>(state.pastWorkouts));
  const records = asArray<PersonalRecord>(state.personalRecords);
  const steps = (user.dailySteps || {}) as Record<string, number>;

  const todayNutrition = nutrition.find((record) => record.date === today);
  const last7Days = Array.from({ length: 7 }, (_, index) => shiftDay(today, -index)).reverse();

  const nutritionWeek = last7Days
    .map((day) => {
      const record = nutrition.find((item) => item.date === day);
      if (!record) return { date: day, calories: 0, protein: 0, meals: 0 };
      return {
        date: day,
        calories: Math.round(num(record.totalCalories)),
        protein: round1(num(record.totalProtein)),
        meals: Array.isArray(record.meals) ? record.meals.length : 0,
      };
    })
    .filter((row) => row.calories > 0 || row.meals > 0);

  const exerciseHistory = uniqueExerciseNames(workouts)
    .slice(0, 10)
    .map((name) => {
      const hits = collectExerciseHits(workouts, name);
      const latest = hits[0];
      const best = latest ? bestSetOf(latest.exercise) : null;
      return {
        name,
        lastDate: latest?.day || null,
        lastSets: latest ? (latest.exercise.sets || []).map(setText) : [],
        bestSet: best ? setText(best) : null,
        sessions: hits.length,
      };
    });

  const savedDishes = sanitizeCustomFoods(state.customFoods, BASE_FOODS_DATABASE)
    .filter((food) => food && food.name)
    .slice(0, 30)
    .map((food) => ({
      name: food.name,
      grams: Math.round(num(food.defaultGrams) || 100),
      caloriesPer100g: Math.round(num(food.caloriesPer100g)),
      proteinPer100g: round1(num(food.proteinPer100g)),
      fatPer100g: round1(num(food.fatPer100g)),
      carbsPer100g: round1(num(food.carbsPer100g)),
    }));

  return {
    today,
    profile: {
      name: user.name || 'Атлет',
      currentWeight: round1(num(user.currentWeight)),
      targetWeight: round1(num(user.targetWeight)),
      goal: user.weightGoalType || 'maintain',
      heightCm: num(user.heightCm) || null,
      age: num(user.age) || null,
      gender: user.gender || null,
      activityLevel: user.activityLevel || null,
      dailyStepGoal: Math.round(num(user.dailyStepGoal) || 10000),
    },
    nutritionToday: todayNutrition
      ? {
          date: todayNutrition.date,
          calories: Math.round(num(todayNutrition.totalCalories)),
          protein: round1(num(todayNutrition.totalProtein)),
          fat: round1(num(todayNutrition.totalFat)),
          carbs: round1(num(todayNutrition.totalCarbs)),
          fiber: round1(num(todayNutrition.totalFiber)),
          targetCalories: Math.round(num(todayNutrition.targetCalories)),
          targetProtein: Math.round(num(todayNutrition.targetProtein)),
          remainingCalories: Math.round(
            num(todayNutrition.targetCalories) - num(todayNutrition.totalCalories),
          ),
          meals: asArray<DailyNutritionRecord['meals'][number]>(todayNutrition.meals).map((meal) => ({
            name: meal.name,
            grams: Math.round(num(meal.grams)),
            calories: Math.round(num(meal.calories)),
            protein: round1(num(meal.protein)),
            components: Array.isArray(meal.components)
              ? meal.components.map((component) => ({
                  name: component.name,
                  grams: Math.round(num(component.grams)),
                  calories: Math.round(num(component.calories)),
                  protein: round1(num(component.protein)),
                }))
              : undefined,
          })),
        }
      : null,
    nutritionWeek,
    steps: {
      today: Math.round(num(steps[today])),
      goal: Math.round(num(user.dailyStepGoal) || 10000),
      week: last7Days.map((day) => ({ date: day, steps: Math.round(num(steps[day])) })),
    },
    sleep: {
      latest: sleep[0]
        ? {
            date: sleep[0].date,
            hours: round1(num(sleep[0].durationHours)),
            quality: Math.round(num(sleep[0].qualityScore)),
            bedtime: sleep[0].bedtime || null,
            wakeTime: sleep[0].wakeTime || null,
          }
        : null,
      week: sleep.slice(0, 7),
    },
    weight: {
      current: round1(num(user.currentWeight)),
      latestMorning: nutrition.find((record) => num(record.morningWeightKg) > 0)
        ? {
            date: nutrition.find((record) => num(record.morningWeightKg) > 0)!.date,
            kg: round1(num(nutrition.find((record) => num(record.morningWeightKg) > 0)!.morningWeightKg)),
          }
        : null,
    },
    workouts: workouts.slice(0, 5).map((workout) => ({
      date: workoutDay(workout),
      title: workout.title,
      durationMinutes: Math.round(num(workout.durationMinutes)),
      tonnageKg: Math.round(num(workout.totalTonnageKg)),
      exercises: asArray<ExerciseLog>(workout.exercises).map((exercise) => ({
        name: exercise.name,
        sets: asArray<CompletedSet>(exercise.sets).map(setText),
      })),
    })),
    exerciseHistory,
    personalRecords: records.slice(0, 15).map((record) => ({
      title: record.title,
      best: record.currentBest,
      updatedAt: record.updatedAt || null,
    })),
    savedDishes,
  };
}

/* ------------------------------------------------------------------ */
/* Детерминированные ответы                                            */
/* ------------------------------------------------------------------ */

function sortNutrition(records: DailyNutritionRecord[]): DailyNutritionRecord[] {
  return [...records]
    .filter((record) => record && /^\d{4}-\d{2}-\d{2}$/.test(String(record.date)))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function nutritionFor(state: StoredState, day: string): DailyNutritionRecord | undefined {
  return sortNutrition(asArray<DailyNutritionRecord>(state.dailyNutritionRecords)).find(
    (record) => record.date === day,
  );
}

function isQuestion(text: string): boolean {
  return /(\?|сколько|скок|когда|какой|какая|какие|каков|что\s+я|что\s+по|покажи|напомни|есть\s+ли|как\s+я|мой|моя|мои|мое|моё|осталось|остаток)/i.test(
    text,
  );
}

export function shouldAnswerDirectly(text: string): boolean {
  if (!isQuestion(text)) return false;
  // «Съел X, сколько осталось?» — это ещё и запись данных: пусть её разберёт ИИ.
  const hasLogIntent =
    /(съел|съела|поел|поела|ел\b|ела\b|запиши|внеси|сохрани|добавь|спал|поспал|прош[её]л|сделал|пожал|присел|вешу|жим|жал|присед|тяга|подтяг|брус|отжим)/i.test(
      text,
    );
  const startsWithQuestion = /^\s*(сколько|скок|когда|какой|какая|какие|что|покажи|напомни|есть\s+ли|как\s+я)/i.test(
    text.trim(),
  );
  if (hasLogIntent && /\d/.test(text) && !startsWithQuestion) return false;
  return true;
}

function answerNutrition(
  text: string,
  state: StoredState,
  nutrient: 'calories' | 'protein' | 'fat' | 'carbs' | 'fiber' | 'all',
): string | null {
  const day = dayFromQuestion(text);
  const record = nutritionFor(state, day);
  if (!record) {
    return `За ${humanDate(day)} питание ещё не записано. Напишите, что съели, — я разложу по калориям и БЖУ.`;
  }

  const calories = Math.round(num(record.totalCalories));
  const protein = round1(num(record.totalProtein));
  const fat = round1(num(record.totalFat));
  const carbs = round1(num(record.totalCarbs));
  const fiber = round1(num(record.totalFiber));
  const targetCalories = Math.round(num(record.targetCalories));
  const targetProtein = Math.round(num(record.targetProtein));
  const remaining = targetCalories - calories;
  const prefix = day === dayKey() ? 'Сегодня' : `За ${humanDate(day)}`;

  if (nutrient === 'calories') {
    if (/остал|остаток|добрать|можно\s+еще|можно\s+ещё/i.test(text)) {
      return remaining >= 0
        ? `${prefix} съедено ${formatNumber(calories)} ккал из ${formatNumber(targetCalories)}. Осталось ${formatNumber(remaining)} ккал.`
        : `${prefix} съедено ${formatNumber(calories)} ккал, это на ${formatNumber(Math.abs(remaining))} ккал больше цели ${formatNumber(targetCalories)}.`;
    }
    return `${prefix}: ${formatNumber(calories)} ккал из ${formatNumber(targetCalories)}.\nБ ${protein} / Ж ${fat} / У ${carbs} / клетчатка ${fiber} г.${remaining >= 0 ? `\nДо цели осталось ${formatNumber(remaining)} ккал.` : `\nВыше цели на ${formatNumber(Math.abs(remaining))} ккал.`}`;
  }

  if (nutrient === 'protein') {
    const left = Math.max(0, targetProtein - protein);
    return `${prefix}: белка ${protein} г из ${targetProtein} г.${left > 0 ? ` Добрать ещё ${round1(left)} г.` : ' Норма закрыта.'}`;
  }

  const values = {
    fat: `жиров ${fat} г`,
    carbs: `углеводов ${carbs} г`,
    fiber: `клетчатки ${fiber} г`,
    all: `Б ${protein} / Ж ${fat} / У ${carbs} / клетчатка ${fiber} г`,
  };
  return `${prefix}: ${values[nutrient]}. Калории: ${formatNumber(calories)} из ${formatNumber(targetCalories)}.`;
}

function answerMeals(text: string, state: StoredState): string {
  const day = dayFromQuestion(text);
  const record = nutritionFor(state, day);
  const meals = asArray<DailyNutritionRecord['meals'][number]>(record?.meals);
  if (!record || meals.length === 0) {
    return `За ${humanDate(day)} приёмов пищи в дневнике нет.`;
  }
  const lines = meals.slice(0, 12).map((meal) => {
    const head = `• ${meal.name}${num(meal.grams) > 0 ? ` — ${Math.round(num(meal.grams))} г` : ''}: ${Math.round(num(meal.calories))} ккал, Б ${round1(num(meal.protein))}`;
    const components = Array.isArray(meal.components) ? meal.components : [];
    if (components.length === 0) return head;
    const composition = components
      .map((component) => `${component.name} ${Math.round(num(component.grams))} г`)
      .join(', ');
    return `${head}\n  состав: ${composition}`;
  });
  return `Питание за ${humanDate(day)} (${Math.round(num(record.totalCalories))} ккал):\n${lines.join('\n')}`;
}

function answerSteps(text: string, state: StoredState): string {
  const user = (state.user || {}) as UserProfile;
  const steps = (user.dailySteps || {}) as Record<string, number>;
  const today = dayKey();

  if (/недел|7\s*дн|семь\s*дн/i.test(text)) {
    const days = Array.from({ length: 7 }, (_, index) => shiftDay(today, -index)).reverse();
    const values = days.map((day) => Math.round(num(steps[day])));
    const total = values.reduce((sum, value) => sum + value, 0);
    const avg = Math.round(total / days.length);
    return `Шаги за 7 дней: всего ${formatNumber(total)}, в среднем ${formatNumber(avg)} в день.\n${days.map((day, index) => `${humanDate(day)}: ${formatNumber(values[index])}`).join('\n')}`;
  }

  const day = dayFromQuestion(text);
  const value = Math.round(num(steps[day]));
  const goal = Math.round(num(user.dailyStepGoal) || 10000);
  if (!value) return `За ${humanDate(day)} шаги не записаны. Напишите, например: «прошёл 10 000 шагов».`;
  const percent = Math.round((value / goal) * 100);
  return `За ${humanDate(day)}: ${formatNumber(value)} шагов (${percent}% от цели ${formatNumber(goal)}).${value >= goal ? ' Цель закрыта.' : ` Осталось ${formatNumber(goal - value)}.`}`;
}

function answerSleep(text: string, state: StoredState): string {
  const records = asArray<SleepRecord>(state.sleepRecords)
    .filter((record) => record && record.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (records.length === 0) return 'Записей о сне пока нет. Напишите, например: «спал 7 часов».';

  if (/недел|7\s*дн|семь\s*дн/i.test(text)) {
    const week = records.slice(0, 7);
    const avg = round1(
      week.reduce((sum, record) => sum + num(record.durationHours), 0) / week.length,
    );
    return `Сон за последние ${week.length} записей: в среднем ${avg} ч.\n${week
      .map((record) => `${humanDate(record.date)}: ${round1(num(record.durationHours))} ч, качество ${Math.round(num(record.qualityScore))}/10`)
      .join('\n')}`;
  }

  const latest = records[0];
  return `Последний сон (${humanDate(latest.date)}): ${round1(num(latest.durationHours))} ч, качество ${Math.round(num(latest.qualityScore))}/10${latest.bedtime ? `, отбой ${latest.bedtime}` : ''}${latest.wakeTime ? `, подъём ${latest.wakeTime}` : ''}.`;
}

function answerWeight(text: string, state: StoredState): string {
  const user = (state.user || {}) as UserProfile;
  const nutrition = sortNutrition(asArray<DailyNutritionRecord>(state.dailyNutritionRecords));
  const latestMorning = nutrition.find((record) => num(record.morningWeightKg) > 0);
  const current = round1(num(user.currentWeight));
  const target = round1(num(user.targetWeight));

  const parts: string[] = [];
  if (current > 0) parts.push(`Текущий вес: ${current} кг`);
  if (target > 0) parts.push(`цель: ${target} кг`);
  if (latestMorning) {
    parts.push(
      `последнее утреннее взвешивание: ${round1(num(latestMorning.morningWeightKg))} кг (${humanDate(latestMorning.date)})`,
    );
  }
  if (parts.length === 0) return 'Вес пока не записан. Напишите, например: «вес 80.5 кг».';
  return `${parts.join(', ')}.`;
}

function answerLastWorkout(state: StoredState): string {
  const workouts = sortWorkouts(asArray<WorkoutRecord>(state.pastWorkouts));
  if (workouts.length === 0) return 'Тренировок в истории пока нет.';
  const workout = workouts[0];
  const exercises = asArray<ExerciseLog>(workout.exercises).slice(0, 6).map((exercise) => {
    const sets = asArray<CompletedSet>(exercise.sets).map(setText);
    return `• ${exercise.name}${sets.length ? `: ${sets.join(', ')}` : ''}`;
  });
  return `Последняя тренировка — ${humanDate(workoutDay(workout))}, «${workout.title}»${num(workout.durationMinutes) > 0 ? `, ${Math.round(num(workout.durationMinutes))} мин` : ''}${num(workout.totalTonnageKg) > 0 ? `, тоннаж ${formatNumber(num(workout.totalTonnageKg))} кг` : ''}:\n${exercises.join('\n')}`;
}

function answerExercise(text: string, state: StoredState): string | null {
  const workouts = asArray<WorkoutRecord>(state.pastWorkouts);
  if (workouts.length === 0) return null;

  const exerciseName = detectExercise(text, workouts);
  if (!exerciseName) return null;

  const hits = collectExerciseHits(workouts, exerciseName);
  const actualName = hits[0]?.name || exerciseName;
  const weight = extractQueryWeight(text);

  const wantsRecord = /рекорд|максимум|лучш|прогресс|прибав/i.test(text);
  const wantsWhen = /когда|какого\s+числа|дата/i.test(text);
  const wantsCount = /сколько\s+(?:раз|повтор|подход)/i.test(text);

  if (weight !== undefined) {
    const matching: Array<{ hit: ExerciseHit; set: CompletedSet }> = [];
    for (const hit of hits) {
      for (const set of hit.exercise.sets || []) {
        if (Math.abs(num(set.weight) - weight) <= 0.51) matching.push({ hit, set });
      }
    }

    if (matching.length === 0) {
      const last = hits[0];
      return `С ${round1(weight)} кг в «${actualName}» записей нет.${last ? ` Последний раз: ${humanDate(last.day)} — ${(last.exercise.sets || []).map(setText).join(', ')}.` : ''}`;
    }

    const latest = matching[0];
    const reps = matching.map(({ set }) => Math.round(num(set.reps)));
    const totalReps = reps.reduce((sum, value) => sum + value, 0);
    const setsCount = reps.length;
    const dates = [...new Set(matching.map(({ hit }) => hit.day))];

    if (wantsWhen) {
      return `С ${round1(weight)} кг в «${actualName}»:\n${dates
        .slice(0, 6)
        .map((day) => {
          const daySets = matching.filter(({ hit }) => hit.day === day).map(({ set }) => Math.round(num(set.reps)));
          return `• ${humanDate(day)} — ${daySets.join(', ')} повт.`;
        })
        .join('\n')}\nПоследний раз — ${humanDate(latest.hit.day)}.`;
    }

    if (/сколько\s+подход/i.test(text)) {
      return `С ${round1(weight)} кг в «${actualName}»: ${setsCount} подходов за всё время. Последний раз — ${humanDate(latest.hit.day)}, ${reps.join(', ')} повт.`;
    }

    if (wantsCount || /сколько\s+раз/i.test(text)) {
      return `С ${round1(weight)} кг в «${actualName}»: ${reps.join(', ')} повт. (всего ${totalReps} за ${setsCount} ${plural(setsCount, ['подход', 'подхода', 'подходов'])}). Последний раз — ${humanDate(latest.hit.day)}.`;
    }

    return `С ${round1(weight)} кг в «${actualName}»: ${reps.join(', ')} повт. Последний раз — ${humanDate(latest.hit.day)}.`;
  }

  if (hits.length === 0) {
    return `По упражнению «${actualName}» записей пока нет.`;
  }

  if (wantsRecord) {
    let bestHit: ExerciseHit | null = null;
    let bestSet: CompletedSet | null = null;
    let bestScore = -1;
    for (const hit of hits) {
      for (const set of hit.exercise.sets || []) {
        const score = num(set.calculated1RM) || num(set.weight) * (1 + num(set.reps) / 30);
        if (score > bestScore) {
          bestScore = score;
          bestHit = hit;
          bestSet = set;
        }
      }
    }
    if (bestHit && bestSet) {
      const oneRm = num(bestSet.calculated1RM) || num(bestSet.weight) * (1 + num(bestSet.reps) / 30);
      return `Лучший подход в «${actualName}»: ${setText(bestSet)} — ${humanDate(bestHit.day)}. Расчётный максимум ~${Math.round(oneRm)} кг.`;
    }
  }

  if (wantsWhen) {
    return `Последний раз «${actualName}» — ${humanDate(hits[0].day)}: ${(hits[0].exercise.sets || []).map(setText).join(', ')}. Всего тренировок с этим упражнением: ${hits.length}.`;
  }

  return exerciseLastSummary(hits).join('\n');
}

function answerPersonalRecords(text: string, state: StoredState): string | null {
  const records = asArray<PersonalRecord>(state.personalRecords);
  if (records.length === 0) return null;

  const exerciseName = detectExercise(text, asArray<WorkoutRecord>(state.pastWorkouts));
  const matched = exerciseName ? records.find((record) => namesMatch(record.title, exerciseName)) : undefined;

  if (/рекорд|личн|пр/i.test(text) || matched) {
    const list = matched ? [matched] : records.slice(0, 8);
    return `Личные рекорды:\n${list
      .map((record) => `• ${record.title}: ${record.currentBest}${record.updatedAt ? ` (${humanDateFromIso(record.updatedAt)})` : ''}`)
      .join('\n')}`;
  }
  return null;
}

function answerSavedDishes(text: string, state: StoredState): string | null {
  if (!/блюд|продукт|рецепт|заготовк/i.test(text)) return null;
  if (!/(мои|сохран|список|какие|покажи|запомн)/i.test(text)) return null;
  // «Какие блюда я ел» — это дневник, а не список заготовок.
  if (/(ел\b|ела\b|съел|съела|поел|поела|рацион|дневник)/i.test(text)) return null;

  const dishes = sanitizeCustomFoods(state.customFoods, BASE_FOODS_DATABASE).filter(
    (food) => food && food.name,
  );
  if (dishes.length === 0) {
    return 'Сохранённых блюд пока нет. Напишите, например: «Запомни блюдо завтрак стандартный: 500 г, 600 ккал, 35 белка, 20 жиров, 60 углеводов».';
  }
  return `Сохранённые блюда:\n${dishes
    .slice(0, 20)
    .map((dish) => {
      const grams = Math.round(num(dish.defaultGrams) || 100);
      const calories = Math.round(num(dish.caloriesPer100g) * (grams / 100));
      return `• ${dish.name} — ${grams} г, ${calories} ккал`;
    })
    .join('\n')}\n\nПросто напишите название — я внесу его в дневник.`;
}

function answerTodaySummary(state: StoredState): string {
  const today = dayKey();
  const user = (state.user || {}) as UserProfile;
  const record = nutritionFor(state, today);
  const workouts = sortWorkouts(asArray<WorkoutRecord>(state.pastWorkouts));
  const sleep = asArray<SleepRecord>(state.sleepRecords)
    .filter((item) => item?.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];

  const lines = [`Сводка за ${humanDate(today)}:`];
  if (record) {
    lines.push(
      `🍽 ${Math.round(num(record.totalCalories))} ккал, Б ${round1(num(record.totalProtein))} / Ж ${round1(num(record.totalFat))} / У ${round1(num(record.totalCarbs))} г.`,
    );
  } else {
    lines.push('🍽 Питание ещё не записано.');
  }
  lines.push(`👟 ${formatNumber(num((user.dailySteps || {})[today]))} шагов.`);
  if (sleep) lines.push(`😴 Сон ${round1(num(sleep.durationHours))} ч, качество ${Math.round(num(sleep.qualityScore))}/10.`);
  if (workouts[0]) lines.push(`🏋️ Последняя тренировка: ${humanDate(workoutDay(workouts[0]))}, «${workouts[0].title}».`);
  return lines.join('\n');
}

/**
 * Пытается ответить на вопрос по данным. Возвращает null, если это не вопрос
 * о своих данных — тогда ответит ИИ или обычный разбор записи.
 */
export function answerDataQuestion(text: string, state: StoredState): string | null {
  const raw = String(text || '').trim();
  if (!raw || !shouldAnswerDirectly(raw)) return null;

  const lower = raw.toLowerCase();

  // Свои сохранённые блюда
  const dishes = answerSavedDishes(lower, state);
  if (dishes) return dishes;

  // Упражнения и рекорды: важнее общего «сколько»
  if (/(жим|жал|пожал|присед|присел|станов|тяг|подтяг|брус|отжим|планк|выпад|бенч)/i.test(lower)) {
    if (/рекорд|личн|максимум|лучш/i.test(lower)) {
      const recordAnswer = answerPersonalRecords(lower, state);
      if (recordAnswer) return recordAnswer;
    }
    const exercise = answerExercise(lower, state);
    if (exercise) return exercise;
  }

  if (/рекорд|личн(?:ый|ые|ых)?\s+рекорд/i.test(lower)) {
    const recordAnswer = answerPersonalRecords(lower, state);
    if (recordAnswer) return recordAnswer;
  }

  if (/трениров/i.test(lower) && /(последн|когда|прошл|была|был|было)/i.test(lower)) {
    return answerLastWorkout(state);
  }

  if (/что\s+я\s+(?:ел|съел|поел)|какие\s+блюда|рацион|приемы?\s+пищи|приёмы?\s+пищи/i.test(lower)) {
    return answerMeals(lower, state);
  }

  if (/шаг/i.test(lower)) return answerSteps(lower, state);

  if (/(сон|спал|поспал|выспал)/i.test(lower)) return answerSleep(lower, state);

  if (/(вес|масса|взвеш)/i.test(lower) && !/(белк|жир|углевод|калор)/i.test(lower)) {
    return answerWeight(lower, state);
  }

  // «Сколько калорий в банане» — вопрос о продукте, а не о своих данных.
  const nutritionWord = /калор|ккал|белк|протеин|жир|углевод|клетчат/i.test(lower);
  const personalMarker =
    /(я\b|меня|мне|съел|съела|съело|сегодня|вчера|позавчера|набрал|набрала|остал|остаток|мой|моя|мои|мое|моё|за\s+день|рацион|дневник)/i.test(
      lower,
    );
  // «в банане», «в 100 г банана», «на творог» — про продукт, не про дневник.
  const foodContent =
    /(?:в|на|у)\s+(?:\d+\s*(?:г|гр|грамм)\s+)?[а-яё]/i.test(lower);
  if (nutritionWord && !personalMarker && foodContent) {
    return null;
  }

  if (/белк|протеин/i.test(lower)) return answerNutrition(lower, state, 'protein');
  if (/жир/i.test(lower)) return answerNutrition(lower, state, 'fat');
  if (/углевод/i.test(lower)) return answerNutrition(lower, state, 'carbs');
  if (/клетчат/i.test(lower)) return answerNutrition(lower, state, 'fiber');
  if (/калор|ккал|съеден/i.test(lower)) return answerNutrition(lower, state, 'calories');

  if (/что\s+по\s+сегодня|как\s+я\s+сегодня|сводка|как\s+дела/i.test(lower)) {
    return answerTodaySummary(state);
  }

  return null;
}
