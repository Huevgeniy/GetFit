import type { WorkoutRecord } from '../types';
import {
  BODY_DRAW,
  BodyDimensions,
  BodyPose,
  DEFAULT_FRONT_POSE,
  Point,
  SidePose,
  clampNumber,
  computePoseMetrics,
  direction,
  roundAngle,
  solveTwoBoneIK,
} from './bodyModel';

/* ------------------------------------------------------------------ */
/* Общие типы                                                          */
/* ------------------------------------------------------------------ */

export type ExerciseId =
  | 'squat'
  | 'deadlift'
  | 'bench'
  | 'overhead'
  | 'row'
  | 'pullup'
  | 'dips'
  | 'lunge'
  | 'rdl'
  | 'frontSquat'
  | 'bulgarian';

export type LoadJoint = 'hip' | 'knee' | 'spine' | 'shoulder' | 'elbow' | 'ankle';
export type IntensityZone = 'light' | 'moderate' | 'hard' | 'max';

export interface PoseOptions {
  /** 0.3–1: насколько глубоко выполняется движение. */
  amplitude: number;
  /** -1…1: дополнительный наклон корпуса. */
  lean: number;
}

export interface TechniqueRule {
  metric:
    | 'side.kneeFlex'
    | 'side.hipFlex'
    | 'side.torsoLean'
    | 'side.elbowFlex'
    | 'side.shoulderFlex'
    | 'side.shoulderExtension';
  label: string;
  min: number;
  max: number;
  ideal: string;
  joint: LoadJoint;
  advice: string;
}

export interface ExerciseDefinition {
  id: ExerciseId;
  name: string;
  focus: string;
  equipment: 'barbell' | 'dumbbell' | 'bodyweight';
  station?: 'bench' | 'pullup' | 'dips';
  /** Куда крепится снаряд в боковой проекции. */
  barAnchor: 'hand' | 'shoulder';
  bodyweightFactor: number;
  joints: LoadJoint[];
  cue: string;
  phaseLabels: [string, string];
  keyPointLabel: string;
  technique: TechniqueRule[];
  /** Названия упражнений в дневнике для поиска 1ПМ. */
  namePatterns: RegExp[];
  /** Ориентир 1ПМ по весу тела, если истории нет. */
  fallbackMultiplier: (sex: 'male' | 'female') => number;
  rig: (t: number, dims: BodyDimensions, options: PoseOptions) => ExerciseRig;
}

interface ExerciseRig {
  /** Точки в сантиметрах: x — вправо, y — вверх от пола. */
  hip: Point;
  torsoAngle: number;
  headAngle: number;
  hand: Point;
  nearAnkle: Point;
  farAnkle: Point;
  nearFootAngle: number;
  farFootAngle: number;
  nearKneeBend: 1 | -1;
  farKneeBend: 1 | -1;
  elbowBend: 1 | -1;
}

export interface JointLoad {
  joint: LoadJoint;
  label: string;
  muscles: string;
  torqueNm: number;
  share: number;
  index: number;
}

export interface LoadSeriesPoint {
  phase: number;
  /** 0–100: момент в самом нагруженном суставе относительно пика упражнения. */
  relativePeak: number;
  peakJoint: LoadJoint;
  loads: JointLoad[];
}

export interface OneRepMaxInfo {
  exerciseId: ExerciseId;
  valueKg: number;
  source: 'history' | 'manual' | 'estimate';
  /** Для упражнений с собственным весом 1ПМ — это общая нагрузка системы. */
  bodyweightIncluded: boolean;
  basis: string;
}

export interface TechniqueResult {
  rule: TechniqueRule;
  value: number;
  status: 'pass' | 'near' | 'fail';
}

/* ------------------------------------------------------------------ */
/* Геометрия и позы                                                    */
/* ------------------------------------------------------------------ */

const clamp = (value: number, min: number, max: number): number => clampNumber(value, min, max);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const mixPoint = (a: Point, b: Point, t: number): Point => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
});
const round1 = (value: number): number => Math.round(value * 10) / 10;

const footHeightCm = (dims: BodyDimensions): number => dims.footLengthCm * 0.3;
const hipHeightCm = (dims: BodyDimensions): number =>
  dims.thighLengthCm + dims.shinLengthCm + footHeightCm(dims);
const armLengthCm = (dims: BodyDimensions): number => dims.upperArmLengthCm + dims.forearmLengthCm;
const legLengthCm = (dims: BodyDimensions): number => dims.thighLengthCm + dims.shinLengthCm;

/** Направление в сантиметровой системе, где y растёт вверх. */
const directionCm = (angleDeg: number): Point => {
  const radians = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(radians), y: -Math.sin(radians) };
};

const shoulderFromHip = (hip: Point, torsoAngle: number, dims: BodyDimensions): Point => {
  const dir = directionCm(torsoAngle);
  return {
    x: hip.x + dir.x * dims.torsoLengthCm,
    y: hip.y + dir.y * dims.torsoLengthCm,
  };
};

const toModelPoint = (point: Point, dims: BodyDimensions): Point => ({
  x: BODY_DRAW.width / 2 + point.x * dims.scale,
  y: BODY_DRAW.soleY - point.y * dims.scale,
});

