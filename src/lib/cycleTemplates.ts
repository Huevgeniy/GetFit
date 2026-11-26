export type CycleGoal = 'strength' | 'hypertrophy' | 'powerlifting' | 'beginner' | 'peaking';
export type CycleLevel = 'beginner' | 'intermediate' | 'advanced';
export type CycleLift = 'squat' | 'bench' | 'deadlift' | 'ohp' | 'accessory';

export interface CycleExercise {
  name: string;
  lift?: CycleLift;
  sets: number;
  reps: string;
  percent?: number;
  note?: string;
}

export interface CycleDay {
  id: string;
  label: string;
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
  weeksCount: number;
  daysPerWeek: number;
  description: string;
  focus: string;
  equipment: string;
  warnings: string[];
  weeks: CycleWeek[];
  source: string;
  custom?: boolean;
}

const ex = (name: string, sets: number, reps: string, percent?: number, lift: CycleLift = 'accessory', note?: string): CycleExercise => ({
  name,
  sets,
  reps,
  percent,
  lift,
  note,
});

const day = (id: string, label: string, exercises: CycleExercise[]): CycleDay => ({ id, label, exercises });
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

const smolovWeek = (index: number, delta: number): CycleWeek => {
  const schemes = [
    { sets: 6, reps: '6', percent: 70 },
    { sets: 7, reps: '5', percent: 75 },
    { sets: 8, reps: '4', percent: 80 },
    { sets: 10, reps: '3', percent: 85 },
  ];
  return week(`smolov_w${index + 1}`, `Неделя ${index + 1}`, schemes.map((scheme, dayIndex) => day(
    `smolov_w${index + 1}_d${dayIndex + 1}`,
    `День ${dayIndex + 1}`,
    [
      ex('Жим лёжа (или присед)', scheme.sets, scheme.reps, scheme.percent + delta, 'bench', 'Проценты от 1ПМ выбранного движения'),
      ex('Тяга в наклоне', 4, '8', undefined, 'accessory', 'Стабильная спина'),
      ex('Пресс', 3, '12', undefined, 'accessory'),
    ],
  )));
};

const smolovJr: CycleTemplate = {
  id: 'smolov_jr',
  name: 'Смолов-младший',
  author: 'Сергей Смолов',
  goal: 'peaking',
  level: 'advanced',
  weeksCount: 4,
  daysPerWeek: 4,
  description: 'Короткий специализированный цикл для жима или приседа: 4 недели, 4 тренировки в неделю, высокая частота и объём.',
  focus: 'Жим лёжа или присед. Не сочетать с большим объёмом других тяжёлых движений.',
  equipment: 'Штанга, стойки, скамья, страховка.',
  warnings: [
    'Очень высокий объём. Нужен опыт в базовых движениях и восстановление.',
    'Не добавляйте другие тяжёлые жимы и приседы в те же дни.',
    'При боли в суставах или потере техники остановите цикл.',
  ],
  weeks: [smolovWeek(0, 0), smolovWeek(1, 2.5), smolovWeek(2, 5), smolovWeek(3, 7.5)],
  source: 'Классическая схема Smolov Jr.; проценты ориентировочные, подбирайте по восстановлению.',
};

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
      )),
      ex(item.accessory, 5, '10', undefined, 'accessory'),
      ex('Пресс', 3, '12', undefined, 'accessory'),
    ],
  )));
};

const wendler: CycleTemplate = {
  id: 'wendler_531',
  name: 'Вендлер 5/3/1',
  author: 'Джим Вендлер',
  goal: 'strength',
  level: 'intermediate',
  weeksCount: 4,
  daysPerWeek: 4,
  description: 'Четырёхнедельный блок 5/3/1: три силовых недели и разгрузка. Основные движения + доступные вспомогательные.',
  focus: 'Жим над головой, становая, жим лёжа, присед. Прогресс — от недели к неделе и от цикла к циклу.',
  equipment: 'Штанга, стойки, скамья, перекладина.',
  warnings: [
    'Проценты считаются от тренировочного максимума (90% от реального 1ПМ), а не от разового максимума.',
    'Последний подход с «+» не должен превращаться в отказной каждый раз.',
    'Разгрузочная неделя обязательна.',
  ],
  weeks: [wendler531Week(0), wendler531Week(1), wendler531Week(2), wendler531Week(3)],
  source: '5/3/1 — Jim Wendler. Схема упрощена, вспомогательные упражнения можно менять.',
};

