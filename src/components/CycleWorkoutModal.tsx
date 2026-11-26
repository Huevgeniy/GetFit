import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Dumbbell, Info, Timer, X } from 'lucide-react';
import type { CompletedSet, ExerciseLog, WorkoutRecord } from '../types';
import {
  CycleDay,
  CycleExercise,
  CycleLift,
  CycleTemplate,
  calculateCycleWeight,
  resolveCycleLift,
} from '../lib/cycleTemplates';

interface CycleWorkoutModalProps {
  template: CycleTemplate;
  weekIndex: number;
  day: CycleDay;
  maxes: Partial<Record<CycleLift, number>>;
  mainLift?: CycleLift;
  initialActualWeights?: Record<string, number>;
  initialNote?: string;
  onClose: () => void;
  onComplete: (payload: {
    record: WorkoutRecord;
    actualWeights: Record<string, number>;
    note: string;
  }) => void;
}

const formatSeconds = (seconds: number) => {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

const repsNumber = (reps: string) => Number.parseInt(reps, 10) || 1;

const LIFT_SHORT: Record<string, string> = {
  squat: 'Присед',
  bench: 'Жим',
  deadlift: 'Становая',
  ohp: 'Жим стоя',
  main: 'Основное',
  accessory: 'Подсобка',
};

const recommendedRest = (exercise: CycleExercise): number => {
  if (exercise.restSeconds) return exercise.restSeconds;
  if (exercise.lift === 'accessory' || !exercise.percent) return 75;
  if (exercise.percent >= 85 || repsNumber(exercise.reps) <= 3) return 300;
  if (exercise.percent >= 75) return 210;
  return 150;
};

export const CycleWorkoutModal: React.FC<CycleWorkoutModalProps> = ({
  template,
  weekIndex,
  day,
  maxes,
  mainLift,
  initialActualWeights,
  initialNote,
  onClose,
  onComplete,
}) => {
  const [actualWeights, setActualWeights] = useState<Record<number, number>>(() => {
    const initial: Record<number, number> = {};
    day.exercises.forEach((exercise, index) => {
      const planned = calculateCycleWeight(exercise.percent, exercise.lift, maxes, mainLift);
      initial[index] = initialActualWeights?.[day.id] || planned || 0;
    });
    return initial;
  });
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState(initialNote || '');
  const [rest, setRest] = useState<{ secondsLeft: number; label: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!rest) return;
    if (rest.secondsLeft <= 0) {
      setRest(null);
      return;
    }
    const timer = window.setInterval(() => {
      setRest(prev => {
        if (!prev) return prev;
        if (prev.secondsLeft <= 1) return null;
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [rest?.secondsLeft]);

  const totalSets = useMemo(
    () => day.exercises.reduce((sum, exercise) => sum + exercise.sets, 0),
    [day.exercises],
  );
  const doneSets = useMemo(
    () => Object.values(checked).filter(Boolean).length,
    [checked],
  );

  const toggleSet = (exerciseIndex: number, setIndex: number) => {
    const key = `${exerciseIndex}-${setIndex}`;
    const next = !checked[key];
    setChecked(prev => ({ ...prev, [key]: next }));
    setError('');
    if (next) {
      const exercise = day.exercises[exerciseIndex];
      const seconds = recommendedRest(exercise);
      setRest({
        secondsLeft: seconds,
        label: `${exercise.name} · подход ${setIndex + 1}`,
      });
    }
  };

  const complete = () => {
    if (doneSets === 0) {
      setError('Отметь хотя бы один выполненный подход.');
      return;
    }
    const nowIso = new Date().toISOString();
    let tonnage = 0;
    const exercises: ExerciseLog[] = [];

    day.exercises.forEach((exercise, exerciseIndex) => {
      const selectedSetIndexes = Array.from({ length: exercise.sets })
        .map((_, setIndex) => setIndex)
        .filter(setIndex => checked[`${exerciseIndex}-${setIndex}`]);
      if (selectedSetIndexes.length === 0) return;

      const weight = Math.max(0, Number(actualWeights[exerciseIndex]) || 0);
      const reps = repsNumber(exercise.reps);
      const oneRM = weight > 0 ? Math.round(weight * (1 + reps / 30) * 10) / 10 : 0;
      tonnage += weight * reps * selectedSetIndexes.length;
      const sets: CompletedSet[] = selectedSetIndexes.map((setIndex, order) => ({
        id: `cycle_set_${Date.now()}_${exerciseIndex}_${setIndex}`,
        setNumber: order + 1,
        weight,
        reps,
        rpe: 8,
        timestamp: nowIso,
        calculated1RM: oneRM,
        normalizedRepsAt100kg: weight > 0 ? Math.max(0, Math.round(reps * (weight / 100))) : 0,
      }));
      exercises.push({
        exerciseId: `cycle_ex_${template.id}_${weekIndex}_${exerciseIndex}`,
        name: exercise.name,
        sets,
        notes: exercise.note,
        best1RM: oneRM || undefined,
      });
    });

    const record: WorkoutRecord = {
      id: `cycle_record_${Date.now()}`,
      planId: `cycle_${template.id}_${weekIndex}_${day.id}`,
      title: `${template.name} · Неделя ${weekIndex + 1} · ${day.label}`,
      date: nowIso.slice(0, 10),
      startedAt: nowIso,
      completedAt: nowIso,
      durationMinutes: Math.max(20, Math.round((doneSets * 4) + (day.exercises.length * 5))),
      exercises,
      totalTonnageKg: Math.round(tonnage),
      status: 'completed',
    };

    const nextActualWeights: Record<string, number> = {};
    day.exercises.forEach((_, index) => {
      nextActualWeights[String(index)] = Math.max(0, Number(actualWeights[index]) || 0);
    });

    onComplete({ record, actualWeights: nextActualWeights, note: note.trim() });
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col overflow-y-auto bg-[#070b0f]">
      <div className="sticky top-0 z-10 border-b border-[#1a2733] bg-[#0b1117]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-400">
              <Dumbbell className="h-3.5 w-3.5" />
              Тренировка по циклу
            </div>
            <h2 className="mt-0.5 truncate text-sm font-black text-slate-100">{template.name}</h2>
            <p className="text-[9px] text-slate-500">
              Неделя {weekIndex + 1} · {day.label}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#182330] p-2 text-slate-400 hover:text-slate-200"
            aria-label="Закрыть тренировку"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#182330]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all"
              style={{ width: `${totalSets > 0 ? Math.min(100, (doneSets / totalSets) * 100) : 0}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-[9px] text-slate-400">
            {doneSets}/{totalSets} подходов
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-3 px-4 py-4 pb-40">
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-[9px] leading-relaxed text-cyan-100/80">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-300">
            <Info className="h-3.5 w-3.5" />
            Как выполнять
          </div>
          <p className="mt-1">
            {String(day.focus || template.focus).replace(/\.+$/, '')}. Вес уже рассчитан от 1ПМ. Отмечай подходы по одному — после галочки
            запустится рекомендованный отдых. Если вес отличается, впиши фактический.
          </p>
          <p className="mt-1 text-slate-400">{template.progression}</p>
        </div>

        {day.exercises.map((exercise, exerciseIndex) => {
          const planned = calculateCycleWeight(exercise.percent, exercise.lift, maxes, mainLift);
          const resolvedLift = resolveCycleLift(exercise.lift, mainLift);
          const restSeconds = recommendedRest(exercise);
          return (
            <div key={`${day.id}-${exerciseIndex}`} className="rounded-2xl border border-[#223442] bg-[#0b131a] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-100">{exercise.name}</span>
                    {exercise.optional && (
                      <span className="rounded border border-slate-600 px-1 py-0.5 text-[7px] text-slate-400">
                        опционально
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[9px] text-slate-500">
                    {exercise.sets}×{exercise.reps}
                    {exercise.percent ? ` · ${exercise.percent}%` : ''}
                    {resolvedLift && resolvedLift !== 'accessory' ? ` · ${LIFT_SHORT[resolvedLift] || resolvedLift}` : ''}
                    {' · отдых '}
                    {formatSeconds(restSeconds)}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[8px] text-slate-500">План</div>
                  <div className="font-mono text-sm font-black text-emerald-300">
                    {planned > 0 ? `${planned} кг` : 'по ощущениям'}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <label className="text-[8px] text-slate-500">
                  Фактический вес, кг
                  <input
                    type="number"
                    min={0}
                    step={2.5}
                    value={actualWeights[exerciseIndex] ?? ''}
                    onChange={event =>
                      setActualWeights(prev => ({
                        ...prev,
                        [exerciseIndex]: Math.max(0, Number(event.target.value) || 0),
                      }))
                    }
                    className="mt-0.5 w-28 rounded-lg border border-[#263546] bg-[#081016] px-2 py-1.5 text-[10px] font-bold text-slate-100"
                  />
                </label>
                <div className="flex flex-1 flex-wrap justify-end gap-1">
                  {Array.from({ length: exercise.sets }).map((_, setIndex) => {
                    const key = `${exerciseIndex}-${setIndex}`;
                    const done = Boolean(checked[key]);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleSet(exerciseIndex, setIndex)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg border text-[9px] font-bold transition-colors ${
                          done
                            ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                            : 'border-[#2b4050] bg-[#111b24] text-slate-400'
                        }`}
                        title={`Подход ${setIndex + 1}: ${exercise.reps} повторений`}
                      >
                        {done ? <CheckCircle2 className="h-4 w-4" /> : setIndex + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
              {exercise.note && (
                <p className="mt-1.5 text-[8px] leading-snug text-slate-500">{exercise.note}</p>
              )}
            </div>
          );
        })}

        <label className="block rounded-2xl border border-[#223442] bg-[#0b131a] p-3 text-[9px] text-slate-500">
          Заметка о тренировке
          <textarea
            rows={2}
            value={note}
            onChange={event => setNote(event.target.value)}
            placeholder="Самочувствие, техника, что изменить в следующий раз"
            className="mt-1 w-full resize-none rounded-xl border border-[#263546] bg-[#081016] px-2.5 py-2 text-[10px] text-slate-200"
          />
        </label>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[9px] text-rose-200">
            {error}
          </div>
        )}
      </div>

      {rest && (
        <div className="fixed bottom-20 left-3 right-3 z-20 mx-auto max-w-md rounded-2xl border border-amber-500/30 bg-[#1a140b]/95 p-3 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 shrink-0 text-amber-300" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold text-amber-200">Отдых {formatSeconds(rest.secondsLeft)}</div>
              <div className="truncate text-[8px] text-slate-400">{rest.label}</div>
            </div>
            <button
              type="button"
              onClick={() => setRest(prev => (prev ? { ...prev, secondsLeft: prev.secondsLeft + 30 } : prev))}
              className="rounded-lg border border-amber-500/30 px-2 py-1 text-[8px] font-bold text-amber-200"
            >
              +30 сек
            </button>
            <button
              type="button"
              onClick={() => setRest(null)}
              className="rounded-lg bg-amber-400 px-2 py-1 text-[8px] font-bold text-slate-950"
            >
              Пропустить
            </button>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-[#1a2733] bg-[#0b1117]/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={complete}
          className="w-full rounded-xl bg-emerald-500 py-3 text-xs font-black text-slate-950 shadow-lg shadow-emerald-500/20"
        >
          Завершить день цикла
        </button>
      </div>
    </div>
  );
};
