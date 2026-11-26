import type { WorkoutRecord } from '../types';
import {
  BODY_DRAW,
  BodyPose,
  BodyDimensions,
  DEFAULT_FRONT_POSE,
  DEFAULT_SIDE_POSE,
  computePoseMetrics,
  standingPose,
} from './bodyModel';
import {
  exerciseById,
  exercisePose,
} from './exerciseSimulation';

/* ------------------------------------------------------------------ */
/* Типы                                                                */
/* ------------------------------------------------------------------ */

export type MuscleId =
  | 'quads'
  | 'glutes'
  | 'hamstrings'
  | 'adductors'
  | 'calves'
  | 'tibialis'
  | 'chest'
  | 'frontDelts'
  | 'sideDelts'
  | 'rearDelts'
  | 'triceps'
  | 'biceps'
  | 'forearms'
  | 'lats'
  | 'upperBack'
  | 'spinalErectors'
  | 'core'
  | 'hipFlexors';

export type JointId = 'ankle' | 'knee' | 'hip' | 'spine' | 'shoulder' | 'elbow';

export type ExerciseCategory =
  | 'squat'
  | 'hinge'
  | 'horizontalPush'
  | 'verticalPush'
  | 'horizontalPull'
  | 'verticalPull'
  | 'lunge'
  | 'accessory'
  | 'core';

export type EquipmentKind = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type PoseFamily =
  | 'squat'
  | 'frontSquat'
  | 'rdl'
  | 'deadlift'
  | 'bench'
  | 'overhead'
  | 'row'
  | 'pullup'
  | 'dips'
  | 'lunge'
  | 'bulgarian'
  | 'hipThrust'
  | 'standing'
  | 'seated'
  | 'lying'
  | 'plank';

export interface MuscleMeta {
  id: MuscleId;
  label: string;
  color: string;
  /** Где рисовать зону на схеме сбоку. */
  side?: {
    segment: 'torso' | 'thigh' | 'shin' | 'upperArm' | 'forearm' | 'glute' | 'shoulder' | 'hip';
    offset: number;
    width: number;
    from?: number;
    to?: number;
  };
}

export const MUSCLES: Record<MuscleId, MuscleMeta> = {
  quads: { id: 'quads', label: 'Квадрицепс', color: '#ef4444', side: { segment: 'thigh', offset: -0.2, width: 0.62, from: 0.12, to: 0.82 } },
  glutes: { id: 'glutes', label: 'Ягодичные', color: '#f97316', side: { segment: 'glute', offset: 0, width: 1.05 } },
  hamstrings: { id: 'hamstrings', label: 'Бицепс бедра', color: '#f59e0b', side: { segment: 'thigh', offset: 0.2, width: 0.55, from: 0.16, to: 0.86 } },
  adductors: { id: 'adductors', label: 'Приводящие', color: '#fb7185', side: { segment: 'thigh', offset: 0.48, width: 0.3, from: 0.18, to: 0.65 } },
  calves: { id: 'calves', label: 'Голени', color: '#fbbf24', side: { segment: 'shin', offset: 0.2, width: 0.6, from: 0.14, to: 0.8 } },
  tibialis: { id: 'tibialis', label: 'Передняя большеберцовая', color: '#fde68a', side: { segment: 'shin', offset: -0.16, width: 0.26, from: 0.2, to: 0.75 } },
  chest: { id: 'chest', label: 'Грудь', color: '#ef4444', side: { segment: 'torso', offset: 0.22, width: 0.5, from: 0.58, to: 0.84 } },
  frontDelts: { id: 'frontDelts', label: 'Передние дельты', color: '#f97316', side: { segment: 'shoulder', offset: -0.16, width: 0.55 } },
  sideDelts: { id: 'sideDelts', label: 'Средние дельты', color: '#fb923c', side: { segment: 'shoulder', offset: 0, width: 0.62 } },
  rearDelts: { id: 'rearDelts', label: 'Задние дельты', color: '#fbbf24', side: { segment: 'shoulder', offset: 0.18, width: 0.5 } },
  triceps: { id: 'triceps', label: 'Трицепс', color: '#f59e0b', side: { segment: 'upperArm', offset: 0.18, width: 0.5, from: 0.2, to: 0.82 } },
  biceps: { id: 'biceps', label: 'Бицепс', color: '#f97316', side: { segment: 'upperArm', offset: -0.18, width: 0.48, from: 0.18, to: 0.8 } },
  forearms: { id: 'forearms', label: 'Предплечья', color: '#fbbf24', side: { segment: 'forearm', offset: 0, width: 0.6, from: 0.15, to: 0.8 } },
  lats: { id: 'lats', label: 'Широчайшие', color: '#ef4444', side: { segment: 'torso', offset: -0.22, width: 0.46, from: 0.42, to: 0.82 } },
  upperBack: { id: 'upperBack', label: 'Верх спины', color: '#f97316', side: { segment: 'torso', offset: -0.22, width: 0.38, from: 0.7, to: 0.92 } },
  spinalErectors: { id: 'spinalErectors', label: 'Разгибатели спины', color: '#dc2626', side: { segment: 'torso', offset: -0.12, width: 0.26, from: 0.18, to: 0.8 } },
  core: { id: 'core', label: 'Кор', color: '#f59e0b', side: { segment: 'torso', offset: 0.14, width: 0.3, from: 0.2, to: 0.58 } },
  hipFlexors: { id: 'hipFlexors', label: 'Сгибатели бедра', color: '#fb7185', side: { segment: 'hip', offset: -0.12, width: 0.35 } },
};

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  squat: 'Присед',
  hinge: 'Тазобедренный шарнир',
  horizontalPush: 'Горизонтальный жим',
  verticalPush: 'Вертикальный жим',
  horizontalPull: 'Горизонтальная тяга',
  verticalPull: 'Вертикальная тяга',
  lunge: 'Выпад / односторонние',
  accessory: 'Изоляция',
  core: 'Корпус',
};

export const EQUIPMENT_LABELS: Record<EquipmentKind, string> = {
  barbell: 'Штанга',
  dumbbell: 'Гантели',
  machine: 'Тренажёр',
  cable: 'Блок',
  bodyweight: 'Свой вес',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: 'Начальный',
  intermediate: 'Средний',
  advanced: 'Продвинутый',
};

export const JOINT_LABELS: Record<JointId, string> = {
  ankle: 'Голеностоп',
  knee: 'Колено',
  hip: 'Тазобедренный',
  spine: 'Поясница',
  shoulder: 'Плечо',
  elbow: 'Локоть',
};

export const CATEGORY_ORDER: ExerciseCategory[] = [
  'squat',
  'hinge',
  'horizontalPush',
  'verticalPush',
  'horizontalPull',
  'verticalPull',
  'lunge',
  'accessory',
  'core',
];

export interface ExerciseControl {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  lowLabel: string;
  highLabel: string;
  hint?: string;
}

export interface ShiftRule {
  controlId: string;
  up: MuscleId[];
  down: MuscleId[];
  jointsUp: JointId[];
  jointsDown: JointId[];
  highText: string;
  lowText: string;
}

export type RiskLevel = 'info' | 'caution' | 'warning';

export interface ExerciseRisk {
  title: string;
  level: RiskLevel;
  text: string;
  prevention: string;
}

export interface ExerciseFaq {
  question: string;
  answer: string;
}

export interface AngleRule {
  metric: string;
  label: string;
  min: number;
  max: number;
  ideal: string;
  advice: string;
}

export type SourceKey = 'nsca' | 'neumann' | 'mcgill' | 'acsm' | 'schoenfeld' | 'review';

export const SOURCES: Record<SourceKey, { label: string; note: string }> = {
  nsca: {
    label: 'NSCA, Essentials of Strength Training and Conditioning',
    note: 'Базовые принципы техники, прогрессии и организации силовой работы.',
  },
  neumann: {
    label: 'Neumann, Kinesiology of the Musculoskeletal System',
    note: 'Анатомия и кинематика суставов, плечи моментов и функции мышц.',
  },
  mcgill: {
    label: 'McGill, Low Back Disorders',
    note: 'Нейтральная спина, выносливость корпуса и снижение нагрузки на поясницу.',
  },
  acsm: {
    label: 'ACSM, Guidelines for Exercise Testing and Prescription',
    note: 'Общие принципы безопасности и дозирования нагрузки.',
  },
  schoenfeld: {
    label: 'Schoenfeld, Science and Development of Muscle Hypertrophy',
    note: 'Объём, диапазоны повторений и распределение нагрузки для гипертрофии.',
  },
  review: {
    label: 'Обзоры техники приседа, становой, жима и тяг',
    note: 'Сравнение вариантов техники и типичных ошибок; выводы не являются индивидуальным предписанием.',
  },
};

export const DISCLAIMER =
  'Схема показывает геометрию и ориентировочное распределение нагрузки. Она не измеряет активацию мышц, не ставит диагноз и не заменяет тренера или врача.';

export interface TechniqueExercise {
  id: string;
  simId?: string;
  poseFamily?: PoseFamily;
  name: string;
  aliases: string[];
  category: ExerciseCategory;
  equipment: EquipmentKind;
  difficulty: Difficulty;
  summary: string;
  setup: string;
  execution: string[];
  breathing: string;
  tempo: string;
  rom: string;
  primary: MuscleId[];
  secondary: MuscleId[];
  stabilizers: MuscleId[];
  muscleMap: Partial<Record<MuscleId, number>>;
  controls: ExerciseControl[];
  shifts: ShiftRule[];
  angles: AngleRule[];
  momentJoints: JointId[];
  mistakes: Array<{ title: string; text: string }>;
  risks: ExerciseRisk[];
  faq: ExerciseFaq[];
  sources: SourceKey[];
}

const c = (
  id: string,
  label: string,
  min: number,
  max: number,
  step: number,
  defaultValue: number,
  lowLabel: string,
  highLabel: string,
  hint?: string,
): ExerciseControl => ({ id, label, min, max, step, defaultValue, lowLabel, highLabel, hint });

const sh = (
  controlId: string,
  up: MuscleId[],
  down: MuscleId[],
  jointsUp: JointId[],
  jointsDown: JointId[],
  highText: string,
  lowText: string,
): ShiftRule => ({ controlId, up, down, jointsUp, jointsDown, highText, lowText });

const risk = (title: string, level: RiskLevel, text: string, prevention: string): ExerciseRisk => ({
  title,
  level,
  text,
  prevention,
});

const q = (question: string, answer: string): ExerciseFaq => ({ question, answer });

const angle = (
  metric: string,
  label: string,
  min: number,
  max: number,
  ideal: string,
  advice: string,
): AngleRule => ({ metric, label, min, max, ideal, advice });

/* ------------------------------------------------------------------ */
/* Каталог                                                             */
/* ------------------------------------------------------------------ */

