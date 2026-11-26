/**
 * Проверки дисциплины, библиотеки циклов и расчёта питания.
 * Запуск: npm run test:features
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' :: ' + extra : ''}`);
  if (!cond) failures += 1;
};
const near = (a, b, epsilon = 0.01) => Math.abs(a - b) <= epsilon;

const projectRoot = process.cwd();
const outDir = path.join(projectRoot, '.tmp-features');
fs.rmSync(outDir, { recursive: true, force: true });

execFileSync(
  process.execPath,
  [
    path.join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
    '--outDir', outDir,
    '--module', 'commonjs',
    '--target', 'es2022',
    '--moduleResolution', 'node',
    '--esModuleInterop',
    '--skipLibCheck',
    '--lib', 'es2022,dom',
    '--rootDir', 'src',
    'src/lib/discipline.ts',
    'src/lib/cycleTemplates.ts',
    'src/lib/nutritionTargets.ts',
    'src/data/initialData.ts',
  ],
  { stdio: 'inherit' },
);
fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify({ type: 'commonjs' }), 'utf-8');

const require_ = createRequire(import.meta.url);
const discipline = require_(path.join(outDir, 'lib', 'discipline.js'));
const cycles = require_(path.join(outDir, 'lib', 'cycleTemplates.js'));
const nutrition = require_(path.join(outDir, 'lib', 'nutritionTargets.js'));
const initialData = require_(path.join(outDir, 'data', 'initialData.js'));

/* ------------------------------------------------------------------ */
/* 1. Дисциплина: старт с нуля и веса привычек                         */
/* ------------------------------------------------------------------ */
check(
  'новая дисциплина начинается с 0',
  initialData.INITIAL_USER_PROFILE.disciplineScore === 0,
  String(initialData.INITIAL_USER_PROFILE.disciplineScore),
);

const settings = discipline.normalizeDisciplineSettings(undefined);
check('по умолчанию включена только тренировка', settings.enabled.workout && !settings.enabled.sleep);
check('по умолчанию штраф подтверждается', settings.penaltyMode === 'confirm');
check('по умолчанию шаги не включены', !settings.enabled.steps);

const noPlans = discipline.disciplineIsActive(settings, []);
check('без планов тренировка не активирует дисциплину', noPlans === false);
const withPlan = discipline.disciplineIsActive(settings, [{ id: 'p1', exercises: [] }]);
check('с планом дисциплина активна', withPlan === true);

check(
  'пропуск тренировки по умолчанию стоит 25, а не 100',
  discipline.deductionForHabit(settings, 'workout') === 25,
  String(discipline.deductionForHabit(settings, 'workout')),
);

const allEnabled = discipline.normalizeDisciplineSettings({
  enabled: Object.fromEntries(discipline.DISCIPLINE_HABITS.map(habit => [habit.id, true])),
});
const totalWeights = discipline.DISCIPLINE_HABITS.reduce(
  (sum, habit) => sum + allEnabled.weights[habit.id],
  0,
);
check('сумма весов по умолчанию ровно 100', totalWeights === 100, String(totalWeights));
check(
  'при включённых шагах штраф равен весу шагов',
  discipline.deductionForHabit(allEnabled, 'steps') === allEnabled.weights.steps,
  String(discipline.deductionForHabit(allEnabled, 'steps')),
);
check(
  'выключенная привычка не даёт штрафа',
  discipline.deductionForHabit(settings, 'sleep') === 0,
);

/* ------------------------------------------------------------------ */
/* 2. Штрафы: возврат очков, сложность, шаги                          */
/* ------------------------------------------------------------------ */
check('штраф возвращает все потерянные очки', discipline.penaltyRestorePoints(17, settings) >= 17);

const soft = discipline.penaltySeverity(25, discipline.normalizeDisciplineSettings({ difficulty: 'soft' }));
const normal = discipline.penaltySeverity(25, settings);
const hard = discipline.penaltySeverity(25, discipline.normalizeDisciplineSettings({ difficulty: 'hard' }));
check('сложность растёт с потерянными очками', discipline.penaltySeverity(10, settings) < discipline.penaltySeverity(40, settings));
check('жёсткий режим сложнее мягкого', hard > normal && normal > soft, `${soft}/${normal}/${hard}`);

