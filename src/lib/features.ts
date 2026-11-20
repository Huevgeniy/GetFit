import { UserProfile } from '../types';

/**
 * Дополнительные разделы приложения.
 *
 * В базовом режиме внизу остаются только четыре вкладки: тренировки, питание,
 * прогресс и профиль. Всё, что ниже, включает сам пользователь в настройках —
 * так приложение не выглядит перегруженным для тех, кому нужен простой дневник.
 */
export type FeatureKey = 'marathons' | 'battles' | 'discipline' | 'ranks' | 'lab' | 'periodization';

export type FeatureFlags = Record<FeatureKey, boolean>;

export interface FeatureInfo {
  key: FeatureKey;
  label: string;
  tabLabel: string;
  description: string;
  details: string;
  /** Что именно появится после включения. */
  where: string;
}

export const FEATURES: FeatureInfo[] = [
  {
    key: 'marathons',
    label: 'Марафоны целей',
    tabLabel: 'Тренировки → Марафоны',
    description: 'Серии дней с шагами, упражнениями или привычками.',
    details:
      'Внутри «Тренировок» появится вторая вкладка: марафоны шагов, отжиманий, тренировок и других целей. Можно копить остаток и не терять серию.',
    where: 'Тренировки → Марафоны целей',
  },
  {
    key: 'battles',
    label: 'Зарубы с друзьями',
    tabLabel: 'Зарубы',
    description: 'Дуэли 1 на 1 по шагам, жиму, подтягиваниям и дисциплине.',
    details:
      'Появится отдельная вкладка «Зарубы»: создаёшь вызов, отправляешь другу ссылку, оба видите один прогресс и итог. В профиле также появится раздел «Друзья и зарубы».',
    where: 'Нижнее меню → Зарубы и Профиль → Друзья и зарубы',
  },
  {
    key: 'discipline',
    label: 'Дисциплина и штрафы',
    tabLabel: 'Дисциплина',
    description: 'Очки за выполненные тренировки и штрафные задания за пропуски.',
    details:
      'Появится вкладка «Дисциплина»: календарь обязательств, штрафы за пропуск, переносы и задания, которые возвращают очки. В профиле откроется раздел «Награды».',
    where: 'Нижнее меню → Дисциплина и Профиль → Награды',
  },
  {
    key: 'ranks',
    label: 'Спортивные разряды',
    tabLabel: 'Разряды',
    description: 'Нормативы по пауэрлифтингу, стритлифтингу, бегу и шагам.',
    details:
      'Появится вкладка «Разряды»: выбираешь движение и вес, видишь нормативы от юношеских разрядов до КМС/МС и свой прогресс до цели.',
    where: 'Нижнее меню → Разряды',
  },
  {
    key: 'lab',
    label: 'Лаборатория привычек',
    tabLabel: 'Лаборатория',
    description: 'Личные эксперименты: добавки, сон, восстановление.',
    details:
      'Появится вкладка «Лаборатория»: ставишь гипотезу, ведёшь дневник и сравниваешь показатели. Это для тех, кто любит проверять методы на себе.',
    where: 'Нижнее меню → Лаборатория',
  },
  {
    key: 'periodization',
    label: 'Циклы тренировок',
    tabLabel: 'Циклы',
    description: 'Блоки роста мышц, силы и разгрузки с понятной статистикой.',
    details:
      'Появится вкладка «Циклы»: тренировки группируются в блоки, видно общий вес, среднюю тяжесть подходов и рекомендацию, когда переходить к следующему циклу.',
    where: 'Нижнее меню → Циклы',
  },
];

export const DEFAULT_FEATURES: FeatureFlags = {
  marathons: false,
  battles: false,
  discipline: false,
  ranks: false,
  lab: false,
  periodization: false,
};

export const ALL_FEATURES_ON: FeatureFlags = {
  marathons: true,
  battles: true,
  discipline: true,
  ranks: true,
  lab: true,
  periodization: true,
};

export function isAdvancedMode(user?: UserProfile | null): boolean {
  return user?.uiMode === 'advanced';
}

/**
 * Возвращает итоговые флаги. В базовом режиме всё дополнительное выключено,
 * даже если пользователь когда-то включал разделы. В расширенном режиме
 * по умолчанию тоже всё выключено: разделы включает сам пользователь.
 */
export function getFeatureFlags(user?: UserProfile | null): FeatureFlags {
  if (!isAdvancedMode(user)) return { ...DEFAULT_FEATURES };
  const saved = user?.enabledFeatures;
  if (!saved) return { ...DEFAULT_FEATURES };
  return FEATURES.reduce((flags, feature) => {
    flags[feature.key] = Boolean(saved[feature.key]);
    return flags;
  }, { ...DEFAULT_FEATURES });
}

export function featureInfo(key: FeatureKey): FeatureInfo {
  return FEATURES.find((feature) => feature.key === key) ?? FEATURES[0];
}
