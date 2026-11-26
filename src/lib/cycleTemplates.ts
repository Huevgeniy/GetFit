export type CycleGoal = 'strength' | 'hypertrophy' | 'powerlifting' | 'beginner' | 'peaking';
export type CycleLevel = 'beginner' | 'intermediate' | 'advanced';
export type CycleKind = 'specialization' | 'program';
export type CycleLift = 'squat' | 'bench' | 'deadlift' | 'ohp' | 'main' | 'accessory';

export interface CycleExercise {
  name: string;
  lift?: CycleLift;
  sets: number;
  reps: string;
  percent?: number;
  restSeconds?: number;
  optional?: boolean;
  note?: string;
}

export interface CycleDay {
  id: string;
  label: string;
  focus?: string;
  /** Для гибких шаблонов: к какому основному движению относится день. */
  mainLift?: CycleLift;
  exercises: CycleExercise[];
}

export interface CycleWeek {
  id: string;
  label: string;
  days: CycleDay[];
}

export interface CycleTemplate {
  id: string;
  name: string;
  author: string;
  goal: CycleGoal;
  level: CycleLevel;
  kind: CycleKind;
  /** Какие 1ПМ реально нужны для расчёта. */
  mainLifts: CycleLift[];
  /** Для специализации: из каких движений выбрать одно. */
  mainLiftOptions?: CycleLift[];
  /** Для гибких программ: можно выбрать одно, два или все движения. */
  allowMultipleMainLifts?: boolean;
  weeksCount: number;
  daysPerWeek: number;
  description: string;
  focus: string;
  equipment: string;
  warnings: string[];
  expectedResult: string;
  recovery: string;
  whatElse: string[];
  avoid: string[];
  restGuidance: string[];
  progression: string;
  weekNotes: string[];
  accessoryPolicy: string;
  weeks: CycleWeek[];
  source: string;
  custom?: boolean;
}

const ex = (
  name: string,
  sets: number,
  reps: string,
  percent?: number,
  lift: CycleLift = 'accessory',
  note?: string,
  restSeconds?: number,
  optional?: boolean,
): CycleExercise => ({
  name,
  sets,
  reps,
  percent,
  lift,
  note,
  restSeconds,
  optional,
});

const day = (
  id: string,
  label: string,
  exercises: CycleExercise[],
  mainLift?: CycleLift,
  focus?: string,
): CycleDay => ({ id, label, exercises, mainLift, focus });
const week = (id: string, label: string, days: CycleDay[]): CycleWeek => ({ id, label, days });

const shiftWeek = (base: CycleWeek, index: number, delta: number, label?: string): CycleWeek => ({
  id: `${base.id}_w${index + 1}`,
  label: label || `Неделя ${index + 1}`,
  days: base.days.map((item, dayIndex) => ({
    ...item,
    id: `${base.id}_w${index + 1}_d${dayIndex + 1}`,
    exercises: item.exercises.map((exercise) => ({
      ...exercise,
      percent: exercise.percent !== undefined ? Math.min(100, exercise.percent + delta * index) : undefined,
    })),
  })),
});

/* ------------------------------------------------------------------ */
/* Смолов-младший: специализация на одном движении                     */
/* ------------------------------------------------------------------ */
const smolovWeek = (index: number, delta: number): CycleWeek => {
  const schemes = [
    { sets: 6, reps: '6', percent: 70, rest: 180 },
    { sets: 7, reps: '5', percent: 75, rest: 210 },
    { sets: 8, reps: '4', percent: 80, rest: 240 },
    { sets: 10, reps: '3', percent: 85, rest: 300 },
  ];
  return week(`smolov_w${index + 1}`, `Неделя ${index + 1}`, schemes.map((scheme, dayIndex) => day(
    `smolov_w${index + 1}_d${dayIndex + 1}`,
    `День ${dayIndex + 1} — ${scheme.sets}×${scheme.reps} @ ${scheme.percent + delta}%`,
    [
      ex(
        'Основное движение (жим или присед)',
        scheme.sets,
        scheme.reps,
        scheme.percent + delta,
        'main',
        `Отдых ${Math.round(scheme.rest / 60)} мин. Проценты от 1ПМ выбранного движения.`,
        scheme.rest,
      ),
    ],
    'main',
    'Специализация: только одно движение, без тяжёлой подсобки.',
  )));
};