export const EXERCISE_CATALOG: TechniqueExercise[] = [
  {
    id: 'squat',
    simId: 'squat',
    name: 'Присед со штангой',
    aliases: ['присед', 'приседания', 'back squat', 'squat'],
    category: 'squat',
    equipment: 'barbell',
    difficulty: 'intermediate',
    summary: 'Базовое движение для ног и корпуса: таз уходит вниз и назад, колени сгибаются, корпус сохраняет нейтральную спину.',
    setup: 'Штанга на верхней части спины, стопы на ширине плеч или чуть шире, носки слегка развёрнуты. Вдох и жёсткий кор перед каждым повторением.',
    execution: [
      'Начните с отведения таза назад и сгибания коленей одновременно.',
      'Держите стопу целиком на полу, колени следуют направлению носков.',
      'Опускайтесь до глубины, где спина остаётся нейтральной, затем встаньте, толкая пол всей стопой.',
    ],
    breathing: 'Вдох в верхней точке, задержка на опускании, выдох на подъёме.',
    tempo: '2–3 секунды вниз, 1–2 секунды вверх, без резких провалов.',
    rom: 'Бёдра около параллели или ниже, если позволяет подвижность и нет боли.',
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings', 'adductors', 'spinalErectors', 'core'],
    stabilizers: ['calves', 'upperBack'],
    muscleMap: { quads: 85, glutes: 78, hamstrings: 45, adductors: 42, spinalErectors: 48, core: 45, calves: 34 },
    controls: [
      c('depth', 'Глубина', 0.55, 1, 0.01, 0.88, 'выше параллели', 'глубокий присед', 'Чем глубже, тем больше сгибание колена и бедра.'),
      c('lean', 'Наклон корпуса', -1, 1, 0.05, 0, 'вертикальнее', 'больше наклон'),
      c('bar', 'Положение штанги', 0, 1, 0.05, 0.35, 'высоко на трапециях', 'низко на лопатках'),
      c('stance', 'Ширина постановки', 0, 1, 0.05, 0.5, 'узко', 'широко'),
      c('heels', 'Подъём пяток', 0, 1, 0.05, 0, 'без подставки', 'пятки приподняты'),
    ],
    shifts: [
      sh('depth', ['quads', 'glutes', 'adductors', 'calves'], [], ['knee', 'hip', 'ankle'], [], 'Глубже: больше сгибание колена, бедра и голеностопа.', 'Мельче: меньше требования к глубине и подвижности.'),
      sh('lean', ['glutes', 'spinalErectors'], ['quads'], ['spine', 'hip'], ['knee'], 'Больше наклон: выше момент на поясницу и ягодицы.', 'Вертикальнее: больше нагрузки остаётся на квадрицепсе.'),
      sh('bar', ['glutes', 'hamstrings', 'spinalErectors'], ['quads'], ['spine', 'hip'], ['knee'], 'Низкая штанга: больше наклона и задней цепи.', 'Высокая штанга: корпус вертикальнее, больше квадрицепса.'),
      sh('stance', ['adductors', 'glutes'], ['quads'], ['hip'], ['knee'], 'Шире: больше приводящих и ягодичных.', 'Уже: больше квадрицепса и хода колена вперёд.'),
      sh('heels', ['quads'], ['calves'], ['knee'], ['ankle'], 'Пятки выше: легче глубина, больше колено и квадрицепс.', 'Без подставки: выше требование к голеностопу.'),
    ],
    angles: [
      angle('side.kneeFlex', 'Сгибание колена', 70, 130, '85–115°', 'Слишком мелко или чрезмерно глубоко для текущей подвижности.'),
      angle('side.torsoLean', 'Наклон корпуса', 10, 45, '18–35°', 'Сильный наклон повышает нагрузку на поясницу.'),
      angle('side.hipFlex', 'Сгибание бедра', 70, 135, '90–120°', 'Таз не доходит до глубины или проваливается.'),
    ],
    momentJoints: ['hip', 'knee'],
    mistakes: [
      { title: 'Колени заваливаются внутрь', text: 'Колено теряет направление носка, нагрузка уходит в medial structures. Разведите колени и держите стопу активной.' },
      { title: 'Отрыв пяток', text: 'Недостаточная подвижность голеностопа или слишком глубокий присед. Уменьшите глубину или используйте подставку.' },
      { title: 'Округление поясницы внизу', text: 'Таз «подкручивается», спина теряет нейтраль. Остановитесь выше и работайте над подвижностью.' },
    ],
    risks: [
      risk('Передняя боль в колене', 'caution', 'Глубокий присед повышает требование к пателлофеморальному суставу, особенно при завале колена внутрь и резком увеличении объёма.', 'Держите колени по носкам, увеличивайте глубину постепенно, не работайте через острую боль.'),
      risk('Нагрузка на поясницу', 'caution', 'При сильном наклоне и потере нейтральной спины возрастает момент на поясничный отдел.', 'Держите кор жёстким, не округляйте спину, уменьшите вес или глубину.'),
      risk('Конфликт в тазобедренном суставе', 'info', 'Глубокое сгибание бедра может упираться в переднюю часть сустава у людей с особенностями строения.', 'Сузьте глубину, разверните носки, попробуйте более широкую постановку; при боли обратитесь к специалисту.'),
    ],
    faq: [
      q('Почему тянет поясницу?', 'Чаще всего из-за потери нейтральной спины, слишком сильного наклона или резкого увеличения веса. Проверьте глубину, жёсткость кора и положение штанги.'),
      q('Как больше включить ягодицы?', 'Немного глубже, с тазом назад и большим наклоном корпуса, при жёсткой спине. Но не превращайте присед в становую: нагрузка на квадрицепс тоже важна.'),
      q('Можно ли при длинных ногах?', 'Да. Длинное бедро часто требует большего наклона, более широкой постановки или подставки под пятки. Подбирайте по ощущению баланса и глубины.'),
    ],
    sources: ['nsca', 'neumann', 'mcgill', 'review'],
  },
  {
    id: 'frontSquat',
    simId: 'frontSquat',
    name: 'Фронтальный присед',
    aliases: ['фронтальный присед', 'front squat', 'присед со штангой на груди'],
    category: 'squat',
    equipment: 'barbell',
    difficulty: 'advanced',
    summary: 'Присед с штангой на передних дельтах. Корпус вертикальнее, больше требования к квадрицепсу, корпусу и подвижности запястий.',
    setup: 'Гриф лежит на передних дельтах, локти высоко, пальцы придерживают гриф. Стопы на ширине плеч.',
    execution: [
      'Сохраняйте локти высоко и грудной отдел открытым.',
      'Колени идут вперёд и в стороны, таз опускается между стоп.',
      'Вставайте, не теряя положения локтей и нейтральной спины.',
    ],
    breathing: 'Вдох перед спуском, выдох на подъёме.',
    tempo: 'Контролируемый спуск 2–3 секунды, подъём без рывка.',
    rom: 'До комфортной глубины с вертикальным корпусом.',
    primary: ['quads', 'core'],
    secondary: ['glutes', 'upperBack', 'spinalErectors'],
    stabilizers: ['calves', 'forearms'],
    muscleMap: { quads: 92, glutes: 55, core: 62, upperBack: 55, spinalErectors: 45, calves: 30, forearms: 35 },
    controls: [
      c('depth', 'Глубина', 0.55, 1, 0.01, 0.86, 'выше параллели', 'глубокий'),
      c('lean', 'Наклон корпуса', -1, 1, 0.05, 0, 'вертикальнее', 'больше наклон'),
      c('elbow', 'Высота локтей', 0, 1, 0.05, 0.7, 'ниже', 'выше'),
    ],
    shifts: [
      sh('depth', ['quads', 'glutes', 'calves'], [], ['knee', 'hip', 'ankle'], [], 'Глубже: больше сгибание колена и голеностопа.', 'Мельче: меньше требований к глубине.'),
      sh('lean', ['glutes', 'spinalErectors'], ['quads'], ['spine', 'hip'], ['knee'], 'Наклон: больше задней цепи и поясницы.', 'Вертикальнее: больше квадрицепса и кора.'),
      sh('elbow', ['upperBack', 'core'], ['quads'], ['spine'], [], 'Локти выше: легче удержать вертикальный корпус.', 'Локти ниже: гриф уходит вперёд, растёт нагрузка на спину.'),
    ],
    angles: [
      angle('side.kneeFlex', 'Сгибание колена', 70, 130, '85–115°', 'Глубина вне комфортного коридора.'),
      angle('side.torsoLean', 'Наклон корпуса', 5, 30, '8–22°', 'Наклон вперёд разгружает квадрицепс и грузит спину.'),
      angle('side.hipFlex', 'Сгибание бедра', 60, 135, '85–115°', 'Таз не доходит до глубины или проваливается.'),
    ],
    momentJoints: ['hip', 'knee'],
    mistakes: [
      { title: 'Локти опускаются', text: 'Гриф уходит вперёд, корпус складывается. Держите локти высоко и работайте над подвижностью грудного отдела.' },
      { title: 'Запястья болят', text: 'Не хватает подвижности. Используйте скрещённые руки или ремни, не терпите боль.' },
    ],
    risks: [
      risk('Перегрузка запястий и локтей', 'caution', 'Передний хват требует разгибания запястий и наружной ротации плеча.', 'Используйте удобный хват, ремни или скрещённые руки; не работайте через боль.'),
      risk('Потеря нейтральной спины', 'caution', 'При опущенных локтях корпус складывается, растёт нагрузка на поясницу.', 'Держите локти высоко, уменьшите вес, работайте над грудным отделом.'),
    ],
    faq: [
      q('Чем отличается от обычного приседа?', 'Более вертикальный корпус и больше нагрузки на квадрицепс и корпус; меньше на ягодицы и заднюю цепь.'),
      q('Что делать, если не хватает подвижности?', 'Скрещённые руки, ремни, меньшая глубина, работа над грудным отделом и запястьями.'),
    ],
    sources: ['nsca', 'neumann', 'review'],
  },
  {
    id: 'rdl',
    simId: 'rdl',
    name: 'Румынская тяга',
    aliases: ['румынская тяга', 'rdl', 'romanian deadlift'],
    category: 'hinge',
    equipment: 'barbell',
    difficulty: 'intermediate',
    summary: 'Тазобедренный шарнир с почти прямыми коленями: растягивает заднюю цепь и учит держать спину нейтральной.',
    setup: 'Штанга в руках, стопы на ширине таза, колени мягко согнуты. Лопатки сведены, кор жёсткий.',
    execution: [
      'Отводите таз назад, гриф скользит вдоль ног.',
      'Опускайтесь до комфортного растяжения задней цепи, не округляя спину.',
      'Возвращайтесь, толкая таз вперёд и сохраняя давление стоп в пол.',
    ],
    breathing: 'Вдох перед опусканием, выдох на подъёме.',
    tempo: '3 секунды вниз, 1 секунда вверх.',
    rom: 'До середины голени или ниже колена, если позволяет контроль.',
    primary: ['hamstrings', 'glutes'],
    secondary: ['spinalErectors', 'lats', 'forearms'],
    stabilizers: ['core', 'upperBack'],
    muscleMap: { hamstrings: 92, glutes: 82, spinalErectors: 68, lats: 38, forearms: 35, quads: 20, core: 35 },
    controls: [
      c('hinge', 'Глубина наклона', 0.35, 1, 0.01, 0.85, 'выше', 'ниже'),
      c('knee', 'Сгибание колена', 0, 1, 0.05, 0.35, 'почти прямые', 'больше сгибания'),
      c('barPath', 'Гриф от ног', 0, 1, 0.05, 0, 'близко', 'далеко'),
      c('pelvis', 'Наклон таза', -1, 1, 0.05, 0, 'нейтрально', 'сильнее наклон'),
    ],
    shifts: [
      sh('hinge', ['hamstrings', 'glutes', 'spinalErectors'], ['quads'], ['hip', 'spine'], ['knee'], 'Ниже: больше растяжение задней цепи и момент на поясницу.', 'Выше: меньше амплитуда и требования к задней цепи.'),
      sh('knee', ['quads'], ['hamstrings'], ['knee'], ['hip'], 'Больше колена: квадрицепс включается сильнее, растяжение бицепса бедра меньше.', 'Меньше колена: больше шарнир и растяжение задней цепи.'),
      sh('barPath', ['spinalErectors', 'hamstrings'], [], ['spine', 'hip'], [], 'Гриф дальше от ног: растёт плечо момента на поясницу.', 'Гриф близко: меньше рычаг и стабильнее спина.'),
      sh('pelvis', ['glutes', 'hamstrings'], ['spinalErectors'], ['hip'], ['spine'], 'Наклон таза меняет растяжение задней цепи, но не должен ломать нейтраль спины.', 'Нейтральный таз: базовая позиция.'),
    ],
    angles: [
      angle('side.kneeFlex', 'Сгибание колена', 10, 55, '15–35°', 'Слишком прямые или слишком согнутые колени меняют смысл движения.'),
      angle('side.torsoLean', 'Наклон корпуса', 35, 68, '42–60°', 'Слишком вертикально или слишком глубоко для контроля поясницы.'),
      angle('side.elbowFlex', 'Прямые руки', 0, 20, '0–12°', 'Не тяните руками.'),
    ],
    momentJoints: ['hip', 'spine'],
    mistakes: [
      { title: 'Приседание вместо шарнира', text: 'Колени сгибаются слишком сильно, таз не уходит назад. Задняя цепь не растягивается.' },
      { title: 'Округление поясницы', text: 'Спина теряет нейтраль внизу. Уменьшите амплитуду и работайте над контролем таза.' },
      { title: 'Гриф уходит от ног', text: 'Растёт плечо момента на поясницу. Держите гриф близко.' },
    ],
    risks: [
      risk('Растяжение задней цепи', 'caution', 'Глубокое растяжение под нагрузкой и резкий темп повышают риск для бицепса бедра.', 'Увеличивайте амплитуду постепенно, контролируйте опускание, не работайте через боль.'),
      risk('Перегрузка поясницы', 'caution', 'При округлении спины и удалении грифа от ног растёт момент на поясничный отдел.', 'Держите нейтральную спину, гриф близко, уменьшите вес или глубину.'),
    ],
    faq: [
      q('Чем отличается от становой?', 'В румынской тяге колени почти прямые, движение идёт в тазобедренном суставе и сильнее растягивает заднюю цепь. В классической становой больше сгибания колена и съём с пола.'),
      q('Как понять, что амплитуда достаточная?', 'Когда вы чувствуете сильное, но контролируемое растяжение под ягодицей/бедром, а спина остаётся нейтральной. Не гонитесь за полом.'),
    ],
    sources: ['nsca', 'neumann', 'mcgill', 'review'],
  },
  {
    id: 'deadlift',
    simId: 'deadlift',
    name: 'Классическая становая тяга',
    aliases: ['становая', 'становая тяга', 'deadlift'],
    category: 'hinge',
    equipment: 'barbell',
    difficulty: 'advanced',
    summary: 'Съём штанги с пола за счёт ног и тазобедренного шарнира. Нагружает заднюю цепь, спину и хват.',
    setup: 'Гриф над серединой стопы, стопы на ширине таза, хват чуть шире ног. Спина нейтральна, плечи чуть впереди грифа.',
    execution: [
      'Натяните гриф и уберите люфт, затем толкните пол ногами.',
      'Гриф идёт близко к голеням, таз и плечи поднимаются вместе.',
      'Вверху встаньте, не переразгибая поясницу; опускайте контролируемо.',
    ],
    breathing: 'Вдох и задержка перед съёмом, выдох после фиксации.',
    tempo: 'Контролируемый съём, без рывка; опускание 2–3 секунды.',
    rom: 'С пола до полного выпрямления, если позволяет техника.',
    primary: ['glutes', 'hamstrings', 'spinalErectors'],
    secondary: ['quads', 'lats', 'forearms', 'upperBack'],
    stabilizers: ['core', 'calves'],
    muscleMap: { glutes: 88, hamstrings: 82, spinalErectors: 88, quads: 65, lats: 52, forearms: 55, upperBack: 48, core: 45 },
    controls: [
      c('pull', 'Фаза', 0, 1, 0.01, 0.9, 'стоя', 'старт с пола'),
      c('knee', 'Сгибание колена', 0, 1, 0.05, 0.45, 'меньше', 'больше'),
      c('barPath', 'Гриф от ног', 0, 1, 0.05, 0, 'близко', 'далеко'),
      c('grip', 'Хват', 0, 1, 0.05, 0.2, 'двойной', 'разнохват'),
    ],
    shifts: [
      sh('pull', ['glutes', 'hamstrings', 'spinalErectors', 'quads'], [], ['hip', 'knee', 'spine'], [], 'Старт с пола: максимальная амплитуда и нагрузка на заднюю цепь.', 'Стоя: минимальный момент, фиксация.'),
      sh('knee', ['quads'], ['hamstrings', 'spinalErectors'], ['knee'], ['hip', 'spine'], 'Больше колена: больше квадрицепса и вертикальнее корпус.', 'Меньше колена: больше шарнир и нагрузка на заднюю цепь.'),
      sh('barPath', ['spinalErectors', 'hamstrings'], [], ['spine', 'hip'], [], 'Гриф далеко: опасно растёт плечо момента на поясницу.', 'Гриф близко: стабильнее.'),
      sh('grip', ['forearms', 'upperBack'], [], ['elbow'], [], 'Разнохват помогает удержать вес, но повышает асимметрию и риск для бицепса.', 'Двойной хват симметричнее, но требует силы хвата.'),
    ],
    angles: [
      angle('side.kneeFlex', 'Сгибание колена', 25, 100, '40–80°', 'Слишком прямые или чрезмерно согнутые колени.'),
      angle('side.torsoLean', 'Наклон корпуса', 40, 75, '50–68°', 'Чрезмерный наклон повышает нагрузку на поясницу.'),
      angle('side.elbowFlex', 'Прямые руки', 0, 25, '0–15°', 'Не сгибайте руки — это отнимает силу у спины.'),
    ],
    momentJoints: ['hip', 'spine'],
    mistakes: [
      { title: 'Гриф уходит вперёд', text: 'Плечи уходят за гриф, поясница перегружается. Держите гриф близко, натяните спину.' },
      { title: 'Рывок с пола', text: 'Таз поднимается раньше плеч, спина округляется. Натяните гриф и толкайте пол.' },
      { title: 'Переразгибание вверху', text: 'Не нужно отклоняться назад. Встаньте ровно и зафиксируйте.' },
    ],
    risks: [
      risk('Поясница', 'warning', 'Округление спины и удаление грифа от ног резко увеличивают момент на поясничный отдел.', 'Нейтральная спина, гриф близко, постепенная нагрузка; при боли остановитесь.'),
      risk('Бицепс при разнохвате', 'caution', 'Разнохват создаёт асимметричную нагрузку и риск для бицепса при резком сгибании руки.', 'Держите руку прямой, используйте двойной хват или ремни.'),
      risk('Колени', 'info', 'При сгибании колена внутрь растёт нагрузка на коленный сустав.', 'Держите колени по направлению стоп.'),
    ],
    faq: [
      q('Можно ли делать с круглой спиной?', 'Нет, это не рекомендуется как рабочий паттерн. Нейтральная спина снижает нагрузку на поясницу.'),
      q('Чем отличается от румынской?', 'Классическая начинается с пола и включает больше колена; румынская — шарнир с почти прямыми коленями.'),
    ],
    sources: ['nsca', 'neumann', 'mcgill', 'review'],
  },
  {
    id: 'sumoDeadlift',
    simId: 'deadlift',
    name: 'Сумо-становая',
    aliases: ['сумо', 'сумо-становая', 'sumo deadlift'],
    category: 'hinge',
    equipment: 'barbell',
    difficulty: 'advanced',
    summary: 'Широкая постановка и развёрнутые носки: больше приводящих и квадрицепса, короче амплитуда.',
    setup: 'Широкая постановка, носки развёрнуты, гриф над серединой стоп. Колени разведены, спина нейтральна.',
    execution: [
      'Разведите колени и натяните гриф.',
      'Толкайте пол, держа гриф близко к телу.',
      'Вверху выпрямитесь без переразгибания.',
    ],
    breathing: 'Вдох перед съёмом, выдох после фиксации.',
    tempo: 'Контролируемо, без рывка.',
    rom: 'С пола до полного выпрямления.',
    primary: ['glutes', 'quads', 'adductors'],
    secondary: ['hamstrings', 'spinalErectors', 'lats', 'forearms'],
    stabilizers: ['core', 'upperBack'],
    muscleMap: { glutes: 82, quads: 72, adductors: 68, hamstrings: 62, spinalErectors: 72, lats: 48, forearms: 50 },
    controls: [
      c('pull', 'Фаза', 0, 1, 0.01, 0.9, 'стоя', 'старт с пола'),
      c('stance', 'Ширина', 0, 1, 0.05, 0.75, 'уже', 'шире'),
      c('knee', 'Колени', 0, 1, 0.05, 0.55, 'меньше', 'больше'),
    ],
    shifts: [
      sh('pull', ['glutes', 'hamstrings', 'adductors'], [], ['hip', 'knee'], [], 'Старт: больше растяжение и нагрузка.', 'Стоя: фиксация.'),
      sh('stance', ['adductors', 'glutes'], ['quads'], ['hip'], ['knee'], 'Шире: больше приводящих и ягодичных, короче амплитуда.', 'Уже: больше квадрицепса и хода колена.'),
      sh('knee', ['quads'], ['hamstrings'], ['knee'], ['hip'], 'Больше колена: больше квадрицепса.', 'Меньше колена: больше шарнир и задняя цепь.'),
    ],
    angles: [
      angle('side.kneeFlex', 'Сгибание колена', 25, 100, '35–75°', 'Колени вне комфортного коридора.'),
      angle('side.torsoLean', 'Наклон корпуса', 35, 72, '45–65°', 'Слишком сильный наклон для контроля поясницы.'),
    ],
    momentJoints: ['hip', 'knee'],
    mistakes: [
      { title: 'Колени заваливаются внутрь', text: 'Теряется стабильность, растёт нагрузка на приводящие и колено. Разводите колени.' },
      { title: 'Слишком узкая постановка', text: 'Сумо превращается в классику, теряется смысл варианта.' },
    ],
    risks: [
      risk('Приводящие', 'caution', 'Широкая постановка увеличивает растяжение и нагрузку на аддукторы.', 'Постепенно увеличивайте ширину, разминайте приводящие, не работайте через боль.'),
      risk('Поясница', 'caution', 'Наклон и удаление грифа увеличивают момент.', 'Гриф близко, спина нейтральна.'),
    ],
    faq: [
      q('Сумо легче классики?', 'Не обязательно. Для одних короче амплитуда и меньше наклона, для других выше требования к подвижности таза и приводящим.'),
    ],
    sources: ['nsca', 'neumann', 'review'],
  },
  {
    id: 'goodMorning',
    simId: 'rdl',
    name: 'Good morning',
    aliases: ['good morning', 'наклон со штангой', 'гуд морнинг'],
    category: 'hinge',
    equipment: 'barbell',
    difficulty: 'advanced',
    summary: 'Штанга на спине, таз уходит назад, корпус наклоняется. Учит шарниру и нагружает заднюю цепь и разгибатели спины.',
    setup: 'Штанга на верхней части спины, ноги на ширине таза, колени мягко согнуты.',
    execution: [
      'Отводите таз назад, сохраняя нейтральную спину.',
      'Наклоняйтесь до комфортного угла, затем возвращайтесь.',
      'Не превращайте движение в присед.',
    ],
    breathing: 'Вдох перед наклоном, выдох на подъёме.',
    tempo: '2–3 секунды вниз.',
    rom: 'До 45–70° наклона или комфортного растяжения.',
    primary: ['hamstrings', 'glutes', 'spinalErectors'],
    secondary: ['core', 'upperBack'],
    stabilizers: ['calves'],
    muscleMap: { hamstrings: 80, glutes: 70, spinalErectors: 85, core: 42, upperBack: 40 },
    controls: [
      c('hinge', 'Глубина', 0.3, 1, 0.01, 0.8, 'выше', 'ниже'),
      c('knee', 'Колени', 0, 1, 0.05, 0.3, 'прямее', 'согнутее'),
    ],
    shifts: [
      sh('hinge', ['hamstrings', 'glutes', 'spinalErectors'], [], ['hip', 'spine'], [], 'Ниже: больше задняя цепь и поясница.', 'Выше: меньше амплитуда.'),
      sh('knee', ['quads'], ['hamstrings'], ['knee'], ['hip'], 'Больше колена: больше квадрицепса.', 'Меньше колена: больше шарнир.'),
    ],
    angles: [
      angle('side.kneeFlex', 'Колени', 10, 45, '15–30°', 'Слишком прямые или слишком согнутые.'),
      angle('side.torsoLean', 'Наклон', 30, 70, '40–60°', 'Слишком глубоко для контроля поясницы.'),
    ],
    momentJoints: ['hip', 'spine'],
    mistakes: [
      { title: 'Округление спины', text: 'Поясница теряет нейтраль. Уменьшите амплитуду и вес.' },
      { title: 'Приседание', text: 'Колени сгибаются слишком сильно, шарнир теряется.' },
    ],
    risks: [
      risk('Поясница', 'warning', 'Это упражнение с большим плечом момента на поясницу.', 'Начинайте с малым весом, держите нейтраль, не работайте через боль.'),
    ],
    faq: [
      q('Зачем делать good morning?', 'Для обучения шарниру и укрепления задней цепи; это не обязательное упражнение, если есть становая и RDL.'),
    ],
    sources: ['nsca', 'mcgill', 'review'],
  },
  {
    id: 'legPress',
    poseFamily: 'seated',
    name: 'Жим ногами',
    aliases: ['жим ногами', 'leg press'],
    category: 'squat',
    equipment: 'machine',
    difficulty: 'beginner',
    summary: 'Машинный жим ногами: нагрузка на квадрицепс и ягодицы без баланса корпуса.',
    setup: 'Спина и таз прижаты, стопы на платформе на ширине плеч.',
    execution: ['Опускайте платформу контролируемо.', 'Не отрывайте таз и поясницу.', 'Выжимайте через всю стопу.'],
    breathing: 'Вдох на опускании, выдох на жиме.',
    tempo: '2–3 секунды вниз.',
    rom: 'До комфортного сгибания, без отрыва таза.',
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings', 'adductors'],
    stabilizers: ['core', 'calves'],
    muscleMap: { quads: 92, glutes: 62, hamstrings: 35, adductors: 35, calves: 25, core: 25 },
    controls: [
      c('depth', 'Глубина', 0.3, 1, 0.01, 0.8, 'короткая', 'глубокая'),
      c('stance', 'Постановка', 0, 1, 0.05, 0.5, 'узко', 'широко'),
    ],
    shifts: [
      sh('depth', ['quads', 'glutes'], [], ['knee', 'hip'], [], 'Глубже: больше сгибание и нагрузка.', 'Мельче: меньше амплитуда.'),
      sh('stance', ['adductors', 'glutes'], ['quads'], ['hip'], ['knee'], 'Шире: больше приводящих и ягодичных.', 'Уже: больше квадрицепса.'),
    ],
    angles: [angle('side.kneeFlex', 'Сгибание колена', 70, 120, '80–110°', 'Не отрывайте таз в глубокой фазе.')],
    momentJoints: ['knee', 'hip'],
    mistakes: [{ title: 'Отрыв таза', text: 'Поясница округляется. Уменьшите глубину.' }],
    risks: [risk('Поясница', 'caution', 'Глубокая фаза с отрывом таза повышает нагрузку на поясницу.', 'Держите таз прижатым, уменьшите глубину.')],
    faq: [q('Можно ли заменить присед?', 'Как дополнение — да, но жим ногами не тренирует баланс и стабильность корпуса так, как присед.')],
    sources: ['nsca', 'neumann'],
  },
  {
    id: 'legExtension',
    poseFamily: 'seated',
    name: 'Разгибания ног',
    aliases: ['разгибания ног', 'leg extension'],
    category: 'accessory',
    equipment: 'machine',
    difficulty: 'beginner',
    summary: 'Изолированное разгибание колена: акцент на квадрицепс.',
    setup: 'Спина прижата, колено на оси тренажёра, валик над стопой.',
    execution: ['Разгибайте ногу контролируемо.', 'Не бейте по весу.', 'Вверху короткая пауза.'],
    breathing: 'Выдох на разгибании.',
    tempo: '2 секунды вверх, 3 вниз.',
    rom: 'До почти полного разгибания без боли.',
    primary: ['quads'],
    secondary: [],
    stabilizers: ['core'],
    muscleMap: { quads: 96, core: 15 },
    controls: [c('range', 'Амплитуда', 0.2, 1, 0.01, 0.85, 'короткая', 'полная')],
    shifts: [sh('range', ['quads'], [], ['knee'], [], 'Больше амплитуда: больше нагрузка на квадрицепс.', 'Меньше амплитуда: щадящий режим.')],
    angles: [angle('side.kneeFlex', 'Сгибание колена', 10, 110, '20–90°', 'Не работайте через острую боль в колене.')],
    momentJoints: ['knee'],
    mistakes: [{ title: 'Рывок весом', text: 'Инерция вместо мышцы. Контролируйте опускание.' }],
    risks: [risk('Передняя боль в колене', 'caution', 'Изоляция с большим весом повышает нагрузку на пателлофеморальный сустав.', 'Умеренный вес, контролируемая амплитуда.')],
    faq: [q('Нужно ли делать, если есть присед?', 'Как дополнение для объёма квадрицепса — да, если нет боли.')],
    sources: ['schoenfeld', 'neumann'],
  },
  {
    id: 'legCurl',
    poseFamily: 'lying',
    name: 'Сгибания ног лёжа',
    aliases: ['сгибания ног', 'leg curl'],
    category: 'accessory',
    equipment: 'machine',
    difficulty: 'beginner',
    summary: 'Изолированное сгибание колена: акцент на бицепс бедра.',
    setup: 'Лёжа на тренажёре, валик над пятками, таз прижат.',
    execution: ['Сгибайте ноги контролируемо.', 'Не поднимайте таз.', 'Медленно возвращайте.'],
    breathing: 'Выдох на сгибании.',
    tempo: '2 секунды вверх, 3 вниз.',
    rom: 'До комфортного сгибания.',
    primary: ['hamstrings'],
    secondary: ['calves'],
    stabilizers: ['core', 'glutes'],
    muscleMap: { hamstrings: 96, calves: 22, glutes: 20 },
    controls: [c('range', 'Амплитуда', 0.2, 1, 0.01, 0.85, 'короткая', 'полная')],
    shifts: [sh('range', ['hamstrings'], [], ['knee'], [], 'Больше амплитуда: больше нагрузка.', 'Меньше: щадящий режим.')],
    angles: [angle('side.kneeFlex', 'Сгибание колена', 20, 130, '40–110°', 'Без рывка и боли.')],
    momentJoints: ['knee'],
    mistakes: [{ title: 'Отрыв таза', text: 'Компенсация поясницей. Уменьшите вес.' }],
    risks: [risk('Бицепс бедра', 'caution', 'Резкое сгибание под нагрузкой может спровоцировать судорогу или растяжение.', 'Плавный темп, разминка.')],
    faq: [q('Это замена RDL?', 'Нет, это изоляция; RDL тренирует шарнир и растяжение под нагрузкой.')],
    sources: ['schoenfeld', 'neumann'],
  },
  {
    id: 'standingCalfRaise',
    poseFamily: 'standing',
    name: 'Подъём на носки стоя',
    aliases: ['подъём на носки', 'calf raise', 'икры стоя'],
    category: 'accessory',
    equipment: 'machine',
    difficulty: 'beginner',
    summary: 'Подъём на носки: акцент на икроножную мышцу.',
    setup: 'Носки на платформе, пятки свисают, колени почти прямые.',
    execution: ['Опустите пятки до растяжения.', 'Поднимитесь на носки.', 'Пауза вверху.'],
    breathing: 'Выдох на подъёме.',
    tempo: '2 секунды вверх, 3 вниз.',
    rom: 'Полная амплитуда без боли.',
    primary: ['calves'],
    secondary: ['tibialis'],
    stabilizers: ['core'],
    muscleMap: { calves: 96, tibialis: 20, core: 10 },
    controls: [c('range', 'Амплитуда', 0.2, 1, 0.01, 0.85, 'короткая', 'полная')],
    shifts: [sh('range', ['calves'], [], ['ankle'], [], 'Больше амплитуда: больше растяжение и работа.', 'Меньше: щадящий режим.')],
    angles: [],
    momentJoints: ['ankle'],
    mistakes: [{ title: 'Пружина', text: 'Быстрые отбивы. Делайте паузу.' }],
    risks: [risk('Ахилл', 'caution', 'Резкая нагрузка и глубокое растяжение могут раздражать ахиллово сухожилие.', 'Плавно, с разминкой, без боли.')],
    faq: [q('Помогает ли для приседа?', 'Икры участвуют в стабильности голеностопа, но не заменяют работу над подвижностью.')],
    sources: ['schoenfeld', 'neumann'],
  },
  {
    id: 'seatedCalfRaise',
    poseFamily: 'seated',
    name: 'Подъём на носки сидя',
    aliases: ['подъём на носки сидя', 'seated calf raise'],
    category: 'accessory',
    equipment: 'machine',
    difficulty: 'beginner',
    summary: 'Сгибание колена смещает акцент на камбаловидную мышцу.',
    setup: 'Сидя, колени согнуты, носки на платформе.',
    execution: ['Опустите пятки.', 'Поднимитесь, пауза.', 'Контролируйте опускание.'],
    breathing: 'Выдох на подъёме.',
    tempo: '2–3 секунды.',
    rom: 'Комфортная амплитуда.',
    primary: ['calves'],
    secondary: [],
    stabilizers: ['core'],
    muscleMap: { calves: 94, core: 10 },
    controls: [c('range', 'Амплитуда', 0.2, 1, 0.01, 0.85, 'короткая', 'полная')],
    shifts: [sh('range', ['calves'], [], ['ankle'], [], 'Больше амплитуда: больше работа.', 'Меньше: щадящий режим.')],
    angles: [],
    momentJoints: ['ankle'],
    mistakes: [{ title: 'Слишком быстрый темп', text: 'Камбаловидная не успевает работать.' }],
    risks: [risk('Ахилл', 'info', 'При боли в ахилле уменьшите амплитуду.', 'Плавный темп.')],
    faq: [q('Чем отличается от стоя?', 'Сидя колено согнуто, больше работает камбаловидная; стоя — икроножная.')],
    sources: ['neumann', 'schoenfeld'],
  },
  {
    id: 'bench',
    simId: 'bench',
    name: 'Жим лёжа',
    aliases: ['жим лёжа', 'жим лежа', 'bench press'],
    category: 'horizontalPush',
    equipment: 'barbell',
    difficulty: 'intermediate',
    summary: 'Горизонтальный жим: грудь, передние дельты и трицепс. Требует стабильной лопатки и контроля плеча.',
    setup: 'Лопатки сведены и прижаты, стопы на полу, гриф над плечами. Хват чуть шире плеч.',
    execution: [
      'Опускайте гриф к нижней части груди, локти под углом около 45–60°.',
      'Держите предплечья близко к вертикали.',
      'Выжимайте, не теряя положения лопаток.',
    ],
    breathing: 'Вдох на опускании, выдох на жиме.',
    tempo: '2 секунды вниз, 1 вверх.',
    rom: 'До касания груди без боли в плече.',
    primary: ['chest', 'triceps'],
    secondary: ['frontDelts', 'sideDelts'],
    stabilizers: ['core', 'upperBack'],
    muscleMap: { chest: 92, triceps: 68, frontDelts: 62, sideDelts: 30, core: 25, upperBack: 35 },
    controls: [
      c('depth', 'Глубина', 0.3, 1, 0.01, 0.9, 'короткая', 'до груди'),
      c('grip', 'Ширина хвата', 0, 1, 0.05, 0.5, 'узкий', 'широкий'),
      c('elbow', 'Разведение локтей', 0, 1, 0.05, 0.4, 'прижаты', 'разведены'),
      c('touch', 'Точка касания', 0, 1, 0.05, 0.5, 'ниже груди', 'выше груди'),
      c('bench', 'Наклон скамьи', 0, 1, 0.05, 0, 'плоская', 'наклон вверх'),
    ],
    shifts: [
      sh('depth', ['chest', 'triceps'], [], ['shoulder', 'elbow'], [], 'Глубже: больше растяжение груди и нагрузка на плечо.', 'Мельче: меньше амплитуда.'),
      sh('grip', ['chest', 'frontDelts'], ['triceps'], ['shoulder'], ['elbow'], 'Шире: больше грудь и плечо, меньше трицепс.', 'Уже: больше трицепс, меньше растяжение груди.'),
      sh('elbow', ['frontDelts', 'chest'], ['triceps'], ['shoulder'], ['elbow'], 'Локти разведены: больше переднее плечо и риск импинджмента.', 'Локти прижаты: больше трицепс, обычно безопаснее для плеча.'),
      sh('touch', ['chest', 'frontDelts'], ['triceps'], ['shoulder'], ['elbow'], 'Выше: больше передняя дельта и плечо.', 'Ниже: больше растяжение груди.'),
      sh('bench', ['chest', 'frontDelts'], ['triceps'], ['shoulder'], ['elbow'], 'Наклон вверх: больше верх груди и передняя дельта.', 'Плоская: больше общая грудь.'),
    ],
    angles: [
      angle('side.elbowFlex', 'Сгибание локтя', 70, 105, '80–95°', 'Локоть уходит слишком глубоко или не доходит.'),
      angle('side.shoulderFlex', 'Положение плеча', 45, 135, '60–110°', 'Плечо поднято слишком высоко к голове.'),
    ],
    momentJoints: ['shoulder', 'elbow'],
    mistakes: [
      { title: 'Лопатки теряют положение', text: 'Плечи уходят вперёд, растёт нагрузка на переднюю часть сустава. Сведите и прижмите лопатки.' },
      { title: 'Локти под 90°', text: 'Широкие локти повышают нагрузку на плечо. Держите угол около 45–60°.' },
      { title: 'Отрыв таза', text: 'Мост увеличивает прогиб и меняет положение плеча.' },
    ],
    risks: [
      risk('Плечевой сустав', 'warning', 'Широкий хват и разведённые локти повышают риск импинджмента и нагрузки на переднюю часть плеча.', 'Локти ближе к корпусу, контролируйте лопатки, не работайте через боль.'),
      risk('Грудь', 'caution', 'Глубокое растяжение под большим весом может перегрузить грудную мышцу.', 'Постепенная амплитуда, разминка.'),
      risk('Локоть', 'info', 'Избыточное разгибание и резкий темп нагружают сухожилия.', 'Контролируемый темп.'),
    ],
    faq: [
      q('Почему болит плечо?', 'Часто из-за широкого хвата, разведённых локтей или потери положения лопаток. Уменьшите вес, попробуйте угол 45–60° и проконсультируйтесь при боли.'),
      q('Как больше включить грудь?', 'Умеренно широкий хват, лопатки сведены, гриф к нижней части груди, контроль растяжения.'),
      q('Нужен ли мост?', 'Небольшой естественный прогиб допустим, но чрезмерный мост меняет положение плеча и не обязателен.'),
    ],
    sources: ['nsca', 'neumann', 'review'],
  },
  {
    id: 'inclineBench',
    simId: 'bench',
    name: 'Жим на наклонной скамье',
    aliases: ['жим на наклонной', 'наклонный жим', 'incline bench'],
    category: 'horizontalPush',
    equipment: 'barbell',
    difficulty: 'intermediate',
    summary: 'Жим под углом: больше верх груди и передняя дельта.',
    setup: 'Скамья 20–35°, лопатки сведены, стопы на полу.',
    execution: ['Опускайте к верхней части груди.', 'Локти под 45–60°.', 'Выжимайте без потери лопаток.'],
    breathing: 'Вдох вниз, выдох вверх.',
    tempo: '2–1.',
    rom: 'До касания без боли.',
    primary: ['chest', 'frontDelts'],
    secondary: ['triceps'],
    stabilizers: ['core', 'upperBack'],
    muscleMap: { chest: 88, frontDelts: 72, triceps: 62, sideDelts: 30, core: 22 },
    controls: [
      c('depth', 'Глубина', 0.3, 1, 0.01, 0.9, 'короткая', 'до груди'),
      c('grip', 'Хват', 0, 1, 0.05, 0.5, 'узкий', 'широкий'),
      c('elbow', 'Локти', 0, 1, 0.05, 0.4, 'прижаты', 'разведены'),
      c('bench', 'Угол скамьи', 0, 1, 0.05, 0.6, 'ниже', 'выше'),
    ],
    shifts: [
      sh('grip', ['chest'], ['triceps'], ['shoulder'], ['elbow'], 'Шире: больше грудь.', 'Уже: больше трицепс.'),
      sh('elbow', ['frontDelts'], ['triceps'], ['shoulder'], ['elbow'], 'Локти шире: больше плечо и риск.', 'Локти ближе: безопаснее.'),
      sh('bench', ['frontDelts'], ['chest'], ['shoulder'], [], 'Выше угол: больше передняя дельта.', 'Ниже: больше грудь.'),
    ],
    angles: [
      angle('side.elbowFlex', 'Сгибание локтя', 70, 105, '80–95°', 'Локоть вне коридора.'),
      angle('side.shoulderFlex', 'Плечо', 45, 135, '60–110°', 'Плечо слишком высоко.'),
    ],
    momentJoints: ['shoulder', 'elbow'],
    mistakes: [{ title: 'Слишком высокий угол', text: 'Превращается в жим плечами. 20–35° обычно достаточно.' }],
    risks: [risk('Плечо', 'caution', 'Наклон и широкий хват повышают нагрузку на переднюю часть плеча.', 'Умеренный угол, локти ближе.')],
    faq: [q('Чем отличается от плоского?', 'Больше верх груди и передняя дельта, меньше общая нагрузка на грудь.')],
    sources: ['nsca', 'neumann'],
  },
  {
    id: 'closeGripBench',
    simId: 'bench',
    name: 'Жим узким хватом',
    aliases: ['жим узким хватом', 'close grip bench'],
    category: 'horizontalPush',
    equipment: 'barbell',
    difficulty: 'intermediate',
    summary: 'Вариант жима с акцентом на трицепс и меньшим разведением локтей.',
    setup: 'Хват на ширине плеч или чуть уже, лопатки сведены.',
    execution: ['Опускайте к нижней части груди.', 'Локти ближе к корпусу.', 'Выжимайте трицепсом.'],
    breathing: 'Вдох вниз, выдох вверх.',
    tempo: '2–1.',
    rom: 'До касания без боли.',
    primary: ['triceps', 'chest'],
    secondary: ['frontDelts'],
    stabilizers: ['core', 'upperBack'],
    muscleMap: { triceps: 92, chest: 62, frontDelts: 40, core: 20 },
    controls: [
      c('depth', 'Глубина', 0.3, 1, 0.01, 0.9, 'короткая', 'до груди'),
      c('grip', 'Хват', 0, 1, 0.05, 0.25, 'уже', 'шире'),
    ],
    shifts: [
      sh('grip', ['chest'], ['triceps'], ['shoulder'], ['elbow'], 'Шире: больше грудь.', 'Уже: больше трицепс.'),
    ],
    angles: [angle('side.elbowFlex', 'Сгибание локтя', 70, 105, '80–95°', 'Локоть вне коридора.')],
    momentJoints: ['elbow', 'shoulder'],
    mistakes: [{ title: 'Слишком узкий хват', text: 'Нагрузка на запястья и локти. Держите комфортную ширину.' }],
    risks: [risk('Запястья и локти', 'caution', 'Очень узкий хват повышает нагрузку на суставы.', 'Комфортная ширина, разминка.')],
    faq: [q('Это замена французскому жиму?', 'Нет, но хорошо добавляет объём трицепсу.')],
    sources: ['nsca', 'schoenfeld'],
  },
  {
    id: 'overhead',
    simId: 'overhead',
    name: 'Жим над головой',
    aliases: ['жим над головой', 'жим стоя', 'overhead press', 'армейский жим'],
    category: 'verticalPush',
    equipment: 'barbell',
    difficulty: 'intermediate',
    summary: 'Вертикальный жим: плечи, трицепс и корпус. Требует контроля поясницы и подвижности плеча.',
    setup: 'Штанга на передних дельтах, хват чуть шире плеч, рёбра вниз, стопы на полу.',
    execution: [
      'Выжимайте штангу вверх, проводя её близко к лицу.',
      'В верхней точке руки над плечами, корпус не прогибается.',
      'Опускайте контролируемо к плечам.',
    ],
    breathing: 'Вдох перед жимом, выдох вверху.',
    tempo: '2 секунды вверх, 2 вниз.',
    rom: 'От плеч до полного выпрямления без боли.',
    primary: ['frontDelts', 'triceps'],
    secondary: ['sideDelts', 'upperBack', 'core'],
    stabilizers: ['spinalErectors', 'calves'],
    muscleMap: { frontDelts: 88, sideDelts: 62, triceps: 72, upperBack: 48, core: 52, spinalErectors: 35 },
    controls: [
      c('press', 'Фаза', 0, 1, 0.01, 0.9, 'у плеч', 'над головой'),
      c('grip', 'Хват', 0, 1, 0.05, 0.5, 'узкий', 'широкий'),
      c('elbow', 'Локти', 0, 1, 0.05, 0.4, 'вперёд', 'в стороны'),
      c('lean', 'Наклон корпуса', -1, 1, 0.05, 0, 'вертикально', 'больше прогиба'),
    ],
    shifts: [
      sh('press', ['frontDelts', 'triceps', 'upperBack'], [], ['shoulder', 'elbow'], [], 'Выше: больше подъём плеча и работа трицепса.', 'У плеч: меньше амплитуда.'),
      sh('grip', ['sideDelts', 'frontDelts'], ['triceps'], ['shoulder'], ['elbow'], 'Шире: больше дельты, меньше трицепс.', 'Уже: больше трицепс.'),
      sh('elbow', ['frontDelts'], ['sideDelts'], ['shoulder'], [], 'Локти в стороны: больше средняя дельта и риск конфликта.', 'Локти вперёд: больше передняя дельта/трицепс.'),
      sh('lean', ['frontDelts', 'spinalErectors'], ['core'], ['spine'], ['shoulder'], 'Прогиб: больше верх груди и поясница.', 'Вертикально: больше корпус и плечи.'),
    ],
    angles: [
      angle('side.shoulderFlex', 'Подъём плеча', 160, 205, '170–195°', 'Руки не выходят в полную амплитуду.'),
      angle('side.elbowFlex', 'Выпрямление локтя', 0, 30, '0–15°', 'Локти остаются согнутыми.'),
      angle('side.torsoLean', 'Корпус без прогиба', 0, 15, '0–8°', 'Прогиб переносит нагрузку на поясницу.'),
    ],
    momentJoints: ['shoulder', 'elbow'],
    mistakes: [
      { title: 'Прогиб в пояснице', text: 'Рёбра уходят вперёд. Держите кор и ягодицы активными.' },
      { title: 'Штанга уходит вперёд', text: 'Растёт нагрузка на плечо. Ведите гриф близко к лицу.' },
    ],
    risks: [
      risk('Плечевой импинджмент', 'warning', 'Большой подъём плеча и разведение локтей могут повышать риск конфликта, особенно при боли.', 'Комфортная амплитуда, локти чуть вперёд, не работайте через боль.'),
      risk('Поясница', 'caution', 'Прогиб и задержка дыхания повышают нагрузку.', 'Рёбра вниз, кор напряжён, умеренный вес.'),
    ],
    faq: [
      q('Можно ли за голову?', 'Не рекомендуется как основной вариант: повышается риск для плеча и шеи.'),
      q('Почему болит плечо?', 'Часто из-за недостаточной подвижности, широкого хвата или прогиба. Уменьшите амплитуду и проконсультируйтесь при боли.'),
    ],
    sources: ['nsca', 'neumann', 'review'],
  },
  {
    id: 'lateralRaise',
    poseFamily: 'standing',
    name: 'Махи в стороны',
    aliases: ['махи в стороны', 'lateral raise', 'разведения гантелей'],
    category: 'accessory',
    equipment: 'dumbbell',
    difficulty: 'beginner',
    summary: 'Изоляция средней дельты. Не требует большого веса.',
    setup: 'Стоя, гантели по бокам, локти чуть согнуты.',
    execution: ['Поднимайте руки в стороны до уровня плеч.', 'Не поднимайте плечи к ушам.', 'Опускайте контролируемо.'],
    breathing: 'Выдох на подъёме.',
    tempo: '2 секунды вверх, 3 вниз.',
    rom: 'До уровня плеч или чуть ниже.',
    primary: ['sideDelts'],
    secondary: ['frontDelts', 'upperBack'],
    stabilizers: ['core'],
    muscleMap: { sideDelts: 96, frontDelts: 28, upperBack: 25, core: 15 },
    controls: [c('range', 'Высота', 0.2, 1, 0.01, 0.8, 'ниже', 'до плеч'), c('elbow', 'Сгибание локтя', 0, 1, 0.05, 0.3, 'прямее', 'согнутее')],
    shifts: [sh('range', ['sideDelts'], [], ['shoulder'], [], 'Выше: больше средняя дельта, но выше риск при боли.', 'Ниже: щадящий режим.'), sh('elbow', ['sideDelts'], ['frontDelts'], ['shoulder'], [], 'Больше сгибание: короче рычаг.', 'Прямее: длиннее рычаг.')],
    angles: [angle('side.shoulderFlex', 'Подъём плеча', 40, 100, '60–90°', 'Не уходите выше комфортного уровня.')],
    momentJoints: ['shoulder'],
    mistakes: [{ title: 'Инерция', text: 'Рывок корпусом. Возьмите меньше вес.' }],
    risks: [risk('Плечо', 'caution', 'Подъём выше плеча с внутренней ротацией может повышать риск импинджмента.', 'До уровня плеч, без боли.')],
    faq: [q('Нужно ли выше плеч?', 'Не обязательно. Средняя дельта хорошо работает до уровня плеч.')],
    sources: ['schoenfeld', 'neumann'],
  },
  {
    id: 'row',
    simId: 'row',
    name: 'Тяга штанги в наклоне',
    aliases: ['тяга в наклоне', 'тяга штанги', 'barbell row'],
    category: 'horizontalPull',
    equipment: 'barbell',
    difficulty: 'intermediate',
    summary: 'Горизонтальная тяга: широчайшие, верх спины, задние дельты и бицепс.',
    setup: 'Наклон 35–50°, спина нейтральна, штанга в руках.',
    execution: ['Тяните локти назад к поясу.', 'Не выпрямляйте корпус рывком.', 'Опускайте контролируемо.'],
    breathing: 'Выдох на тяге.',
    tempo: '1–2 секунды тяга, 3 опускание.',
    rom: 'До касания живота/пояса.',
    primary: ['lats', 'upperBack'],
    secondary: ['rearDelts', 'biceps', 'spinalErectors'],
    stabilizers: ['core', 'forearms'],
    muscleMap: { lats: 82, upperBack: 78, rearDelts: 55, biceps: 52, spinalErectors: 58, core: 42 },
    controls: [
      c('pull', 'Фаза', 0, 1, 0.01, 0.9, 'руки вниз', 'локоть у пояса'),
      c('torso', 'Наклон корпуса', 0, 1, 0.05, 0.5, 'вертикальнее', 'ниже'),
      c('grip', 'Хват', 0, 1, 0.05, 0.5, 'узкий', 'широкий'),
      c('height', 'Высота тяги', 0, 1, 0.05, 0.4, 'к поясу', 'к груди'),
    ],
    shifts: [
      sh('pull', ['lats', 'upperBack', 'biceps'], [], ['shoulder', 'elbow'], [], 'Тяга: больше широчайшие и верх спины.', 'Руки вниз: меньше амплитуда.'),
      sh('torso', ['lats', 'spinalErectors'], ['upperBack', 'rearDelts'], ['spine', 'hip'], ['shoulder'], 'Ниже корпус: больше широчайшие и поясница.', 'Вертикальнее: больше верх трапеций и задние дельты.'),
      sh('grip', ['rearDelts', 'upperBack'], ['lats', 'biceps'], ['shoulder'], ['elbow'], 'Шире: больше задние дельты и ромбовидные.', 'Уже: больше широчайшие и бицепс.'),
      sh('height', ['upperBack', 'rearDelts'], ['lats'], ['shoulder'], [], 'Выше к груди: больше верх спины и задние дельты.', 'К поясу: больше широчайшие.'),
    ],
    angles: [
      angle('side.torsoLean', 'Наклон корпуса', 25, 60, '35–50°', 'Слишком вертикально или слишком низко.'),
      angle('side.elbowFlex', 'Сгибание локтя', 55, 115, '75–95°', 'Тяга не доходит или локоть пересогнут.'),
      angle('side.kneeFlex', 'Мягкие колени', 10, 50, '18–35°', 'Колени полностью прямые.'),
    ],
    momentJoints: ['hip', 'spine'],
    mistakes: [{ title: 'Рывок корпусом', text: 'Тяга за счёт разгибания спины. Зафиксируйте корпус.' }, { title: 'Плечи к ушам', text: 'Включаются трапеции вместо широчайших.' }],
    risks: [risk('Поясница', 'caution', 'Наклон и рывок повышают нагрузку.', 'Нейтральная спина, без рывка.'), risk('Локоть/бицепс', 'info', 'Резкая тяга перегружает сухожилия.', 'Контролируемый темп.')],
    faq: [q('Какая тяга лучше?', 'Зависит от цели: к поясу — больше широчайшие, к груди — верх спины и задние дельты.')],
    sources: ['nsca', 'neumann', 'review'],
  },
  {
    id: 'dumbbellRow',
    simId: 'row',
    name: 'Тяга гантели одной рукой',
    aliases: ['тяга гантели', 'dumbbell row', 'тяга в наклоне одной рукой'],
    category: 'horizontalPull',
    equipment: 'dumbbell',
    difficulty: 'beginner',
    summary: 'Односторонняя тяга: широчайшие, верх спины и бицепс, меньше осевой нагрузки.',
    setup: 'Опора рукой на скамью, спина нейтральна, гантель в свободной руке.',
    execution: ['Тяните локоть к тазу.', 'Не разворачивайте корпус.', 'Опускайте контролируемо.'],
    breathing: 'Выдох на тяге.',
    tempo: '1–2 вверх, 3 вниз.',
    rom: 'До уровня пояса.',
    primary: ['lats', 'upperBack'],
    secondary: ['biceps', 'rearDelts'],
    stabilizers: ['core', 'forearms'],
    muscleMap: { lats: 86, upperBack: 68, biceps: 56, rearDelts: 45, core: 35 },
    controls: [c('pull', 'Фаза', 0, 1, 0.01, 0.9, 'вниз', 'к поясу'), c('torso', 'Наклон', 0, 1, 0.05, 0.5, 'выше', 'ниже'), c('elbow', 'Локоть', 0, 1, 0.05, 0.4, 'ближе', 'дальше')],
    shifts: [sh('pull', ['lats', 'upperBack'], [], ['shoulder', 'elbow'], [], 'Тяга: больше широчайшие.', 'Вниз: меньше амплитуда.'), sh('torso', ['lats'], ['upperBack'], ['spine'], [], 'Ниже: больше широчайшие и поясница.', 'Выше: больше верх спины.'), sh('elbow', ['lats'], ['rearDelts'], ['shoulder'], ['elbow'], 'Локоть ближе: больше широчайшие.', 'Дальше: больше задняя дельта.')],
    angles: [angle('side.torsoLean', 'Наклон', 20, 55, '30–45°', 'Слишком вертикально или низко.'), angle('side.elbowFlex', 'Локоть', 55, 115, '75–95°', 'Тяга не доходит.')],
    momentJoints: ['hip', 'spine'],
    mistakes: [{ title: 'Разворот корпуса', text: 'Помогает поднять вес, но снижает работу мышц.' }],
    risks: [risk('Поясница', 'info', 'Опора и наклон снижают осевую нагрузку, но контроль нужен.', 'Нейтральная спина.')],
    faq: [q('Можно ли без скамьи?', 'Да, с опорой на стойку или в наклоне, но стабильность важнее веса.')],
    sources: ['nsca', 'neumann'],
  },
  {
    id: 'latPulldown',
    poseFamily: 'seated',
    name: 'Тяга верхнего блока',
    aliases: ['верхний блок', 'lat pulldown', 'тяга сверху'],
    category: 'verticalPull',
    equipment: 'cable',
    difficulty: 'beginner',
    summary: 'Вертикальная тяга сидя: широчайшие и бицепс, вариант подтягиваний с регулируемым весом.',
    setup: 'Колени зафиксированы, спина нейтральна, хват чуть шире плеч.',
    execution: ['Тяните локти вниз к рёбрам.', 'Не отклоняйтесь сильно назад.', 'Возвращайте рукоять контролируемо.'],
    breathing: 'Выдох на тяге.',
    tempo: '2–3 секунды.',
    rom: 'До уровня подбородка/верхней груди.',
    primary: ['lats', 'biceps'],
    secondary: ['upperBack', 'rearDelts'],
    stabilizers: ['core'],
    muscleMap: { lats: 88, biceps: 62, upperBack: 52, rearDelts: 35, core: 20 },
    controls: [c('range', 'Амплитуда', 0.3, 1, 0.01, 0.9, 'короткая', 'полная'), c('grip', 'Хват', 0, 1, 0.05, 0.5, 'узкий', 'широкий'), c('lean', 'Наклон', 0, 1, 0.05, 0.2, 'вертикально', 'назад')],
    shifts: [sh('range', ['lats', 'biceps'], [], ['shoulder', 'elbow'], [], 'Больше амплитуда: больше тяга.', 'Меньше: щадящий режим.'), sh('grip', ['lats'], ['biceps'], ['shoulder'], ['elbow'], 'Шире: больше широчайшие.', 'Уже: больше бицепс.'), sh('lean', ['lats'], ['upperBack'], ['spine'], [], 'Наклон назад: больше нижние широчайшие и поясница.', 'Вертикально: чище тяга.')],
    angles: [angle('side.shoulderFlex', 'Плечо', 60, 150, '80–130°', 'Не тяните за счёт плеча.'), angle('side.elbowFlex', 'Локоть', 60, 130, '80–115°', 'Локоть не доходит.')],
    momentJoints: ['shoulder', 'elbow'],
    mistakes: [{ title: 'Тяга за голову', text: 'Повышает риск для плеча. Тяните к груди.' }],
    risks: [risk('Плечо', 'warning', 'Тяга за голову и широкий хват могут повышать риск импинджмента.', 'Тяните к груди, комфортный хват.')],
    faq: [q('Заменяет подтягивания?', 'Частично: регулируемый вес помогает освоить тягу, но подтягивания добавляют работу с собственным весом.')],
    sources: ['nsca', 'neumann'],
  },
  {
    id: 'pullup',
    simId: 'pullup',
    name: 'Подтягивания',
    aliases: ['подтягивания', 'pull-up', 'pullup'],
    category: 'verticalPull',
    equipment: 'bodyweight',
    difficulty: 'intermediate',
    summary: 'Вертикальная тяга собственным весом: широчайшие, бицепс, верх спины и корпус.',
    setup: 'Вис на перекладине, хват чуть шире плеч, лопатки опущены.',
    execution: ['Тяните локти вниз к рёбрам.', 'Не тянитесь шеей.', 'Опускайтесь контролируемо.'],
    breathing: 'Выдох на подъёме.',
    tempo: '1–2 вверх, 2–3 вниз.',
    rom: 'От полного виса до подбородка над перекладиной.',
    primary: ['lats', 'biceps'],
    secondary: ['upperBack', 'core', 'forearms'],
    stabilizers: ['core', 'rearDelts'],
    muscleMap: { lats: 92, biceps: 68, upperBack: 58, forearms: 48, core: 45, rearDelts: 36 },
    controls: [c('range', 'Амплитуда', 0.2, 1, 0.01, 0.9, 'верх', 'полный вис'), c('grip', 'Хват', 0, 1, 0.05, 0.5, 'узкий', 'широкий'), c('lean', 'Наклон', 0, 1, 0.05, 0.2, 'вертикально', 'назад')],
    shifts: [sh('range', ['lats', 'biceps'], [], ['shoulder', 'elbow'], [], 'Больше амплитуда: больше тяга.', 'Меньше: щадящий режим.'), sh('grip', ['lats'], ['biceps'], ['shoulder'], ['elbow'], 'Шире: больше широчайшие.', 'Уже: больше бицепс.'), sh('lean', ['lats', 'core'], ['upperBack'], ['spine'], [], 'Наклон назад: больше нижние широчайшие и кор.', 'Вертикально: чище.')],
    angles: [angle('side.elbowFlex', 'Сгибание локтя', 80, 155, '105–145°', 'Подтягивание не доходит до верха.')],
    momentJoints: ['shoulder', 'elbow'],
    mistakes: [{ title: 'Рывок корпусом', text: 'Киппинг помогает, но снижает контроль. Для техники — без маха.' }, { title: 'Плечи к ушам', text: 'Нет депрессии лопаток.' }],
    risks: [risk('Плечо', 'caution', 'Широкий хват и резкий вис повышают нагрузку на плечо.', 'Комфортный хват, контроль лопаток.'), risk('Бицепс/локоть', 'info', 'Супинированный узкий хват увеличивает нагрузку на бицепс.', 'Не работайте через боль.')],
    faq: [q('Почему не получается?', 'Часто не хватает силы тяги или контроля лопаток. Начните с верхнего блока и негативов.'), q('Широкий хват лучше?', 'Не обязательно. Широкий смещает на широчайшие, узкий — на бицепс.')],
    sources: ['nsca', 'neumann', 'review'],
  },
  {
    id: 'dips',
    simId: 'dips',
    name: 'Отжимания на брусьях',
    aliases: ['брусья', 'отжимания на брусьях', 'dips'],
    category: 'horizontalPush',
    equipment: 'bodyweight',
    difficulty: 'intermediate',
    summary: 'Вертикальный жим собственным весом: грудь, трицепс и передние дельты. Требует контроля плеча.',
    setup: 'Упор на брусьях, плечи опущены, локти чуть согнуты.',
    execution: ['Опускайтесь до комфортной глубины.', 'Локти идут назад, не в стороны.', 'Выжимайте без раскачки.'],
    breathing: 'Вдох вниз, выдох вверх.',
    tempo: '2–1.',
    rom: 'До комфортного сгибания локтя, без боли в плече.',
    primary: ['chest', 'triceps'],
    secondary: ['frontDelts'],
    stabilizers: ['core', 'upperBack'],
    muscleMap: { chest: 78, triceps: 82, frontDelts: 56, core: 32, upperBack: 25 },
    controls: [c('depth', 'Глубина', 0.3, 1, 0.01, 0.85, 'короткая', 'глубокая'), c('lean', 'Наклон', 0, 1, 0.05, 0.4, 'вертикально', 'вперёд'), c('flare', 'Локти', 0, 1, 0.05, 0.3, 'ближе', 'шире')],
    shifts: [sh('depth', ['chest', 'triceps'], [], ['shoulder', 'elbow'], [], 'Глубже: больше растяжение и нагрузка.', 'Мельче: щадящий режим.'), sh('lean', ['chest'], ['triceps'], ['shoulder'], ['elbow'], 'Вперёд: больше грудь.', 'Вертикально: больше трицепс.'), sh('flare', ['frontDelts'], ['triceps'], ['shoulder'], ['elbow'], 'Локти шире: больше плечо и риск.', 'Локти ближе: безопаснее.')],
    angles: [angle('side.elbowFlex', 'Глубина по локтю', 65, 115, '80–100°', 'Слишком мелко или глубоко.'), angle('side.torsoLean', 'Наклон корпуса', 0, 25, '5–15°', 'Корпус раскачивается.')],
    momentJoints: ['shoulder', 'elbow'],
    mistakes: [{ title: 'Слишком глубоко', text: 'Плечо уходит в крайнее положение. Остановитесь до боли.' }, { title: 'Локти в стороны', text: 'Повышают нагрузку на плечо.' }],
    risks: [risk('Переднее плечо', 'warning', 'Глубина и разведённые локти повышают риск импинджмента.', 'Локти назад, комфортная глубина.')],
    faq: [q('Можно ли заменить брусья?', 'Да, жимом узким хватом или отжиманиями, если нет боли в плече.')],
    sources: ['nsca', 'neumann'],
  },
  {
    id: 'pushUp',
    poseFamily: 'plank',
    name: 'Отжимания от пола',
    aliases: ['отжимания', 'push-up', 'pushup'],
    category: 'horizontalPush',
    equipment: 'bodyweight',
    difficulty: 'beginner',
    summary: 'Жим собственным весом: грудь, трицепс, передние дельты и корпус.',
    setup: 'Ладони чуть шире плеч, корпус в одной линии, ягодицы и корпус напряжены.',
    execution: ['Опускайтесь, пока грудь почти не коснётся пола.', 'Локти под 45–60°.', 'Выжимайте, не проваливая поясницу.'],
    breathing: 'Вдох вниз, выдох вверх.',
    tempo: '2–1.',
    rom: 'До комфортной глубины.',
    primary: ['chest', 'triceps'],
    secondary: ['frontDelts', 'core'],
    stabilizers: ['core', 'upperBack'],
    muscleMap: { chest: 82, triceps: 68, frontDelts: 52, core: 48, upperBack: 25 },
    controls: [c('depth', 'Глубина', 0.3, 1, 0.01, 0.85, 'короткая', 'глубокая'), c('width', 'Постановка рук', 0, 1, 0.05, 0.5, 'узко', 'широко'), c('elbow', 'Локти', 0, 1, 0.05, 0.4, 'ближе', 'шире')],
    shifts: [sh('depth', ['chest', 'triceps'], [], ['shoulder', 'elbow'], [], 'Глубже: больше нагрузка.', 'Мельче: щадящий режим.'), sh('width', ['chest'], ['triceps'], ['shoulder'], ['elbow'], 'Шире: больше грудь.', 'Уже: больше трицепс.'), sh('elbow', ['frontDelts'], ['triceps'], ['shoulder'], ['elbow'], 'Локти шире: больше плечо.', 'Локти ближе: безопаснее.')],
    angles: [angle('side.elbowFlex', 'Сгибание локтя', 60, 110, '75–95°', 'Глубина вне коридора.')],
    momentJoints: ['shoulder', 'elbow'],
    mistakes: [{ title: 'Провал поясницы', text: 'Корпус не в линии. Напрягите ягодицы и кор.' }],
    risks: [risk('Плечо', 'caution', 'Широкие локти и глубокое опускание повышают нагрузку.', 'Локти ближе, комфортная глубина.')],
    faq: [q('С колен — это нормально?', 'Да, это облегчённый вариант для освоения техники.')],
    sources: ['nsca', 'neumann'],
  },
  {
    id: 'bulgarian',
    simId: 'bulgarian',
    name: 'Болгарский сплит-присед',
    aliases: ['болгарский', 'болгарский сплит-присед', 'bulgarian split squat'],
    category: 'lunge',
    equipment: 'dumbbell',
    difficulty: 'intermediate',
    summary: 'Односторонний присед с задней ногой на возвышении: квадрицепс, ягодицы и баланс.',
    setup: 'Задняя стопа на скамье, передняя на удобном расстоянии, корпус почти вертикально.',
    execution: ['Опускайтесь вниз, переднее колено над стопой.', 'Держите таз ровно.', 'Вставайте через переднюю ногу.'],
    breathing: 'Вдох вниз, выдох вверх.',
    tempo: '2–3 вниз.',
    rom: 'До комфортной глубины без боли в колене.',
    primary: ['quads', 'glutes'],
    secondary: ['adductors', 'hamstrings'],
    stabilizers: ['core', 'calves'],
    muscleMap: { quads: 82, glutes: 72, adductors: 36, hamstrings: 30, core: 42, calves: 30 },
    controls: [c('depth', 'Глубина', 0.3, 1, 0.01, 0.85, 'выше', 'ниже'), c('step', 'Длина шага', 0, 1, 0.05, 0.5, 'короткий', 'длинный'), c('lean', 'Наклон', -1, 1, 0.05, 0, 'вертикально', 'вперёд'), c('kneeTrack', 'Колено', 0, 1, 0.05, 0.3, 'внутрь', 'по носку')],
    shifts: [sh('depth', ['quads', 'glutes'], [], ['knee', 'hip'], [], 'Глубже: больше нагрузка.', 'Выше: щадящий режим.'), sh('step', ['glutes', 'hamstrings'], ['quads'], ['hip'], ['knee'], 'Длиннее шаг: больше ягодицы/задняя цепь.', 'Короткий: больше квадрицепс.'), sh('lean', ['glutes'], ['quads'], ['hip'], ['knee'], 'Наклон: больше ягодицы.', 'Вертикально: больше квадрицепс.'), sh('kneeTrack', ['quads'], [], ['knee'], [], 'Колено по носку: стабильнее.', 'Завал внутрь: выше нагрузка на колено.')],
    angles: [angle('side.kneeFlex', 'Сгибание переднего колена', 65, 115, '80–100°', 'Глубина вне коридора.'), angle('side.hipFlex', 'Глубина', 70, 135, '90–115°', 'Таз не опускается или проваливается.'), angle('side.torsoLean', 'Корпус', 0, 20, '0–12°', 'Наклон усложняет баланс.')],
    momentJoints: ['knee', 'hip'],
    mistakes: [{ title: 'Задняя нога слишком близко', text: 'Колено уходит далеко вперёд, теряется баланс.' }, { title: 'Колено внутрь', text: 'Повышает нагрузку на колено.' }],
    risks: [risk('Колено', 'caution', 'Глубокий односторонний присед повышает требование к колену.', 'Контролируйте колено по носку, без боли.'), risk('Баланс', 'info', 'Высокий риск потери равновесия.', 'Начните с опоры.')],
    faq: [q('Чем лучше выпада?', 'Больше односторонней нагрузки и меньше осевой, но выше требования к балансу.')],
    sources: ['nsca', 'neumann'],
  },
  {
    id: 'lunge',
    simId: 'lunge',
    name: 'Выпад с гантелями',
    aliases: ['выпад', 'выпады', 'lunge'],
    category: 'lunge',
    equipment: 'dumbbell',
    difficulty: 'beginner',
    summary: 'Одностороннее движение: квадрицепс, ягодицы, баланс и контроль колена.',
    setup: 'Гантели в руках, корпус вертикально, стопы на ширине таза.',
    execution: ['Шагните и опуститесь до комфортной глубины.', 'Переднее колено над стопой.', 'Оттолкнитесь передней ногой.'],
    breathing: 'Вдох вниз, выдох вверх.',
    tempo: '2–3 вниз.',
    rom: 'До комфортной глубины.',
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings'],
    stabilizers: ['core', 'calves'],
    muscleMap: { quads: 76, glutes: 68, hamstrings: 36, core: 38, calves: 30 },
    controls: [c('depth', 'Глубина', 0.3, 1, 0.01, 0.85, 'выше', 'ниже'), c('step', 'Шаг', 0, 1, 0.05, 0.5, 'короткий', 'длинный'), c('lean', 'Наклон', -1, 1, 0.05, 0, 'вертикально', 'вперёд'), c('kneeTrack', 'Колено', 0, 1, 0.05, 0.3, 'внутрь', 'по носку')],
    shifts: [sh('depth', ['quads', 'glutes'], [], ['knee', 'hip'], [], 'Глубже: больше нагрузка.', 'Выше: щадящий режим.'), sh('step', ['glutes'], ['quads'], ['hip'], ['knee'], 'Длиннее шаг: больше ягодицы.', 'Короче: больше квадрицепс.'), sh('lean', ['glutes'], ['quads'], ['hip'], ['knee'], 'Наклон: больше ягодицы.', 'Вертикально: больше квадрицепс.'), sh('kneeTrack', ['quads'], [], ['knee'], [], 'Колено по носку: стабильнее.', 'Завал внутрь: риск.')],
    angles: [angle('side.kneeFlex', 'Сгибание колена', 65, 115, '80–100°', 'Глубина вне коридора.'), angle('side.hipFlex', 'Глубина', 70, 135, '90–115°', 'Таз не опускается.'), angle('side.torsoLean', 'Корпус', 0, 20, '0–12°', 'Наклон усложняет баланс.')],
    momentJoints: ['knee', 'hip'],
    mistakes: [{ title: 'Колено внутрь', text: 'Повышает нагрузку на колено.' }, { title: 'Слишком короткий шаг', text: 'Колено уходит далеко вперёд.' }],
    risks: [risk('Колено', 'caution', 'Глубина и завал внутрь повышают нагрузку.', 'Колено по носку, без боли.'), risk('Баланс', 'info', 'Потеря равновесия.', 'Начните с опоры.')],
    faq: [q('Нужно ли касаться коленом пола?', 'Нет, до комфортной глубины.')],
    sources: ['nsca', 'neumann'],
  },
  {
    id: 'hipThrust',
    poseFamily: 'hipThrust',
    name: 'Ягодичный мост / hip thrust',
    aliases: ['ягодичный мост', 'hip thrust', 'мост'],
    category: 'hinge',
    equipment: 'barbell',
    difficulty: 'beginner',
    summary: 'Разгибание бедра с опорой на скамью: акцент на ягодичные, меньше осевой нагрузки.',
    setup: 'Лопатки на скамье, стопы на полу, колени согнуты, таз под штангой.',
    execution: ['Поднимайте таз за счёт ягодиц.', 'Не переразгибайте поясницу.', 'Опускайтесь контролируемо.'],
    breathing: 'Выдох на подъёме.',
    tempo: '1–2 вверх, 2 вниз.',
    rom: 'До линии корпуса без прогиба.',
    primary: ['glutes'],
    secondary: ['hamstrings', 'quads'],
    stabilizers: ['core'],
    muscleMap: { glutes: 94, hamstrings: 68, quads: 35, core: 40 },
    controls: [c('range', 'Амплитуда', 0.2, 1, 0.01, 0.9, 'ниже', 'полная'), c('bench', 'Высота скамьи', 0, 1, 0.05, 0.5, 'ниже', 'выше'), c('foot', 'Положение стоп', 0, 1, 0.05, 0.5, 'ближе', 'дальше')],
    shifts: [sh('range', ['glutes', 'hamstrings'], [], ['hip'], [], 'Больше амплитуда: больше ягодицы.', 'Меньше: щадящий режим.'), sh('foot', ['hamstrings'], ['quads'], ['knee', 'hip'], [], 'Стопы дальше: больше бицепс бедра.', 'Ближе: больше квадрицепс.')],
    angles: [angle('side.hipFlex', 'Разгибание бедра', 0, 40, '10–30°', 'Не переразгибайте поясницу.')],
    momentJoints: ['hip'],
    mistakes: [{ title: 'Прогиб поясницы', text: 'Таз поднимается за счёт спины. Остановитесь до переразгибания.' }],
    risks: [risk('Поясница', 'caution', 'Переразгибание и ребра вверх повышают нагрузку.', 'Держите рёбра вниз, заканчивайте на линии корпуса.')],
    faq: [q('Чем отличается от моста?', 'Hip thrust с опорой на скамью даёт больше амплитуды.')],
    sources: ['schoenfeld', 'nsca'],
  },
  {
    id: 'bicepsCurl',
    poseFamily: 'standing',
    name: 'Сгибания на бицепс',
    aliases: ['бицепс', 'сгибания на бицепс', 'biceps curl'],
    category: 'accessory',
    equipment: 'dumbbell',
    difficulty: 'beginner',
    summary: 'Изоляция бицепса: сгибание локтя без движения плеча.',
    setup: 'Стоя, руки вдоль тела, локти у корпуса.',
    execution: ['Сгибайте локти, не выводя плечи вперёд.', 'Пауза вверху.', 'Опускайте контролируемо.'],
    breathing: 'Выдох на сгибании.',
    tempo: '2 вверх, 3 вниз.',
    rom: 'До комфортного сгибания.',
    primary: ['biceps'],
    secondary: ['forearms'],
    stabilizers: ['core'],
    muscleMap: { biceps: 92, forearms: 45, core: 10 },
    controls: [c('range', 'Амплитуда', 0.2, 1, 0.01, 0.85, 'короткая', 'полная')],
    shifts: [sh('range', ['biceps'], [], ['elbow'], [], 'Больше амплитуда: больше нагрузка.', 'Меньше: щадящий режим.')],
    angles: [angle('side.elbowFlex', 'Сгибание локтя', 20, 130, '40–110°', 'Без рывка.')],
    momentJoints: ['elbow'],
    mistakes: [{ title: 'Раскачка корпусом', text: 'Инерция вместо бицепса.' }],
    risks: [risk('Локоть', 'info', 'Резкий темп и большой вес нагружают сухожилия.', 'Контролируемый темп.')],
    faq: [q('Нужно ли поднимать плечо?', 'Нет, плечо остаётся стабильным, работает локоть.')],
    sources: ['schoenfeld', 'neumann'],
  },
  {
    id: 'tricepsPushdown',
    poseFamily: 'standing',
    name: 'Разгибания на трицепс',
    aliases: ['трицепс', 'разгибания на трицепс', 'triceps pushdown'],
    category: 'accessory',
    equipment: 'cable',
    difficulty: 'beginner',
    summary: 'Изоляция трицепса: разгибание локтя у блока.',
    setup: 'Стоя у блока, локти прижаты к корпусу.',
    execution: ['Разгибайте локти вниз.', 'Не двигайте плечами.', 'Контролируйте возврат.'],
    breathing: 'Выдох на разгибании.',
    tempo: '2 вниз, 3 вверх.',
    rom: 'До почти полного разгибания.',
    primary: ['triceps'],
    secondary: ['forearms'],
    stabilizers: ['core'],
    muscleMap: { triceps: 94, forearms: 35, core: 10 },
    controls: [c('range', 'Амплитуда', 0.2, 1, 0.01, 0.85, 'короткая', 'полная')],
    shifts: [sh('range', ['triceps'], [], ['elbow'], [], 'Больше амплитуда: больше работа.', 'Меньше: щадящий режим.')],
    angles: [angle('side.elbowFlex', 'Сгибание локтя', 10, 100, '20–80°', 'Не выходите за комфорт.')],
    momentJoints: ['elbow'],
    mistakes: [{ title: 'Движение плечом', text: 'Локти уходят вперёд. Зафиксируйте плечо.' }],
    risks: [risk('Локоть', 'info', 'Большой вес и рывок нагружают сухожилие.', 'Умеренный вес, контроль.')],
    faq: [q('Можно ли делать с гантелью?', 'Да, французский жим или разгибания из-за головы.')],
    sources: ['schoenfeld', 'neumann'],
  },
  {
    id: 'plank',
    poseFamily: 'plank',
    name: 'Планка',
    aliases: ['планка', 'plank'],
    category: 'core',
    equipment: 'bodyweight',
    difficulty: 'beginner',
    summary: 'Статическая работа корпуса: кор, ягодицы, плечи. Учит держать нейтральную спину.',
    setup: 'Локти под плечами, корпус в одной линии, ягодицы и корпус напряжены.',
    execution: ['Не проваливайте поясницу.', 'Дышите ровно.', 'Держите шею нейтрально.'],
    breathing: 'Спокойное дыхание, без задержки.',
    tempo: '20–60 секунд.',
    rom: 'Статическое удержание.',
    primary: ['core'],
    secondary: ['frontDelts', 'glutes', 'quads'],
    stabilizers: ['upperBack'],
    muscleMap: { core: 88, frontDelts: 40, glutes: 36, quads: 30, upperBack: 25 },
    controls: [c('lever', 'Длина рычага', 0, 1, 0.05, 0.5, 'короче', 'длиннее')],
    shifts: [sh('lever', ['core'], [], ['spine'], [], 'Длиннее рычаг: больше нагрузка на кор.', 'Короче: легче.')],
    angles: [],
    momentJoints: ['spine'],
    mistakes: [{ title: 'Провал поясницы', text: 'Нагрузка уходит в поясницу. Напрягите ягодицы.' }],
    risks: [risk('Поясница', 'caution', 'При провисании растёт нагрузка.', 'Держите линию, начните с колен.')],
    faq: [q('Сколько держать?', '20–60 секунд с качеством; больше не всегда лучше.')],
    sources: ['mcgill', 'nsca'],
  },
  {
    id: 'hangingLegRaise',
    simId: 'pullup',
    name: 'Подъём ног в висе',
    aliases: ['подъём ног', 'hanging leg raise'],
    category: 'core',
    equipment: 'bodyweight',
    difficulty: 'advanced',
    summary: 'Динамическая работа кора и сгибателей бедра в висе.',
    setup: 'Вис на перекладине, лопатки активны.',
    execution: ['Поднимайте ноги контролируемо.', 'Не раскачивайтесь.', 'Опускайте медленно.'],
    breathing: 'Выдох на подъёме.',
    tempo: '2–3 секунды.',
    rom: 'До комфортной высоты.',
    primary: ['core', 'hipFlexors'],
    secondary: ['quads', 'forearms'],
    stabilizers: ['lats'],
    muscleMap: { core: 86, hipFlexors: 80, quads: 42, forearms: 46, lats: 30 },
    controls: [c('range', 'Амплитуда', 0.2, 1, 0.01, 0.8, 'ниже', 'выше')],
    shifts: [sh('range', ['core', 'hipFlexors'], [], ['hip'], [], 'Выше: больше кор и сгибатели бедра.', 'Ниже: щадящий режим.')],
    angles: [angle('side.hipFlex', 'Подъём ног', 0, 120, '30–90°', 'Без раскачки.')],
    momentJoints: ['shoulder'],
    mistakes: [{ title: 'Раскачка', text: 'Инерция вместо кора.' }],
    risks: [risk('Поясница', 'caution', 'Резкое поднятие и раскачка повышают нагрузку.', 'Контролируемый темп.'), risk('Хват', 'info', 'Долгий вис нагружает предплечья.', 'Используйте ремни при необходимости.')],
    faq: [q('Можно ли с согнутыми ногами?', 'Да, это облегчённый вариант.')],
    sources: ['mcgill', 'nsca'],
  },
  {
    id: 'nordicCurl',
    poseFamily: 'lying',
    name: 'Нордик-курл',
    aliases: ['нордик', 'nordic curl'],
    category: 'accessory',
    equipment: 'bodyweight',
    difficulty: 'advanced',
    summary: 'Эксцентрическая работа бицепса бедра: сильное растяжение под нагрузкой.',
    setup: 'Колени на подушке, стопы закреплены, корпус в одной линии.',
    execution: ['Опускайтесь вперёд как можно медленнее.', 'Держите таз разогнутым.', 'Возвращайтесь с помощью рук.'],
    breathing: 'Вдох на опускании.',
    tempo: '3–5 секунд вниз.',
    rom: 'До комфортного контроля.',
    primary: ['hamstrings'],
    secondary: ['glutes', 'calves'],
    stabilizers: ['core'],
    muscleMap: { hamstrings: 96, glutes: 45, core: 35, calves: 25 },
    controls: [c('range', 'Амплитуда', 0.1, 1, 0.01, 0.6, 'короткая', 'полная')],
    shifts: [sh('range', ['hamstrings'], [], ['knee'], [], 'Больше амплитуда: сильнее растяжение.', 'Меньше: щадящий режим.')],
    angles: [angle('side.kneeFlex', 'Сгибание колена', 10, 90, '20–70°', 'Без судорог и боли.')],
    momentJoints: ['knee'],
    mistakes: [{ title: 'Сгибание в тазу', text: 'Таз уходит назад. Держите линию.' }],
    risks: [risk('Бицепс бедра', 'warning', 'Очень высокое растяжение; возможна судорога или растяжение.', 'Начните с малой амплитуды, разомнитесь, не работайте через боль.')],
    faq: [q('Это для всех?', 'Нет, упражнение продвинутое. Начните с малой амплитуды и помощи руками.')],
    sources: ['schoenfeld', 'neumann'],
  },
];

