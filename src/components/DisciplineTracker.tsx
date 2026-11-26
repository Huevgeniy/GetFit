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
  Activity,
  FileText,
  Copy,
  Download
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  UserProfile,
  DisciplinePenalty,
  WorkoutPlan,
  WorkoutRecord,
  DailyNutritionRecord,
  SleepRecord,
  GoalMarathon,
  DisciplineHabitId,
  DisciplineSettings,
  DisciplineEvent,
} from '../types';
import {
  DISCIPLINE_HABITS,
  DisciplineLevelMeta,
  disciplineIsActive,
  disciplineLevel,
  enabledHabits,
  normalizeDisciplineSettings,
  suggestPenalties,
  PenaltySuggestion,
} from '../lib/discipline';
import { loadActiveCycle } from '../lib/cycleTemplates';

interface DisciplineTrackerProps {
  user: UserProfile;
  penalties: DisciplinePenalty[];
  workoutPlans: WorkoutPlan[];
  pastWorkouts: WorkoutRecord[];
  dailyNutritionRecords: DailyNutritionRecord[];
  sleepRecords: SleepRecord[];
  marathons: GoalMarathon[];
  onResolvePenalty: (penaltyId: string) => void;
  onRescheduleWorkout: (planId: string, newDate: string, reason: string) => void;
  onApplyPenalty: (reason: string, task: string, points: number) => void;
  onAssignPenalty: (penaltyId: string, task: string, category: string, severity: number) => void;
  onCloseDisciplineDay: (completed: DisciplineHabitId[]) => void;
  onUpdateUser?: (updated: Partial<UserProfile>) => void;
}

