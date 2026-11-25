import type { NavTab } from '../components/Navigation';
import { FeatureFlags } from './features';

/**
 * Онбординг-туры приложения.
 *
 * Основной тур объясняет базовые разделы и показывает, где живут
 * дополнительные. Для каждого включённого дополнительного раздела есть
 * короткий отдельный тур: он запускается при первом открытии вкладки после
 * завершения основного обучения. Зарубы сюда намеренно не входят.
 */

export type TourTarget = string | (() => Element | null);

export type SectionTourId = 'marathons' | 'discipline' | 'ranks' | 'lab' | 'periodization';
export type TourId = 'main' | SectionTourId;

export interface TourStep {
  id: string;
  /** На какую вкладку приложения перейти перед показом шага. */
  tab?: NavTab;
  target?: TourTarget;
  title: string;
  description: string;
  bullets?: string[];
  /**
   * Подготовка экрана перед поиском цели: открыть под-вкладку или нажать
   * нужную кнопку. Тур сам дождётся появления элемента.
   */
  prepare?: () => void | Promise<void>;
}

export const LEGACY_MAIN_TOUR_KEY = 'getfit_tour_completed';
const TOUR_KEY_PREFIX = 'getfit_tour_done';

export const SECTION_TOUR_IDS: SectionTourId[] = [
  'marathons',
  'discipline',
  'ranks',
  'lab',
  'periodization',
];

const storage = (): Storage | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};

export const tourDoneKey = (tourId: TourId, userId?: string | null): string =>
  `${TOUR_KEY_PREFIX}:${userId || 'local'}:${tourId}`;

/** Флаг прохождения тура. Для основного тура понимаем и старый ключ. */
export function isTourDone(tourId: TourId, userId?: string | null): boolean {
  const store = storage();
  if (!store) return false;
  try {
    if (tourId === 'main' && store.getItem(LEGACY_MAIN_TOUR_KEY) === 'true') return true;
    return store.getItem(tourDoneKey(tourId, userId)) === 'true';
  } catch {
    return false;
  }
}

export function markTourDone(tourId: TourId, userId?: string | null): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(tourDoneKey(tourId, userId), 'true');
    if (tourId === 'main') store.setItem(LEGACY_MAIN_TOUR_KEY, 'true');
  } catch {
    /* приватный режим */
  }
}

export function resetTour(tourId: TourId, userId?: string | null): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(tourDoneKey(tourId, userId));
    if (tourId === 'main') store.removeItem(LEGACY_MAIN_TOUR_KEY);
  } catch {
    /* ignore */
  }
}