const smolovJr: CycleTemplate = {
  id: 'smolov_jr',
  name: 'Смолов-младший',
  author: 'Сергей Смолов',
  goal: 'peaking',
  level: 'advanced',
  kind: 'specialization',
  mainLifts: ['main'],
  mainLiftOptions: ['bench', 'squat'],
  weeksCount: 4,
  daysPerWeek: 4,
  description:
    'Специализированный цикл на ОДНО движение: жим лёжа или присед. 4 недели, 4 тренировки в неделю. Вес и объём растут, поэтому это не программа «на всё тело».',
  focus: 'Одно основное движение — жим или присед. Подсобка только лёгкая и по желанию.',
  equipment: 'Штанга, стойки, скамья, страховка.',
  warnings: [
    'Очень высокий объём для одного движения. Нужен опыт и полноценное восстановление.',
    'Не добавляйте тяжёлые жимы/приседы и большой объём подсобки в те же дни.',
    'При боли в суставах или потере техники остановите цикл.',
  ],
  expectedResult:
    'Плюс 2,5–5 кг к 1ПМ при хорошем восстановлении и технике. Если вес не растёт — не форсируйте, повторите неделю.',
  recovery:
    'Сон 8+ часов, 1–2 дня полного отдыха в неделю, лёгкая ходьба. Не совмещать с другим тяжёлым циклом.',
  whatElse: [
    'Лёгкая подсобка 2–3 упражнения в конце: тяга в наклоне, пресс, разгибания — без отказа.',
    'Ходьба 20–30 минут в дни отдыха для восстановления.',
    'Следить за техникой: это важнее процентов.',
  ],
  avoid: [
    'Тяжёлые приседы и жимы вне цикла.',
    'Отказные подходы и «добивки».',
    'Большой объём кардио и бега.',
  ],
  restGuidance: [
    '6×6 и 7×5 — около 2–3 минут между подходами.',
    '8×4 — около 3–4 минут.',
    '10×3 — 4–5 минут, иначе не восстановитесь к следующему подходу.',
  ],
  progression:
    'Недели 1–4: +2,5% к проценту каждой недели. Если все подходы выполнены чисто — можно добавить 2,5 кг к расчётному 1ПМ на следующую неделю.',
  weekNotes: [
    'Неделя 1: вкатка в объём, 6×6 и 7×5. Не гонитесь за весом.',
    'Неделя 2: объём выше, отдых длиннее. Следите за сном.',
    'Неделя 3: 8×4 и 10×3 — самая тяжёлая неделя.',
    'Неделя 4: пик, 10×3 на 85%. После — разгрузка или отдых.',
  ],
  accessoryPolicy:
    'Подсобка не обязательна. Если добавляете — только 2–3 лёгких упражнения в конце, без отказа и без второго тяжёлого движения.',
  weeks: [smolovWeek(0, 0), smolovWeek(1, 2.5), smolovWeek(2, 5), smolovWeek(3, 7.5)],
  source: 'Классическая схема Smolov Jr.; проценты ориентировочные, подбирайте по восстановлению.',
};

/* ------------------------------------------------------------------ */
/* Вендлер 5/3/1                                                       */
/* ------------------------------------------------------------------ */
const wendler531Week = (weekIndex: number): CycleWeek => {
  const main = [
    { lift: 'ohp' as const, name: 'Жим над головой', accessory: 'Подтягивания' },
    { lift: 'deadlift' as const, name: 'Становая тяга', accessory: 'Подъём ног в висе' },
    { lift: 'bench' as const, name: 'Жим лёжа', accessory: 'Тяга штанги в наклоне' },
    { lift: 'squat' as const, name: 'Присед со штангой', accessory: 'Жим ногами' },
  ];
  const schemes =
    weekIndex === 0
      ? [[65, 5], [75, 5], [85, 5]]
      : weekIndex === 1
        ? [[70, 3], [80, 3], [90, 3]]
        : weekIndex === 2
          ? [[75, 5], [85, 3], [95, 1]]
          : [[40, 5], [50, 5], [60, 5]];
  const weekNote =
    weekIndex === 0
      ? '5/5/5 — набираем объём, последний подход не в отказ.'
      : weekIndex === 1
        ? '3/3/3 — интенсивность выше, но повторений меньше.'
        : weekIndex === 2
          ? '5/3/1 — самый тяжёлый день, последний подход можно сделать AMRAP без отказа.'
          : 'Разгрузка 40/50/60% — обязательна, не пропускайте.';
  return week(`wendler_w${weekIndex + 1}`, `Неделя ${weekIndex + 1}`, main.map((item, dayIndex) => day(
    `wendler_w${weekIndex + 1}_d${dayIndex + 1}`,
    item.name,
    [
      ...schemes.map(([percent, reps], index) => ex(
        `${item.name} — подход ${index + 1}`,
        1,
        `${reps}${index === 2 ? '+' : ''}`,
        percent,
        item.lift,
        index === 2 ? 'Последний подход: не в отказ, оставьте 1–2 повтора в запасе.' : undefined,
        percent >= 85 ? 240 : 180,
      )),
      ex(item.accessory, 5, '10', undefined, 'accessory', 'Подсобка: можно заменить на похожее движение.', 90),
      ex('Пресс', 3, '12', undefined, 'accessory', undefined, 60),
    ],
    item.lift,
    weekNote,
  )));
};