export const DisciplineTracker: React.FC<DisciplineTrackerProps> = ({
  user,
  penalties = [],
  workoutPlans = [],
  pastWorkouts = [],
  dailyNutritionRecords = [],
  sleepRecords = [],
  marathons = [],
  onResolvePenalty,
  onRescheduleWorkout,
  onApplyPenalty,
  onAssignPenalty,
  onCloseDisciplineDay = () => undefined,
  onUpdateUser,
}) => {
  const disciplineSettings = normalizeDisciplineSettings(user.disciplineSettings);
  const habits = enabledHabits(disciplineSettings);
  const active = disciplineIsActive(disciplineSettings, workoutPlans) || Boolean(user.disciplineStartedAt);
  const started = Boolean(user.disciplineStartedAt);
  const displayScore = active && started ? user.disciplineScore : 0;
  const levelMeta = disciplineLevel(displayScore, active && started);
  const today = new Date().toISOString().slice(0, 10);
  const activeCycle = loadActiveCycle();
  const cycleDoneToday = Boolean(
    activeCycle &&
      Object.values(activeCycle.completedAt || {}).some(value => value.slice(0, 10) === today),
  );
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCustomPenaltyModal, setShowCustomPenaltyModal] = useState(false);
  const [showAiArbitratorModal, setShowAiArbitratorModal] = useState(false);
  const [showNormsModal, setShowNormsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<DisciplineSettings>(disciplineSettings);
  const [contractFriend, setContractFriend] = useState(user.disciplineContract?.friendName || '');
  const [contractAccepted, setContractAccepted] = useState(Boolean(user.disciplineContract?.acceptedAt));
  const [contractFriendAccepted, setContractFriendAccepted] = useState(Boolean(user.disciplineContract?.friendAcceptedAt));
  const [dayCompleted, setDayCompleted] = useState<Partial<Record<DisciplineHabitId, boolean>>>(() => ({
    workout: pastWorkouts.some(workout => (workout.date || workout.completedAt || workout.startedAt || '').slice(0, 10) === today),
    sleep: sleepRecords.some(record => record.date === today),
    nutrition: dailyNutritionRecords.some(record => record.date === today && (record.meals?.length || 0) > 0),
    steps: Boolean(user.stepGoalEnabled && user.dailyStepGoal > 0 && (user.dailySteps?.[today] || 0) >= user.dailyStepGoal),
    marathon: marathons.some(marathon => marathon.dailyLogs?.some(log => log.date === today)),
    cycle: cycleDoneToday,
    lab: false,
  }));

  // Reschedule form state
  const [selectedPlanId, setSelectedPlanId] = useState<string>(workoutPlans[0]?.id || '');
  const [newDateInput, setNewDateInput] = useState('Завтра');
  const [rescheduleReason, setRescheduleReason] = useState('Восстановление мышц и нервной системы');

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
  const [arbitratorLostPoints, setArbitratorLostPoints] = useState(15);
  const [arbitratorOptions, setArbitratorOptions] = useState<PenaltySuggestion[]>([]);
  const [arbitratorIndex, setArbitratorIndex] = useState(0);
  const [arbitratorPenaltyId, setArbitratorPenaltyId] = useState<string | null>(null);
  const [arbitratorSuggestion, setArbitratorSuggestion] = useState<{
    task: string;
    points: number;
    explanation: string;
  } | null>(null);

  // Norms state (preserves 0 if no step goal set)
  const [stepNormInput, setStepNormInput] = useState<number>(user.dailyStepGoal !== undefined ? user.dailyStepGoal : 10000);
  const [stepGoalEnabledDraft, setStepGoalEnabledDraft] = useState(Boolean(user.stepGoalEnabled));

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

  const handleAiArbitratorRequest = () => {
    const options = suggestPenalties(
      disciplineSettings,
      arbitratorLostPoints,
      Boolean(user.stepGoalEnabled),
      user.dailyStepGoal,
    );
    setArbitratorOptions(options);
    setArbitratorIndex(0);
    const first = options[0];
    setArbitratorSuggestion(
      first
        ? {
            task: first.task,
            points: first.points,
            explanation: `Категория: ${first.label}. Сложность подобрана по потерянным очкам. Шаги предлагаются только если цель шагов включена.`,
          }
        : {
            task: 'Выбери наказание вручную в конструкторе штрафов',
            points: Math.max(1, arbitratorLostPoints),
            explanation: 'В настройках дисциплины не разрешена ни одна категория штрафов. Включи категории или создай штраф вручную.',
          },
    );
  };

  const cycleArbitratorOption = () => {
    if (arbitratorOptions.length === 0) return;
    const next = (arbitratorIndex + 1) % arbitratorOptions.length;
    const option = arbitratorOptions[next];
    setArbitratorIndex(next);
    setArbitratorSuggestion({
      task: option.task,
      points: option.points,
      explanation: `Категория: ${option.label}. Сложность подобрана по потерянным очкам.`,
    });
  };

  const handleApplyArbitrator = () => {
    if (!arbitratorSuggestion) return;
    if (arbitratorPenaltyId) {
      onAssignPenalty(
        arbitratorPenaltyId,
        arbitratorSuggestion.task,
        arbitratorOptions[arbitratorIndex]?.category || 'cardio',
        arbitratorOptions[arbitratorIndex]?.severity ?? 0.5,
      );
    } else {
      onApplyPenalty(`Нарушение: ${arbitratorInput.slice(0, 30)}`, arbitratorSuggestion.task, arbitratorSuggestion.points);
    }
    setShowAiArbitratorModal(false);
    setArbitratorSuggestion(null);
    setArbitratorInput('');
    setArbitratorOptions([]);
    setArbitratorPenaltyId(null);
  };

  const handleSaveNorms = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateUser) {
      onUpdateUser({ dailyStepGoal: stepNormInput, stepGoalEnabled: stepNormInput > 0 });
    }
    setShowNormsModal(false);
  };

  const handleSaveSettings = () => {
    if (onUpdateUser) {
      const nextSettings = {
        ...settingsDraft,
        enabled: {
          ...settingsDraft.enabled,
          steps: stepGoalEnabledDraft && stepNormInput > 0 ? settingsDraft.enabled.steps : false,
        },
      };
      onUpdateUser({
        disciplineSettings: nextSettings,
        dailyStepGoal: stepNormInput,
        stepGoalEnabled: stepGoalEnabledDraft && stepNormInput > 0,
      });
    }
    setShowSettingsModal(false);
  };

  const handleCloseDay = () => {
    onCloseDisciplineDay(habits.filter(habit => dayCompleted[habit]));
  };

  const penaltyCategoryOptions: Array<{ id: keyof DisciplineSettings['allowedCategories']; label: string }> = [
    { id: 'cardio', label: 'Кардио' },
    { id: 'steps', label: 'Шаги' },
    { id: 'financial', label: 'Финансы' },
    { id: 'diet', label: 'Питание' },
    { id: 'sleep', label: 'Сон' },
    { id: 'social', label: 'Социальное' },
    { id: 'skill', label: 'Навык' },
  ];

  const contractText = [    'ДОГОВОР ДИСЦИПЛИНЫ GETFIT',
    `Дата: ${new Date().toLocaleDateString('ru-RU')}`,
    `Участник: ${user.name || 'атлет'}`,
    contractFriend.trim() ? `Партнёр: ${contractFriend.trim()}` : 'Партнёр: не указан',
    '',
    'Я обязуюсь:',
    ...habits.map(habit => {
      const meta = DISCIPLINE_HABITS.find(item => item.id === habit);
      return `— ${meta?.label || habit}: вес ${disciplineSettings.weights[habit]} из 100`;
    }),
    '',
    'За пропуск я принимаю штраф из выбранных мной категорий. Штраф должен вернуть потерянные очки только после выполнения.',
    'Если штраф не выполнен вовремя, дисциплина снижается дополнительно, а восстановление требует закрыть все долги и удержать серию.',
    '',
    'Подпись участника: ____________________',
    contractFriend.trim() ? 'Подпись партнёра: ____________________' : '',
    'Я подтверждаю, что условия выбраны добровольно и буду выполнять их честно.',
  ].filter(Boolean).join('\n');

  const copyContract = async () => {
    try {
      await navigator.clipboard.writeText(contractText);
      confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });
    } catch {
      // ignore
    }
  };

  const downloadContract = () => {
    const blob = new Blob([contractText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'getfit-discipline-contract.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareContract = () => {
    const text = encodeURIComponent(contractText);
    window.open(`https://t.me/share/url?url=${encodeURIComponent('https://getfit-kqhi.onrender.com')}&text=${text}`, '_blank');
  };

  const saveContract = () => {
    if (!onUpdateUser) return;
    const now = new Date().toISOString();
    onUpdateUser({
      disciplineContract: {
        text: contractText,
        friendName: contractFriend.trim(),
        acceptedAt: now,
        friendAcceptedAt: contractFriendAccepted ? now : undefined,
        status: contractAccepted && contractFriendAccepted ? 'active' : 'draft',
      },
    });
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
    setShowContractModal(false);
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Discipline Score Overview */}
      <div
        id="tour-discipline-score"
        className="bg-gradient-to-br from-[#121a22] to-[#0d141b] border border-[#1f2c3a] rounded-2xl p-4 shadow-lg"
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Индекс дисциплины GetFit
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl font-extrabold font-mono" style={{ color: levelMeta.color }}>
                {displayScore}%
              </span>
              <span className="text-xs font-medium" style={{ color: levelMeta.color }}>
                {levelMeta.label}
              </span>
            </div>
            <p className="mt-1 max-w-[230px] text-[9px] leading-snug text-slate-500">
              {!active
                ? 'Пока 0: дисциплина активируется после первого выполненного задания по плану или привычке.'
                : !started
                  ? 'Пока 0: выполните первое задание по плану или привычке — тогда дисциплина станет 100%.'
                  : levelMeta.description}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => {
                  setSettingsDraft(disciplineSettings);
                  setStepNormInput(user.dailyStepGoal ?? 10000);
                  setStepGoalEnabledDraft(Boolean(user.stepGoalEnabled));
                  setShowSettingsModal(true);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-[#2b4050] bg-[#121c25] px-1.5 py-1 text-[8px] font-bold text-slate-300"
              >
                <Settings className="h-2.5 w-2.5" />
                Настройки
              </button>
              <button
                type="button"
                onClick={() => setShowContractModal(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-1 text-[8px] font-bold text-emerald-300"
              >
                <FileText className="h-2.5 w-2.5" />
                Договор
              </button>
            </div>
          </div>
        </div>

        {/* Streaks & Norms */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-[#1b2532]">
          <div className="bg-[#151e29] p-2.5 rounded-xl">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold uppercase">
              <Flame className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
              <span>Стрик</span>
            </div>
            <div className="text-xs font-bold font-mono text-slate-100 mt-1">{started ? user.streakDays : 0} дн.</div>
          </div>

          <div className="bg-[#151e29] p-2.5 rounded-xl">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold uppercase">
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>Рекорд</span>
            </div>
            <div className="text-xs font-bold font-mono text-slate-100 mt-1">{started ? user.longestStreak : 0} дн.</div>
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
              {user.stepGoalEnabled && user.dailyStepGoal && user.dailyStepGoal > 0
                ? `${user.dailyStepGoal.toLocaleString('ru-RU')} ш.`
                : 'Без цели'}
            </div>
          </div>
        </div>
      </div>

      {/* Daily discipline check-in */}
      <div className="rounded-2xl border border-[#1f2c3a] bg-[#0d141b] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-bold text-slate-200">Чек-ин дня</span>
          </div>
          <span className="text-[9px] text-slate-500">{new Date().toLocaleDateString('ru-RU')}</span>
        </div>
        {!active ? (
          <p className="mt-2 rounded-xl border border-dashed border-[#263a4a] bg-[#091117] px-2.5 py-3 text-[9px] leading-relaxed text-slate-500">
            Дисциплина пока не активна. Добавьте план или включите привычки в настройках — после первого выполненного задания она станет 100%.
          </p>
        ) : (
          <>
            <div className="mt-2 space-y-1.5">
              {habits.map(habit => {
                const meta = DISCIPLINE_HABITS.find(item => item.id === habit);
                const done = Boolean(dayCompleted[habit]);
                return (
                  <button
                    key={habit}
                    type="button"
                    onClick={() => setDayCompleted(prev => ({ ...prev, [habit]: !prev[habit] }))}
                    className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors ${
                      done
                        ? 'border-emerald-500/30 bg-emerald-500/8'
                        : 'border-[#223442] bg-[#091117]'
                    }`}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${done ? 'border-emerald-400 bg-emerald-500 text-slate-950' : 'border-[#3b4a5a]'}`}>
                      {done && <CheckCircle2 className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-bold text-slate-200">{meta?.label || habit}</span>
                      <span className="block text-[8px] text-slate-500">{meta?.description}</span>
                    </span>
                    <span className="shrink-0 rounded bg-[#18232f] px-1.5 py-0.5 text-[8px] font-bold text-slate-400">
                      −{disciplineSettings.weights[habit]}%
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[8px] leading-snug text-slate-500">
                После закрытия пропуски спишут очки и создадут штраф.
              </span>
              <button
                type="button"
                disabled={user.disciplineLastClosedDate === today}
                onClick={handleCloseDay}
                className="shrink-0 rounded-xl bg-emerald-500 px-2.5 py-2 text-[9px] font-bold text-slate-950 disabled:opacity-40"
              >
                {user.disciplineLastClosedDate === today ? 'День закрыт' : 'Закрыть день'}
              </button>
            </div>
          </>
        )}
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
            <span>Арбитр штрафов</span>
          </div>
          <span className="text-[10px] text-slate-400 leading-tight">
            Подберёт вариант из разрешённых категорий
          </span>
        </button>
      </div>

      {/* Expired penalty warning */}
      {penalties.some(p => p.status === 'expired') && (
        <div className="rounded-xl border border-rose-500/35 bg-rose-500/8 px-3 py-2 text-[9px] leading-relaxed text-rose-200">
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          Есть просроченные штрафы. Пока они не закрыты, дисциплина не вернётся к 100. Сначала закрой активные штрафы, затем удерживай серию несколько дней подряд.
        </div>
      )}

      {/* Hold period notice */}
      {user.disciplineHoldUntil && Date.parse(user.disciplineHoldUntil) >= Date.now() && (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/8 px-3 py-2 text-[9px] leading-relaxed text-amber-200">
          <Clock className="mr-1 inline h-3 w-3" />
          Долги закрыты, но для возврата к 100 нужно удержать дисциплину до{' '}
          {new Date(user.disciplineHoldUntil).toLocaleDateString('ru-RU')}. Закрывай дни без пропусков — очки растут за каждый чистый день.
        </div>
      )}

      {/* Pending Penalties Section */}
      <div
        id="tour-discipline-penalties"
        className="bg-[#12181f] border border-[#1e293b] rounded-xl overflow-hidden"
      >
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
                    <span className="text-right text-[9px] font-mono font-bold text-rose-400">
                      -{p.pointsDeducted}% дисц.
                      <span className="mt-0.5 block text-[8px] font-semibold text-emerald-400">
                        вернёт {p.restorePoints ?? p.pointsDeducted}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[8px] text-slate-500">
                    <span>{p.category ? p.category : 'категория не выбрана'}</span>
                    {p.expiresAt && (
                      <span>
                        до {new Date(p.expiresAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  <div className="bg-[#0e141a] p-2.5 rounded-lg border border-[#1f2a37] flex items-center justify-between text-xs gap-2">
                    <div className="pr-2">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Штрафное задание:
                      </span>
                      <span className="font-bold text-emerald-400 font-mono text-xs leading-tight block mt-0.5">
                        {p.penaltyTask}
                      </span>
                    </div>

                    {!p.category ? (
                      <button
                        onClick={() => {
                          setArbitratorPenaltyId(p.id);
                          setArbitratorLostPoints(Math.max(1, p.pointsDeducted));
                          setArbitratorInput(p.reason);
                          setArbitratorOptions([]);
                          setArbitratorSuggestion(null);
                          setShowAiArbitratorModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-sm transition-all whitespace-nowrap shrink-0"
                      >
                        Выбрать штраф
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          onResolvePenalty(p.id);
                          confetti({ particleCount: 35, spread: 60 });
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-sm transition-all whitespace-nowrap shrink-0"
                      >
                        {isFinancial ? 'Перевел' : 'Выполнил'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Penalty builder */}
      <div
        id="tour-discipline-presets"
        className="bg-[#12181f] border border-[#1e293b] rounded-xl p-3.5 space-y-2.5"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200">
            Штраф за пропуск
          </span>
          <button
            onClick={() => setShowCustomPenaltyModal(true)}
            className="text-[10px] font-bold text-emerald-400 hover:underline"
          >
            Своё задание +
          </button>
        </div>
        <p className="text-[11px] text-slate-400">
          Арбитр предложит вариант из разрешённых тобой категорий. Шаги появятся только
          при включённой цели, а сложность растёт вместе с потерянными очками.
        </p>
        <button
          onClick={() => {
            setArbitratorPenaltyId(null);
            setArbitratorLostPoints(10);
            setArbitratorInput('');
            setArbitratorOptions([]);
            setArbitratorSuggestion(null);
            setShowAiArbitratorModal(true);
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs font-bold text-emerald-300"
        >
          <Bot className="h-4 w-4" />
          Открыть арбитр штрафов
        </button>
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
                  <option value="Восстановление мышц и нервной системы">Восстановление мышц и нервной системы</option>
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
                  { label: '☕ 2 дня без кофе и энергетиков', task: '2 дня без кофе и энергетиков', reason: 'Перегруз нервной системы', points: 4 },
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
                <span>Арбитр штрафов</span>
              </div>
              <button
                onClick={() => setShowAiArbitratorModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-slate-300">
              {arbitratorPenaltyId
                ? 'Выбери штраф из разрешённых категорий. Он заменит общую формулировку и вернёт потерянные очки после выполнения.'
                : 'Опиши пропуск. Арбитр подберёт штраф из разрешённых тобой категорий. Шаги предлагаются только если цель шагов включена, без удвоений и пересечений.'}
            </p>

            <label className="block">
              <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">
                Сколько очков потеряно
              </span>
              <input
                type="number"
                min={1}
                max={50}
                disabled={Boolean(arbitratorPenaltyId)}
                value={arbitratorLostPoints}
                onChange={event => setArbitratorLostPoints(Math.max(1, Math.min(50, Number(event.target.value) || 1)))}
                className="w-full rounded-xl border border-[#263546] bg-[#18232f] px-2.5 py-2 text-xs font-bold text-slate-100 focus:border-emerald-500 focus:outline-none disabled:opacity-60"
              />
            </label>

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
                disabled={arbitratorLoading}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                {arbitratorLoading ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Подбираю вариант...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Подобрать вариант штрафа</span>
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-2.5 pt-1">
                <div className="bg-[#15202c] border border-emerald-500/30 p-3 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-emerald-400">
                      Решение арбитра:
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
                    onClick={cycleArbitratorOption}
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
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm">
          <div className="my-3 w-full max-w-md rounded-2xl border border-[#253342] bg-[#12181f] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Настройки дисциплины</h3>
                  <p className="text-[9px] text-slate-500">Привычки, веса и правила штрафов</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-[#223442] bg-[#091117] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-bold text-slate-200">Цель по шагам</div>
                    <div className="text-[8px] text-slate-500">Если выключена, арбитр не предлагает шаговые штрафы</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStepGoalEnabledDraft(value => !value)}
                    className={`rounded-lg border px-2 py-1 text-[9px] font-bold ${stepGoalEnabledDraft ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-[#2b4050] text-slate-400'}`}
                  >
                    {stepGoalEnabledDraft ? 'Включена' : 'Выключена'}
                  </button>
                </div>
                {stepGoalEnabledDraft && (
                  <input
                    type="number"
                    min={1000}
                    max={50000}
                    step={500}
                    value={stepNormInput}
                    onChange={event => setStepNormInput(Number(event.target.value) || 0)}
                    className="mt-2 w-full rounded-lg border border-[#263546] bg-[#18232f] px-2.5 py-1.5 text-xs font-bold text-slate-100"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Привычки и вес</div>
                {DISCIPLINE_HABITS.map(habit => (
                  <div key={habit.id} className="flex items-center gap-2 rounded-xl border border-[#223442] bg-[#091117] px-2.5 py-2">
                    <button
                      type="button"
                      onClick={() => setSettingsDraft(prev => ({ ...prev, enabled: { ...prev.enabled, [habit.id]: !prev.enabled[habit.id] } }))}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${settingsDraft.enabled[habit.id] ? 'border-emerald-400 bg-emerald-500 text-slate-950' : 'border-[#3b4a5a]'}`}
                    >
                      {settingsDraft.enabled[habit.id] && <CheckCircle2 className="h-3 w-3" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] font-bold text-slate-200">{habit.label}</div>
                      <div className="text-[7px] text-slate-500">{habit.description}</div>
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={settingsDraft.weights[habit.id]}
                      onChange={event => setSettingsDraft(prev => ({ ...prev, weights: { ...prev.weights, [habit.id]: Math.max(1, Math.min(50, Number(event.target.value) || 1)) } }))}
                      className="w-12 rounded-lg border border-[#263546] bg-[#18232f] px-1 py-1 text-center text-[9px] font-bold text-slate-200"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-[8px] text-slate-500">
                  Режим
                  <select
                    value={settingsDraft.penaltyMode}
                    onChange={event => setSettingsDraft(prev => ({ ...prev, penaltyMode: event.target.value as 'confirm' | 'auto' }))}
                    className="mt-1 w-full rounded-lg border border-[#263546] bg-[#18232f] px-2 py-1.5 text-[9px] text-slate-200"
                  >
                    <option value="confirm">Подтверждать</option>
                    <option value="auto">Автоматически</option>
                  </select>
                </label>
                <label className="text-[8px] text-slate-500">
                  Срок, ч
                  <select
                    value={settingsDraft.confirmationHours}
                    onChange={event => setSettingsDraft(prev => ({ ...prev, confirmationHours: Number(event.target.value) }))}
                    className="mt-1 w-full rounded-lg border border-[#263546] bg-[#18232f] px-2 py-1.5 text-[9px] text-slate-200"
                  >
                    {[12, 24, 48, 72].map(hours => <option key={hours} value={hours}>{hours}</option>)}
                  </select>
                </label>
                <label className="text-[8px] text-slate-500">
                  Сложность
                  <select
                    value={settingsDraft.difficulty}
                    onChange={event => setSettingsDraft(prev => ({ ...prev, difficulty: event.target.value as 'soft' | 'normal' | 'hard' }))}
                    className="mt-1 w-full rounded-lg border border-[#263546] bg-[#18232f] px-2 py-1.5 text-[9px] text-slate-200"
                  >
                    <option value="soft">Мягкая</option>
                    <option value="normal">Обычная</option>
                    <option value="hard">Жёсткая</option>
                  </select>
                </label>
                <label className="text-[8px] text-slate-500">
                  Финансы, ₽
                  <div className="mt-1 flex gap-1">
                    <input type="number" value={settingsDraft.financialMin} onChange={event => setSettingsDraft(prev => ({ ...prev, financialMin: Math.max(50, Number(event.target.value) || 100) }))} className="w-full rounded-lg border border-[#263546] bg-[#18232f] px-1 py-1.5 text-[9px] text-slate-200" />
                    <input type="number" value={settingsDraft.financialMax} onChange={event => setSettingsDraft(prev => ({ ...prev, financialMax: Math.max(100, Number(event.target.value) || 1000) }))} className="w-full rounded-lg border border-[#263546] bg-[#18232f] px-1 py-1.5 text-[9px] text-slate-200" />
                  </div>
                </label>
              </div>

              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Разрешённые штрафы</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {penaltyCategoryOptions.map(category => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSettingsDraft(prev => ({ ...prev, allowedCategories: { ...prev.allowedCategories, [category.id]: !prev.allowedCategories[category.id] } }))}
                      className={`rounded-lg border px-1.5 py-1 text-[8px] font-semibold ${settingsDraft.allowedCategories[category.id] ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-[#263546] text-slate-500'}`}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-[9px] text-slate-400">
                <input type="checkbox" checked={settingsDraft.notifyPenalties} onChange={event => setSettingsDraft(prev => ({ ...prev, notifyPenalties: event.target.checked }))} />
                Присылать уведомление о штрафе в Telegram
              </label>
            </div>

            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setShowSettingsModal(false)} className="flex-1 rounded-xl bg-[#1a2430] py-2 text-xs font-semibold text-slate-300">Отмена</button>
              <button type="button" onClick={handleSaveSettings} className="flex-1 rounded-xl bg-emerald-500 py-2 text-xs font-bold text-slate-950">Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {showContractModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm">
          <div className="my-3 w-full max-w-md rounded-2xl border border-emerald-500/30 bg-[#12181f] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Договор дисциплины</h3>
                  <p className="text-[9px] text-slate-500">Двусторонний: вы и партнёр</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowContractModal(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>
            <label className="mt-3 block text-[9px] text-slate-500">
              Имя партнёра
              <input value={contractFriend} onChange={event => setContractFriend(event.target.value)} placeholder="Кому отправляем договор" className="mt-1 w-full rounded-xl border border-[#263546] bg-[#18232f] px-2.5 py-2 text-[10px] text-slate-200" />
            </label>
            <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[#223442] bg-[#091117] p-2.5 text-[8px] leading-relaxed text-slate-400">{contractText}</pre>
            <div className="mt-2 space-y-1">
              <label className="flex items-center gap-2 text-[9px] text-slate-300">
                <input type="checkbox" checked={contractAccepted} onChange={event => setContractAccepted(event.target.checked)} />
                Я принимаю условия и буду выполнять их честно
              </label>
              <label className="flex items-center gap-2 text-[9px] text-slate-300">
                <input type="checkbox" checked={contractFriendAccepted} onChange={event => setContractFriendAccepted(event.target.checked)} />
                Партнёр подтвердил условия в Telegram
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <button type="button" onClick={copyContract} disabled={!contractAccepted} className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#263546] py-2 text-[9px] font-semibold text-slate-300 disabled:opacity-40">
                <Copy className="h-3 w-3" /> Копировать
              </button>
              <button type="button" onClick={downloadContract} disabled={!contractAccepted} className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#263546] py-2 text-[9px] font-semibold text-slate-300 disabled:opacity-40">
                <Download className="h-3 w-3" /> Скачать
              </button>
              <button type="button" onClick={shareContract} disabled={!contractAccepted || !contractFriendAccepted || !contractFriend.trim()} className="col-span-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 text-[9px] font-bold text-emerald-300 disabled:opacity-40">
                Отправить партнёру в Telegram
              </button>
              <button type="button" onClick={saveContract} disabled={!contractAccepted || !contractFriendAccepted || !contractFriend.trim()} className="col-span-2 rounded-xl bg-emerald-500 py-2 text-[9px] font-bold text-slate-950 disabled:opacity-40">
                Зафиксировать двусторонний договор
              </button>
            </div>
            {user.disciplineContract?.status === 'active' && (
              <p className="mt-2 rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-2 py-1.5 text-[8px] text-emerald-300">
                Договор активен с {new Date(user.disciplineContract.acceptedAt).toLocaleDateString('ru-RU')} · партнёр: {user.disciplineContract.friendName}
              </p>
            )}
            <p className="mt-2 text-[8px] leading-relaxed text-slate-500">
              Пока обе стороны не подтвердили условия, договор остаётся черновиком. После фиксации текст и подписи хранятся в профиле.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
