import React, { useMemo, useState } from 'react';
import { ChevronDown, Dumbbell, Layers, Plus, Trash2, X } from 'lucide-react';
import {
  CycleGoal,
  CycleKind,
  CycleLevel,
  CycleLift,
  CycleTemplate,
  parseCustomCycle,
} from '../lib/cycleTemplates';

interface CycleBuilderModalProps {
  onClose: () => void;
  onSave: (template: CycleTemplate) => void;
}

interface BuilderExercise {
  name: string;
  sets: number;
  reps: string;
  percent: number;
  lift: CycleLift;
  restSeconds: number;
}

interface BuilderDay {
  label: string;
  exercises: BuilderExercise[];
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

const LIFT_OPTIONS: Array<{ id: CycleLift; label: string }> = [
  { id: 'bench', label: 'Жим лёжа' },
  { id: 'squat', label: 'Присед' },
  { id: 'deadlift', label: 'Становая' },
  { id: 'ohp', label: 'Жим стоя' },
  { id: 'accessory', label: 'Подсобка' },
];

const emptyExercise = (): BuilderExercise => ({
  name: 'Присед со штангой',
  sets: 5,
  reps: '5',
  percent: 70,
  lift: 'squat',
  restSeconds: 180,
});

const emptyDay = (index: number): BuilderDay => ({
  label: `День ${index + 1}`,
  exercises: [emptyExercise()],
});

export const CycleBuilderModal: React.FC<CycleBuilderModalProps> = ({ onClose, onSave }) => {
  const [kind, setKind] = useState<CycleKind>('specialization');
  const [importMode, setImportMode] = useState(false);
  const [name, setName] = useState('Мой цикл');
  const [goal, setGoal] = useState<CycleGoal>('strength');
  const [level, setLevel] = useState<CycleLevel>('intermediate');
  const [weeksCount, setWeeksCount] = useState(4);
  const [weeklyIncrement, setWeeklyIncrement] = useState(2.5);
  const [mainLift, setMainLift] = useState<CycleLift>('bench');
  const [mainSets, setMainSets] = useState(5);
  const [mainReps, setMainReps] = useState('5');
  const [mainPercent, setMainPercent] = useState(70);
  const [accessory, setAccessory] = useState('');
  const [days, setDays] = useState<BuilderDay[]>([emptyDay(0), emptyDay(1), emptyDay(2)]);
  const [description, setDescription] = useState('');
  const [importText, setImportText] = useState('');

  const availableMainLifts = useMemo(
    () => [...new Set(days.flatMap(day => day.exercises.map(exercise => exercise.lift)).filter(lift => lift !== 'accessory'))],
    [days],
  );

  const updateDay = (dayIndex: number, patch: Partial<BuilderDay>) => {
    setDays(prev => prev.map((day, index) => (index === dayIndex ? { ...day, ...patch } : day)));
  };

  const updateExercise = (dayIndex: number, exerciseIndex: number, patch: Partial<BuilderExercise>) => {
    setDays(prev =>
      prev.map((day, index) =>
        index === dayIndex
          ? {
              ...day,
              exercises: day.exercises.map((exercise, exIndex) =>
                exIndex === exerciseIndex ? { ...exercise, ...patch } : exercise,
              ),
            }
          : day,
      ),
    );
  };

  const addExercise = (dayIndex: number) => {
    setDays(prev =>
      prev.map((day, index) => (index === dayIndex ? { ...day, exercises: [...day.exercises, emptyExercise()] } : day)),
    );
  };

  const removeExercise = (dayIndex: number, exerciseIndex: number) => {
    setDays(prev =>
      prev.map((day, index) =>
        index === dayIndex
          ? { ...day, exercises: day.exercises.filter((_, exIndex) => exIndex !== exerciseIndex) }
          : day,
      ),
    );
  };

  const addDay = () => setDays(prev => [...prev, emptyDay(prev.length)]);
  const removeDay = (dayIndex: number) => setDays(prev => prev.filter((_, index) => index !== dayIndex));

  const buildTemplate = (): CycleTemplate => {
    const safeWeeks = Math.max(1, Math.min(16, weeksCount));
    const increment = Number.isFinite(weeklyIncrement) ? weeklyIncrement : 0;
    const id = `custom_${Date.now()}`;
    const baseWeeks = Array.from({ length: safeWeeks }).map((_, weekIndex) => {
      if (kind === 'specialization') {
        const daysForWeek = Array.from({ length: Math.max(1, Math.min(7, days.length)) }).map((__, dayIndex) => ({
          id: `${id}_w${weekIndex + 1}_d${dayIndex + 1}`,
          label: `День ${dayIndex + 1} — ${mainSets}×${mainReps} @ ${Math.min(100, mainPercent + increment * weekIndex)}%`,
          focus: 'Специализация на одном движении.',
          mainLift,
          exercises: [
            {
              name: LIFT_OPTIONS.find(item => item.id === mainLift)?.label || 'Основное движение',
              lift: mainLift,
              sets: mainSets,
              reps: mainReps,
              percent: Math.min(100, mainPercent + increment * weekIndex),
              restSeconds: mainPercent >= 80 ? 240 : 180,
              note: 'Проценты от 1ПМ выбранного движения.',
            },
            ...(accessory.trim()
              ? [{
                  name: accessory.trim(),
                  lift: 'accessory' as CycleLift,
                  sets: 3,
                  reps: '10',
                  optional: true,
                  restSeconds: 75,
                  note: 'Опциональная лёгкая подсобка.',
                }]
              : []),
          ],
        }));
        return {
          id: `${id}_w${weekIndex + 1}`,
          label: `Неделя ${weekIndex + 1}`,
          days: daysForWeek,
        };
      }

      return {
        id: `${id}_w${weekIndex + 1}`,
        label: `Неделя ${weekIndex + 1}`,
        days: days.map((day, dayIndex) => ({
          id: `${id}_w${weekIndex + 1}_d${dayIndex + 1}`,
          label: day.label || `День ${dayIndex + 1}`,
          focus: 'День из вашей программы.',
          exercises: day.exercises.map(exercise => ({
            name: exercise.name || 'Упражнение',
            lift: exercise.lift,
            sets: Math.max(1, exercise.sets),
            reps: exercise.reps || '10',
            percent: exercise.lift !== 'accessory' ? Math.min(100, Math.max(0, exercise.percent + increment * weekIndex)) : undefined,
            restSeconds: Math.max(30, exercise.restSeconds),
            optional: exercise.lift === 'accessory',
          })),
        })),
      };
    });

    const mainLifts: CycleLift[] =
      kind === 'specialization'
        ? [mainLift]
        : availableMainLifts.length > 0
          ? availableMainLifts
          : ['squat', 'bench', 'deadlift'];

    return {
      id,
      name: name.trim() || 'Мой цикл',
      author: 'Свой',
      goal,
      level,
      kind,
      mainLifts,
      mainLiftOptions: kind === 'specialization' ? [mainLift] : undefined,
      weeksCount: safeWeeks,
      daysPerWeek: kind === 'specialization' ? days.length : days.length,
      description:
        description.trim() ||
        (kind === 'specialization'
          ? 'Своя специализация на одном движении с постепенным ростом процентов.'
          : 'Своя программа по дням с упражнениями, подходами и прогрессией.'),
      focus:
        kind === 'specialization'
          ? `Одно основное движение: ${LIFT_OPTIONS.find(item => item.id === mainLift)?.label}.`
          : 'Собственная структура по дням.',
      equipment: 'По вашей программе',
      warnings: [
        'Это ваш собственный план. Проверяйте технику и восстановление.',
        'Не добавляйте отказные подходы без подготовки.',
      ],
      expectedResult: 'Зависит от выбранной прогрессии и восстановления.',
      recovery: 'Сон 7–9 часов, дни отдыха и контроль самочувствия.',
      whatElse: ['Лёгкая подсобка и ходьба в дни отдыха.', 'Следите за техникой и не форсируйте вес.'],
      avoid: ['Отказные подходы.', 'Резкий рост веса.', 'Пропуск разминки.'],
      restGuidance: ['Основные подходы — 2–3 минуты.', 'Подсобка — 60–90 секунд.'],
      progression: `Каждую неделю +${increment}% к процентам. Добавляйте вес, когда все подходы выполнены чисто.`,
      weekNotes: Array.from({ length: safeWeeks }).map((_, index) => `Неделя ${index + 1}: +${increment * index}% к базовым процентам.`),
      accessoryPolicy: 'Подсобка по желанию, без отказа.',
      weeks: baseWeeks,
      source: 'Создано пользователем',
      custom: true,
    };
  };

  const save = () => {
    if (importMode) {
      const parsed = parseCustomCycle(name, goal, level, description, importText);
      onSave(parsed);
      return;
    }
    onSave(buildTemplate());
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/85 p-3 backdrop-blur-sm">
      <div className="my-3 w-full max-w-lg rounded-2xl border border-[#263a4a] bg-[#0d151c] p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-sm font-black text-slate-100">
              <Layers className="h-4 w-4 text-emerald-400" />
              Конструктор цикла
            </div>
            <p className="mt-0.5 text-[9px] text-slate-500">
              Специализация на одном движении или полноценная программа по дням.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200" aria-label="Закрыть конструктор">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex gap-1 rounded-xl border border-[#223442] bg-[#091117] p-1">
          {(['specialization', 'program'] as CycleKind[]).map(item => (
            <button
              key={item}
              type="button"
              onClick={() => setKind(item)}
              className={`flex-1 rounded-lg px-2 py-2 text-[9px] font-bold ${
                kind === item ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              {item === 'specialization' ? 'Одно движение' : 'Полная программа'}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="col-span-2 text-[9px] text-slate-500">
            Название цикла
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Например: Мой жим 6 недель"
              className="mt-1 w-full rounded-xl border border-[#263a4a] bg-[#081016] px-2.5 py-2 text-[10px] text-slate-200"
            />
          </label>
          <label className="text-[9px] text-slate-500">
            Цель
            <select
              value={goal}
              onChange={event => setGoal(event.target.value as CycleGoal)}
              className="mt-1 w-full rounded-xl border border-[#263a4a] bg-[#081016] px-2 py-2 text-[10px] text-slate-200"
            >
              {(Object.keys(GOAL_LABELS) as CycleGoal[]).map(item => (
                <option key={item} value={item}>{GOAL_LABELS[item]}</option>
              ))}
            </select>
          </label>
          <label className="text-[9px] text-slate-500">
            Уровень
            <select
              value={level}
              onChange={event => setLevel(event.target.value as CycleLevel)}
              className="mt-1 w-full rounded-xl border border-[#263a4a] bg-[#081016] px-2 py-2 text-[10px] text-slate-200"
            >
              {(Object.keys(LEVEL_LABELS) as CycleLevel[]).map(item => (
                <option key={item} value={item}>{LEVEL_LABELS[item]}</option>
              ))}
            </select>
          </label>
          <label className="text-[9px] text-slate-500">
            Недель
            <input
              type="number"
              min={1}
              max={16}
              value={weeksCount}
              onChange={event => setWeeksCount(Math.max(1, Math.min(16, Number(event.target.value) || 1)))}
              className="mt-1 w-full rounded-xl border border-[#263a4a] bg-[#081016] px-2.5 py-2 text-[10px] font-bold text-slate-200"
            />
          </label>
          <label className="text-[9px] text-slate-500">
            Прибавка % в неделю
            <input
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={weeklyIncrement}
              onChange={event => setWeeklyIncrement(Math.max(0, Math.min(20, Number(event.target.value) || 0)))}
              className="mt-1 w-full rounded-xl border border-[#263a4a] bg-[#081016] px-2.5 py-2 text-[10px] font-bold text-slate-200"
            />
          </label>
          <label className="col-span-2 text-[9px] text-slate-500">
            Описание
            <textarea
              rows={2}
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder="Зачем этот цикл, что тренируем, как восстанавливаемся"
              className="mt-1 w-full resize-none rounded-xl border border-[#263a4a] bg-[#081016] px-2.5 py-2 text-[9px] text-slate-200"
            />
          </label>
        </div>

        {kind === 'specialization' ? (
          <div className="mt-3 rounded-xl border border-[#223442] bg-[#091117] p-2.5">
            <div className="text-[9px] font-bold uppercase tracking-wider text-cyan-300">
              Специализация: одно движение
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="col-span-2 text-[9px] text-slate-500">
                Основное движение
                <select
                  value={mainLift}
                  onChange={event => setMainLift(event.target.value as CycleLift)}
                  className="mt-1 w-full rounded-xl border border-[#263a4a] bg-[#081016] px-2 py-2 text-[10px] text-slate-200"
                >
                  {LIFT_OPTIONS.filter(item => item.id !== 'accessory').map(item => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-[9px] text-slate-500">
                Подходы
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={mainSets}
                  onChange={event => setMainSets(Math.max(1, Math.min(20, Number(event.target.value) || 1)))}
                  className="mt-1 w-full rounded-xl border border-[#263a4a] bg-[#081016] px-2.5 py-2 text-[10px] font-bold text-slate-200"
                />
              </label>
              <label className="text-[9px] text-slate-500">
                Повторения
                <input
                  value={mainReps}
                  onChange={event => setMainReps(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#263a4a] bg-[#081016] px-2.5 py-2 text-[10px] font-bold text-slate-200"
                />
              </label>
              <label className="text-[9px] text-slate-500">
                Базовый % от 1ПМ
                <input
                  type="number"
                  min={30}
                  max={100}
                  value={mainPercent}
                  onChange={event => setMainPercent(Math.max(30, Math.min(100, Number(event.target.value) || 30)))}
                  className="mt-1 w-full rounded-xl border border-[#263a4a] bg-[#081016] px-2.5 py-2 text-[10px] font-bold text-slate-200"
                />
              </label>
              <label className="text-[9px] text-slate-500">
                Дней в неделю
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={days.length}
                  onChange={event => {
                    const count = Math.max(1, Math.min(7, Number(event.target.value) || 1));
                    setDays(prev => {
                      if (count <= prev.length) return prev.slice(0, count);
                      return [...prev, ...Array.from({ length: count - prev.length }).map((_, index) => emptyDay(prev.length + index))];
                    });
                  }}
                  className="mt-1 w-full rounded-xl border border-[#263a4a] bg-[#081016] px-2.5 py-2 text-[10px] font-bold text-slate-200"
                />
              </label>
              <label className="col-span-2 text-[9px] text-slate-500">
                Опциональная подсобка (можно оставить пустым)
                <input
                  value={accessory}
                  onChange={event => setAccessory(event.target.value)}
                  placeholder="Например: тяга в наклоне 3×10"
                  className="mt-1 w-full rounded-xl border border-[#263a4a] bg-[#081016] px-2.5 py-2 text-[10px] text-slate-200"
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[9px] font-bold uppercase tracking-wider text-cyan-300">Базовая неделя</div>
              <button type="button" onClick={addDay} className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[8px] font-bold text-emerald-300">
                <Plus className="h-3 w-3" /> День
              </button>
            </div>
            {days.map((day, dayIndex) => (
              <div key={dayIndex} className="rounded-xl border border-[#223442] bg-[#091117] p-2.5">
                <div className="flex items-center gap-1.5">
                  <Dumbbell className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <input
                    value={day.label}
                    onChange={event => updateDay(dayIndex, { label: event.target.value })}
                    className="min-w-0 flex-1 rounded-lg border border-[#263546] bg-[#081016] px-2 py-1.5 text-[9px] font-bold text-slate-200"
                  />
                  <button type="button" onClick={() => removeDay(dayIndex)} className="rounded-lg border border-rose-500/25 p-1 text-rose-300" aria-label="Удалить день">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <div className="mt-1.5 space-y-1.5">
                  {day.exercises.map((exercise, exerciseIndex) => (
                    <div key={exerciseIndex} className="grid grid-cols-12 gap-1">
                      <input
                        value={exercise.name}
                        onChange={event => updateExercise(dayIndex, exerciseIndex, { name: event.target.value })}
                        placeholder="Упражнение"
                        className="col-span-4 rounded-lg border border-[#263546] bg-[#081016] px-2 py-1.5 text-[8px] text-slate-200"
                      />
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={exercise.sets}
                        onChange={event => updateExercise(dayIndex, exerciseIndex, { sets: Math.max(1, Number(event.target.value) || 1) })}
                        className="col-span-1 rounded-lg border border-[#263546] bg-[#081016] px-1 py-1.5 text-center text-[8px] text-slate-200"
                        title="Подходы"
                      />
                      <input
                        value={exercise.reps}
                        onChange={event => updateExercise(dayIndex, exerciseIndex, { reps: event.target.value })}
                        className="col-span-1 rounded-lg border border-[#263546] bg-[#081016] px-1 py-1.5 text-center text-[8px] text-slate-200"
                        title="Повторения"
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={exercise.percent}
                        onChange={event => updateExercise(dayIndex, exerciseIndex, { percent: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })}
                        className="col-span-1 rounded-lg border border-[#263546] bg-[#081016] px-1 py-1.5 text-center text-[8px] text-slate-200"
                        title="% от 1ПМ"
                      />
                      <select
                        value={exercise.lift}
                        onChange={event => updateExercise(dayIndex, exerciseIndex, { lift: event.target.value as CycleLift })}
                        className="col-span-3 rounded-lg border border-[#263546] bg-[#081016] px-1 py-1.5 text-[8px] text-slate-200"
                      >
                        {LIFT_OPTIONS.map(item => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeExercise(dayIndex, exerciseIndex)}
                        className="col-span-1 rounded-lg border border-rose-500/25 p-1 text-rose-300"
                        aria-label="Удалить упражнение"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => addExercise(dayIndex)} className="mt-1.5 inline-flex items-center gap-1 text-[8px] font-bold text-cyan-300">
                  <Plus className="h-2.5 w-2.5" /> Упражнение
                </button>
              </div>
            ))}
            <p className="text-[8px] leading-relaxed text-slate-500">
              Это базовая неделя. Все следующие недели получат прибавку {weeklyIncrement}% к процентам.
              Подходы, повторения и упражнения можно менять.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setImportMode(value => !value)}
          className="mt-3 inline-flex items-center gap-1 text-[8px] font-bold text-slate-500"
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${importMode ? 'rotate-180' : ''}`} />
          Импорт из текста
        </button>
        {importMode && (
          <textarea
            rows={5}
            value={importText}
            onChange={event => setImportText(event.target.value)}
            placeholder={'Неделя 1 | День 1 | Присед 5x5 70%\nНеделя 1 | День 2 | Жим 4x8 65%'}
            className="mt-1 w-full resize-none rounded-xl border border-[#263a4a] bg-[#081016] px-2.5 py-2 text-[9px] leading-relaxed text-slate-200"
          />
        )}

        <button
          type="button"
          onClick={save}
          disabled={!name.trim() || (importMode && !importText.trim())}
          className="mt-3 w-full rounded-xl bg-emerald-500 py-2.5 text-[10px] font-bold text-slate-950 disabled:opacity-40"
        >
          Сохранить цикл
        </button>
      </div>
    </div>
  );
};