const wendler: CycleTemplate = {
  id: 'wendler_531',
  name: 'Вендлер 5/3/1',
  author: 'Джим Вендлер',
  goal: 'strength',
  level: 'intermediate',
  kind: 'program',
  mainLifts: ['ohp', 'deadlift', 'bench', 'squat'],
  weeksCount: 4,
  daysPerWeek: 4,
  description:
    'Полноценная программа на 4 основных движения: жим стоя, становая, жим лёжа, присед. 3 силовые недели + разгрузка.',
  focus: 'Сила всех базовых движений. Проценты считаются от тренировочного максимума (90% от 1ПМ).',
  equipment: 'Штанга, стойки, скамья, перекладина.',
  warnings: [
    'Проценты считаются от тренировочного максимума (90% от реального 1ПМ), а не от разового максимума.',
    'Последний подход с «+» не должен превращаться в отказной каждый раз.',
    'Разгрузочная неделя обязательна.',
  ],
  expectedResult:
    'Стабильный рост силы за 3–4 цикла. За один цикл обычно +2,5–5 кг к тренировочному максимуму в каждом движении.',
  recovery:
    'Сон 7–9 часов, 2 дня отдыха, лёгкая ходьба. Если последний подход стабильно не выполняется — снизьте тренировочный максимум.',
  whatElse: [
    'Подсобка 25–50 повторений на движение: тяга, жим ногами, пресс.',
    'Лёгкое кардио 2–3 раза в неделю по 20–30 минут.',
    'Раз в цикл проверяйте технику на видео.',
  ],
  avoid: ['Отказные подходы каждую неделю.', 'Пропуск разгрузки.', 'Добавление второго тяжёлого цикла одновременно.'],
  restGuidance: [
    'Основные подходы 65–85% — 2–3 минуты.',
    'Подходы 85–95% и синглы — 3–5 минут.',
    'Подсобка — 60–90 секунд.',
  ],
  progression:
    'После успешного цикла добавьте +2,5 кг к тренировочному максимуму жима/приседа и +5 кг к становой, затем начните новый цикл.',
  weekNotes: [
    'Неделя 1: 5/5/5, объёмная.',
    'Неделя 2: 3/3/3, интенсивнее.',
    'Неделя 3: 5/3/1, пик. Последний подход — AMRAP без отказа.',
    'Неделя 4: разгрузка 40/50/60%.',
  ],
  accessoryPolicy: 'Подсобка обязательна, но не в отказ: 5×10 или 3–4 упражнения по 10–15 повторений.',
  weeks: [wendler531Week(0), wendler531Week(1), wendler531Week(2), wendler531Week(3)],
  source: '5/3/1 — Jim Wendler. Схема упрощена, вспомогательные упражнения можно менять.',
};

/* ------------------------------------------------------------------ */
/* Шейко: базовый пауэрлифтинг-блок                                    */
/* ------------------------------------------------------------------ */
const sheikoBase = week('sheiko_base', 'Базовая неделя', [
  day('sheiko_d1', 'День 1 — присед/жим', [
    ex('Присед со штангой', 5, '5', 70, 'squat', 'Средний вес, техника.', 180),
    ex('Жим лёжа', 5, '5', 70, 'bench', 'Средний вес, техника.', 180),
    ex('Жим гантелей лёжа', 4, '8', undefined, 'accessory', undefined, 90),
    ex('Тяга блока к поясу', 4, '10', undefined, 'accessory', undefined, 90),
    ex('Разгибания ног', 3, '12', undefined, 'accessory', undefined, 60),
  ], 'squat', 'Присед + жим, средние веса.'),
  day('sheiko_d2', 'День 2 — становая/жим', [
    ex('Становая тяга', 4, '4', 72, 'deadlift', 'Не в отказ.', 210),
    ex('Жим лёжа', 5, '5', 72, 'bench', undefined, 180),
    ex('Подтягивания', 4, '8', undefined, 'accessory', undefined, 90),
    ex('Гиперэкстензия', 3, '12', undefined, 'accessory', undefined, 60),
    ex('Пресс', 3, '15', undefined, 'accessory', undefined, 60),
  ], 'deadlift', 'Тяга + жим.'),
  day('sheiko_d3', 'День 3 — присед/жим', [
    ex('Присед со штангой', 4, '4', 75, 'squat', undefined, 210),
    ex('Жим лёжа', 4, '4', 75, 'bench', undefined, 210),
    ex('Тяга штанги в наклоне', 4, '8', undefined, 'accessory', undefined, 90),
    ex('Сгибания ног', 3, '12', undefined, 'accessory', undefined, 60),
    ex('Планка', 3, '40 сек', undefined, 'accessory', undefined, 45),
  ], 'bench', 'Присед + жим, чуть тяжелее.'),
]);

const sheiko: CycleTemplate = {
  id: 'sheiko',
  name: 'Шейко — базовый блок',
  author: 'Борис Шейко',
  goal: 'powerlifting',
  level: 'advanced',
  kind: 'program',
  mainLifts: ['squat', 'bench', 'deadlift'],
  weeksCount: 4,
  daysPerWeek: 3,
  description:
    'Упрощённый базовый блок в духе Шейко: частые приседы/жимы/тяги, средние проценты, много техники и подсобки. Это образовательная схема, а не официальная копия.',
  focus: 'Пауэрлифтинг: присед, жим, становая. Подходит как пример структуры.',
  equipment: 'Штанга, стойки, скамья, блоки, тренажёры.',
  warnings: [
    'Высокая частота и объём. Нужен опыт и контроль восстановления.',
    'Не добавляйте отказные подходы.',
    'Это упрощённая образовательная схема, не оригинальный план Шейко.',
  ],
  expectedResult:
    'Рост техники и работоспособности в приседе, жиме и тяге. Прибавка к 1ПМ — индивидуальна, обычно 2,5–5 кг за блок.',
  recovery:
    'Сон 8 часов, 2 дня отдыха, контроль пульса и самочувствия. При падении техники — разгрузочная неделя.',
  whatElse: [
    'Подсобка на спину и пресс в конце тренировки.',
    'Лёгкая ходьба или велотренажёр 20 минут в дни отдыха.',
    'Видео техники раз в неделю.',
  ],
  avoid: ['Отказные подходы.', 'Резкое увеличение весов.', 'Добавление второго тяжёлого цикла.'],
  restGuidance: [
    'Присед/тяга 70–75% — 2–3 минуты.',
    'Жим 70–75% — 2 минуты.',
    'Подсобка — 60–90 секунд.',
  ],
  progression:
    'Каждую неделю +2,5% к основным процентам. Если техника страдает — повторите неделю без прибавки.',
  weekNotes: [
    'Неделя 1: вкатка, средние веса.',
    'Неделя 2: объём чуть выше.',
    'Неделя 3: самая тяжёлая неделя блока.',
    'Неделя 4: закрепление или разгрузка по самочувствию.',
  ],
  accessoryPolicy: 'Подсобка 2–3 упражнения в конце, без отказа.',
  weeks: [0, 1, 2, 3].map(index => shiftWeek(sheikoBase, index, 2.5)),
  source: 'Идея периодизации Бориса Шейко; структура адаптирована для приложения.',
};