function rigToPose(rig: ExerciseRig, dims: BodyDimensions): BodyPose {
  const hip = toModelPoint(rig.hip, dims);
  const shoulder = toModelPoint(shoulderFromHip(rig.hip, rig.torsoAngle, dims), dims);
  const hand = toModelPoint(rig.hand, dims);
  const nearAnkle = toModelPoint(rig.nearAnkle, dims);
  const farAnkle = toModelPoint(rig.farAnkle, dims);
  const thigh = dims.thighLengthCm * dims.scale;
  const shin = dims.shinLengthCm * dims.scale;
  const upperArm = dims.upperArmLengthCm * dims.scale;
  const forearm = dims.forearmLengthCm * dims.scale;

  const near = solveTwoBoneIK(hip, nearAnkle, thigh, shin, rig.nearKneeBend);
  const far = solveTwoBoneIK(hip, farAnkle, thigh, shin, rig.farKneeBend);
  const arm = solveTwoBoneIK(shoulder, hand, upperArm, forearm, rig.elbowBend);

  const side: SidePose = {
    hipX: round1(hip.x),
    hipY: round1(hip.y),
    torsoAngle: roundAngle(rig.torsoAngle),
    upperArmAngle: arm.thighAngle,
    forearmAngle: arm.shinAngle,
    thighAngle: near.thighAngle,
    shinAngle: near.shinAngle,
    footAngle: roundAngle(rig.nearFootAngle),
    headAngle: roundAngle(rig.headAngle),
    farThighAngle: far.thighAngle,
    farShinAngle: far.shinAngle,
    farFootAngle: roundAngle(rig.farFootAngle),
  };

  return { side, front: { ...DEFAULT_FRONT_POSE } };
}

/* ------------------------------------------------------------------ */
/* Упражнения                                                          */
/* ------------------------------------------------------------------ */

const squatRig: ExerciseDefinition['rig'] = (t, dims, options) => {
  const stand = hipHeightCm(dims);
  const bottom = Math.max(stand * 0.56, stand - dims.thighLengthCm * 0.9);
  const hip = mixPoint(
    { x: 0, y: stand },
    { x: -dims.torsoLengthCm * 0.12, y: bottom },
    t,
  );
  const torsoAngle = lerp(-90, -66, t) - options.lean * 10 * t;
  const shoulder = shoulderFromHip(hip, torsoAngle, dims);
  const foot = footHeightCm(dims);
  return {
    hip,
    torsoAngle,
    headAngle: lerp(-90, -82, t) - options.lean * 3,
    hand: {
      x: shoulder.x - dims.chestDepthCm * 0.45,
      y: shoulder.y + dims.neckLengthCm * 0.1,
    },
    nearAnkle: { x: 2, y: foot },
    farAnkle: { x: -5, y: foot },
    nearFootAngle: 0,
    farFootAngle: 0,
    nearKneeBend: 1,
    farKneeBend: 1,
    elbowBend: -1,
  };
};

const deadliftRig: ExerciseDefinition['rig'] = (t, dims, options) => {
  const stand = hipHeightCm(dims);
  const bottom = Math.max(stand * 0.58, stand - dims.thighLengthCm * 0.8);
  const hip = mixPoint(
    { x: 0, y: stand },
    { x: -dims.thighLengthCm * 0.65, y: bottom },
    t,
  );
  const torsoAngle = lerp(-90, -22, t) - options.lean * 6 * t;
  const shoulder = shoulderFromHip(hip, torsoAngle, dims);
  const foot = footHeightCm(dims);
  return {
    hip,
    torsoAngle,
    headAngle: lerp(-90, -35, t),
    hand: { x: shoulder.x, y: shoulder.y - armLengthCm(dims) },
    nearAnkle: { x: 2, y: foot },
    farAnkle: { x: -6, y: foot },
    nearFootAngle: 0,
    farFootAngle: 0,
    nearKneeBend: 1,
    farKneeBend: 1,
    elbowBend: 1,
  };
};

const benchRig: ExerciseDefinition['rig'] = (t, dims, options) => {
  const foot = footHeightCm(dims);
  const benchY = dims.thighLengthCm * 0.9 + foot;
  const hip = { x: dims.torsoLengthCm * 0.2, y: benchY };
  const torsoAngle = 180;
  const shoulder = shoulderFromHip(hip, torsoAngle, dims);
  const hand = {
    x: shoulder.x + dims.chestDepthCm * 0.55 + options.lean * dims.chestDepthCm * 0.18,
    y: lerp(
      shoulder.y + armLengthCm(dims) - 1,
      shoulder.y + armLengthCm(dims) * 0.68,
      t,
    ),
  };
  return {
    hip,
    torsoAngle,
    headAngle: 180,
    hand,
    nearAnkle: { x: hip.x + dims.thighLengthCm * 0.62, y: foot },
    farAnkle: { x: hip.x + dims.thighLengthCm * 0.75, y: foot },
    nearFootAngle: 0,
    farFootAngle: 0,
    nearKneeBend: 1,
    farKneeBend: 1,
    elbowBend: 1,
  };
};

const overheadRig: ExerciseDefinition['rig'] = (t, dims, options) => {
  const hip = { x: 0, y: hipHeightCm(dims) };
  const torsoAngle = -90 + options.lean * 5;
  const shoulder = shoulderFromHip(hip, torsoAngle, dims);
  const foot = footHeightCm(dims);
  return {
    hip,
    torsoAngle,
    headAngle: -90,
    hand: {
      x: shoulder.x + lerp(dims.chestDepthCm * 0.55, dims.chestDepthCm * 0.04, t),
      y: lerp(
        shoulder.y + dims.upperArmLengthCm * 0.05,
        shoulder.y + armLengthCm(dims) - 1,
        t,
      ),
    },
    nearAnkle: { x: 2, y: foot },
    farAnkle: { x: -5, y: foot },
    nearFootAngle: 0,
    farFootAngle: 0,
    nearKneeBend: 1,
    farKneeBend: 1,
    elbowBend: -1,
  };
};

const rowRig: ExerciseDefinition['rig'] = (t, dims, options) => {
  const stand = hipHeightCm(dims);
  const hip = { x: 0, y: stand - dims.thighLengthCm * 0.12 };
  const torsoAngle = -55 - options.lean * 8;
  const shoulder = shoulderFromHip(hip, torsoAngle, dims);
  const foot = footHeightCm(dims);
  return {
    hip,
    torsoAngle,
    headAngle: -65,
    hand: mixPoint(
      { x: shoulder.x, y: shoulder.y - armLengthCm(dims) },
      { x: hip.x + dims.torsoLengthCm * 0.18, y: hip.y + dims.torsoLengthCm * 0.12 },
      t,
    ),
    nearAnkle: { x: 2, y: foot },
    farAnkle: { x: -6, y: foot },
    nearFootAngle: 0,
    farFootAngle: 0,
    nearKneeBend: 1,
    farKneeBend: 1,
    elbowBend: -1,
  };
};