export function resetAllTours(userId?: string | null): void {
  const store = storage();
  if (!store) return;
  try {
    (['main', ...SECTION_TOUR_IDS] as TourId[]).forEach((id) => {
      store.removeItem(tourDoneKey(id, userId));
    });
    store.removeItem(LEGACY_MAIN_TOUR_KEY);
  } catch {
    /* ignore */
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Ждёт кнопку и нажимает её: так под-вкладка откроется даже после ленивой загрузки. */
async function clickWhenReady(selector: string, tries = 60): Promise<void> {
  if (typeof document === 'undefined') return;
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const element = document.querySelector(selector);
    if (element instanceof HTMLElement) {
      element.click();
      return;
    }
    await sleep(60);
  }
}

/* ------------------------------------------------------------------ */
/* Основной тур                                                        */
/* ------------------------------------------------------------------ */

const FEATURE_PLACEMENT: Record<SectionTourId, string> = {
  marathons: '«Тренировки» → вкладка «Марафоны»',
  discipline: 'вкладка «Дисциплина» в нижнем меню',
  ranks: 'вкладка «Разряды» в нижнем меню',
  lab: 'вкладка «Лаборатория» в нижнем меню',
  periodization: 'вкладка «Циклы» в нижнем меню',
};

const FEATURE_LABEL: Record<SectionTourId, string> = {
  marathons: 'Марафоны целей',
  discipline: 'Дисциплина',
  ranks: 'Спортивные разряды',
  lab: 'Лаборатория',
  periodization: 'Циклы тренировок',
};

const enabledSections = (features?: FeatureFlags): SectionTourId[] =>
  SECTION_TOUR_IDS.filter((key) => Boolean(features?.[key]));

/** Есть ли в нижнем меню «Ещё»: один дополнительный раздел показывается напрямую. */
const hasMoreMenu = (features?: FeatureFlags): boolean => {
  const bottomTabs = (['discipline', 'ranks', 'lab', 'periodization', 'body'] as const).filter(
    (key) => Boolean(features?.[key]),
  );
  // Зарубы тоже занимают место в нижнем меню, поэтому учитываем их в переполнении.
  return bottomTabs.length + (features?.battles ? 1 : 0) > 1;
};

export function buildMainTourSteps(features?: FeatureFlags): TourStep[] {
  const sections = enabledSections(features);
  const battlesEnabled = Boolean(features?.battles);
  const bodyEnabled = Boolean(features?.body);
  const moreMenu = hasMoreMenu(features);
  const optionalNavCount = sections.length + (battlesEnabled ? 1 : 0) + (bodyEnabled ? 1 : 0);

  // Марафоны не занимают место в нижнем меню: это под-вкладка «Тренировок».
  const bottomSections = sections.filter((key) => key !== 'marathons');
  const bottomNavCount = bottomSections.length + (battlesEnabled ? 1 : 0) + (bodyEnabled ? 1 : 0);
  const onlyMarathons = bottomNavCount === 0 && sections.includes('marathons');
  const singleNavItem: NavTab | null =
    bottomNavCount === 1
      ? bodyEnabled && bottomSections.length === 0 && !battlesEnabled
        ? 'body'
        : (bottomSections[0] as NavTab | undefined) || (battlesEnabled ? 'battles' : null)
      : null;

  const placementStep: TourStep[] =
    optionalNavCount > 0
      ? [
          {
            id: 'optional-sections',
            tab: moreMenu
              ? undefined
              : onlyMarathons
                ? 'workouts'
                : (singleNavItem as NavTab | null) || undefined,
            target: moreMenu
              ? '#tour-tab-more'
              : onlyMarathons
                ? '#tour-tab-workouts'
                : `#tour-tab-${singleNavItem}`,
            title: 'Где дополнительные разделы',
            description: moreMenu
              ? 'Включённые разделы собраны под кнопкой «Ещё» — нижняя панель остаётся компактной. У каждого раздела есть короткое обучение при первом открытии.'
              : onlyMarathons
                ? 'Марафоны живут внутри «Тренировок» отдельной вкладкой. При первом открытии приложение само покажет короткую подсказку.'
                : sections.includes('marathons')
                  ? 'Этот раздел появился в нижнем меню, а марафоны живут внутри «Тренировок». При первом открытии каждого раздела будет короткая подсказка.'
                  : 'Включённый раздел появился в нижнем меню. При первом открытии приложение само покажет короткую подсказку.',
            bullets: [
              ...sections.map((key) => `${FEATURE_LABEL[key]} — ${FEATURE_PLACEMENT[key]}`),
              ...(bodyEnabled
                ? ['Тело и биомеханика — вкладка «Тело» в нижнем меню']
                : []),
              ...(battlesEnabled
                ? ['Зарубы с друзьями — отдельная вкладка в нижнем меню']
                : []),
              moreMenu
                ? 'Открыть список: «Ещё» внизу справа'
                : 'Любой раздел можно выключить в профиле',
            ],
          },
        ]
      : [
          {
            id: 'optional-off',
            tab: 'profile',
            target: '#feature-settings',
            title: 'Дополнительные разделы по желанию',
            description:
              'Приложение не перегружает первый экран: в базовом режиме остаются четыре вкладки. Когда понадобятся марафоны, дисциплина, разряды, циклы, тело или лаборатория — включите их здесь.',
            bullets: [
              'Выключите «Базовый режим» и включите нужный раздел',
              'Один раздел появится сразу в нижнем меню',
              'Несколько разделов прячутся под «Ещё»',
            ],
          },
        ];

  return [
    {
      id: 'welcome',
      title: 'Добро пожаловать в GetFitBot',
      description:
        'Приложение начинается с базового режима: только четыре главные вкладки. Дополнительные разделы можно включить позже в профиле.',
      bullets: [
        'Тренировки, питание, прогресс и профиль — внизу',
        'Базовый режим не перегружает первый экран',
        'Обучение можно пройти заново через «?» в шапке',
      ],
    },
    {
      id: 'navigation',
      target: 'nav',
      title: 'Четыре вкладки внизу',
      description:
        'Переключайтесь между тренировками, питанием, прогрессом и профилем. Если включить несколько дополнительных разделов, они прячутся под «Ещё».',
      bullets: [
        '«Тренировки» — планы, свободная тренировка и шаблоны',
        '«Питание» — еда, КБЖУ, вода и сон',
        '«Прогресс» — графики и отчёт за период',
        '«Профиль» — цели, состав тела, рекорды и настройки',
      ],
    },
    {
      id: 'templates',
      tab: 'workouts',
      target: '#tour-templates-block',
      title: 'Шаблоны тренировок',
      description:
        'Соберите тренировку один раз — и запускайте её в один клик. Шаблоны можно хранить у себя или передавать другу ссылкой.',
      bullets: [
        'Упражнения по группам мышц, подходы, вес и отдых',
        'Своя библиотека и готовые шаблоны',
        'Поделиться можно ссылкой или кодом',
      ],
    },
    {
      id: 'quick-workout',
      tab: 'workouts',
      target: '#tour-quick-workout-btn',
      title: 'Быстрая тренировка',
      description:
        'Если плана нет, начните свободную тренировку: добавляйте упражнения по ходу и записывайте подходы.',
      bullets: [
        'ИИ понимает записи вроде «жим 100 на 10»',
        'Вес, повторения и таймер отдыха — под рукой',
        'После финиша тренировку можно сохранить как шаблон',
      ],
    },
    {
      id: 'readiness',
      tab: 'workouts',
      target: '#tour-readiness-card',
      title: 'Готовность к тренировке',
      description:
        'Оцените сон, стресс и боль за 30 секунд — приложение подскажет, стоит ли снизить рабочие веса.',
      bullets: [
        'Подсказка по нагрузке с учётом самочувствия',
        'Помогает не уйти в перетренированность',
        'Работает и без ключей ИИ — по понятным правилам',
      ],
    },
    {
      id: 'nutrition',
      tab: 'nutrition',
      target: '#tour-nutrition-subtabs',
      title: 'Питание и сон',
      description:
        'Калории, белки, жиры, углеводы, вода и сон — в одном разделе. Приёмы пищи можно вносить вручную или текстом.',
      bullets: [
        'Дневная цель и остаток по КБЖУ',
        'Отдельные вкладки для еды, сна и ИИ-разбора',
        'Данные участвуют в отчёте за период',
      ],
    },
    {
      id: 'progress',
      tab: 'charts',
      target: '#open-period-stats',
      title: 'Прогресс и отчёт за период',
      description:
        'Графики показывают динамику, а отчёт считает итоги прямо в приложении — без сообщений бота по расписанию.',
      bullets: [
        'Периоды: 7, 30, 90 дней или всё время',
        'Общий вес, подходы, сон, калории, шаги и вес тела',
        'Сравнение с предыдущим периодом',
      ],
    },
    {
      id: 'profile',
      tab: 'profile',
      target: '#tour-profile-card',
      title: 'Профиль спортсмена',
      description:
        'Здесь собраны цель по весу, шаги, состав тела, личные рекорды и выбранные направления. Карточку можно быстро отредактировать.',
      bullets: [
        'Вес, рост и цель — в одном окне редактирования',
        'Состав тела и личные рекорды хранятся отдельно',
        'Резервная копия данных всегда под рукой',
      ],
    },
    {
      id: 'settings',
      tab: 'profile',
      target: '#tour-feature-mode',
      title: 'Базовый и расширенный режим',
      description:
        'В профиле находится переключатель режима. Базовый оставляет четыре вкладки, расширенный показывает тумблеры дополнительных разделов.',
      bullets: [
        'Каждый дополнительный раздел включается отдельно',
        'Больше одного раздела — появляется «Ещё»',
        'Обучение можно запустить заново в любой момент',
      ],
    },
    ...placementStep,
    {
      id: 'ai',
      tab: 'profile',
      target: '#header-ai-brain-btn',
      title: 'ИИ-помощник',
      description:
        'Кнопка с мозгом в шапке открывает настройки ИИ: личную инструкцию, травмы, ограничения и спортивное питание.',
      bullets: [
        'Провайдер и резерв показываются честно',
        'Без ключей работает встроенный разбор',
        'Настройки применяются к тренировкам и питанию',
      ],
    },
    {
      id: 'finish',
      title: 'Всё готово',
      description:
        'Это основные разделы приложения. Начните с тренировки или внесите питание — данные сохранятся и попадут в отчёты.',
      bullets: [
        'Обучение всегда доступно по кнопке «?» в шапке',
        'Дополнительные разделы включаются в профиле',
        'Повторный запуск разделов — в профиле, блок «Обучение»',
      ],
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Туры по дополнительным разделам                                     */
/* ------------------------------------------------------------------ */

const SECTION_TOURS: Record<SectionTourId, TourStep[]> = {
  marathons: [
    {
      id: 'marathons-intro',
      tab: 'workouts',
      prepare: () => clickWhenReady('#tour-marathon-tab-btn'),
      target: '#tour-marathon-banner',
      title: 'Марафоны целей',
      description:
        'Марафон — это серия дней с одной понятной целью: шаги, жим, велосипед или снижение веса. Вкладка живёт внутри «Тренировок».',
      bullets: [
        'Длительность от 7 до 30 дней',
        'Каждый день отмечаете результат',
        'В конце — медаль и баллы рейтинга',
      ],
    },
    {
      id: 'marathons-bank',
      tab: 'workouts',
      prepare: () => clickWhenReady('#tour-marathon-tab-btn'),
      target: '#tour-marathon-bank',
      title: 'Копилка остатка шагов',
      description:
        'Если прошли больше дневной цели, излишек не пропадает. Он попадает в копилку и может закрыть день с меньшей активностью.',
      bullets: [
        'В копилку идёт только перевыполнение шагов',
        'Остаток можно потратить в любой день марафона',
        'Нажмите «Закрыть день из копилки» под прогрессом',
      ],
    },
    {
      id: 'marathons-create',
      tab: 'workouts',
      prepare: () => clickWhenReady('#tour-marathon-tab-btn'),
      target: '#tour-marathon-create',
      title: 'Создание марафона',
      description:
        'Выберите готовый шаблон или задайте свой норматив, длительность и периодичность. Прогресс сохраняется автоматически.',
      bullets: [
        'Шаблоны: шаги, жим, велосипед, снижение веса',
        'Можно выбрать фиксацию каждый день или по тренировкам',
        'Результат дня вносится одной кнопкой',
      ],
    },
  ],
  discipline: [
    {
      id: 'discipline-score',
      tab: 'discipline',
      target: '#tour-discipline-score',
      title: 'Индекс дисциплины',
      description:
        'Процент показывает, насколько стабильно вы выполняете план. Рядом — серия дней, лучшая серия и дневная норма шагов.',
      bullets: [
        'Выполненные тренировки повышают индекс',
        'Пропуски и срывы снижают его',
        'Норму шагов можно изменить прямо здесь',
      ],
    },
    {
      id: 'discipline-penalties',
      tab: 'discipline',
      target: '#tour-discipline-penalties',
      title: 'Штрафные задания',
      description:
        'За пропуск можно назначить себе понятное задание: кардио, дополнительную ходьбу или паузу без сладкого. После выполнения индекс возвращается.',
      bullets: [
        'Задание видно до закрытия',
        'Кнопка «Выполнил» возвращает очки',
        'История закрытых заданий хранится ниже',
      ],
    },
    {
      id: 'discipline-presets',
      tab: 'discipline',
      target: '#tour-discipline-presets',
      title: 'Быстрые задания',
      description:
        'Не нужно придумывать формулировку: выберите готовый вариант или соберите своё задание. Это помогает вернуться к режиму без чувства вины.',
      bullets: [
        'Готовые варианты на любой случай',
        'Своё задание с причиной и штрафом',
        'Перенос тренировки сохраняет очки',
      ],
    },
  ],
  ranks: [
    {
      id: 'ranks-intro',
      tab: 'ranks',
      target: '#tour-ranks-banner',
      title: 'Спортивные разряды',
      description:
        'Здесь собраны нормативы разных федераций: от юношеских разрядов до КМС и МС. Выберите движение и посмотрите, где вы сейчас.',
      bullets: [
        'Пауэрлифтинг, стритлифтинг, бег и шаги',
        'Нормативы зависят от весовой категории',
        'Можно поставить следующее звание целью',
      ],
    },
    {
      id: 'ranks-form',
      tab: 'ranks',
      target: '#tour-ranks-form',
      title: 'Ваш результат',
      description:
        'Укажите вес тела и результат в выбранном движении. Приложение подберёт подходящую категорию и сравнит с нормативами.',
      bullets: [
        'Для силовых упражнений важен вес тела',
        'Для бега и шагов — только результат',
        'Расчёт обновляется по кнопке сравнения',
      ],
    },
    {
      id: 'ranks-ladder',
      tab: 'ranks',
      target: '#tour-ranks-ladder',
      title: 'Лестница разрядов',
      description:
        'Ниже видно все ступени: достигнутые, текущую и следующую. Полоска показывает, сколько осталось до ближайшей цели.',
      bullets: [
        'Текущий разряд выделен цветом',
        'Видно точный остаток в кг, секундах или шагах',
        'Цель можно сохранить в профиль',
      ],
    },
  ],
  lab: [
    {
      id: 'lab-intro',
      tab: 'lab',
      prepare: () => clickWhenReady('#tour-lab-tab-experiments'),
      target: '#tour-lab-banner',
      title: 'Лаборатория личных экспериментов',
      description:
        'Раздел для проверки привычек на себе: сон, вода, добавки, восстановление. Гипотеза, ежедневные замеры и понятный вывод.',
      bullets: [
        'Не нужно быть учёным — всё по шагам',
        'Можно начать из готового шаблона',
        'ИИ помогает сформулировать вывод',
      ],
    },
    {
      id: 'lab-experiments',
      tab: 'lab',
      prepare: () => clickWhenReady('#tour-lab-tab-experiments'),
      target: '#tour-lab-experiments',
      title: 'Эксперименты',
      description:
        'У каждого эксперимента есть гипотеза, факторы влияния и один показатель, который вы измеряете. Результаты вносятся за день.',
      bullets: [
        'Факторы: вода, сон, добавки, стресс',
        'Показатель: максимум, общий вес, самочувствие',
        'Кнопка замера открывает короткую форму',
      ],
    },
    {
      id: 'lab-metrics',
      tab: 'lab',
      prepare: () => clickWhenReady('#tour-lab-tab-metrics'),
      target: '#tour-lab-metrics',
      title: 'Свои показатели',
      description:
        'Можно завести собственные показатели: боль в плече, стресс, приём креатина. Приложение показывает, с чем они связаны.',
      bullets: [
        'Название, категория и единица измерения',
        'Шкала 1–10 или ответ «да / нет»',
        'Связи описаны простыми словами',
      ],
    },
    {
      id: 'lab-cycles',
      tab: 'lab',
      prepare: () => clickWhenReady('#tour-lab-tab-periodization'),
      target: '#tour-lab-periodization',
      title: 'Циклы внутри лаборатории',
      description:
        'Здесь же можно посмотреть тренировочные блоки: сколько было тренировок, какой общий вес и средняя тяжесть подходов.',
      bullets: [
        'Цикл — это период от нескольких недель',
        'Видно, когда переходить к следующему блоку',
        'ИИ подсказывает длительность и нагрузку',
      ],
    },
  ],
  periodization: [
    {
      id: 'periodization-header',
      tab: 'periodization',
      target: '#tour-periodization-header',
      title: 'Циклы тренировок',
      description:
        'Цикл — это отрезок времени с одной задачей: набрать объём, выйти на силу или разгрузиться. Так проще видеть общую картину.',
      bullets: [
        'Активный блок показан первым',
        'Запланированные и прошлые — ниже',
        'Новый блок создаётся одной кнопкой',
      ],
    },
    {
      id: 'periodization-stats',
      tab: 'periodization',
      target: '#tour-periodization-list',
      title: 'Статистика блока',
      description:
        'В карточке блока видно количество тренировок, общий поднятый вес и среднюю тяжесть подходов. Цели помогают не потерять фокус.',
      bullets: [
        'Общий вес считается по завершённым тренировкам',
        'Средняя тяжесть — по шкале 1–10',
        'Даты показывают, сколько осталось до конца',
      ],
    },
    {
      id: 'periodization-create',
      tab: 'periodization',
      target: '#tour-periodization-create',
      title: 'Создание цикла',
      description:
        'Задайте название, тип, даты и комфортный диапазон тяжести. Внутри можно добавить цели и заметки.',
      bullets: [
        'Типы: рост мышц, сила, разгрузка, выносливость',
        'Диапазон тяжести помогает не перегружаться',
        'Блок можно редактировать или удалить',
      ],
    },
  ],
};

export function buildSectionTour(tourId: SectionTourId): TourStep[] {
  return SECTION_TOURS[tourId];
}

/** Раздел, который открывается отдельной вкладкой внизу. */
export function sectionForTab(tab: NavTab): SectionTourId | null {
  switch (tab) {
    case 'discipline':
      return 'discipline';
    case 'ranks':
      return 'ranks';
    case 'lab':
      return 'lab';
    case 'periodization':
      return 'periodization';
    default:
      return null;
  }
}
