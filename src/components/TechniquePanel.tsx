import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  Dumbbell,
  Info,
  MessageCircle,
  RefreshCw,
  Ruler,
  Scale,
  ShieldAlert,
  Sparkles,
  Target,
} from 'lucide-react';
import type { BodyProfile, WorkoutRecord } from '../types';
import {
  BodyDimensions,
  buildSideGeometry,
  computePoseMetrics,
} from '../lib/bodyModel';
import {
  INTENSITY_META,
  IntensityZone,
  intensityMeta,
  intensityZone,
} from '../lib/exerciseSimulation';
import {
  AngleRule,
  CATEGORY_LABELS,
  ControlValues,
  DIFFICULTY_LABELS,
  DISCLAIMER,
  EQUIPMENT_LABELS,
  ExerciseControl,
  EXERCISE_CATALOG,
  JOINT_LABELS,
  JointId,
  MUSCLES,
  MuscleId,
  SOURCES,
  TechniqueExercise,
  activeShifts,
  buildTechniquePose,
  defaultControlValues,
  estimateTechniqueOneRepMax,
  muscleIntensity,
  proportionNotes,
  techniqueSystemLoad,
} from '../lib/exerciseTechnique';
import { SkeletonAngleSpec, SkeletonEquipment, SkeletonModel2D, SkeletonStation } from './SkeletonModel2D';

interface TechniquePanelProps {
  exercise: TechniqueExercise;
  dimensions: BodyDimensions;
  bodyWeightKg: number;
  profile: BodyProfile;
  pastWorkouts: WorkoutRecord[];
  onUpdateBody: (next: BodyProfile) => void;
  onSelectExercise: (id: string) => void;
  onOpenLibrary: () => void;
  onAskAi?: (prompt: string) => void;
}

const formatNumber = (value: number, digits = 1): string => {
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  return String(rounded).replace('.', ',');
};

const INTENSITY_ORDER: IntensityZone[] = ['light', 'moderate', 'hard', 'max'];
const INTENSITY_SPAN: Record<IntensityZone, number> = {
  light: 60,
  moderate: 15,
  hard: 10,
  max: 15,
};

const statusOf = (value: number, rule: AngleRule): 'pass' | 'near' | 'fail' => {
  const span = Math.max(1, rule.max - rule.min);
  if (value < rule.min || value > rule.max) return 'fail';
  if (value - rule.min < span * 0.12 || rule.max - value < span * 0.12) return 'near';
  return 'pass';
};

const angleStatusClass = (status: 'pass' | 'near' | 'fail'): string =>
  status === 'fail'
    ? 'border-rose-500/35 bg-rose-500/8 text-rose-200'
    : status === 'near'
      ? 'border-amber-500/35 bg-amber-500/8 text-amber-200'
      : 'border-emerald-500/25 bg-emerald-500/6 text-emerald-200';

const riskTone = (level: 'info' | 'caution' | 'warning'): string =>
  level === 'warning'
    ? 'border-rose-500/30 bg-rose-500/6'
    : level === 'caution'
      ? 'border-amber-500/30 bg-amber-500/6'
      : 'border-cyan-500/25 bg-cyan-500/5';

const riskIcon = (level: 'info' | 'caution' | 'warning') =>
  level === 'warning' ? AlertTriangle : level === 'caution' ? AlertCircle : Info;

const equipmentAnchor = (exercise: TechniqueExercise): 'hand' | 'shoulder' | 'hip' => {
  if (['squat', 'frontSquat', 'goodMorning'].includes(exercise.id)) return 'shoulder';
  if (exercise.id === 'hipThrust' || exercise.id === 'plank') return 'hip';
  if (['legPress', 'legExtension', 'legCurl', 'standingCalfRaise', 'seatedCalfRaise', 'nordicCurl'].includes(exercise.id)) {
    return 'hand';
  }
  return 'hand';
};

const stationFor = (exercise: TechniqueExercise): SkeletonStation => {
  if (['bench', 'inclineBench', 'closeGripBench', 'hipThrust', 'legCurl', 'nordicCurl'].includes(exercise.id)) return 'bench';
  if (exercise.id === 'pullup') return 'pullup';
  if (exercise.id === 'dips') return 'dips';
  if (['latPulldown', 'legPress', 'legExtension', 'seatedCalfRaise'].includes(exercise.id)) return 'seated';
  return null;
};

const skeletonEquipment = (exercise: TechniqueExercise): SkeletonEquipment | null => {
  if (exercise.equipment === 'machine' || exercise.equipment === 'cable') return null;
  const kind =
    exercise.equipment === 'dumbbell'
      ? 'dumbbell'
      : exercise.equipment === 'bodyweight'
        ? 'bodyweight'
        : 'barbell';
  return { kind, weightKg: 0, anchor: equipmentAnchor(exercise) };
};

const specForRule = (rule: AngleRule): SkeletonAngleSpec | null => {
  if (rule.metric === 'side.kneeFlex') {
    return { id: rule.metric, label: rule.label, value: 0, min: rule.min, max: rule.max, joint: 'knee', a: 'hip', b: 'ankle' };
  }
  if (rule.metric === 'side.elbowFlex') {
    return { id: rule.metric, label: rule.label, value: 0, min: rule.min, max: rule.max, joint: 'elbow', a: 'shoulder', b: 'hand' };
  }
  if (rule.metric === 'side.torsoLean') {
    return { id: rule.metric, label: rule.label, value: 0, min: rule.min, max: rule.max, joint: 'hip', a: 'shoulder', b: 'hip', vertical: 'up' };
  }
  if (rule.metric === 'side.shoulderFlex') {
    return { id: rule.metric, label: rule.label, value: 0, min: rule.min, max: rule.max, joint: 'shoulder', a: 'elbow', b: 'elbow', vertical: 'down' };
  }
  return null;
};

