import type {
  BodyMeasurementEntry,
  BodyProfile,
  WorkoutRecord,
} from '../types';

/* ------------------------------------------------------------------ */
/* Замеры                                                              */
/* ------------------------------------------------------------------ */

export type BodyView = 'side' | 'front';

export type BodyMetricKey =
  | 'neckCm'
  | 'shouldersCm'
  | 'chestCm'
  | 'waistCm'
  | 'hipsCm'
  | 'bicepLCm'
  | 'bicepRCm'
  | 'forearmLCm'
  | 'forearmRCm'
  | 'wristLCm'
  | 'wristRCm'
  | 'thighLCm'
  | 'thighRCm'
  | 'calfLCm'
  | 'calfRCm'
  | 'ankleLCm'
  | 'ankleRCm';

export type BodyMetricGroup = 'core' | 'arms' | 'legs';

export interface BodyMetricField {
  key: BodyMetricKey;
  label: string;
  short: string;
  group: BodyMetricGroup;
  min: number;
  max: number;
  placeholder: string;
}

export const BODY_METRIC_GROUPS: Array<{ id: BodyMetricGroup; label: string; hint: string }> = [
  { id: 'core', label: 'Корпус', hint: 'Обхваты по самой широкой части' },
  { id: 'arms', label: 'Руки', hint: 'Сантиметровая лента без натяжения' },
  { id: 'legs', label: 'Ноги', hint: 'Мерьте одну и ту же точку' },
];

export const BODY_METRIC_FIELDS: BodyMetricField[] = [
  { key: 'neckCm', label: 'Шея', short: 'Шея', group: 'core', min: 20, max: 80, placeholder: '38' },
  { key: 'shouldersCm', label: 'Плечи (обхват)', short: 'Плечи', group: 'core', min: 50, max: 200, placeholder: '120' },
  { key: 'chestCm', label: 'Грудь', short: 'Грудь', group: 'core', min: 50, max: 200, placeholder: '102' },
  { key: 'waistCm', label: 'Талия', short: 'Талия', group: 'core', min: 40, max: 180, placeholder: '82' },
  { key: 'hipsCm', label: 'Бёдра (обхват)', short: 'Бёдра', group: 'core', min: 50, max: 200, placeholder: '98' },
  { key: 'bicepLCm', label: 'Бицепс левый', short: 'Бицепс Л', group: 'arms', min: 15, max: 80, placeholder: '38' },
  { key: 'bicepRCm', label: 'Бицепс правый', short: 'Бицепс П', group: 'arms', min: 15, max: 80, placeholder: '38' },
  { key: 'forearmLCm', label: 'Предплечье левое', short: 'Предплечье Л', group: 'arms', min: 15, max: 60, placeholder: '30' },
  { key: 'forearmRCm', label: 'Предплечье правое', short: 'Предплечье П', group: 'arms', min: 15, max: 60, placeholder: '30' },
  { key: 'wristLCm', label: 'Запястье левое', short: 'Запястье Л', group: 'arms', min: 10, max: 35, placeholder: '18' },
  { key: 'wristRCm', label: 'Запястье правое', short: 'Запястье П', group: 'arms', min: 10, max: 35, placeholder: '18' },
  { key: 'thighLCm', label: 'Бедро левое', short: 'Бедро Л', group: 'legs', min: 30, max: 110, placeholder: '58' },
  { key: 'thighRCm', label: 'Бедро правое', short: 'Бедро П', group: 'legs', min: 30, max: 110, placeholder: '58' },
  { key: 'calfLCm', label: 'Голень левая', short: 'Голень Л', group: 'legs', min: 20, max: 70, placeholder: '38' },
  { key: 'calfRCm', label: 'Голень правая', short: 'Голень П', group: 'legs', min: 20, max: 70, placeholder: '38' },
  { key: 'ankleLCm', label: 'Лодыжка левая', short: 'Лодыжка Л', group: 'legs', min: 12, max: 40, placeholder: '23' },
  { key: 'ankleRCm', label: 'Лодыжка правая', short: 'Лодыжка П', group: 'legs', min: 12, max: 40, placeholder: '23' },
];

export const BODY_METRIC_BY_KEY: Record<BodyMetricKey, BodyMetricField> =
  BODY_METRIC_FIELDS.reduce((acc, field) => {
    acc[field.key] = field;
    return acc;
  }, {} as Record<BodyMetricKey, BodyMetricField>);

export const BODY_METRIC_KEYS = BODY_METRIC_FIELDS.map((field) => field.key);

const AVATAR_LIMIT = 2_500_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function cleanNumber(value: unknown, min: number, max: number): number | undefined {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(',', '.').replace(/[^\d.\-]/g, ''))
        : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.round(clampNumber(parsed, min, max) * 10) / 10;
}

function cleanText(value: unknown, limit = 500): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, limit);
  return trimmed || undefined;
}

/** Приводит сохранённый профиль тела к безопасному виду после облака или импорта. */
export function normalizeBodyProfile(raw: unknown): BodyProfile {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const height = cleanNumber(source.heightCm, 100, 250);
  const sex = source.sex === 'female' ? 'female' : source.sex === 'male' ? 'male' : undefined;
  const avatarRaw = typeof source.avatarUrl === 'string' ? source.avatarUrl.trim() : '';
  const avatarUrl =
    avatarRaw && avatarRaw.length <= AVATAR_LIMIT && /^(data:image\/|https?:\/\/)/i.test(avatarRaw)
      ? avatarRaw
      : undefined;

  const rawMeasurements = Array.isArray(source.measurements) ? source.measurements : [];
  const seenIds = new Set<string>();
  const measurements: BodyMeasurementEntry[] = [];

  rawMeasurements.slice(0, 500).forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const entry = item as Record<string, unknown>;
    const rawDate = typeof entry.date === 'string' ? entry.date.slice(0, 10) : '';
    const date = DATE_RE.test(rawDate) ? rawDate : new Date().toISOString().slice(0, 10);
    let id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim().slice(0, 80) : `bm_${date}_${index}`;
    if (seenIds.has(id)) id = `${id}_${index}`;
    seenIds.add(id);

    const cleaned: BodyMeasurementEntry = {
      id,
      date,
      createdAt:
        typeof entry.createdAt === 'string' && !Number.isNaN(Date.parse(entry.createdAt))
          ? entry.createdAt
          : `${date}T12:00:00.000Z`,
    };

    const weight = cleanNumber(entry.weightKg, 30, 350);
    if (weight !== undefined) cleaned.weightKg = weight;
    for (const field of BODY_METRIC_FIELDS) {
      const value = cleanNumber(entry[field.key], field.min, field.max);
      if (value !== undefined) cleaned[field.key] = value;
    }
    const notes = cleanText(entry.notes);
    if (notes) cleaned.notes = notes;

    // Пустой замер без веса и обхватов не нужен.
    if (cleaned.weightKg !== undefined || BODY_METRIC_KEYS.some((key) => cleaned[key] !== undefined)) {
      measurements.push(cleaned);
    }
  });

  return { heightCm: height, sex, avatarUrl, measurements };
}

