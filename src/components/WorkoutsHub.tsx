import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Dumbbell, 
  Clock, 
  Plus, 
  ChevronRight, 
  History, 
  Calendar, 
  Sparkles, 
  Flame,
  CheckCircle2,
  ChevronDown,
  Search,
  Filter,
  Zap,
  Trophy,
  HeartPulse,
  Layers,
  Edit3
} from 'lucide-react';
import { WorkoutPlan, WorkoutRecord, UserProfile, DailyReadiness } from '../types';
import { MarathonsView } from './MarathonsView';
import { DailyReadinessModal } from './DailyReadinessModal';
import { WorkoutTemplateModal } from './WorkoutTemplateModal';
import { SavedTemplatesModal } from './SavedTemplatesModal';

interface WorkoutsHubProps {
  plans: WorkoutPlan[];
  pastWorkouts: WorkoutRecord[];
  onStartPlan: (plan: WorkoutPlan) => void;
  onAddPlan: (plan: WorkoutPlan) => void;
  onStartFreeWorkout: () => void;
  activeWorkoutPlan: WorkoutPlan | null;
  onResumeActiveWorkout: () => void;
  user?: UserProfile;
  onUpdateUser?: (updated: Partial<UserProfile>) => void;
  customTemplates?: WorkoutPlan[];
  onSaveTemplate?: (template: WorkoutPlan) => void;
}