/* ------------------------------------------------------------------ */
/* Верхошанский: базовые движения, без прыжков, гибкий выбор лифтов    */
/* ------------------------------------------------------------------ */
const verkhoshanskyWeek = (weekIndex: number, percent: number): CycleWeek => {
  const rest = percent >= 80 ? 240 : 180;
  return week(`verkh_w${weekIndex + 1}`, `Неделя ${weekIndex + 1}`, [
    day('verkh_d1', `Присед — базовый объём (${percent}%)`, [
      ex('Присед со штангой', 5, '5', percent, 'squat', 'Непредельный вес, техника важнее.', rest),
      ex('Жим ногами', 3, '10', undefined, 'accessory', 'Лёгкая подсобка.', 90),
      ex('Планка', 3, '40 сек', undefined, 'accessory', undefined, 45),
    ], 'squat', 'Базовое движение + лёгкая подсобка.'),
    day('verkh_d2', `Жим — базовый объём (${percent}%)`, [
      ex('Жим лёжа', 5, '5', percent, 'bench', 'Непредельный вес, без отказа.', rest),
      ex('Тяга штанги в наклоне', 4, '8', undefined, 'accessory', undefined, 90),
      ex('Отжимания на брусьях', 3, '8', undefined, 'accessory', 'Можно заменить на жим гантелей.', 90),
    ], 'bench', 'Базовое движение + спина.'),
    day('verkh_d3', `Тяга — базовый объём (${percent}%)`, [
      ex('Становая тяга', 4, '4', percent, 'deadlift', 'Непредельный вес, без отказа.', rest),
      ex('Румынская тяга', 3, '8', undefined, 'accessory', undefined, 90),
      ex('Подтягивания', 3, '6', undefined, 'accessory', undefined, 90),
    ], 'deadlift', 'Базовое движение + задняя цепь.'),
    day('verkh_d4', 'Лёгкий день — техника', [
      ex('Лёгкое основное движение', 3, '5', undefined, 'accessory', 'Выберите одно движение или сделайте лёгкую работу по самочувствию.', 120),
      ex('Мобильность бёдер и плеч', 3, '60 сек', undefined, 'accessory', undefined, 45),
      ex('Пресс', 3, '12', undefined, 'accessory', undefined, 45),
    ], undefined, 'Лёгкий день для восстановления.'),
  ]);
};

const verkhoshansky: CycleTemplate = {
  id: 'verkhoshansky',
  name: 'Верхошанский — базовый цикл',
  author: 'Юрий Верхошанский',
  goal: 'strength',
  level: 'intermediate',
  kind: 'program',
  mainLifts: ['squat', 'bench', 'deadlift'],
  mainLiftOptions: ['squat', 'bench', 'deadlift'],
  allowMultipleMainLifts: true,
  weeksCount: 4,
  daysPerWeek: 4,
  description:
    'Базовый цикл без прыжков: присед, жим и тяга с непредельными весами. Можно выбрать одно движение, два или все три — приложение оставит только нужные дни.',
  focus: 'Базовые движения с умеренными весами и постепенным ростом. Подходит как вводный силовой блок или специализация на одном движении.',
  equipment: 'Штанга, стойки, скамья, тренажёры.',
  warnings: [
    'Веса непредельные: не работайте в отказ и не добавляйте прыжки/ударную нагрузку.',
    'Если выбрано одно движение, остальные дни становятся лёгкими или отдыхом.',
    'Это адаптированная схема, а не дословный оригинальный план.',
  ],
  expectedResult:
    'Рост силы и техники в выбранных движениях без перегрузки. За 4 недели обычно +2,5–5 кг к рабочему весу.',
  recovery:
    'Сон 8 часов, 1–2 дня отдыха, лёгкая ходьба. Если выбран только один лифт, не добивайте остальные тяжёлыми тренировками.',
  whatElse: [
    'Если выбрали одно движение — добавьте лёгкую работу для остальных: тягу, жим или присед 1 раз в неделю.',
    'Подсобка минимальная, без отказа: спина, пресс, задняя цепь.',
    'Растяжка и мобильность 10 минут после тренировки.',
  ],
  avoid: ['Прыжки и ударную нагрузку.', 'Отказные подходы.', 'Резкий рост веса.'],
  restGuidance: [
    '70–75% — 2–3 минуты.',
    '80–85% — 3–4 минуты.',
    'Лёгкий день — 1–2 минуты.',
  ],
  progression:
    'Каждую неделю +2,5–5% к рабочему весу. На 4-й неделе — закрепление или разгрузка, если самочувствие плохое.',
  weekNotes: [
    'Неделя 1: 70%, вкатка.',
    'Неделя 2: 75%, объём.',
    'Неделя 3: 80%, сила.',
    'Неделя 4: 65–70%, разгрузка/закрепление.',
  ],
  accessoryPolicy: 'Подсобка лёгкая: 2–3 упражнения на спину, пресс и заднюю цепь. Без отказа.',
  weeks: [
    verkhoshanskyWeek(0, 70),
    verkhoshanskyWeek(1, 75),
    verkhoshanskyWeek(2, 80),
    verkhoshanskyWeek(3, 65),
  ],
  source: 'Идеи Юрия Верхошанского о базовой силовой работе; структура адаптирована, без прыжковой нагрузки.',
};

