/**
 * Проверка модели тела: нормализация замеров, пропорции, позы, упражнения,
 * объём по группам мышц и анализ роста.
 * Запуск: npm run test:body
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
const close = (a, b, epsilon = 0.01) => Math.abs(a - b) <= epsilon;
const isoDaysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const projectRoot = process.cwd();
const outDir = path.join(projectRoot, '.tmp-body');
fs.rmSync(outDir, { recursive: true, force: true });

execFileSync(
  process.execPath,
  [
    path.join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
    '--outDir', outDir,
    '--module', 'commonjs',
    '--target', 'es2022',
    '--jsx', 'react-jsx',
    '--moduleResolution', 'node',
    '--esModuleInterop',
    '--skipLibCheck',
    '--lib', 'es2022,dom',
    '--rootDir', 'src',
    'src/lib/bodyModel.ts',
    'src/components/BodyBiomechanicsView.tsx',
    'src/components/BodyModel2D.tsx',
    'src/components/BodyMeasurementForm.tsx',
  ],
  { stdio: 'inherit' },
);
fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify({ type: 'commonjs' }), 'utf-8');

// Компонентам нужен минимальный React SSR, полноценный DOM не требуется.
const require_ = createRequire(import.meta.url);
const React = require_('react');
const { renderToString } = require_(path.join(projectRoot, 'node_modules', 'react-dom', 'server.js'));
const model = require_(path.join(outDir, 'lib', 'bodyModel.js'));

/* ------------------------------------------------------------------ */
/* 1. Нормализация замеров                                             */
/* ------------------------------------------------------------------ */
const rawProfile = {
  heightCm: '180,5',
  sex: 'female',
  avatarUrl: 'javascript:alert(1)',
  measurements: [
    {
      id: 'a',
      date: '2026-01-05',
      weightKg: '80,5',
      waistCm: '82,3',
      notes: '  утро  ',
      createdAt: '2026-01-05T09:00:00.000Z',
    },
    {
      id: 'a',
      date: '2026-01-06',
      weightKg: 81,
      waistCm: 83,
      chestCm: 500,
      createdAt: '2026-01-06T09:00:00.000Z',
    },
    {
      date: 'плохая дата',
      weightKg: 90,
      notes: 'x',
    },
    { weightKg: 0, waistCm: 0 },
    null,
    'нет',
  ],
};
const normalized = model.normalizeBodyProfile(rawProfile);
check('рост нормализуется из строки', normalized.heightCm === 180.5, String(normalized.heightCm));
check('пол сохраняется', normalized.sex === 'female', String(normalized.sex));
check('опасный avatarUrl отбрасывается', normalized.avatarUrl === undefined, String(normalized.avatarUrl));
check('пустые и некорректные замеры отбрасываются', normalized.measurements.length === 3, String(normalized.measurements.length));
check('id дубликата становится уникальным', normalized.measurements[1].id === 'a_1', normalized.measurements[1].id);
check('числа из строки с запятой парсятся', normalized.measurements[0].weightKg === 80.5, String(normalized.measurements[0].weightKg));
check('заметка обрезается', normalized.measurements[0].notes === 'утро', normalized.measurements[0].notes);
check('чрезмерный обхват ограничивается', normalized.measurements[1].chestCm === 200, String(normalized.measurements[1].chestCm));
check(
  'некорректная дата заменяется сегодняшней',
  normalized.measurements[2].date === new Date().toISOString().slice(0, 10),
  normalized.measurements[2].date,
);

const safeAvatar = model.normalizeBodyProfile({
  avatarUrl: 'https://t.me/i/userpic/320/abc.jpg',
  measurements: [],
});
check('https-аватар сохраняется', safeAvatar.avatarUrl.startsWith('https://'), safeAvatar.avatarUrl);
const dataAvatar = model.normalizeBodyProfile({ avatarUrl: 'data:image/jpeg;base64,AAAA' });
check('data-url аватар сохраняется', dataAvatar.avatarUrl.startsWith('data:image/'), dataAvatar.avatarUrl);
check('пустой профиль безопасен', model.normalizeBodyProfile(undefined).measurements.length === 0);
check('рост вне диапазона ограничивается', model.normalizeBodyProfile({ heightCm: 300 }).heightCm === 250);