const sheikoBase = week('sheiko_base', 'Базовая неделя', [
  day('sheiko_d1', 'День 1 — присед/жим', [
    ex('Присед со штангой', 5, '5', 70, 'squat'),
    ex('Жим лёжа', 5, '5', 70, 'bench'),
    ex('Жим гантелей лёжа', 4, '8'),
    ex('Тяга блока к поясу', 4, '10'),
    ex('Разгибания ног', 3, '12'),
  ]),
  day('sheiko_d2', 'День 2 — становая/жим', [
    ex('Становая тяга', 4, '4', 72, 'deadlift'),
    ex('Жим лёжа', 5, '5', 72, 'bench'),
    ex('Подтягивания', 4, '8'),
    ex('Гиперэкстензия', 3, '12'),
    ex('Пресс', 3, '15'),
  ]),
  day('sheiko_d3', 'День 3 — присед/жим', [
    ex('Присед со штангой', 4, '4', 75, 'squat'),
    ex('Жим лёжа', 4, '4', 75, 'bench'),
    ex('Тяга штанги в наклоне', 4, '8'),
    ex('Сгибания ног', 3, '12'),
    ex('Планка', 3, '40 сек'),
  ]),
]);

const sheiko: CycleTemplate = {
  id: 'sheiko',
  name: 'Шейко — базовый блок',
  author: 'Борис Шейко',
  goal: 'powerlifting',
  level: 'advanced',
  weeksCount: 4,
  daysPerWeek: 3,
  description: 'Упрощённый базовый блок в духе Шейко: частые приседы/жимы/тяги, средние проценты, много техники и подсобки.',
  focus: 'Пауэрлифтинг: присед, жим, становая. Подходит как пример структуры, а не официальная копия программы.',
  equipment: 'Штанга, стойки, скамья, блоки, тренажёры.',
  warnings: [
    'Высокая частота и объём. Нужен опыт и контроль восстановления.',
    'Не добавляйте отказные подходы.',
    'Это упрощённая образовательная схема, не оригинальный план Шейко.',
  ],
  weeks: [0, 1, 2, 3].map(index => shiftWeek(sheikoBase, index, 2.5)),
  source: 'Идея периодизации Бориса Шейко; структура адаптирована для приложения.',
};

const verkhoshanskyBase = week('verkh_base', 'Ударная неделя', [
  day('verkh_d1', 'День 1 — присед + прыжки', [
    ex('Присед со штангой', 5, '3', 80, 'squat'),
    ex('Выпрыгивания из приседа', 4, '6', undefined, 'accessory', 'Только при хорошей технике и без боли'),
    ex('Румынская тяга', 4, '6', 65, 'deadlift'),
    ex('Пресс', 3, '12'),
  ]),
  day('verkh_d2', 'День 2 — жим + тяга', [
    ex('Жим лёжа', 5, '3', 80, 'bench'),
    ex('Тяга штанги в наклоне', 4, '6', 70, 'accessory'),
    ex('Отжимания на брусьях', 3, '8'),
    ex('Подтягивания', 3, '6'),
  ]),
  day('verkh_d3', 'День 3 — присед + прыжки', [
    ex('Присед со штангой', 4, '4', 75, 'squat'),
    ex('Прыжки в длину с места', 4, '5', undefined, 'accessory', 'Приземление мягкое'),
    ex('Становая тяга', 4, '3', 75, 'deadlift'),
    ex('Мобильность бёдер', 3, '60 сек'),
  ]),
]);

const verkhoshansky: CycleTemplate = {
  id: 'verkhoshansky',
  name: 'Верхошанский — ударный блок',
  author: 'Юрий Верхошанский',
  goal: 'peaking',
  level: 'advanced',
  weeksCount: 4,
  daysPerWeek: 3,
  description: 'Пример ударного блока с прыжками и тяжёлыми приседами. Идея — стимуляция нервной системы, а не объём.',
  focus: 'Взрывная сила и пауэрлифтинг. Только для опытных, с хорошей техникой и здоровьем суставов.',
  equipment: 'Штанга, стойки, скамья, мягкое покрытие для прыжков.',
  warnings: [
    'Прыжки и ударная нагрузка противопоказаны при боли в коленях/спине.',
    'Не совмещать с большим объёмом кардио и бегом.',
    'Это упрощённая образовательная схема, не оригинальный план.',
  ],
  weeks: [0, 1, 2, 3].map(index => shiftWeek(verkhoshanskyBase, index, 2)),
  source: 'Идеи Юрия Верхошанского об ударной нагрузке; структура адаптирована.',
};

const gzclpBase = week('gzclp_base', 'Базовая неделя', [
  day('gzclp_d1', 'День 1 — присед', [
    ex('Присед со штангой', 5, '3+', 75, 'squat'),
    ex('Жим лёжа', 3, '10', 60, 'bench'),
    ex('Тяга верхнего блока', 3, '15', undefined, 'accessory'),
    ex('Планка', 3, '40 сек'),
  ]),
  day('gzclp_d2', 'День 2 — жим', [
    ex('Жим лёжа', 5, '3+', 75, 'bench'),
    ex('Становая тяга', 3, '10', 60, 'deadlift'),
    ex('Тяга гантели одной рукой', 3, '15', undefined, 'accessory'),
    ex('Подъём ног в висе', 3, '10', undefined, 'accessory'),
  ]),
  day('gzclp_d3', 'День 3 — становая', [
    ex('Становая тяга', 5, '3+', 75, 'deadlift'),
    ex('Присед со штангой', 3, '10', 60, 'squat'),
    ex('Жим гантелей над головой', 3, '15', undefined, 'accessory'),
    ex('Сгибания на бицепс', 3, '12', undefined, 'accessory'),
  ]),
]);