/* ------------------------------------------------------------------ */
/* GZCLP                                                               */
/* ------------------------------------------------------------------ */
const gzclpBase = week('gzclp_base', 'Базовая неделя', [
  day('gzclp_d1', 'День 1 — присед', [
    ex('Присед со штангой', 5, '3+', 75, 'squat', 'T1: последний подход AMRAP без отказа.', 180),
    ex('Жим лёжа', 3, '10', 60, 'bench', 'T2: объём.', 120),
    ex('Тяга верхнего блока', 3, '15', undefined, 'accessory', 'T3: лёгкая подсобка.', 75),
    ex('Планка', 3, '40 сек', undefined, 'accessory', undefined, 45),
  ], 'squat'),
  day('gzclp_d2', 'День 2 — жим', [
    ex('Жим лёжа', 5, '3+', 75, 'bench', 'T1.', 180),
    ex('Становая тяга', 3, '10', 60, 'deadlift', 'T2.', 150),
    ex('Тяга гантели одной рукой', 3, '15', undefined, 'accessory', 'T3.', 75),
    ex('Подъём ног в висе', 3, '10', undefined, 'accessory', undefined, 60),
  ], 'bench'),
  day('gzclp_d3', 'День 3 — становая', [
    ex('Становая тяга', 5, '3+', 75, 'deadlift', 'T1.', 210),
    ex('Присед со штангой', 3, '10', 60, 'squat', 'T2.', 150),
    ex('Жим гантелей над головой', 3, '15', undefined, 'accessory', 'T3.', 75),
    ex('Сгибания на бицепс', 3, '12', undefined, 'accessory', undefined, 60),
  ], 'deadlift'),
]);

const gzclp: CycleTemplate = {
  id: 'gzclp',
  name: 'GZCLP',
  author: 'Cody Lefever (GZCL)',
  goal: 'beginner',
  level: 'beginner',
  kind: 'program',
  mainLifts: ['squat', 'bench', 'deadlift'],
  weeksCount: 4,
  daysPerWeek: 3,
  description:
    'Линейная прогрессия для новичков: тяжёлый T1 на 3+, объёмный T2 на 10 и лёгкий T3 на 15.',
  focus: 'Присед, жим, становая + доступная подсобка. Хороший вход в структурированные тренировки.',
  equipment: 'Штанга, стойки, скамья, блоки/гантели.',
  warnings: [
    'Начинайте с комфортных весов, техника важнее процентов.',
    'Если не выполнили целевые повторения, повторите вес или снизьте.',
  ],
  expectedResult: 'Быстрый старт для новичка: рост рабочих весов почти каждую неделю, привычка к базовым движениям.',
  recovery: 'Сон 7–9 часов, день отдыха между тренировками, без отказа в T1.',
  whatElse: ['Лёгкая ходьба в дни отдыха.', 'Подсобка T3 — по самочувствию.', 'Видео техники раз в неделю.'],
  avoid: ['Отказ в T1.', 'Слишком быстрый рост веса.', 'Пропуск разминки.'],
  restGuidance: ['T1 — 3 минуты.', 'T2 — 2 минуты.', 'T3 — 60–90 секунд.'],
  progression: 'Выполнили T1 3+ — добавьте 2,5 кг (присед/жим) или 5 кг (становая). Не выполнили — повторите вес.',
  weekNotes: [
    'Неделя 1: вкатка, комфортные веса.',
    'Неделя 2: добавляем вес по правилу T1.',
    'Неделя 3: закрепление.',
    'Неделя 4: повтор или разгрузка по самочувствию.',
  ],
  accessoryPolicy: 'T3 — 2–3 упражнения по 12–15 повторений, без отказа.',
  weeks: [0, 1, 2, 3].map(index => shiftWeek(gzclpBase, index, 2.5)),
  source: 'GZCLP — общедоступная линейная схема GZCL; проценты ориентировочные.',
};