/* ------------------------------------------------------------------ */
/* 2. Сортировка, последний и предыдущий замер                         */
/* ------------------------------------------------------------------ */
const orderedProfile = {
  heightCm: 178,
  measurements: [
    { id: 'm1', date: '2026-01-01', createdAt: '2026-01-01T09:00:00Z', waistCm: 84 },
    { id: 'm2', date: '2026-02-01', createdAt: '2026-02-01T09:00:00Z', waistCm: 82 },
    { id: 'm3', date: '2026-03-01', createdAt: '2026-03-01T09:00:00Z', waistCm: 80 },
  ],
};
const sorted = model.sortMeasurements(orderedProfile.measurements);
check('свежие замеры идут первыми', sorted.map((entry) => entry.id).join(',') === 'm3,m2,m1');
check('последний замер определяется верно', model.latestMeasurement(orderedProfile).id === 'm3');
check('предыдущий замер определяется верно', model.previousMeasurement(orderedProfile).id === 'm2');
const delta = model.metricDelta(orderedProfile, 'waistCm');
check('дельта к прошлому замеру считается', delta.current === 80 && delta.previous === 82 && delta.delta === -2, JSON.stringify(delta));
const series = model.measurementSeries(orderedProfile, 'waistCm');
check('серия замеров идёт по возрастанию даты', series.map((point) => point.value).join(',') === '84,82,80');

/* ------------------------------------------------------------------ */
/* 3. Размеры и геометрия модели                                       */
/* ------------------------------------------------------------------ */
const measuredProfile = {
  heightCm: 180,
  sex: 'male',
  measurements: [
    {
      id: 'dim',
      date: '2026-01-01',
      createdAt: '2026-01-01T09:00:00Z',
      shouldersCm: 130,
      chestCm: 110,
      waistCm: 80,
      hipsCm: 100,
    },
  ],
};
const dims = model.computeBodyDimensions(measuredProfile);
check('рост попадает в размеры', dims.heightCm === 180);
check('масштаб считается от роста', close(dims.scale, 440 / 180), String(dims.scale));
check('высота головы пропорциональна росту', close(dims.headHeightCm, 180 * 0.13));
check('ширина плеч считается от обхвата', close(dims.shoulderWidthCm, 130 * 0.36), String(dims.shoulderWidthCm));
check('ширина груди считается от обхвата', close(dims.chestWidthCm, 110 * 0.33), String(dims.chestWidthCm));
check('ширина талии считается от обхвата', close(dims.waistWidthCm, 80 * 0.31), String(dims.waistWidthCm));
check('ширина таза считается от обхвата', close(dims.hipWidthCm, 100 * 0.34), String(dims.hipWidthCm));
const defaultDims = model.computeBodyDimensions({ measurements: [] });
check('без замеров берётся рост по умолчанию', defaultDims.heightCm === 175);
check('без замеров модель всё равно строится', defaultDims.shoulderWidthCm > 30);

const defaultPose = model.createDefaultPose();
const sideGeometry = model.buildSideGeometry(defaultPose.side, dims);
const frontGeometry = model.buildFrontGeometry(defaultPose.front, dims);
check('сбоку семь маркеров суставов', sideGeometry.handles.length === 7, String(sideGeometry.handles.length));
check('спереди девять маркеров суставов', frontGeometry.handles.length === 9, String(frontGeometry.handles.length));
check('сбоку туловище направлено вверх', sideGeometry.shoulder.y < sideGeometry.hip.y, `${sideGeometry.shoulder.y} / ${sideGeometry.hip.y}`);
check(
  'длина бедра сохраняется при построении',
  close(Math.hypot(sideGeometry.knee.x - sideGeometry.hip.x, sideGeometry.knee.y - sideGeometry.hip.y), dims.thighLengthCm * dims.scale, 0.02),
);
check(
  'ширина плеч спереди соответствует расчёту',
  close(frontGeometry.rightShoulder.x - frontGeometry.leftShoulder.x, dims.shoulderWidthCm * dims.scale, 0.02),
);
check('все маркеры имеют уникальные id', new Set([...sideGeometry.handles, ...frontGeometry.handles].map((handle) => handle.id)).size === 16);