export const TECHNIQUE_BY_ID: Record<string, TechniqueExercise> = EXERCISE_CATALOG.reduce(
  (acc, exercise) => {
    acc[exercise.id] = exercise;
    return acc;
  },
  {} as Record<string, TechniqueExercise>,
);

export function techniqueExerciseById(id: string): TechniqueExercise | undefined {
  return TECHNIQUE_BY_ID[id];
}

export function searchTechniqueExercises(
  query: string,
  category: ExerciseCategory | 'all' = 'all',
  equipment: EquipmentKind | 'all' = 'all',
): TechniqueExercise[] {
  const normalized = query.trim().toLowerCase().replace(/ё/g, 'е');
  return EXERCISE_CATALOG.filter((exercise) => {
    if (category !== 'all' && exercise.category !== category) return false;
    if (equipment !== 'all' && exercise.equipment !== equipment) return false;
    if (!normalized) return true;
    const haystack = [
      exercise.name,
      exercise.summary,
      ...exercise.aliases,
      ...exercise.primary.map((id) => MUSCLES[id].label),
    ]
      .join(' ')
      .toLowerCase()
      .replace(/ё/g, 'е');
    return haystack.includes(normalized);
  });
}

/* ------------------------------------------------------------------ */
/* Позы                                                                */
/* ------------------------------------------------------------------ */