const withoutSteps = discipline.suggestPenalties(settings, 25, false, 10000);
check(
  'без цели шагов шаговых штрафов нет',
  withoutSteps.every(item => item.category !== 'steps'),
  withoutSteps.map(item => item.category).join(','),
);
const withSteps = discipline.suggestPenalties(
  discipline.normalizeDisciplineSettings({
    allowedCategories: { cardio: true, steps: true, financial: true, diet: false, sleep: false, social: false, skill: false },
  }),
  25,
  true,
  12000,
);
const stepSuggestion = withSteps.find(item => item.category === 'steps');
check('при цели шагов шаговый штраф появляется', Boolean(stepSuggestion));
const stepNumbers = stepSuggestion ? stepSuggestion.task.match(/([\d\s]+)\s*шагов/gi) || [] : [];
check(
  'шаговый штраф не выше дневной нормы',
  Boolean(stepSuggestion) && stepNumbers.length > 0 && stepNumbers.every(raw => Number(raw.replace(/\D/g, '')) <= 12000),
  stepNumbers.join(' / '),
);

const moneySuggestion = withSteps.find(item => item.category === 'financial');
const money = moneySuggestion ? Number((moneySuggestion.task.match(/([\d\s]+)\s*₽/) || [])[1]?.replace(/\s/g, '')) : 0;
check(
  'финансовый штраф в заданных пределах',
  money >= 100 && money <= 1000,
  String(money),
);

const deadline = discipline.penaltyDeadline(settings);
const hoursLeft = (Date.parse(deadline) - Date.now()) / (60 * 60 * 1000);
check('срок штрафа соответствует настройке', hoursLeft > 23.5 && hoursLeft <= 24, hoursLeft.toFixed(1));
check(
  'просроченный штраф определяется',
  discipline.penaltyIsOverdue({
    status: 'pending',
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  }) === true,
);
check(
  'выполненный штраф не считается просроченным',
  discipline.penaltyIsOverdue({
    status: 'completed',
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  }) === false,
);

check('уровень 100 — железный', discipline.disciplineLevel(100, true).id === 'iron');
check('уровень 40 — критический', discipline.disciplineLevel(40, true).id === 'critical');
check('до старта уровень неактивен', discipline.disciplineLevel(0, false).id === 'inactive');