const ikUpper = dims.thighLengthCm * dims.scale;
const ikLower = dims.shinLengthCm * dims.scale;
const ikHip = { x: 132, y: 310 };
const ikAnkle = { x: 160, y: 482 };
const ik = model.solveTwoBoneIK(ikHip, ikAnkle, ikUpper, ikLower);
check(
  'IK сохраняет длину бедра',
  close(Math.hypot(ik.knee.x - ikHip.x, ik.knee.y - ikHip.y), ikUpper, 0.6),
  Math.hypot(ik.knee.x - ikHip.x, ik.knee.y - ikHip.y).toFixed(2),
);
check(
  'IK сохраняет длину голени',
  close(Math.hypot(ikAnkle.x - ik.knee.x, ikAnkle.y - ik.knee.y), ikLower, 0.6),
  Math.hypot(ikAnkle.x - ik.knee.x, ikAnkle.y - ik.knee.y).toFixed(2),
);
const ikRebuilt = model.pointAlong(ik.knee, ik.shinAngle, ikLower);
check(
  'IK возвращает голень в точку опоры',
  close(ikRebuilt.x, ikAnkle.x, 1.5) && close(ikRebuilt.y, ikAnkle.y, 1.5),
  `${ikRebuilt.x.toFixed(1)},${ikRebuilt.y.toFixed(1)}`,
);

const bentPose = {
  side: { ...defaultPose.side, thighAngle: 10, shinAngle: 100 },
  front: { ...defaultPose.front },
};
const bentKnee = model.buildSideGeometry(bentPose.side, dims).knee;
check('сгибание колена меняет положение сустава', bentKnee.x !== sideGeometry.knee.x);
const straightKneePose = { ...defaultPose, side: { ...defaultPose.side, thighAngle: 90, shinAngle: 90 } };
check(
  'колено не разгибается вперёд',
  model.clampSegmentAngle('side', 'shinAngle', 30, straightKneePose) === 90,
  String(model.clampSegmentAngle('side', 'shinAngle', 30, straightKneePose)),
);
const deepKneeAngle = model.clampSegmentAngle('side', 'shinAngle', 210, straightKneePose);
const deepKneeMetrics = model.computePoseMetrics({
  ...straightKneePose,
  side: { ...straightKneePose.side, shinAngle: deepKneeAngle },
});
check('глубокий изгиб колена остаётся в допустимом диапазоне', deepKneeMetrics['side.kneeFlex'] === 120, String(deepKneeMetrics['side.kneeFlex']));

/* ------------------------------------------------------------------ */
/* 4. Метрики позы                                                     */
/* ------------------------------------------------------------------ */
const defaultMetrics = model.computePoseMetrics(defaultPose);
check('в стойке наклон корпуса 0', defaultMetrics['side.torsoLean'] === 0, String(defaultMetrics['side.torsoLean']));
check('в стойке сгибание колена 0', defaultMetrics['side.kneeFlex'] === 0, String(defaultMetrics['side.kneeFlex']));
check('в стойке сгибание локтя 0', defaultMetrics['side.elbowFlex'] === 0, String(defaultMetrics['side.elbowFlex']));
check('в стойке нет асимметрии', defaultMetrics['front.kneeAsym'] === 0 && defaultMetrics['front.elbowAsym'] === 0);