/* ------------------------------------------------------------------ */
/* PHUL                                                                */
/* ------------------------------------------------------------------ */
const phulBase = week('phul_base', 'Базовая неделя', [
  day('phul_d1', 'Верх — сила', [
    ex('Жим лёжа', 4, '5', 75, 'bench', undefined, 180),
    ex('Тяга штанги в наклоне', 4, '6', 70, 'accessory', undefined, 120),
    ex('Жим над головой', 3, '8', 65, 'ohp', undefined, 120),
    ex('Подтягивания', 3, '8', undefined, 'accessory', undefined, 90),
    ex('Сгибания на бицепс', 3, '10', undefined, 'accessory', undefined, 60),
  ], 'bench'),
  day('phul_d2', 'Низ — сила', [
    ex('Присед со штангой', 4, '5', 75, 'squat', undefined, 180),
    ex('Румынская тяга', 4, '6', 70, 'deadlift', undefined, 150),
    ex('Жим ногами', 3, '10', undefined, 'accessory', undefined, 90),
    ex('Подъём на носки', 4, '12', undefined, 'accessory', undefined, 60),
    ex('Пресс', 3, '12', undefined, 'accessory', undefined, 60),
  ], 'squat'),
  day('phul_d3', 'Верх — объём', [
    ex('Жим гантелей лёжа', 4, '10', 60, 'bench', undefined, 120),
    ex('Тяга верхнего блока', 4, '10', undefined, 'accessory', undefined, 90),
    ex('Махи в стороны', 3, '15', undefined, 'accessory', undefined, 60),
    ex('Тяга гантели одной рукой', 3, '12', undefined, 'accessory', undefined, 75),
    ex('Разгибания на трицепс', 3, '12', undefined, 'accessory', undefined, 60),
  ], 'bench'),
  day('phul_d4', 'Низ — объём', [
    ex('Присед со штангой', 4, '10', 60, 'squat', undefined, 150),
    ex('Сгибания ног', 4, '12', undefined, 'accessory', undefined, 75),
    ex('Разгибания ног', 3, '15', undefined, 'accessory', undefined, 60),
    ex('Ягодичный мост', 3, '12', undefined, 'accessory', undefined, 60),
    ex('Подъём на носки сидя', 4, '15', undefined, 'accessory', undefined, 60),
  ], 'squat'),
]);

const phul: CycleTemplate = {
  id: 'phul',
  name: 'PHUL',
  author: 'Power Hypertrophy Upper Lower',
  goal: 'hypertrophy',
  level: 'intermediate',
  kind: 'program',
  mainLifts: ['squat', 'bench', 'deadlift', 'ohp'],
  weeksCount: 4,
  daysPerWeek: 4,
  description: 'Верх/низ с силовыми и объёмными днями: 2 силовых и 2 гипертрофийных тренировки в неделю.',
  focus: 'Сила + гипертрофия. Хорошо подходит, если нужен баланс объёма и рабочих весов.',
  equipment: 'Штанга, гантели, блоки, тренажёры.',
  warnings: [
    'Следите за восстановлением: 4 дня с разной интенсивностью.',
    'Не добавляйте отказные подходы в силовые дни.',
  ],
  expectedResult: 'Рост мышц и рабочих весов, улучшение формы и выносливости в среднем диапазоне повторений.',
  recovery: 'Сон 8 часов, 2–3 дня отдыха, достаточный белок и вода.',
  whatElse: ['Кардио 2 раза в неделю по 20–30 минут.', 'Растяжка после тренировки.', 'Контроль техники в силовых днях.'],
  avoid: ['Отказ в силовых днях.', 'Пропуск разминки.', 'Слишком много добавочных упражнений.'],
  restGuidance: ['Силовые подходы — 2–3 минуты.', 'Объёмные — 60–90 секунд.', 'Подсобка — 60 секунд.'],
  progression: 'Силовые дни: +2,5 кг при выполнении всех подходов. Объёмные: добавляйте повтор или вес небольшими шагами.',
  weekNotes: [
    'Неделя 1: вкатка.',
    'Неделя 2: добавляем вес в силовых.',
    'Неделя 3: объём выше.',
    'Неделя 4: закрепление или разгрузка.',
  ],
  accessoryPolicy: 'Подсобка 2–3 упражнения на день, без отказа.',
  weeks: [0, 1, 2, 3].map(index => shiftWeek(phulBase, index, 2.5)),
  source: 'PHUL — популярная верх/низ схема; структура адаптирована.',
};

export const CYCLE_TEMPLATES: CycleTemplate[] = [
  smolovJr,
  wendler,
  sheiko,
  verkhoshansky,
  gzclp,
  phul,
];

export const CYCLE_CUSTOM_STORAGE_KEY = 'getfit_custom_cycles';
export const CYCLE_ACTIVE_STORAGE_KEY = 'getfit_active_cycle';

export interface ActiveCycle {
  templateId: string;
  startDate: string;
  weekIndex: number;
  maxes: Partial<Record<CycleLift, number>>;
  completed: Record<string, boolean>;
  /** Для специализации: выбранное основное движение. */
  mainLift?: CycleLift;
  /** Для гибких программ: выбранные основные движения. */
  mainLifts?: CycleLift[];
  /** Внесённый рабочий вес по дню: `${weekIndex}-${dayId}` -> кг. */
  actualWeights?: Record<string, number>;
  /** Короткая заметка о выполнении дня. */
  notes?: Record<string, string>;
  /** Когда день отмечен выполненным: `${weekIndex}-${dayId}` -> ISO. */
  completedAt?: Record<string, string>;
}

export function loadCustomCycles(): CycleTemplate[] {
  try {
    const raw = localStorage.getItem(CYCLE_CUSTOM_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item: unknown) => normalizeCycleTemplate(item))
      .filter((item: CycleTemplate | null): item is CycleTemplate => Boolean(item));
  } catch {
    return [];
  }
}

