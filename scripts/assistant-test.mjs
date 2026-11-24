/**
 * Проверка ответов бота по данным приложения и сохранённых блюд.
 * Работает на файловом хранилище во временном каталоге.
 * Запуск: npm run test:assistant
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' :: ' + extra : ''}`);
  if (!cond) failures += 1;
};

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'getfit-assistant-'));
process.env.DATA_DIR = dataDir;
process.env.NOTIFY_TZ_OFFSET_HOURS = '3';
delete process.env.DATABASE_URL;

const storage = await import('../server/storage.ts');
const ingest = await import('../server/bot-ingestion.ts');
const qa = await import('../server/state-context.ts');
const { sanitizeCustomFoods } = await import('../src/lib/customFoods.ts');
const { BASE_FOODS_DATABASE } = await import('../src/data/foodsData.ts');
await storage.initStorage();

const userId = 'tg:5555';
const today = ingest.localDayKey();
const yesterday = ingest.localDayKey(new Date(Date.now() - 86400000));
const yesterdayHuman = yesterday.split('-').reverse().join('.');

/* ---------- 1. Чистка старых customFoods ---------- */
const sanitized = sanitizeCustomFoods([
  {
    id: 'food_chicken_breast',
    name: 'Куриное филе (грудка сырая)',
    category: 'meat',
    caloriesPer100g: 113,
    proteinPer100g: 23.6,
    fatPer100g: 1.9,
    carbsPer100g: 0.4,
    fiberPer100g: 0,
  },
  {
    id: 'dish_1',
    name: 'Завтрак стандартный',
    category: 'custom',
    caloriesPer100g: 120,
    proteinPer100g: 7,
    fatPer100g: 4,
    carbsPer100g: 12,
    fiberPer100g: 1.6,
    defaultGrams: 500,
  },
  {
    id: 'dish_1_dup',
    name: 'Завтрак стандартный',
    category: 'custom',
    caloriesPer100g: 120,
    proteinPer100g: 7,
    fatPer100g: 4,
    carbsPer100g: 12,
    fiberPer100g: 1.6,
  },
], BASE_FOODS_DATABASE);
check(
  'базовые продукты и дубли удалены из своих блюд',
  sanitized.length === 1 && sanitized[0].name === 'Завтрак стандартный',
  JSON.stringify(sanitized),
);

/* ---------- 2. Начальное состояние ---------- */
await storage.saveUserState(userId, {
  user: {
    id: userId,
    name: 'Тест',
    telegramUsername: '@test',
    currentWeight: 80.5,
    targetWeight: 75,
    weightGoalType: 'lose',
    dailyStepGoal: 10000,
    dailySteps: { [today]: 12400, [yesterday]: 8000 },
    disciplineScore: 90,
    streakDays: 0,
    longestStreak: 0,
    selectedDisciplines: ['powerlifting'],
    inBodyRecords: [],
  },
  pastWorkouts: [
    {
      id: 'w1',
      title: 'Грудь',
      date: yesterday,
      startedAt: `${yesterday}T12:00:00.000Z`,
      durationMinutes: 60,
      totalTonnageKg: 900,
      status: 'completed',
      exercises: [
        {
          exerciseId: 'e_bench',
          name: 'Жим штанги лёжа',
          sets: [
            { id: 's1', setNumber: 1, weight: 100, reps: 5, timestamp: '', calculated1RM: 116.7, normalizedRepsAt100kg: 5 },
            { id: 's2', setNumber: 2, weight: 100, reps: 4, timestamp: '', calculated1RM: 113.3, normalizedRepsAt100kg: 4 },
          ],
        },
      ],
    },
  ],
  personalRecords: [
    {
      id: 'pr1',
      title: 'Жим штанги лёжа',
      category: 'strength',
      currentBest: '100 кг × 5',
      history: [],
      createdAt: `${yesterday}T12:00:00.000Z`,
      updatedAt: `${yesterday}T12:00:00.000Z`,
    },
  ],
  sleepRecords: [
    {
      id: 'sl1',
      date: today,
      bedtime: '23:30',
      wakeTime: '07:00',
      durationHours: 7.5,
      qualityScore: 8,
      feeling: 'rested',
    },
  ],
  dailyNutritionRecords: [
    {
      date: today,
      meals: [
        { id: 'm1', name: 'Овсянка', grams: 150, calories: 550, protein: 18, fat: 10, carbs: 90, fiber: 8, mealType: 'breakfast', timestamp: '' },
        { id: 'm2', name: 'Куриная грудка', grams: 200, calories: 330, protein: 62, fat: 8, carbs: 0, fiber: 0, mealType: 'lunch', timestamp: '' },
      ],
      totalCalories: 880,
      totalProtein: 80,
      totalFat: 18,
      totalCarbs: 90,
      totalFiber: 8,
      targetCalories: 2200,
      targetProtein: 160,
      targetFat: 70,
      targetCarbs: 240,
      targetFiber: 30,
      status: 'open',
    },
  ],
  penalties: [],
  marathons: [],
  customFoods: [],
});