const squat = model.exerciseById('squat');
const squatPose = model.poseForExercise(squat);
const squatMetrics = model.computePoseMetrics(squatPose);
check('присед: наклон корпуса 25°', squatMetrics['side.torsoLean'] === 25, String(squatMetrics['side.torsoLean']));
check('присед: бедро согнуто на 105°', squatMetrics['side.hipFlex'] === 105, String(squatMetrics['side.hipFlex']));
check('присед: колено согнуто на 110°', squatMetrics['side.kneeFlex'] === 110, String(squatMetrics['side.kneeFlex']));
const squatSideGeometry = model.buildSideGeometry(squatPose.side, dims);
const draggedSide = model.dragSidePelvis(squatPose.side, { x: 132, y: 310 }, squatSideGeometry.ankle, dims);
const draggedGeometry = model.buildSideGeometry(draggedSide, dims);
check(
  'перетаскивание таза оставляет стопу на полу',
  close(draggedGeometry.ankle.x, squatSideGeometry.ankle.x, 1.5) &&
    close(draggedGeometry.ankle.y, squatSideGeometry.ankle.y, 1.5),
  `${draggedGeometry.ankle.x.toFixed(1)},${draggedGeometry.ankle.y.toFixed(1)}`,
);
const draggedMetrics = model.computePoseMetrics({ ...squatPose, side: draggedSide });
check(
  'перетаскивание таза сгибает колено',
  draggedMetrics['side.kneeFlex'] > 0,
  String(draggedMetrics['side.kneeFlex']),
);
const squatEvaluation = model.evaluateExercise(squat, squatPose);
check('эталонный присед проходит проверку', squatEvaluation.tone === 'good' && squatEvaluation.score === 100, `${squatEvaluation.tone} / ${squatEvaluation.score}`);
check('эталонный присед не имеет провалов', squatEvaluation.failed === 0, String(squatEvaluation.failed));
check('подсчёт пройденных правил корректен', squatEvaluation.passed === squat.rules.length, `${squatEvaluation.passed}/${squat.rules.length}`);

const badSquatPose = model.poseForExercise(squat);
badSquatPose.side.torsoAngle = -20;
badSquatPose.front.leftThighAngle = 120;
badSquatPose.front.leftShinAngle = 80;
const badEvaluation = model.evaluateExercise(squat, badSquatPose);
check('ошибки техники дают риск', badEvaluation.tone === 'risk', `${badEvaluation.tone} / ${badEvaluation.score}`);
check('ошибки техники уменьшают балл', badEvaluation.score < 100, String(badEvaluation.score));
check('правила вне коридора помечаются fail', badEvaluation.failed >= 2, String(badEvaluation.failed));
const risks = model.jointRisk(badEvaluation);
check('риск привязан к колену', risks.knee === 'fail', JSON.stringify(risks));
check('риск привязан к корпусу', risks.spine === 'fail', JSON.stringify(risks));

/* ------------------------------------------------------------------ */
/* 5. Пресеты упражнений                                               */
/* ------------------------------------------------------------------ */
check('пресеты упражнений не пустые', model.EXERCISE_PRESETS.length >= 6, String(model.EXERCISE_PRESETS.length));
check(
  'id пресетов уникальны',
  new Set(model.EXERCISE_PRESETS.map((preset) => preset.id)).size === model.EXERCISE_PRESETS.length,
);
const presetProblem = model.EXERCISE_PRESETS.find((preset) => {
  const pose = model.poseForExercise(preset);
  const metrics = model.computePoseMetrics(pose);
  const unknown = preset.rules.find((rule) => metrics[rule.metric] === undefined);
  return Boolean(unknown) || preset.rules.length === 0;
});
check('у каждого пресета есть валидные правила', !presetProblem, presetProblem ? presetProblem.id : '');
const riskyPreset = model.EXERCISE_PRESETS.find(
  (preset) => model.evaluateExercise(preset, model.poseForExercise(preset)).tone === 'risk',
);
check('эталонные позы не попадают в красную зону', !riskyPreset, riskyPreset ? riskyPreset.id : '');
check('поиск упражнения по id работает', model.exerciseById('dips')?.name === 'Отжимания на брусьях');
check('неизвестное упражнение не находится', model.exerciseById('unknown') === undefined);