const gzclp: CycleTemplate = {
  id: 'gzclp',
  name: 'GZCLP',
  author: 'Cody Lefever (GZCL)',
  goal: 'beginner',
  level: 'beginner',
  weeksCount: 4,
  daysPerWeek: 3,
  description: 'Линейная прогрессия для новичков: тяжёлый T1 на 3+, объёмный T2 на 10 и лёгкий T3 на 15.',
  focus: 'Присед, жим, становая + доступная подсобка. Хороший вход в структурированные тренировки.',
  equipment: 'Штанга, стойки, скамья, блоки/гантели.',
  warnings: [
    'Начинайте с комфортных весов, техника важнее процентов.',
    'Если не выполнили целевые повторения, повторите вес или снизьте.',
  ],
  weeks: [0, 1, 2, 3].map(index => shiftWeek(gzclpBase, index, 2.5)),
  source: 'GZCLP — общедоступная линейная схема GZCL; проценты ориентировочные.',
};

const phulBase = week('phul_base', 'Базовая неделя', [
  day('phul_d1', 'Верх — сила', [
    ex('Жим лёжа', 4, '5', 75, 'bench'),
    ex('Тяга штанги в наклоне', 4, '6', 70, 'accessory'),
    ex('Жим над головой', 3, '8', 65, 'ohp'),
    ex('Подтягивания', 3, '8'),
    ex('Сгибания на бицепс', 3, '10'),
  ]),
  day('phul_d2', 'Низ — сила', [
    ex('Присед со штангой', 4, '5', 75, 'squat'),
    ex('Румынская тяга', 4, '6', 70, 'deadlift'),
    ex('Жим ногами', 3, '10'),
    ex('Подъём на носки', 4, '12'),
    ex('Пресс', 3, '12'),
  ]),
  day('phul_d3', 'Верх — объём', [
    ex('Жим гантелей лёжа', 4, '10', 60, 'bench'),
    ex('Тяга верхнего блока', 4, '10'),
    ex('Махи в стороны', 3, '15'),
    ex('Тяга гантели одной рукой', 3, '12'),
    ex('Разгибания на трицепс', 3, '12'),
  ]),
  day('phul_d4', 'Низ — объём', [
    ex('Присед со штангой', 4, '10', 60, 'squat'),
    ex('Сгибания ног', 4, '12'),
    ex('Разгибания ног', 3, '15'),
    ex('Ягодичный мост', 3, '12'),
    ex('Подъём на носки сидя', 4, '15'),
  ]),
]);

const phul: CycleTemplate = {
  id: 'phul',
  name: 'PHUL',
  author: 'Power Hypertrophy Upper Lower',
  goal: 'hypertrophy',
  level: 'intermediate',
  weeksCount: 4,
  daysPerWeek: 4,
  description: 'Верх/низ с силовыми и объёмными днями: 2 силовых и 2 гипертрофийных тренировки в неделю.',
  focus: 'Сила + гипертрофия. Хорошо подходит, если нужен баланс объёма и рабочих весов.',
  equipment: 'Штанга, гантели, блоки, тренажёры.',
  warnings: [
    'Следите за восстановлением: 4 дня с разной интенсивностью.',
    'Не добавляйте отказные подходы в силовые дни.',
  ],
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
    return Array.isArray(parsed) ? parsed.filter((item): item is CycleTemplate => Boolean(item?.id && item?.weeks?.length)) : [];
  } catch {
    return [];
  }
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

export function calculateCycleWeight(percent: number | undefined, lift: CycleLift | undefined, maxes: Partial<Record<CycleLift, number>>): number {
  if (!percent || !lift || lift === 'accessory') return 0;
  const max = maxes[lift] || 0;
  if (max <= 0) return 0;
  return Math.round((max * percent) / 100 / 2.5) * 2.5;
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
  return {
    id: `custom_${Date.now()}`,
    name: title.trim() || 'Свой цикл',
    author: 'Свой',
    goal,
    level,
    weeksCount: Math.max(1, weeks.length),
    daysPerWeek: Math.max(1, ...weeks.map(item => item.days.length)),
    description: description.trim() || 'Пользовательский цикл.',
    focus: 'Собственная структура',
    equipment: 'По вашему плану',
    warnings: ['Проверяйте технику и восстановление; это ваш собственный план.'],
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