/** Дозаполняет старые пользовательские циклы, сохранённые до появления новых полей. */
export function normalizeCycleTemplate(raw: unknown): CycleTemplate | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Partial<CycleTemplate> & { weeks?: CycleWeek[] };
  if (!source.id || !Array.isArray(source.weeks) || source.weeks.length === 0) return null;
  const weeks = source.weeks
    .filter(weekItem => weekItem && Array.isArray(weekItem.days))
    .map((weekItem, weekIndex) => ({
      id: weekItem.id || `custom_w${weekIndex + 1}`,
      label: weekItem.label || `Неделя ${weekIndex + 1}`,
      days: weekItem.days
        .filter(dayItem => dayItem && Array.isArray(dayItem.exercises))
        .map((dayItem, dayIndex) => ({
          id: dayItem.id || `custom_w${weekIndex + 1}_d${dayIndex + 1}`,
          label: dayItem.label || `День ${dayIndex + 1}`,
          focus: dayItem.focus,
          mainLift: dayItem.mainLift,
          exercises: dayItem.exercises.map(exercise => ({
            name: exercise.name || 'Упражнение',
            lift: exercise.lift || 'accessory',
            sets: Math.max(1, Number(exercise.sets) || 1),
            reps: exercise.reps || '10',
            percent: exercise.percent,
            restSeconds: exercise.restSeconds,
            optional: exercise.optional,
            note: exercise.note,
          })),
        })),
    }));
  if (weeks.length === 0) return null;
  const derivedLifts = [
    ...new Set(
      weeks
        .flatMap(weekItem => weekItem.days.flatMap(dayItem => dayItem.exercises.map(exercise => exercise.lift)))
        .filter((lift): lift is CycleLift => Boolean(lift && lift !== 'accessory' && lift !== 'main')),
    ),
  ];
  const weekNotes = Array.isArray(source.weekNotes) && source.weekNotes.length > 0
    ? source.weekNotes
    : weeks.map((_, index) => `Неделя ${index + 1}: по вашему плану.`);
  return {
    id: source.id,
    name: source.name || 'Свой цикл',
    author: source.author || 'Свой',
    goal: source.goal || 'strength',
    level: source.level || 'intermediate',
    kind: source.kind === 'specialization' ? 'specialization' : 'program',
    mainLifts: Array.isArray(source.mainLifts) && source.mainLifts.length > 0
      ? source.mainLifts
      : derivedLifts.length > 0
        ? derivedLifts
        : ['squat', 'bench', 'deadlift'],
    mainLiftOptions: source.mainLiftOptions,
    allowMultipleMainLifts: source.allowMultipleMainLifts,
    weeksCount: source.weeksCount || weeks.length,
    daysPerWeek: source.daysPerWeek || Math.max(...weeks.map(weekItem => weekItem.days.length)),
    description: source.description || 'Пользовательский цикл.',
    focus: source.focus || 'Собственная структура',
    equipment: source.equipment || 'По вашему плану',
    warnings: Array.isArray(source.warnings) && source.warnings.length > 0
      ? source.warnings
      : ['Проверяйте технику и восстановление; это ваш собственный план.'],
    expectedResult: source.expectedResult || 'Зависит от программы и восстановления.',
    recovery: source.recovery || 'Сон, отдых и контроль самочувствия.',
    whatElse: Array.isArray(source.whatElse) && source.whatElse.length > 0
      ? source.whatElse
      : ['Лёгкая подсобка и ходьба в дни отдыха.'],
    avoid: Array.isArray(source.avoid) && source.avoid.length > 0
      ? source.avoid
      : ['Отказные подходы без подготовки.', 'Резкий рост веса.'],
    restGuidance: Array.isArray(source.restGuidance) && source.restGuidance.length > 0
      ? source.restGuidance
      : ['Основные подходы — 2–3 минуты.', 'Подсобка — 60–90 секунд.'],
    progression: source.progression || 'Добавляйте вес, когда выполняете все подходы с запасом.',
    weekNotes,
    accessoryPolicy: source.accessoryPolicy || 'Подсобка по желанию, без отказа.',
    weeks,
    source: source.source || 'Создано пользователем',
    custom: source.custom !== false,
  };
}

export function saveCustomCycles(cycles: CycleTemplate[]): void {
  try {
    localStorage.setItem(CYCLE_CUSTOM_STORAGE_KEY, JSON.stringify(cycles));
  } catch {
    // ignore
  }
}