/* ------------------------------------------------------------------ */
/* 6. Группы мышц и объём                                              */
/* ------------------------------------------------------------------ */
check('жим лёжа относится к груди', model.muscleGroupForExercise('Жим лёжа') === 'chest');
check('приседания относятся к квадрицепсу', model.muscleGroupForExercise('Приседания со штангой') === 'quads');
check('становая тяга относится к задней цепи', model.muscleGroupForExercise('Становая тяга') === 'hamstrings');
check('подтягивания относятся к спине', model.muscleGroupForExercise('Подтягивания') === 'back');
check('подъём на носки относится к голеням', model.muscleGroupForExercise('Подъём на носки') === 'calves');
check('жим стоя относится к плечам', model.muscleGroupForExercise('Жим стоя') === 'shoulders');
check('неизвестное упражнение не сопоставляется', model.muscleGroupForExercise('Странное движение') === null);

const now = Date.now();
const recentIso = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
const oldIso = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();
const volumeWorkouts = [
  {
    id: 'w1',
    title: 'Объём',
    completedAt: recentIso,
    exercises: [
      { name: 'Жим лёжа', sets: [{ weight: 100, reps: 5 }, { weight: 100, reps: 5 }] },
      { name: 'Приседания', sets: [{ weight: 0, reps: 10 }, { weight: 0, reps: 0 }] },
      { name: 'Странное движение', sets: [{ weight: 100, reps: 10 }] },
    ],
  },
  {
    id: 'w2',
    title: 'Старое',
    completedAt: oldIso,
    exercises: [{ name: 'Жим лёжа', sets: [{ weight: 100, reps: 5 }] }],
  },
];
const volumes = model.muscleVolumesFromWorkouts(volumeWorkouts, 30, 80, now);
const chestVolume = volumes.find((item) => item.group === 'chest');
const quadsVolume = volumes.find((item) => item.group === 'quads');
check('объём груди считается по весу и повторениям', chestVolume.volumeKg === 1000, String(chestVolume.volumeKg));
check('старые тренировки не входят в период', chestVolume.sessions === 1, String(chestVolume.sessions));
check('собственный вес учитывается для приседа', quadsVolume.volumeKg === 520, String(quadsVolume.volumeKg));
check('объёмы отсортированы по убыванию', volumes[0].volumeKg >= volumes[1].volumeKg);
check('группа с нулём остаётся в списке', volumes.length === model.MUSCLE_GROUPS.length, String(volumes.length));

/* ------------------------------------------------------------------ */
/* 7. Рост замеров и нагрузка                                          */
/* ------------------------------------------------------------------ */
const growthProfile = {
  heightCm: 180,
  measurements: [
    {
      id: 'g1',
      date: isoDaysAgo(40),
      createdAt: `${isoDaysAgo(40)}T09:00:00Z`,
      chestCm: 100,
      waistCm: 84,
      bicepLCm: 38,
      bicepRCm: 38,
    },
    {
      id: 'g2',
      date: isoDaysAgo(2),
      createdAt: `${isoDaysAgo(2)}T09:00:00Z`,
      chestCm: 103,
      waistCm: 82,
      bicepLCm: 39,
      bicepRCm: 39,
    },
  ],
};
const growthWorkouts = [
  {
    id: 'gw1',
    title: 'Грудь',
    completedAt: recentIso,
    exercises: [{ name: 'Жим лёжа', sets: [{ weight: 100, reps: 10 }] }],
  },
];
const growth = model.buildGrowthRows(growthProfile, growthWorkouts, 90, 80);
const chestGrowth = growth.find((row) => row.key === 'chestCm');
const waistGrowth = growth.find((row) => row.key === 'waistCm');
check('рост груди считается между замерами', chestGrowth && chestGrowth.deltaCm === 3, JSON.stringify(chestGrowth));
check('рост связан с объёмом груди', chestGrowth && chestGrowth.volumeKg === 1000, String(chestGrowth?.volumeKg));
check('см на тонну считаются', chestGrowth && close(chestGrowth.ratioCmPerTon, 3, 0.001), String(chestGrowth?.ratioCmPerTon));
check('снижение талии помечается down', waistGrowth?.status === 'down', JSON.stringify(waistGrowth));
check('росту нужен второй замер', model.buildGrowthRows({ measurements: [growthProfile.measurements[1]] }, [], 90, 80).length === 0);