export type ControlValues = Record<string, number>;

export function defaultControlValues(exercise: TechniqueExercise): ControlValues {
  return exercise.controls.reduce((acc, control) => {
    acc[control.id] = control.defaultValue;
    return acc;
  }, {} as ControlValues);
}

const valueOf = (values: ControlValues, id: string, fallback: number): number =>
  typeof values[id] === 'number' ? values[id] : fallback;

function staticSidePose(exercise: TechniqueExercise, values: ControlValues, dims: BodyDimensions): BodyPose {
  const scale = dims.scale;
  const side = { ...DEFAULT_SIDE_POSE, headAngle: -90 };
  const range = valueOf(values, 'range', valueOf(values, 'depth', 0.8));
  switch (exercise.poseFamily) {
    case 'seated': {
      side.hipX = BODY_DRAW.width / 2;
      side.hipY = BODY_DRAW.soleY - dims.shinLengthCm * scale * 0.92;
      side.torsoAngle = -88;
      side.headAngle = -88;
      side.thighAngle = 4;
      side.shinAngle = 90;
      side.footAngle = 0;
      side.upperArmAngle = 78;
      side.forearmAngle = 90;
      if (exercise.id === 'legExtension' || exercise.id === 'legPress') {
        side.shinAngle = 92 - range * 88;
      }
      if (exercise.id === 'seatedCalfRaise') {
        side.footAngle = -range * 24;
      }
      if (exercise.id === 'latPulldown') {
        side.upperArmAngle = -90 + range * 80;
        side.forearmAngle = -90 + range * 80;
      }
      break;
    }
    case 'lying': {
      side.hipX = BODY_DRAW.width / 2;
      side.hipY = BODY_DRAW.soleY - 92;
      side.torsoAngle = 180;
      side.headAngle = 180;
      side.thighAngle = 0;
      side.shinAngle = range * 90;
      side.footAngle = 0;
      side.upperArmAngle = 180;
      side.forearmAngle = 180;
      break;
    }
    case 'plank': {
      side.hipX = BODY_DRAW.width / 2;
      side.hipY = BODY_DRAW.soleY - 96;
      side.torsoAngle = 180;
      side.headAngle = 180;
      side.thighAngle = 0;
      side.shinAngle = 0;
      side.footAngle = 0;
      side.upperArmAngle = 90;
      side.forearmAngle = 90;
      break;
    }
    case 'hipThrust': {
      const lift = valueOf(values, 'range', 0.85);
      side.hipX = BODY_DRAW.width / 2 + 4;
      side.hipY = BODY_DRAW.soleY - 86 - lift * 34;
      side.torsoAngle = 158;
      side.headAngle = 158;
      side.thighAngle = 26;
      side.shinAngle = 88;
      side.footAngle = 0;
      side.upperArmAngle = 170;
      side.forearmAngle = 170;
      break;
    }
    default: {
      Object.assign(side, standingPose(dims).side);
      if (exercise.id === 'bicepsCurl') {
        side.upperArmAngle = 90;
        side.forearmAngle = 90 - range * 118;
      } else if (exercise.id === 'tricepsPushdown') {
        side.upperArmAngle = 90;
        side.forearmAngle = 90 - range * 72;
      } else if (exercise.id === 'lateralRaise') {
        side.upperArmAngle = 90 - range * 82;
        side.forearmAngle = 85;
      } else if (exercise.id === 'standingCalfRaise') {
        side.footAngle = -range * 24;
      }
      break;
    }
  }
  return { side, front: { ...DEFAULT_FRONT_POSE } };
}