/* ------------------------------------------------------------------ */
/* 3. Циклы: шаблоны, проценты, свой цикл                             */
/* ------------------------------------------------------------------ */
const names = cycles.CYCLE_TEMPLATES.map(item => item.name).join(' | ');
for (const expected of ['Смолов-младший', 'Вендлер 5/3/1', 'Шейко', 'Верхошанский', 'GZCLP', 'PHUL']) {
  check(`в библиотеке есть ${expected}`, names.includes(expected), names);
}
check(
  'у каждого шаблона есть недели, дни и упражнения',
  cycles.CYCLE_TEMPLATES.every(template =>
    template.weeks.length > 0 &&
    template.weeks.every(week => week.days.length > 0 && week.days.every(day => day.exercises.length > 0)),
  ),
);
check(
  'у каждого шаблона указаны упражнения/фокус и предупреждения',
  cycles.CYCLE_TEMPLATES.every(template => template.focus.length > 10 && template.warnings.length > 0),
);
check(
  'у каждого шаблона есть цель, результат, восстановление, прогрессия и советы',
  cycles.CYCLE_TEMPLATES.every(template =>
    template.description.length > 40 &&
    template.expectedResult.length > 20 &&
    template.recovery.length > 20 &&
    template.whatElse.length > 0 &&
    template.avoid.length > 0 &&
    template.restGuidance.length > 0 &&
    template.progression.length > 20 &&
    template.weekNotes.length > 0,
  ),
);
check(
  'у каждого шаблона указано, какие 1ПМ нужны',
  cycles.CYCLE_TEMPLATES.every(template => template.mainLifts.length > 0 || (template.mainLiftOptions?.length || 0) > 0),
);
const smolov = cycles.CYCLE_TEMPLATES.find(item => item.id === 'smolov_jr');
check('Смолов-младший — специализация на одном движении', smolov?.kind === 'specialization');
check('Смолов-младший предлагает жим или присед', smolov?.mainLiftOptions?.join(',') === 'bench,squat');
check(
  'Смолов-младший не требует 1ПМ для подсобки',
  cycles.requiredMaxes(smolov, { mainLift: 'bench' }).join(',') === 'bench',
);
check(
  'в Смолове-младшем только основное движение, без жёсткой подсобки',
  smolov?.weeks.every(week => week.days.every(day => day.exercises.every(exercise => exercise.lift === 'main'))),
);
const verkh = cycles.CYCLE_TEMPLATES.find(item => item.id === 'verkhoshansky');
check('Верхошанский — гибкий выбор движений', verkh?.allowMultipleMainLifts === true && verkh?.mainLiftOptions?.length === 3);
check(
  'в Верхошанском нет прыжков',
  verkh?.weeks.every(week => week.days.every(day => day.exercises.every(exercise => !/прыж/i.test(exercise.name)))),
  verkh?.weeks.flatMap(week => week.days.flatMap(day => day.exercises.map(exercise => exercise.name))).join(' | '),
);
check(
  'в Верхошанском описано, что это базовые движения с непредельными весами',
  /без прыжков/i.test(verkh?.description || '') && /непредельн/i.test(verkh?.description || ''),
);
check(
  'Верхошанский можно сузить до одного движения',
  verkh
    ? cycles.applyCycleSelection(verkh, { mainLifts: ['bench'] }).weeks.every(week =>
        week.days.every(day => !day.mainLift || day.mainLift === 'bench'),
      )
    : false,
);
check(
  'Верхошанский можно оставить полной версией',
  verkh
    ? cycles.applyCycleSelection(verkh, { mainLifts: ['squat', 'bench', 'deadlift'] }).weeks[0].days.length ===
        verkh.weeks[0].days.length
    : false,
);
const requiredCounts = {
  wendler_531: 4,
  sheiko: 3,
  gzclp: 3,
  phul: 4,
};
for (const [id, count] of Object.entries(requiredCounts)) {
  const template = cycles.CYCLE_TEMPLATES.find(item => item.id === id);
  check(`у ${id} нужных 1ПМ: ${count}`, cycles.requiredMaxes(template).length === count, String(cycles.requiredMaxes(template).length));
}
check(
  'у Верхошанского при выборе одного движения нужен один 1ПМ',
  cycles.requiredMaxes(verkh, { mainLifts: ['bench'] }).join(',') === 'bench',
);

check('вес от 1ПМ: 75% от 100 кг = 75', cycles.calculateCycleWeight(75, 'bench', { bench: 100 }) === 75);
check('вес округляется до 2,5 кг', cycles.calculateCycleWeight(73, 'squat', { squat: 101 }) === 72.5, String(cycles.calculateCycleWeight(73, 'squat', { squat: 101 })));
check('без 1ПМ вес не считается', cycles.calculateCycleWeight(75, 'bench', {}) === 0);
check('подсобка не считается от 1ПМ', cycles.calculateCycleWeight(75, 'accessory', { bench: 100 }) === 0);

const parsed = cycles.parseCustomCycle(
  'Мой жим',
  'strength',
  'intermediate',
  'Тест',
  'Неделя 1 | День 1 | Присед 5x5 70%\nНеделя 1 | День 2 | Жим лёжа 4x8 65%\nНеделя 2 | День 1 | Становая 3x5 75%',
);
check('свой цикл разбит на 2 недели', parsed.weeks.length === 2, String(parsed.weeks.length));
check('в первой неделе 2 дня', parsed.weeks[0].days.length === 2, String(parsed.weeks[0].days.length));
const parsedExercise = parsed.weeks[0].days[1].exercises[0];
check(
  'упражнение своего цикла разобрано',
  parsedExercise.name.includes('Жим') && parsedExercise.sets === 4 && parsedExercise.reps === '8' && parsedExercise.percent === 65 && parsedExercise.lift === 'bench',
  JSON.stringify(parsedExercise),
);
check('свой цикл помечен как пользовательский', parsed.custom === true);

