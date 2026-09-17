import React, { useState, useEffect } from 'react';
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
  HelpCircle,
  Zap,
  Play
} from 'lucide-react';

import { NavTab } from './Navigation';

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
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    tab: 'workouts',
    title: 'Добро пожаловать в GetFit Bot!',
    badge: 'СТАРТ ИГРЫ',
    description: 'Твой персональный научный тренировочный штаб с двухъядерным ИИ, конструктором тренировок, трекером дисциплины и соревновательными битвами.',
    bulletPoints: [
      'Полная автономия: составляй свои шаблоны или тренируйся свободно',
      'Двухъядерный ИИ (Gemini + Groq/Grok) с учетом твоих травм и спортпита',
      'Система прогрессивной перегрузки, 1ПМ и спортивных разрядов',
    ],
    icon: <Sparkles className="w-5 h-5 text-emerald-400" />,
  },
  {
    id: 'template_builder',
    tab: 'workouts',
    targetSelector: '#tour-templates-block',
    title: 'Конструктор шаблонов & Готовые шаблоны',
    badge: 'ТРЕНИРОВКИ',
    description: 'Вместо навязанных списков — удобная система персональных шаблонов!',
    bulletPoints: [
      'Кнопка «Создать шаблон»: базовые упражнения по группам мышц (грудь, спина, ноги, плечи, руки, кор)',
      'Меняй очередь упражнений стрелками ⬆️ ⬇️',
      'Задавай индивидуальные подходы, рабочий вес, повторения и время отдыха',
      'Настраивай отдых между подходами и отдых перед переходом к следующему упражнению',
      'Кнопка «Мои шаблоны» хранит всю твою библиотеку с запуском в один клик',
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
      'Добавляй упражнения прямо по ходу занятия через каталог или поиск',
      'Корректируй вес, повторы и таймеры отдыха прямо во время тренировки',
      'После окончания тренировки нажми «Сохранить как шаблон» — и она останется в твоих шаблонах!',
    ],
    icon: <Play className="w-5 h-5 text-emerald-400 fill-current" />,
  },
  {
    id: 'readiness_rpe',
    tab: 'workouts',
    targetSelector: '#tour-readiness-card',
    title: 'Рекомендация на сегодня & Smart RPE',
    badge: 'АВТОРЕГУЛЯЦИЯ',
    description: 'Оцени свое состояние за 30 секунд: сколько спал, уровень стресса и мышечная боль.',
    bulletPoints: [
      'ИИ мгновенно рассчитает процент готовности центральной нервной системы',
      'Автоматически посоветует скорректировать рабочие веса и RPE на сегодня',
      'Предотвращает перетренированность и травмы суставов',
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
      'Впиши свои ограничения, старые травмы и активный спортпит/БАДы',
      'Задай свой личный промт (например: «Я лифтер, готовь к пику силы и держи RPE 8-9»)',
      'Dual Engine: Gemini 2.5 Flash + мгновенный fallback на Groq Llama-3.3 (Grok)',
    ],
    icon: <BrainCircuit className="w-5 h-5 text-cyan-400" />,
  },
  {
    id: 'nutrition_sleep',
    tab: 'nutrition',
    title: 'Питание, Сон & КБЖУ с распознаванием по фото',
    badge: 'НУТРИЦИОЛОГИЯ',
    description: 'Фиксируй приемы пищи текстом или просто фотографируй тарелку — ИИ сам определит калории и белки!',
    bulletPoints: [
      'Фото-сканер и текстовый парсинг блюд на русском языке',
      'Учет качества и продолжительности сна',
      'Трекер водного баланса и ежедневного приема креатина',
    ],
    icon: <Apple className="w-5 h-5 text-emerald-400" />,
  },
  {
    id: 'progress_charts',
    tab: 'charts',
    title: 'Прогресс, Тоннаж & Расчетный 1ПМ',
    badge: 'АНАЛИТИКА',
    description: 'Наглядные графики прогрессивной перегрузки без самообмана.',
    bulletPoints: [
      'Честный консенсус 1ПМ (формулы Эпли, Бжицки и Лэндера)',
      'Нормализация объема к 100 кг для наглядного сравнения сетов',
      'Сравнительные таблицы «В прошлый раз vs Сегодня» после каждой тренировки',
    ],
    icon: <TrendingUp className="w-5 h-5 text-cyan-400" />,
  },
  {
    id: 'research_lab',
    tab: 'lab',
    title: 'Исследовательская Лаборатория (N=1)',
    badge: 'НАУЧНЫЙ ЭКСПЕРИМЕНТ',
    description: 'Проводи персональные N=1 исследования добавок и методов восстановления.',
    bulletPoints: [
      'Проверяй влияние креатина, ашваганды или холодного душа на силовые показатели',
      'Периодизационные циклы: Блок гипертрофии, Силовой блок и Делоад',
      'Индивидуальный трекинг кастомных биомаркеров',
    ],
    icon: <FlaskConical className="w-5 h-5 text-emerald-400" />,
  },
  {
    id: 'disciplines_battles',
    tab: 'discipline',
    title: 'Дисциплина, Нормативы & Битвы с друзьями',
    badge: 'СОРЕВНОВАНИЯ',
    description: 'Геймификация тренировок для железной мотивации!',
    bulletPoints: [
      'Нормативы спортивных разрядов WRPF, WSF, пауэрлифтинга и стритлифтинга (от 3 юношеского до Элиты)',
      'Шкала дисциплины: начисляются очки за тренировки и вычитаются штрафы за пропуск',
      'Дуэли 1 на 1 с друзьями со ставками очков дисциплины',
    ],
    icon: <Swords className="w-5 h-5 text-amber-400" />,
  },
];

export const InteractiveTour: React.FC<InteractiveTourProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenAiSettings,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Sync current tab with the step requirement
  useEffect(() => {
    if (isOpen) {
      const step = TOUR_STEPS[currentStepIndex];
      if (step) {
        onNavigateTab(step.tab);

        // Smooth scroll to target if selector provided
        if (step.targetSelector) {
          setTimeout(() => {
            const el = document.querySelector(step.targetSelector!);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 200);
        }
      }
    }
  }, [currentStepIndex, isOpen]);

  if (!isOpen) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === TOUR_STEPS.length - 1;
  const progressPercent = Math.round(((currentStepIndex + 1) / TOUR_STEPS.length) * 100);

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
              Шаг {currentStepIndex + 1} из {TOUR_STEPS.length}
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
        <div className="bg-[#0b1016] border border-[#1d2938] rounded-2xl p-3 space-y-2">
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
