import React, { useEffect, useMemo, useState } from 'react';
import { 
  Sparkles, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Dumbbell, 
  BrainCircuit, 
  Apple, 
  TrendingUp, 
  FlaskConical, 
  ShieldCheck, 
  Swords, 
  CheckCircle2,
  Zap,
  Play,
  Settings,
  Trophy,
  Award,
  Layers,
  BarChart3
} from 'lucide-react';

import { NavTab } from './Navigation';
import { FeatureFlags } from '../lib/features';

export interface TourStep {
  id: string;
  tab: NavTab;
  targetSelector?: string;
  title: string;
  badge: string;
  description: string;
  bulletPoints: string[];
  icon: React.ReactNode;
}

interface InteractiveTourProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: NavTab) => void;
  onOpenAiSettings?: () => void;
  /** В тур попадают только включённые дополнительные разделы. */
  features?: FeatureFlags;
}

const CORE_STEPS: TourStep[] = [
  {
    id: 'welcome',
    tab: 'workouts',
    title: 'Добро пожаловать в GetFit Bot!',
    badge: 'СТАРТ',
    description:
      'Приложение начинается с базового режима: четыре нижние вкладки и ничего лишнего. Дополнительные разделы можно включить позже в настройках профиля.',
    bulletPoints: [
      'Внизу всегда: Тренировки, Питание, Прогресс и Профиль',
      'Внутри «Тренировок» — планы, свободная тренировка и личные шаблоны',
      'Внутри «Прогресса» — графики и кнопка «Отчёт за период»',
      'В «Профиле» — параметры, InBody, рекорды, спорт, напоминания и режим приложения',
    ],
    icon: <Sparkles className="w-5 h-5 text-emerald-400" />,
  },
  {
    id: 'template_builder',
    tab: 'workouts',
    targetSelector: '#tour-templates-block',
    title: 'Конструктор шаблонов & Готовые шаблоны',
    badge: 'ТРЕНИРОВКИ',
    description: 'Собери свою тренировку один раз — и запускай её в один клик.',
    bulletPoints: [
      'Кнопка «Создать шаблон»: упражнения по группам мышц (грудь, спина, ноги, плечи, руки, кор)',
      'Меняй очередь упражнений стрелками ⬆️ ⬇️',
      'Задавай подходы, рабочий вес, повторения и время отдыха',
      '«Мои шаблоны» хранит библиотеку; оттуда же можно поделиться шаблоном с другом',
    ],
    icon: <Dumbbell className="w-5 h-5 text-emerald-400" />,
  },
  {
    id: 'quick_workout_save',
    tab: 'workouts',
    targetSelector: '#tour-quick-workout-btn',
    title: 'Быстрая тренировка & Сохранение в шаблон',
    badge: 'LIVE WORKOUT',
    description: 'Хочешь потренироваться прямо сейчас без подготовки? Нажми «Быстрая тренировка»!',
    bulletPoints: [
      'Добавляй упражнения по ходу занятия через каталог или поиск',
      'Корректируй вес, повторы и таймеры отдыха прямо во время тренировки',
      'После окончания нажми «Сохранить как шаблон» — тренировка останется в библиотеке',
    ],
    icon: <Play className="w-5 h-5 text-emerald-400 fill-current" />,
  },
  {
    id: 'readiness_rpe',
    tab: 'workouts',
    targetSelector: '#tour-readiness-card',
    title: 'Рекомендация на сегодня & Smart RPE',
    badge: 'АВТОРЕГУЛЯЦИЯ',
    description: 'Оцени состояние за 30 секунд: сон, стресс и мышечная боль.',
    bulletPoints: [
      'ИИ рассчитает готовность центральной нервной системы',
      'Подскажет, стоит ли снизить рабочие веса и RPE',
      'Помогает не уйти в перетренированность и не пропустить травму',
    ],
    icon: <Zap className="w-5 h-5 text-cyan-400" />,
  },
  {
    id: 'ai_brain_prompt',
    tab: 'profile',
    targetSelector: '#header-ai-brain-btn',
    title: 'ИИ Мозг & Личный системный промт',
    badge: 'DUAL ENGINE AI',
    description: 'В шапке всегда доступна кнопка «ИИ Мозг» для тонкой настройки интеллекта.',
    bulletPoints: [
      'Впиши ограничения, старые травмы и активный спортпит/БАДы',
      'Задай личный промт (например: «Я лифтер, готовь к пику силы и держи RPE 8-9»).',
      'Основной провайдер Groq (Qwen), резерв Gemini, крайний случай — встроенный разбор',
    ],
    icon: <BrainCircuit className="w-5 h-5 text-cyan-400" />,
  },
  {
    id: 'nutrition_sleep',
    tab: 'nutrition',
    title: 'Питание, Сон & КБЖУ',
    badge: 'НУТРИЦИОЛОГИЯ',
    description: 'Фиксируй приёмы пищи текстом или фотографируй тарелку — ИИ определит калории и белки.',
    bulletPoints: [
      'Фото-сканер и текстовый парсинг блюд на русском языке',
      'Учёт продолжительности и качества сна',
      'Водный баланс и ежедневный приём креатина',
    ],
    icon: <Apple className="w-5 h-5 text-emerald-400" />,
  },
  {
    id: 'progress_charts',
    tab: 'charts',
    targetSelector: '#open-period-stats',
    title: 'Прогресс, графики и отчёт за период',
    badge: 'АНАЛИТИКА',
    description: 'Графики прогрессивной перегрузки и отчёт, который считается прямо в приложении.',
    bulletPoints: [
      'Честный консенсус 1ПМ (формулы Эпли, Бжицки и Лэндера)',
      'Нормализация объёма к 100 кг для сравнения сетов',
      'Кнопка «Отчёт за период»: выбери 7, 30, 90 дней или всё время',
      'В отчёте: тренировки, тоннаж, подходы, RPE, время, сон, калории, шаги и вес',
      'Никаких отчётов по расписанию в чат — только когда ты сам нажал',
    ],
    icon: <BarChart3 className="w-5 h-5 text-cyan-400" />,
  },
  {
    id: 'settings_modes',
    tab: 'profile',
    targetSelector: '#feature-settings',
    title: 'Базовый и расширенный режим',
    badge: 'НАСТРОЙКИ',
    description:
      'В «Профиле» есть карточка «Режим приложения». Базовый режим оставляет четыре вкладки, расширенный добавляет тумблеры.',
    bulletPoints: [
      '«Базовый режим» включён — внизу только Тренировки, Питание, Прогресс, Профиль',
      'Выключи его, чтобы увидеть шесть переключателей дополнительных разделов',
      '«Марафоны целей» — серии шагов и упражнений внутри Тренировок',
      '«Зарубы с друзьями» — вкладка Зарубы и раздел «Друзья & Зарубы» в профиле',
      '«Дисциплина и штрафы» — вкладка Дисциплина и раздел «Награды»',
      '«Спортивные разряды» — вкладка Разряды с нормативами WRPF, WSF и других',
      '«Лаборатория N=1» — вкладка для личных экспериментов (сон, добавки, восстановление)',
      '«Циклы и периодизация» — вкладка с блоками гипертрофии, силы и делоада',
      'Кнопка «Пройти обучение заново» запускает этот гид в любой момент',
    ],
    icon: <Settings className="w-5 h-5 text-emerald-400" />,
  },
];

