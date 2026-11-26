import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Dumbbell,
  Flag,
  Play,
  Plus,
  Search,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import type { UserProfile, WorkoutPlan } from '../types';
import {
  ActiveCycle,
  CYCLE_TEMPLATES,
  CycleGoal,
  CycleLevel,
  CycleLift,
  CycleTemplate,
  calculateCycleWeight,
  cycleTemplateById,
  loadActiveCycle,
  loadCustomCycles,
  parseCustomCycle,
  saveActiveCycle,
  saveCustomCycles,
} from '../lib/cycleTemplates';

interface CycleLibraryProps {
  user: UserProfile;
  onStartPlan: (plan: WorkoutPlan) => void;
}

const GOAL_LABELS: Record<CycleGoal, string> = {
  strength: 'Сила',
  hypertrophy: 'Гипертрофия',
  powerlifting: 'Пауэрлифтинг',
  beginner: 'Новичкам',
  peaking: 'Пик',
};

const LEVEL_LABELS: Record<CycleLevel, string> = {
  beginner: 'Начальный',
  intermediate: 'Средний',
  advanced: 'Продвинутый',
};

const LIFT_LABELS: Record<CycleLift, string> = {
  squat: 'Присед',
  bench: 'Жим',
  deadlift: 'Становая',
  ohp: 'Жим стоя',
  accessory: 'Подсобка',
};

const defaultMaxes = (user: UserProfile): Partial<Record<CycleLift, number>> => {
  const manual = user.bodyProfile?.oneRepMaxKg || {};
  const body = user.currentWeight > 0 ? user.currentWeight : 75;
  return {
    squat: manual.squat || Math.round(body * 1.0 * 10) / 10,
    bench: manual.bench || Math.round(body * 0.7 * 10) / 10,
    deadlift: manual.deadlift || Math.round(body * 1.2 * 10) / 10,
    ohp: manual.ohp || manual.overhead || Math.round(body * 0.55 * 10) / 10,
  };
};

const CycleBadge: React.FC<{ children: React.ReactNode; tone?: string }> = ({ children, tone }) => (
  <span className={`rounded-md border px-1.5 py-0.5 text-[8px] font-bold ${tone || 'border-[#2b4050] bg-[#0b131a] text-slate-400'}`}>
    {children}
  </span>
);

