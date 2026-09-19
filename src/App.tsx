import React, { useState, useEffect } from 'react';
import { TelegramHeader } from './components/TelegramHeader';
import { Navigation, NavTab } from './components/Navigation';
import { WorkoutsHub } from './components/WorkoutsHub';
import { AiWorkoutLive } from './components/AiWorkoutLive';
import { ProgressCharts } from './components/ProgressCharts';
import { SportsRanks } from './components/SportsRanks';
import { FriendBattles } from './components/FriendBattles';
import { DisciplineTracker } from './components/DisciplineTracker';
import { ProfileView } from './components/ProfileView';
import { NutritionSleepTracker } from './components/NutritionSleepTracker';
import { GlobalAiChatModal } from './components/GlobalAiChatModal';
import { ResearchLabView } from './components/ResearchLabView';
import { AiSettingsModal } from './components/AiSettingsModal';
import { InteractiveTour } from './components/InteractiveTour';
import { Bot, Mic } from 'lucide-react';

import { 
  UserProfile, 
  WorkoutPlan, 
  WorkoutRecord, 
  FriendBattle, 
  DisciplinePenalty, 
  Achievement,
  DailyNutritionRecord,
  SleepRecord,
  FoodItem,
  PersonalRecord
} from './types';
import { 
  INITIAL_USER_PROFILE, 
  INITIAL_WORKOUT_PLANS, 
  INITIAL_PAST_WORKOUTS, 
  INITIAL_FRIEND_BATTLES, 
  INITIAL_PENALTIES, 
  INITIAL_ACHIEVEMENTS,
  INITIAL_PERSONAL_RECORDS
} from './data/initialData';
import { BASE_FOODS_DATABASE } from './data/foodsData';