const ControlSlider: React.FC<{
  control: ExerciseControl;
  value: number;
  onChange: (value: number) => void;
}> = ({ control, value, onChange }) => {
  const isBipolar = control.min < 0;
  return (
    <label className="block rounded-xl border border-[#223442] bg-[#0b131a] px-2.5 py-2">
      <span className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{control.label}</span>
        <span className="text-[10px] font-black text-slate-200">
          {isBipolar && value > 0 ? '+' : ''}
          {formatNumber(value, control.step < 0.1 ? 2 : 1)}
        </span>
      </span>
      <input
        type="range"
        min={control.min}
        max={control.max}
        step={control.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1.5 w-full accent-amber-400"
        aria-label={control.label}
      />
      <span className="flex justify-between text-[8px] text-slate-600">
        <span>{control.lowLabel}</span>
        <span>{control.highLabel}</span>
      </span>
      {control.hint && <span className="mt-0.5 block text-[8px] leading-snug text-slate-600">{control.hint}</span>}
    </label>
  );
};

export const TechniquePanel: React.FC<TechniquePanelProps> = ({
  exercise,
  dimensions,
  bodyWeightKg,
  profile,
  pastWorkouts,
  onUpdateBody,
  onSelectExercise,
  onOpenLibrary,
  onAskAi,
}) => {
  const [values, setValues] = useState<ControlValues>(() => defaultControlValues(exercise));
  const [weight, setWeight] = useState(0);
  const [oneRmDraft, setOneRmDraft] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatEntry[]>([]);

  const manualOneRm = profile.oneRepMaxKg?.[exercise.id];
  const sex = profile.sex || 'male';
  const oneRm = useMemo(
    () => estimateTechniqueOneRepMax(exercise, pastWorkouts, bodyWeightKg, sex, manualOneRm),
    [exercise, pastWorkouts, bodyWeightKg, sex, manualOneRm],
  );
  const step = exercise.equipment === 'barbell' || exercise.equipment === 'machine' ? 2.5 : 1;
  const weightMax =
    exercise.equipment === 'barbell'
      ? 300
      : exercise.equipment === 'dumbbell'
        ? 80
        : exercise.equipment === 'machine'
          ? 400
          : exercise.equipment === 'cable'
            ? 150
            : 80;

  useEffect(() => {
    setValues(defaultControlValues(exercise));
  }, [exercise]);

  useEffect(() => {
    setChatMessages([
      {
        id: 'intro',
        role: 'assistant',
        text: `Спросите про «${exercise.name}»: мышцы, углы, нагрузку, риски, пропорции или замену. Отвечаю по базе упражнения, без медицинских диагнозов.`,
      },
    ]);
  }, [exercise.id, exercise.name]);

  useEffect(() => {
    const target = exercise.equipment === 'bodyweight' ? 0 : oneRm.valueKg * 0.65;
    setWeight(Math.max(0, Math.round(target / step) * step));
  }, [exercise.id, exercise.equipment, oneRm.valueKg, step]);

  useEffect(() => {
    setOneRmDraft(manualOneRm !== undefined ? String(manualOneRm) : '');
  }, [exercise.id, manualOneRm]);

  const pose = useMemo(() => buildTechniquePose(exercise, values, dimensions), [exercise, values, dimensions]);
  const metrics = useMemo(() => computePoseMetrics(pose), [pose]);
  const intensities = useMemo(() => muscleIntensity(exercise, values), [exercise, values]);
  const shifts = useMemo(() => activeShifts(exercise, values), [exercise, values]);
  const notes = useMemo(() => proportionNotes(exercise, dimensions), [exercise, dimensions]);

  const angleRows = exercise.angles.map((rule) => {
    const raw = metrics[rule.metric as keyof typeof metrics];
    const value = typeof raw === 'number' ? raw : 0;
    return { rule, value, status: statusOf(value, rule) };
  });
  const angleSpecs = angleRows
    .map((row) => {
      const spec = specForRule(row.rule);
      return spec ? { ...spec, value: row.value } : null;
    })
    .filter((spec): spec is SkeletonAngleSpec => Boolean(spec));

  const geo = useMemo(() => buildSideGeometry(pose.side, dimensions), [pose.side, dimensions]);
  const anchor =
    equipmentAnchor(exercise) === 'shoulder'
      ? geo.shoulder
      : equipmentAnchor(exercise) === 'hip'
        ? geo.hip
        : ['legPress', 'legExtension', 'legCurl', 'standingCalfRaise', 'seatedCalfRaise', 'nordicCurl'].includes(exercise.id)
          ? geo.ankle
          : geo.hand;
  const momentArms = exercise.momentJoints.map((jointId) => {
    const jointPoint =
      jointId === 'hip'
        ? geo.hip
        : jointId === 'knee'
          ? geo.knee
          : jointId === 'ankle'
            ? geo.ankle
            : jointId === 'shoulder'
              ? geo.shoulder
              : jointId === 'elbow'
                ? geo.elbow
                : mixPoint(geo.hip, geo.shoulder, 0.5);
    return {
      joint: jointId,
      label: JOINT_LABELS[jointId],
      valueCm: Math.abs(jointPoint.x - anchor.x) / dimensions.scale,
    };
  });
  const maxMoment = momentArms.reduce((max, item) => Math.max(max, item.valueCm), 0);

  const loadKg = techniqueSystemLoad(exercise, bodyWeightKg, weight);
  const intensity = oneRm.valueKg > 0 ? Math.round((loadKg / oneRm.valueKg) * 1000) / 10 : 0;
  const zone = intensityZone(intensity);
  const zoneMeta = intensityMeta(intensity);

  const muscleUp = new Set<MuscleId>();
  const muscleDown = new Set<MuscleId>();
  for (const item of shifts) {
    for (const id of item.direction > 0 ? item.shift.up : item.shift.down) muscleUp.add(id);
    for (const id of item.direction > 0 ? item.shift.down : item.shift.up) muscleDown.add(id);
  }
  const muscleRows = (Object.keys(intensities) as MuscleId[])
    .filter((id) => (intensities[id] ?? 0) > 0)
    .sort((a, b) => (intensities[b] ?? 0) - (intensities[a] ?? 0));

  const saveOneRm = () => {
    const raw = oneRmDraft.trim().replace(',', '.');
    const map = { ...(profile.oneRepMaxKg || {}) };
    if (!raw) {
      delete map[exercise.id];
    } else {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 600) {
        setOneRmDraft(manualOneRm !== undefined ? String(manualOneRm) : '');
        return;
      }
      map[exercise.id] = Math.round(parsed * 10) / 10;
    }
    onUpdateBody({ ...profile, oneRepMaxKg: map });
  };

  const resetOneRm = () => {
    const map = { ...(profile.oneRepMaxKg || {}) };
    delete map[exercise.id];
    onUpdateBody({ ...profile, oneRepMaxKg: map });
    setOneRmDraft('');
  };

  const applyTarget = (percent: number) => {
    const target = (oneRm.valueKg * percent) / 100;
    const next = exercise.equipment === 'bodyweight' ? target - bodyWeightKg : target;
    setWeight(Math.max(0, Math.round(next / step) * step));
  };

  const askQuestion = (question: string) => {
    const text = question.trim();
    if (!text) return;
    const answer = techniqueAnswer(text, {
      exercise,
      values,
      oneRm,
      loadKg,
      intensity,
      angleRows,
      notes,
      dimensions,
    });
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    setChatMessages((prev) => [
      ...prev,
      { id: `u-${stamp}`, role: 'user', text },
      { id: `a-${stamp}`, role: 'assistant', text: answer },
    ]);
    setChatQuestion('');
  };

  const sourceList = exercise.sources.map((key) => SOURCES[key]);
  const DifficultyIcon = exercise.difficulty === 'advanced' ? ShieldAlert : exercise.difficulty === 'intermediate' ? Activity : CheckCircle2;

  return (
    <div id="tour-body-technique" className="space-y-3">
      <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-black text-slate-100">{exercise.name}</span>
              <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-bold text-amber-300">
                {CATEGORY_LABELS[exercise.category]}
              </span>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{exercise.summary}</p>
          </div>
          <button
            type="button"
            onClick={onOpenLibrary}
            className="shrink-0 rounded-xl border border-[#2b4050] bg-[#121c25] px-2.5 py-2 text-[9px] font-bold text-slate-300"
          >
            Все упражнения
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-lg border border-[#263a4a] bg-[#091117] px-2 py-1 text-[8px] font-semibold text-slate-400">
            <Dumbbell className="h-3 w-3 text-cyan-400" />
            {EQUIPMENT_LABELS[exercise.equipment]}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg border border-[#263a4a] bg-[#091117] px-2 py-1 text-[8px] font-semibold text-slate-400">
            <DifficultyIcon className="h-3 w-3 text-amber-400" />
            {DIFFICULTY_LABELS[exercise.difficulty]}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg border border-[#263a4a] bg-[#091117] px-2 py-1 text-[8px] font-semibold text-slate-400">
            <Ruler className="h-3 w-3 text-emerald-400" />
            {exercise.primary.map((id) => MUSCLES[id].label).slice(0, 2).join(' · ')}
          </span>
        </div>
        <label className="mt-2 block">
          <span className="mb-1 block text-[8px] font-semibold uppercase tracking-wider text-slate-600">Быстро сменить упражнение</span>
          <select
            value={exercise.id}
            onChange={(event) => onSelectExercise(event.target.value)}
            className="w-full rounded-xl border border-[#263a4a] bg-[#081016] px-2.5 py-2 text-[11px] font-semibold text-slate-200 outline-none focus:border-amber-500/50"
          >
            {EXERCISE_CATALOG.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Target className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-bold text-slate-200">Схема и углы</span>
          </div>
          <span className="text-[8px] uppercase tracking-wider text-slate-600">сбоку · по вашим замерам</span>
        </div>
        <div className="mt-2 flex justify-center">
          <SkeletonModel2D
            pose={pose}
            dimensions={dimensions}
            muscleIntensity={intensities}
            angles={angleSpecs}
            equipment={skeletonEquipment(exercise)}
            station={stationFor(exercise)}
          />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-[#1f303d] bg-[#091117] px-2 py-1.5">
          <span className="text-[8px] text-slate-500">Насыщеннее — больше вовлечённость:</span>
          {[
            { label: 'низкая', opacity: 0.18 },
            { label: 'средняя', opacity: 0.34 },
            { label: 'высокая', opacity: 0.54 },
          ].map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1 text-[8px] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e04a38]" style={{ opacity: item.opacity }} />
              {item.label}
            </span>
          ))}
          <span className="ml-auto text-[8px] text-slate-600">ориентир, не измерение</span>
        </div>
      </div>

      <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
        <div className="flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-bold text-slate-200">Настройки позиции</span>
        </div>
        <div className="mt-2 grid gap-2">
          {exercise.controls.map((control) => (
            <ControlSlider
              key={control.id}
              control={control}
              value={values[control.id] ?? control.defaultValue}
              onChange={(next) => setValues((prev) => ({ ...prev, [control.id]: next }))}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-bold text-slate-200">Карта мышц</span>
          </div>
          <span className="text-[8px] text-slate-600">ориентировочно</span>
        </div>
        <div className="mt-2 space-y-1.5">
          {muscleRows.map((id) => {
            const meta = MUSCLES[id];
            const value = intensities[id] ?? 0;
            const up = muscleUp.has(id);
            const down = muscleDown.has(id);
            return (
              <div key={id} className="space-y-0.5">
                <div className="flex items-center justify-between gap-2 text-[9px]">
                  <span className="flex items-center gap-1 font-semibold text-slate-300">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                    {meta.label}
                    {up && <ArrowUp className="h-2.5 w-2.5 text-rose-400" />}
                    {down && <ArrowDown className="h-2.5 w-2.5 text-cyan-400" />}
                  </span>
                  <span className="font-mono text-slate-500">{Math.round(value)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#162530]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, value)}%`, backgroundColor: meta.color, opacity: 0.8 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[9px] leading-relaxed text-slate-600">
          Это качественная карта, а не электромиография. Она показывает, куда смещается акцент при изменении позиции.
        </p>
      </div>

      <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
        <div className="flex items-center gap-1.5">
          <ArrowUp className="h-4 w-4 text-rose-400" />
          <span className="text-xs font-bold text-slate-200">Куда смещается нагрузка</span>
        </div>
        {shifts.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-[#263a4a] bg-[#091117] px-2.5 py-3 text-[9px] leading-relaxed text-slate-500">
            Подвигайте ползунки — здесь появятся стрелки: какие мышцы и суставы получают больше или меньше нагрузки.
          </p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {shifts.map((item) => (
              <div key={item.shift.controlId} className="rounded-xl border border-[#223442] bg-[#0b131a] px-2.5 py-2">
                <div className="flex items-start gap-1.5">
                  {item.direction > 0 ? (
                    <ArrowUp className="mt-0.5 h-3 w-3 shrink-0 text-rose-400" />
                  ) : (
                    <ArrowDown className="mt-0.5 h-3 w-3 shrink-0 text-cyan-400" />
                  )}
                  <p className="text-[9px] leading-snug text-slate-300">{item.text}</p>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(item.direction > 0 ? item.shift.up : item.shift.down).map((id) => (
                    <span key={`up-${id}`} className="rounded bg-rose-500/10 px-1 py-0.5 text-[8px] font-semibold text-rose-300">
                      {MUSCLES[id].label} ↑
                    </span>
                  ))}
                  {(item.direction > 0 ? item.shift.down : item.shift.up).map((id) => (
                    <span key={`down-${id}`} className="rounded bg-cyan-500/10 px-1 py-0.5 text-[8px] font-semibold text-cyan-300">
                      {MUSCLES[id].label} ↓
                    </span>
                  ))}
                  {(item.direction > 0 ? item.shift.jointsUp : item.shift.jointsDown).map((id) => (
                    <span key={`joint-up-${id}`} className="rounded bg-amber-500/10 px-1 py-0.5 text-[8px] font-semibold text-amber-300">
                      {JOINT_LABELS[id]} ↑
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <details className="group mt-2 rounded-xl border border-[#1f303d] bg-[#091117] px-2.5 py-2">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[9px] font-bold text-slate-400">
            <Info className="h-3 w-3 text-cyan-400" />
            Что меняет каждый ползунок
            <ChevronDown className="ml-auto h-3 w-3 text-slate-500 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-1.5 space-y-1.5">
            {exercise.shifts.map((rule) => {
              const control = exercise.controls.find((item) => item.id === rule.controlId);
              if (!control) return null;
              return (
                <div key={rule.controlId} className="text-[8px] leading-snug text-slate-500">
                  <div className="font-bold text-slate-400">{control.label}</div>
                  <div><span className="text-rose-400">↑</span> {rule.highText}</div>
                  <div><span className="text-cyan-400">↓</span> {rule.lowText}</div>
                </div>
              );
            })}
          </div>
        </details>
      </div>

      <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Ruler className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-200">Углы и плечи моментов</span>
          </div>
          <span className="text-[8px] text-slate-600">2D-геометрия</span>
        </div>
        <div className="mt-2 space-y-1.5">
          {angleRows.map((row) => (
            <div key={row.rule.metric} className={`rounded-xl border px-2.5 py-2 ${angleStatusClass(row.status)}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-slate-200">{row.rule.label}</span>
                <span className="text-[11px] font-black">{row.value}°</span>
              </div>
              <div className="mt-0.5 text-[8px] opacity-70">
                коридор {row.rule.min}–{row.rule.max}° · ориентир {row.rule.ideal}
              </div>
              {row.status !== 'pass' && <div className="mt-1 text-[8px] leading-snug opacity-80">{row.rule.advice}</div>}
            </div>
          ))}
        </div>
        {momentArms.length > 0 && (
          <div className="mt-2 space-y-1.5 rounded-xl border border-[#1f303d] bg-[#091117] px-2.5 py-2">
            <div className="text-[8px] font-semibold uppercase tracking-wider text-slate-500">
              Плечо момента: чем больше см, тем выше требование к суставу
            </div>
            {momentArms.map((item) => (
              <div key={item.joint} className="space-y-0.5">
                <div className="flex items-center justify-between gap-2 text-[9px]">
                  <span className="text-slate-300">{item.label}</span>
                  <span className="font-mono text-slate-400">{formatNumber(item.valueCm)} см</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-[#162530]">
                  <div
                    className="h-full rounded-full bg-amber-400/80"
                    style={{ width: `${maxMoment > 0 ? Math.min(100, (item.valueCm / maxMoment) * 100) : 0}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="text-[8px] leading-snug text-slate-600">
              Это горизонтальное расстояние от сустава до линии нагрузки. Не путать с усилием мышцы и не считать риском травмы.
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Scale className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-bold text-slate-200">Нагрузка</span>
          </div>
          <span className="rounded-lg border px-2 py-1 text-[9px] font-black" style={{ color: zoneMeta.color, borderColor: `${zoneMeta.color}55`, backgroundColor: `${zoneMeta.color}18` }}>
            {zoneMeta.label}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-[#223442] bg-[#0b131a] px-2.5 py-2">
            <div className="text-[8px] uppercase tracking-wider text-slate-500">1ПМ</div>
            <div className="mt-0.5 text-lg font-black text-slate-100">
              {formatNumber(oneRm.valueKg)} <span className="text-[9px] font-medium text-slate-500">кг</span>
            </div>
            <div className="text-[8px] text-slate-500">{oneRm.source === 'history' ? 'из истории' : oneRm.source === 'manual' ? 'вручную' : 'ориентир по весу'}</div>
            <div className="mt-0.5 text-[8px] leading-snug text-slate-600">{oneRm.basis}</div>
          </div>
          <div className="rounded-xl border border-[#223442] bg-[#0b131a] px-2.5 py-2">
            <div className="text-[8px] uppercase tracking-wider text-slate-500">{exercise.equipment === 'bodyweight' ? 'Свой вес + доп.' : 'Рабочий вес'}</div>
            <div className="mt-0.5 text-lg font-black text-slate-100">
              {formatNumber(loadKg)} <span className="text-[9px] font-medium text-slate-500">кг</span>
            </div>
            <div className="text-[8px] text-slate-500">{Math.round(intensity)}% от 1ПМ</div>
          </div>
        </div>
        <label className="mt-2 block">
          <span className="flex items-center justify-between text-[9px]">
            <span className="font-semibold uppercase tracking-wider text-slate-500">
              {exercise.equipment === 'bodyweight' ? 'Дополнительный вес' : 'Вес'}
            </span>
            <span className="font-bold text-slate-200">{formatNumber(weight)} кг</span>
          </span>
          <input
            id="body-technique-weight"
            type="range"
            min={0}
            max={weightMax}
            step={step}
            value={weight}
            onChange={(event) => setWeight(Number(event.target.value))}
            className="mt-1 w-full accent-cyan-400"
            aria-label="Рабочий вес"
          />
        </label>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {[55, 70, 82].map((percent) => (
            <button
              key={percent}
              type="button"
              onClick={() => applyTarget(percent)}
              className="rounded-lg border border-[#263a4a] bg-[#0b131a] px-1 py-1.5 text-[9px] font-semibold text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300"
            >
              {percent}% 1ПМ
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-end gap-1.5">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-[8px] font-semibold uppercase tracking-wider text-slate-500">Свой 1ПМ, кг</span>
            <input
              id="body-technique-1rm"
              type="text"
              inputMode="decimal"
              value={oneRmDraft}
              onChange={(event) => setOneRmDraft(event.target.value)}
              onBlur={saveOneRm}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  saveOneRm();
                  (event.target as HTMLInputElement).blur();
                }
              }}
              placeholder={formatNumber(oneRm.valueKg)}
              className="w-full rounded-xl border border-[#263a4a] bg-[#081016] px-2.5 py-2 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <button id="body-technique-1rm-save" type="button" onClick={saveOneRm} className="rounded-xl bg-cyan-500/15 px-2.5 py-2 text-[10px] font-bold text-cyan-300">
            Сохранить
          </button>
          {manualOneRm !== undefined && (
            <button id="body-technique-1rm-reset" type="button" onClick={resetOneRm} className="inline-flex items-center gap-1 rounded-xl border border-[#263a4a] px-2 py-2 text-[10px] font-semibold text-slate-400">
              <RefreshCw className="h-3 w-3" />
              Сброс
            </button>
          )}
        </div>
        <div className="relative mt-2 flex h-2 overflow-hidden rounded-full">
          {INTENSITY_ORDER.map((item) => (
            <div
              key={item}
              style={{
                width: `${INTENSITY_SPAN[item]}%`,
                backgroundColor: INTENSITY_META[item].color,
                opacity: item === zone ? 0.95 : 0.35,
              }}
            />
          ))}
          <div className="absolute -top-0.5 h-3 w-1 -translate-x-1/2 rounded-full bg-slate-100 shadow" style={{ left: `${Math.max(1, Math.min(100, intensity))}%` }} />
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {INTENSITY_ORDER.map((item) => (
            <span key={item} className={`inline-flex items-center gap-1 text-[8px] ${item === zone ? 'font-bold text-slate-200' : 'text-slate-500'}`}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: INTENSITY_META[item].color }} />
              {INTENSITY_META[item].short} — {INTENSITY_META[item].label}
            </span>
          ))}
        </div>
        <p className="mt-1.5 text-[9px] leading-relaxed text-slate-600">{zoneMeta.description}</p>
        <p className="mt-1 text-[9px] leading-relaxed text-slate-600">
          Для упражнений с собственным весом 1ПМ — это общая нагрузка системы: тело плюс добавка. Без истории приложение берёт ориентир от веса тела.
        </p>
      </div>

      <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
        <div className="flex items-center gap-1.5">
          <Info className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-bold text-slate-200">Как выполнять</span>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-300">{exercise.setup}</p>
        <ol className="mt-2 space-y-1.5">
          {exercise.execution.map((step, index) => (
            <li key={step} className="flex items-start gap-1.5 text-[9px] leading-snug text-slate-400">
              <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-[8px] font-black text-cyan-300">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <div className="rounded-lg border border-[#1f303d] bg-[#091117] px-2 py-1.5">
            <div className="text-[7px] uppercase tracking-wider text-slate-600">Дыхание</div>
            <div className="mt-0.5 text-[8px] leading-snug text-slate-400">{exercise.breathing}</div>
          </div>
          <div className="rounded-lg border border-[#1f303d] bg-[#091117] px-2 py-1.5">
            <div className="text-[7px] uppercase tracking-wider text-slate-600">Темп</div>
            <div className="mt-0.5 text-[8px] leading-snug text-slate-400">{exercise.tempo}</div>
          </div>
          <div className="rounded-lg border border-[#1f303d] bg-[#091117] px-2 py-1.5">
            <div className="text-[7px] uppercase tracking-wider text-slate-600">Амплитуда</div>
            <div className="mt-0.5 text-[8px] leading-snug text-slate-400">{exercise.rom}</div>
          </div>
        </div>
        <div className="mt-2 space-y-1">
          {exercise.mistakes.map((mistake) => (
            <div key={mistake.title} className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-2 py-1.5">
              <div className="text-[9px] font-bold text-amber-200">{mistake.title}</div>
              <div className="text-[8px] leading-snug text-amber-100/70">{mistake.text}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
        <div className="flex items-center gap-1.5">
          <ShieldAlert className="h-4 w-4 text-rose-400" />
          <span className="text-xs font-bold text-slate-200">Риски и что с ними делать</span>
        </div>
        <div className="mt-2 space-y-1.5">
          {exercise.risks.map((item) => {
            const Icon = riskIcon(item.level);
            return (
              <details key={item.title} className={`group rounded-xl border px-2.5 py-2 ${riskTone(item.level)}`}>
                <summary className="flex cursor-pointer list-none items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 text-[10px] font-bold">{item.title}</span>
                  <ChevronDown className="h-3 w-3 shrink-0 opacity-60 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-1.5 space-y-1 text-[8px] leading-snug opacity-80">
                  <p>{item.text}</p>
                  <p className="font-semibold">Что снижает риск: {item.prevention}</p>
                </div>
              </details>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-3">
        <div className="flex items-center gap-1.5">
          <Ruler className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-bold text-emerald-200">Под ваши пропорции</span>
        </div>
        {notes.length === 0 ? (
          <p className="mt-2 text-[9px] leading-relaxed text-slate-400">
            Пропорции близки к типичным. Настройки можно подбирать по комфорту и контролю.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {notes.map((note) => (
              <li key={note} className="flex items-start gap-1.5 text-[9px] leading-snug text-slate-300">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                {note}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[8px] leading-relaxed text-slate-500">
          Это эвристика по длинам сегментов, а не индивидуальный медицинский вывод. Подбирайте по ощущению, контролю и боли.
        </p>
      </div>

      <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <MessageCircle className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-bold text-slate-200">Вопросы по упражнению</span>
          </div>
          <span className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2 py-1 text-[8px] font-bold text-cyan-300">
            чат по базе
          </span>
        </div>
        <div className="mt-2 space-y-1.5">
          {exercise.faq.map((item, index) => (
            <div key={item.question} className="rounded-xl border border-[#223442] bg-[#0b131a]">
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left"
              >
                <span className="text-[10px] font-semibold text-slate-300">{item.question}</span>
                <ChevronDown className={`h-3 w-3 shrink-0 text-slate-500 transition-transform ${openFaq === index ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === index && <p className="px-2.5 pb-2 text-[9px] leading-relaxed text-slate-400">{item.answer}</p>}
            </div>
          ))}
        </div>

        <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-[#1f303d] bg-[#091117] p-2">
          {chatMessages.map((entry) => (
            <div key={entry.id} className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[92%] rounded-xl px-2.5 py-1.5 text-[9px] leading-relaxed ${
                  entry.role === 'user'
                    ? 'bg-emerald-500/15 text-emerald-100'
                    : 'bg-[#121c25] text-slate-300'
                }`}
              >
                {entry.role === 'assistant' && (
                  <span className="mb-0.5 flex items-center gap-1 text-[8px] font-bold text-cyan-300">
                    <Bot className="h-2.5 w-2.5" />
                    разбор
                  </span>
                )}
                <span className="whitespace-pre-line">{entry.text}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            {[
              'Почему может тянуть поясницу?',
              'Как сместить нагрузку на ягодицы?',
              'Что делать с моими пропорциями?',
              'Какой вес выбрать?',
            ].map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => askQuestion(question)}
                className="rounded-lg border border-[#263a4a] bg-[#091117] px-2 py-1 text-[8px] font-semibold text-slate-400 hover:text-emerald-300"
              >
                {question}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={chatQuestion}
              onChange={(event) => setChatQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && chatQuestion.trim()) {
                  askQuestion(chatQuestion);
                }
              }}
              placeholder="Свой вопрос по схеме..."
              className="min-w-0 flex-1 rounded-xl border border-[#263a4a] bg-[#081016] px-2.5 py-2 text-[10px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-500/50"
            />
            <button
              type="button"
              disabled={!chatQuestion.trim()}
              onClick={() => askQuestion(chatQuestion)}
              className="shrink-0 rounded-xl bg-emerald-500/15 px-2.5 py-2 text-[9px] font-bold text-emerald-300 disabled:opacity-40"
            >
              Спросить
            </button>
          </div>
          <p className="text-[8px] leading-snug text-slate-600">
            Ответы собираются из базы упражнения и ваших данных. Это не медицинская диагностика.
          </p>
        </div>
      </div>

      <details className="group rounded-xl border border-[#223442] bg-[#0d151c] px-3 py-2">
        <summary className="flex cursor-pointer list-none items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-[10px] font-bold text-slate-300">Источники и оговорки</span>
          <ChevronDown className="ml-auto h-3 w-3 text-slate-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-2 space-y-1.5">
          {sourceList.map((source) => (
            <div key={source.label} className="text-[8px] leading-snug text-slate-500">
              <span className="font-semibold text-slate-400">{source.label}.</span> {source.note}
            </div>
          ))}
          <p className="text-[8px] leading-relaxed text-amber-200/70">{DISCLAIMER}</p>
        </div>
      </details>

      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[9px] leading-relaxed text-amber-200/75">
        <ShieldAlert className="mr-1 inline h-3 w-3" />
        Острая боль, онемение, прострел, нестабильность сустава или боль в груди — остановитесь и обратитесь к специалисту.
      </div>
    </div>
  );
};

interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

interface AnswerContext {
  exercise: TechniqueExercise;
  values: ControlValues;
  oneRm: { valueKg: number; source: string; bodyweightIncluded: boolean; basis: string };
  loadKg: number;
  intensity: number;
  angleRows: Array<{ rule: AngleRule; value: number; status: 'pass' | 'near' | 'fail' }>;
  notes: string[];
  dimensions: BodyDimensions;
}

const hasAny = (text: string, words: string[]): boolean => words.some((word) => text.includes(word));

const techniqueAnswer = (question: string, ctx: AnswerContext): string => {
  const text = question.toLowerCase().replace(/ё/g, 'е');
  const { exercise, angleRows, notes } = ctx;
  const angleText = angleRows.map((row) => `${row.rule.label}: ${row.value}° (${row.status === 'pass' ? 'в коридоре' : row.status === 'near' ? 'у границы' : 'вне коридора'})`).join('; ');
  const muscleText = exercise.primary.map((id) => MUSCLES[id].label).join(', ');
  const secondaryText = exercise.secondary.map((id) => MUSCLES[id].label).join(', ');

  if (hasAny(text, ['боль', 'болит', 'травм', 'онемен', 'прострел', 'хруст', 'щелк'])) {
    const specific = exercise.risks.find((risk) => hasAny(risk.title.toLowerCase(), text.split(/\s+/).filter((word) => word.length > 4)));
    return [
      'Если есть острая боль, онемение, прострел, ощущение нестабильности или боль в груди — остановитесь и обратитесь к врачу. Это не диагностика.',
      specific ? `По этому упражнению отдельно стоит следить за: «${specific.title}». ${specific.prevention}` : '',
      'Снизьте вес и амплитуду, не работайте через боль. Если боль повторяется, обсудите движение со специалистом.',
    ].filter(Boolean).join('\n\n');
  }

  if (hasAny(text, ['поясниц', 'спин', 'пояснич'])) {
    const related = exercise.shifts.filter((shift) => shift.jointsUp.includes('spine') || shift.up.includes('spinalErectors') || shift.up.includes('core'));
    const rule = exercise.angles.find((angle) => angle.metric === 'side.torsoLean');
    return [
      related.length ? `На поясницу в этом упражнении сильнее всего влияет: ${related.map((shift) => shift.highText).join(' ')}` : 'В этом упражнении поясница не является главным ограничением, но нейтральная спина всё равно важна.',
      rule ? `Сейчас наклон корпуса ${ctx.angleRows.find((row) => row.rule.metric === rule.metric)?.value ?? 0}°, ориентир ${rule.ideal}.` : '',
      'Держите кор жёстким, не округляйте спину и уменьшите вес/амплитуду, если контроль теряется.',
    ].filter(Boolean).join('\n\n');
  }

  if (hasAny(text, ['колен', 'колено'])) {
    const knee = exercise.risks.find((risk) => hasAny((risk.title + risk.text).toLowerCase(), ['колен', 'пателл']));
    const kneeRule = exercise.angles.find((angle) => angle.metric === 'side.kneeFlex');
    return [
      kneeRule ? `Сейчас сгибание колена ${ctx.angleRows.find((row) => row.rule.metric === kneeRule.metric)?.value ?? 0}°, коридор ${kneeRule.min}–${kneeRule.max}°, ориентир ${kneeRule.ideal}.` : '',
      knee ? `Что важно: ${knee.title}. ${knee.text} ${knee.prevention}` : 'Следите, чтобы колено не заваливалось внутрь и не уходило в боль.',
      'Увеличивайте глубину постепенно. Если колено болит, уменьшите амплитуду и проверьте технику у специалиста.',
    ].filter(Boolean).join('\n\n');
  }

  if (hasAny(text, ['плеч', 'импиндж', 'дельт', 'жим'])) {
    const shoulder = exercise.risks.find((risk) => hasAny((risk.title + risk.text).toLowerCase(), ['плеч', 'импиндж']));
    return [
      shoulder ? `Ключевой риск: ${shoulder.title}. ${shoulder.text}` : 'Для плеча важны комфортная амплитуда и контроль лопатки.',
      shoulder ? `Что снижает риск: ${shoulder.prevention}` : 'Не работайте через боль и не форсируйте глубину.',
      exercise.equipment === 'barbell' && exercise.category.includes('Push')
        ? 'Если болит передняя часть плеча, попробуйте чуть более узкий хват, локти ближе к корпусу и меньшую глубину.'
        : '',
    ].filter(Boolean).join('\n\n');
  }

  if (hasAny(text, ['ягод', 'поп', 'задниц'])) {
    const related = exercise.shifts.filter((shift) => shift.up.includes('glutes'));
    return [
      'Ягодичные лучше включаются, когда таз уходит назад, а корпус наклоняется при жёсткой спине. Но не превращайте движение в другое упражнение.',
      related.length ? `В этом упражнении: ${related.map((shift) => shift.highText).join(' ')}` : 'В этом упражнении ягодичные уже участвуют, но их акцент зависит от позиции.',
      'Если цель — ягодицы, добавьте hip thrust или болгарский сплит-присед; они дают другой акцент.',
    ].filter(Boolean).join('\n\n');
  }

  if (hasAny(text, ['квадриц', 'бедр', 'передн'])) {
    const related = exercise.shifts.filter((shift) => shift.up.includes('quads'));
    return [
      related.length ? `Квадрицепс сильнее включается: ${related.map((shift) => shift.highText).join(' ')}` : 'Квадрицепс в этом упражнении работает как основная или вспомогательная мышца.',
      'Для большего акцента на квадрицепс часто помогают более вертикальный корпус, контролируемая глубина и работа через полную стопу.',
      'Если колено реагирует болью, не увеличивайте амплитуду через боль.',
    ].filter(Boolean).join('\n\n');
  }

  if (hasAny(text, ['вес', '1пм', 'сколько', 'нагруз', 'процент', 'повтор'])) {
    return [
      `Сейчас: 1ПМ ${formatNumber(ctx.oneRm.valueKg)} кг (${ctx.oneRm.source === 'history' ? 'из истории' : ctx.oneRm.source === 'manual' ? 'вручную' : 'ориентир по весу'}), рабочий вес ${formatNumber(ctx.loadKg)} кг, это ${Math.round(ctx.intensity)}% 1ПМ.`,
      'Ориентиры: 60–75% — техника и объём, 75–85% — силовая работа, выше 85% — близко к максимуму. Для новых движений начинайте с 50–65% и добавляйте вес только при стабильной технике.',
      exercise.equipment === 'bodyweight' ? 'Для собственного веса 1ПМ включает массу тела; добавка считается сверху.' : 'Если 1ПМ неизвестен, поставьте его вручную или начните с комфортного веса и оцените по RPE 6–7.',
    ].join('\n\n');
  }

  if (hasAny(text, ['рост', 'длин', 'корот', 'пропорц', 'рычаг', 'конечност'])) {
    return notes.length
      ? `${notes.join(' ')}\n\nЭто ориентир по длинам сегментов, а не индивидуальный медицинский вывод.`
      : 'Ваши длины близки к типичным. Подбирайте позицию по комфорту, контролю и отсутствию боли.';
  }

  if (hasAny(text, ['амплитуд', 'глубин', 'диапазон', 'угол', 'техник'])) {
    return [
      `Текущие углы: ${angleText}.`,
      `Ориентир по амплитуде: ${exercise.rom}`,
      'Если угол выходит за коридор, сначала уменьшите вес или амплитуду, а не тянитесь через боль.',
    ].join('\n\n');
  }

  if (hasAny(text, ['замен', 'аналог', 'чем заменить', 'если нет'])) {
    const alternatives = EXERCISE_CATALOG.filter(
      (item) =>
        item.id !== exercise.id &&
        (item.category === exercise.category || item.primary.some((id) => exercise.primary.includes(id))),
    ).slice(0, 3);
    return `Похожие варианты: ${alternatives.map((item) => item.name).join(', ')}. Выберите тот, который доступен по инвентарю и не вызывает боли.`;
  }

  if (hasAny(text, ['риск', 'опасн', 'травм', 'сорв', 'импиндж'])) {
    return exercise.risks
      .map((risk) => `• ${risk.title}: ${risk.text} Что снижает риск: ${risk.prevention}`)
      .join('\n\n');
  }

  if (hasAny(text, ['мышц', 'работает', 'напряг', 'актив'])) {
    return `Основные: ${muscleText}. Вспомогательные: ${secondaryText || 'нет выраженных'}. Это ориентировочная карта, а не измерение активации.`;
  }

  if (hasAny(text, ['дых'])) return exercise.breathing;

  if (hasAny(text, ['как делать', 'выполн', 'техника', 'ошиб'])) {
    return [
      exercise.setup,
      ...exercise.execution.map((step, index) => `${index + 1}. ${step}`),
      exercise.mistakes.length ? `Частые ошибки: ${exercise.mistakes.map((item) => item.title).join('; ')}.` : '',
    ].filter(Boolean).join('\n');
  }

  const faq = exercise.faq.find((item) => {
    const q = item.question.toLowerCase().replace(/ё/g, 'е');
    const words = q.split(/\s+/).filter((word) => word.length > 5);
    return words.some((word) => text.includes(word));
  });
  if (faq) return faq.answer;

  return `По «${exercise.name}» я могу разобрать: мышцы, углы, нагрузку, риски, пропорции, замену и типичные ошибки. Уточните вопрос — например, «почему тянет поясницу» или «как сместить на ягодицы».`;
};

function mixPoint(a: { x: number; y: number }, b: { x: number; y: number }, t: number) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