export const WorkoutsHub: React.FC<WorkoutsHubProps> = ({
  plans,
  pastWorkouts,
  onStartPlan,
  onAddPlan,
  onStartFreeWorkout,
  activeWorkoutPlan,
  onResumeActiveWorkout,
  user,
  onUpdateUser,
  customTemplates,
  onSaveTemplate,
}) => {
  const [subTab, setSubTab] = useState<'workouts' | 'marathons'>('workouts');
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [showReadinessModal, setShowReadinessModal] = useState(false);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [historyMonthFilter, setHistoryMonthFilter] = useState('all');

  // Daily readiness state
  const [todayReadiness, setTodayReadiness] = useState<DailyReadiness | null>(() => {
    try {
      const saved = localStorage.getItem('getfit_today_readiness');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Saved Custom Workout Templates
  const [savedTemplates, setSavedTemplates] = useState<WorkoutPlan[]>(() => {
    if (customTemplates && customTemplates.length > 0) return customTemplates;
    try {
      const saved = localStorage.getItem('getfit_custom_templates');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: 'tmpl_base_power',
        title: 'Тройка лифтера (Жим, Присед, Тяга)',
        scheduledDay: 'Понедельник',
        estimatedDurationMinutes: 75,
        isCustomTemplate: true,
        createdAt: new Date().toISOString(),
        exercises: [
          { id: 't1_1', name: 'Жим штанги лежа', targetWeight: 100, targetSets: 4, targetReps: 8, restMinutes: 3, restBetweenExercisesMinutes: 4, muscleGroup: 'chest' },
          { id: 't1_2', name: 'Приседания со штангой', targetWeight: 120, targetSets: 4, targetReps: 6, restMinutes: 3.5, restBetweenExercisesMinutes: 4, muscleGroup: 'legs' },
          { id: 't1_3', name: 'Становая тяга (классика)', targetWeight: 140, targetSets: 3, targetReps: 5, restMinutes: 4, restBetweenExercisesMinutes: 3, muscleGroup: 'back' },
        ],
      },
      {
        id: 'tmpl_volume_upper',
        title: 'Верх тела: Спина & Брусья',
        scheduledDay: 'Среда',
        estimatedDurationMinutes: 60,
        isCustomTemplate: true,
        createdAt: new Date().toISOString(),
        exercises: [
          { id: 't2_1', name: 'Подтягивания с весом', targetWeight: 16, targetSets: 4, targetReps: 8, restMinutes: 2.5, restBetweenExercisesMinutes: 3, muscleGroup: 'back' },
          { id: 't2_2', name: 'Отжимания на брусьях с весом', targetWeight: 24, targetSets: 4, targetReps: 10, restMinutes: 2.5, restBetweenExercisesMinutes: 3, muscleGroup: 'chest' },
          { id: 't2_3', name: 'Армейский жим стоя', targetWeight: 55, targetSets: 4, targetReps: 8, restMinutes: 2.5, restBetweenExercisesMinutes: 2, muscleGroup: 'shoulders' },
        ],
      },
    ];
  });

  // Sync external customTemplates if updated
  useEffect(() => {
    if (customTemplates && customTemplates.length > 0) {
      setSavedTemplates(customTemplates);
    }
  }, [customTemplates]);

  const persistTemplates = (updated: WorkoutPlan[]) => {
    setSavedTemplates(updated);
    try {
      localStorage.setItem('getfit_custom_templates', JSON.stringify(updated));
    } catch {}
  };

  const [showTemplateBuilderModal, setShowTemplateBuilderModal] = useState(false);
  const [showSavedTemplatesModal, setShowSavedTemplatesModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkoutPlan | null>(null);

  const handleSaveTemplateFromBuilder = (template: WorkoutPlan) => {
    const existingIdx = savedTemplates.findIndex(t => t.id === template.id);
    let updated: WorkoutPlan[];
    if (existingIdx >= 0) {
      updated = [...savedTemplates];
      updated[existingIdx] = template;
    } else {
      updated = [template, ...savedTemplates];
    }
    persistTemplates(updated);
    if (onSaveTemplate) onSaveTemplate(template);
    setShowTemplateBuilderModal(false);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (id: string) => {
    const updated = savedTemplates.filter(t => t.id !== id);
    persistTemplates(updated);
  };

  const handleDuplicateTemplate = (template: WorkoutPlan) => {
    const duplicated: WorkoutPlan = {
      ...template,
      id: `tmpl_${Date.now()}`,
      title: `${template.title} (Копия)`,
      createdAt: new Date().toISOString(),
    };
    const updated = [duplicated, ...savedTemplates];
    persistTemplates(updated);
  };

  const handleEditTemplate = (template: WorkoutPlan) => {
    setEditingTemplate(template);
    setShowSavedTemplatesModal(false);
    setShowTemplateBuilderModal(true);
  };

  // New plan modal state
  const [newTitle, setNewTitle] = useState('');
  const [newDay, setNewDay] = useState('Понедельник');
  const [newExercises, setNewExercises] = useState<Array<{
    id: string;
    name: string;
    targetWeight: number;
    targetSets: number;
    targetReps: number;
    restMinutes: number;
  }>>([
    {
      id: 'ex_init_1',
      name: 'Жим штанги лежа',
      targetWeight: 100,
      targetSets: 4,
      targetReps: 10,
      restMinutes: 4,
    },
  ]);

  const todayPlan = plans[0] || null;

  const handleAddExerciseToPlan = () => {
    setNewExercises(prev => [
      ...prev,
      {
        id: `ex_${Date.now()}_${prev.length + 1}`,
        name: '',
        targetWeight: 60,
        targetSets: 3,
        targetReps: 10,
        restMinutes: 3,
      },
    ]);
  };

  const handleRemoveExerciseFromPlan = (index: number) => {
    if (newExercises.length <= 1) return;
    setNewExercises(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateExercise = (index: number, field: string, val: any) => {
    setNewExercises(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleCreatePlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const validExercises = newExercises
      .filter(ex => ex.name.trim().length > 0)
      .map((ex, idx) => ({
        id: `ex_${Date.now()}_${idx + 1}`,
        name: ex.name.trim(),
        targetSets: ex.targetSets || 3,
        targetReps: ex.targetReps || 10,
        targetWeight: ex.targetWeight || 0,
        restMinutes: ex.restMinutes || 3,
      }));

    if (validExercises.length === 0) return;

    const newPlan: WorkoutPlan = {
      id: `plan_${Date.now()}`,
      title: newTitle.trim(),
      scheduledDay: newDay,
      estimatedDurationMinutes: validExercises.length * 15,
      exercises: validExercises,
    };

    onAddPlan(newPlan);
    setShowNewPlanModal(false);
    setNewTitle('');
    setNewExercises([
      {
        id: 'ex_init_1',
        name: 'Жим штанги лежа',
        targetWeight: 100,
        targetSets: 4,
        targetReps: 10,
        restMinutes: 4,
      },
    ]);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Sub tabs: Тренировки & Планы vs Марафоны целей */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-[#101720] rounded-2xl border border-[#1e2c3c]">
        <button
          onClick={() => setSubTab('workouts')}
          className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
            subTab === 'workouts'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Dumbbell className="w-4 h-4" />
          <span>Тренировки & Планы</span>
        </button>
        <button
          onClick={() => setSubTab('marathons')}
          className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
            subTab === 'marathons'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Марафоны целей</span>
        </button>
      </div>

      {subTab === 'marathons' ? (
        <MarathonsView user={user} onUpdateUser={onUpdateUser} />
      ) : (
        <>
          {/* Disciplinary Marathons banner (Screenshot 4) */}
          <button
            onClick={() => setSubTab('marathons')}
            className="w-full bg-gradient-to-r from-[#101c27] via-[#0d1620] to-[#121c27] hover:border-emerald-500/50 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center justify-between text-left transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-100">Дисциплинарные Марафоны</h4>
                  <span className="text-[9px] uppercase font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                    Челленджи
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Устраивай марафоны шагов или упражнений и переноси остатки в копилку
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </button>

          {/* Widget: Recommendation for Today (Smart RPE & Autoregulation) */}
          <div id="tour-readiness-card" className="bg-gradient-to-br from-[#121f2b] via-[#0d1620] to-[#14232c] border border-cyan-500/40 rounded-2xl p-4 shadow-lg shadow-cyan-950/20">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <HeartPulse className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold text-slate-100">Рекомендация на сегодня</h3>
                    <span className="text-[9px] uppercase font-bold text-cyan-400 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-500/30 font-mono">
                      Smart RPE
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Авторегуляция весов под сон, стресс и боль в теле
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowReadinessModal(true)}
                className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition-all shrink-0"
              >
                {todayReadiness ? 'Изменить' : 'Оценить'}
              </button>
            </div>

            {todayReadiness ? (
              <div className="mt-3 pt-3 border-t border-[#1c2a38] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="font-mono text-sm font-extrabold text-cyan-400">
                      {todayReadiness.readinessScore ?? todayReadiness.overallReadinessScore ?? 75}%
                    </span>
                    <span className="text-[11px]">
                      {(todayReadiness.readinessScore ?? todayReadiness.overallReadinessScore ?? 75) >= 80 ? '🔥 Высокая готовность к рекордам' : (todayReadiness.readinessScore ?? todayReadiness.overallReadinessScore ?? 75) >= 60 ? '⚡ Рабочее состояние' : '🛡️ Сниженное восстановление'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Сон: {todayReadiness.sleepHours}ч
                  </span>
                </div>

                {(todayReadiness.rpeAdjustmentRecommendation || todayReadiness.autoAdjustRecommendation) && (
                  <div className="bg-[#0b1117] p-2.5 rounded-xl border border-cyan-500/30 text-[11px] text-cyan-200 leading-relaxed font-sans">
                    💡 <span className="font-semibold text-white">ИИ-Авторегуляция:</span> {todayReadiness.rpeAdjustmentRecommendation || todayReadiness.autoAdjustRecommendation}
                  </div>
                )}

                {todayReadiness.painAreas && todayReadiness.painAreas.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-400">
                    <span className="text-slate-400">Внимание на суставы/зоны:</span>
                    <span className="font-semibold">
                      {todayReadiness.painAreas.map((p: any) => typeof p === 'string' ? p : `${p.area} (${p.level}/10)`).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 pt-3 border-t border-[#1c2a38] flex items-center justify-between">
                <p className="text-[11px] text-slate-300 leading-snug">
                  Заполни сон и самочувствие (30 сек) — ИИ точно скорректирует рабочие веса и RPE!
                </p>
                <button
                  onClick={() => setShowReadinessModal(true)}
                  className="ml-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-bold text-xs shrink-0 active:scale-95 transition-all shadow-sm"
                >
                  ⚡ Пройти чек-ап
                </button>
              </div>
            )}
          </div>

          {/* Active Workout in progress banner (if any) */}
          {activeWorkoutPlan && (
            <div className="bg-gradient-to-r from-emerald-950 via-[#132223] to-[#0f171d] border-2 border-emerald-400/80 rounded-2xl p-4 shadow-lg shadow-emerald-500/10">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400">
                      Тренировка в процессе
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-100 mt-0.5">{activeWorkoutPlan.title}</h3>
                  <p className="text-xs text-slate-300 mt-0.5">ИИ-секундант и таймер активны</p>
                </div>

                <button
                  onClick={onResumeActiveWorkout}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-transform active:scale-95"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Вернуться</span>
                </button>
              </div>
            </div>
          )}

          {/* Free Workout (Ad-hoc) Hero Action Card */}
          {!activeWorkoutPlan && (
            <div id="tour-quick-workout-card" className="bg-gradient-to-br from-[#111b24] via-[#0d151c] to-[#121f28] border border-emerald-500/40 rounded-2xl p-4 shadow-lg shadow-emerald-500/10">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">Свободная тренировка без плана</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      Жми старт и пиши в чат (напр. «жим 100 на 10», «брусья 60кг»). ИИ всё распознает, засечет таймер и сравнит с прошлым разом!
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <button
                  id="tour-quick-workout-btn"
                  onClick={onStartFreeWorkout}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-emerald-500/25 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Быстрый старт</span>
                </button>
              </div>
            </div>
          )}

      {/* Featured Today's Planned Workout Card */}
      {todayPlan && !activeWorkoutPlan && (
        <div className="bg-gradient-to-br from-[#121c27] via-[#0d141d] to-[#131a22] border border-emerald-500/40 rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono font-semibold">
                <Calendar className="w-3.5 h-3.5" />
                <span>План на сегодня ({todayPlan.scheduledDay})</span>
              </div>
              <h3 className="text-lg font-bold text-slate-100 mt-1">{todayPlan.title}</h3>
            </div>

            <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-semibold">
              ~{todayPlan.estimatedDurationMinutes} мин
            </span>
          </div>

          {/* Exercises summary pills */}
          <div className="mt-3 space-y-1.5">
            {todayPlan?.exercises && todayPlan.exercises.map(ex => (
              <div
                key={ex.id}
                className="bg-[#151f2b] px-3 py-2 rounded-xl flex items-center justify-between text-xs border border-[#202d3d]"
              >
                <span className="font-semibold text-slate-200">{ex?.name || 'Упражнение'}</span>
                <span className="text-emerald-400 font-mono font-bold">
                  {ex.targetSets} × {ex.targetWeight} кг × {ex.targetReps} (отдых {ex.restMinutes}м)
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => onStartPlan(todayPlan)}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Начать тренировку с ИИ-тренером</span>
            </button>
          </div>
        </div>
      )}

      {/* Workout Templates Hub Section (Custom Builder & Saved Library) */}
      <div id="tour-templates-block" className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Шаблоны тренировок</span>
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {savedTemplates.length} {savedTemplates.length === 1 ? 'шаблон' : savedTemplates.length >= 2 && savedTemplates.length <= 4 ? 'шаблона' : 'шаблонов'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Create Template */}
          <button
            id="tour-create-template-btn"
            type="button"
            onClick={() => {
              setEditingTemplate(null);
              setShowTemplateBuilderModal(true);
            }}
            className="bg-gradient-to-br from-[#12201d] via-[#0e171b] to-[#142323] hover:from-[#172b27] hover:to-[#1a2e2e] border-2 border-emerald-500/50 hover:border-emerald-400 rounded-2xl p-3.5 text-left transition-all active:scale-[0.98] shadow-lg shadow-emerald-950/20 flex flex-col justify-between group"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform mb-2">
                <Plus className="w-5 h-5 stroke-[2.5]" />
              </div>
              <h4 className="text-sm font-bold text-slate-100 group-hover:text-emerald-300 transition-colors">
                Создать шаблон
              </h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                Конструктор по группам мышц, очереди, подходам и отдыху
              </p>
            </div>
            <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-emerald-400">
              <span>Собрать</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* Saved Templates */}
          <button
            id="tour-saved-templates-btn"
            type="button"
            onClick={() => setShowSavedTemplatesModal(true)}
            className="bg-gradient-to-br from-[#121c27] via-[#0d151e] to-[#151f2b] hover:from-[#182635] hover:to-[#1c293a] border border-[#233348] hover:border-cyan-400/60 rounded-2xl p-3.5 text-left transition-all active:scale-[0.98] shadow-lg shadow-cyan-950/20 flex flex-col justify-between group"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform mb-2">
                <Layers className="w-5 h-5" />
              </div>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                  Мои шаблоны
                </h4>
                <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-500/30">
                  {savedTemplates.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                Библиотека шаблонов, запуск и быстрое дублирование
              </p>
            </div>
            <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-cyan-400">
              <span>Открыть</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </button>
        </div>
      </div>

      {/* Plans Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Расписание тренировок ({plans.length})
          </span>
          <button
            onClick={() => setShowNewPlanModal(true)}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Новый план</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {plans.map(plan => (
            <div
              key={plan.id}
              className="bg-[#12181f] border border-[#1e293b] rounded-xl p-3.5 flex items-center justify-between hover:border-[#2b3a4e] transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {plan.scheduledDay}
                  </span>
                  <span className="text-xs font-bold text-slate-100">{plan.title}</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {plan.exercises?.length || 0} упражн.: {(plan.exercises || []).map(e => e?.name || '').filter(Boolean).join(', ')}
                </div>
              </div>

              <button
                onClick={() => onStartPlan(plan)}
                className="p-2 rounded-lg bg-[#18232f] hover:bg-emerald-500 hover:text-slate-950 text-slate-300 transition-all"
                title="Начать тренировку"
              >
                <Play className="w-4 h-4 fill-current" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* History of Completed Workouts */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            История тренировок ({pastWorkouts.length})
          </span>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <History className="w-3.5 h-3.5 text-emerald-400" />
            <span>Все зафиксировано ИИ</span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        {pastWorkouts.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2 bg-[#101720] p-2.5 rounded-xl border border-[#1d2938]">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Поиск по названию или упражнению..."
                className="w-full bg-[#16212d] border border-[#233345] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={historyMonthFilter}
                onChange={e => setHistoryMonthFilter(e.target.value)}
                aria-label="Фильтр по месяцу"
                className="bg-[#16212d] border border-[#233345] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">Все месяцы</option>
                {Array.from(new Set(pastWorkouts.map(w => new Date(w.startedAt).toISOString().slice(0, 7)))).map(m => {
                  const date = new Date(`${m}-01`);
                  const label = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
                  return (
                    <option key={m} value={m}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        )}

        {pastWorkouts.length === 0 ? (
          <div className="bg-[#12181f] border border-[#1e293b] rounded-xl p-6 text-center text-xs text-slate-400">
            История пуста. Начни свою первую тренировку выше!
          </div>
        ) : pastWorkouts.filter(rec => {
            const matchesSearch = !historySearch.trim() || 
              rec.title.toLowerCase().includes(historySearch.toLowerCase()) ||
              rec.exercises.some(ex => ex.name.toLowerCase().includes(historySearch.toLowerCase()));
            if (!matchesSearch) return false;
            if (historyMonthFilter === 'all') return true;
            return new Date(rec.startedAt).toISOString().slice(0, 7) === historyMonthFilter;
          }).length === 0 ? (
          <div className="bg-[#12181f] border border-[#1e293b] rounded-xl p-4 text-center text-xs text-slate-400">
            Ничего не найдено по вашему фильтру. Попробуйте изменить запрос.
          </div>
        ) : (
          <div className="space-y-2.5">
            {pastWorkouts.filter(rec => {
              const matchesSearch = !historySearch.trim() || 
                rec.title.toLowerCase().includes(historySearch.toLowerCase()) ||
                rec.exercises.some(ex => ex.name.toLowerCase().includes(historySearch.toLowerCase()));
              if (!matchesSearch) return false;
              if (historyMonthFilter === 'all') return true;
              return new Date(rec.startedAt).toISOString().slice(0, 7) === historyMonthFilter;
            }).map(rec => {
              const isExpanded = expandedRecordId === rec.id;
              return (
                <div
                  key={rec.id}
                  className="bg-[#12181f] border border-[#1e293b] rounded-xl overflow-hidden transition-colors"
                >
                  <div
                    onClick={() => setExpandedRecordId(isExpanded ? null : rec.id)}
                    className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-[#151e28]"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-slate-100">{rec.title}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 font-mono flex items-center gap-2">
                        <span>
                          {new Date(rec.startedAt).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                          })}
                        </span>
                        <span>•</span>
                        <span>{rec.durationMinutes} мин</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-bold">{rec.totalTonnageKg} кг тоннаж</span>
                      </div>
                    </div>

                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </div>

                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 pt-1 border-t border-[#1b2532] bg-[#0d141c] space-y-3 text-xs">
                      {/* Comparative Table if stored */}
                      {rec.comparisons && rec.comparisons.length > 0 && (
                        <div className="bg-[#121921] border border-emerald-500/30 rounded-xl p-2.5 space-y-2">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                            Сравнительная таблица с прошлым разом
                          </span>
                          <div className="space-y-1.5">
                            {rec.comparisons.map((c, idx) => (
                              <div key={idx} className="bg-[#0b1016] p-2 rounded-lg border border-[#1d2734] text-[11px]">
                                <div className="flex items-center justify-between font-bold text-slate-200">
                                  <span>{c.exerciseName}</span>
                                  <span className="text-emerald-400 font-mono text-[10px]">{c.summaryVerdict}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-1 font-mono text-[10px]">
                                  <div className="text-slate-400">
                                    Было: {c.previousWeight > 0 ? `${c.previousWeight}кг (${c.previousSetsReps.join('/')})` : 'Первый раз'}
                                  </div>
                                  <div className="text-emerald-300 font-semibold text-right">
                                    Стало: {c.currentWeight}кг ({c.currentSetsReps.join('/')})
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {rec.exercises.map(ex => (
                        <div key={ex.exerciseId} className="space-y-1">
                          <div className="flex items-center justify-between text-slate-300 font-semibold">
                            <span>{ex.name}</span>
                            <span className="text-emerald-400 font-mono text-[11px]">
                              1ПМ: {ex.best1RM} кг
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                            {ex.sets.map(s => (
                              <span
                                key={s.id}
                                className="bg-[#141d27] border border-[#223040] px-2 py-0.5 rounded text-slate-200"
                              >
                                {s.weight}кг×{s.reps}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      </>
      )}

      {/* Modal for adding custom workout plan */}
      {showNewPlanModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12181f] border border-[#253342] rounded-2xl p-4 max-w-md w-full max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-emerald-400" />
                <span>Новый план тренировки</span>
              </h3>
              <button
                onClick={() => setShowNewPlanModal(false)}
                className="text-slate-400 hover:text-slate-200 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePlanSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Название тренировки:
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Спина & Бицепс (Тяговый день)"
                  required
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  День недели:
                </label>
                <select
                  value={newDay}
                  onChange={e => setNewDay(e.target.value)}
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Понедельник">Понедельник</option>
                  <option value="Вторник">Вторник</option>
                  <option value="Среда">Среда</option>
                  <option value="Четверг">Четверг</option>
                  <option value="Пятница">Пятница</option>
                  <option value="Суббота">Суббота</option>
                  <option value="Воскресенье">Воскресенье</option>
                </select>
              </div>

              {/* Dynamic Exercises List */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-slate-400 uppercase font-bold block">
                    Упражнения в плане ({newExercises.length}):
                  </label>
                  <button
                    type="button"
                    onClick={handleAddExerciseToPlan}
                    className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Добавить упражнение</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {newExercises.map((ex, idx) => (
                    <div
                      key={ex.id || idx}
                      className="bg-[#0e141a] border border-[#212f3e] rounded-xl p-3 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-400">
                          #{idx + 1} Упражнение
                        </span>
                        {newExercises.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveExerciseFromPlan(idx)}
                            className="text-rose-400 hover:text-rose-300 text-xs font-semibold"
                          >
                            Удалить
                          </button>
                        )}
                      </div>

                      <div>
                        <input
                          type="text"
                          value={ex.name}
                          onChange={e => handleUpdateExercise(idx, 'name', e.target.value)}
                          placeholder="Название (жим, подтягивания...)"
                          required
                          className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[9px] text-slate-400 uppercase font-bold block mb-0.5">
                            Вес (кг)
                          </label>
                          <input
                            type="number"
                            value={ex.targetWeight || 0}
                            onChange={e => handleUpdateExercise(idx, 'targetWeight', parseFloat(e.target.value) || 0)}
                            className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-2 py-1.5 font-mono text-center text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="text-[9px] text-slate-400 uppercase font-bold block mb-0.5">
                            Подх × Повт
                          </label>
                          <div className="flex gap-1">
                            <input
                              type="number"
                              value={ex.targetSets}
                              onChange={e => handleUpdateExercise(idx, 'targetSets', parseInt(e.target.value, 10) || 1)}
                              className="w-1/2 bg-[#18232f] border border-[#263546] rounded-xl px-1 py-1.5 font-mono text-center text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                            />
                            <input
                              type="number"
                              value={ex.targetReps}
                              onChange={e => handleUpdateExercise(idx, 'targetReps', parseInt(e.target.value, 10) || 1)}
                              className="w-1/2 bg-[#18232f] border border-[#263546] rounded-xl px-1 py-1.5 font-mono text-center text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] text-slate-400 uppercase font-bold block mb-0.5">
                            Отдых (мин)
                          </label>
                          <input
                            type="number"
                            value={ex.restMinutes}
                            onChange={e => handleUpdateExercise(idx, 'restMinutes', parseInt(e.target.value, 10) || 1)}
                            className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-2 py-1.5 font-mono text-center text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddExerciseToPlan}
                  className="w-full py-2 bg-[#16212c] hover:bg-[#1f2d3d] border border-dashed border-[#2b3c4f] rounded-xl text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Добавить еще упражнение в план</span>
                </button>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewPlanModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[#1a2430] text-slate-300 font-semibold"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-500/20"
                >
                  Сохранить план ({newExercises.filter(e => e.name.trim()).length} упр.)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Daily Readiness & Smart RPE Modal */}
      <DailyReadinessModal
        isOpen={showReadinessModal}
        onClose={() => setShowReadinessModal(false)}
        user={user}
        currentReadiness={todayReadiness || undefined}
        onSaveReadiness={(readiness) => {
          setTodayReadiness(readiness);
          try {
            localStorage.setItem('getfit_today_readiness', JSON.stringify(readiness));
          } catch {}
          setShowReadinessModal(false);
        }}
      />

      {/* Workout Template Builder Modal */}
      <WorkoutTemplateModal
        isOpen={showTemplateBuilderModal}
        onClose={() => {
          setShowTemplateBuilderModal(false);
          setEditingTemplate(null);
        }}
        initialTemplate={editingTemplate}
        onSaveTemplate={handleSaveTemplateFromBuilder}
      />

      {/* Saved Templates Library Modal */}
      <SavedTemplatesModal
        isOpen={showSavedTemplatesModal}
        onClose={() => setShowSavedTemplatesModal(false)}
        templates={savedTemplates}
        onStartTemplate={(tmpl) => {
          setShowSavedTemplatesModal(false);
          onStartPlan(tmpl);
        }}
        onEditTemplate={handleEditTemplate}
        onDeleteTemplate={handleDeleteTemplate}
        onDuplicateTemplate={handleDuplicateTemplate}
        onCreateNew={() => {
          setShowSavedTemplatesModal(false);
          setEditingTemplate(null);
          setShowTemplateBuilderModal(true);
        }}
      />
    </div>
  );
};