export function buildTechniquePose(
  exercise: TechniqueExercise,
  values: ControlValues,
  dims: BodyDimensions,
): BodyPose {
  if (exercise.simId) {
    const sim = exerciseById(exercise.simId);
    if (sim) {
      let phase = 0.9;
      if (exercise.id === 'squat' || exercise.id === 'frontSquat') {
        phase = valueOf(values, 'depth', 0.88);
      } else if (exercise.id === 'rdl' || exercise.id === 'goodMorning') {
        phase = valueOf(values, 'hinge', 0.85);
      } else if (exercise.id === 'deadlift' || exercise.id === 'sumoDeadlift') {
        phase = valueOf(values, 'pull', 0.9);
      } else if (exercise.category === 'horizontalPush') {
        phase = valueOf(values, 'depth', 0.9);
      } else if (exercise.id === 'overhead') {
        phase = valueOf(values, 'press', 0.9);
      } else if (exercise.category === 'horizontalPull') {
        phase = valueOf(values, 'pull', 0.9);
      } else if (exercise.id === 'pullup' || exercise.id === 'latPulldown') {
        phase = valueOf(values, 'range', 0.9);
      } else if (exercise.id === 'dips') {
        phase = valueOf(values, 'depth', 0.88);
      } else if (exercise.id === 'lunge' || exercise.id === 'bulgarian') {
        phase = valueOf(values, 'depth', 0.88);
      } else if (exercise.id === 'hangingLegRaise') {
        phase = 1;
      }
      let lean = valueOf(values, 'lean', 0);
      if (exercise.category === 'horizontalPull') {
        lean = (valueOf(values, 'torso', 0.5) - 0.5) * 2;
      }
      if (exercise.id === 'goodMorning') {
        lean = 0;
      }
      const pose = exercisePose(sim, phase, dims, { amplitude: 1, lean });
      if (exercise.id === 'hangingLegRaise') {
        const lift = valueOf(values, 'range', 0.8);
        pose.side.thighAngle = Math.round(90 - lift * 82);
        pose.side.shinAngle = Math.round(90 - lift * 55);
      }
      return pose;
    }
  }
  return staticSidePose(exercise, values, dims);
}