let stored = await storage.getUserState(userId);
let state = stored.state;

/* ---------- 3. Вопросы по данным ---------- */
const answered = (question) => qa.answerDataQuestion(question, state) || '';

check('калории за сегодня', /880 ккал/.test(answered('сколько калорий я съел сегодня?')), answered('сколько калорий я съел сегодня?'));
check('белок за сегодня', /80 г из 160/.test(answered('сколько белка набрал?')), answered('сколько белка набрал?'));
check('остаток калорий', /1\s?320 ккал/.test(answered('сколько калорий осталось?')), answered('сколько калорий осталось?'));
check('шаги за сегодня', /12\s?400/.test(answered('сколько шагов сегодня?')), answered('сколько шагов сегодня?'));
check('сон', /7\.5 ч/.test(answered('сколько я спал?')), answered('сколько я спал?'));
check('вес', /80\.5 кг/.test(answered('какой у меня вес?')), answered('какой у меня вес?'));
check('последняя тренировка', /Жим штанги лёжа/.test(answered('когда была последняя тренировка?')), answered('когда была последняя тренировка?'));
check('повторы с 100 кг', /5, 4 повт/.test(answered('сколько раз я жал 100 кг?')), answered('сколько раз я жал 100 кг?'));
check('дата подхода со 100 кг', answered('когда я жал 100 кг?').includes(yesterdayHuman), answered('когда я жал 100 кг?'));
check('личный рекорд', /100 кг × 5/.test(answered('какой рекорд в жиме?')), answered('какой рекорд в жиме?'));
check('что ел сегодня', /Овсянка/.test(answered('что я ел сегодня?')), answered('что я ел сегодня?'));

check(
  'обычная запись еды не перехватывается как вопрос',
  qa.answerDataQuestion('съел 500 ккал, сколько осталось?', state) === null,
);
check(
  'вопрос о калориях в продукте уходит ИИ, а не в личный дневник',
  qa.answerDataQuestion('сколько калорий в банане?', state) === null &&
    qa.answerDataQuestion('сколько калорий в 100 г банана?', state) === null,
);
check(
  'вопрос «сколько калорий у меня» остаётся личным',
  /880 ккал/.test(answered('сколько калорий у меня?')),
  answered('сколько калорий у меня?'),
);

/* ---------- 4. Сохранение блюда без ИИ ---------- */
const dishAction = ingest.parseDishSaveCommand(
  'Запомни блюдо «Завтрак стандартный»: 500 г, 600 ккал, 35 белка, 20 жиров, 60 углеводов, 8 клетчатки',
);
check(
  'блюдо разобрано без ИИ',
  dishAction?.function === 'save_dish' &&
    dishAction?.args?.grams === 500 &&
    dishAction?.args?.calories === 600 &&
    dishAction?.args?.protein === 35,
  JSON.stringify(dishAction),
);

const savedDish = await ingest.ingestBotTurn({
  userId,
  userName: 'Тест',
  text: 'Запомни блюдо «Завтрак стандартный»: 500 г, 600 ккал, 35 белка, 20 жиров, 60 углеводов, 8 клетчатки',
  actions: dishAction ? [dishAction] : [],
  wantsSave: false,
});
check('блюдо сохранено сразу', savedDish.mode === 'applied' && savedDish.notices.some((line) => line.includes('Блюдо сохранено')), JSON.stringify(savedDish.notices));

stored = await storage.getUserState(userId);
state = stored.state;
const saved = state.customFoods.find((food) => food.name.toLowerCase() === 'завтрак стандартный');
check('блюдо попало в customFoods', Boolean(saved), JSON.stringify(state.customFoods));
check(
  'БЖУ пересчитано на 100 г',
  saved?.caloriesPer100g === 120 && saved?.proteinPer100g === 7 && saved?.defaultGrams === 500,
  JSON.stringify(saved),
);

