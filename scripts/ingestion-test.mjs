/**
 * Проверка свободного внесения данных из Telegram-бота.
 * Работает на файловом хранилище во временном каталоге.
 * Запуск: npm run test:ingest
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' :: ' + extra : ''}`);
  if (!cond) failures += 1;
};

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'getfit-ingest-'));
process.env.DATA_DIR = dataDir;
process.env.NOTIFY_TZ_OFFSET_HOURS = '3';
delete process.env.DATABASE_URL;

const storage = await import('../server/storage.ts');
const ingest = await import('../server/bot-ingestion.ts');
await storage.initStorage();

const userId = 'tg:4242';
const today = ingest.localDayKey();
const endDate = new Date(Date.parse(`${today}T00:00:00Z`) + 30 * 86400000).toISOString().slice(0, 10);

const seed = {
  user: {
    id: userId,
    name: 'Тест',
    telegramUsername: '@test',
    currentWeight: 80,
    targetWeight: 75,
    weightGoalType: 'maintain',
    dailyStepGoal: 10000,
    dailySteps: {},
    disciplineScore: 90,
    streakDays: 0,
    longestStreak: 0,
    selectedDisciplines: ['powerlifting'],
    inBodyRecords: [],
  },
  pastWorkouts: [],
  personalRecords: [],
  sleepRecords: [],
  dailyNutritionRecords: [],
  penalties: [],
  marathons: [
    {
      id: 'm_steps',
      category: 'steps',
      title: 'Шаги 10к',
      targetMetricName: 'Шаги в день',
      targetGoalValue: 10000,
      unit: 'шагов',
      frequency: 'daily',
      durationDays: 14,
      currentDay: 1,
      startDate: today,
      endDate,
      status: 'active',
      bankedSurplus: 0,
      rewardRating: 100,
      rewardRespect: 10,
      rewardBadgeTitle: 'Шаги',
      dailyLogs: [],
    },
    {
      id: 'm_strength',
      category: 'strength',
      title: 'Объём 1500',
      targetMetricName: 'Общий вес',
      targetGoalValue: 1500,
      unit: 'кг',
      frequency: 'every_workout',
      durationDays: 30,
      currentDay: 1,
      startDate: today,
      endDate,
      status: 'active',
      bankedSurplus: 0,
      rewardRating: 100,
      rewardRespect: 10,
      rewardBadgeTitle: 'Сила',
      dailyLogs: [],
    },
  ],
};

await storage.saveUserState(userId, seed);
await storage.upsertCollectionItem('experiments', userId, {
  id: 'exp_sleep_bench',
  title: 'Сон и жим',
  hypothesis: 'Сон улучшает жим',
  startDate: today,
  endDate,
  durationDays: 30,
  status: 'active',
  dependentMetric: { name: 'Жим лёжа', unit: 'кг', type: 'performance' },
  independentMetrics: [
    { name: 'Сон', unit: 'ч', type: 'sleep' },
    { name: 'Шаги', unit: 'шагов', type: 'numeric' },
  ],
  dailyLogs: {},
  createdAt: new Date().toISOString(),
});

const actions = [
  {
    function: 'log_workout',
    args: {
      title: 'Грудь и ноги',
      exercises: [
        {
          name: 'Жим штанги лёжа',
          sets: [
            { weight: 100, reps: 5 },
            { weight: 100, reps: 5 },
            { weight: 100, reps: 4 },
          ],
        },
        { name: 'Приседания со штангой', sets: [{ weight: 120, reps: 8 }] },
      ],
    },
  },
  {
    function: 'log_daily',
    args: {
      sleep_hours: 7.5,
      sleep_quality: 8,
      steps: 12000,
      weight_kg: 80.2,
      meals: [
        { name: 'Овсянка', grams: 150, meal_type: 'breakfast' },
        { name: 'Куриная грудка', grams: 200, meal_type: 'lunch' },
      ],
    },
  },
  {
    function: 'log_metric',
    args: { name: 'Талия', value: 82, unit: 'см', category: 'body' },
  },
  {
    function: 'log_metric',
    args: { name: 'Вес', value: 80.2, unit: 'кг', category: 'body' },
  },
];

// 1. Без «внеси» данные только показываются, но не сохраняются
const staged = await ingest.ingestBotTurn({
  userId,
  userName: 'Тест',
  username: 'test',
  text: 'Жим 100 на 5, шаги 12000, спал 7.5',
  actions,
  wantsSave: false,
});
check('без «внеси» данные не сохраняются сразу', staged.mode === 'staged', staged.mode);
check('предпросмотр перечисляет тренировку и сон', staged.preview.some((line) => line.includes('Тренировка')) && staged.preview.some((line) => line.includes('Сон')), JSON.stringify(staged.preview));
let stored = await storage.getUserState(userId);
check('в истории пока пусто', stored.state.pastWorkouts.length === 0);
check('черновик ожидает подтверждения', Boolean(stored.state.botPending));

// 2. «Внеси» без новых данных сохраняет черновик
const applied = await ingest.ingestBotTurn({
  userId,
  userName: 'Тест',
  username: 'test',
  text: 'внеси',
  actions: [],
  wantsSave: true,
});
check('внеси сохраняет данные', applied.mode === 'applied', applied.mode);
check('в ответе есть подтверждения', applied.notices.length >= 3, JSON.stringify(applied.notices));

stored = await storage.getUserState(userId);
const state = stored.state;
const workout = state.pastWorkouts[0];

check('тренировка попала в историю', state.pastWorkouts.length === 1, String(state.pastWorkouts.length));
check('у тренировки правильное название', workout?.title === 'Грудь и ноги', workout?.title);
check('у тренировки есть startedAt', typeof workout?.startedAt === 'string' && !Number.isNaN(Date.parse(workout.startedAt)), workout?.startedAt);
check('статус завершён', workout?.status === 'completed', workout?.status);
check('два упражнения', workout?.exercises?.length === 2, String(workout?.exercises?.length));
check('тоннаж считается по всем подходам', workout?.totalTonnageKg === 2360, String(workout?.totalTonnageKg));
check('у подходов есть id и расчётный максимум', workout?.exercises?.[0]?.sets?.every((set) => set.id && set.calculated1RM > 0), JSON.stringify(workout?.exercises?.[0]?.sets?.[0]));
check('рабочий вес сохранён', workout?.exercises?.[0]?.sets?.[0]?.weight === 100 && workout?.exercises?.[0]?.sets?.[0]?.reps === 5);

check('сон записан один раз', state.sleepRecords.length === 1 && state.sleepRecords[0].durationHours === 7.5, JSON.stringify(state.sleepRecords));
check('шаги записаны в профиль', state.user.dailySteps?.[today] === 12000, String(state.user.dailySteps?.[today]));
check('вес обновлён', state.user.currentWeight === 80.2, String(state.user.currentWeight));
check('питание: два блюда', state.dailyNutritionRecords?.[0]?.meals?.length === 2, JSON.stringify(state.dailyNutritionRecords?.[0]?.meals?.map((meal) => meal.name)));
check('калории посчитаны', (state.dailyNutritionRecords?.[0]?.totalCalories || 0) > 0, String(state.dailyNutritionRecords?.[0]?.totalCalories));

check('личные рекорды созданы', state.personalRecords?.length === 2, String(state.personalRecords?.length));
const benchRecord = state.personalRecords?.find((record) => /жим/i.test(record.title));
check('рекорд жима: 100 кг × 5', benchRecord?.currentBest === '100 кг × 5', benchRecord?.currentBest);
check('дисциплина начислена один раз', state.user.streakDays === 1 && state.user.lastBotLogDate === today, `${state.user.streakDays}/${state.user.lastBotLogDate}`);

const stepsMarathon = state.marathons?.find((marathon) => marathon.id === 'm_steps');
const stepsLog = stepsMarathon?.dailyLogs?.find((log) => log.date === today);
check('марафон шагов обновлён', stepsLog?.value === 12000 && stepsLog?.isHit === true, JSON.stringify(stepsLog));

const strengthMarathon = state.marathons?.find((marathon) => marathon.id === 'm_strength');
const strengthLog = strengthMarathon?.dailyLogs?.find((log) => log.date === today);
check('марафон объёма обновлён', strengthLog?.value === 2360 && strengthLog?.isHit === true, JSON.stringify(strengthLog));

const experiments = await storage.listCollection('experiments', userId);
const experiment = experiments.find((item) => item.id === 'exp_sleep_bench');
const experimentLog = experiment?.dailyLogs?.[today];
check('исследование заполнено независимыми метриками', experimentLog?.independentValues?.['Сон'] === 7.5 && experimentLog?.independentValues?.['Шаги'] === 12000, JSON.stringify(experimentLog?.independentValues));
check('исследование заполнено результатом жима', experimentLog?.dependentValue === 116.7, String(experimentLog?.dependentValue));

const metrics = await storage.listCollection('custom_metrics', userId);
const waist = metrics.find((metric) => metric.name === 'Талия');
const weightMetric = metrics.find((metric) => metric.name === 'Вес тела');
check('замер талии попал в свои показатели', waist?.values?.[today]?.value === 82, JSON.stringify(waist?.values));
check('вес тела попал в свои показатели', weightMetric?.values?.[today]?.value === 80.2, JSON.stringify(weightMetric?.values));
check(
  'вес не задваивается как «Вес» и «Вес тела»',
  metrics.filter((metric) => /^(вес|масса|вес тела)$/i.test(String(metric.name || '').trim())).length === 1,
  JSON.stringify(metrics.map((metric) => metric.name)),
);

// 3. Повторная обработка не создаёт дубликаты
await ingest.ingestBotTurn({
  userId,
  userName: 'Тест',
  text: 'Жим 100 на 5, шаги 12000, спал 7.5',
  actions,
  wantsSave: true,
});
stored = await storage.getUserState(userId);
const repeated = stored.state;
check('повтор не дублирует тренировку', repeated.pastWorkouts.length === 1, String(repeated.pastWorkouts.length));
check('повтор не дублирует сон', repeated.sleepRecords.length === 1, String(repeated.sleepRecords.length));
check('повтор не дублирует еду', repeated.dailyNutritionRecords[0].meals.length === 2, String(repeated.dailyNutritionRecords[0].meals.length));
check('повтор не дублирует рекорды', repeated.personalRecords.length === 2, String(repeated.personalRecords.length));
check('повтор не накручивает серию', repeated.user.streakDays === 1, String(repeated.user.streakDays));

// 4. Отмена черновика
await ingest.ingestBotTurn({
  userId,
  userName: 'Тест',
  text: 'сегодня 5000 шагов',
  actions: [{ function: 'log_daily', args: { steps: 5000 } }],
  wantsSave: false,
});
const cleared = await ingest.clearPendingActions(userId);
stored = await storage.getUserState(userId);
check('отмена убирает черновик', cleared === true && !stored.state.botPending);

console.log(failures === 0 ? '\nВНЕСЕНИЕ ДАННЫХ РАБОТАЕТ' : `\nПРОВАЛОВ: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