const pullupRig: ExerciseDefinition['rig'] = (t, dims) => {
  const barY = dims.heightCm * 1.15;
  const hangShoulder = barY - armLengthCm(dims);
  const topShoulder = barY - 18;
  const shoulderY = lerp(hangShoulder, topShoulder, t);
  const hip = { x: 0, y: shoulderY - dims.torsoLengthCm };
  const ankle = {
    x: -dims.thighLengthCm * 0.12,
    y: hip.y - legLengthCm(dims) * 0.9 + t * 2,
  };
  return {
    hip,
    torsoAngle: -90,
    headAngle: -90,
    hand: { x: 0, y: barY },
    nearAnkle: ankle,
    farAnkle: { x: ankle.x - 3, y: ankle.y + 1 },
    nearFootAngle: 70,
    farFootAngle: 72,
    nearKneeBend: 1,
    farKneeBend: 1,
    elbowBend: 1,
  };
};

const dipsRig: ExerciseDefinition['rig'] = (t, dims) => {
  const barY = dims.heightCm * 0.68;
  const topShoulder = barY + armLengthCm(dims) - 1;
  const bottomShoulder = barY + armLengthCm(dims) * 0.68;
  const shoulderY = lerp(topShoulder, bottomShoulder, t);
  const hip = { x: -dims.torsoLengthCm * 0.06, y: shoulderY - dims.torsoLengthCm };
  const ankle = {
    x: -dims.thighLengthCm * 0.4,
    y: hip.y - legLengthCm(dims) * 0.86,
  };
  return {
    hip,
    torsoAngle: -78,
    headAngle: -82,
    hand: { x: 0, y: barY },
    nearAnkle: ankle,
    farAnkle: { x: ankle.x - 4, y: ankle.y + 2 },
    nearFootAngle: 65,
    farFootAngle: 67,
    nearKneeBend: 1,
    farKneeBend: 1,
    elbowBend: 1,
  };
};

const lungeRig: ExerciseDefinition['rig'] = (t, dims, options) => {
  const stand = hipHeightCm(dims);
  const hip = mixPoint(
    { x: 0, y: stand },
    { x: 0, y: stand - dims.thighLengthCm * 0.9 },
    t,
  );
  const torsoAngle = -88 - options.lean * 5;
  const shoulder = shoulderFromHip(hip, torsoAngle, dims);
  const foot = footHeightCm(dims);
  return {
    hip,
    torsoAngle,
    headAngle: -90,
    hand: { x: shoulder.x, y: shoulder.y - armLengthCm(dims) + 0.5 },
    nearAnkle: { x: lerp(2, dims.thighLengthCm * 0.72, t), y: foot },
    farAnkle: { x: lerp(-5, -dims.thighLengthCm * 0.72, t), y: foot },
    nearFootAngle: 0,
    farFootAngle: 0,
    nearKneeBend: 1,
    farKneeBend: -1,
    elbowBend: 1,
  };
};

const rdlRig: ExerciseDefinition['rig'] = (t, dims, options) => {
  const stand = hipHeightCm(dims);
  const hip = mixPoint(
    { x: 0, y: stand },
    { x: -dims.thighLengthCm * 0.55, y: stand - dims.thighLengthCm * 0.18 },
    t,
  );
  const torsoAngle = lerp(-90, -42, t) - options.lean * 6 * t;
  const shoulder = shoulderFromHip(hip, torsoAngle, dims);
  const foot = footHeightCm(dims);
  return {
    hip,
    torsoAngle,
    headAngle: lerp(-90, -58, t),
    hand: { x: shoulder.x, y: shoulder.y - armLengthCm(dims) },
    nearAnkle: { x: 2, y: foot },
    farAnkle: { x: -6, y: foot },
    nearFootAngle: 0,
    farFootAngle: 0,
    nearKneeBend: 1,
    farKneeBend: 1,
    elbowBend: -1,
  };
};

const frontSquatRig: ExerciseDefinition['rig'] = (t, dims, options) => {
  const stand = hipHeightCm(dims);
  const bottom = Math.max(stand * 0.56, stand - dims.thighLengthCm * 0.9);
  const hip = mixPoint(
    { x: 0, y: stand },
    { x: -dims.torsoLengthCm * 0.04, y: bottom },
    t,
  );
  const torsoAngle = lerp(-90, -80, t) - options.lean * 6 * t;
  const shoulder = shoulderFromHip(hip, torsoAngle, dims);
  const foot = footHeightCm(dims);
  return {
    hip,
    torsoAngle,
    headAngle: lerp(-90, -88, t),
    hand: {
      x: shoulder.x + dims.chestDepthCm * 0.34,
      y: shoulder.y + dims.neckLengthCm * 0.06,
    },
    nearAnkle: { x: 2, y: foot },
    farAnkle: { x: -5, y: foot },
    nearFootAngle: 0,
    farFootAngle: 0,
    nearKneeBend: 1,
    farKneeBend: 1,
    elbowBend: -1,
  };
};

const bulgarianRig: ExerciseDefinition['rig'] = (t, dims, options) => {
  const stand = hipHeightCm(dims);
  const hip = mixPoint(
    { x: 0, y: stand },
    { x: 0, y: stand - dims.thighLengthCm * 0.86 },
    t,
  );
  const torsoAngle = -88 - options.lean * 5;
  const shoulder = shoulderFromHip(hip, torsoAngle, dims);
  const foot = footHeightCm(dims);
  return {
    hip,
    torsoAngle,
    headAngle: -90,
    hand: { x: shoulder.x, y: shoulder.y - armLengthCm(dims) + 0.5 },
    nearAnkle: { x: lerp(2, dims.thighLengthCm * 0.55, t), y: foot },
    farAnkle: {
      x: lerp(-5, -dims.thighLengthCm * 0.9, t),
      y: foot + dims.heightCm * 0.12 * t,
    },
    nearFootAngle: 0,
    farFootAngle: 15,
    nearKneeBend: 1,
    farKneeBend: -1,
    elbowBend: 1,
  };
};