/* ------------------------------------------------------------------ */
/* Нагрузка и мышцы                                                    */
/* ------------------------------------------------------------------ */

export function muscleIntensity(
  exercise: TechniqueExercise,
  values: ControlValues,
): Partial<Record<MuscleId, number>> {
  const result: Partial<Record<MuscleId, number>> = { ...exercise.muscleMap };
  for (const shift of exercise.shifts) {
    const control = exercise.controls.find((item) => item.id === shift.controlId);
    if (!control) continue;
    const current = valueOf(values, control.id, control.defaultValue);
    const diff = current - control.defaultValue;
    if (Math.abs(diff) < control.step * 0.5) continue;
    const direction = diff > 0 ? 1 : -1;
    for (const id of direction > 0 ? shift.up : shift.down) {
      result[id] = Math.min(100, Math.max(0, (result[id] ?? 0) + 12));
    }
    for (const id of direction > 0 ? shift.down : shift.up) {
      result[id] = Math.min(100, Math.max(0, (result[id] ?? 0) - 12));
    }
  }
  return result;
}

export function activeShifts(
  exercise: TechniqueExercise,
  values: ControlValues,
): Array<{ shift: ShiftRule; direction: 1 | -1; text: string }> {
  const result: Array<{ shift: ShiftRule; direction: 1 | -1; text: string }> = [];
  for (const shift of exercise.shifts) {
    const control = exercise.controls.find((item) => item.id === shift.controlId);
    if (!control) continue;
    const current = valueOf(values, control.id, control.defaultValue);
    const diff = current - control.defaultValue;
    if (Math.abs(diff) < control.step * 0.5) continue;
    result.push({
      shift,
      direction: diff > 0 ? 1 : -1,
      text: diff > 0 ? shift.highText : shift.lowText,
    });
  }
  return result;
}