const ADVANCED_STEPS: Record<string, TourStep> = {
  marathons: {
    id: 'marathons',
    tab: 'workouts',
    title: 'Марафоны целей',
    badge: 'ДОП. РАЗДЕЛ',
    description:
      'Внутри «Тренировок» появилась вкладка «Марафоны целей». Ты включил её в настройках профиля.',
    bulletPoints: [
      'Серии дней по шагам, отжиманиям, тренировкам и другим целям',
      'Остаток можно переносить в копилку и не терять серию',
      'Выключить раздел можно в Профиль → Режим приложения',
    ],
    icon: <Trophy className="w-5 h-5 text-amber-400" />,
  },
  battles: {
    id: 'battles',
    tab: 'battles',
    title: 'Зарубы с друзьями',
    badge: 'ДОП. РАЗДЕЛ',
    description:
      'Дуэли 1 на 1 по шагам, жиму, подтягиваниям или дисциплине. Раздел включён тобой в настройках.',
    bulletPoints: [
      'Создай вызов и отправь другу ссылку-приглашение',
      'Обе стороны видят один прогресс, результат хранится на сервере',
      'В профиле появился раздел «Друзья & Зарубы»',
      'Выключить раздел можно в Профиль → Режим приложения',
    ],
    icon: <Swords className="w-5 h-5 text-amber-400" />,
  },
  discipline: {
    id: 'discipline',
    tab: 'discipline',
    title: 'Дисциплина, штрафы и награды',
    badge: 'ДОП. РАЗДЕЛ',
    description:
      'Очки за выполненные тренировки и штрафные задания за пропуски. Раздел включён тобой в настройках.',
    bulletPoints: [
      'Календарь обязательств и штрафы за пропуск',
      'Переносы и задания, которые возвращают очки',
      'В профиле появился раздел «Награды»',
      'Выключить раздел можно в Профиль → Режим приложения',
    ],
    icon: <ShieldCheck className="w-5 h-5 text-amber-400" />,
  },
  ranks: {
    id: 'ranks',
    tab: 'ranks',
    title: 'Спортивные разряды',
    badge: 'ДОП. РАЗДЕЛ',
    description:
      'Нормативы WRPF, WSF, пауэрлифтинга и других федераций — от юношеских разрядов до КМС/МС. Раздел включён тобой.',
    bulletPoints: [
      'Выбери движение и свой вес',
      'Сравни результат с нормативами и увидь прогресс до цели',
      'Цель по разряду можно сохранить в профиле',
      'Выключить раздел можно в Профиль → Режим приложения',
    ],
    icon: <Award className="w-5 h-5 text-amber-400" />,
  },
  lab: {
    id: 'lab',
    tab: 'lab',
    title: 'Лаборатория N=1',
    badge: 'ДОП. РАЗДЕЛ',
    description:
      'Личные эксперименты: проверяй сон, добавки и восстановление на себе. Раздел включён тобой в настройках.',
    bulletPoints: [
      'Ставь гипотезу и веди дневник показателей',
      'Сравнивай зависимые и независимые метрики',
      'ИИ помогает сформулировать вывод по эксперименту',
      'Выключить раздел можно в Профиль → Режим приложения',
    ],
    icon: <FlaskConical className="w-5 h-5 text-emerald-400" />,
  },
  periodization: {
    id: 'periodization',
    tab: 'periodization',
    title: 'Циклы и периодизация',
    badge: 'ДОП. РАЗДЕЛ',
    description:
      'Блоки гипертрофии, силы и делоада с аналитикой. Раздел включён тобой в настройках профиля.',
    bulletPoints: [
      'Тренировки группируются в циклы',
      'Видно тоннаж и средний RPE по блоку',
      'ИИ подсказывает, когда переходить к следующему циклу',
      'Выключить раздел можно в Профиль → Режим приложения',
    ],
    icon: <Layers className="w-5 h-5 text-emerald-400" />,
  },
};