/* ------------------------------------------------------------------ */
/* 8. Пропорции и симметрия                                            */
/* ------------------------------------------------------------------ */
const idealProfile = {
  heightCm: 180,
  measurements: [
    {
      id: 'ideal',
      date: '2026-01-01',
      createdAt: '2026-01-01T09:00:00Z',
      shouldersCm: 130,
      chestCm: 110,
      waistCm: 80,
      hipsCm: 100,
      bicepLCm: 40,
      bicepRCm: 40,
      forearmLCm: 30,
      forearmRCm: 30,
      thighLCm: 60,
      thighRCm: 60,
      calfLCm: 38,
      calfRCm: 38,
    },
  ],
};
const insights = model.buildProportionInsights(idealProfile);
const vTaper = insights.find((insight) => insight.id === 'v-taper');
const shoulderHip = insights.find((insight) => insight.id === 'shoulder-hip');
const chestWaist = insights.find((insight) => insight.id === 'chest-waist');
const symmetry = insights.find((insight) => insight.id === 'symmetry');
const thighCalf = insights.find((insight) => insight.id === 'thigh-calf');
const bicepForearm = insights.find((insight) => insight.id === 'bicep-forearm');
check('V-образный силуэт рассчитывается', vTaper?.value === '1.63 : 1', vTaper?.value);
check('плечи к тазу рассчитываются', shoulderHip?.value === '1.30 : 1', shoulderHip?.value);
check('грудь к талии рассчитывается', chestWaist?.value === '1.38 : 1', chestWaist?.value);
check('симметрия сильная при равных сторонах', symmetry?.status === 'strong', symmetry?.value);
check('бедро к голени рассчитывается', thighCalf?.status === 'strong', thighCalf?.value);
check('бицепс к предплечью рассчитывается', bicepForearm?.status === 'strong', bicepForearm?.value);
check('без замеров пропорций нет', model.buildProportionInsights({ measurements: [] }).length === 0);

const asymmetric = model.buildProportionInsights({
  measurements: [
    {
      id: 'asym',
      date: '2026-01-01',
      createdAt: '2026-01-01T09:00:00Z',
      bicepLCm: 40,
      bicepRCm: 36,
      forearmLCm: 30,
      forearmRCm: 30,
      thighLCm: 60,
      thighRCm: 60,
      calfLCm: 38,
      calfRCm: 38,
    },
  ],
});
const asymRow = asymmetric.find((insight) => insight.id === 'symmetry');
check('асимметрия рук определяется', asymRow?.status === 'grow' && asymRow.value.includes('10.0%'), asymRow?.value);

/* ------------------------------------------------------------------ */
/* 9. Моментные плечи                                                  */
/* ------------------------------------------------------------------ */
const momentSquat = model.estimateMomentArms('squat', sideGeometry, frontGeometry, dims);
const momentBench = model.estimateMomentArms('bench', sideGeometry, frontGeometry, dims);
check('моментные плечи приседа считаются', momentSquat.length === 3 && momentSquat.every((arm) => arm.valueCm >= 0));
check('для жима лёжа используется вид спереди', momentBench.length === 3 && momentBench.some((arm) => arm.id === 'shoulder'));

