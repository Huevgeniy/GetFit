import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Flame, 
  Plus, 
  CheckCircle2, 
  ChevronRight, 
  Sparkles, 
  Calendar, 
  ArrowRight, 
  Shield, 
  Award, 
  RotateCcw, 
  AlertTriangle, 
  ArrowUpRight, 
  TrendingUp, 
  Dumbbell, 
  Bike, 
  Scale, 
  Zap,
  Clock,
  Check,
  X,
  Footprints
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { GoalMarathon, MarathonDayLog, UserProfile } from '../types';

interface MarathonsViewProps {
  user: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onSelectStepsTab?: () => void;
}

export const MarathonsView: React.FC<MarathonsViewProps> = ({
  user,
  onUpdateUser,
}) => {
  const [marathons, setMarathons] = useState<GoalMarathon[]>(() => {
    try {
      const saved = localStorage.getItem('getfit_goal_marathons');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((m: any) => 
            m.id !== 'marathon_steps_14d' && m.id !== 'marathon_bench_30d' &&
            !m.title?.includes('10 000 шагов каждый день') &&
            !m.title?.includes('Силовой рывок: Жим 120 кг')
          );
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('getfit_goal_marathons', JSON.stringify(cleaned));
          }
          return cleaned;
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedMarathonId, setSelectedMarathonId] = useState<string | null>(null);

  // Check-in modal / logging state
  const [checkInMarathon, setCheckInMarathon] = useState<GoalMarathon | null>(null);
  const [logValueInput, setLogValueInput] = useState('');
  const [logNoteInput, setLogNoteInput] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form state for creating a marathon
  const [category, setCategory] = useState<GoalMarathon['category']>('steps');
  const [title, setTitle] = useState('');
  const [targetGoalValue, setTargetGoalValue] = useState(10000);
  const [unit, setUnit] = useState('шагов');
  const [targetMetricName, setTargetMetricName] = useState('Шаги в день');
  const [durationDays, setDurationDays] = useState(14);
  const [frequency, setFrequency] = useState<GoalMarathon['frequency']>('daily');

  useEffect(() => {
    try {
      localStorage.setItem('getfit_goal_marathons', JSON.stringify(marathons));
    } catch (e) {
      console.error('Failed to save marathons', e);
    }
  }, [marathons]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleApplyPreset = (preset: {
    category: GoalMarathon['category'];
    title: string;
    targetMetricName: string;
    targetGoalValue: number;
    unit: string;
    durationDays: number;
    frequency: GoalMarathon['frequency'];
  }) => {
    setCategory(preset.category);
    setTitle(preset.title);
    setTargetMetricName(preset.targetMetricName);
    setTargetGoalValue(preset.targetGoalValue);
    setUnit(preset.unit);
    setDurationDays(preset.durationDays);
    setFrequency(preset.frequency);
  };

  const handleCreateMarathonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + durationDays * 86400000).toISOString().split('T')[0];

    const newMarathon: GoalMarathon = {
      id: `marathon_${Date.now()}`,
      category,
      title: title.trim(),
      targetMetricName: targetMetricName.trim() || 'Показатель',
      targetGoalValue: Number(targetGoalValue) || 1,
      unit: unit.trim() || 'ед.',
      frequency,
      durationDays,
      currentDay: 1,
      startDate,
      endDate,
      status: 'active',
      bankedSurplus: 0,
      rewardRating: durationDays >= 21 ? 400 : durationDays >= 14 ? 250 : 150,
      rewardRespect: durationDays >= 21 ? 100 : durationDays >= 14 ? 60 : 40,
      rewardBadgeTitle: `Финишер: ${title.trim()}`,
      rewardRankBonus: '+1 ступень к званию',
      dailyLogs: [
        {
          dayNumber: 1,
          date: startDate,
          value: 0,
          target: targetGoalValue,
          isHit: false,
          note: 'Старт марафона!'
        }
      ],
    };

    setMarathons(prev => [newMarathon, ...prev]);
    setShowCreateModal(false);
    showToast(`Марафон «${newMarathon.title}» запущен!`);
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
  };

  // Check-in / Log progress for today
  const handleOpenCheckIn = (m: GoalMarathon) => {
    setCheckInMarathon(m);
    const todayLog = m.dailyLogs.find(l => l.dayNumber === m.currentDay);
    setLogValueInput(todayLog && todayLog.value > 0 ? String(todayLog.value) : '');
    setLogNoteInput(todayLog?.note || '');
  };

  const handleSaveCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInMarathon) return;

    const val = Number(logValueInput) || 0;
    const isHit = val >= checkInMarathon.targetGoalValue;
    const surplus = checkInMarathon.category === 'steps' && val > checkInMarathon.targetGoalValue 
      ? val - checkInMarathon.targetGoalValue 
      : 0;

    setMarathons(prev => prev.map(m => {
      if (m.id !== checkInMarathon.id) return m;

      const updatedLogs = [...m.dailyLogs];
      const existingIdx = updatedLogs.findIndex(l => l.dayNumber === m.currentDay);

      const newLogItem: MarathonDayLog = {
        dayNumber: m.currentDay,
        date: new Date().toISOString().split('T')[0],
        value: val,
        target: m.targetGoalValue,
        isHit,
        bankedAmount: surplus > 0 ? surplus : undefined,
        note: logNoteInput.trim() || undefined,
      };

      if (existingIdx >= 0) {
        updatedLogs[existingIdx] = newLogItem;
      } else {
        updatedLogs.push(newLogItem);
      }

      // If steps and surplus exists, also add to marathon bankedSurplus!
      const newBanked = m.bankedSurplus + surplus;

      return {
        ...m,
        dailyLogs: updatedLogs,
        bankedSurplus: newBanked,
      };
    }));

    // If surplus, also update user's stepBank in UserProfile!
    if (surplus > 0) {
      onUpdateUser({
        stepBank: (user.stepBank || 0) + surplus,
      });
      showToast(`✅ Зафиксировано! +${surplus.toLocaleString('ru-RU')} ш. излишка перенесено в копилку!`);
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
    } else if (isHit) {
      showToast(`🎯 Дневная норма марафона закрыта! Красава!`);
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
    } else {
      showToast(`Результат зафиксирован (${val} ${checkInMarathon.unit})`);
    }

    setCheckInMarathon(null);
  };

  // Use banked steps to cover current day deficiency
  const handleUseBankedSteps = (m: GoalMarathon) => {
    const todayLog = m.dailyLogs.find(l => l.dayNumber === m.currentDay);
    const currentValue = todayLog?.value || 0;
    const deficit = Math.max(0, m.targetGoalValue - currentValue);

    if (deficit <= 0) {
      showToast('Сегодня норма уже выполнена!');
      return;
    }

    const availableBank = Math.max(m.bankedSurplus, user.stepBank || 0);
    if (availableBank <= 0) {
      showToast('В копилке марафона пока нет перенесенных шагов.');
      return;
    }

    const transferAmount = Math.min(deficit, availableBank);

    setMarathons(prev => prev.map(mar => {
      if (mar.id !== m.id) return mar;
      const updatedLogs = [...mar.dailyLogs];
      const todayIdx = updatedLogs.findIndex(l => l.dayNumber === mar.currentDay);
      const newVal = currentValue + transferAmount;

      const updatedLog: MarathonDayLog = {
        dayNumber: mar.currentDay,
        date: new Date().toISOString().split('T')[0],
        value: newVal,
        target: mar.targetGoalValue,
        isHit: newVal >= mar.targetGoalValue,
        note: `Дополнено из копилки (+${transferAmount.toLocaleString('ru-RU')} ш.)`,
      };

      if (todayIdx >= 0) {
        updatedLogs[todayIdx] = updatedLog;
      } else {
        updatedLogs.push(updatedLog);
      }

      return {
        ...mar,
        bankedSurplus: Math.max(0, mar.bankedSurplus - transferAmount),
        dailyLogs: updatedLogs,
      };
    }));

    onUpdateUser({
      stepBank: Math.max(0, (user.stepBank || 0) - transferAmount),
    });

    showToast(`⚡ Использовано ${transferAmount.toLocaleString('ru-RU')} ш. из копилки! День закрыт!`);
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
  };

  // Complete marathon
  const handleCompleteMarathon = (m: GoalMarathon) => {
    setMarathons(prev => prev.map(item => item.id === m.id ? { ...item, status: 'completed' } : item));
    
    // Reward user with rating score & respect points
    const newRating = (user.ratingScore || 1250) + m.rewardRating;
    const newRespect = (user.respectPoints || 80) + m.rewardRespect;

    onUpdateUser({
      ratingScore: newRating,
      respectPoints: newRespect,
    });

    confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 } });
    showToast(`🏆 Марафон завершен! Награда: +${m.rewardRating} рейтинга, +${m.rewardRespect} респекта!`);
  };

  const getCategoryIcon = (cat: GoalMarathon['category']) => {
    switch (cat) {
      case 'steps':
        return <Footprints className="w-5 h-5 text-emerald-400" />;
      case 'cardio':
        return <Bike className="w-5 h-5 text-cyan-400" />;
      case 'weight_loss':
        return <Scale className="w-5 h-5 text-amber-400" />;
      case 'strength':
        return <Dumbbell className="w-5 h-5 text-indigo-400" />;
      default:
        return <Flame className="w-5 h-5 text-rose-400" />;
    }
  };

  const activeMarathons = marathons.filter(m => m.status === 'active');
  const completedMarathons = marathons.filter(m => m.status === 'completed');

  return (
    <div className="space-y-4 pb-20">
      {/* Toast alert */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 px-4 py-2.5 rounded-xl font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Sparkles className="w-4 h-4 fill-current" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Stats Banner */}
      <div className="bg-gradient-to-br from-[#121c27] via-[#0f1721] to-[#0c131c] border border-emerald-500/30 rounded-2xl p-4 shadow-lg shadow-emerald-500/5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono font-bold">
              <Trophy className="w-4 h-4 text-emerald-400" />
              <span>Марафоны целей & Спортивный прогресс</span>
            </div>
            <h2 className="text-lg font-extrabold text-slate-100 mt-1">
              Дисциплинарные марафоны
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 max-w-sm">
              Выбери цель на 7–30 дней (шаги, сайкл, жим, сушка). Фиксируй каждый день.
              Перевыполнение шагов переноси в копилку на другие дни!
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Создать марафон</span>
          </button>
        </div>

        {/* Global Rollover Step Bank Card */}
        <div className="mt-3.5 bg-[#17222e]/80 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Zap className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Копилка остатка шагов (Rollover Bank)
              </div>
              <div className="text-base font-extrabold font-mono text-emerald-400">
                {(user.stepBank || 0).toLocaleString('ru-RU')} шагов
              </div>
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-400 max-w-[170px] leading-tight">
            Переноси излишек шагов и спасай дни с недостаточной активностью!
          </div>
        </div>
      </div>

      {/* Active Marathons List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span>Текущие марафоны ({activeMarathons.length})</span>
          </h3>
          {activeMarathons.length > 0 && (
            <span className="text-[11px] text-emerald-400 font-mono">
              Держи темп до финиша
            </span>
          )}
        </div>

        {activeMarathons.length === 0 ? (
          <div className="bg-[#101720] border border-[#202d3d] rounded-2xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#172230] text-slate-400 flex items-center justify-center mx-auto">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-200">Нет активных марафонов</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Создай свой первый марафон: шаги, жим лежа, велосипед или сброс веса!
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl"
            >
              + Создать марафон
            </button>
          </div>
        ) : (
          activeMarathons.map(m => {
            const daysCompletedCount = m.dailyLogs.filter(l => l.isHit).length;
            const progressPercent = Math.min(100, Math.round((daysCompletedCount / m.durationDays) * 100));
            const todayLog = m.dailyLogs.find(l => l.dayNumber === m.currentDay);
            const isTodayHit = todayLog?.isHit || false;

            return (
              <div
                key={m.id}
                className="bg-gradient-to-br from-[#121c27] to-[#0e1620] border border-[#223345] hover:border-emerald-500/50 rounded-2xl p-4 transition-all space-y-3 shadow-md"
              >
                {/* Marathon Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#182635] border border-[#273d54] flex items-center justify-center flex-shrink-0">
                      {getCategoryIcon(m.category)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                          День {m.currentDay} из {m.durationDays}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {m.frequency === 'daily' ? 'Каждый день' : m.frequency === 'every_workout' ? 'Каждую тренировку' : '3-4 раза в неделю'}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-slate-100 mt-1">
                        {m.title}
                      </h4>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-emerald-400">
                      Цель: {m.targetGoalValue.toLocaleString('ru-RU')} {m.unit}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Награда: +{m.rewardRating} рейтинга
                    </div>
                  </div>
                </div>

                {/* Progress Bar & Stats */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5 font-mono">
                    <span className="text-slate-300">
                      Выполнено: <strong className="text-emerald-400">{daysCompletedCount}</strong> из {m.durationDays} дней ({progressPercent}%)
                    </span>
                    <span className="text-slate-400">
                      До финиша: {Math.max(0, m.durationDays - daysCompletedCount)} дн.
                    </span>
                  </div>

                  <div className="w-full bg-[#18232f] h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Day-by-Day Visual Checklist Grid */}
                <div className="bg-[#0b1016] p-2.5 rounded-xl border border-[#1a2533]">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 font-mono">
                    <span>График дней:</span>
                    <span className="text-emerald-400 font-bold">
                      {isTodayHit ? '✅ Сегодня выполнено' : '⏳ Ожидает фиксации'}
                    </span>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {Array.from({ length: m.durationDays }).map((_, idx) => {
                      const dayNum = idx + 1;
                      const log = m.dailyLogs.find(l => l.dayNumber === dayNum);
                      const isPast = dayNum < m.currentDay;
                      const isCurrent = dayNum === m.currentDay;
                      const hit = log?.isHit;

                      return (
                        <div
                          key={dayNum}
                          className={`flex flex-col items-center justify-center p-1.5 rounded-lg text-center border transition-all ${
                            hit
                              ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-bold'
                              : isCurrent
                              ? 'bg-amber-500/20 border-amber-500/80 text-amber-300 animate-pulse'
                              : isPast
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400/80'
                              : 'bg-[#141d27] border-[#223040] text-slate-500'
                          }`}
                          title={`День ${dayNum}: ${hit ? 'Выполнен' : isCurrent ? 'Текущий' : isPast ? 'Пропущен' : 'Предстоит'}`}
                        >
                          <span className="text-[9px] font-mono leading-none">Д{dayNum}</span>
                          <span className="text-[11px] mt-0.5">
                            {hit ? '✓' : isCurrent ? '⏳' : isPast ? '✕' : '•'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Rollover Surplus Bank Card (For Steps / Cardio Marathons) */}
                {m.category === 'steps' && (
                  <div className="bg-[#14202c] border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-emerald-400" />
                      <div>
                        <span className="text-[11px] font-bold text-slate-200">
                          Копилка марафона:
                        </span>
                        <span className="ml-1.5 text-xs font-mono font-extrabold text-emerald-400">
                          {m.bankedSurplus.toLocaleString('ru-RU')} шагов
                        </span>
                      </div>
                    </div>

                    {!isTodayHit && m.bankedSurplus > 0 && (
                      <button
                        onClick={() => handleUseBankedSteps(m)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-bold border border-emerald-500/40 transition-all flex items-center gap-1 active:scale-95"
                      >
                        <Zap className="w-3 h-3" />
                        <span>Закрыть день из копилки</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Bottom Action Controls */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleOpenCheckIn(m)}
                    className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{todayLog ? 'Обновить результат дня' : 'Внести результат дня'}</span>
                  </button>

                  {progressPercent >= 100 && (
                    <button
                      onClick={() => handleCompleteMarathon(m)}
                      className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 animate-bounce active:scale-95"
                    >
                      <Award className="w-4 h-4" />
                      <span>Забрать награду</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Completed Marathons Section */}
      {completedMarathons.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-[#1b2734]">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>Завершенные марафоны ({completedMarathons.length})</span>
          </h3>

          <div className="space-y-2">
            {completedMarathons.map(m => (
              <div
                key={m.id}
                className="bg-[#101721] border border-[#213144] rounded-xl p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    ✓
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">{m.title}</h4>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {m.durationDays} дней • {m.rewardBadgeTitle}
                    </p>
                  </div>
                </div>

                <div className="text-right text-[11px] font-mono text-emerald-400 font-bold">
                  +{m.rewardRating} рейтинга
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: Create New Marathon */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#121820] border border-[#263749] rounded-2xl p-4 max-w-md w-full space-y-4 my-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-emerald-400" />
                <span>Создать дисциплинарный марафон</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-lg bg-[#18232f] text-slate-400 hover:text-slate-200 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Presets for fast selection */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                Быстрые шаблоны марафонов:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleApplyPreset({
                    category: 'steps',
                    title: '10 000 шагов каждый день',
                    targetMetricName: 'Шаги в день',
                    targetGoalValue: 10000,
                    unit: 'шагов',
                    durationDays: 14,
                    frequency: 'daily'
                  })}
                  className="p-2 rounded-xl bg-[#18232f] hover:bg-[#223344] text-left border border-[#27384a] transition-all"
                >
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                    <Footprints className="w-3.5 h-3.5" />
                    <span>10 000 шагов / 14 дней</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">С переносом остатка</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyPreset({
                    category: 'strength',
                    title: 'Силовой рывок: Жим 120 кг',
                    targetMetricName: 'Рабочий вес в жиме',
                    targetGoalValue: 120,
                    unit: 'кг',
                    durationDays: 30,
                    frequency: 'every_workout'
                  })}
                  className="p-2 rounded-xl bg-[#18232f] hover:bg-[#223344] text-left border border-[#27384a] transition-all"
                >
                  <div className="flex items-center gap-1.5 text-indigo-400 text-xs font-bold">
                    <Dumbbell className="w-3.5 h-3.5" />
                    <span>Жим 120 кг / 30 дней</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Фиксация каждой тренировки</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyPreset({
                    category: 'cardio',
                    title: 'Вело-дефис: 25 км',
                    targetMetricName: 'Дистанция на велосипеде',
                    targetGoalValue: 25,
                    unit: 'км',
                    durationDays: 21,
                    frequency: '3_times_week'
                  })}
                  className="p-2 rounded-xl bg-[#18232f] hover:bg-[#223344] text-left border border-[#27384a] transition-all"
                >
                  <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-bold">
                    <Bike className="w-3.5 h-3.5" />
                    <span>Вело 25 км / 21 день</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">3 раза в неделю</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyPreset({
                    category: 'weight_loss',
                    title: 'Сушка: Сброс 3 кг',
                    targetMetricName: 'Снижение веса',
                    targetGoalValue: 3,
                    unit: 'кг',
                    durationDays: 21,
                    frequency: 'daily'
                  })}
                  className="p-2 rounded-xl bg-[#18232f] hover:bg-[#223344] text-left border border-[#27384a] transition-all"
                >
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                    <Scale className="w-3.5 h-3.5" />
                    <span>Сушка -3 кг / 21 день</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Контроль калорий и веса</div>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateMarathonSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Название марафона:
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Например: 10 000 шагов 14 дней подряд"
                  required
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Категория:
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="steps">Шаги (с переносом остатка)</option>
                    <option value="strength">Сила (жим, подтягивания, присед)</option>
                    <option value="cardio">Кардио / Велосипед</option>
                    <option value="weight_loss">Похудение / Сушка</option>
                    <option value="custom">Свой норматив</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Длительность (дней):
                  </label>
                  <select
                    value={durationDays}
                    onChange={e => setDurationDays(Number(e.target.value))}
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                  >
                    <option value={7}>7 дней (1 неделя)</option>
                    <option value={14}>14 дней (2 недели)</option>
                    <option value={21}>21 день (3 недели)</option>
                    <option value={30}>30 дней (1 месяц)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Целевой показатель:
                  </label>
                  <input
                    type="number"
                    value={targetGoalValue}
                    onChange={e => setTargetGoalValue(Number(e.target.value))}
                    required
                    min={1}
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Единица измерения:
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    placeholder="шагов, кг, км, повторений"
                    required
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Периодичность фиксации:
                </label>
                <select
                  value={frequency}
                  onChange={e => setFrequency(e.target.value as any)}
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="daily">Каждый день (ежедневно)</option>
                  <option value="every_workout">Каждую тренировку</option>
                  <option value="3_times_week">3 раза в неделю</option>
                  <option value="4_times_week">4 раза в неделю</option>
                </select>
              </div>

              <div className="bg-[#17222f] p-3 rounded-xl border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Награда за финиш:
                  </span>
                  <span className="text-xs font-bold text-emerald-400">
                    +{durationDays >= 21 ? '400' : durationDays >= 14 ? '250' : '150'} очков рейтинга
                  </span>
                </div>
                <span className="text-xs text-amber-300 font-mono font-bold">
                  +Медаль в профиль 🥇
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all active:scale-95"
              >
                Запустить марафон 🚀
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Check-in / Log Daily Result */}
      {checkInMarathon && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121820] border border-[#263749] rounded-2xl p-4 max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold">
                  День {checkInMarathon.currentDay} из {checkInMarathon.durationDays}
                </span>
                <h3 className="text-sm font-bold text-slate-100 mt-0.5">
                  Внести результат за сегодня
                </h3>
              </div>
              <button
                onClick={() => setCheckInMarathon(null)}
                className="w-8 h-8 rounded-lg bg-[#18232f] text-slate-400 hover:text-slate-200 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCheckIn} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Фактический результат ({checkInMarathon.unit}):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={logValueInput}
                    onChange={e => setLogValueInput(e.target.value)}
                    placeholder={`Цель: ${checkInMarathon.targetGoalValue}`}
                    required
                    autoFocus
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 font-mono text-sm font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">
                    {checkInMarathon.unit}
                  </span>
                </div>

                {checkInMarathon.category === 'steps' && Number(logValueInput) > checkInMarathon.targetGoalValue && (
                  <span className="text-[11px] text-emerald-400 font-medium mt-1.5 block">
                    🎉 Перевыполнение на +{(Number(logValueInput) - checkInMarathon.targetGoalValue).toLocaleString('ru-RU')} шагов! Остаток будет автоматически добавлен в копилку марафона!
                  </span>
                )}
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Заметка (самочувствие, вес штанги, пульс):
                </label>
                <input
                  type="text"
                  value={logNoteInput}
                  onChange={e => setLogNoteInput(e.target.value)}
                  placeholder="Отличный темп, пульс в норме..."
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCheckInMarathon(null)}
                  className="flex-1 py-2.5 bg-[#18232f] text-slate-300 font-semibold rounded-xl"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-md transition-all active:scale-95"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
