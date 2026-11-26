import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flag,
  Play,
  Plus,
  Search,
  Target,
  Trash2,
} from 'lucide-react';
import type { UserProfile, WorkoutRecord } from '../types';
import {
  ActiveCycle,
  CYCLE_TEMPLATES,
  CycleGoal,
  CycleLevel,
  CycleLift,
  CycleTemplate,
  applyCycleSelection,
  calculateCycleWeight,
  cycleTemplateById,
  loadActiveCycle,
  loadCustomCycles,
  saveActiveCycle,
  saveCustomCycles,
} from '../lib/cycleTemplates';
import { CycleBuilderModal } from './CycleBuilderModal';
import { CycleWorkoutModal } from './CycleWorkoutModal';

interface CycleLibraryProps {
  user: UserProfile;
  onLogWorkout: (record: WorkoutRecord) => void;
  openBuilderSignal?: number;
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
  main: 'Основное движение',
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

export const CycleLibrary: React.FC<CycleLibraryProps> = ({ user, onLogWorkout, openBuilderSignal = 0 }) => {
  const [customCycles, setCustomCycles] = useState<CycleTemplate[]>(() => loadCustomCycles());
  const [active, setActive] = useState<ActiveCycle | null>(() => loadActiveCycle());
  const [query, setQuery] = useState('');
  const [goal, setGoal] = useState<CycleGoal | 'all'>('all');
  const [selected, setSelected] = useState<CycleTemplate | null>(null);
  const [startTemplate, setStartTemplate] = useState<CycleTemplate | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [maxes, setMaxes] = useState<Partial<Record<CycleLift, number>>>(() => defaultMaxes(user));
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [startWeekIndex, setStartWeekIndex] = useState(0);
  const [selectedMainLift, setSelectedMainLift] = useState<CycleLift>('bench');
  const [selectedMainLifts, setSelectedMainLifts] = useState<CycleLift[]>(['squat', 'bench', 'deadlift']);
  const [viewWeekIndex, setViewWeekIndex] = useState(0);
  const [cycleWorkout, setCycleWorkout] = useState<{
    template: CycleTemplate;
    weekIndex: number;
    dayIndex: number;
  } | null>(null);

  useEffect(() => {
    const reload = () => {
      setActive(loadActiveCycle());
      setCustomCycles(loadCustomCycles());
    };
    window.addEventListener('getfit-cycle-updated', reload);
    return () => window.removeEventListener('getfit-cycle-updated', reload);
  }, []);

  useEffect(() => {
    if (openBuilderSignal > 0) setBuilderOpen(true);
  }, [openBuilderSignal]);

  useEffect(() => {
    if (active) setViewWeekIndex(active.weekIndex);
  }, [active?.templateId, active?.weekIndex]);

  const allTemplates = useMemo(() => [...CYCLE_TEMPLATES, ...customCycles], [customCycles]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/ё/g, 'е');
    return allTemplates.filter(item => {
      if (goal !== 'all' && item.goal !== goal) return false;
      if (!q) return true;
      return `${item.name} ${item.author} ${item.focus} ${item.description}`.toLowerCase().replace(/ё/g, 'е').includes(q);
    });
  }, [allTemplates, query, goal]);

  const rawActiveTemplate = active ? cycleTemplateById(active.templateId, customCycles) : null;
  const activeTemplate = rawActiveTemplate ? applyCycleSelection(rawActiveTemplate, active) : null;
  const activeWeek = activeTemplate && active
    ? activeTemplate.weeks[Math.min(viewWeekIndex, activeTemplate.weeks.length - 1)]
    : null;

  const startRequiredLifts = useMemo(() => {
    if (!startTemplate) return [];
    if (startTemplate.kind === 'specialization') return [selectedMainLift];
    if (startTemplate.allowMultipleMainLifts) return selectedMainLifts;
    return startTemplate.mainLifts.filter(lift => lift !== 'main' && lift !== 'accessory');
  }, [startTemplate, selectedMainLift, selectedMainLifts]);

  const openStart = (template: CycleTemplate, weekIndex = 0) => {
    setStartTemplate(template);
    setStartWeekIndex(weekIndex);
    setMaxes(prev => ({ ...defaultMaxes(user), ...prev }));
    if (template.kind === 'specialization' && template.mainLiftOptions?.length) {
      setSelectedMainLift(template.mainLiftOptions[0]);
    }
    if (template.allowMultipleMainLifts && template.mainLiftOptions?.length) {
      setSelectedMainLifts(template.mainLiftOptions);
    }
  };

  const startCycle = () => {
    if (!startTemplate) return;
    const next: ActiveCycle = {
      templateId: startTemplate.id,
      startDate,
      weekIndex: startWeekIndex,
      maxes,
      completed: {},
      mainLift: startTemplate.kind === 'specialization' ? selectedMainLift : undefined,
      mainLifts: startTemplate.allowMultipleMainLifts ? selectedMainLifts : undefined,
    };
    setActive(next);
    saveActiveCycle(next);
    setViewWeekIndex(startWeekIndex);
    setStartTemplate(null);
  };

  const toggleDay = (dayId: string) => {
    if (!active) return;
    const key = `${viewWeekIndex}-${dayId}`;
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
    const key = `${viewWeekIndex}-${dayId}`;
    const next = {
      ...active,
      actualWeights: { ...(active.actualWeights || {}), [key]: Math.max(0, Number(value) || 0) },
    };
    setActive(next);
    saveActiveCycle(next);
  };

  const updateDayNote = (dayId: string, value: string) => {
    if (!active) return;
    const key = `${viewWeekIndex}-${dayId}`;
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
    setViewWeekIndex(next.weekIndex);
  };

  const prevWeek = () => {
    if (!active || !activeTemplate) return;
    if (active.weekIndex <= 0) return;
    const next = { ...active, weekIndex: active.weekIndex - 1 };
    setActive(next);
    saveActiveCycle(next);
    setViewWeekIndex(next.weekIndex);
  };

  const finishCycle = () => {
    setActive(null);
    saveActiveCycle(null);
  };

  const startDay = (template: CycleTemplate, weekIndex: number, dayIndex: number) => {
    setCycleWorkout({ template, weekIndex, dayIndex });
  };

  const completeCycleDay = (payload: {
    record: WorkoutRecord;
    actualWeights: Record<string, number>;
    note: string;
  }) => {
    if (!active || !cycleWorkout) return;
    const template = cycleWorkout.template;
    const week = template.weeks[cycleWorkout.weekIndex];
    const day = week?.days[cycleWorkout.dayIndex];
    if (!day) return;
    const key = `${cycleWorkout.weekIndex}-${day.id}`;
    const weights = Object.values(payload.actualWeights).filter(value => value > 0);
    const topWeight = weights.length > 0 ? Math.max(...weights) : 0;
    const next: ActiveCycle = {
      ...active,
      completed: { ...active.completed, [key]: true },
      completedAt: { ...(active.completedAt || {}), [key]: new Date().toISOString() },
      actualWeights: { ...(active.actualWeights || {}), [key]: topWeight },
      notes: { ...(active.notes || {}), [key]: payload.note },
    };
    setActive(next);
    saveActiveCycle(next);
    window.dispatchEvent(new Event('getfit-cycle-updated'));
    onLogWorkout(payload.record);
    setCycleWorkout(null);
  };

  const totalDays = activeTemplate ? activeTemplate.weeks.reduce((sum, week) => sum + week.days.length, 0) : 0;
  const doneDays = active ? Object.values(active.completed).filter(Boolean).length : 0;
  const progress = totalDays > 0 ? Math.round((doneDays / totalDays) * 100) : 0;
  const activeWorkoutDay = cycleWorkout
    ? cycleWorkout.template.weeks[cycleWorkout.weekIndex]?.days[cycleWorkout.dayIndex]
    : null;

  const weekDone = (weekIndex: number) => {
    if (!activeTemplate) return 0;
    return activeTemplate.weeks[weekIndex].days.filter(day => active?.completed[`${weekIndex}-${day.id}`]).length;
  };

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
            onClick={() => setBuilderOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[8px] font-bold text-emerald-300"
          >
            <Plus className="h-3 w-3" />
            Создать цикл
          </button>
        </div>
        <p className="mt-1 text-[9px] leading-relaxed text-slate-500">
          Готовые программы с неделями, днями и процентами. Можно изучить, начать сразу или запланировать дату.
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
                <CycleBadge tone="border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
                  {activeTemplate.kind === 'specialization' ? 'одно движение' : 'программа'}
                </CycleBadge>
              </div>
              <div className="mt-0.5 text-[9px] text-slate-400">
                Неделя {active.weekIndex + 1} из {activeTemplate.weeks.length} · {progress}% дней · старт {active.startDate}
              </div>
              {active.mainLift && (
                <div className="mt-0.5 text-[8px] text-cyan-300">
                  Основное движение: {LIFT_LABELS[active.mainLift]}
                </div>
              )}
              {active.mainLifts && active.mainLifts.length > 0 && (
                <div className="mt-0.5 text-[8px] text-cyan-300">
                  Выбранные движения: {active.mainLifts.map(lift => LIFT_LABELS[lift]).join(', ')}
                </div>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <button type="button" onClick={prevWeek} disabled={active.weekIndex <= 0} className="rounded-lg border border-[#2b4050] px-2 py-1 text-[8px] font-bold text-slate-300 disabled:opacity-30">
                <ChevronLeft className="h-3 w-3" />
              </button>
              <button type="button" onClick={nextWeek} disabled={active.weekIndex >= activeTemplate.weeks.length - 1} className="rounded-lg border border-[#2b4050] px-2 py-1 text-[8px] font-bold text-slate-300 disabled:opacity-30">
                <ChevronRight className="h-3 w-3" />
              </button>
              <button type="button" onClick={finishCycle} className="rounded-lg border border-rose-500/30 px-2 py-1 text-[8px] font-bold text-rose-300">
                Завершить
              </button>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <div className="rounded-xl border border-[#223442] bg-[#091117] p-2 text-[8px] leading-relaxed text-slate-400">
              <b className="text-slate-300">Зачем:</b> {activeTemplate.description}
            </div>
            <div className="rounded-xl border border-[#223442] bg-[#091117] p-2 text-[8px] leading-relaxed text-slate-400">
              <b className="text-slate-300">Ожидаемый результат:</b> {activeTemplate.expectedResult}
            </div>
            <div className="rounded-xl border border-[#223442] bg-[#091117] p-2 text-[8px] leading-relaxed text-slate-400">
              <b className="text-slate-300">Восстановление:</b> {activeTemplate.recovery}
            </div>
            <div className="rounded-xl border border-[#223442] bg-[#091117] p-2 text-[8px] leading-relaxed text-slate-400">
              <b className="text-slate-300">Прогрессия:</b> {activeTemplate.progression}
            </div>
          </div>

          <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
            {activeTemplate.weeks.map((week, index) => (
              <button
                key={week.id}
                type="button"
                onClick={() => setViewWeekIndex(index)}
                className={`shrink-0 rounded-lg border px-2 py-1 text-[8px] font-bold ${
                  viewWeekIndex === index
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                    : 'border-[#263546] bg-[#091117] text-slate-400'
                }`}
              >
                Нед. {index + 1}
                <span className="ml-1 text-[7px] text-slate-500">{weekDone(index)}/{week.days.length}</span>
              </button>
            ))}
          </div>

          {activeWeek && (
            <>
              <div className="mt-1 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-2 py-1.5 text-[8px] leading-relaxed text-cyan-100/80">
                {activeTemplate.weekNotes[viewWeekIndex] || activeWeek.label}
              </div>
              <div className="mt-2 space-y-1.5">
                {activeWeek.days.map((day, dayIndex) => {
                  const key = `${viewWeekIndex}-${day.id}`;
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
                            <span className="block text-[8px] text-slate-500">
                              {day.exercises.length} упражнений{day.focus ? ` · ${day.focus}` : ''}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => startDay(activeTemplate, viewWeekIndex, dayIndex)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-500 px-2 py-1.5 text-[8px] font-bold text-slate-950"
                        >
                          <Play className="h-2.5 w-2.5" />
                          {done ? 'Повторить' : 'Начать'}
                        </button>
                      </div>
                      <div className="mt-1 text-[8px] leading-snug text-slate-500">
                        {day.exercises.map(exercise => {
                          const weight = calculateCycleWeight(exercise.percent, exercise.lift, active.maxes, active.mainLift);
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
            </>
          )}

          <div className="mt-2 grid gap-1.5">
            <div className="rounded-xl border border-[#223442] bg-[#091117] p-2 text-[8px] leading-relaxed text-slate-400">
              <b className="text-slate-300">Что ещё делать:</b> {activeTemplate.whatElse.join(' ')}
            </div>
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-2 text-[8px] leading-relaxed text-amber-200/80">
              <b>Не делать:</b> {activeTemplate.avoid.join(' ')}
            </div>
            <div className="rounded-xl border border-[#223442] bg-[#091117] p-2 text-[8px] leading-relaxed text-slate-400">
              <b className="text-slate-300">Отдых:</b> {activeTemplate.restGuidance.join(' ')}
            </div>
            <div className="rounded-xl border border-[#223442] bg-[#091117] p-2 text-[8px] leading-relaxed text-slate-400">
              <b className="text-slate-300">Подсобка:</b> {activeTemplate.accessoryPolicy}
            </div>
          </div>

          <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-2 py-1.5 text-[8px] text-cyan-200/80">
            <Dumbbell className="h-3 w-3 shrink-0" />
            В чате можно написать: «сделал тренировку по циклу, зафиксируй» — день отметится сам.
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
              <div className="flex shrink-0 flex-col items-end gap-1">
                <CycleBadge tone="border-cyan-500/25 bg-cyan-500/10 text-cyan-300">{GOAL_LABELS[template.goal]}</CycleBadge>
                <CycleBadge>{template.kind === 'specialization' ? 'одно движение' : 'программа'}</CycleBadge>
              </div>
            </div>
            <p className="mt-1 line-clamp-2 text-[8px] leading-snug text-slate-500">{template.description}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <CycleBadge>{template.weeksCount} нед.</CycleBadge>
              <CycleBadge>{template.daysPerWeek} дн/нед</CycleBadge>
              <CycleBadge>{LEVEL_LABELS[template.level]}</CycleBadge>
              <CycleBadge>{template.mainLifts.map(lift => LIFT_LABELS[lift]).join(' / ')}</CycleBadge>
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
                <div className="text-[9px] text-slate-500">
                  {selected.author} · {GOAL_LABELS[selected.goal]} · {LEVEL_LABELS[selected.level]} ·{' '}
                  {selected.kind === 'specialization' ? 'одно движение' : 'программа'}
                </div>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-slate-400">✕</button>
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-slate-400">{selected.description}</p>
            <div className="mt-2 grid gap-1.5 text-[8px] leading-relaxed text-slate-500">
              <div className="rounded-xl border border-[#223442] bg-[#091117] p-2">
                <b className="text-slate-300">Фокус:</b> {selected.focus}
              </div>
              <div className="rounded-xl border border-[#223442] bg-[#091117] p-2">
                <b className="text-slate-300">Ожидаемый результат:</b> {selected.expectedResult}
              </div>
              <div className="rounded-xl border border-[#223442] bg-[#091117] p-2">
                <b className="text-slate-300">Восстановление:</b> {selected.recovery}
              </div>
              <div className="rounded-xl border border-[#223442] bg-[#091117] p-2">
                <b className="text-slate-300">Что ещё делать:</b> {selected.whatElse.join(' ')}
              </div>
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-2 text-amber-200/80">
                <b>Не делать:</b> {selected.avoid.join(' ')}
              </div>
              <div className="rounded-xl border border-[#223442] bg-[#091117] p-2">
                <b className="text-slate-300">Отдых:</b> {selected.restGuidance.join(' ')}
              </div>
              <div className="rounded-xl border border-[#223442] bg-[#091117] p-2">
                <b className="text-slate-300">Прогрессия:</b> {selected.progression}
              </div>
              <div className="rounded-xl border border-[#223442] bg-[#091117] p-2">
                <b className="text-slate-300">Подсобка:</b> {selected.accessoryPolicy}
              </div>
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
                    {week.days.map(day => (
                      <div key={day.id} className="rounded-lg border border-[#1f303d] bg-[#091117] p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[8px] font-bold text-slate-300">{day.label}</span>
                          <button type="button" onClick={() => { openStart(selected, weekIndex); setSelected(null); }} className="text-[8px] font-bold text-emerald-300">С этой недели</button>
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
              <button type="button" onClick={() => { openStart(selected); setSelected(null); }} className="flex-1 rounded-xl bg-emerald-500 py-2 text-[10px] font-bold text-slate-950">
                Начать / запланировать
              </button>
              {selected.custom && (
                <button type="button" onClick={() => {
                  const next = customCycles.filter(item => item.id !== selected.id);
                  setCustomCycles(next);
                  saveCustomCycles(next);
                  if (active?.templateId === selected.id) finishCycle();
                  setSelected(null);
                }} className="rounded-xl border border-rose-500/30 px-2.5 py-2 text-[9px] font-bold text-rose-300">
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

            <div className="mt-2 rounded-xl border border-[#223442] bg-[#091117] p-2 text-[8px] leading-relaxed text-slate-400">
              <b className="text-slate-300">Суть:</b> {startTemplate.description}
              <br />
              <b className="text-slate-300">Ожидаемый результат:</b> {startTemplate.expectedResult}
              <br />
              <b className="text-slate-300">Восстановление:</b> {startTemplate.recovery}
            </div>

            {startTemplate.kind === 'specialization' && startTemplate.mainLiftOptions && (
              <label className="mt-2 block text-[9px] text-slate-500">
                Основное движение (1ПМ нужен только для него)
                <select
                  value={selectedMainLift}
                  onChange={event => setSelectedMainLift(event.target.value as CycleLift)}
                  className="mt-1 w-full rounded-xl border border-[#263a4a] bg-[#081016] px-2.5 py-2 text-[10px] text-slate-200"
                >
                  {startTemplate.mainLiftOptions.map(lift => (
                    <option key={lift} value={lift}>{LIFT_LABELS[lift]}</option>
                  ))}
                </select>
              </label>
            )}

            {startTemplate.allowMultipleMainLifts && startTemplate.mainLiftOptions && (
              <div className="mt-2 rounded-xl border border-[#223442] bg-[#091117] p-2">
                <div className="text-[9px] font-bold text-slate-300">Выберите движения</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {startTemplate.mainLiftOptions.map(lift => {
                    const checked = selectedMainLifts.includes(lift);
                    return (
                      <button
                        key={lift}
                        type="button"
                        onClick={() => setSelectedMainLifts(prev => checked ? prev.filter(item => item !== lift) : [...prev, lift])}
                        className={`rounded-lg border px-2 py-1 text-[8px] font-bold ${checked ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200' : 'border-[#263546] text-slate-400'}`}
                      >
                        {LIFT_LABELS[lift]}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-[8px] leading-snug text-slate-500">
                  Можно выбрать одно движение, два или все три. Приложение оставит только нужные дни.
                </p>
              </div>
            )}

            <label className="mt-2 block text-[9px] text-slate-500">
              Дата старта
              <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="mt-1 w-full rounded-xl border border-[#263a4a] bg-[#081016] px-2.5 py-2 text-[10px] text-slate-200" />
            </label>

            <div className="mt-2 grid grid-cols-2 gap-2">
              {startRequiredLifts.map(lift => (
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

            <label className="mt-2 block text-[9px] text-slate-500">
              Начать с недели
              <select
                value={startWeekIndex}
                onChange={event => setStartWeekIndex(Number(event.target.value))}
                className="mt-1 w-full rounded-xl border border-[#263a4a] bg-[#081016] px-2 py-2 text-[10px] text-slate-200"
              >
                {startTemplate.weeks.map((week, index) => (
                  <option key={week.id} value={index}>Неделя {index + 1}</option>
                ))}
              </select>
            </label>

            <p className="mt-2 text-[8px] leading-relaxed text-slate-500">
              Веса рассчитываются от 1ПМ и процентов. Если не знаете 1ПМ, начните с комфортных весов — в тренировке
              можно вписать фактический вес. Подсобка не требует 1ПМ.
            </p>
            <button
              type="button"
              onClick={startCycle}
              disabled={startRequiredLifts.length === 0}
              className="mt-2 w-full rounded-xl bg-emerald-500 py-2.5 text-[10px] font-bold text-slate-950 disabled:opacity-40"
            >
              Запустить цикл
            </button>
          </div>
        </div>
      )}

      {builderOpen && (
        <CycleBuilderModal
          onClose={() => setBuilderOpen(false)}
          onSave={template => {
            const next = [...customCycles, template];
            setCustomCycles(next);
            saveCustomCycles(next);
            setBuilderOpen(false);
            setSelected(template);
          }}
        />
      )}

      {cycleWorkout && activeWorkoutDay && (
        <CycleWorkoutModal
          template={cycleWorkout.template}
          weekIndex={cycleWorkout.weekIndex}
          day={activeWorkoutDay}
          maxes={active?.maxes || maxes}
          mainLift={active?.mainLift}
          initialActualWeights={
            activeWorkoutDay.exercises.length === 1
              ? {
                  [activeWorkoutDay.id]:
                    active?.actualWeights?.[`${cycleWorkout.weekIndex}-${activeWorkoutDay.id}`] || 0,
                }
              : undefined
          }
          initialNote={active?.notes?.[`${cycleWorkout.weekIndex}-${activeWorkoutDay.id}`]}
          onClose={() => setCycleWorkout(null)}
          onComplete={completeCycleDay}
        />
      )}
    </div>
  );
};