/* ------------------------------------------------------------------ */
/* 10. Симуляция упражнений и нагрузка                                 */
/* ------------------------------------------------------------------ */
const simDims = model.computeBodyDimensions({
  heightCm: 180,
  sex: 'male',
  measurements: [{ date: '2026-01-01', weightKg: 82 }],
});
check('в симуляции восемь упражнений', model.SIMULATION_EXERCISES.length === 8);
check(
  'у каждого упражнения есть инвентарь и суставы',
  model.SIMULATION_EXERCISES.every(
    (item) =>
      ['barbell', 'dumbbell', 'bodyweight'].includes(item.equipment) &&
      item.joints.length > 0 &&
      item.phaseLabels.length === 2,
  ),
);
const simSquat = model.simulationById('squat');
const simTop = model.simulationPose(simSquat, 0, simDims);
const simBottom = model.simulationPose(simSquat, 1, simDims);
const simTopGeo = model.buildSideGeometry(simTop.side, simDims);
const simBottomGeo = model.buildSideGeometry(simBottom.side, simDims);
const simBottomMetrics = model.computePoseMetrics(simBottom);
check(
  'присед в симуляции сгибает колено',
  simBottomMetrics['side.kneeFlex'] >= 70 && simBottomMetrics['side.kneeFlex'] <= 150,
  String(simBottomMetrics['side.kneeFlex']),
);
check(
  'стопа в симуляции остаётся на полу',
  Math.abs(simTopGeo.ankle.y - simBottomGeo.ankle.y) < 2 && simBottomGeo.ankle.y <= model.BODY_DRAW.soleY,
  `${simTopGeo.ankle.y} → ${simBottomGeo.ankle.y}`,
);
const simLoads = model.estimateSimulationLoads(simSquat, simBottom, simDims, 82, 100);
check(
  'нагрузка приседа считается по суставам',
  simLoads.length === 3 && simLoads.every((load) => load.torqueNm > 0 && load.index > 0),
  simLoads.map((load) => `${load.joint}:${load.index}`).join(' '),
);
check(
  'уровни нагрузки размечены',
  simLoads.every((load) => ['low', 'moderate', 'high', 'veryHigh'].includes(load.level)),
);
const simScan = model.scanSimulation(simSquat, simDims, 82, 100, 1);
check(
  'красная зона приседа находится в разумных пределах',
  simScan.unsafeFromKg !== null && simScan.unsafeFromKg > 0 && simScan.unsafeFromKg <= 300,
  String(simScan.unsafeFromKg),
);
check(
  'безопасный вес не выше красной зоны',
  simScan.safeWeightKg !== null &&
    simScan.unsafeFromKg !== null &&
    simScan.safeWeightKg <= simScan.unsafeFromKg,
  `${simScan.safeWeightKg} / ${simScan.unsafeFromKg}`,
);
check('безопасная амплитуда в пределах 0–1', simScan.safeAmplitude >= 0 && simScan.safeAmplitude <= 1);
const simSeries = model.simulationSeries(simSquat, simDims, 82, 100, 11);
check(
  'график нагрузки содержит все фазы',
  simSeries.length === 11 && simSeries[0].phase === 0 && simSeries[10].phase === 1,
);
const simPeakLight = Math.max(
  ...model.estimateSimulationLoads(simSquat, simBottom, simDims, 82, 0).map((load) => load.index),
);
const simPeakHeavy = Math.max(
  ...model.estimateSimulationLoads(simSquat, simBottom, simDims, 82, 150).map((load) => load.index),
);
check('дополнительный вес повышает нагрузку', simPeakHeavy > simPeakLight, `${simPeakLight} → ${simPeakHeavy}`);
check(
  'жим лёжа симулируется спереди',
  model.simulationById('bench')?.view === 'front' &&
    model.simulationById('bench')?.equipment === 'barbell',
);