/* ---------- 5. Внесение блюда по названию ---------- */
const stagedMeal = await ingest.ingestBotTurn({
  userId,
  userName: 'Тест',
  text: 'Съел завтрак стандартный',
  actions: [{ function: 'log_daily', args: { meals: [{ name: 'Завтрак стандартный' }] } }],
  wantsSave: false,
});
check('блюдо по названию ждёт «внеси»', stagedMeal.mode === 'staged', stagedMeal.mode);

await ingest.ingestBotTurn({
  userId,
  userName: 'Тест',
  text: 'внеси',
  actions: [],
  wantsSave: true,
});
stored = await storage.getUserState(userId);
state = stored.state;
const todayRecord = state.dailyNutritionRecords.find((record) => record.date === today);
const loggedDish = todayRecord?.meals?.find((meal) => meal.name.toLowerCase() === 'завтрак стандартный');
check('блюдо записано в дневник', Boolean(loggedDish), JSON.stringify(todayRecord?.meals));
check(
  'подставилась привычная порция и БЖУ',
  loggedDish?.grams === 500 && loggedDish?.calories === 600 && loggedDish?.protein === 35,
  JSON.stringify(loggedDish),
);
check(
  'калории дня пересчитаны',
  todayRecord?.totalCalories === 1480 && todayRecord?.totalProtein === 115,
  `${todayRecord?.totalCalories}/${todayRecord?.totalProtein}`,
);

/* ---------- 6. Разбор еды с сохранённым блюдом ---------- */
const heuristic = ingest.heuristicMeals('на обед съел завтрак стандартный и банан', state.customFoods);
check(
  'сохранённое блюдо не разваливается на базовые продукты',
  heuristic.some((meal) => meal.name.toLowerCase() === 'завтрак стандартный') &&
    heuristic.some((meal) => /банан/i.test(meal.name)) &&
    !heuristic.some((meal) => /овсян|куриное филе|макароны/i.test(meal.name)),
  JSON.stringify(heuristic),
);

/* ---------- 7. Контекст для ИИ ---------- */
const context = qa.buildStateContext(state);
check('контекст содержит питание', context.nutritionToday?.calories === 1480, JSON.stringify(context.nutritionToday));
check('контекст содержит шаги', context.steps?.today === 12400, String(context.steps?.today));
check('контекст содержит сохранённые блюда', context.savedDishes?.some((food) => /завтрак/i.test(food.name)), JSON.stringify(context.savedDishes));

/* ---------- 8. Составной приём пищи ---------- */
const compositeState = {
  ...state,
  dailyNutritionRecords: state.dailyNutritionRecords.map((record) =>
    record.date === today
      ? {
          ...record,
          meals: [
            ...record.meals,
            {
              id: 'm3',
              name: 'Завтрак',
              grams: 550,
              calories: 744,
              protein: 39.8,
              fat: 31,
              carbs: 77,
              fiber: 10.6,
              mealType: 'breakfast',
              timestamp: '',
              components: [
                { name: 'Овсяная каша', grams: 100, calories: 352, protein: 12.3, fat: 6.2, carbs: 61.8, fiber: 10.6 },
                { name: 'Молоко 2.5%', grams: 300, calories: 156, protein: 8.4, fat: 7.5, carbs: 14.1, fiber: 0 },
                { name: 'Яйцо куриное', grams: 150, calories: 236, protein: 19.1, fat: 17.3, carbs: 1.1, fiber: 0 },
              ],
            },
          ],
        }
      : record,
  ),
};
const compositeAnswer = qa.answerDataQuestion('что я ел сегодня?', compositeState) || '';
check(
  'бот показывает состав составного приёма',
  compositeAnswer.includes('состав:') &&
    compositeAnswer.includes('Овсяная каша 100 г') &&
    compositeAnswer.includes('Молоко 2.5% 300 г') &&
    compositeAnswer.includes('Яйцо куриное 150 г'),
  compositeAnswer,
);
const compositeContext = qa.buildStateContext(compositeState);
const compositeContextMeal = compositeContext.nutritionToday?.meals?.find((meal) => meal.name === 'Завтрак');
check(
  'в контексте ИИ есть состав приёма',
  compositeContextMeal?.components?.length === 3,
  JSON.stringify(compositeContextMeal),
);

console.log(failures === 0 ? '\nОТВЕТЫ И БЛЮДА РАБОТАЮТ' : `\nПРОВАЛОВ: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