export const EXERCISES: ExerciseDefinition[] = [
  {
    id: 'squat',
    name: 'Присед со штангой',
    focus: 'Квадрицепс, ягодицы, кор',
    equipment: 'barbell',
    barAnchor: 'shoulder',
    bodyweightFactor: 0,
    joints: ['hip', 'knee', 'spine', 'ankle'],
    cue: 'Тяни таз вниз и назад, колени по направлению стоп. Корпус наклоняется, но спина остаётся нейтральной.',
    phaseLabels: ['Стоя', 'Нижняя точка'],
    keyPointLabel: 'нижняя точка',
    technique: [
      { metric: 'side.kneeFlex', label: 'Глубина по колену', min: 70, max: 130, ideal: '85–115°', joint: 'knee', advice: 'Опуститесь глубже или не проваливайтесь ниже комфортной амплитуды.' },
      { metric: 'side.torsoLean', label: 'Наклон корпуса', min: 10, max: 45, ideal: '18–35°', joint: 'spine', advice: 'Слишком сильный наклон переносит нагрузку на поясницу.' },
      { metric: 'side.hipFlex', label: 'Сгибание бедра', min: 70, max: 135, ideal: '90–120°', joint: 'hip', advice: 'Таз не доходит до нужной глубины или проваливается слишком низко.' },
    ],
    namePatterns: [/присед/i, /squat/i],
    fallbackMultiplier: (sex) => (sex === 'female' ? 0.75 : 1.1),
    rig: squatRig,
  },
  {
    id: 'deadlift',
    name: 'Становая тяга',
    focus: 'Задняя цепь, спина, ягодицы',
    equipment: 'barbell',
    barAnchor: 'hand',
    bodyweightFactor: 0,
    joints: ['hip', 'knee', 'spine', 'ankle'],
    cue: 'Тянись грудью вперёд, таз назад. Руки прямые, гриф близко к голеням, спина нейтральна.',
    phaseLabels: ['Стоя', 'Старт'],
    keyPointLabel: 'старт с пола',
    technique: [
      { metric: 'side.kneeFlex', label: 'Сгибание колена', min: 25, max: 100, ideal: '40–80°', joint: 'knee', advice: 'Колени либо полностью прямые, либо согнуты как в приседе.' },
      { metric: 'side.torsoLean', label: 'Наклон корпуса', min: 40, max: 75, ideal: '50–68°', joint: 'spine', advice: 'Чрезмерный наклон повышает нагрузку на поясницу.' },
      { metric: 'side.elbowFlex', label: 'Прямые руки', min: 0, max: 25, ideal: '0–15°', joint: 'elbow', advice: 'Не сгибайте руки — это отнимает силу у спины.' },
    ],
    namePatterns: [/станов/i, /deadlift/i],
    fallbackMultiplier: (sex) => (sex === 'female' ? 0.95 : 1.35),
    rig: deadliftRig,
  },
  {
    id: 'bench',
    name: 'Жим лёжа',
    focus: 'Грудь, трицепс, плечи',
    equipment: 'barbell',
    station: 'bench',
    barAnchor: 'hand',
    bodyweightFactor: 0,
    joints: ['shoulder', 'elbow', 'spine'],
    cue: 'Лопатки сведены, стопы на полу. Гриф опускается к груди, локти под углом около 45–60°.',
    phaseLabels: ['Руки прямые', 'Гриф у груди'],
    keyPointLabel: 'гриф у груди',
    technique: [
      { metric: 'side.elbowFlex', label: 'Сгибание локтя', min: 70, max: 105, ideal: '80–95°', joint: 'elbow', advice: 'Локоть уходит слишком глубоко или не доходит до низа.' },
      { metric: 'side.shoulderFlex', label: 'Положение плеча', min: 45, max: 135, ideal: '60–110°', joint: 'shoulder', advice: 'Плечо поднято слишком высоко к голове.' },
    ],
    namePatterns: [/жим.*лежа/i, /жим лёжа/i, /bench/i],
    fallbackMultiplier: (sex) => (sex === 'female' ? 0.45 : 0.75),
    rig: benchRig,
  },
  {
    id: 'overhead',
    name: 'Жим над головой',
    focus: 'Плечи, трицепс, кор',
    equipment: 'barbell',
    barAnchor: 'hand',
    bodyweightFactor: 0,
    joints: ['shoulder', 'elbow', 'spine'],
    cue: 'Ребра вниз, поясница не прогибается. Штанга идёт по дуге над серединой стопы.',
    phaseLabels: ['У плеч', 'Над головой'],
    keyPointLabel: 'верхняя точка',
    technique: [
      { metric: 'side.shoulderFlex', label: 'Подъём плеча', min: 160, max: 205, ideal: '170–195°', joint: 'shoulder', advice: 'Руки не выходят в полную амплитуду над головой.' },
      { metric: 'side.elbowFlex', label: 'Выпрямление локтя', min: 0, max: 30, ideal: '0–15°', joint: 'elbow', advice: 'Локти остаются согнутыми в верхней точке.' },
      { metric: 'side.torsoLean', label: 'Корпус без прогиба', min: 0, max: 15, ideal: '0–8°', joint: 'spine', advice: 'Прогиб в пояснице переносит нагрузку на спину.' },
    ],
    namePatterns: [/жим.*стоя/i, /жим.*сидя/i, /жим.*голов/i, /overhead/i, /армейск/i],
    fallbackMultiplier: (sex) => (sex === 'female' ? 0.35 : 0.6),
    rig: overheadRig,
  },
  {
    id: 'row',
    name: 'Тяга штанги в наклоне',
    focus: 'Спина, широчайшие, бицепс',
    equipment: 'barbell',
    barAnchor: 'hand',
    bodyweightFactor: 0,
    joints: ['shoulder', 'elbow', 'spine', 'hip'],
    cue: 'Корпус зафиксирован, тяните локти назад к поясу. Не выпрямляйте спину рывком.',
    phaseLabels: ['Руки вниз', 'Локоть у пояса'],
    keyPointLabel: 'локоть у пояса',
    technique: [
      { metric: 'side.torsoLean', label: 'Наклон корпуса', min: 25, max: 60, ideal: '35–50°', joint: 'spine', advice: 'Корпус слишком вертикален или сложен слишком сильно.' },
      { metric: 'side.elbowFlex', label: 'Сгибание локтя', min: 55, max: 115, ideal: '75–95°', joint: 'elbow', advice: 'Тяга выполняется руками, а не спиной, или локоть не доходит.' },
      { metric: 'side.kneeFlex', label: 'Мягкие колени', min: 10, max: 50, ideal: '18–35°', joint: 'knee', advice: 'Колени полностью прямые — добавьте мягкое сгибание.' },
    ],
    namePatterns: [/тяга.*штанг/i, /тяга.*наклон/i, /row/i],
    fallbackMultiplier: (sex) => (sex === 'female' ? 0.45 : 0.7),
    rig: rowRig,
  },
  {
    id: 'pullup',
    name: 'Подтягивания',
    focus: 'Широчайшие, бицепс, кор',
    equipment: 'bodyweight',
    station: 'pullup',
    barAnchor: 'hand',
    bodyweightFactor: 1,
    joints: ['shoulder', 'elbow', 'spine'],
    cue: 'Тяните локти вниз к рёбрам, не тянитесь шеей. Корпус остаётся почти вертикальным.',
    phaseLabels: ['Вис', 'Подбородок у перекладины'],
    keyPointLabel: 'верхняя точка',
    technique: [
      { metric: 'side.elbowFlex', label: 'Сгибание локтя', min: 80, max: 155, ideal: '105–145°', joint: 'elbow', advice: 'Подтягивание не доходит до верха или локоть пересогнут.' },
      { metric: 'side.shoulderFlex', label: 'Положение плеча', min: 60, max: 135, ideal: '80–120°', joint: 'shoulder', advice: 'Плечо уходит в слишком высокое положение — включите широчайшие.' },
    ],
    namePatterns: [/подтягиван/i, /pull.?up/i, /chin.?up/i],
    fallbackMultiplier: (sex) => (sex === 'female' ? 1.15 : 1.35),
    rig: pullupRig,
  },
  {
    id: 'dips',
    name: 'Отжимания на брусьях',
    focus: 'Грудь, трицепс, плечи',
    equipment: 'bodyweight',
    station: 'dips',
    barAnchor: 'hand',
    bodyweightFactor: 1,
    joints: ['shoulder', 'elbow'],
    cue: 'Опускайтесь до комфортной глубины, локти идут назад, корпус не раскачивается.',
    phaseLabels: ['Верх', 'Нижняя точка'],
    keyPointLabel: 'нижняя точка',
    technique: [
      { metric: 'side.elbowFlex', label: 'Глубина по локтю', min: 65, max: 115, ideal: '80–100°', joint: 'elbow', advice: 'Слишком мелкая или чрезмерно глубокая амплитуда.' },
      { metric: 'side.torsoLean', label: 'Наклон корпуса', min: 0, max: 20, ideal: '5–15°', joint: 'spine', advice: 'Корпус раскачивается или уходит слишком далеко вперёд.' },
    ],
    namePatterns: [/брусь/i, /dips?/i, /отжиман.*брус/i],
    fallbackMultiplier: (sex) => (sex === 'female' ? 1.25 : 1.5),
    rig: dipsRig,
  },
  {
    id: 'lunge',
    name: 'Выпад с гантелями',
    focus: 'Квадрицепс, ягодицы, баланс',
    equipment: 'dumbbell',
    barAnchor: 'hand',
    bodyweightFactor: 0,
    joints: ['hip', 'knee', 'spine', 'ankle'],
    cue: 'Корпус вертикально, переднее колено над стопой. Опускайтесь до комфортной глубины.',
    phaseLabels: ['Стоя', 'Нижняя точка'],
    keyPointLabel: 'нижняя точка',
    technique: [
      { metric: 'side.kneeFlex', label: 'Сгибание переднего колена', min: 65, max: 115, ideal: '80–100°', joint: 'knee', advice: 'Переднее колено сгибается недостаточно или слишком сильно.' },
      { metric: 'side.hipFlex', label: 'Глубина выпада', min: 70, max: 135, ideal: '90–115°', joint: 'hip', advice: 'Выпад слишком мелкий или таз проваливается вниз.' },
      { metric: 'side.torsoLean', label: 'Вертикальный корпус', min: 0, max: 20, ideal: '0–12°', joint: 'spine', advice: 'Наклон корпуса вперёд усложняет баланс.' },
    ],
    namePatterns: [/выпад/i, /lunge/i],
    fallbackMultiplier: (sex) => (sex === 'female' ? 0.22 : 0.35),
    rig: lungeRig,
  },
  {
    id: 'rdl',
    name: 'Румынская тяга',
    focus: 'Задняя цепь, бицепс бедра, ягодицы',
    equipment: 'barbell',
    barAnchor: 'hand',
    bodyweightFactor: 0,
    joints: ['hip', 'knee', 'spine'],
    cue: 'Таз назад, колени мягко согнуты. Гриф скользит по ногам, спина остаётся нейтральной.',
    phaseLabels: ['Стоя', 'Растяжение задней цепи'],
    keyPointLabel: 'нижняя точка',
    technique: [
      { metric: 'side.kneeFlex', label: 'Мягкие колени', min: 10, max: 55, ideal: '15–35°', joint: 'knee', advice: 'Колени слишком прямые или слишком согнуты — это уже не тазобедренный шарнир.' },
      { metric: 'side.torsoLean', label: 'Наклон корпуса', min: 35, max: 65, ideal: '42–58°', joint: 'spine', advice: 'Слишком вертикально или слишком глубоко для контроля поясницы.' },
      { metric: 'side.elbowFlex', label: 'Прямые руки', min: 0, max: 20, ideal: '0–12°', joint: 'elbow', advice: 'Не тяните руками — гриф должен висеть.' },
    ],
    namePatterns: [/румын/i, /rdl/i, /romanian/i],
    fallbackMultiplier: (sex) => (sex === 'female' ? 0.8 : 1.1),
    rig: rdlRig,
  },
  {
    id: 'frontSquat',
    name: 'Фронтальный присед',
    focus: 'Квадрицепс, кор, верх спины',
    equipment: 'barbell',
    barAnchor: 'shoulder',
    bodyweightFactor: 0,
    joints: ['hip', 'knee', 'spine', 'ankle'],
    cue: 'Локти высоко, гриф на передних дельтах. Корпус вертикальнее, колени едут вперёд.',
    phaseLabels: ['Стоя', 'Нижняя точка'],
    keyPointLabel: 'нижняя точка',
    technique: [
      { metric: 'side.kneeFlex', label: 'Глубина по колену', min: 70, max: 130, ideal: '85–115°', joint: 'knee', advice: 'Слишком мелко или чрезмерно глубоко для текущей подвижности.' },
      { metric: 'side.torsoLean', label: 'Вертикальный корпус', min: 5, max: 30, ideal: '8–22°', joint: 'spine', advice: 'Сильный наклон разгружает квадрицепс и повышает нагрузку на спину.' },
      { metric: 'side.hipFlex', label: 'Сгибание бедра', min: 70, max: 135, ideal: '90–120°', joint: 'hip', advice: 'Таз не доходит до нужной глубины или проваливается.' },
    ],
    namePatterns: [/фронтальн.*присед/i, /front squat/i],
    fallbackMultiplier: (sex) => (sex === 'female' ? 0.6 : 0.9),
    rig: frontSquatRig,
  },
  {
    id: 'bulgarian',
    name: 'Болгарский сплит-присед',
    focus: 'Квадрицепс, ягодицы, баланс',
    equipment: 'dumbbell',
    barAnchor: 'hand',
    bodyweightFactor: 0,
    joints: ['hip', 'knee', 'spine', 'ankle'],
    cue: 'Задняя стопа на скамье, передняя колено над стопой. Корпус почти вертикально.',
    phaseLabels: ['Стоя', 'Нижняя точка'],
    keyPointLabel: 'нижняя точка',
    technique: [
      { metric: 'side.kneeFlex', label: 'Сгибание переднего колена', min: 65, max: 115, ideal: '80–100°', joint: 'knee', advice: 'Переднее колено сгибается недостаточно или слишком сильно.' },
      { metric: 'side.hipFlex', label: 'Глубина', min: 70, max: 135, ideal: '90–115°', joint: 'hip', advice: 'Таз не опускается или проваливается вниз.' },
      { metric: 'side.torsoLean', label: 'Вертикальный корпус', min: 0, max: 20, ideal: '0–12°', joint: 'spine', advice: 'Наклон вперёд усложняет баланс и смещает нагрузку.' },
    ],
    namePatterns: [/болгар/i, /bulgarian/i, /сплит.?присед/i],
    fallbackMultiplier: (sex) => (sex === 'female' ? 0.18 : 0.3),
    rig: bulgarianRig,
  },
];