export function loadActiveCycle(): ActiveCycle | null {
  try {
    const raw = localStorage.getItem(CYCLE_ACTIVE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveActiveCycle(cycle: ActiveCycle | null): void {
  try {
    if (cycle) localStorage.setItem(CYCLE_ACTIVE_STORAGE_KEY, JSON.stringify(cycle));
    else localStorage.removeItem(CYCLE_ACTIVE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function cycleTemplateById(id: string, custom: CycleTemplate[] = []): CycleTemplate | undefined {
  return [...CYCLE_TEMPLATES, ...custom].find(item => item.id === id);
}

export function resolveCycleLift(lift: CycleLift | undefined, mainLift?: CycleLift): CycleLift | undefined {
  if (lift === 'main') return mainLift || 'bench';
  return lift;
}

export function calculateCycleWeight(
  percent: number | undefined,
  lift: CycleLift | undefined,
  maxes: Partial<Record<CycleLift, number>>,
  mainLift?: CycleLift,
): number {
  const resolved = resolveCycleLift(lift, mainLift);
  if (!percent || !resolved || resolved === 'accessory') return 0;
  const max = maxes[resolved] || 0;
  if (max <= 0) return 0;
  return Math.round((max * percent) / 100 / 2.5) * 2.5;
}

export function requiredMaxes(template: CycleTemplate, active?: ActiveCycle | null): CycleLift[] {
  if (template.mainLiftOptions?.length) {
    if (active?.mainLift) return [active.mainLift];
    if (template.allowMultipleMainLifts && active?.mainLifts?.length) return active.mainLifts;
    return template.mainLiftOptions;
  }
  return template.mainLifts.filter(lift => lift !== 'main' && lift !== 'accessory');
}

/** Оставляет в гибком шаблоне только дни выбранных основных движений. */
export function applyCycleSelection(
  template: CycleTemplate,
  active?: ActiveCycle | null,
): CycleTemplate {
  if (!active || !template.allowMultipleMainLifts || !active.mainLifts?.length) return template;
  const selected = new Set(active.mainLifts);
  return {
    ...template,
    weeks: template.weeks.map(weekItem => ({
      ...weekItem,
      days: weekItem.days.filter(dayItem => !dayItem.mainLift || selected.has(dayItem.mainLift)),
    })),
  };
}

export function parseCustomCycle(
  title: string,
  goal: CycleGoal,
  level: CycleLevel,
  description: string,
  text: string,
): CycleTemplate {
  const weeksMap = new Map<number, Map<number, CycleExercise[]>>();
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (const line of lines) {
    const match = line.match(/(?:недел[а-яё]*|нед\.?)\s*(\d+).*?(?:день|дн\.?)\s*(\d+)\s*[|:]\s*(.+)$/i)
      || line.match(/(\d+)\s*[.,/]\s*(\d+)\s*[|:]\s*(.+)$/);
    if (!match) continue;
    const weekIndex = Math.max(1, Number(match[1])) - 1;
    const dayIndex = Math.max(1, Number(match[2])) - 1;
    const body = match[3].trim();
    if (!body) continue;
    if (!weeksMap.has(weekIndex)) weeksMap.set(weekIndex, new Map());
    const weekMap = weeksMap.get(weekIndex)!;
    if (!weekMap.has(dayIndex)) weekMap.set(dayIndex, []);
    for (const part of body.split(/[;•·]/).map(item => item.trim()).filter(Boolean)) {
      weekMap.get(dayIndex)!.push(parseExercise(part));
    }
  }
  const weekEntries = [...weeksMap.entries()].sort((a, b) => a[0] - b[0]);
  const weeks = weekEntries.map(([weekIndex, daysMap]) => week(
    `custom_w${weekIndex + 1}`,
    `Неделя ${weekIndex + 1}`,
    [...daysMap.entries()].sort((a, b) => a[0] - b[0]).map(([dayIndex, exercises]) => day(
      `custom_w${weekIndex + 1}_d${dayIndex + 1}`,
      `День ${dayIndex + 1}`,
      exercises,
    )),
  ));
  const mainLifts = [...new Set(weeks.flatMap(weekItem => weekItem.days.flatMap(dayItem => dayItem.exercises.map(item => item.lift)).filter((lift): lift is CycleLift => Boolean(lift && lift !== 'accessory'))))];
  return {
    id: `custom_${Date.now()}`,
    name: title.trim() || 'Свой цикл',
    author: 'Свой',
    goal,
    level,
    kind: 'program',
    mainLifts: mainLifts.length > 0 ? mainLifts : ['squat', 'bench', 'deadlift'],
    weeksCount: Math.max(1, weeks.length),
    daysPerWeek: Math.max(1, ...weeks.map(item => item.days.length)),
    description: description.trim() || 'Пользовательский цикл.',
    focus: 'Собственная структура',
    equipment: 'По вашему плану',
    warnings: ['Проверяйте технику и восстановление; это ваш собственный план.'],
    expectedResult: 'Зависит от вашей программы и восстановления.',
    recovery: 'Сон, отдых и контроль самочувствия.',
    whatElse: ['Добавьте лёгкую подсобку и ходьбу, если нужно.'],
    avoid: ['Отказные подходы без подготовки.', 'Резкий рост веса.'],
    restGuidance: ['Основные подходы — 2–3 минуты.', 'Подсобка — 60–90 секунд.'],
    progression: 'Добавляйте вес, когда выполняете все подходы с запасом.',
    weekNotes: weeks.map((_, index) => `Неделя ${index + 1}: по вашему плану.`),
    accessoryPolicy: 'Подсобка по желанию.',
    weeks: weeks.length > 0 ? weeks : [week('custom_w1', 'Неделя 1', [day('custom_w1_d1', 'День 1', [ex('Присед со штангой', 5, '5', 70, 'squat')])])],
    source: 'Создано пользователем',
    custom: true,
  };
}

function parseExercise(text: string): CycleExercise {
  const normalized = text.replace(/[×x]/g, 'x');
  const percentMatch = normalized.match(/(\d{1,3})\s*%/);
  const schemeMatch = normalized.match(/(\d+)\s*x\s*(\d+(?:\+)?)/i);
  const name = normalized
    .replace(/(\d+)\s*x\s*\d+(?:\+)?/i, '')
    .replace(/\d{1,3}\s*%/g, '')
    .replace(/[-–—|]/g, ' ')
    .trim();
  const matchName = name.toLowerCase().replace(/ё/g, 'е');
  return {
    name: name || 'Упражнение',
    sets: schemeMatch ? Number(schemeMatch[1]) : 3,
    reps: schemeMatch ? schemeMatch[2] : '10',
    percent: percentMatch ? Number(percentMatch[1]) : undefined,
    lift: /присед|squat/i.test(matchName) ? 'squat' : /жим.*леж|bench/i.test(matchName) ? 'bench' : /станов|deadlift/i.test(matchName) ? 'deadlift' : /жим.*(стоя|голов|overhead)|ohp/i.test(matchName) ? 'ohp' : 'accessory',
  };
}