const legacyCustom = cycles.normalizeCycleTemplate({
  id: 'legacy',
  name: 'Старый цикл',
  weeks: [{
    id: 'w1',
    days: [{ id: 'd1', label: 'День 1', exercises: [{ name: 'Присед', sets: 5, reps: '5', percent: 70, lift: 'squat' }] }],
  }],
});
check('старый пользовательский цикл дозаполняется', Boolean(legacyCustom));
check(
  'у старого цикла появляются новые разделы',
  Boolean(legacyCustom && legacyCustom.expectedResult && legacyCustom.whatElse.length && legacyCustom.restGuidance.length),
);
check('старый цикл получает основные движения', legacyCustom?.mainLifts.join(',') === 'squat', legacyCustom?.mainLifts.join(','));

/* ------------------------------------------------------------------ */
/* 4. Питание: авто-цель и объяснение                                 */
/* ------------------------------------------------------------------ */
const baseUser = {
  id: 'u1',
  name: 'Тест',
  telegramUsername: '',
  currentWeight: 92,
  targetWeight: 100,
  weightGoalType: 'gain',
  heightCm: 190,
  age: 30,
  gender: 'male',
  activityLevel: 'active',
  dailyStepGoal: 10000,
  disciplineScore: 0,
  streakDays: 0,
  longestStreak: 0,
};
const targets = nutrition.calculateNutritionTargets(baseUser);
check('BMR по Миффлину — Сан Жеору', targets.bmr === 1963, String(targets.bmr));
check('поддержка с активностью 1.55', targets.maintenanceCalories === 3042, String(targets.maintenanceCalories));
check('набор веса даёт около 3400 ккал', targets.calories >= 3390 && targets.calories <= 3420, String(targets.calories));
check('в разборе есть множитель цели', near(targets.goalMultiplier, 1.12) && targets.goalLabel === 'Набор веса');
check('белок 1,8 г/кг', targets.protein === Math.round(92 * 1.8), String(targets.protein));
check('жиры 1,1 г/кг', targets.fat === Math.round(92 * 1.1), String(targets.fat));
check('углеводы — остаток калорий', targets.carbs > 0 && targets.carbs === Math.max(80, Math.round((targets.calories - targets.protein * 4 - targets.fat * 9) / 4)), String(targets.carbs));
check(
  'сумма БЖУ сходится с целью (±5 ккал)',
  Math.abs(targets.protein * 4 + targets.fat * 9 + targets.carbs * 4 - targets.calories) <= 5,
  String(targets.protein * 4 + targets.fat * 9 + targets.carbs * 4),
);

const manual = nutrition.calculateNutritionTargets({ ...baseUser, customCalorieTarget: 2500 });
check('ручная цель калорий важнее авто', manual.calories === 2500, String(manual.calories));
check('ручная цель помечена в разборе', manual.customCalories === true);

check('цель по воде рассчитывается от веса и активности', targets.waterMl >= 1500 && targets.waterMl <= 4000, String(targets.waterMl));
check('вода учитывает активность', targets.waterMl > 92 * 30, String(targets.waterMl));
const manualWater = nutrition.calculateNutritionTargets({ ...baseUser, customWaterTarget: 3000 });
check('ручная цель воды важнее авто', manualWater.waterMl === 3000 && manualWater.customWater === true, String(manualWater.waterMl));
check('в расчёте воды указано, что часть приходит с едой', targets.waterFromFoodPercent === 20);
check(
  'у всех уровней активности есть объяснение и пример',
  (Object.keys(nutrition.ACTIVITY_LEVELS)).every(key => {
    const level = nutrition.ACTIVITY_LEVELS[key];
    return level.description.length > 20 && level.examples.length > 5 && level.factor > 1;
  }),
);
check('уровни активности имеют разные коэффициенты', new Set(Object.values(nutrition.ACTIVITY_LEVELS).map(level => level.factor)).size === 4);

const female = nutrition.calculateNutritionTargets({ ...baseUser, gender: 'female' });
check('женская формула вычитает 161', female.bmr === 1963 - 166, String(female.bmr));

const lose = nutrition.calculateNutritionTargets({ ...baseUser, weightGoalType: 'lose' });
check('снижение веса — дефицит 18%', lose.calories === Math.round(lose.maintenanceCalories * 0.82));
check('при снижении белка больше', lose.proteinPerKg === 2.2);

console.log(
  `\n${failures === 0 ? 'ДИСЦИПЛИНА, ЦИКЛЫ И ПИТАНИЕ: ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ' : `ПРОВАЛОВ: ${failures}`}`,
);
process.exit(failures === 0 ? 0 : 1);