export default function App() {
  // Navigation
  const [currentTab, setCurrentTab] = useState<NavTab>('workouts');

  // User Profile (Clean slate initialization check)
  const [user, setUser] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('getfit_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name === 'Александр' || parsed.telegramUsername === '@alex_fit') {
          localStorage.removeItem('getfit_user');
          localStorage.removeItem('getfit_history');
          localStorage.removeItem('getfit_plans');
          return INITIAL_USER_PROFILE;
        }
        return { ...INITIAL_USER_PROFILE, ...parsed };
      }
      return INITIAL_USER_PROFILE;
    } catch {
      return INITIAL_USER_PROFILE;
    }
  });

  // Workout Plans
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>(() => {
    try {
      const saved = localStorage.getItem('getfit_plans');
      return saved ? JSON.parse(saved) : INITIAL_WORKOUT_PLANS;
    } catch {
      return INITIAL_WORKOUT_PLANS;
    }
  });

  // Workout History
  const [pastWorkouts, setPastWorkouts] = useState<WorkoutRecord[]>(() => {
    try {
      const saved = localStorage.getItem('getfit_history');
      return saved ? JSON.parse(saved) : INITIAL_PAST_WORKOUTS;
    } catch {
      return INITIAL_PAST_WORKOUTS;
    }
  });

  // Friend Battles
  const [battles, setBattles] = useState<FriendBattle[]>(() => {
    try {
      const saved = localStorage.getItem('getfit_battles');
      return saved ? JSON.parse(saved) : INITIAL_FRIEND_BATTLES;
    } catch {
      return INITIAL_FRIEND_BATTLES;
    }
  });

  // Discipline Penalties
  const [penalties, setPenalties] = useState<DisciplinePenalty[]>(() => {
    try {
      const saved = localStorage.getItem('getfit_penalties');
      return saved ? JSON.parse(saved) : INITIAL_PENALTIES;
    } catch {
      return INITIAL_PENALTIES;
    }
  });

  // Achievements
  const [achievements, setAchievements] = useState<Achievement[]>(() => {
    try {
      const saved = localStorage.getItem('getfit_achievements');
      return saved ? JSON.parse(saved) : INITIAL_ACHIEVEMENTS;
    } catch {
      return INITIAL_ACHIEVEMENTS;
    }
  });

  // Nutrition Records
  const [dailyNutritionRecords, setDailyNutritionRecords] = useState<DailyNutritionRecord[]>(() => {
    try {
      const saved = localStorage.getItem('getfit_nutrition');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sleep Records
  const [sleepRecords, setSleepRecords] = useState<SleepRecord[]>(() => {
    try {
      const saved = localStorage.getItem('getfit_sleep');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Custom Foods
  const [customFoods, setCustomFoods] = useState<FoodItem[]>(() => {
    try {
      const saved = localStorage.getItem('getfit_custom_foods');
      return saved ? JSON.parse(saved) : BASE_FOODS_DATABASE;
    } catch {
      return BASE_FOODS_DATABASE;
    }
  });

  // Personal Records
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>(() => {
    try {
      const saved = localStorage.getItem('getfit_records');
      return saved ? JSON.parse(saved) : INITIAL_PERSONAL_RECORDS;
    } catch {
      return INITIAL_PERSONAL_RECORDS;
    }
  });

  // Saved Custom Workout Templates
  const [customTemplates, setCustomTemplates] = useState<WorkoutPlan[]>(() => {
    try {
      const saved = localStorage.getItem('getfit_custom_templates');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleSaveCustomTemplate = (template: WorkoutPlan) => {
    setCustomTemplates(prev => {
      const idx = prev.findIndex(t => t.id === template.id);
      let updated: WorkoutPlan[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = template;
      } else {
        updated = [template, ...prev];
      }
      try {
        localStorage.setItem('getfit_custom_templates', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Interactive Onboarding Tour state
  const [isTourOpen, setIsTourOpen] = useState(() => {
    try {
      const hasCompleted = localStorage.getItem('getfit_tour_completed');
      return !hasCompleted;
    } catch {
      return true;
    }
  });

  // Active workout state
  const [activeWorkoutPlan, setActiveWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [isLiveWorkoutOpen, setIsLiveWorkoutOpen] = useState(false);
  const [isGlobalAiChatOpen, setIsGlobalAiChatOpen] = useState(false);
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('getfit_user', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem('getfit_plans', JSON.stringify(workoutPlans));
  }, [workoutPlans]);

  useEffect(() => {
    localStorage.setItem('getfit_history', JSON.stringify(pastWorkouts));
  }, [pastWorkouts]);

  useEffect(() => {
    localStorage.setItem('getfit_battles', JSON.stringify(battles));
  }, [battles]);

  useEffect(() => {
    localStorage.setItem('getfit_penalties', JSON.stringify(penalties));
  }, [penalties]);

  useEffect(() => {
    localStorage.setItem('getfit_achievements', JSON.stringify(achievements));
  }, [achievements]);

  useEffect(() => {
    localStorage.setItem('getfit_nutrition', JSON.stringify(dailyNutritionRecords));
  }, [dailyNutritionRecords]);

  useEffect(() => {
    localStorage.setItem('getfit_sleep', JSON.stringify(sleepRecords));
  }, [sleepRecords]);

  useEffect(() => {
    localStorage.setItem('getfit_custom_foods', JSON.stringify(customFoods));
  }, [customFoods]);

  useEffect(() => {
    localStorage.setItem('getfit_records', JSON.stringify(personalRecords));
  }, [personalRecords]);

  // Handlers
  const handleStartPlan = (plan: WorkoutPlan) => {
    setActiveWorkoutPlan(plan);
    setIsLiveWorkoutOpen(true);
  };

  const handleStartFreeWorkout = () => {
    const freePlan: WorkoutPlan = {
      id: `free_plan_${Date.now()}`,
      title: 'Свободная тренировка',
      scheduledDay: 'Сегодня',
      estimatedDurationMinutes: 60,
      exercises: [],
    };
    setActiveWorkoutPlan(freePlan);
    setIsLiveWorkoutOpen(true);
  };

  const handleFinishLiveWorkout = (record: WorkoutRecord) => {
    setPastWorkouts(prev => [record, ...prev]);
    setActiveWorkoutPlan(null);
    setIsLiveWorkoutOpen(false);

    // Update user streak and discipline score
    setUser(prev => ({
      ...prev,
      streakDays: prev.streakDays + 1,
      disciplineScore: Math.min(100, prev.disciplineScore + 2),
      longestStreak: Math.max(prev.longestStreak, prev.streakDays + 1),
    }));

    // Unlock achievement if 100+ kg reached
    const benchEx = record.exercises?.find(e => e?.name && e.name.toLowerCase().includes('жим'));
    if (benchEx && (benchEx.best1RM ?? 0) >= 100) {
      setAchievements(prev =>
        prev.map(a =>
          a.id === 'ach_1' ? { ...a, unlocked: true, unlockedDate: 'Сегодня' } : a
        )
      );
    }

    // Switch to charts to inspect the new progressive data point
    setCurrentTab('charts');
  };

  const handleResolvePenalty = (penaltyId: string) => {
    setPenalties(prev =>
      prev.map(p => (p.id === penaltyId ? { ...p, status: 'completed' } : p))
    );
    setUser(prev => ({
      ...prev,
      disciplineScore: Math.min(100, prev.disciplineScore + 5),
    }));
  };

  const handleRescheduleWorkout = (planId: string, newDate: string, reason: string) => {
    setWorkoutPlans(prev =>
      prev.map(p => (p.id === planId ? { ...p, scheduledDay: newDate } : p))
    );
  };

  const handleApplyPenalty = (reason: string, task: string, points: number) => {
    const newPenalty: DisciplinePenalty = {
      id: `pen_${Date.now()}`,
      workoutDate: new Date().toISOString().split('T')[0],
      reason,
      penaltyTask: task,
      status: 'pending',
      date: 'Сегодня',
      pointsDeducted: points,
    };
    setPenalties(prev => [newPenalty, ...prev]);
    setUser(prev => ({
      ...prev,
      disciplineScore: Math.max(0, prev.disciplineScore - points),
    }));
  };

  const handleAddBattle = (battle: FriendBattle) => {
    setBattles(prev => [battle, ...prev]);
  };

  const handleUpdateBattleProgress = (battleId: string, amount: number) => {
    setBattles(prev =>
      prev.map(b => {
        if (b.id === battleId) {
          const newProg = b.userProgress + amount;
          return {
            ...b,
            userProgress: newProg,
            friendProgress: b.friendProgress + Math.round(amount * 0.8),
          };
        }
        return b;
      })
    );
  };

  const handleSetTargetRank = (title: string, movementId: string, goalValue: number) => {
    setUser(prev => ({
      ...prev,
      targetRankTitle: title,
    }));
    setCurrentTab('profile');
  };

  const handleAddPersonalRecord = (record: PersonalRecord) => {
    setPersonalRecords(prev => [record, ...prev]);
  };

  const handleUpdatePersonalRecord = (recordId: string, newValue: string, notes?: string) => {
    setPersonalRecords(prev =>
      prev.map(r => {
        if (r.id !== recordId) return r;
        const newHistItem = {
          id: `hist_${Date.now()}`,
          date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }),
          value: newValue,
          notes,
        };
        return {
          ...r,
          currentValue: newValue,
          history: [newHistItem, ...(r.history || [])],
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const handleShareRecordToCommunity = (_record: PersonalRecord) => {
    // Shared record placeholder
  };

  // Natural Language Interface / Voice AI Handlers
  const handleLogWorkoutFromAi = (exercise: string, weight: number, reps: number, sets = 1, rpe = 8) => {
    const oneRM = Math.round(weight * (1 + reps / 30));
    const nowIso = new Date().toISOString();
    const newRecord: WorkoutRecord = {
      id: `rec_nli_${Date.now()}`,
      title: 'ИИ-Лог (NLI / Голос)',
      date: 'Сегодня',
      startedAt: nowIso,
      completedAt: nowIso,
      durationMinutes: 45,
      totalTonnageKg: weight * reps * sets,
      status: 'completed',
      exercises: [{
        exerciseId: `ex_nli_${Date.now()}`,
        name: exercise,
        best1RM: oneRM,
        sets: Array.from({ length: sets }).map((_, i) => ({
          id: `set_nli_${Date.now()}_${i}`,
          setNumber: i + 1,
          weight,
          reps,
          rpe,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          calculated1RM: oneRM,
          normalizedRepsAt100kg: Math.max(0, Math.round(reps * (weight / 100))),
        })),
      }],
    };
    setPastWorkouts(prev => [newRecord, ...prev]);
    setUser(prev => ({
      ...prev,
      streakDays: prev.streakDays + 1,
      disciplineScore: Math.min(100, prev.disciplineScore + 2),
      longestStreak: Math.max(prev.longestStreak, prev.streakDays + 1),
    }));

    if (exercise.toLowerCase().includes('жим') && weight >= 100) {
      setAchievements(prev => prev.map(a => a.id === 'ach_1' ? { ...a, unlocked: true, unlockedDate: 'Сегодня' } : a));
    }
  };

  const handleLogMetricFromAi = (name: string, value: number, unit: string, category?: string) => {
    if (name.toLowerCase().includes('вес')) {
      setUser(prev => ({ ...prev, currentWeight: value }));
    }
    try {
      const raw = localStorage.getItem('getfit_custom_metrics');
      const list = raw ? JSON.parse(raw) : [];
      const existingIdx = list.findIndex((m: any) => m.name.toLowerCase() === name.toLowerCase());
      const nowStr = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      if (existingIdx >= 0) {
        list[existingIdx].currentValue = value;
        list[existingIdx].history = [{ id: `mh_${Date.now()}`, date: nowStr, value }, ...(list[existingIdx].history || [])];
      } else {
        list.unshift({
          id: `cm_${Date.now()}`,
          name,
          unit: unit || 'см',
          category: category || 'physical',
          currentValue: value,
          history: [{ id: `mh_${Date.now()}`, date: nowStr, value }],
        });
      }
      localStorage.setItem('getfit_custom_metrics', JSON.stringify(list));
      window.dispatchEvent(new Event('storage'));
    } catch {}
  };

  const handleLogDailyStateFromAi = (sleepHours: number, notes?: string, quality?: number) => {
    const sleepQuality = quality || (sleepHours < 6.5 ? 5 : 8);
    const feelingVal = sleepHours < 6 ? 'exhausted' : sleepHours < 7.5 ? 'normal' : sleepHours < 9 ? 'rested' : 'peak';
    const newSleep: SleepRecord = {
      id: `slp_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      bedtime: '23:30',
      wakeTime: '07:30',
      durationHours: sleepHours,
      qualityScore: sleepQuality,
      feeling: feelingVal,
      notes: notes || 'Записано через Natural Language Interface',
    };
    setSleepRecords(prev => [newSleep, ...prev]);

    const readinessScore = Math.min(100, Math.round((sleepHours / 8) * 85 + (sleepQuality / 10) * 15));
    setUser(prev => ({
      ...prev,
      dailyReadiness: {
        date: new Date().toISOString().split('T')[0],
        sleepHours,
        sleepQuality,
        readinessScore,
        overallReadinessScore: readinessScore,
        autoAdjustRecommendation: sleepHours < 6.5 
          ? 'Недосып: снизь интенсивность или RPE рабочих подходов на 5-10%.' 
          : 'Высокая готовность ЦНС: отличный день для силовых подходов!',
      },
    }));
  };

  const handleCreateExperimentFromAi = (title: string, hypothesis: string, dependentMetric?: string, independentMetrics?: string[], durationDays?: number) => {
    try {
      const raw = localStorage.getItem('getfit_experiments');
      const list = raw ? JSON.parse(raw) : [];
      const newExp = {
        id: `exp_${Date.now()}`,
        title: title || 'Новый эксперимент',
        hypothesis: hypothesis || '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + (durationDays || 21) * 86400000).toISOString().split('T')[0],
        durationDays: durationDays || 21,
        status: 'active',
        dependentMetric: { name: dependentMetric || '1ПМ Жим', unit: 'кг', type: 'performance' },
        independentMetrics: (independentMetrics || ['Креатин 5г/день']).map(m => ({ name: m, unit: 'ед', targetValue: 1, type: 'supplement' })),
        baselineValue: 'База',
        dailyLogs: {},
      };
      list.unshift(newExp);
      localStorage.setItem('getfit_experiments', JSON.stringify(list));
      fetch('/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newExp),
      }).catch(() => {});
      window.dispatchEvent(new Event('storage'));
    } catch {}
  };

  const handleResetAllData = () => {
    localStorage.clear();
    setUser(INITIAL_USER_PROFILE);
    setWorkoutPlans(INITIAL_WORKOUT_PLANS);
    setPastWorkouts(INITIAL_PAST_WORKOUTS);
    setBattles(INITIAL_FRIEND_BATTLES);
    setPenalties(INITIAL_PENALTIES);
    setAchievements(INITIAL_ACHIEVEMENTS);
    setDailyNutritionRecords([]);
    setSleepRecords([]);
    setCustomFoods(BASE_FOODS_DATABASE);
    setPersonalRecords(INITIAL_PERSONAL_RECORDS);
  };

  const pendingPenaltiesCount = penalties.filter(p => p.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#070a0d] text-slate-100 flex justify-center selection:bg-emerald-500 selection:text-slate-950 font-sans antialiased">
      {/* Mobile container constrained to 480px width (Telegram Mini App viewport standard) */}
      <div className="w-full max-w-lg min-h-screen flex flex-col bg-[#0b0f12] shadow-2xl relative border-x border-[#161f28]/60">
        
        {/* Fixed Telegram Mini App Header */}
        <TelegramHeader
          user={user}
          title="GetFitBot"
          subtitle="AI Fitness & Discipline"
          disciplineScore={user?.disciplineScore}
          streakDays={user?.streakDays}
          isWorkoutActive={Boolean(activeWorkoutPlan)}
          onOpenLiveWorkout={() => setIsLiveWorkoutOpen(true)}
          onProfileClick={() => setCurrentTab('profile')}
          onOpenAiSettings={() => setIsAiSettingsOpen(true)}
          onOpenTutorial={() => setIsTourOpen(true)}
        />

        {/* Floating banner if active workout is currently minimized */}
        {activeWorkoutPlan && !isLiveWorkoutOpen && (
          <div className="sticky top-[58px] z-20 bg-emerald-500 text-slate-950 px-4 py-2 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
              <span>Идет тренировка: {activeWorkoutPlan.title}</span>
            </div>
            <button
              onClick={() => setIsLiveWorkoutOpen(true)}
              className="bg-slate-950 text-emerald-400 text-[11px] font-bold px-2.5 py-1 rounded-lg"
            >
              Открыть чат с ИИ
            </button>
          </div>
        )}

        {/* Main Tab Content */}
        <main className="flex-1 px-3 pt-3 overflow-y-auto">
          {isLiveWorkoutOpen && activeWorkoutPlan ? (
            <AiWorkoutLive
              plan={activeWorkoutPlan}
              user={user}
              pastWorkouts={pastWorkouts}
              onFinishWorkout={handleFinishLiveWorkout}
              onClose={() => setIsLiveWorkoutOpen(false)}
              onSaveAsTemplate={handleSaveCustomTemplate}
            />
          ) : (
            <>
              {currentTab === 'workouts' && (
                <WorkoutsHub
                  plans={workoutPlans}
                  pastWorkouts={pastWorkouts}
                  onStartPlan={handleStartPlan}
                  onAddPlan={newPlan => setWorkoutPlans(prev => [...prev, newPlan])}
                  onStartFreeWorkout={handleStartFreeWorkout}
                  activeWorkoutPlan={activeWorkoutPlan}
                  onResumeActiveWorkout={() => setIsLiveWorkoutOpen(true)}
                  user={user}
                  onUpdateUser={updated => setUser(prev => ({ ...prev, ...updated }))}
                  customTemplates={customTemplates}
                  onSaveTemplate={handleSaveCustomTemplate}
                />
              )}

              {currentTab === 'nutrition' && (
                <NutritionSleepTracker
                  user={user}
                  dailyRecords={dailyNutritionRecords}
                  onUpdateDailyRecords={setDailyNutritionRecords}
                  sleepRecords={sleepRecords}
                  onUpdateSleepRecords={setSleepRecords}
                  pastWorkouts={pastWorkouts}
                  onUpdateUser={updated => setUser(prev => ({ ...prev, ...updated }))}
                  customFoods={customFoods}
                  onSaveCustomFood={newFood => {
                    setCustomFoods(prev => {
                      const idx = prev.findIndex(f => f.id === newFood.id || f.name.toLowerCase() === newFood.name.toLowerCase());
                      if (idx >= 0) {
                        const cp = [...prev];
                        cp[idx] = newFood;
                        return cp;
                      }
                      return [newFood, ...prev];
                    });
                  }}
                />
              )}

              {currentTab === 'charts' && (
                <ProgressCharts pastWorkouts={pastWorkouts} user={user} />
              )}

              {currentTab === 'ranks' && (
                <SportsRanks
                  user={user}
                  onSetTargetRank={handleSetTargetRank}
                />
              )}

              {currentTab === 'battles' && (
                <FriendBattles
                  battles={battles}
                  onAddBattle={handleAddBattle}
                  onUpdateProgress={handleUpdateBattleProgress}
                  user={user}
                  workoutPlans={workoutPlans}
                  onUpdateUser={updated => setUser(prev => ({ ...prev, ...updated }))}
                />
              )}

              {currentTab === 'discipline' && (
                <DisciplineTracker
                  user={user}
                  penalties={penalties}
                  workoutPlans={workoutPlans}
                  onResolvePenalty={handleResolvePenalty}
                  onRescheduleWorkout={handleRescheduleWorkout}
                  onApplyPenalty={handleApplyPenalty}
                  onUpdateUser={updated => setUser(prev => ({ ...prev, ...updated }))}
                />
              )}

              {currentTab === 'lab' && (
                <ResearchLabView
                  user={user}
                  pastWorkouts={pastWorkouts}
                  onUpdateUser={updated => setUser(prev => ({ ...prev, ...updated }))}
                />
              )}

              {currentTab === 'profile' && (
                <ProfileView
                  user={user}
                  achievements={achievements}
                  personalRecords={personalRecords}
                  onUpdateUser={updated => setUser(prev => ({ ...prev, ...updated }))}
                  onAddPersonalRecord={handleAddPersonalRecord}
                  onUpdatePersonalRecord={handleUpdatePersonalRecord}
                  onShareRecordToCommunity={handleShareRecordToCommunity}
                  onResetAllData={handleResetAllData}
                  battles={battles}
                  onAddBattle={handleAddBattle}
                  onUpdateBattleProgress={handleUpdateBattleProgress}
                  onOpenAiSettings={() => setIsAiSettingsOpen(true)}
                />
              )}
            </>
          )}
        </main>

        {/* Global Floating AI Concierge / NLI Button (when live workout is not actively taking over) */}
        {!isLiveWorkoutOpen && (
          <button
            onClick={() => setIsGlobalAiChatOpen(true)}
            className="fixed bottom-[72px] right-4 sm:right-[max(1rem,calc(50%-224px))] z-30 h-12 px-3.5 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 text-slate-950 flex items-center gap-2 shadow-xl shadow-emerald-500/25 hover:scale-105 active:scale-95 transition-all border border-emerald-300/40 group"
            title="Голосовой и текстовый ввод тренировок, метрик и сна"
          >
            <div className="relative">
              <Bot className="w-5 h-5 group-hover:rotate-6 transition-transform text-slate-950" />
              <Mic className="w-3 h-3 text-slate-950 absolute -bottom-1 -right-1" />
            </div>
            <span className="text-xs font-bold tracking-tight hidden sm:inline text-slate-950">ИИ-Логгер</span>
            <span className="w-2 h-2 rounded-full bg-slate-950 animate-pulse" />
          </button>
        )}

        {/* Global AI Chat / Natural Language Interface Modal */}
        <GlobalAiChatModal
          isOpen={isGlobalAiChatOpen}
          onClose={() => setIsGlobalAiChatOpen(false)}
          user={user}
          onUpdateUser={updated => setUser(prev => ({ ...prev, ...updated }))}
          onAddPenalty={handleApplyPenalty}
          onLogWorkout={handleLogWorkoutFromAi}
          onLogMetric={handleLogMetricFromAi}
          onLogDailyState={handleLogDailyStateFromAi}
          onCreateExperiment={handleCreateExperimentFromAi}
        />

        {/* AI Brain & Personal Prompt Settings Modal */}
        <AiSettingsModal
          isOpen={isAiSettingsOpen}
          onClose={() => setIsAiSettingsOpen(false)}
          user={user}
          onUpdateUser={updated => setUser(prev => ({ ...prev, ...updated }))}
        />

        {/* Interactive Onboarding First-Time User Guide & Help Tour */}
        <InteractiveTour
          isOpen={isTourOpen}
          onClose={() => {
            setIsTourOpen(false);
            try {
              localStorage.setItem('getfit_tour_completed', 'true');
            } catch {}
          }}
          onNavigateTab={(tab) => {
            setIsLiveWorkoutOpen(false);
            setCurrentTab(tab);
          }}
          onOpenAiSettings={() => {
            setIsTourOpen(false);
            setIsAiSettingsOpen(true);
          }}
        />

        {/* Fixed Bottom Navigation */}
        <Navigation
          currentTab={currentTab}
          onChangeTab={tab => {
            setIsLiveWorkoutOpen(false);
            setCurrentTab(tab);
          }}
          pendingPenaltiesCount={pendingPenaltiesCount}
        />
      </div>
    </div>
  );
}