export interface OneRepMaxInfo {
  valueKg: number;
  source: 'history' | 'manual' | 'estimate';
  bodyweightIncluded: boolean;
  basis: string;
}

function epley(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

function matches(name: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(name));
}

export function estimateTechniqueOneRepMax(
  exercise: TechniqueExercise,
  workouts: WorkoutRecord[],
  bodyWeightKg: number,
  sex: 'male' | 'female',
  manualKg?: number,
): OneRepMaxInfo {
  const bodyWeight = bodyWeightKg > 0 ? bodyWeightKg : 75;
  if (manualKg !== undefined && Number.isFinite(manualKg) && manualKg > 0) {
    return {
      valueKg: Math.round(manualKg * 10) / 10,
      source: 'manual',
      bodyweightIncluded: exercise.equipment === 'bodyweight',
      basis: 'ручная поправка',
    };
  }
  const sim = exercise.simId ? exerciseById(exercise.simId) : undefined;
  const patterns = sim?.namePatterns ?? exercise.aliases.map((alias) => new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  const bodyweightFactor = exercise.equipment === 'bodyweight' ? 1 : 0;
  let best = 0;
  let bestWeight = 0;
  let bestReps = 0;
  let bestDate = '';
  for (const workout of workouts || []) {
    for (const log of workout.exercises || []) {
      if (!patterns.length || !matches(log.name, patterns)) continue;
      for (const set of log.sets || []) {
        const weight = Number(set.weight) || 0;
        const reps = Number(set.reps) || 0;
        if (reps <= 0) continue;
        if (bodyweightFactor > 0 && weight <= 0) continue;
        const estimate = Number(set.calculated1RM) || epley(weight, reps);
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
    const total = bodyweightFactor > 0 ? bodyWeight + best : best;
    return {
      valueKg: Math.round(total * 10) / 10,
      source: 'history',
      bodyweightIncluded: bodyweightFactor > 0,
      basis: `${bestWeight > 0 ? `${bestWeight} кг × ${bestReps}` : `${bestReps} повт.`}${bestDate ? ` · ${bestDate.slice(0, 10)}` : ''}`,
    };
  }
  const fallbackMap: Record<string, number> = {
    squat: 1.1,
    frontSquat: 0.9,
    rdl: 1.1,
    deadlift: 1.35,
    sumoDeadlift: 1.3,
    goodMorning: 0.55,
    legPress: 2.2,
    legExtension: 0.65,
    legCurl: 0.5,
    standingCalfRaise: 1.0,
    seatedCalfRaise: 0.9,
    bench: 0.75,
    inclineBench: 0.65,
    closeGripBench: 0.65,
    overhead: 0.6,
    lateralRaise: 0.12,
    row: 0.7,
    dumbbellRow: 0.35,
    latPulldown: 0.75,
    pullup: 1.35,
    dips: 1.5,
    pushUp: 0.75,
    bulgarian: 0.35,
    lunge: 0.35,
    hipThrust: 1.4,
    bicepsCurl: 0.22,
    tricepsPushdown: 0.35,
    plank: 1,
    hangingLegRaise: 1.1,
    nordicCurl: 1.1,
  };
  const femaleMap: Record<string, number> = {
    squat: 0.75,
    frontSquat: 0.6,
    rdl: 0.8,
    deadlift: 0.95,
    sumoDeadlift: 0.9,
    goodMorning: 0.4,
    legPress: 1.7,
    legExtension: 0.5,
    legCurl: 0.4,
    standingCalfRaise: 0.8,
    seatedCalfRaise: 0.7,
    bench: 0.45,
    inclineBench: 0.4,
    closeGripBench: 0.4,
    overhead: 0.35,
    lateralRaise: 0.08,
    row: 0.45,
    dumbbellRow: 0.22,
    latPulldown: 0.55,
    pullup: 1.15,
    dips: 1.25,
    pushUp: 0.65,
    bulgarian: 0.22,
    lunge: 0.22,
    hipThrust: 1.1,
    bicepsCurl: 0.15,
    tricepsPushdown: 0.22,
    plank: 1,
    hangingLegRaise: 0.9,
    nordicCurl: 0.9,
  };
  const multiplier = (sex === 'female' ? femaleMap : fallbackMap)[exercise.id] ?? 0.7;
  return {
    valueKg: Math.round(bodyWeight * multiplier * 10) / 10,
    source: 'estimate',
    bodyweightIncluded: bodyweightFactor > 0,
    basis: `ориентир ${multiplier.toFixed(2)} × вес тела`,
  };
}

export function techniqueSystemLoad(
  exercise: TechniqueExercise,
  bodyWeightKg: number,
  addedWeightKg: number,
): number {
  const body = bodyWeightKg > 0 ? bodyWeightKg : 75;
  const added = Math.max(0, Number.isFinite(addedWeightKg) ? addedWeightKg : 0);
  return exercise.equipment === 'bodyweight' ? body + added : added;
}

/* ------------------------------------------------------------------ */
/* Персонализация                                                      */
/* ------------------------------------------------------------------ */

export type ProportionFlag =
  | 'longFemur'
  | 'shortFemur'
  | 'longShin'
  | 'shortShin'
  | 'longTorso'
  | 'shortTorso'
  | 'longArm'
  | 'shortArm'
  | 'longFoot'
  | 'shortFoot';

export function proportionFlags(dims: BodyDimensions): ProportionFlag[] {
  const height = dims.heightCm;
  const flags: ProportionFlag[] = [];
  const femur = dims.thighLengthCm / height;
  const shin = dims.shinLengthCm / height;
  const torso = dims.torsoLengthCm / height;
  const arm = (dims.upperArmLengthCm + dims.forearmLengthCm) / height;
  const foot = dims.footLengthCm / height;
  if (femur > 0.26) flags.push('longFemur');
  if (femur < 0.23) flags.push('shortFemur');
  if (shin > 0.26) flags.push('longShin');
  if (shin < 0.23) flags.push('shortShin');
  if (torso > 0.3) flags.push('longTorso');
  if (torso < 0.27) flags.push('shortTorso');
  if (arm > 0.33) flags.push('longArm');
  if (arm < 0.3) flags.push('shortArm');
  if (foot > 0.13) flags.push('longFoot');
  if (foot < 0.11) flags.push('shortFoot');
  return flags;
}

const PROPORTION_TEXT: Record<ProportionFlag, { all: string; squat?: string; hinge?: string; push?: string; pull?: string; lunge?: string }> = {
  longFemur: {
    all: 'Длинное бедро увеличивает рычаг ноги. В приседе и выпаде может потребоваться больше наклона, более широкая постановка или подставка под пятки.',
    squat: 'Попробуйте чуть шире постановку и больше наклона: так таз уходит назад и глубина достигается без отрыва пяток.',
    lunge: 'Длинное бедро может делать шаг более длинным; не заставляйте колено уходить далеко вперёд.',
  },
  shortFemur: {
    all: 'Короткое бедро облегчает глубину. Следите, чтобы колени не уходили слишком далеко вперёд и нагрузка не уходила в колено.',
    squat: 'Можно приседать уже и вертикальнее; контролируйте давление всей стопы.',
  },
  longShin: {
    all: 'Длинная голень повышает требования к подвижности голеностопа. Подставка под пятки или более широкая постановка могут помочь.',
    squat: 'Если пятки отрываются, попробуйте подставку или уменьшите глубину.',
  },
  shortShin: {
    all: 'Короткая голень может ограничивать глубину приседа при вертикальном корпусе. Помогает наклон или более широкая постановка.',
  },
  longTorso: {
    all: 'Длинный корпус увеличивает плечо момента на поясницу в наклонах. Держите жёсткий кор и не округляйте спину.',
    hinge: 'В становой и RDL длинный корпус требует особенно внимательного контроля нейтральной спины.',
  },
  shortTorso: {
    all: 'Короткий корпус может давать преимущество в тягах, но следите за положением плеч относительно грифа.',
  },
  longArm: {
    all: 'Длинные руки увеличивают путь штанги в жиме, но помогают в становой и тягах.',
    push: 'В жиме может быть больше путь и рычаг; не гонитесь за широким хватом.',
    pull: 'В тягах длинные руки могут означать большую амплитуду; контролируйте лопатки.',
  },
  shortArm: {
    all: 'Короткие руки укорачивают путь в жиме, но могут требовать большего наклона в тягах.',
    push: 'В жиме путь короче; следите за стабильностью плеча.',
  },
  longFoot: {
    all: 'Длинная стопа увеличивает рычаг в голеностопе; давление всей стопой и контроль носка важны.',
  },
  shortFoot: {
    all: 'Короткая стопа может влиять на устойчивость; не отрывайте пятку и контролируйте носок.',
  },
};

export function proportionNotes(exercise: TechniqueExercise, dims: BodyDimensions): string[] {
  const flags = proportionFlags(dims);
  const key =
    exercise.category === 'squat'
      ? 'squat'
      : exercise.category === 'hinge'
        ? 'hinge'
        : exercise.category === 'horizontalPush' || exercise.category === 'verticalPush'
          ? 'push'
          : exercise.category === 'horizontalPull' || exercise.category === 'verticalPull'
            ? 'pull'
            : exercise.category === 'lunge'
              ? 'lunge'
              : undefined;
  return flags
    .map((flag) => {
      const entry = PROPORTION_TEXT[flag];
      return (key ? entry[key] : undefined) ?? entry.all;
    })
    .slice(0, 2);
}
