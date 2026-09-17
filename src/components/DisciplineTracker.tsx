import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Flame, 
  AlertTriangle, 
  Calendar, 
  CheckCircle2, 
  RotateCcw, 
  Clock, 
  ArrowRight,
  Sparkles,
  Zap,
  Plus,
  Bot,
  Settings,
  Footprints,
  Dumbbell,
  HeartHandshake,
  Coffee,
  Utensils,
  Wallet,
  Activity
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile, DisciplinePenalty, WorkoutPlan } from '../types';

interface DisciplineTrackerProps {
  user: UserProfile;
  penalties: DisciplinePenalty[];
  workoutPlans: WorkoutPlan[];
  onResolvePenalty: (penaltyId: string) => void;
  onRescheduleWorkout: (planId: string, newDate: string, reason: string) => void;
  onApplyPenalty: (reason: string, task: string, points: number) => void;
  onUpdateUser?: (updated: Partial<UserProfile>) => void;
}

export const DisciplineTracker: React.FC<DisciplineTrackerProps> = ({
  user,
  penalties,
  workoutPlans,
  onResolvePenalty,
  onRescheduleWorkout,
  onApplyPenalty,
  onUpdateUser,
}) => {
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCustomPenaltyModal, setShowCustomPenaltyModal] = useState(false);
  const [showAiArbitratorModal, setShowAiArbitratorModal] = useState(false);
  const [showNormsModal, setShowNormsModal] = useState(false);

  // Reschedule form state
  const [selectedPlanId, setSelectedPlanId] = useState<string>(workoutPlans[0]?.id || '');
  const [newDateInput, setNewDateInput] = useState('Завтра');
  const [rescheduleReason, setRescheduleReason] = useState('Восстановление мышц / ЦНС');

  // Custom penalty modal category & builder state
  const [penaltyCategoryTab, setPenaltyCategoryTab] = useState<'cardio' | 'diet' | 'financial' | 'habits' | 'custom'>('cardio');
  const [financialRecipient, setFinancialRecipient] = useState<'friend' | 'charity_life' | 'charity_habensky' | 'charity_animals' | 'relative'>('friend');
  const [financialAmount, setFinancialAmount] = useState<number>(500);
  const [customReason, setCustomReason] = useState('Пропуск силовой тренировки');
  const [customTask, setCustomTask] = useState('Внеплановое кардио 30 минут (дорожка в гору)');
  const [customPoints, setCustomPoints] = useState<number>(6);

  // AI Arbitrator state
  const [arbitratorInput, setArbitratorInput] = useState('');
  const [arbitratorLoading, setArbitratorLoading] = useState(false);
  const [arbitratorSuggestion, setArbitratorSuggestion] = useState<{
    task: string;
    points: number;
    explanation: string;
  } | null>(null);

  // Norms state (preserves 0 if no step goal set)
  const [stepNormInput, setStepNormInput] = useState<number>(user.dailyStepGoal !== undefined ? user.dailyStepGoal : 10000);

  const pendingPenalties = penalties.filter(p => p.status === 'pending');
  const resolvedPenalties = penalties.filter(p => p.status === 'completed');

  const handleRescheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) return;
    onRescheduleWorkout(selectedPlanId, newDateInput, rescheduleReason);
    setShowRescheduleModal(false);
  };

  const handleCustomPenaltySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTask.trim()) return;
    onApplyPenalty(customReason, customTask.trim(), customPoints);
    setShowCustomPenaltyModal(false);
  };

  const handleAiArbitratorRequest = async () => {
    if (!arbitratorInput.trim()) return;
    setArbitratorLoading(true);

    try {
      const res = await fetch('/api/ai/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Я совершил нарушение спортивной дисциплины: "${arbitratorInput}". Назначь мне справедливое и мотивирующее дисциплинарное задание (например: внеплановое кардио 30 минут, пропуск читмила, удвоенная норма шагов завтра, или отправить 500 ₽ кенту на кофе / 1000 ₽ на благотворительность, либо контрастный душ/наведение порядка). Укажи вычет дисциплины от 4 до 8%. Верни JSON с полями task, points, explanation.`,
          userProfile: user,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.action?.payload?.penaltyTask) {
          setArbitratorSuggestion({
            task: data.action.payload.penaltyTask,
            points: data.action.payload.pointsDeducted || 6,
            explanation: data.reply || 'ИИ-Арбитр вынес решение по дисциплине.',
          });
        } else {
          setArbitratorSuggestion({
            task: 'Внеплановое кардио 30 минут (дорожка в гору 12%)',
            points: 6,
            explanation: data.reply || 'Эффективное компенсаторное задание для сжигания калорий и сохранения рабочего ритма.',
          });
        }
      } else {
        throw new Error('Fallback');
      }
    } catch {
      // Smart non-trivial disciplinary fallback based on context
      if (/пицц|сладк|чипс|торт|шаурм|еда|жор|читмил/i.test(arbitratorInput)) {
        setArbitratorSuggestion({
          task: 'Пропуск ближайшего читмила + 30 мин внепланового кардио',
          points: 6,
          explanation: 'Для нейтрализации избытка гликогена, ускорения метаболизма и возврата к чистому рациону.',
        });
      } else if (/деньг|кент|друг|руб|фонд|благотворительн/i.test(arbitratorInput)) {
        setArbitratorSuggestion({
          task: 'Отправить 500 ₽ кенту на кофе за пропуск тренировки',
          points: 7,
          explanation: 'Финансовая цена слова — лучший стимул больше никогда не пропускать запланированные дни.',
        });
      } else if (/шаг|ходьб|активност/i.test(arbitratorInput)) {
        setArbitratorSuggestion({
          task: 'Удвоенная норма шагов завтра (х2 норма активности)',
          points: 6,
          explanation: 'Компенсация пассивного дня дополнительным расходом энергии на следующие сутки.',
        });
      } else if (/тренировк|зал|пропуск|забил|прогулял/i.test(arbitratorInput)) {
        setArbitratorSuggestion({
          task: 'Внеплановое кардио 30 минут ИЛИ 500 ₽ кенту на кофе',
          points: 7,
          explanation: 'На выбор: отработать энергией в зале либо ответить рублем перед товарищем.',
        });
      } else {
        setArbitratorSuggestion({
          task: 'Холодный душ 2 утра подряд + отбой строго до 23:00',
          points: 5,
          explanation: 'Дисциплинарная перезагрузка ЦНС, воли и биологических ритмов восстановления.',
        });
      }
    } finally {
      setArbitratorLoading(false);
    }
  };

  const handleApplyArbitrator = () => {
    if (!arbitratorSuggestion) return;
    onApplyPenalty(`Нарушение: ${arbitratorInput.slice(0, 30)}`, arbitratorSuggestion.task, arbitratorSuggestion.points);
    setShowAiArbitratorModal(false);
    setArbitratorSuggestion(null);
    setArbitratorInput('');
  };

  const handleSaveNorms = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateUser) {
      onUpdateUser({ dailyStepGoal: stepNormInput });
    }
    setShowNormsModal(false);
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Discipline Score Overview */}
      <div className="bg-gradient-to-br from-[#121a22] to-[#0d141b] border border-[#1f2c3a] rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Индекс дисциплины GetFitBot
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl font-extrabold font-mono text-emerald-400">
                {user.disciplineScore}%
              </span>
              <span className="text-xs text-emerald-300/80 font-medium">
                {user.disciplineScore >= 90 ? 'Железная воля' : user.disciplineScore >= 75 ? 'Стабильный атлет' : 'Нужно поднажать'}
              </span>
            </div>
          </div>

          <div className="w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          </div>
        </div>

        {/* Streaks & Norms */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-[#1b2532]">
          <div className="bg-[#151e29] p-2.5 rounded-xl">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold uppercase">
              <Flame className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
              <span>Стрик</span>
            </div>
            <div className="text-xs font-bold font-mono text-slate-100 mt-1">{user.streakDays} дн.</div>
          </div>

          <div className="bg-[#151e29] p-2.5 rounded-xl">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold uppercase">
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>Рекорд</span>
            </div>
            <div className="text-xs font-bold font-mono text-slate-100 mt-1">{user.longestStreak} дн.</div>
          </div>

          <div 
            onClick={() => setShowNormsModal(true)}
            className="bg-[#151e29] hover:bg-[#1a2634] p-2.5 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-emerald-500/30"
          >
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase">
              <span className="flex items-center gap-1">
                <Footprints className="w-3.5 h-3.5 text-emerald-400" />
                <span>Норма</span>
              </span>
              <Settings className="w-3 h-3 text-slate-400" />
            </div>
            <div className="text-xs font-bold font-mono text-slate-100 mt-1">
              {user.dailyStepGoal && user.dailyStepGoal > 0
                ? `${user.dailyStepGoal.toLocaleString('ru-RU')} ш.`
                : 'Без цели'}
            </div>
          </div>
        </div>
      </div>

      {/* Action Strip: Reschedule vs Penalty Builder vs AI Arbitrator */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setShowRescheduleModal(true)}
          className="p-3 rounded-xl bg-[#12181f] hover:bg-[#18212b] border border-[#1e293b] flex flex-col items-start gap-1 transition-all text-left"
        >
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
            <RotateCcw className="w-4 h-4" />
            <span>Перенос тренировки</span>
          </div>
          <span className="text-[10px] text-slate-400 leading-tight">
            Сдвинь день без штрафа и потери очков
          </span>
        </button>

        <button
          onClick={() => setShowAiArbitratorModal(true)}
          className="p-3 rounded-xl bg-gradient-to-br from-[#121d28] to-[#12181f] hover:from-[#172533] hover:to-[#17202a] border border-emerald-500/30 flex flex-col items-start gap-1 transition-all text-left"
        >
          <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs">
            <Bot className="w-4 h-4 text-emerald-400" />
            <span>ИИ-Арбитр штрафов</span>
          </div>
          <span className="text-[10px] text-slate-400 leading-tight">
            Справедливое задание под твою ситуацию
          </span>
        </button>
      </div>

      {/* Pending Penalties Section */}
      <div className="bg-[#12181f] border border-[#1e293b] rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-[#161f28] border-b border-[#1f2937] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-slate-200">
              Активные штрафы ({pendingPenalties.length})
            </span>
          </div>

          <button
            onClick={() => setShowCustomPenaltyModal(true)}
            className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Назначить</span>
          </button>
        </div>

        {pendingPenalties.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400 flex flex-col items-center gap-1.5">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <span className="font-semibold text-slate-200">Активных штрафов нет!</span>
            <span>Ты четко следуешь тренировочному графику и держишь дисциплину.</span>
          </div>
        ) : (
          <div className="divide-y divide-[#1b2532]">
            {pendingPenalties.map(p => {
              const isFinancial = /руб|₽|кент|друг|фонд|благотворительн|перевод/i.test(p.penaltyTask);
              const isCardio = /кардио|шаг|ходьб|кросс|дорожк|эллипс/i.test(p.penaltyTask);
              const isDiet = /читмил|сахар|сладк|рацион/i.test(p.penaltyTask);

              return (
                <div key={p.id} className="p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-100">{p.reason}</span>
                        {isFinancial && (
                          <span className="text-[9px] font-bold text-amber-400 bg-amber-950/70 border border-amber-500/30 px-1.5 py-0.5 rounded">
                            💸 Цена слова
                          </span>
                        )}
                        {isCardio && (
                          <span className="text-[9px] font-bold text-sky-400 bg-sky-950/70 border border-sky-500/30 px-1.5 py-0.5 rounded">
                            🏃 Кардио
                          </span>
                        )}
                        {isDiet && (
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                            🥗 Диета
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{p.date}</div>
                    </div>
                    <span className="text-xs font-mono font-bold text-rose-400">
                      -{p.pointsDeducted}% дисц.
                    </span>
                  </div>

                  <div className="bg-[#0e141a] p-2.5 rounded-lg border border-[#1f2a37] flex items-center justify-between text-xs">
                    <div className="pr-2">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Штрафное задание:
                      </span>
                      <span className="font-bold text-emerald-400 font-mono text-xs leading-tight block mt-0.5">
                        {p.penaltyTask}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        onResolvePenalty(p.id);
                        confetti({ particleCount: 35, spread: 60 });
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-sm transition-all whitespace-nowrap shrink-0"
                    >
                      {isFinancial ? 'Перевел' : 'Выполнил'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Penalty Presets */}
      <div className="bg-[#12181f] border border-[#1e293b] rounded-xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200">
            Быстрое дисциплинарное задание
          </span>
          <button
            onClick={() => setShowCustomPenaltyModal(true)}
            className="text-[10px] font-bold text-emerald-400 hover:underline"
          >
            Конструктор штрафа +
          </button>
        </div>
        <p className="text-[11px] text-slate-400">
          Сорвался с режима? Выбери справедливое задание для восстановления дисциплины и стрика:
        </p>
        
        <div className="grid grid-cols-2 gap-2 pt-1">
          {/* Preset 1: Extra Cardio */}
          <button
            onClick={() => onApplyPenalty('Пропуск силовой тренировки', 'Внеплановое кардио 30 мин (дорожка в гору 12% / эллипс)', 5)}
            className="p-2.5 rounded-xl bg-[#16202a] hover:bg-[#1f2c3a] border border-[#253444] hover:border-sky-500/40 text-left text-xs text-slate-200 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-1.5 text-sky-400 font-bold font-mono">
                <Activity className="w-3.5 h-3.5" />
                <span>Кардио 30 мин</span>
              </div>
              <div className="text-[11px] text-slate-300 font-medium mt-1 leading-snug">
                Внеплановая дорожка в гору
              </div>
            </div>
            <div className="text-[10px] text-slate-400 mt-1.5">Сжечь калории • -5%</div>
          </button>

          {/* Preset 2: Double Daily Steps */}
          <button
            onClick={() => onApplyPenalty('Недобор дневной активности', 'Удвоенная норма шагов завтра (х2 норма активности)', 6)}
            className="p-2.5 rounded-xl bg-[#16202a] hover:bg-[#1f2c3a] border border-[#253444] hover:border-emerald-500/40 text-left text-xs text-slate-200 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold font-mono">
                <Footprints className="w-3.5 h-3.5" />
                <span>х2 норма шагов</span>
              </div>
              <div className="text-[11px] text-slate-300 font-medium mt-1 leading-snug">
                Удвоенная норма активности завтра
              </div>
            </div>
            <div className="text-[10px] text-slate-400 mt-1.5">Компенсация шагов • -6%</div>
          </button>

          {/* Preset 3: Skip Cheat Meal */}
          <button
            onClick={() => onApplyPenalty('Срыв диеты / перебор калорий', 'Пропуск ближайшего читмила (строго чистый рацион на выходных)', 6)}
            className="p-2.5 rounded-xl bg-[#16202a] hover:bg-[#1f2c3a] border border-[#253444] hover:border-amber-500/40 text-left text-xs text-slate-200 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-1.5 text-amber-400 font-bold font-mono">
                <Utensils className="w-3.5 h-3.5" />
                <span>Минус читмил</span>
              </div>
              <div className="text-[11px] text-slate-300 font-medium mt-1 leading-snug">
                Пропуск ближайшего читмила
              </div>
            </div>
            <div className="text-[10px] text-slate-400 mt-1.5">Чистый рацион • -6%</div>
          </button>

          {/* Preset 4: 500 RUB to Friend */}
          <button
            onClick={() => onApplyPenalty('Пропуск тренировки (цена слова)', 'Отправить 500 ₽ кенту на кофе за пропуск тренировки', 7)}
            className="p-2.5 rounded-xl bg-[#16202a] hover:bg-[#1f2c3a] border border-[#253444] hover:border-teal-500/40 text-left text-xs text-slate-200 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-1.5 text-teal-400 font-bold font-mono">
                <Coffee className="w-3.5 h-3.5" />
                <span>500 ₽ кенту</span>
              </div>
              <div className="text-[11px] text-slate-300 font-medium mt-1 leading-snug">
                Скинуть другу на кофе
              </div>
            </div>
            <div className="text-[10px] text-slate-400 mt-1.5">Цена слова • -7%</div>
          </button>

          {/* Preset 5: 1000 RUB to Charity */}
          <button
            onClick={() => onApplyPenalty('Грубый срыв тренировочного графика', 'Отправить 1 000 ₽ в благотворительный фонд («Подари Жизнь» / Хабенский)', 8)}
            className="p-2.5 rounded-xl bg-[#16202a] hover:bg-[#1f2c3a] border border-[#253444] hover:border-rose-500/40 text-left text-xs text-slate-200 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-1.5 text-rose-400 font-bold font-mono">
                <HeartHandshake className="w-3.5 h-3.5" />
                <span>1 000 ₽ в фонд</span>
              </div>
              <div className="text-[11px] text-slate-300 font-medium mt-1 leading-snug">
                На благотворительность
              </div>
            </div>
            <div className="text-[10px] text-slate-400 mt-1.5">Польза обществу • -8%</div>
          </button>

          {/* Preset 6: 3 Days Sugar-Free */}
          <button
            onClick={() => onApplyPenalty('Срыв на сладкое и фастфуд', '3 дня строго без сахара, десертов и фастфуда', 5)}
            className="p-2.5 rounded-xl bg-[#16202a] hover:bg-[#1f2c3a] border border-[#253444] hover:border-purple-500/40 text-left text-xs text-slate-200 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-1.5 text-purple-400 font-bold font-mono">
                <Zap className="w-3.5 h-3.5" />
                <span>3 дня без сахара</span>
              </div>
              <div className="text-[11px] text-slate-300 font-medium mt-1 leading-snug">
                Полный детокс от сладкого
              </div>
            </div>
            <div className="text-[10px] text-slate-400 mt-1.5">Чистка рецепторов • -5%</div>
          </button>
        </div>
      </div>

      {/* History of Completed Penalties */}
      {resolvedPenalties.length > 0 && (
        <div className="bg-[#12181f] border border-[#1e293b] rounded-xl p-3">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">
            История закрытых штрафов ({resolvedPenalties.length}):
          </span>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {resolvedPenalties.map(p => (
              <div key={p.id} className="flex items-center justify-between text-xs py-1 text-slate-400 border-b border-[#1b2532] last:border-0">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{p.penaltyTask} ({p.reason})</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 shrink-0">Закрыто</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal 1: Reschedule Workout */}
      {showRescheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12181f] border border-[#253342] rounded-2xl p-4 max-w-sm w-full space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">Перенос тренировки</h3>
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Какую тренировку перенести:
                </label>
                <select
                  value={selectedPlanId}
                  onChange={e => setSelectedPlanId(e.target.value)}
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {workoutPlans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.scheduledDay})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  На какой день переносим:
                </label>
                <input
                  type="text"
                  value={newDateInput}
                  onChange={e => setNewDateInput(e.target.value)}
                  placeholder="Завтра, Четверг 18:00..."
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Причина переноса:
                </label>
                <select
                  value={rescheduleReason}
                  onChange={e => setRescheduleReason(e.target.value)}
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Восстановление мышц / ЦНС">Восстановление мышц / ЦНС</option>
                  <option value="Задержка по работе / учебе">Задержка по работе / учебе</option>
                  <option value="Недосып / самочувствие">Недосып / самочувствие</option>
                  <option value="Семейные обстоятельства">Семейные обстоятельства</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="flex-1 py-2 rounded-xl bg-[#1a2430] text-slate-300 text-xs font-semibold"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
                >
                  Подтвердить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Custom Penalty Creator */}
      {showCustomPenaltyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12181f] border border-[#253342] rounded-2xl p-4 max-w-sm w-full space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">Конструктор штрафного задания</h3>
              <button
                onClick={() => setShowCustomPenaltyModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Category tabs */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#0c1218] rounded-xl border border-[#1b2532] text-[10px] font-bold">
              <button
                type="button"
                onClick={() => {
                  setPenaltyCategoryTab('cardio');
                  setCustomReason('Пропуск силовой тренировки');
                  setCustomTask('Внеплановое кардио 30 минут (дорожка в гору 12%)');
                  setCustomPoints(5);
                }}
                className={`py-1.5 px-2 rounded-lg transition-all ${
                  penaltyCategoryTab === 'cardio'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-extrabold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🏃 Кардио / х2 шагов
              </button>

              <button
                type="button"
                onClick={() => {
                  setPenaltyCategoryTab('financial');
                  setCustomReason('Финансовая цена слова: пропуск тренировки');
                  setCustomTask('Отправить 500 ₽ кенту на кофе за нарушение режима');
                  setCustomPoints(7);
                }}
                className={`py-1.5 px-2 rounded-lg transition-all ${
                  penaltyCategoryTab === 'financial'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-extrabold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                💸 Кенту / В фонд
              </button>

              <button
                type="button"
                onClick={() => {
                  setPenaltyCategoryTab('diet');
                  setCustomReason('Срыв диеты / перебор калорий');
                  setCustomTask('Пропуск ближайшего читмила (строго чистый рацион)');
                  setCustomPoints(6);
                }}
                className={`py-1.5 px-2 rounded-lg transition-all ${
                  penaltyCategoryTab === 'diet'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-extrabold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🥗 Читмил / Диета
              </button>

              <button
                type="button"
                onClick={() => {
                  setPenaltyCategoryTab('habits');
                  setCustomReason('Нарушение распорядка и дисциплины');
                  setCustomTask('Холодный душ утром 2 дня подряд + отбой до 23:00');
                  setCustomPoints(5);
                }}
                className={`py-1.5 px-2 rounded-lg transition-all ${
                  penaltyCategoryTab === 'habits'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-extrabold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ⚡ Характер и быт
              </button>
            </div>

            {/* Sub-selectors depending on category */}
            {penaltyCategoryTab === 'financial' && (
              <div className="bg-[#16202c] border border-amber-500/30 rounded-xl p-2.5 space-y-2">
                <span className="text-[10px] text-amber-300 uppercase font-bold block">
                  Получатель перевода (цена слова):
                </span>
                <div className="grid grid-cols-1 gap-1 text-[11px]">
                  {[
                    { id: 'friend', label: '🤝 Кенту на кофе / другу', target: 'кенту на кофе' },
                    { id: 'charity_life', label: '💛 Фонд «Подари Жизнь» (дети)', target: 'в фонд «Подари Жизнь»' },
                    { id: 'charity_habensky', label: '🎭 Фонд Хабенского (онкопомощь)', target: 'в благотворительный Фонд Хабенского' },
                    { id: 'charity_animals', label: '🐶 Приют для бездомных животных', target: 'в приют для бездомных животных' },
                    { id: 'relative', label: '👨‍👩‍👦 Родственнику / маме', target: 'родственнику / маме' },
                  ].map(rec => (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => {
                        setFinancialRecipient(rec.id as any);
                        setCustomTask(`Отправить ${financialAmount} ₽ ${rec.target} за нарушение режима`);
                      }}
                      className={`p-1.5 rounded-lg text-left transition-all border ${
                        financialRecipient === rec.id
                          ? 'bg-amber-500/30 text-amber-200 border-amber-400 font-bold'
                          : 'bg-[#101720] text-slate-400 border-transparent hover:border-slate-600'
                      }`}
                    >
                      {rec.label}
                    </button>
                  ))}
                </div>

                <div className="pt-1">
                  <span className="text-[10px] text-amber-300 uppercase font-bold block mb-1">
                    Сумма перевода:
                  </span>
                  <div className="flex gap-1.5">
                    {[300, 500, 1000, 2000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setFinancialAmount(amt);
                          const targetMap: Record<string, string> = {
                            friend: 'кенту на кофе',
                            charity_life: 'в фонд «Подари Жизнь»',
                            charity_habensky: 'в благотворительный Фонд Хабенского',
                            charity_animals: 'в приют для бездомных животных',
                            relative: 'родственнику / маме',
                          };
                          setCustomTask(`Отправить ${amt} ₽ ${targetMap[financialRecipient] || 'кенту'} за нарушение режима`);
                        }}
                        className={`flex-1 py-1 rounded-lg text-[11px] font-mono font-bold border transition-all ${
                          financialAmount === amt
                            ? 'bg-amber-400 text-slate-950 border-amber-400'
                            : 'bg-[#101720] text-slate-300 border-[#243344]'
                        }`}
                      >
                        {amt} ₽
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {penaltyCategoryTab === 'cardio' && (
              <div className="bg-[#131d27] border border-sky-500/30 rounded-xl p-2 space-y-1 text-[11px]">
                <span className="text-[10px] text-sky-400 uppercase font-bold block mb-1">
                  Быстрые варианты кардио-штрафа:
                </span>
                {[
                  { label: '🏃 30 мин ходьба в гору 12%', task: 'Внеплановое кардио 30 минут (дорожка в гору 12%)', reason: 'Пропуск силовой тренировки', points: 5 },
                  { label: '👟 Удвоенная норма шагов завтра', task: 'Удвоенная норма шагов завтра (х2 норма активности)', reason: 'Недобор дневной активности', points: 6 },
                  { label: '🚴 40 минут сайкл / эллипс', task: '40 минут кардио (сайкл / эллипс) на среднем пульсе', reason: 'Компенсация пропущенного дня', points: 6 },
                  { label: '🚶 +5 000 штрафных шагов сегодня', task: '+5 000 штрафных шагов до конца дня', reason: 'Малоподвижный день', points: 4 },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setCustomTask(item.task);
                      setCustomReason(item.reason);
                      setCustomPoints(item.points);
                    }}
                    className="w-full text-left p-1.5 rounded-lg bg-[#18232f] hover:bg-[#203040] text-slate-200 border border-transparent hover:border-sky-500/30 transition-all text-[11px]"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {penaltyCategoryTab === 'diet' && (
              <div className="bg-[#121f19] border border-emerald-500/30 rounded-xl p-2 space-y-1 text-[11px]">
                <span className="text-[10px] text-emerald-400 uppercase font-bold block mb-1">
                  Быстрые варианты пищевой дисциплины:
                </span>
                {[
                  { label: '🍔 Пропуск ближайшего читмила', task: 'Пропуск ближайшего читмила (строго чистый рацион на выходных)', reason: 'Срыв диеты / перебор калорий', points: 6 },
                  { label: '🍫 3 дня без сахара и сладкого', task: '3 дня строго без сахара, десертов и фастфуда', reason: 'Срыв на сладкое', points: 5 },
                  { label: '☕ 2 дня без кофе и энергетиков', task: '2 дня без кофе, энергетиков и стимуляторов ЦНС', reason: 'Перегруз нервной системы', points: 4 },
                  { label: '💧 3 дня пить строго 2.5 л воды', task: 'Пить строго не менее 2.5 л чистой воды в день 3 дня', reason: 'Нарушение водного баланса', points: 4 },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setCustomTask(item.task);
                      setCustomReason(item.reason);
                      setCustomPoints(item.points);
                    }}
                    className="w-full text-left p-1.5 rounded-lg bg-[#182622] hover:bg-[#203630] text-slate-200 border border-transparent hover:border-emerald-500/30 transition-all text-[11px]"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {penaltyCategoryTab === 'habits' && (
              <div className="bg-[#1b1526] border border-purple-500/30 rounded-xl p-2 space-y-1 text-[11px]">
                <span className="text-[10px] text-purple-400 uppercase font-bold block mb-1">
                  Быстрые варианты характера и быта:
                </span>
                {[
                  { label: '🚿 Холодный душ утром 2 дня подряд', task: 'Контрастный / ледяной душ утром 2 дня подряд', reason: 'Укрепление воли и пробуждение', points: 5 },
                  { label: '🧹 Генеральная уборка в доме (1 час)', task: 'Генеральная уборка квартиры и рабочего стола (1 час)', reason: 'Бытовая дисциплина и фокус', points: 5 },
                  { label: '📵 Отбой до 23:00 без телефона в кровати', task: 'Отбой строго до 23:00, телефон вне спальни за час до сна', reason: 'Срыв режима сна', points: 5 },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setCustomTask(item.task);
                      setCustomReason(item.reason);
                      setCustomPoints(item.points);
                    }}
                    className="w-full text-left p-1.5 rounded-lg bg-[#241c33] hover:bg-[#302544] text-slate-200 border border-transparent hover:border-purple-500/30 transition-all text-[11px]"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleCustomPenaltySubmit} className="space-y-3 pt-1">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Причина штрафа:
                </label>
                <input
                  type="text"
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                  placeholder="Пропуск тренировки, срыв на сладкое..."
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Что нужно выполнить (задание):
                </label>
                <textarea
                  rows={2}
                  value={customTask}
                  onChange={e => setCustomTask(e.target.value)}
                  placeholder="Например: 500 ₽ кенту на кофе, 30 мин кардио в гору..."
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Снятие очков дисциплины до закрытия:
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={customPoints}
                    onChange={e => setCustomPoints(Number(e.target.value))}
                    className="flex-1 accent-emerald-500"
                  />
                  <span className="text-xs font-mono font-bold text-rose-400 min-w-[48px] text-right">
                    -{customPoints}%
                  </span>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomPenaltyModal(false)}
                  className="flex-1 py-2 rounded-xl bg-[#1a2430] text-slate-300 text-xs font-semibold"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
                >
                  Назначить штраф
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: AI Arbitrator */}
      {showAiArbitratorModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12181f] border border-emerald-500/40 rounded-2xl p-4 max-w-sm w-full space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                <Bot className="w-4 h-4" />
                <span>ИИ-Арбитр дисциплины</span>
              </div>
              <button
                onClick={() => setShowAiArbitratorModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-slate-300">
              Опиши, что произошло (пропустил тренировку, лег в 3 ночи, перебрал углеводов). ИИ подберет физиологически обоснованное компенсаторное задание.
            </p>

            <textarea
              rows={3}
              value={arbitratorInput}
              onChange={e => setArbitratorInput(e.target.value)}
              placeholder="Например: Пропустил тренировку спины из-за работы и съел бургер..."
              className="w-full bg-[#18232f] border border-[#263546] rounded-xl p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
            />

            {!arbitratorSuggestion ? (
              <button
                onClick={handleAiArbitratorRequest}
                disabled={!arbitratorInput.trim() || arbitratorLoading}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                {arbitratorLoading ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>ИИ рассчитывает нагрузку...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Запросить справедливый штраф</span>
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-2.5 pt-1">
                <div className="bg-[#15202c] border border-emerald-500/30 p-3 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-emerald-400">
                      Решение ИИ-Арбитра:
                    </span>
                    <span className="text-xs font-mono font-bold text-rose-400">
                      -{arbitratorSuggestion.points}% дисц.
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-100 font-mono">
                    {arbitratorSuggestion.task}
                  </div>
                  <p className="text-[11px] text-slate-400 pt-1 leading-snug">
                    {arbitratorSuggestion.explanation}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setArbitratorSuggestion(null)}
                    className="flex-1 py-2 rounded-xl bg-[#1a2430] text-slate-300 text-xs font-semibold"
                  >
                    Другой вариант
                  </button>
                  <button
                    onClick={handleApplyArbitrator}
                    className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
                  >
                    Принять штраф
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 4: Norms & Settings */}
      {showNormsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12181f] border border-[#253342] rounded-2xl p-4 max-w-sm w-full space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">Настройки нормативов дисциплины</h3>
              <button
                onClick={() => setShowNormsModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNorms} className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">
                    Ежедневный норматив шагов:
                  </label>
                  <button
                    type="button"
                    onClick={() => setStepNormInput(stepNormInput === 0 ? 10000 : 0)}
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border transition-all ${
                      stepNormInput === 0
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        : 'bg-[#18232f] text-slate-400 border-[#263546] hover:text-slate-200'
                    }`}
                  >
                    {stepNormInput === 0 ? '🚫 Без цели (нажмите чтобы задать)' : '🚫 Не ставить цель'}
                  </button>
                </div>

                {stepNormInput > 0 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStepNormInput(prev => Math.max(500, prev - 500))}
                      className="w-10 h-10 rounded-xl bg-[#18232f] hover:bg-[#253648] text-emerald-400 font-bold text-lg flex items-center justify-center border border-[#273849] active:scale-95 transition-all"
                      title="Уменьшить на 500"
                    >
                      -
                    </button>

                    <div className="relative flex-1">
                      <input
                        type="number"
                        step="500"
                        min="500"
                        value={stepNormInput}
                        onChange={e => setStepNormInput(Math.max(0, Number(e.target.value)))}
                        className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-center text-xs font-mono font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                      <span className="absolute right-3 top-2.5 text-[10px] text-slate-500 font-mono pointer-events-none">
                        шагов
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setStepNormInput(prev => prev + 500)}
                      className="w-10 h-10 rounded-xl bg-[#18232f] hover:bg-[#253648] text-emerald-400 font-bold text-lg flex items-center justify-center border border-[#273849] active:scale-95 transition-all"
                      title="Увеличить на 500"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <div className="bg-[#101720] border border-amber-500/30 rounded-xl p-2.5 text-xs text-amber-300/90 flex items-center justify-between">
                    <span>Свободный режим без штрафов за шаги.</span>
                    <button
                      type="button"
                      onClick={() => setStepNormInput(10000)}
                      className="text-emerald-400 hover:text-emerald-300 font-bold text-xs"
                    >
                      Задать 10 000
                    </button>
                  </div>
                )}

                <span className="text-[10px] text-slate-500 mt-2 block">
                  {stepNormInput === 0
                    ? 'Свободный режим: предупреждения и штрафы за недобор шагов не начисляются.'
                    : 'Регулируйте стрелками ±500 или введите точное число. При недоборе начисляется предупреждение или штрафное кардио.'}
                </span>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowNormsModal(false)}
                  className="flex-1 py-2 rounded-xl bg-[#1a2430] text-slate-300 text-xs font-semibold"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
                >
                  Сохранить норматив
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