/** Свежие замеры первыми. */
export function sortMeasurements(entries: BodyMeasurementEntry[]): BodyMeasurementEntry[] {
  return [...entries].sort((a, b) => {
    const byDate = String(b.date).localeCompare(String(a.date));
    if (byDate !== 0) return byDate;
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
}

export function latestMeasurement(profile: BodyProfile): BodyMeasurementEntry | null {
  return sortMeasurements(profile.measurements)[0] || null;
}

export function previousMeasurement(profile: BodyProfile): BodyMeasurementEntry | null {
  return sortMeasurements(profile.measurements)[1] || null;
}

export function measurementValue(entry: BodyMeasurementEntry | null, key: BodyMetricKey): number | undefined {
  if (!entry) return undefined;
  const value = entry[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function metricDelta(
  profile: BodyProfile,
  key: BodyMetricKey,
): { current?: number; previous?: number; delta?: number } {
  const current = measurementValue(latestMeasurement(profile), key);
  const previous = measurementValue(previousMeasurement(profile), key);
  return {
    current,
    previous,
    delta:
      current !== undefined && previous !== undefined
        ? Math.round((current - previous) * 10) / 10
        : undefined,
  };
}

export type TrendKey = BodyMetricKey | 'weightKg';

export interface TrendPoint {
  date: string;
  value: number;
}

export function measurementSeries(profile: BodyProfile, key: TrendKey): TrendPoint[] {
  return [...profile.measurements]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => {
      const raw = key === 'weightKg' ? entry.weightKg : entry[key];
      return typeof raw === 'number' && Number.isFinite(raw) ? { date: entry.date, value: raw } : null;
    })
    .filter((point): point is TrendPoint => point !== null);
}

export const BODY_TREND_OPTIONS: Array<{ key: TrendKey; label: string; unit: string }> = [
  { key: 'weightKg', label: 'Вес', unit: 'кг' },
  { key: 'waistCm', label: 'Талия', unit: 'см' },
  { key: 'chestCm', label: 'Грудь', unit: 'см' },
  { key: 'shouldersCm', label: 'Плечи', unit: 'см' },
  { key: 'hipsCm', label: 'Бёдра', unit: 'см' },
  { key: 'bicepLCm', label: 'Бицепс Л', unit: 'см' },
  { key: 'thighLCm', label: 'Бедро Л', unit: 'см' },
  { key: 'calfLCm', label: 'Голень Л', unit: 'см' },
];

/* ------------------------------------------------------------------ */
/* Пропорции и размеры                                                 */
/* ------------------------------------------------------------------ */

export const BODY_DRAW = {
  width: 320,
  height: 520,
  drawHeight: 440,
  hipX: 160,
  hipY: 266,
  soleY: 500,
} as const;

export interface BodyDimensions {
  heightCm: number;
  sex: 'male' | 'female';
  /** Пикселей модели на сантиметр. */
  scale: number;
  headHeightCm: number;
  headWidthCm: number;
  neckLengthCm: number;
  torsoLengthCm: number;
  thighLengthCm: number;
  shinLengthCm: number;
  footLengthCm: number;
  upperArmLengthCm: number;
  forearmLengthCm: number;
  shoulderWidthCm: number;
  chestWidthCm: number;
  waistWidthCm: number;
  hipWidthCm: number;
  chestDepthCm: number;
  waistDepthCm: number;
  neckWidthCm: number;
  upperArmWidthCm: number;
  forearmWidthCm: number;
  wristWidthCm: number;
  thighWidthCm: number;
  calfWidthCm: number;
  ankleWidthCm: number;
}

/**
 * Пропорции строятся от роста, а обхваты уточняют ширину плеч, груди,
 * талии и таза. Это схема для техники, а не антропометрический сканер.
 */
export function computeBodyDimensions(profile: BodyProfile): BodyDimensions {
  const latest = latestMeasurement(profile);
  const heightCm = profile.heightCm || 175;
  const sex = profile.sex || 'male';
  const scale = BODY_DRAW.drawHeight / heightCm;
  const shoulderFactor = sex === 'female' ? 0.23 : 0.245;

  const shoulderWidthCm = clampNumber(
    latest?.shouldersCm ? latest.shouldersCm * 0.36 : heightCm * shoulderFactor,
    28,
    66,
  );
  const chestWidthCm = clampNumber(
    latest?.chestCm ? latest.chestCm * 0.33 : shoulderWidthCm * 0.82,
    24,
    60,
  );
  const waistWidthCm = clampNumber(
    latest?.waistCm ? latest.waistCm * 0.31 : heightCm * 0.155,
    20,
    55,
  );
  const hipWidthCm = clampNumber(
    latest?.hipsCm ? latest.hipsCm * 0.34 : heightCm * 0.19,
    24,
    58,
  );
  const bicep = averagePair(latest?.bicepLCm, latest?.bicepRCm);
  const forearm = averagePair(latest?.forearmLCm, latest?.forearmRCm);
  const thigh = averagePair(latest?.thighLCm, latest?.thighRCm);
  const calf = averagePair(latest?.calfLCm, latest?.calfRCm);
  const wrist = averagePair(latest?.wristLCm, latest?.wristRCm);
  const ankle = averagePair(latest?.ankleLCm, latest?.ankleRCm);

  return {
    heightCm,
    sex,
    scale,
    headHeightCm: heightCm * 0.13,
    headWidthCm: heightCm * 0.13 * 0.72,
    neckLengthCm: heightCm * 0.03,
    torsoLengthCm: heightCm * 0.29,
    thighLengthCm: heightCm * 0.245,
    shinLengthCm: heightCm * 0.246,
    footLengthCm: heightCm * 0.12,
    upperArmLengthCm: heightCm * 0.17,
    forearmLengthCm: heightCm * 0.15,
    shoulderWidthCm,
    chestWidthCm,
    waistWidthCm,
    hipWidthCm,
    chestDepthCm: clampNumber(latest?.chestCm ? latest.chestCm * 0.22 : heightCm * 0.145, 16, 40),
    waistDepthCm: clampNumber(latest?.waistCm ? latest.waistCm * 0.2 : heightCm * 0.12, 12, 32),
    neckWidthCm: clampNumber(latest?.neckCm ? latest.neckCm * 0.34 : heightCm * 0.052, 9, 20),
    upperArmWidthCm: clampNumber(bicep ? bicep * 0.36 : heightCm * 0.057, 8, 20),
    forearmWidthCm: clampNumber(forearm ? forearm * 0.34 : heightCm * 0.043, 6, 15),
    wristWidthCm: clampNumber(wrist ? wrist * 0.42 : heightCm * 0.029, 4.5, 10),
    thighWidthCm: clampNumber(thigh ? thigh * 0.36 : heightCm * 0.092, 12, 30),
    calfWidthCm: clampNumber(calf ? calf * 0.35 : heightCm * 0.061, 8, 22),
    ankleWidthCm: clampNumber(ankle ? ankle * 0.48 : heightCm * 0.038, 5.5, 13),
  };
}

/* ------------------------------------------------------------------ */
/* Позы и геометрия                                                    */
/* ------------------------------------------------------------------ */

export interface Point {
  x: number;
  y: number;
}

export interface SidePose {
  /** Положение таза: его можно опустить и отвести назад, как в приседе. */
  hipX: number;
  hipY: number;
  torsoAngle: number;
  upperArmAngle: number;
  forearmAngle: number;
  thighAngle: number;
  shinAngle: number;
  footAngle: number;
}

export interface FrontPose {
  torsoAngle: number;
  leftUpperArmAngle: number;
  rightUpperArmAngle: number;
  leftForearmAngle: number;
  rightForearmAngle: number;
  leftThighAngle: number;
  rightThighAngle: number;
  leftShinAngle: number;
  rightShinAngle: number;
}

export interface BodyPose {
  side: SidePose;
  front: FrontPose;
}

export type SideSegmentKey = Exclude<keyof SidePose, 'hipX' | 'hipY'>;
export type FrontSegmentKey =
  | 'torsoAngle'
  | 'leftUpperArmAngle'
  | 'rightUpperArmAngle'
  | 'leftForearmAngle'
  | 'rightForearmAngle'
  | 'leftThighAngle'
  | 'rightThighAngle'
  | 'leftShinAngle'
  | 'rightShinAngle';
export type PoseSegmentKey = SideSegmentKey | FrontSegmentKey;

export const DEFAULT_SIDE_POSE: SidePose = {
  hipX: BODY_DRAW.hipX,
  hipY: BODY_DRAW.hipY,
  torsoAngle: -90,
  upperArmAngle: 90,
  forearmAngle: 90,
  thighAngle: 90,
  shinAngle: 90,
  footAngle: 0,
};

export const DEFAULT_FRONT_POSE: FrontPose = {
  torsoAngle: -90,
  leftUpperArmAngle: 90,
  rightUpperArmAngle: 90,
  leftForearmAngle: 90,
  rightForearmAngle: 90,
  leftThighAngle: 90,
  rightThighAngle: 90,
  leftShinAngle: 90,
  rightShinAngle: 90,
};

export function createDefaultPose(): BodyPose {
  return {
    side: { ...DEFAULT_SIDE_POSE },
    front: { ...DEFAULT_FRONT_POSE },
  };
}

export function normalizeAngle(value: number): number {
  if (!Number.isFinite(value)) return 0;
  let angle = value % 360;
  if (angle > 180) angle -= 360;
  if (angle <= -180) angle += 360;
  return angle;
}

export function roundAngle(value: number): number {
  return Math.round(normalizeAngle(value));
}

export function direction(angleDeg: number): Point {
  const radians = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

export function pointAlong(origin: Point, angleDeg: number, length: number): Point {
  const dir = direction(angleDeg);
  return { x: origin.x + dir.x * length, y: origin.y + dir.y * length };
}

/** Угол сгибания: 0 — сегменты на одной линии, 90 — прямой угол. */
export function bendFlex(parentAngle: number, childAngle: number): number {
  const back = normalizeAngle(parentAngle + 180);
  const diff = Math.abs(normalizeAngle(childAngle - back));
  return Math.round(180 - diff);
}

export function clampSegmentAngle(
  view: BodyView,
  segment: PoseSegmentKey,
  angle: number,
  pose?: BodyPose,
): number {
  const normalized = roundAngle(angle);
  if (view === 'side') {
    switch (segment as SideSegmentKey) {
      case 'torsoAngle':
        return clampNumber(normalized, -125, -30);
      case 'thighAngle':
        // Бедро может уйти назад примерно на 20° и вперёд до 120°.
        return clampNumber(normalized, -30, 110);
      case 'shinAngle': {
        // Колено не разгибается вперёд: считаем сгибание относительно бедра
        // и держим его в диапазоне 0–150°, как у живого сустава.
        const thigh = pose?.side.thighAngle ?? 90;
        const flex = clampNumber(normalizeAngle(normalized - thigh), 0, 150);
        return roundAngle(thigh + flex);
      }
      case 'upperArmAngle':
        // Плечо не уходит в бесконечное вращение за спину.
        return clampNumber(normalized, -115, 155);
      case 'forearmAngle': {
        // Локоть сгибается только в одну сторону: предплечье идёт кпереди
        // от плеча, а не выворачивается назад.
        const upperArm = pose?.side.upperArmAngle ?? 90;
        const flex = clampNumber(normalizeAngle(upperArm - normalized), 0, 150);
        return roundAngle(upperArm - flex);
      }
      case 'footAngle':
        return clampNumber(normalized, -40, 55);
      default:
        return normalized;
    }
  }
  switch (segment as FrontSegmentKey) {
    case 'torsoAngle':
      return clampNumber(normalized, -115, -65);
    case 'leftThighAngle':
    case 'rightThighAngle':
      return clampNumber(normalized, 45, 135);
    case 'leftShinAngle': {
      // В виде спереди колено не должно складываться вбок: допускаем
      // небольшой завал/разворот, а не произвольный угол.
      const thigh = pose?.front.leftThighAngle ?? 90;
      const valgus = clampNumber(normalizeAngle(normalized - thigh), -15, 15);
      return roundAngle(thigh + valgus);
    }
    case 'rightShinAngle': {
      const thigh = pose?.front.rightThighAngle ?? 90;
      const valgus = clampNumber(normalizeAngle(normalized - thigh), -15, 15);
      return roundAngle(thigh + valgus);
    }
    case 'leftUpperArmAngle':
      return clampNumber(normalized, -150, 160);
    case 'rightUpperArmAngle':
      return clampNumber(normalized, -160, 150);
    case 'leftForearmAngle': {
      // Левая рука сгибается к центру корпуса.
      const upperArm = pose?.front.leftUpperArmAngle ?? 90;
      const flex = clampNumber(normalizeAngle(normalized - upperArm), 0, 150);
      return roundAngle(upperArm + flex);
    }
    case 'rightForearmAngle': {
      // Правая — зеркально.
      const upperArm = pose?.front.rightUpperArmAngle ?? 90;
      const flex = clampNumber(normalizeAngle(upperArm - normalized), 0, 150);
      return roundAngle(upperArm - flex);
    }
    default:
      return normalized;
  }
}

export function updateSidePose(pose: SidePose, segment: SideSegmentKey, angle: number): SidePose {
  return { ...pose, [segment]: roundAngle(angle) };
}

export function updateFrontPose(pose: FrontPose, segment: FrontSegmentKey, angle: number): FrontPose {
  return { ...pose, [segment]: roundAngle(angle) };
}

/**
 * Поворот одного сегмента с «живой» цепочкой: плечо тянет за собой локоть,
 * бедро — голень, наклон корпуса — руки. Так конечности не выгибаются
 * в противоположную сторону при перетаскивании.
 */
export function rotateSideSegment(pose: SidePose, segment: SideSegmentKey, angle: number): SidePose {
  const bodyPose: BodyPose = { side: pose, front: DEFAULT_FRONT_POSE };
  const next = clampSegmentAngle('side', segment, angle, bodyPose);
  const delta = normalizeAngle(next - pose[segment]);
  const result: SidePose = { ...pose, [segment]: next };

  const rotateArm = (armDelta: number) => {
    const upperArm = clampSegmentAngle(
      'side',
      'upperArmAngle',
      roundAngle(result.upperArmAngle + armDelta),
      { side: result, front: DEFAULT_FRONT_POSE },
    );
    const actualDelta = normalizeAngle(upperArm - result.upperArmAngle);
    result.upperArmAngle = upperArm;
    result.forearmAngle = roundAngle(result.forearmAngle + actualDelta);
  };

  if (segment === 'torsoAngle') {
    rotateArm(delta);
  } else if (segment === 'upperArmAngle') {
    rotateArm(delta);
  } else if (segment === 'thighAngle') {
    result.shinAngle = roundAngle(result.shinAngle + delta);
  }

  if (segment === 'torsoAngle' || segment === 'upperArmAngle' || segment === 'forearmAngle') {
    result.forearmAngle = clampSegmentAngle('side', 'forearmAngle', result.forearmAngle, {
      side: result,
      front: DEFAULT_FRONT_POSE,
    });
  }
  if (segment === 'thighAngle' || segment === 'shinAngle') {
    result.shinAngle = clampSegmentAngle('side', 'shinAngle', result.shinAngle, {
      side: result,
      front: DEFAULT_FRONT_POSE,
    });
  }
  return result;
}

/** То же для вида спереди: руки и ноги двигаются вместе с родительским сегментом. */
export function rotateFrontSegment(pose: FrontPose, segment: FrontSegmentKey, angle: number): FrontPose {
  const bodyPose: BodyPose = { side: DEFAULT_SIDE_POSE, front: pose };
  const next = clampSegmentAngle('front', segment, angle, bodyPose);
  const delta = normalizeAngle(next - pose[segment]);
  const result: FrontPose = { ...pose, [segment]: next };

  if (segment === 'torsoAngle') {
    // Наклон корпуса во фронтальной проекции почти не используется, но
    // пусть руки следуют за плечами, а не остаются в воздухе.
    result.leftUpperArmAngle = roundAngle(result.leftUpperArmAngle + delta);
    result.rightUpperArmAngle = roundAngle(result.rightUpperArmAngle + delta);
    result.leftForearmAngle = roundAngle(result.leftForearmAngle + delta);
    result.rightForearmAngle = roundAngle(result.rightForearmAngle + delta);
  } else if (segment === 'leftUpperArmAngle') {
    result.leftForearmAngle = roundAngle(result.leftForearmAngle + delta);
  } else if (segment === 'rightUpperArmAngle') {
    result.rightForearmAngle = roundAngle(result.rightForearmAngle + delta);
  } else if (segment === 'leftThighAngle') {
    result.leftShinAngle = roundAngle(result.leftShinAngle + delta);
  } else if (segment === 'rightThighAngle') {
    result.rightShinAngle = roundAngle(result.rightShinAngle + delta);
  }

  result.leftUpperArmAngle = clampSegmentAngle('front', 'leftUpperArmAngle', result.leftUpperArmAngle, {
    side: DEFAULT_SIDE_POSE,
    front: result,
  });
  result.rightUpperArmAngle = clampSegmentAngle('front', 'rightUpperArmAngle', result.rightUpperArmAngle, {
    side: DEFAULT_SIDE_POSE,
    front: result,
  });
  result.leftForearmAngle = clampSegmentAngle('front', 'leftForearmAngle', result.leftForearmAngle, {
    side: DEFAULT_SIDE_POSE,
    front: result,
  });
  result.rightForearmAngle = clampSegmentAngle('front', 'rightForearmAngle', result.rightForearmAngle, {
    side: DEFAULT_SIDE_POSE,
    front: result,
  });
  result.leftShinAngle = clampSegmentAngle('front', 'leftShinAngle', result.leftShinAngle, {
    side: DEFAULT_SIDE_POSE,
    front: result,
  });
  result.rightShinAngle = clampSegmentAngle('front', 'rightShinAngle', result.rightShinAngle, {
    side: DEFAULT_SIDE_POSE,
    front: result,
  });
  return result;
}

export interface TwoBoneSolution {
  knee: Point;
  /** Абсолютные углы для отрисовки и метрик. */
  thighAngle: number;
  shinAngle: number;
}

/**
 * Двухзвенная IK для ноги: таз можно опустить, а стопа останется на месте.
 * Колено выбирается вперёд (в сторону +x), чтобы не было обратного изгиба.
 */
export function solveTwoBoneIK(
  hip: Point,
  ankle: Point,
  upperLength: number,
  lowerLength: number,
): TwoBoneSolution {
  const rawDx = ankle.x - hip.x;
  const rawDy = ankle.y - hip.y;
  const rawDistance = Math.hypot(rawDx, rawDy);
  const distance = clampNumber(rawDistance, Math.abs(upperLength - lowerLength) + 0.5, upperLength + lowerLength - 0.5);
  const ux = rawDistance > 0.001 ? rawDx / rawDistance : 0;
  const uy = rawDistance > 0.001 ? rawDy / rawDistance : 1;
  const along = (upperLength * upperLength - lowerLength * lowerLength + distance * distance) / (2 * distance);
  const base = { x: hip.x + ux * along, y: hip.y + uy * along };
  const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  let perpX = uy;
  let perpY = -ux;
  if (perpX < 0 || (Math.abs(perpX) < 0.001 && perpY > 0)) {
    perpX = -perpX;
    perpY = -perpY;
  }
  const knee = {
    x: base.x + perpX * height,
    y: base.y + perpY * height,
  };
  return {
    knee,
    thighAngle: roundAngle((Math.atan2(knee.y - hip.y, knee.x - hip.x) * 180) / Math.PI),
    shinAngle: roundAngle((Math.atan2(ankle.y - knee.y, ankle.x - knee.x) * 180) / Math.PI),
  };
}

/**
 * Таз двигается, стопа остаётся точкой опоры. Это превращает перетаскивание
 * в понятный присед: бёдра и колени сгибаются сами, без разрывов модели.
 */
export function dragSidePelvis(
  pose: SidePose,
  target: Point,
  plantedAnkle: Point,
  dims: BodyDimensions,
): SidePose {
  const upperLength = dims.thighLengthCm * dims.scale;
  const lowerLength = dims.shinLengthCm * dims.scale;
  const maxDistance = upperLength + lowerLength - 1;
  // При сгибании колена больше 150° нога выглядит сломанной.
  const minDistance = Math.max(
    Math.abs(upperLength - lowerLength) + 1,
    2 * Math.min(upperLength, lowerLength) * Math.sin((15 * Math.PI) / 180),
  );

  const x = clampNumber(target.x, plantedAnkle.x - 75, plantedAnkle.x + 75);
  const y = clampNumber(target.y, plantedAnkle.y - maxDistance, plantedAnkle.y - minDistance);
  let dx = x - plantedAnkle.x;
  let dy = y - plantedAnkle.y;
  let distance = Math.hypot(dx, dy);
  if (distance < 0.001) {
    dx = 0;
    dy = -minDistance;
    distance = minDistance;
  }
  const clampedDistance = clampNumber(distance, minDistance, maxDistance);
  const hip = {
    x: plantedAnkle.x + (dx / distance) * clampedDistance,
    y: plantedAnkle.y + (dy / distance) * clampedDistance,
  };
  const solution = solveTwoBoneIK(hip, plantedAnkle, upperLength, lowerLength);

  return {
    ...pose,
    hipX: Math.round(hip.x * 10) / 10,
    hipY: Math.round(hip.y * 10) / 10,
    thighAngle: solution.thighAngle,
    shinAngle: solution.shinAngle,
  };
}

export interface DrawSegment {
  id: string;
  a: Point;
  b: Point;
  width: number;
  kind: 'torso' | 'limb' | 'neck' | 'foot';
}

export interface DrawHandle {
  id: string;
  point: Point;
  pivot: Point;
  /** Для таза это режим перемещения, для остальных — поворот сегмента. */
  segment: PoseSegmentKey | 'pelvis';
  label: string;
  mode?: 'rotate' | 'move';
}

export interface SideGeometry {
  view: 'side';
  hip: Point;
  shoulder: Point;
  head: Point;
  elbow: Point;
  hand: Point;
  knee: Point;
  ankle: Point;
  toe: Point;
  heel: Point;
  headRadius: number;
  segments: DrawSegment[];
  handles: DrawHandle[];
}

export interface FrontGeometry {
  view: 'front';
  hipCenter: Point;
  shoulderCenter: Point;
  head: Point;
  leftShoulder: Point;
  rightShoulder: Point;
  leftHip: Point;
  rightHip: Point;
  leftElbow: Point;
  rightElbow: Point;
  leftHand: Point;
  rightHand: Point;
  leftKnee: Point;
  rightKnee: Point;
  leftAnkle: Point;
  rightAnkle: Point;
  headRadius: number;
  segments: DrawSegment[];
  handles: DrawHandle[];
}

export function buildSideGeometry(pose: SidePose, dims: BodyDimensions): SideGeometry {
  const s = dims.scale;
  const hip = { x: pose.hipX, y: pose.hipY };
  const shoulder = pointAlong(hip, pose.torsoAngle, dims.torsoLengthCm * s);
  const headRadius = (dims.headHeightCm * s) / 2;
  const head = pointAlong(shoulder, pose.torsoAngle, dims.neckLengthCm * s + headRadius);
  const elbow = pointAlong(shoulder, pose.upperArmAngle, dims.upperArmLengthCm * s);
  const hand = pointAlong(elbow, pose.forearmAngle, dims.forearmLengthCm * s);
  const knee = pointAlong(hip, pose.thighAngle, dims.thighLengthCm * s);
  const ankle = pointAlong(knee, pose.shinAngle, dims.shinLengthCm * s);
  const toe = pointAlong(ankle, pose.footAngle, dims.footLengthCm * s);
  const heel = pointAlong(ankle, pose.footAngle + 180, dims.footLengthCm * s * 0.34);

  const segments: DrawSegment[] = [
    { id: 'torso', a: hip, b: shoulder, width: 30, kind: 'torso' },
    { id: 'neck', a: shoulder, b: head, width: 14, kind: 'neck' },
    { id: 'upperArm', a: shoulder, b: elbow, width: 15, kind: 'limb' },
    { id: 'forearm', a: elbow, b: hand, width: 12, kind: 'limb' },
    { id: 'thigh', a: hip, b: knee, width: 23, kind: 'limb' },
    { id: 'shin', a: knee, b: ankle, width: 19, kind: 'limb' },
    { id: 'foot', a: heel, b: toe, width: 11, kind: 'foot' },
  ];

  const handles: DrawHandle[] = [
    {
      id: 'side-pelvis',
      point: hip,
      pivot: hip,
      segment: 'pelvis',
      mode: 'move',
      label: 'Таз и глубина приседа',
    },
    { id: 'side-shoulder', point: shoulder, pivot: hip, segment: 'torsoAngle', label: 'Наклон корпуса' },
    { id: 'side-elbow', point: elbow, pivot: shoulder, segment: 'upperArmAngle', label: 'Плечо' },
    { id: 'side-hand', point: hand, pivot: elbow, segment: 'forearmAngle', label: 'Локоть' },
    { id: 'side-knee', point: knee, pivot: hip, segment: 'thighAngle', label: 'Бедро' },
    { id: 'side-ankle', point: ankle, pivot: knee, segment: 'shinAngle', label: 'Колено' },
    { id: 'side-toe', point: toe, pivot: ankle, segment: 'footAngle', label: 'Стопа' },
  ];

  return { view: 'side', hip, shoulder, head, elbow, hand, knee, ankle, toe, heel, headRadius, segments, handles };
}

export function buildFrontGeometry(pose: FrontPose, dims: BodyDimensions): FrontGeometry {
  const s = dims.scale;
  const hipCenter = { x: BODY_DRAW.hipX, y: BODY_DRAW.hipY };
  const shoulderCenter = pointAlong(hipCenter, pose.torsoAngle, dims.torsoLengthCm * s);
  const shoulderHalf = (dims.shoulderWidthCm * s) / 2;
  const hipHalf = (dims.hipWidthCm * s) / 2;
  const headRadius = (dims.headHeightCm * s) / 2;
  const head = pointAlong(shoulderCenter, pose.torsoAngle, dims.neckLengthCm * s + headRadius);

  const leftShoulder = { x: shoulderCenter.x - shoulderHalf, y: shoulderCenter.y };
  const rightShoulder = { x: shoulderCenter.x + shoulderHalf, y: shoulderCenter.y };
  const leftHip = { x: hipCenter.x - hipHalf, y: hipCenter.y };
  const rightHip = { x: hipCenter.x + hipHalf, y: hipCenter.y };

  const leftElbow = pointAlong(leftShoulder, pose.leftUpperArmAngle, dims.upperArmLengthCm * s);
  const rightElbow = pointAlong(rightShoulder, pose.rightUpperArmAngle, dims.upperArmLengthCm * s);
  const leftHand = pointAlong(leftElbow, pose.leftForearmAngle, dims.forearmLengthCm * s);
  const rightHand = pointAlong(rightElbow, pose.rightForearmAngle, dims.forearmLengthCm * s);
  const leftKnee = pointAlong(leftHip, pose.leftThighAngle, dims.thighLengthCm * s);
  const rightKnee = pointAlong(rightHip, pose.rightThighAngle, dims.thighLengthCm * s);
  const leftAnkle = pointAlong(leftKnee, pose.leftShinAngle, dims.shinLengthCm * s);
  const rightAnkle = pointAlong(rightKnee, pose.rightShinAngle, dims.shinLengthCm * s);

  const segments: DrawSegment[] = [
    { id: 'torso', a: hipCenter, b: shoulderCenter, width: 34, kind: 'torso' },
    { id: 'neck', a: shoulderCenter, b: head, width: 15, kind: 'neck' },
    { id: 'leftUpperArm', a: leftShoulder, b: leftElbow, width: 14, kind: 'limb' },
    { id: 'rightUpperArm', a: rightShoulder, b: rightElbow, width: 14, kind: 'limb' },
    { id: 'leftForearm', a: leftElbow, b: leftHand, width: 11, kind: 'limb' },
    { id: 'rightForearm', a: rightElbow, b: rightHand, width: 11, kind: 'limb' },
    { id: 'leftThigh', a: leftHip, b: leftKnee, width: 22, kind: 'limb' },
    { id: 'rightThigh', a: rightHip, b: rightKnee, width: 22, kind: 'limb' },
    { id: 'leftShin', a: leftKnee, b: leftAnkle, width: 18, kind: 'limb' },
    { id: 'rightShin', a: rightKnee, b: rightAnkle, width: 18, kind: 'limb' },
    { id: 'leftFoot', a: leftAnkle, b: { x: leftAnkle.x - 7, y: leftAnkle.y + 9 }, width: 12, kind: 'foot' },
    { id: 'rightFoot', a: rightAnkle, b: { x: rightAnkle.x + 7, y: rightAnkle.y + 9 }, width: 12, kind: 'foot' },
  ];

  const handles: DrawHandle[] = [
    { id: 'front-shoulder', point: shoulderCenter, pivot: hipCenter, segment: 'torsoAngle', label: 'Наклон корпуса' },
    { id: 'front-left-elbow', point: leftElbow, pivot: leftShoulder, segment: 'leftUpperArmAngle', label: 'Левое плечо' },
    { id: 'front-right-elbow', point: rightElbow, pivot: rightShoulder, segment: 'rightUpperArmAngle', label: 'Правое плечо' },
    { id: 'front-left-hand', point: leftHand, pivot: leftElbow, segment: 'leftForearmAngle', label: 'Левый локоть' },
    { id: 'front-right-hand', point: rightHand, pivot: rightElbow, segment: 'rightForearmAngle', label: 'Правый локоть' },
    { id: 'front-left-knee', point: leftKnee, pivot: leftHip, segment: 'leftThighAngle', label: 'Левое бедро' },
    { id: 'front-right-knee', point: rightKnee, pivot: rightHip, segment: 'rightThighAngle', label: 'Правое бедро' },
    { id: 'front-left-ankle', point: leftAnkle, pivot: leftKnee, segment: 'leftShinAngle', label: 'Левое колено' },
    { id: 'front-right-ankle', point: rightAnkle, pivot: rightKnee, segment: 'rightShinAngle', label: 'Правое колено' },
  ];

  return {
    view: 'front',
    hipCenter,
    shoulderCenter,
    head,
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip,
    leftElbow,
    rightElbow,
    leftHand,
    rightHand,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle,
    headRadius,
    segments,
    handles,
  };
}

/* ------------------------------------------------------------------ */
/* Углы и проверка техники                                             */
/* ------------------------------------------------------------------ */

export type BodyMetricId =
  | 'side.torsoLean'
  | 'side.hipFlex'
  | 'side.kneeFlex'
  | 'side.elbowFlex'
  | 'side.shoulderFlex'
  | 'side.shoulderExtension'
  | 'front.torsoLean'
  | 'front.shoulderAbductionL'
  | 'front.shoulderAbductionR'
  | 'front.shoulderAbductionAbs'
  | 'front.elbowFlexL'
  | 'front.elbowFlexR'
  | 'front.kneeValgusL'
  | 'front.kneeValgusR'
  | 'front.kneeValgusAbs'
  | 'front.kneeAsym'
  | 'front.elbowAsym'
  | 'front.shoulderAsym'
  | 'front.forearmTiltAbs';

export type PoseMetrics = Record<BodyMetricId, number>;

export function computePoseMetrics(pose: BodyPose): PoseMetrics {
  const side = pose.side;
  const front = pose.front;
  const shoulderFlex = Math.round(90 - side.upperArmAngle);
  const shoulderAbductionL = Math.round(normalizeAngle(front.leftUpperArmAngle - 90));
  const shoulderAbductionR = Math.round(normalizeAngle(90 - front.rightUpperArmAngle));
  const elbowFlexL = bendFlex(front.leftUpperArmAngle, front.leftForearmAngle);
  const elbowFlexR = bendFlex(front.rightUpperArmAngle, front.rightForearmAngle);
  const kneeValgusL = Math.round(normalizeAngle(front.leftThighAngle - front.leftShinAngle));
  const kneeValgusR = Math.round(normalizeAngle(front.rightShinAngle - front.rightThighAngle));
  const kneeFlexL = Math.round(normalizeAngle(front.leftShinAngle - front.leftThighAngle));
  const kneeFlexR = Math.round(normalizeAngle(front.rightShinAngle - front.rightThighAngle));

  return {
    'side.torsoLean': Math.round(side.torsoAngle + 90),
    'side.hipFlex': Math.round(side.torsoAngle + 90 + (90 - side.thighAngle)),
    'side.kneeFlex': Math.round(normalizeAngle(side.shinAngle - side.thighAngle)),
    'side.elbowFlex': bendFlex(side.upperArmAngle, side.forearmAngle),
    'side.shoulderFlex': shoulderFlex,
    'side.shoulderExtension': Math.max(0, -shoulderFlex),
    'front.torsoLean': Math.round(front.torsoAngle + 90),
    'front.shoulderAbductionL': shoulderAbductionL,
    'front.shoulderAbductionR': shoulderAbductionR,
    'front.shoulderAbductionAbs': Math.max(Math.abs(shoulderAbductionL), Math.abs(shoulderAbductionR)),
    'front.elbowFlexL': elbowFlexL,
    'front.elbowFlexR': elbowFlexR,
    'front.kneeValgusL': kneeValgusL,
    'front.kneeValgusR': kneeValgusR,
    'front.kneeValgusAbs': Math.max(Math.abs(kneeValgusL), Math.abs(kneeValgusR)),
    'front.kneeAsym': Math.abs(kneeFlexL - kneeFlexR),
    'front.elbowAsym': Math.abs(elbowFlexL - elbowFlexR),
    'front.shoulderAsym': Math.abs(shoulderAbductionL - shoulderAbductionR),
    'front.forearmTiltAbs': Math.max(
      Math.abs(Math.round(normalizeAngle(front.leftForearmAngle - 90))),
      Math.abs(Math.round(normalizeAngle(front.rightForearmAngle - 90))),
    ),
  };
}

export const LIVE_METRICS: Array<{
  id: BodyMetricId;
  label: string;
  short: string;
  unit: string;
  view: BodyView;
}> = [
  { id: 'side.kneeFlex', label: 'Сгибание колена', short: 'Колено', unit: '°', view: 'side' },
  { id: 'side.hipFlex', label: 'Сгибание бедра', short: 'Бедро', unit: '°', view: 'side' },
  { id: 'side.torsoLean', label: 'Наклон корпуса', short: 'Корпус', unit: '°', view: 'side' },
  { id: 'side.elbowFlex', label: 'Сгибание локтя', short: 'Локоть', unit: '°', view: 'side' },
  { id: 'side.shoulderFlex', label: 'Подъём плеча', short: 'Плечо', unit: '°', view: 'side' },
  { id: 'front.kneeValgusAbs', label: 'Завал коленей', short: 'Колени', unit: '°', view: 'front' },
  { id: 'front.kneeAsym', label: 'Асимметрия коленей', short: 'Асимметрия', unit: '°', view: 'front' },
  { id: 'front.shoulderAbductionAbs', label: 'Отведение плеч', short: 'Плечи', unit: '°', view: 'front' },
];

export type JointKey = 'knee' | 'hip' | 'elbow' | 'shoulder' | 'spine' | 'ankle' | 'symmetry';
export type RuleSeverity = 'high' | 'medium' | 'low';

export interface ExerciseRule {
  metric: BodyMetricId;
  label: string;
  min: number;
  max: number;
  ideal: string;
  joint: JointKey;
  severity: RuleSeverity;
  advice: string;
}

export interface ExercisePreset {
  id: string;
  name: string;
  focus: string;
  view: BodyView;
  checkpoint: string;
  cue: string;
  side: SidePose;
  front: FrontPose;
  rules: ExerciseRule[];
}

const side = (patch: Partial<SidePose>): SidePose => ({ ...DEFAULT_SIDE_POSE, ...patch });
const front = (patch: Partial<FrontPose>): FrontPose => ({ ...DEFAULT_FRONT_POSE, ...patch });

/** Компактная запись правила, чтобы пресеты читались как таблица. */
const rule = (
  metric: BodyMetricId,
  label: string,
  min: number,
  max: number,
  ideal: string,
  joint: JointKey,
  severity: RuleSeverity,
  advice: string,
): ExerciseRule => ({ metric, label, min, max, ideal, joint, severity, advice });

export const EXERCISE_PRESETS: ExercisePreset[] = [
  {
    id: 'squat',
    name: 'Присед со штангой',
    focus: 'Квадрицепс, ягодицы, кор',
    view: 'side',
    checkpoint: 'Нижняя точка, бёдра около параллели',
    cue: 'Тяни таз вниз, колени по направлению стоп. Корпус наклоняется, но не складывается.',
    // Таз отведён назад и опущен, стопа стоит на полу: это настоящий присед,
    // а не «сидение в воздухе» с неподвижным тазом.
    side: side({
      hipX: 108,
      hipY: 370,
      torsoAngle: -65,
      upperArmAngle: 20,
      forearmAngle: -70,
      thighAngle: 10,
      shinAngle: 120,
      footAngle: 0,
    }),
    front: front({
      leftUpperArmAngle: 105,
      rightUpperArmAngle: 75,
      leftForearmAngle: 165,
      rightForearmAngle: 15,
      leftThighAngle: 96,
      rightThighAngle: 84,
      leftShinAngle: 96,
      rightShinAngle: 84,
    }),
    rules: [
      rule('side.kneeFlex', 'Глубина по колену', 75, 125, '90–110°', 'knee', 'high', 'Колено согнуто недостаточно глубоко или чрезмерно.'),
      rule('side.hipFlex', 'Сгибание бедра', 80, 135, '95–120°', 'hip', 'high', 'Таз не доходит до нужной глубины либо проваливается слишком низко.'),
      rule('side.torsoLean', 'Наклон корпуса', 10, 45, '20–35°', 'spine', 'high', 'Слишком сильный наклон переносит нагрузку на поясницу.'),
      rule('front.kneeValgusAbs', 'Колени без завала внутрь', 0, 10, '0–7°', 'knee', 'high', 'Разведите колени по направлению стоп.'),
      rule('front.kneeAsym', 'Симметрия коленей', 0, 10, '0–7°', 'knee', 'medium', 'Одна нога уходит вперёд или в сторону сильнее другой.'),
    ],
  },
  {
    id: 'deadlift',
    name: 'Становая тяга',
    focus: 'Задняя цепь, спина, ягодицы',
    view: 'side',
    checkpoint: 'Старт: штанга у голени, спина нейтральна',
    cue: 'Тянись грудью вперёд, а тазом назад. Руки прямые, гриф близко к ногам.',
    side: side({
      hipX: 132,
      hipY: 270,
      torsoAngle: -45,
      upperArmAngle: 90,
      forearmAngle: 90,
      thighAngle: 75,
      shinAngle: 90,
      footAngle: 0,
    }),
    front: front({
      leftUpperArmAngle: 95,
      rightUpperArmAngle: 85,
      leftForearmAngle: 95,
      rightForearmAngle: 85,
      leftThighAngle: 92,
      rightThighAngle: 88,
      leftShinAngle: 92,
      rightShinAngle: 88,
    }),
    rules: [
      rule('side.hipFlex', 'Сгибание бедра', 35, 85, '50–75°', 'hip', 'high', 'Таз слишком высоко или слишком низко для старта.'),
      rule('side.kneeFlex', 'Сгибание колена', 5, 55, '15–40°', 'knee', 'medium', 'Колени либо полностью прямые, либо согнуты как в приседе.'),
      rule('side.torsoLean', 'Наклон корпуса', 25, 65, '35–55°', 'spine', 'high', 'Чрезмерный наклон повышает нагрузку на поясницу.'),
      rule('side.elbowFlex', 'Прямые руки', 0, 25, '0–15°', 'elbow', 'medium', 'Не сгибайте руки — это отнимает силу у спины.'),
      rule('front.kneeValgusAbs', 'Колени без завала внутрь', 0, 10, '0–7°', 'knee', 'high', 'Толкайте колени наружу, стопы стабильно.'),
    ],
  },
  {
    id: 'dips',
    name: 'Отжимания на брусьях',
    focus: 'Грудь, трицепс, плечи',
    view: 'side',
    checkpoint: 'Нижняя точка, плечи ниже локтей',
    cue: 'Опускайтесь до комфортной глубины, локти идут назад, корпус не раскачивается.',
    side: side({ torsoAngle: -80, upperArmAngle: 150, forearmAngle: 60, thighAngle: 88, shinAngle: 95, footAngle: 0 }),
    front: front({
      leftUpperArmAngle: 105,
      rightUpperArmAngle: 75,
      leftForearmAngle: 105,
      rightForearmAngle: 75,
      leftThighAngle: 92,
      rightThighAngle: 88,
      leftShinAngle: 92,
      rightShinAngle: 88,
    }),
    rules: [
      rule('side.elbowFlex', 'Глубина по локтю', 70, 100, '80–95°', 'elbow', 'high', 'Слишком мелкая или чрезмерно глубокая амплитуда.'),
      rule('side.shoulderExtension', 'Разгибание плеча', 20, 75, '30–60°', 'shoulder', 'high', 'Плечи уходят слишком далеко назад — риск для передней части сустава.'),
      rule('side.torsoLean', 'Наклон корпуса', 0, 30, '5–20°', 'spine', 'medium', 'Корпус раскачивается вместо стабильного опускания.'),
      rule('front.shoulderAbductionAbs', 'Локти без разворота', 0, 45, '0–35°', 'shoulder', 'medium', 'Не разводите локти широко в стороны.'),
      rule('front.elbowAsym', 'Симметрия рук', 0, 10, '0–7°', 'elbow', 'medium', 'Одна рука сгибается заметно сильнее — проверьте симметрию.'),
    ],
  },
  {
    id: 'pullup',
    name: 'Подтягивания',
    focus: 'Широчайшие, бицепс, кор',
    view: 'side',
    checkpoint: 'Верхняя точка, подбородок над перекладиной',
    cue: 'Тяните локти вниз к рёбрам, не тянитесь шеей. Корпус остаётся почти вертикальным.',
    side: side({ torsoAngle: -88, upperArmAngle: 39, forearmAngle: -101, thighAngle: 90, shinAngle: 115, footAngle: 0 }),
    front: front({
      leftUpperArmAngle: 135,
      rightUpperArmAngle: 45,
      leftForearmAngle: 135,
      rightForearmAngle: 45,
      leftThighAngle: 92,
      rightThighAngle: 88,
      leftShinAngle: 92,
      rightShinAngle: 88,
    }),
    rules: [
      rule('side.elbowFlex', 'Сгибание локтя', 90, 155, '110–140°', 'elbow', 'high', 'Подтягивание не доходит до верха или локоть пересогнут.'),
      rule('side.shoulderFlex', 'Положение плеча', -20, 60, '10–45°', 'shoulder', 'medium', 'Плечо уходит в слишком высокое положение — включите широчайшие.'),
      rule('side.torsoLean', 'Корпус без раскачки', 0, 20, '0–12°', 'spine', 'medium', 'Избегайте маха корпусом и рывков.'),
      rule('front.shoulderAbductionAbs', 'Локти по направлению к корпусу', 15, 75, '25–55°', 'shoulder', 'medium', 'Широко разведённые локти смещают нагрузку на плечи.'),
      rule('front.elbowAsym', 'Симметрия рук', 0, 10, '0–7°', 'elbow', 'medium', 'Одна рука тянет сильнее — добавьте одностороннюю работу.'),
    ],
  },
  {
    id: 'overhead',
    name: 'Жим над головой',
    focus: 'Плечи, трицепс, кор',
    view: 'side',
    checkpoint: 'Верхняя точка, руки над плечами',
    cue: 'Ребра вниз, поясница не прогибается. Штанга идёт по дуге над серединой стопы.',
    side: side({ torsoAngle: -88, upperArmAngle: -85, forearmAngle: -85, thighAngle: 90, shinAngle: 90, footAngle: 0 }),
    front: front({
      leftUpperArmAngle: -100,
      rightUpperArmAngle: -80,
      leftForearmAngle: -100,
      rightForearmAngle: -80,
      leftThighAngle: 92,
      rightThighAngle: 88,
      leftShinAngle: 92,
      rightShinAngle: 88,
    }),
    rules: [
      rule('side.shoulderFlex', 'Подъём плеча', 150, 185, '165–180°', 'shoulder', 'high', 'Руки не выходят в полную амплитуду над головой.'),
      rule('side.elbowFlex', 'Выпрямление локтя', 0, 25, '0–12°', 'elbow', 'high', 'Локти остаются согнутыми в верхней точке.'),
      rule('side.torsoLean', 'Корпус без прогиба', 0, 15, '0–8°', 'spine', 'high', 'Прогиб в пояснице переносит нагрузку на спину.'),
      rule('front.elbowAsym', 'Симметрия рук', 0, 10, '0–7°', 'elbow', 'medium', 'Одна рука выпрямляется позже другой.'),
      rule('front.shoulderAsym', 'Симметрия плеч', 0, 12, '0–8°', 'shoulder', 'medium', 'Плечи поднимаются неравномерно.'),
    ],
  },
  {
    id: 'bench',
    name: 'Жим лёжа',
    focus: 'Грудь, трицепс, плечи',
    view: 'front',
    checkpoint: 'Низ: гриф у груди, лопатки сведены',
    cue: 'Локти под углом около 45–60°, предплечья ближе к вертикали. Схема показывает углы, а не положение на скамье.',
    side: side({ torsoAngle: -80, upperArmAngle: 20, forearmAngle: -70, thighAngle: 90, shinAngle: 90, footAngle: 0 }),
    front: front({
      leftUpperArmAngle: 140,
      rightUpperArmAngle: 40,
      leftForearmAngle: -150,
      rightForearmAngle: -30,
      leftThighAngle: 92,
      rightThighAngle: 88,
      leftShinAngle: 92,
      rightShinAngle: 88,
    }),
    rules: [
      rule('side.elbowFlex', 'Сгибание локтя', 65, 105, '75–95°', 'elbow', 'high', 'Локоть уходит слишком глубоко или не доходит до низа.'),
      rule('side.shoulderFlex', 'Положение плеча', 50, 95, '60–85°', 'shoulder', 'high', 'Плечо поднято слишком высоко к голове.'),
      rule('front.shoulderAbductionAbs', 'Угол локтей к корпусу', 30, 85, '45–70°', 'shoulder', 'high', 'Не разводите локти в стороны под прямым углом.'),
      rule('front.elbowFlexL', 'Сгибание левого локтя', 55, 105, '70–95°', 'elbow', 'medium', 'Левая рука работает в другой амплитуде.'),
      rule('front.elbowFlexR', 'Сгибание правого локтя', 55, 105, '70–95°', 'elbow', 'medium', 'Правая рука работает в другой амплитуде.'),
      rule('front.elbowAsym', 'Симметрия рук', 0, 10, '0–7°', 'elbow', 'medium', 'Проверьте равномерность жима и положение грифа.'),
    ],
  },
  {
    id: 'row',
    name: 'Тяга штанги в наклоне',
    focus: 'Спина, широчайшие, бицепс',
    view: 'side',
    checkpoint: 'Середина тяги, локоть согнут',
    cue: 'Корпус зафиксирован, тяните локти назад к поясу, не выпрямляйте спину рывком.',
    side: side({ torsoAngle: -55, upperArmAngle: 120, forearmAngle: 30, thighAngle: 80, shinAngle: 90, footAngle: 0 }),
    front: front({
      leftUpperArmAngle: 95,
      rightUpperArmAngle: 85,
      leftForearmAngle: 95,
      rightForearmAngle: 85,
      leftThighAngle: 92,
      rightThighAngle: 88,
      leftShinAngle: 92,
      rightShinAngle: 88,
    }),
    rules: [
      rule('side.torsoLean', 'Наклон корпуса', 20, 55, '30–45°', 'spine', 'high', 'Корпус слишком вертикален или сложен слишком сильно.'),
      rule('side.hipFlex', 'Сгибание бедра', 25, 80, '35–60°', 'hip', 'medium', 'Таз уходит из стабильного положения.'),
      rule('side.kneeFlex', 'Мягкие колени', 5, 40, '10–25°', 'knee', 'medium', 'Колени полностью прямые — добавьте мягкое сгибание.'),
      rule('side.elbowFlex', 'Сгибание локтя', 60, 110, '75–95°', 'elbow', 'high', 'Тяга выполняется руками, а не спиной, или локоть не доходит.'),
      rule('front.kneeValgusAbs', 'Колени без завала внутрь', 0, 10, '0–7°', 'knee', 'medium', 'Держите колени по направлению стоп.'),
    ],
  },
  {
    id: 'lunge',
    name: 'Выпад',
    focus: 'Квадрицепс, ягодицы, баланс',
    view: 'side',
    checkpoint: 'Нижняя точка, переднее колено над стопой',
    cue: 'Держите корпус вертикально, переднее колено не уходит далеко за носок. Схема показывает переднюю ногу.',
    side: side({
      hipX: 108,
      hipY: 380,
      torsoAngle: -88,
      upperArmAngle: 90,
      forearmAngle: 90,
      thighAngle: 10,
      shinAngle: 120,
      footAngle: 0,
    }),
    front: front({
      leftThighAngle: 98,
      rightThighAngle: 82,
      leftShinAngle: 98,
      rightShinAngle: 82,
      leftUpperArmAngle: 90,
      rightUpperArmAngle: 90,
      leftForearmAngle: 90,
      rightForearmAngle: 90,
    }),
    rules: [
      rule('side.hipFlex', 'Глубина выпада', 80, 130, '95–115°', 'hip', 'high', 'Выпад слишком мелкий или таз проваливается вниз.'),
      rule('side.kneeFlex', 'Сгибание переднего колена', 70, 110, '80–100°', 'knee', 'high', 'Переднее колено сгибается недостаточно или слишком сильно.'),
      rule('side.torsoLean', 'Вертикальный корпус', 0, 20, '0–12°', 'spine', 'medium', 'Наклон корпуса вперёд усложняет баланс.'),
      rule('front.kneeValgusAbs', 'Колени без завала внутрь', 0, 12, '0–8°', 'knee', 'high', 'Колено передней ноги уходит внутрь.'),
      rule('front.kneeAsym', 'Симметрия ног', 0, 12, '0–8°', 'knee', 'medium', 'Проверьте, одинаково ли работают обе ноги.'),
    ],
  },
];

export function exerciseById(id: string): ExercisePreset | undefined {
  return EXERCISE_PRESETS.find((preset) => preset.id === id);
}

export function poseForExercise(preset: ExercisePreset): BodyPose {
  return {
    side: { ...preset.side },
    front: { ...preset.front },
  };
}

/* ------------------------------------------------------------------ */
/* Симуляция упражнения и расчёт нагрузки                              */
/* ------------------------------------------------------------------ */

export type LoadJoint = 'hip' | 'knee' | 'spine' | 'shoulder' | 'elbow' | 'ankle';
export type LoadLevel = 'low' | 'moderate' | 'high' | 'veryHigh';

export interface SimulationExercise {
  id: string;
  presetId: string;
  name: string;
  focus: string;
  view: BodyView;
  equipment: 'barbell' | 'dumbbell' | 'bodyweight';
  /** Верхняя точка амплитуды. */
  start: BodyPose;
  /** Нижняя/конечная точка амплитуды. */
  end: BodyPose;
  /** Стопа остаётся на полу, а колено решается через IK. */
  plantedFoot: boolean;
  /** Какая доля массы тела работает как внешняя нагрузка (подтягивания, брусья). */
  bodyweightLoad: number;
  joints: LoadJoint[];
  cue: string;
  phaseLabels: [string, string];
}

export interface JointLoad {
  joint: LoadJoint;
  label: string;
  muscles: string;
  torqueNm: number;
  index: number;
  level: LoadLevel;
}

export interface SimulationSeriesPoint {
  phase: number;
  loads: JointLoad[];
  maxIndex: number;
  peakJoint: LoadJoint;
}

export interface SimulationScan {
  loads: JointLoad[];
  peakIndex: number;
  peakJoint: LoadJoint;
  level: LoadLevel;
  cautionFromKg: number | null;
  unsafeFromKg: number | null;
  safeWeightKg: number | null;
  safeAmplitude: number;
}

const LOAD_META: Record<LoadJoint, { label: string; muscles: string }> = {
  hip: { label: 'Тазобедренный', muscles: 'ягодицы · бицепс бедра' },
  knee: { label: 'Коленный', muscles: 'квадрицепс' },
  spine: { label: 'Поясница', muscles: 'разгибатели спины' },
  shoulder: { label: 'Плечевой', muscles: 'дельты · вращательная манжета' },
  elbow: { label: 'Локтевой', muscles: 'бицепс · трицепс' },
  ankle: { label: 'Голеностоп', muscles: 'икры · ахилл' },
};

const LOAD_LEVEL_LABEL: Record<LoadLevel, string> = {
  low: 'низкая',
  moderate: 'умеренная',
  high: 'высокая',
  veryHigh: 'очень высокая',
};

export const LOAD_LEVEL_COLOR: Record<LoadLevel, string> = {
  low: '#34d399',
  moderate: '#fbbf24',
  high: '#fb923c',
  veryHigh: '#fb7185',
};

export function loadLevelLabel(level: LoadLevel): string {
  return LOAD_LEVEL_LABEL[level];
}

export function loadLevel(index: number): LoadLevel {
  if (index < 0.18) return 'low';
  if (index < 0.3) return 'moderate';
  if (index < 0.42) return 'high';
  return 'veryHigh';
}
const simulationStart = (
  sidePatch: Partial<SidePose> = {},
  frontPatch: Partial<FrontPose> = {},
): BodyPose => ({
  side: { ...DEFAULT_SIDE_POSE, ...sidePatch },
  front: { ...DEFAULT_FRONT_POSE, ...frontPatch },
});

const presetFor = (id: string): ExercisePreset => {
  const preset = exerciseById(id);
  if (!preset) throw new Error(`Не найдено упражнение ${id}`);
  return preset;
};

/**
 * Верхняя и нижняя позы для анимации. Для упражнений со стопой на полу
 * нижняя точка решается через IK, поэтому стопа не уезжает с пола.
 */
export const SIMULATION_EXERCISES: SimulationExercise[] = [
  {
    id: 'squat',
    presetId: 'squat',
    name: presetFor('squat').name,
    focus: presetFor('squat').focus,
    view: 'side',
    equipment: 'barbell',
    start: simulationStart(),
    end: poseForExercise(presetFor('squat')),
    plantedFoot: true,
    bodyweightLoad: 0,
    joints: ['hip', 'knee', 'spine'],
    cue: presetFor('squat').cue,
    phaseLabels: ['Стоя', 'Низ'],
  },
  {
    id: 'deadlift',
    presetId: 'deadlift',
    name: presetFor('deadlift').name,
    focus: presetFor('deadlift').focus,
    view: 'side',
    equipment: 'barbell',
    start: simulationStart(),
    end: poseForExercise(presetFor('deadlift')),
    plantedFoot: true,
    bodyweightLoad: 0,
    joints: ['hip', 'knee', 'spine'],
    cue: presetFor('deadlift').cue,
    phaseLabels: ['Стоя', 'Старт'],
  },
  {
    id: 'overhead',
    presetId: 'overhead',
    name: presetFor('overhead').name,
    focus: presetFor('overhead').focus,
    view: 'side',
    equipment: 'barbell',
    start: simulationStart({ upperArmAngle: 40, forearmAngle: -80 }),
    end: poseForExercise(presetFor('overhead')),
    plantedFoot: true,
    bodyweightLoad: 0,
    joints: ['shoulder', 'elbow', 'spine'],
    cue: presetFor('overhead').cue,
    phaseLabels: ['У плеч', 'Над головой'],
  },
  {
    id: 'row',
    presetId: 'row',
    name: presetFor('row').name,
    focus: presetFor('row').focus,
    view: 'side',
    equipment: 'barbell',
    start: simulationStart({
      torsoAngle: -55,
      upperArmAngle: 90,
      forearmAngle: 90,
      thighAngle: 80,
      shinAngle: 90,
    }),
    end: poseForExercise(presetFor('row')),
    plantedFoot: true,
    bodyweightLoad: 0,
    joints: ['shoulder', 'elbow', 'spine'],
    cue: presetFor('row').cue,
    phaseLabels: ['Руки вниз', 'Локоть у пояса'],
  },
  {
    id: 'lunge',
    presetId: 'lunge',
    name: presetFor('lunge').name,
    focus: presetFor('lunge').focus,
    view: 'side',
    equipment: 'dumbbell',
    start: simulationStart(),
    end: poseForExercise(presetFor('lunge')),
    plantedFoot: true,
    bodyweightLoad: 0,
    joints: ['hip', 'knee', 'spine'],
    cue: presetFor('lunge').cue,
    phaseLabels: ['Стоя', 'Низ'],
  },
  {
    id: 'dips',
    presetId: 'dips',
    name: presetFor('dips').name,
    focus: presetFor('dips').focus,
    view: 'side',
    equipment: 'bodyweight',
    start: simulationStart({
      torsoAngle: -85,
      upperArmAngle: 90,
      forearmAngle: 90,
      thighAngle: 90,
      shinAngle: 95,
    }),
    end: poseForExercise(presetFor('dips')),
    plantedFoot: false,
    bodyweightLoad: 1,
    joints: ['shoulder', 'elbow'],
    cue: presetFor('dips').cue,
    phaseLabels: ['Верх', 'Низ'],
  },
  {
    id: 'pullup',
    presetId: 'pullup',
    name: presetFor('pullup').name,
    focus: presetFor('pullup').focus,
    view: 'side',
    equipment: 'bodyweight',
    start: simulationStart({
      torsoAngle: -88,
      upperArmAngle: -90,
      forearmAngle: -90,
      thighAngle: 90,
      shinAngle: 110,
    }),
    end: poseForExercise(presetFor('pullup')),
    plantedFoot: false,
    bodyweightLoad: 1,
    joints: ['shoulder', 'elbow'],
    cue: presetFor('pullup').cue,
    phaseLabels: ['Вис', 'Верх'],
  },
  {
    id: 'bench',
    presetId: 'bench',
    name: presetFor('bench').name,
    focus: presetFor('bench').focus,
    view: 'front',
    equipment: 'barbell',
    start: simulationStart(
      {},
      {
        leftUpperArmAngle: -90,
        rightUpperArmAngle: -90,
        leftForearmAngle: -90,
        rightForearmAngle: -90,
      },
    ),
    end: poseForExercise(presetFor('bench')),
    plantedFoot: false,
    bodyweightLoad: 0,
    joints: ['shoulder', 'elbow'],
    cue: presetFor('bench').cue,
    phaseLabels: ['Руки прямые', 'Гриф у груди'],
  },
];

export function simulationById(id: string): SimulationExercise | undefined {
  return SIMULATION_EXERCISES.find((exercise) => exercise.id === id);
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Поза на выбранной фазе амплитуды: 0 — верх, 1 — низ. */
export function simulationPose(
  exercise: SimulationExercise,
  phase: number,
  dims: BodyDimensions,
): BodyPose {
  const t = clampNumber(phase, 0, 1);
  const side: SidePose = {
    hipX: lerp(exercise.start.side.hipX, exercise.end.side.hipX, t),
    hipY: lerp(exercise.start.side.hipY, exercise.end.side.hipY, t),
    torsoAngle: roundAngle(lerp(exercise.start.side.torsoAngle, exercise.end.side.torsoAngle, t)),
    upperArmAngle: roundAngle(lerp(exercise.start.side.upperArmAngle, exercise.end.side.upperArmAngle, t)),
    forearmAngle: roundAngle(lerp(exercise.start.side.forearmAngle, exercise.end.side.forearmAngle, t)),
    thighAngle: roundAngle(lerp(exercise.start.side.thighAngle, exercise.end.side.thighAngle, t)),
    shinAngle: roundAngle(lerp(exercise.start.side.shinAngle, exercise.end.side.shinAngle, t)),
    footAngle: roundAngle(lerp(exercise.start.side.footAngle, exercise.end.side.footAngle, t)),
  };
  const front: FrontPose = {
    torsoAngle: roundAngle(lerp(exercise.start.front.torsoAngle, exercise.end.front.torsoAngle, t)),
    leftUpperArmAngle: roundAngle(
      lerp(exercise.start.front.leftUpperArmAngle, exercise.end.front.leftUpperArmAngle, t),
    ),
    rightUpperArmAngle: roundAngle(
      lerp(exercise.start.front.rightUpperArmAngle, exercise.end.front.rightUpperArmAngle, t),
    ),
    leftForearmAngle: roundAngle(
      lerp(exercise.start.front.leftForearmAngle, exercise.end.front.leftForearmAngle, t),
    ),
    rightForearmAngle: roundAngle(
      lerp(exercise.start.front.rightForearmAngle, exercise.end.front.rightForearmAngle, t),
    ),
    leftThighAngle: roundAngle(
      lerp(exercise.start.front.leftThighAngle, exercise.end.front.leftThighAngle, t),
    ),
    rightThighAngle: roundAngle(
      lerp(exercise.start.front.rightThighAngle, exercise.end.front.rightThighAngle, t),
    ),
    leftShinAngle: roundAngle(
      lerp(exercise.start.front.leftShinAngle, exercise.end.front.leftShinAngle, t),
    ),
    rightShinAngle: roundAngle(
      lerp(exercise.start.front.rightShinAngle, exercise.end.front.rightShinAngle, t),
    ),
  };

  // Стопа стоит на полу: колено и голень считаем через IK, а не просто
  // линейно поворачиваем — иначе на середине приседа стопа уходит под пол.
  // Опорная точка берётся из верхней позы, поэтому стопа не смещается за цикл.
  if (exercise.plantedFoot && exercise.view === 'side') {
    const planted = buildSideGeometry(exercise.start.side, dims).ankle;
    const ik = solveTwoBoneIK(
      { x: side.hipX, y: side.hipY },
      planted,
      dims.thighLengthCm * dims.scale,
      dims.shinLengthCm * dims.scale,
    );
    side.thighAngle = ik.thighAngle;
    side.shinAngle = ik.shinAngle;
  }

  return { side, front };
}

/**
 * Упрощённая оценка моментов в суставах по 2D-проекции. Это не обратная
 * динамика и не медицинский вывод: модель сравнивает позы и вес между собой.
 */
export function estimateSimulationLoads(
  exercise: SimulationExercise,
  pose: BodyPose,
  dims: BodyDimensions,
  bodyWeightKg: number,
  addedWeightKg: number,
): JointLoad[] {
  const bodyWeight = bodyWeightKg > 0 ? bodyWeightKg : 75;
  const added = Math.max(0, Number.isFinite(addedWeightKg) ? addedWeightKg : 0);
  const external = added + exercise.bodyweightLoad * bodyWeight;
  const side = buildSideGeometry(pose.side, dims);
  const front = buildFrontGeometry(pose.front, dims);
  const scale = dims.scale;
  const heightM = dims.heightCm / 100;
  const gravity = 9.81;
  const normalizer = bodyWeight * gravity * heightM;
  const horizontal = (a: Point, b: Point): number => Math.abs(a.x - b.x) / scale / 100;

  const make = (joint: LoadJoint, leverM: number, massKg: number): JointLoad => {
    const torqueNm = Math.max(0, massKg * gravity * leverM);
    const index = torqueNm / normalizer;
    return {
      joint,
      label: LOAD_META[joint].label,
      muscles: LOAD_META[joint].muscles,
      torqueNm: Math.round(torqueNm),
      index: Math.round(index * 1000) / 1000,
      level: loadLevel(index),
    };
  };

  return exercise.joints.map((joint) => {
    if (exercise.view === 'front') {
      if (joint === 'shoulder') {
        const lever = Math.max(
          horizontal(front.leftShoulder, front.leftHand),
          horizontal(front.rightShoulder, front.rightHand),
        );
        return make(joint, lever, external + bodyWeight * 0.08);
      }
      if (joint === 'elbow') {
        const lever = Math.max(
          horizontal(front.leftElbow, front.leftHand),
          horizontal(front.rightElbow, front.rightHand),
        );
        return make(joint, lever, external + bodyWeight * 0.03);
      }
      if (joint === 'knee') {
        const lever = Math.max(
          horizontal(front.leftKnee, front.leftAnkle),
          horizontal(front.rightKnee, front.rightAnkle),
        );
        return make(joint, lever, external + bodyWeight);
      }
      if (joint === 'hip') {
        const lever = Math.max(
          horizontal(front.leftHip, front.leftKnee),
          horizontal(front.rightHip, front.rightKnee),
        );
        return make(joint, lever, external + bodyWeight * 0.45);
      }
    }

    if (joint === 'hip') {
      return make(joint, horizontal(side.hip, side.shoulder), external + bodyWeight * 0.45);
    }
    if (joint === 'knee') {
      return make(joint, horizontal(side.knee, side.ankle), external + bodyWeight);
    }
    if (joint === 'spine') {
      const lever = Math.max(
        horizontal(side.hip, side.shoulder),
        horizontal(side.hip, side.hand) * 0.7,
      );
      return make(joint, lever, external + bodyWeight * 0.35);
    }
    if (joint === 'shoulder') {
      return make(joint, horizontal(side.shoulder, side.hand), external + bodyWeight * 0.08);
    }
    if (joint === 'elbow') {
      return make(joint, horizontal(side.elbow, side.hand), external + bodyWeight * 0.03);
    }
    return make(joint, horizontal(side.ankle, side.toe), external + bodyWeight);
  });
}

export function simulationSeries(
  exercise: SimulationExercise,
  dims: BodyDimensions,
  bodyWeightKg: number,
  addedWeightKg: number,
  steps = 21,
): SimulationSeriesPoint[] {
  const count = Math.max(2, Math.round(steps));
  return Array.from({ length: count }, (_, index) => {
    const phase = index / (count - 1);
    const loads = estimateSimulationLoads(
      exercise,
      simulationPose(exercise, phase, dims),
      dims,
      bodyWeightKg,
      addedWeightKg,
    );
    let peakJoint: LoadJoint = exercise.joints[0] || 'knee';
    let maxIndex = 0;
    for (const load of loads) {
      if (load.index > maxIndex) {
        maxIndex = load.index;
        peakJoint = load.joint;
      }
    }
    return { phase, loads, maxIndex, peakJoint };
  });
}

/** Ищет границы, где расчётная нагрузка выходит в жёлтую и красную зоны. */
export function scanSimulation(
  exercise: SimulationExercise,
  dims: BodyDimensions,
  bodyWeightKg: number,
  addedWeightKg: number,
  phase: number,
): SimulationScan {
  const loads = estimateSimulationLoads(
    exercise,
    simulationPose(exercise, phase, dims),
    dims,
    bodyWeightKg,
    addedWeightKg,
  );
  let peakIndex = 0;
  let peakJoint: LoadJoint = exercise.joints[0] || 'knee';
  for (const load of loads) {
    if (load.index > peakIndex) {
      peakIndex = load.index;
      peakJoint = load.joint;
    }
  }

  const peakAtWeight = (weight: number): number => {
    let peak = 0;
    for (let step = 0; step <= 10; step += 1) {
      const frameLoads = estimateSimulationLoads(
        exercise,
        simulationPose(exercise, step / 10, dims),
        dims,
        bodyWeightKg,
        weight,
      );
      for (const load of frameLoads) peak = Math.max(peak, load.index);
    }
    return peak;
  };

  let cautionFromKg: number | null = null;
  let unsafeFromKg: number | null = null;
  for (let weight = 0; weight <= 300; weight += 5) {
    const peak = peakAtWeight(weight);
    if (cautionFromKg === null && peak >= 0.3) cautionFromKg = weight;
    if (unsafeFromKg === null && peak >= 0.42) {
      unsafeFromKg = weight;
      break;
    }
  }

  let safeWeightKg: number | null = null;
  for (let weight = 300; weight >= 0; weight -= 5) {
    if (peakAtWeight(weight) < 0.42) {
      safeWeightKg = weight;
      break;
    }
  }

  let safeAmplitude = 0;
  for (let step = 20; step >= 0; step -= 1) {
    const frameLoads = estimateSimulationLoads(
      exercise,
      simulationPose(exercise, step / 20, dims),
      dims,
      bodyWeightKg,
      addedWeightKg,
    );
    if (frameLoads.every((load) => load.index < 0.42)) {
      safeAmplitude = step / 20;
      break;
    }
  }

  return {
    loads,
    peakIndex: Math.round(peakIndex * 1000) / 1000,
    peakJoint,
    level: loadLevel(peakIndex),
    cautionFromKg,
    unsafeFromKg,
    safeWeightKg,
    safeAmplitude,
  };
}

export type RuleStatus = 'pass' | 'near' | 'fail';

export interface RuleResult extends ExerciseRule {
  value: number;
  status: RuleStatus;
}

export interface ExerciseEvaluation {
  results: RuleResult[];
  failed: number;
  near: number;
  passed: number;
  score: number;
  tone: 'good' | 'attention' | 'risk';
  headline: string;
}

export function evaluateExercise(preset: ExercisePreset, pose: BodyPose): ExerciseEvaluation {
  const metrics = computePoseMetrics(pose);
  const results: RuleResult[] = preset.rules.map((item) => {
    const value = metrics[item.metric] ?? 0;
    const span = Math.max(1, item.max - item.min);
    const outside = value < item.min ? item.min - value : value > item.max ? value - item.max : 0;
    // «У границы» — только когда значение строго внутри коридора, но близко
    // к краю. Ровно 0° завала коленей — это идеал, а не риск.
    const nearBoundary =
      outside === 0 &&
      ((value > item.min && value - item.min < span * 0.08) ||
        (value < item.max && item.max - value < span * 0.08));
    return {
      ...item,
      value,
      status: outside > 0 ? 'fail' : nearBoundary ? 'near' : 'pass',
    };
  });

  const weight = (severity: RuleSeverity): number =>
    severity === 'high' ? 2 : severity === 'medium' ? 1.5 : 1;
  const totalWeight = results.reduce((sum, item) => sum + weight(item.severity), 0) || 1;
  const lost = results.reduce((sum, item) => {
    if (item.status === 'pass') return sum;
    return sum + weight(item.severity) * (item.status === 'fail' ? 1 : 0.35);
  }, 0);
  const failed = results.filter((item) => item.status === 'fail').length;
  const near = results.filter((item) => item.status === 'near').length;
  const passed = results.filter((item) => item.status === 'pass').length;
  const score = Math.max(0, Math.min(100, Math.round(100 - (lost / totalWeight) * 100)));
  const hasHighFail = results.some((item) => item.status === 'fail' && item.severity === 'high');
  const tone: ExerciseEvaluation['tone'] = hasHighFail ? 'risk' : failed > 0 ? 'attention' : 'good';
  const headline = hasHighFail
    ? 'Есть риск перегрузки — поправьте углы'
    : failed > 0
      ? 'Есть отклонения от безопасного коридора'
      : near > 0
        ? 'Углы в коридоре, но близко к границе'
        : 'Углы в безопасном коридоре';

  return { results, failed, near, passed, score, tone, headline };
}

export function jointRisk(
  evaluation: ExerciseEvaluation,
): Partial<Record<JointKey, 'near' | 'fail'>> {
  const map: Partial<Record<JointKey, 'near' | 'fail'>> = {};
  for (const item of evaluation.results) {
    if (item.status === 'pass') continue;
    if (item.status === 'fail' || map[item.joint] !== 'fail') {
      map[item.joint] = item.status;
    }
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Моментные плечи                                                     */
/* ------------------------------------------------------------------ */

export interface MomentArm {
  id: string;
  label: string;
  valueCm: number;
  ratio: number;
  level: 'low' | 'moderate' | 'high';
  note: string;
}

function momentLevel(ratio: number): MomentArm['level'] {
  if (ratio < 0.08) return 'low';
  if (ratio <= 0.17) return 'moderate';
  return 'high';
}

function momentNote(level: MomentArm['level']): string {
  if (level === 'low') return 'короткое плечо — нагрузка ближе к суставу';
  if (level === 'moderate') return 'рабочая зона рычага';
  return 'длинное плечо — следите за техникой';
}

/**
 * Оценка моментных плеч по 2D-проекции. Это ориентир для сравнения поз,
 * а не точная биомеханическая величина.
 */
export function estimateMomentArms(
  presetId: string,
  sideGeometry: SideGeometry,
  frontGeometry: FrontGeometry,
  dims: BodyDimensions,
): MomentArm[] {
  const scale = dims.scale;
  const sidePoints = sideGeometry;
  const barX =
    presetId === 'squat' || presetId === 'lunge' ? sidePoints.shoulder.x : sidePoints.hand.x;
  const make = (id: string, label: string, valueCm: number): MomentArm => {
    const ratio = valueCm / dims.heightCm;
    const level = momentLevel(ratio);
    return {
      id,
      label,
      valueCm: Math.round(valueCm * 10) / 10,
      ratio,
      level,
      note: momentNote(level),
    };
  };

  if (presetId === 'dips' || presetId === 'pullup' || presetId === 'overhead') {
    return [
      make('shoulder', 'Плечо', Math.abs(sidePoints.hand.x - sidePoints.shoulder.x) / scale),
      make('elbow', 'Локоть', Math.abs(sidePoints.hand.x - sidePoints.elbow.x) / scale),
      make('spine', 'Корпус', Math.abs(sidePoints.shoulder.x - sidePoints.hip.x) / scale),
    ];
  }

  if (presetId === 'bench') {
    return [
      make('shoulder', 'Плечо', Math.abs(frontGeometry.leftHand.x - frontGeometry.leftShoulder.x) / scale),
      make('elbow', 'Локоть', Math.abs(frontGeometry.leftHand.x - frontGeometry.leftElbow.x) / scale),
      make('spine', 'Корпус', Math.abs(sidePoints.shoulder.x - sidePoints.hip.x) / scale),
    ];
  }

  return [
    make('hip', 'Тазобедренный', Math.abs(barX - sidePoints.hip.x) / scale),
    make('knee', 'Коленный', Math.abs(barX - sidePoints.knee.x) / scale),
    make('spine', 'Поясница', Math.abs(sidePoints.shoulder.x - sidePoints.hip.x) / scale),
  ];
}

/* ------------------------------------------------------------------ */
/* Объём тренировок по группам мышц                                    */
/* ------------------------------------------------------------------ */

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core';

export const MUSCLE_GROUPS: Array<{ id: MuscleGroup; label: string; color: string }> = [
  { id: 'chest', label: 'Грудь', color: '#34d399' },
  { id: 'back', label: 'Спина', color: '#38bdf8' },
  { id: 'shoulders', label: 'Плечи', color: '#a78bfa' },
  { id: 'biceps', label: 'Бицепс', color: '#fbbf24' },
  { id: 'triceps', label: 'Трицепс', color: '#fb923c' },
  { id: 'quads', label: 'Квадрицепс', color: '#f472b6' },
  { id: 'hamstrings', label: 'Задняя цепь', color: '#2dd4bf' },
  { id: 'glutes', label: 'Ягодицы', color: '#facc15' },
  { id: 'calves', label: 'Голени', color: '#a3e635' },
  { id: 'core', label: 'Кор', color: '#94a3b8' },
];

const MUSCLE_LABEL = MUSCLE_GROUPS.reduce((acc, group) => {
  acc[group.id] = group.label;
  return acc;
}, {} as Record<MuscleGroup, string>);

function normalizeName(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim();
}

/** Упражнение → основная группа мышц. Порядок проверок важен. */
export function muscleGroupForExercise(name: string): MuscleGroup | null {
  const text = normalizeName(name);
  if (!text) return null;

  if (/(становая|румынская|deadlift|good morning|наклон вперед со штангой)/.test(text)) return 'hamstrings';
  if (/(присед|приседан|выпад|жим ногами|разгибан.*ног|leg press|squat|lunge|step up|зашагиван)/.test(text)) return 'quads';
  if (/(ягодич|hip thrust|мост|отведен.*ног|glute)/.test(text)) return 'glutes';
  if (/(подъем.*нос|подьем.*нос|голен|calf|икры)/.test(text)) return 'calves';
  if (/(жим.*лежа|жим лежа|отжиман|разводк|грудь|bench|push up|брусь)/.test(text)) return 'chest';
  if (/(трицепс|французск|разгибан.*рук|triceps|close grip|узким хватом)/.test(text)) return 'triceps';
  if (/(бицепс|сгибан.*рук|curl|подъем.*бицепс|подьем.*бицепс)/.test(text)) return 'biceps';
  if (/(жим.*стоя|жим.*сидя|жим гантел|махи|дельт|overhead|армейск|shoulder press)/.test(text)) return 'shoulders';
  if (/(тяга|подтягиван|греб|шраг|row|pull up|chin up|lat pulldown|верхн.*блок)/.test(text)) return 'back';
  if (/(планк|пресс|скручиван|подъем.*ног|подьем.*ног|core|abs|кор)/.test(text)) return 'core';
  return null;
}

export interface MuscleVolume {
  group: MuscleGroup;
  label: string;
  color: string;
  volumeKg: number;
  sessions: number;
}

interface VolumeAccumulator {
  volumeKg: number;
  sessionIds: Set<string>;
}

function workoutTimestamp(workout: WorkoutRecord): number {
  const candidates = [workout.completedAt, workout.startedAt, workout.date ? `${workout.date}T12:00:00` : ''];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = Date.parse(candidate);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

export function muscleVolumesFromWorkouts(
  workouts: WorkoutRecord[],
  days: number,
  bodyWeightKg: number,
  now = Date.now(),
): MuscleVolume[] {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const acc = new Map<MuscleGroup, VolumeAccumulator>();
  const bodyweightFactor = bodyWeightKg > 0 ? bodyWeightKg * 0.65 : 0;

  for (const workout of workouts) {
    const timestamp = workoutTimestamp(workout);
    if (!timestamp || timestamp < cutoff) continue;
    for (const exercise of workout.exercises || []) {
      const group = muscleGroupForExercise(exercise.name);
      if (!group) continue;
      const isBodyweight = /(подтяг|отжим|брус|планк|пресс|выпад|присед|push up|pull up|dip)/i.test(
        exercise.name,
      );
      const current = acc.get(group) || { volumeKg: 0, sessionIds: new Set<string>() };
      for (const set of exercise.sets || []) {
        const weight = Number(set.weight) || 0;
        const reps = Number(set.reps) || 0;
        if (reps <= 0) continue;
        const load = weight > 0 ? weight : isBodyweight ? bodyweightFactor : 0;
        current.volumeKg += load * reps;
      }
      current.sessionIds.add(workout.id);
      acc.set(group, current);
    }
  }

  return MUSCLE_GROUPS.map((group) => {
    const current = acc.get(group.id);
    return {
      group: group.id,
      label: group.label,
      color: group.color,
      volumeKg: Math.round((current?.volumeKg || 0) * 10) / 10,
      sessions: current?.sessionIds.size || 0,
    };
  }).sort((a, b) => b.volumeKg - a.volumeKg);
}

export interface GrowthRow {
  key: BodyMetricKey;
  label: string;
  baselineCm: number;
  currentCm: number;
  deltaCm: number;
  baselineDate: string;
  currentDate: string;
  volumeKg: number;
  ratioCmPerTon: number;
  status: 'grow' | 'stable' | 'down';
}

const METRIC_MUSCLE_MAP: Record<BodyMetricKey, MuscleGroup[]> = {
  neckCm: ['shoulders', 'back'],
  shouldersCm: ['shoulders'],
  chestCm: ['chest'],
  waistCm: ['core'],
  hipsCm: ['glutes', 'hamstrings'],
  bicepLCm: ['biceps'],
  bicepRCm: ['biceps'],
  forearmLCm: ['biceps'],
  forearmRCm: ['biceps'],
  wristLCm: ['biceps'],
  wristRCm: ['biceps'],
  thighLCm: ['quads', 'hamstrings', 'glutes'],
  thighRCm: ['quads', 'hamstrings', 'glutes'],
  calfLCm: ['calves'],
  calfRCm: ['calves'],
  ankleLCm: ['calves'],
  ankleRCm: ['calves'],
};

export function buildGrowthRows(
  profile: BodyProfile,
  workouts: WorkoutRecord[],
  days: number,
  bodyWeightKg: number,
): GrowthRow[] {
  const sorted = sortMeasurements(profile.measurements);
  const latest = sorted[0];
  if (!latest) return [];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const inPeriod = sorted.filter((entry) => Date.parse(`${entry.date}T12:00:00`) >= cutoff);
  const baseline = inPeriod[inPeriod.length - 1] || sorted[sorted.length - 1];
  if (!baseline || baseline.id === latest.id) return [];

  const volumes = muscleVolumesFromWorkouts(workouts, days, bodyWeightKg)
    .reduce((acc, item) => {
      acc[item.group] = item.volumeKg;
      return acc;
    }, {} as Record<MuscleGroup, number>);

  return BODY_METRIC_FIELDS.map((field) => {
    const first = measurementValue(baseline, field.key);
    const current = measurementValue(latest, field.key);
    if (first === undefined || current === undefined) return null;
    const delta = Math.round((current - first) * 10) / 10;
    const volume = METRIC_MUSCLE_MAP[field.key].reduce((sum, group) => sum + (volumes[group] || 0), 0);
    return {
      key: field.key,
      label: field.label,
      baselineCm: first,
      currentCm: current,
      deltaCm: delta,
      baselineDate: baseline.date,
      currentDate: latest.date,
      volumeKg: Math.round(volume * 10) / 10,
      ratioCmPerTon: volume > 0 ? Math.round((delta / (volume / 1000)) * 100) / 100 : 0,
      status: delta >= 0.3 ? 'grow' : delta <= -0.3 ? 'down' : 'stable',
    } as GrowthRow;
  }).filter((row): row is GrowthRow => row !== null);
}

/* ------------------------------------------------------------------ */
/* Пропорции и сильные / слабые стороны                                */
/* ------------------------------------------------------------------ */

export type InsightStatus = 'strong' | 'balanced' | 'grow';

export interface ProportionInsight {
  id: string;
  title: string;
  value: string;
  hint: string;
  status: InsightStatus;
}

function averagePair(left?: number, right?: number): number | undefined {
  if (left !== undefined && right !== undefined) return (left + right) / 2;
  return left ?? right;
}

function symmetryPercent(left?: number, right?: number): number | undefined {
  if (left === undefined || right === undefined || Math.max(left, right) <= 0) return undefined;
  return Math.round((Math.abs(left - right) / Math.max(left, right)) * 1000) / 10;
}

export function buildProportionInsights(profile: BodyProfile): ProportionInsight[] {
  const latest = latestMeasurement(profile);
  if (!latest) return [];
  const insights: ProportionInsight[] = [];
  const shoulders = latest.shouldersCm;
  const chest = latest.chestCm;
  const waist = latest.waistCm;
  const hips = latest.hipsCm;

  if (shoulders && waist) {
    const ratio = shoulders / waist;
    const status: InsightStatus = ratio >= 1.4 ? 'strong' : ratio >= 1.25 ? 'balanced' : 'grow';
    insights.push({
      id: 'v-taper',
      title: 'V-образный силуэт',
      value: `${ratio.toFixed(2)} : 1`,
      hint:
        status === 'strong'
          ? 'Плечи заметно шире талии — сильная визуальная база.'
          : status === 'balanced'
            ? 'Хороший баланс; можно добавить объём плечам или держать талию.'
            : 'Плечи близки к талии: стоит добавить дельты и среднюю часть спины.',
      status,
    });
  }

  if (shoulders && hips) {
    const ratio = shoulders / hips;
    const status: InsightStatus = ratio >= 1.3 ? 'strong' : ratio >= 1.15 ? 'balanced' : 'grow';
    insights.push({
      id: 'shoulder-hip',
      title: 'Плечи к тазу',
      value: `${ratio.toFixed(2)} : 1`,
      hint:
        status === 'strong'
          ? 'Верх тела визуально доминирует — хорошая пропорция для силовых видов.'
          : status === 'balanced'
            ? 'Пропорция в рабочей зоне, без выраженного перекоса.'
            : 'Верх пока уже таза: добавьте плечи и широчайшие.',
      status,
    });
  }

  if (chest && waist) {
    const ratio = chest / waist;
    const status: InsightStatus = ratio >= 1.3 ? 'strong' : ratio >= 1.12 ? 'balanced' : 'grow';
    insights.push({
      id: 'chest-waist',
      title: 'Грудь к талии',
      value: `${ratio.toFixed(2)} : 1`,
      hint:
        status === 'strong'
          ? 'Грудная клетка хорошо выражена относительно талии.'
          : status === 'balanced'
            ? 'Нормальный баланс; следите за динамикой талии.'
            : 'Можно добавить объём груди и спины без роста талии.',
      status,
    });
  }

  const pairSymmetry = [
    { id: 'arms', label: 'Симметрия рук', left: latest.bicepLCm, right: latest.bicepRCm },
    { id: 'forearms', label: 'Симметрия предплечий', left: latest.forearmLCm, right: latest.forearmRCm },
    { id: 'thighs', label: 'Симметрия бёдер', left: latest.thighLCm, right: latest.thighRCm },
    { id: 'calves', label: 'Симметрия голеней', left: latest.calfLCm, right: latest.calfRCm },
  ];
  const symmetryValues = pairSymmetry
    .map((pair) => ({ ...pair, value: symmetryPercent(pair.left, pair.right) }))
    .filter((pair): pair is typeof pair & { value: number } => pair.value !== undefined);
  if (symmetryValues.length > 0) {
    const worst = symmetryValues.reduce((max, item) => (item.value > max.value ? item : max));
    const status: InsightStatus = worst.value <= 3 ? 'strong' : worst.value <= 6 ? 'balanced' : 'grow';
    insights.push({
      id: 'symmetry',
      title: 'Симметрия сторон',
      value: `${worst.id === 'arms' ? 'руки' : worst.id === 'forearms' ? 'предплечья' : worst.id === 'thighs' ? 'бёдра' : 'голени'} ${worst.value.toFixed(1)}%`,
      hint:
        status === 'strong'
          ? 'Разница сторон минимальна — хорошая база для симметричной нагрузки.'
          : status === 'balanced'
            ? 'Небольшая асимметрия допустима; следите за динамикой.'
            : 'Разница больше 6%: добавьте односторонние упражнения на слабую сторону.',
      status,
    });
  }

  const thigh = averagePair(latest.thighLCm, latest.thighRCm);
  const calf = averagePair(latest.calfLCm, latest.calfRCm);
  if (thigh && calf) {
    const ratio = thigh / calf;
    const status: InsightStatus =
      ratio >= 1.55 && ratio <= 2.05 ? 'strong' : ratio >= 1.4 && ratio <= 2.25 ? 'balanced' : 'grow';
    insights.push({
      id: 'thigh-calf',
      title: 'Бедро к голени',
      value: `${ratio.toFixed(2)} : 1`,
      hint:
        status === 'strong'
          ? 'Классическая пропорция ног, без провала по голени.'
          : ratio < 1.4
            ? 'Голени крупные относительно бёдер — проверьте тренировки ног.'
            : 'Голень отстаёт: добавьте подъёмы на носки.',
      status,
    });
  }

  const bicep = averagePair(latest.bicepLCm, latest.bicepRCm);
  const forearm = averagePair(latest.forearmLCm, latest.forearmRCm);
  if (bicep && forearm) {
    const ratio = bicep / forearm;
    const status: InsightStatus =
      ratio >= 1.25 && ratio <= 1.65 ? 'strong' : ratio >= 1.15 && ratio <= 1.8 ? 'balanced' : 'grow';
    insights.push({
      id: 'bicep-forearm',
      title: 'Бицепс к предплечью',
      value: `${ratio.toFixed(2)} : 1`,
      hint:
        status === 'strong'
          ? 'Хорошая пропорция руки: бицепс выражен без провала предплечья.'
          : ratio > 1.8
            ? 'Предплечье отстаёт — добавьте хват и сгибания.'
            : 'Бицепс пока меньше предплечья — добавьте объём руки.',
      status,
    });
  }

  return insights;
}

export function muscleGroupLabel(group: MuscleGroup): string {
  return MUSCLE_LABEL[group] || group;
}

export function formatDateShort(date: string): string {
  if (!DATE_RE.test(date)) return date;
  const [, month, day] = date.split('-');
  return `${day}.${month}`;
}

export function formatDateLong(date: string): string {
  if (!DATE_RE.test(date)) return date;
  const [year, month, day] = date.split('-');
  return `${day}.${month}.${year}`;
}

export function daysAgoKey(days: number): string {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