/* ------------------------------------------------------------------ */
/* 10. Компоненты                                                      */
/* ------------------------------------------------------------------ */
const BodyView = require_(path.join(outDir, 'components', 'BodyBiomechanicsView.js')).BodyBiomechanicsView;
const user = {
  id: 'u1',
  name: 'Тест',
  telegramUsername: '@test',
  currentWeight: 80,
  targetWeight: 78,
  weightGoalType: 'maintain',
  stepGoalEnabled: true,
  dailyStepGoal: 10000,
  disciplineScore: 100,
  streakDays: 0,
  longestStreak: 0,
  selectedDisciplines: ['fitness'],
  inBodyRecords: [],
  bodyProfile: {
    heightCm: 180,
    sex: 'male',
    measurements: [
      {
        id: 'c1',
        date: '2026-01-01',
        createdAt: '2026-01-01T09:00:00Z',
        weightKg: 81,
        shouldersCm: 130,
        chestCm: 110,
        waistCm: 82,
        hipsCm: 100,
      },
      {
        id: 'c2',
        date: '2026-02-01',
        createdAt: '2026-02-01T09:00:00Z',
        weightKg: 80,
        shouldersCm: 131,
        chestCm: 112,
        waistCm: 80,
        hipsCm: 100,
      },
    ],
  },
};
let viewHtml = '';
let viewError = null;
try {
  viewHtml = renderToString(
    React.createElement(BodyView, {
      user,
      pastWorkouts: growthWorkouts,
      onUpdateUser: () => undefined,
    }),
  );
} catch (err) {
  viewError = err;
}
check('экран «Тело» рендерится', !viewError && viewHtml.length > 500, viewError ? viewError.message : `${(viewHtml.length / 1024).toFixed(1)} КБ`);
if (!viewError) {
  check('экран показывает заголовок', viewHtml.includes('Тело и биомеханика'));
  check('экран показывает последний замер', viewHtml.includes('01.02.2026') && viewHtml.includes('Все обхваты'));
  check('экран предупреждает, что это не диагностика', viewHtml.includes('не медицинская диагностика'));
  check('экран показывает кнопки добавления замера', viewHtml.includes('Новый'));
}

const BodyModel = require_(path.join(outDir, 'components', 'BodyModel2D.js')).BodyModel2D;
let modelHtml = '';
let modelError = null;
try {
  modelHtml = renderToString(
    React.createElement(BodyModel, {
      view: 'side',
      pose: squatPose,
      dimensions: dims,
      showAngles: true,
      evaluation: squatEvaluation,
      onChangePose: () => undefined,
    }),
  );
} catch (err) {
  modelError = err;
}
check('2D-модель рендерится', !modelError && modelHtml.includes('<svg'), modelError ? modelError.message : '');
if (!modelError) {
  check('2D-модель подписана для скринридера', modelHtml.includes('2D-модель тела'));
  check('2D-модель рисует углы', modelHtml.includes('90°') || modelHtml.includes('°'));
  check('2D-модель содержит маркеры суставов', (modelHtml.match(/Двигать:/g) || []).length >= 4, String((modelHtml.match(/Двигать:/g) || []).length));
  const footPaths = [...modelHtml.matchAll(/<path[^>]*data-foot="side"[^>]*>/g)].map((match) => match[0]);
  check(
    'стопа сбоку стоит на полу',
    footPaths.length > 0 && footPaths.every((tag) => tag.includes('500.0')),
    footPaths.map((tag) => (tag.match(/L [\d.]+ ([\d.]+) L/) || [])[1]).join(', '),
  );
}

const Form = require_(path.join(outDir, 'components', 'BodyMeasurementForm.js')).BodyMeasurementForm;
let formHtml = '';
let formError = null;
try {
  formHtml = renderToString(
    React.createElement(Form, { initial: null, heightCm: 180, onSave: () => undefined, onClose: () => undefined }),
  );
} catch (err) {
  formError = err;
}
check('форма замера рендерится', !formError && formHtml.includes('Новый замер'), formError ? formError.message : '');
if (!formError) {
  check('в форме есть дата и вес', formHtml.includes('body-measurement-date') && formHtml.includes('body-measurement-weight'));
  check('в форме есть обхваты', formHtml.includes('body-measurement-waistCm') && formHtml.includes('body-measurement-bicepLCm'));
  check('в форме есть сохранение', formHtml.includes('body-measurement-save'));
}

fs.rmSync(outDir, { recursive: true, force: true });
console.log(`\n${failures === 0 ? 'ТЕЛО: ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ' : `ПРОВАЛОВ: ${failures}`}`);
process.exit(failures === 0 ? 0 : 1);