export const InteractiveTour: React.FC<InteractiveTourProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenAiSettings,
  features,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const steps = useMemo(() => {
    const extra = features
      ? (Object.keys(ADVANCED_STEPS) as Array<keyof FeatureFlags>)
          .filter(key => features[key])
          .map(key => ADVANCED_STEPS[key])
      : [];
    return [...CORE_STEPS, ...extra];
  }, [features]);

  // Каждый показ начинается с первого шага
  useEffect(() => {
    if (isOpen) setCurrentStepIndex(0);
  }, [isOpen]);

  const currentStep = steps[currentStepIndex] || steps[0];

  // Sync current tab with the step requirement. Зависим от шага, а не от
  // массива steps: иначе изменение настроек пересоздаёт массив и тур
  // возвращает пользователя на первую вкладку.
  useEffect(() => {
    if (!isOpen || !currentStep) return;
    onNavigateTab(currentStep.tab);

    if (currentStep.targetSelector) {
      setTimeout(() => {
        const el = document.querySelector(currentStep.targetSelector!);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
    }
  }, [currentStepIndex, isOpen, currentStep?.id, currentStep?.tab, currentStep?.targetSelector]);

  if (!isOpen || !currentStep) return null;
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === steps.length - 1;
  const progressPercent = Math.round(((currentStepIndex + 1) / steps.length) * 100);

  const handleNext = () => {
    if (isLast) {
      handleComplete();
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    try {
      localStorage.setItem('getfit_tour_completed', 'true');
    } catch {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center p-3 sm:p-6 pointer-events-auto">
      {/* Dark overlay backdrop */}
      <div 
        onClick={handleComplete}
        className="fixed inset-0 bg-black/80 backdrop-blur-[3px] transition-opacity" 
      />

      {/* Spotlight highlight card */}
      <div className="relative z-10 w-full max-w-lg mx-auto bg-gradient-to-b from-[#131d27] via-[#0f1721] to-[#0c1219] border-2 border-emerald-500/80 rounded-3xl p-5 shadow-2xl shadow-emerald-950/60 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top bar with progress and close button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              {currentStep.icon}
            </span>
            <div>
              <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                {currentStep.badge}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400">
              Шаг {currentStepIndex + 1} из {steps.length}
            </span>
            <button
              onClick={handleComplete}
              className="w-7 h-7 rounded-full bg-[#182330] hover:bg-[#223347] text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              title="Пропустить обучение"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-[#162230] h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h3 className="text-base font-extrabold text-slate-100 leading-snug">
            {currentStep.title}
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {currentStep.description}
          </p>
        </div>

        {/* Key bullet points */}
        <div className="bg-[#0b1016] border border-[#1d2938] rounded-2xl p-3 space-y-2 max-h-[38vh] overflow-y-auto">
          {currentStep.bulletPoints.map((point, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-slate-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-snug">{point}</span>
            </div>
          ))}
        </div>

        {/* Interactive action buttons */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={handleComplete}
            className="text-xs text-slate-400 hover:text-slate-200 font-semibold transition-colors px-2 py-1"
          >
            Пропустить
          </button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3.5 py-2 rounded-xl bg-[#182433] hover:bg-[#223348] text-slate-200 text-xs font-bold transition-all flex items-center gap-1 active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Назад</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-extrabold shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <span>{isLast ? 'Завершить обучение' : 'Далее'}</span>
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