export function exerciseById(id: string): ExerciseDefinition | undefined {
  return EXERCISES.find((exercise) => exercise.id === id);
}

export function exercisePose(
  exercise: ExerciseDefinition,
  phase: number,
  dims: BodyDimensions,
  options: PoseOptions = { amplitude: 1, lean: 0 },
): BodyPose {
  const t = clamp(phase * clamp(options.amplitude, 0.2, 1), 0, 1);
  return rigToPose(exercise.rig(t, dims, options), dims);
}

/* ------------------------------------------------------------------ */
/* 1ПМ и зоны интенсивности                                            */
/* ------------------------------------------------------------------ */

function epley(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

function matchName(name: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(name));
}

function bodyWeightFallback(bodyWeightKg: number): number {
  return bodyWeightKg > 0 ? bodyWeightKg : 75;
}

/**
 * 1ПМ берётся из истории тренировок, если там есть подходы этого упражнения.
 * Иначе — ориентир по весу тела. Ручная поправка всегда важнее.
 */
export function estimateOneRepMax(
  exercise: ExerciseDefinition,
  pastWorkouts: WorkoutRecord[],
  bodyWeightKg: number,
  sex: 'male' | 'female',
  manualKg?: number,
): OneRepMaxInfo {
  if (manualKg !== undefined && Number.isFinite(manualKg) && manualKg > 0) {
    return {
      exerciseId: exercise.id,
      valueKg: Math.round(manualKg * 10) / 10,
      source: 'manual',
      bodyweightIncluded: exercise.bodyweightFactor > 0,
      basis: 'ручная поправка',
    };
  }

  let best = 0;
  let bestWeight = 0;
  let bestReps = 0;
  let bestDate = '';
  for (const workout of pastWorkouts || []) {
    for (const log of workout.exercises || []) {
      if (!matchName(log.name, exercise.namePatterns)) continue;
      for (const set of log.sets || []) {
        const weight = Number(set.weight) || 0;
        const reps = Number(set.reps) || 0;
        if (reps <= 0) continue;
        if (exercise.bodyweightFactor > 0 && weight <= 0) continue;
        const calculated = Number(set.calculated1RM) || 0;
        const estimate = calculated > 0 ? calculated : epley(weight, reps);
        if (estimate > best) {
          best = estimate;
          bestWeight = weight;
          bestReps = reps;
          bestDate = workout.date || workout.completedAt || workout.startedAt || '';
        }
      }
    }
  }

  if (best > 0) {
    const base = bodyWeightFallback(bodyWeightKg);
    const total = exercise.bodyweightFactor > 0 ? base + best : best;
    return {
      exerciseId: exercise.id,
      valueKg: Math.round(total * 10) / 10,
      source: 'history',
      bodyweightIncluded: exercise.bodyweightFactor > 0,
      basis: `${bestWeight > 0 ? `${bestWeight} кг × ${bestReps}` : `${bestReps} повт.`}${
        bestDate ? ` · ${bestDate.slice(0, 10)}` : ''
      }`,
    };
  }

  const base = bodyWeightFallback(bodyWeightKg);
  const multiplier = exercise.fallbackMultiplier(sex);
  return {
    exerciseId: exercise.id,
    valueKg: Math.round(base * multiplier * 10) / 10,
    source: 'estimate',
    bodyweightIncluded: exercise.bodyweightFactor > 0,
    basis: `ориентир ${multiplier.toFixed(2)} × вес тела`,
  };
}