export const CycleLibrary: React.FC<CycleLibraryProps> = ({ user, onStartPlan }) => {
  const [customCycles, setCustomCycles] = useState<CycleTemplate[]>(() => loadCustomCycles());
  const [active, setActive] = useState<ActiveCycle | null>(() => loadActiveCycle());
  const [query, setQuery] = useState('');
  const [goal, setGoal] = useState<CycleGoal | 'all'>('all');
  const [selected, setSelected] = useState<CycleTemplate | null>(null);
  const [startTemplate, setStartTemplate] = useState<CycleTemplate | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customGoal, setCustomGoal] = useState<CycleGoal>('strength');
  const [customLevel, setCustomLevel] = useState<CycleLevel>('intermediate');
  const [customDescription, setCustomDescription] = useState('');
  const [customText, setCustomText] = useState('');
  const [maxes, setMaxes] = useState<Partial<Record<CycleLift, number>>>(() => defaultMaxes(user));
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [startWeekIndex, setStartWeekIndex] = useState(0);

  useEffect(() => {
    const reload = () => {
      setActive(loadActiveCycle());
      setCustomCycles(loadCustomCycles());
    };
    window.addEventListener('getfit-cycle-updated', reload);
    return () => window.removeEventListener('getfit-cycle-updated', reload);
  }, []);

  const allTemplates = useMemo(() => [...CYCLE_TEMPLATES, ...customCycles], [customCycles]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/ё/g, 'е');
    return allTemplates.filter(item => {
      if (goal !== 'all' && item.goal !== goal) return false;
      if (!q) return true;
      return `${item.name} ${item.author} ${item.focus} ${item.description}`.toLowerCase().replace(/ё/g, 'е').includes(q);
    });
  }, [allTemplates, query, goal]);

  const activeTemplate = active ? cycleTemplateById(active.templateId, customCycles) : null;
  const activeWeek = activeTemplate && active ? activeTemplate.weeks[active.weekIndex] : null;

  const startCycle = () => {
    if (!startTemplate) return;
    const next: ActiveCycle = {
      templateId: startTemplate.id,
      startDate,
      weekIndex: startWeekIndex,
      maxes,
      completed: {},
    };
    setActive(next);
    saveActiveCycle(next);
    setStartTemplate(null);
  };

  const toggleDay = (dayId: string) => {
    if (!active) return;
    const key = `${active.weekIndex}-${dayId}`;
    const nextDone = !active.completed[key];
    const completedAt = { ...(active.completedAt || {}) };
    if (nextDone) completedAt[key] = new Date().toISOString();
    else delete completedAt[key];
    const next = {
      ...active,
      completed: { ...active.completed, [key]: nextDone },
      completedAt,
    };
    setActive(next);
    saveActiveCycle(next);
  };

  const updateActualWeight = (dayId: string, value: string) => {
    if (!active) return;
    const key = `${active.weekIndex}-${dayId}`;
    const next = {
      ...active,
      actualWeights: { ...(active.actualWeights || {}), [key]: Math.max(0, Number(value) || 0) },
    };
    setActive(next);
    saveActiveCycle(next);
  };

  const updateDayNote = (dayId: string, value: string) => {
    if (!active) return;
    const key = `${active.weekIndex}-${dayId}`;
    const next = {
      ...active,
      notes: { ...(active.notes || {}), [key]: value.slice(0, 160) },
    };
    setActive(next);
    saveActiveCycle(next);
  };

  const nextWeek = () => {
    if (!active || !activeTemplate) return;
    if (active.weekIndex >= activeTemplate.weeks.length - 1) return;
    const next = { ...active, weekIndex: active.weekIndex + 1 };
    setActive(next);
    saveActiveCycle(next);
  };

  const finishCycle = () => {
    setActive(null);
    saveActiveCycle(null);
  };

  const startDay = (template: CycleTemplate, weekIndex: number, dayIndex: number) => {
    const week = template.weeks[weekIndex];
    const day = week?.days[dayIndex];
    if (!day) return;
    try {
      localStorage.setItem(
        'getfit_pending_cycle_day',
        JSON.stringify({
          templateId: template.id,
          weekIndex,
          dayId: day.id,
          startedAt: new Date().toISOString(),
        }),
      );
    } catch {
      // ignore
    }
    const plan: WorkoutPlan = {
      id: `cycle_${template.id}_${weekIndex}_${dayIndex}_${Date.now()}`,
      title: `${template.name} · Неделя ${weekIndex + 1} · ${day.label}`,
      scheduledDay: 'Сегодня',
      estimatedDurationMinutes: Math.max(30, day.exercises.length * 12),
      exercises: day.exercises.map((exercise, index) => ({
        id: `cycle_ex_${Date.now()}_${index}`,
        name: exercise.name,
        targetSets: exercise.sets,
        targetReps: Number.parseInt(exercise.reps, 10) || 1,
        targetWeight: calculateCycleWeight(exercise.percent, exercise.lift, active?.maxes || maxes),
        restMinutes: exercise.percent && exercise.percent >= 80 ? 3 : 2,
        restBetweenExercisesMinutes: 3,
        notes: exercise.note,
      })),
    };
    onStartPlan(plan);
  };

  const createCustom = () => {
    if (!customTitle.trim()) return;
    const template = parseCustomCycle(customTitle, customGoal, customLevel, customDescription, customText);
    const next = [...customCycles, template];
    setCustomCycles(next);
    saveCustomCycles(next);
    setShowCustom(false);
    setCustomTitle('');
    setCustomDescription('');
    setCustomText('');
    setSelected(template);
  };

  const deleteCustom = (id: string) => {
    const next = customCycles.filter(item => item.id !== id);
    setCustomCycles(next);
    saveCustomCycles(next);
    if (active?.templateId === id) finishCycle();
  };

  const totalDays = activeTemplate ? activeTemplate.weeks.reduce((sum, week) => sum + week.days.length, 0) : 0;
  const doneDays = active ? Object.values(active.completed).filter(Boolean).length : 0;
  const progress = totalDays > 0 ? Math.round((doneDays / totalDays) * 100) : 0;

  return (
    <div id="tour-cycle-library" className="space-y-3">
      <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Target className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-bold text-slate-200">Библиотека циклов</span>
          </div>
          <button
            type="button"
            onClick={() => setShowCustom(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[8px] font-bold text-emerald-300"
          >
            <Plus className="h-3 w-3" />
            Свой цикл
          </button>
        </div>
        <p className="mt-1 text-[9px] leading-relaxed text-slate-500">
          Готовые популярные схемы с неделями, днями и процентами. Можно начать сразу или запланировать дату.
        </p>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            id="cycle-search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Найти цикл: Смолов, Вендлер, Шейко..."
            className="w-full rounded-xl border border-[#263a4a] bg-[#081016] py-2 pl-8 pr-2 text-[10px] font-semibold text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-500/50"
          />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setGoal('all')}
            className={`rounded-lg px-1.5 py-1 text-[8px] font-semibold ${goal === 'all' ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-500'}`}
          >
            Все
          </button>
          {(Object.keys(GOAL_LABELS) as CycleGoal[]).map(item => (
            <button
              key={item}
              type="button"
              onClick={() => setGoal(item)}
              className={`rounded-lg px-1.5 py-1 text-[8px] font-semibold ${goal === item ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-500'}`}
            >
              {GOAL_LABELS[item]}
            </button>
          ))}
        </div>
      </div>

      {active && activeTemplate && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Flag className="h-4 w-4 text-emerald-400" />
                <span className="truncate text-xs font-bold text-emerald-200">{activeTemplate.name}</span>
              </div>
              <div className="mt-0.5 text-[9px] text-slate-400">
                Неделя {active.weekIndex + 1} из {activeTemplate.weeks.length} · {active.weekIndex < activeTemplate.weeks.length - 1 ? 'в работе' : 'последняя неделя'} · {progress}% дней
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              {active.weekIndex < activeTemplate.weeks.length - 1 && (
                <button type="button" onClick={nextWeek} className="rounded-lg border border-[#2b4050] px-2 py-1 text-[8px] font-bold text-slate-300">
                  След. неделя
                </button>
              )}
              <button type="button" onClick={finishCycle} className="rounded-lg border border-rose-500/30 px-2 py-1 text-[8px] font-bold text-rose-300">
                Завершить
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-2 py-1.5 text-[8px] text-cyan-200/80">
            <Dumbbell className="h-3 w-3 shrink-0" />
            В чате можно написать: «сделал тренировку по циклу, зафиксируй» — день отметится сам.
          </div>
          <div className="mt-2 space-y-1.5">
            {activeWeek?.days.map((day, dayIndex) => {
              const key = `${active.weekIndex}-${day.id}`;
              const done = Boolean(active.completed[key]);
              return (
                <div key={day.id} className={`rounded-xl border px-2.5 py-2 ${done ? 'border-emerald-500/30 bg-emerald-500/8' : 'border-[#223442] bg-[#091117]'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <button type="button" onClick={() => toggleDay(day.id)} className="flex min-w-0 items-center gap-1.5 text-left">
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${done ? 'border-emerald-400 bg-emerald-500 text-slate-950' : 'border-[#3b4a5a]'}`}>
                        {done && <CheckCircle2 className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-bold text-slate-200">{day.label}</span>
                        <span className="block text-[8px] text-slate-500">{day.exercises.length} упражнений</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => startDay(activeTemplate, active.weekIndex, dayIndex)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-500 px-2 py-1.5 text-[8px] font-bold text-slate-950"
                    >
                      <Play className="h-2.5 w-2.5" />
                      Начать
                    </button>
                  </div>
                  <div className="mt-1 text-[8px] leading-snug text-slate-500">
                    {day.exercises.map(exercise => {
                      const weight = calculateCycleWeight(exercise.percent, exercise.lift, active.maxes);
                      return `${exercise.name} ${exercise.sets}×${exercise.reps}${weight > 0 ? ` (${weight} кг)` : ''}`;
                    }).join(' · ')}
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <label className="text-[7px] text-slate-500">
                      Внёс вес, кг
                      <input
                        type="number"
                        min={0}
                        step={2.5}
                        value={active.actualWeights?.[key] ?? ''}
                        onChange={event => updateActualWeight(day.id, event.target.value)}
                        placeholder="например 102,5"
                        className="mt-0.5 w-full rounded-lg border border-[#263546] bg-[#081016] px-2 py-1 text-[9px] font-bold text-slate-200"
                      />
                    </label>
                    <label className="text-[7px] text-slate-500">
                      Заметка
                      <input
                        value={active.notes?.[key] || ''}
                        onChange={event => updateDayNote(day.id, event.target.value)}
                        placeholder="самочувствие, техника"
                        className="mt-0.5 w-full rounded-lg border border-[#263546] bg-[#081016] px-2 py-1 text-[9px] text-slate-200"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-2">
        {filtered.map(template => (
          <button
            key={template.id}
            type="button"
            onClick={() => setSelected(template)}
            className="rounded-2xl border border-[#223442] bg-[#0b131a] p-3 text-left transition-colors hover:border-cyan-500/40"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-black text-slate-100">{template.name}</div>
                <div className="text-[8px] text-slate-500">{template.author}</div>
              </div>
              <CycleBadge tone="border-cyan-500/25 bg-cyan-500/10 text-cyan-300">{GOAL_LABELS[template.goal]}</CycleBadge>
            </div>
            <p className="mt-1 line-clamp-2 text-[8px] leading-snug text-slate-500">{template.description}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <CycleBadge>{template.weeksCount} нед.</CycleBadge>
              <CycleBadge>{template.daysPerWeek} дн/нед</CycleBadge>
              <CycleBadge>{LEVEL_LABELS[template.level]}</CycleBadge>
              {template.custom && <CycleBadge tone="border-emerald-500/25 bg-emerald-500/10 text-emerald-300">свой</CycleBadge>}
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#263a4a] bg-[#091117] px-4 py-6 text-center text-[10px] text-slate-500">
          Ничего не найдено. Сбросьте поиск или создайте свой цикл.
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="my-3 w-full max-w-md rounded-2xl border border-[#263a4a] bg-[#0d151c] p-4" onClick={event => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-black text-slate-100">{selected.name}</div>
                <div className="text-[9px] text-slate-500">{selected.author} · {GOAL_LABELS[selected.goal]} · {LEVEL_LABELS[selected.level]}</div>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-slate-400">✕</button>
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-slate-400">{selected.description}</p>
            <div className="mt-2 rounded-xl border border-[#223442] bg-[#091117] p-2.5 text-[8px] leading-relaxed text-slate-500">
              <b className="text-slate-400">Фокус:</b> {selected.focus}<br />
              <b className="text-slate-400">Инвентарь:</b> {selected.equipment}
            </div>
            {selected.warnings.length > 0 && (
              <div className="mt-2 rounded-xl border border-amber-500/25 bg-amber-500/8 p-2.5 text-[8px] leading-relaxed text-amber-200/80">
                <b>Важно:</b> {selected.warnings.join(' ')}
              </div>
            )}
            <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
              {selected.weeks.map((week, weekIndex) => (
                <details key={week.id} className="group rounded-xl border border-[#223442] bg-[#0b131a] px-2.5 py-2" open={weekIndex === 0}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[9px] font-bold text-slate-300">
                    {week.label}
                    <ChevronDown className="h-3 w-3 text-slate-500 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-1 space-y-1.5">
                    {week.days.map((day, dayIndex) => (
                      <div key={day.id} className="rounded-lg border border-[#1f303d] bg-[#091117] p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[8px] font-bold text-slate-300">{day.label}</span>
                          <button type="button" onClick={() => { setStartTemplate(selected); setSelected(null); setMaxes(defaultMaxes(user)); setStartWeekIndex(weekIndex); }} className="text-[8px] font-bold text-emerald-300">С этой недели</button>
                        </div>
                        <div className="mt-1 space-y-0.5">
                          {day.exercises.map((exercise, exerciseIndex) => (
                            <div key={`${day.id}-${exerciseIndex}`} className="flex items-center justify-between gap-2 text-[8px] text-slate-500">
                              <span className="truncate">{exercise.name}</span>
                              <span className="shrink-0 font-mono text-slate-400">
                                {exercise.sets}×{exercise.reps}{exercise.percent ? ` · ${exercise.percent}%` : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => { setStartTemplate(selected); setSelected(null); setMaxes(defaultMaxes(user)); setStartWeekIndex(0); }} className="flex-1 rounded-xl bg-emerald-500 py-2 text-[10px] font-bold text-slate-950">
                Начать / запланировать
              </button>
              {selected.custom && (
                <button type="button" onClick={() => { deleteCustom(selected.id); setSelected(null); }} className="rounded-xl border border-rose-500/30 px-2.5 py-2 text-[9px] font-bold text-rose-300">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
            <p className="mt-1.5 text-[8px] leading-relaxed text-slate-600">{selected.source}</p>
          </div>
        </div>
      )}

      {startTemplate && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm">
          <div className="my-3 w-full max-w-md rounded-2xl border border-emerald-500/30 bg-[#0d151c] p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-100">Старт цикла</div>
                <div className="text-[9px] text-slate-500">{startTemplate.name}</div>
              </div>
              <button type="button" onClick={() => setStartTemplate(null)} className="text-slate-400">✕</button>
            </div>
            <label className="mt-2 block text-[9px] text-slate-500">
              Дата старта
              <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="mt-1 w-full rounded-xl border border-[#263a4a] bg-[#081016] px-2.5 py-2 text-[10px] text-slate-200" />
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(Object.keys(LIFT_LABELS) as CycleLift[]).filter(lift => lift !== 'accessory').map(lift => (
                <label key={lift} className="block text-[9px] text-slate-500">
                  {LIFT_LABELS[lift]}, 1ПМ
                  <input
                    type="number"
                    min={0}
                    step={2.5}
                    value={maxes[lift] ?? 0}
                    onChange={event => setMaxes(prev => ({ ...prev, [lift]: Math.max(0, Number(event.target.value) || 0) }))}
                    className="mt-1 w-full rounded-xl border border-[#263a4a] bg-[#081016] px-2.5 py-2 text-[10px] font-bold text-slate-200"
                  />
                </label>
              ))}
            </div>
            <p className="mt-2 text-[8px] leading-relaxed text-slate-500">
              Веса рассчитываются от 1ПМ и процентов. Если не знаете 1ПМ, начните с комфортных весов и правьте вручную.
            </p>
            <button type="button" onClick={startCycle} className="mt-2 w-full rounded-xl bg-emerald-500 py-2.5 text-[10px] font-bold text-slate-950">
              Запустить цикл
            </button>
          </div>
        </div>
      )}

      {showCustom && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm">
          <div className="my-3 w-full max-w-md rounded-2xl border border-[#263a4a] bg-[#0d151c] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
                <Plus className="h-3.5 w-3.5 text-emerald-400" />
                Свой цикл
              </div>
              <button type="button" onClick={() => setShowCustom(false)} className="text-slate-400">✕</button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="col-span-2 text-[9px] text-slate-500">
                Название
                <input value={customTitle} onChange={event => setCustomTitle(event.target.value)} placeholder="Например: Мой жим 6 недель" className="mt-1 w-full rounded-xl border border-[#263a4a] bg-[#081016] px-2.5 py-2 text-[10px] text-slate-200" />
              </label>
              <label className="text-[9px] text-slate-500">
                Цель
                <select value={customGoal} onChange={event => setCustomGoal(event.target.value as CycleGoal)} className="mt-1 w-full rounded-xl border border-[#263a4a] bg-[#081016] px-2 py-2 text-[10px] text-slate-200">
                  {(Object.keys(GOAL_LABELS) as CycleGoal[]).map(item => <option key={item} value={item}>{GOAL_LABELS[item]}</option>)}
                </select>
              </label>
              <label className="text-[9px] text-slate-500">
                Уровень
                <select value={customLevel} onChange={event => setCustomLevel(event.target.value as CycleLevel)} className="mt-1 w-full rounded-xl border border-[#263a4a] bg-[#081016] px-2 py-2 text-[10px] text-slate-200">
                  {(Object.keys(LEVEL_LABELS) as CycleLevel[]).map(item => <option key={item} value={item}>{LEVEL_LABELS[item]}</option>)}
                </select>
              </label>
              <label className="col-span-2 text-[9px] text-slate-500">
                Программа по дням
                <textarea
                  rows={6}
                  value={customText}
                  onChange={event => setCustomText(event.target.value)}
                  placeholder={'Формат: Неделя 1 | День 1 | Присед 5x5 70%\nНеделя 1 | День 2 | Жим 4x8 65%\nНеделя 2 | День 1 | Присед 5x4 75%'}
                  className="mt-1 w-full resize-none rounded-xl border border-[#263a4a] bg-[#081016] px-2.5 py-2 text-[9px] leading-relaxed text-slate-200 placeholder:text-slate-600"
                />
              </label>
              <p className="col-span-2 text-[8px] leading-relaxed text-slate-500">
                Каждая строка — одно упражнение. Проценты считаются от 1ПМ, вес можно поправить при запуске.
              </p>
            </div>
            <button type="button" onClick={createCustom} disabled={!customTitle.trim()} className="mt-2 w-full rounded-xl bg-emerald-500 py-2.5 text-[10px] font-bold text-slate-950 disabled:opacity-40">
              Сохранить цикл
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