/** Общая нагрузка: для штанги — вес, для собственного веса — масса тела + добавка. */
export function systemLoadKg(
  exercise: ExerciseDefinition,
  bodyWeightKg: number,
  addedWeightKg: number,
): number {
  const body = bodyWeightFallback(bodyWeightKg);
  const added = Math.max(0, Number.isFinite(addedWeightKg) ? addedWeightKg : 0);
  return exercise.bodyweightFactor > 0 ? body * exercise.bodyweightFactor + added : added;
}

export function intensityPercent(
  exercise: ExerciseDefinition,
  oneRepMax: OneRepMaxInfo,
  bodyWeightKg: number,
  addedWeightKg: number,
): number {
  if (!oneRepMax || oneRepMax.valueKg <= 0) return 0;
  const load = systemLoadKg(exercise, bodyWeightKg, addedWeightKg);
  return Math.round((load / oneRepMax.valueKg) * 1000) / 10;
}

export function intensityZone(percent: number): IntensityZone {
  if (percent < 60) return 'light';
  if (percent < 75) return 'moderate';
  if (percent < 85) return 'hard';
  return 'max';
}

export const INTENSITY_META: Record<
  IntensityZone,
  { label: string; short: string; color: string; description: string }
> = {
  light: {
    label: 'лёгкая',
    short: 'до 60%',
    color: '#34d399',
    description: 'Ниже 60% от вашего ориентировочного 1ПМ. Обычно это разминочная или объёмная работа.',
  },
  moderate: {
    label: 'умеренная',
    short: '60–75%',
    color: '#fbbf24',
    description: '60–75% от 1ПМ. Рабочая зона для повторений и техники.',
  },
  hard: {
    label: 'высокая',
    short: '75–85%',
    color: '#fb923c',
    description: '75–85% от 1ПМ. Силовая работа; следите за техникой и восстановлением.',
  },
  max: {
    label: 'очень высокая',
    short: '85%+',
    color: '#fb7185',
    description: 'Выше 85% от 1ПМ. Близко к максимуму; такие подходы требуют разминки и страховки.',
  },
};

export function intensityMeta(percent: number) {
  return INTENSITY_META[intensityZone(percent)];
}

/* ------------------------------------------------------------------ */
/* Нагрузка по суставам                                                */
/* ------------------------------------------------------------------ */

const JOINT_META: Record<LoadJoint, { label: string; muscles: string }> = {
  hip: { label: 'Тазобедренный', muscles: 'ягодицы · бицепс бедра' },
  knee: { label: 'Коленный', muscles: 'квадрицепс' },
  spine: { label: 'Поясница', muscles: 'разгибатели спины' },
  shoulder: { label: 'Плечевой', muscles: 'дельты · вращательная манжета' },
  elbow: { label: 'Локтевой', muscles: 'бицепс · трицепс' },
  ankle: { label: 'Голеностоп', muscles: 'икры · ахилл' },
};

export function jointLabel(joint: LoadJoint): string {
  return JOINT_META[joint].label;
}

/**
 * Упрощённая оценка момента в суставах по 2D-проекции. Это доля нагрузки
 * внутри упражнения, а не риск травмы и не медицинский вывод.
 */
export function estimateJointLoads(
  exercise: ExerciseDefinition,
  pose: BodyPose,
  dims: BodyDimensions,
  bodyWeightKg: number,
  addedWeightKg: number,
): JointLoad[] {
  const side = pose.side;
  const scale = dims.scale;
  const body = bodyWeightFallback(bodyWeightKg);
  const added = Math.max(0, Number.isFinite(addedWeightKg) ? addedWeightKg : 0);
  const external = systemLoadKg(exercise, body, added);
  const gravity = 9.81;

  const hip = { x: side.hipX, y: side.hipY };
  const shoulder = {
    x: hip.x + Math.cos((side.torsoAngle * Math.PI) / 180) * dims.torsoLengthCm * scale,
    y: hip.y + Math.sin((side.torsoAngle * Math.PI) / 180) * dims.torsoLengthCm * scale,
  };
  const elbow = {
    x: shoulder.x + Math.cos((side.upperArmAngle * Math.PI) / 180) * dims.upperArmLengthCm * scale,
    y: shoulder.y + Math.sin((side.upperArmAngle * Math.PI) / 180) * dims.upperArmLengthCm * scale,
  };
  const hand = {
    x: elbow.x + Math.cos((side.forearmAngle * Math.PI) / 180) * dims.forearmLengthCm * scale,
    y: elbow.y + Math.sin((side.forearmAngle * Math.PI) / 180) * dims.forearmLengthCm * scale,
  };
  const knee = {
    x: hip.x + Math.cos((side.thighAngle * Math.PI) / 180) * dims.thighLengthCm * scale,
    y: hip.y + Math.sin((side.thighAngle * Math.PI) / 180) * dims.thighLengthCm * scale,
  };
  const ankle = {
    x: knee.x + Math.cos((side.shinAngle * Math.PI) / 180) * dims.shinLengthCm * scale,
    y: knee.y + Math.sin((side.shinAngle * Math.PI) / 180) * dims.shinLengthCm * scale,
  };
  const footLength = dims.footLengthCm * scale;
  const toe = {
    x: ankle.x + Math.cos((side.footAngle * Math.PI) / 180) * footLength * 0.72,
    y: ankle.y + Math.sin((side.footAngle * Math.PI) / 180) * footLength * 0.72,
  };

  const horizontalM = (a: Point, b: Point): number => Math.abs(a.x - b.x) / scale / 100;
  const barPoint =
    exercise.barAnchor === 'shoulder'
      ? { x: shoulder.x - dims.chestDepthCm * scale * 0.12, y: shoulder.y }
      : hand;
  const bodyweightExercise = exercise.bodyweightFactor > 0;

  const torqueFor = (joint: LoadJoint): number => {
    if (bodyweightExercise) {
      if (joint === 'shoulder') {
        const lever = horizontalM(shoulder, hand) + horizontalM(shoulder, hip) * 0.25;
        return external * gravity * lever;
      }
      if (joint === 'elbow') {
        const lever = horizontalM(elbow, shoulder) * 0.7 + horizontalM(elbow, hand) * 0.3;
        return external * gravity * lever;
      }
      if (joint === 'spine') {
        return external * gravity * horizontalM(hip, shoulder) * 0.3;
      }
      return external * gravity * horizontalM(hip, shoulder) * 0.2;
    }

    if (joint === 'hip') {
      const lever = horizontalM(hip, barPoint) + horizontalM(hip, shoulder) * 0.12;
      return (external + body * 0.35) * gravity * lever;
    }
    if (joint === 'knee') {
      const lever = horizontalM(knee, barPoint) + horizontalM(knee, hip) * 0.1;
      return (external + body * 0.25) * gravity * lever;
    }
    if (joint === 'spine') {
      const lever =
        horizontalM(hip, shoulder) * (0.35 + Math.min(1, external / Math.max(1, body)) * 0.65) +
        horizontalM(hip, barPoint) * 0.25;
      return (external + body * 0.35) * gravity * lever;
    }
    if (joint === 'shoulder') {
      const extra = exercise.id === 'bench' ? (dims.chestDepthCm / 100) * 0.35 : 0;
      const lever = horizontalM(shoulder, barPoint) + extra + horizontalM(shoulder, hip) * 0.05;
      return (external + body * 0.1) * gravity * lever;
    }
    if (joint === 'elbow') {
      const lever = horizontalM(elbow, barPoint) + (dims.forearmLengthCm / 100) * 0.08;
      return (external + body * 0.05) * gravity * lever;
    }
    /* Голеностоп нагружается не длиной стопы, а ходом колена вперёд. */
    const ankleLever =
      horizontalM(ankle, knee) * 0.35 + horizontalM(ankle, barPoint) * 0.4 + 0.005;
    return (external + body * 0.25) * gravity * ankleLever;
  };

  const raw = exercise.joints.map((joint) => ({
    joint,
    torque: Math.max(0.1, torqueFor(joint)),
  }));
  const total = raw.reduce((sum, item) => sum + item.torque, 0) || 1;
  const normalizer = body * gravity * (dims.heightCm / 100);

  return raw.map((item) => ({
    joint: item.joint,
    label: JOINT_META[item.joint].label,
    muscles: JOINT_META[item.joint].muscles,
    torqueNm: Math.round(item.torque),
    share: Math.round((item.torque / total) * 1000) / 10,
    index: Math.round((item.torque / normalizer) * 1000) / 1000,
  }));
}

export function loadSeries(
  exercise: ExerciseDefinition,
  dims: BodyDimensions,
  bodyWeightKg: number,
  addedWeightKg: number,
  options: PoseOptions,
  steps = 25,
): LoadSeriesPoint[] {
  const count = Math.max(2, Math.round(steps));
  const frames = Array.from({ length: count }, (_, index) => {
    const phase = index / (count - 1);
    const loads = estimateJointLoads(
      exercise,
      exercisePose(exercise, phase, dims, options),
      dims,
      bodyWeightKg,
      addedWeightKg,
    );
    let peakJoint = loads[0]?.joint || 'hip';
    let peakTorque = 0;
    for (const load of loads) {
      if (load.torqueNm > peakTorque) {
        peakTorque = load.torqueNm;
        peakJoint = load.joint;
      }
    }
    return { phase, loads, peakJoint, peakTorque };
  });
  const max = frames.reduce((best, frame) => Math.max(best, frame.peakTorque), 0) || 1;
  return frames.map((frame) => ({
    phase: frame.phase,
    relativePeak: Math.round((frame.peakTorque / max) * 1000) / 10,
    peakJoint: frame.peakJoint,
    loads: frame.loads,
  }));
}

/* ------------------------------------------------------------------ */
/* Техника                                                             */
/* ------------------------------------------------------------------ */

export function evaluateTechnique(
  exercise: ExerciseDefinition,
  dims: BodyDimensions,
  options: PoseOptions,
): TechniqueResult[] {
  const pose = exercisePose(exercise, 1, dims, options);
  const metrics = computePoseMetrics(pose);
  return exercise.technique.map((rule) => {
    const value = metrics[rule.metric] ?? 0;
    const span = Math.max(1, rule.max - rule.min);
    const outside = value < rule.min ? rule.min - value : value > rule.max ? value - rule.max : 0;
    const near =
      outside === 0 &&
      ((value > rule.min && value - rule.min < span * 0.1) ||
        (value < rule.max && rule.max - value < span * 0.1));
    return {
      rule,
      value: Math.round(value),
      status: outside > 0 ? 'fail' : near ? 'near' : 'pass',
    };
  });
}
