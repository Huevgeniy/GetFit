import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  Eye,
  Info,
  Minus,
  Pause,
  Pencil,
  PersonStanding,
  Play,
  Plus,
  RefreshCw,
  Ruler,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import type { BodyMeasurementEntry, BodyProfile, UserProfile, WorkoutRecord } from '../types';
import {
  BODY_METRIC_FIELDS,
  BODY_TREND_OPTIONS,
  BodyDimensions,
  BodyMetricId,
  BodyMetricKey,
  BodyView,
  BodyPose,
  EXERCISE_PRESETS,
  ExerciseEvaluation,
  GrowthRow,
  JointLoad,
  LIVE_METRICS,
  LOAD_LEVEL_COLOR,
  LoadJoint,
  LoadLevel,
  MomentArm,
  MuscleVolume,
  ProportionInsight,
  SIMULATION_EXERCISES,
  SimulationExercise,
  SimulationSeriesPoint,
  TrendKey,
  buildFrontGeometry,
  buildGrowthRows,
  buildProportionInsights,
  buildSideGeometry,
  computeBodyDimensions,
  computePoseMetrics,
  createDefaultPose,
  estimateMomentArms,
  estimateSimulationLoads,
  evaluateExercise,
  exerciseById,
  formatDateLong,
  formatDateShort,
  latestMeasurement,
  loadLevel,
  loadLevelLabel,
  measurementSeries,
  measurementValue,
  muscleVolumesFromWorkouts,
  normalizeBodyProfile,
  poseForExercise,
  previousMeasurement,
  scanSimulation,
  simulationById,
  simulationPose,
  simulationSeries,
} from '../lib/bodyModel';
import { getTelegramPhotoUrl, hapticImpact, hapticNotify, hapticSelect } from '../lib/telegram';
import { BodyModel2D } from './BodyModel2D';
import { BodyMeasurementForm } from './BodyMeasurementForm';
import { BodyAvatarModal } from './BodyAvatarModal';

interface BodyBiomechanicsViewProps {
  user: UserProfile;
  pastWorkouts: WorkoutRecord[];
  onUpdateUser: (updated: Partial<UserProfile>) => void;
}

type BodyTab = 'measurements' | 'model' | 'exercises' | 'simulation' | 'analysis';

const BODY_TABS: Array<{
  id: BodyTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tourId: string;
}> = [
  { id: 'measurements', label: 'Замеры', icon: Ruler, tourId: 'body-tab-measurements' },
  { id: 'model', label: 'Модель', icon: PersonStanding, tourId: 'body-tab-model' },
  { id: 'exercises', label: 'Упражнения', icon: Dumbbell, tourId: 'body-tab-exercises' },
  { id: 'simulation', label: 'Симуляция', icon: Play, tourId: 'body-tab-simulation' },
  { id: 'analysis', label: 'Анализ', icon: Activity, tourId: 'body-tab-analysis' },
];

const LOAD_LEVEL_RANK: Record<LoadLevel, number> = {
  low: 0,
  moderate: 1,
  high: 2,
  veryHigh: 3,
};

const formatNumber = (value: number, digits = 1): string => {
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  return String(rounded).replace('.', ',');
};

const loadIndexColor = (index: number): string => {
  if (index >= 0.42) return LOAD_LEVEL_COLOR.veryHigh;
  if (index >= 0.3) return LOAD_LEVEL_COLOR.high;
  if (index >= 0.18) return LOAD_LEVEL_COLOR.moderate;
  return LOAD_LEVEL_COLOR.low;
};

const formatVolume = (kg: number): string => {
  if (kg >= 1000) return `${formatNumber(kg / 1000, 2)} т`;
  return `${Math.round(kg)} кг`;
};

const deltaLabel = (delta: number | undefined, unit: string): string => {
  if (delta === undefined) return '—';
  if (Math.abs(delta) < 0.05) return `0 ${unit}`;
  return `${delta > 0 ? '+' : ''}${formatNumber(delta)} ${unit}`;
};

const statusColor = (status?: 'pass' | 'near' | 'fail'): string => {
  if (status === 'fail') return 'text-rose-300 border-rose-500/35 bg-rose-500/10';
  if (status === 'near') return 'text-amber-300 border-amber-500/35 bg-amber-500/10';
  return 'text-emerald-300 border-emerald-500/35 bg-emerald-500/10';
};

const insightTone = (status: ProportionInsight['status']): string => {
  if (status === 'strong') return 'border-emerald-500/35 bg-emerald-500/8 text-emerald-300';
  if (status === 'balanced') return 'border-cyan-500/30 bg-cyan-500/8 text-cyan-300';
  return 'border-amber-500/35 bg-amber-500/8 text-amber-300';
};

const metricStatusMap = (evaluation: ExerciseEvaluation): Partial<Record<BodyMetricId, 'pass' | 'near' | 'fail'>> => {
  const map: Partial<Record<BodyMetricId, 'pass' | 'near' | 'fail'>> = {};
  for (const result of evaluation.results) {
    const previous = map[result.metric];
    if (previous === 'fail') continue;
    map[result.metric] = result.status;
  }
  return map;
};

const DeltaBadge: React.FC<{ delta?: number; unit: string }> = ({ delta, unit }) => {
  if (delta === undefined) {
    return <span className="text-[10px] text-slate-600">нет прошлого замера</span>;
  }
  const Icon = delta > 0.05 ? TrendingUp : delta < -0.05 ? TrendingDown : Minus;
  const tone =
    delta > 0.05 ? 'text-emerald-400' : delta < -0.05 ? 'text-rose-400' : 'text-slate-500';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${tone}`}>
      <Icon className="h-3 w-3" />
      {deltaLabel(delta, unit)}
    </span>
  );
};

const MiniStat: React.FC<{
  label: string;
  value: string;
  unit?: string;
  delta?: number;
  deltaUnit?: string;
}> = ({ label, value, unit, delta, deltaUnit = 'см' }) => (
  <div className="rounded-xl border border-[#223442] bg-[#0b131a] px-3 py-2.5">
    <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
    <div className="mt-0.5 flex items-baseline gap-1">
      <span className="text-lg font-black text-slate-100">{value}</span>
      {unit && <span className="text-[10px] text-slate-500">{unit}</span>}
    </div>
    <div className="mt-0.5">
      <DeltaBadge delta={delta} unit={deltaUnit} />
    </div>
  </div>
);

const TrendChart: React.FC<{ points: Array<{ date: string; value: number }>; unit: string }> = ({
  points,
  unit,
}) => {
  const gradientId = `trend-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  if (points.length < 2) {
    return (
      <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-[#263a4a] bg-[#091117] px-4 text-center text-[11px] text-slate-500">
        Нужно минимум два замера, чтобы увидеть динамику.
      </div>
    );
  }
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.1, max - min);
  const width = 300;
  const height = 96;
  const x = (index: number): number => 8 + (index / (points.length - 1)) * (width - 16);
  const y = (value: number): number => 8 + (1 - (value - min) / span) * (height - 20);
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point.value)}`).join(' ');
  const area = `${line} L ${x(points.length - 1)} ${height - 4} L ${x(0)} ${height - 4} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={`Динамика замеров в ${unit}`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((row) => (
        <line
          key={row}
          x1={8}
          y1={8 + (row / 3) * (height - 20)}
          x2={width - 8}
          y2={8 + (row / 3) * (height - 20)}
          stroke="#1b2c38"
          strokeDasharray="2 6"
        />
      ))}
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="#34d399" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point, index) => (
        <circle key={`${point.date}-${index}`} cx={x(index)} cy={y(point.value)} r={2.6} fill="#081016" stroke="#6ee7b7" strokeWidth={1.5}>
          <title>{`${formatDateLong(point.date)}: ${formatNumber(point.value)} ${unit}`}</title>
        </circle>
      ))}
      <text x={8} y={height - 1} fill="#446070" fontSize={7}>
        {formatDateShort(points[0].date)}
      </text>
      <text x={width - 8} y={height - 1} fill="#446070" fontSize={7} textAnchor="end">
        {formatDateShort(points[points.length - 1].date)}
      </text>
    </svg>
  );
};

const SimulationLoadChart: React.FC<{
  points: SimulationSeriesPoint[];
  phase: number;
}> = ({ points, phase }) => {
  const gradientId = `sim-load-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const width = 300;
  const height = 92;
  const maxValue = Math.max(0.55, ...points.map((point) => point.maxIndex));
  const x = (value: number): number => 6 + value * (width - 12);
  const y = (value: number): number => 8 + (1 - Math.min(1, value / maxValue)) * (height - 22);
  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.phase).toFixed(1)} ${y(point.maxIndex).toFixed(1)}`)
    .join(' ');
  const area = `${line} L ${x(1)} ${height - 14} L ${x(0)} ${height - 14} Z`;
  const zones = [
    { from: 0, to: 0.18, color: LOAD_LEVEL_COLOR.low },
    { from: 0.18, to: 0.3, color: LOAD_LEVEL_COLOR.moderate },
    { from: 0.3, to: 0.42, color: LOAD_LEVEL_COLOR.high },
    { from: 0.42, to: maxValue, color: LOAD_LEVEL_COLOR.veryHigh },
  ];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="График нагрузки по фазе упражнения"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </linearGradient>
      </defs>
      {zones.map((zone) => {
        const top = y(zone.to);
        const bottom = y(zone.from);
        return (
          <rect
            key={`zone-${zone.from}`}
            x={6}
            y={top}
            width={width - 12}
            height={Math.max(0, bottom - top)}
            fill={zone.color}
            opacity={0.08}
          />
        );
      })}
      <line x1={6} y1={y(0.42)} x2={width - 6} y2={y(0.42)} stroke={LOAD_LEVEL_COLOR.veryHigh} strokeDasharray="3 4" opacity={0.55} />
      <line x1={6} y1={y(0.3)} x2={width - 6} y2={y(0.3)} stroke={LOAD_LEVEL_COLOR.high} strokeDasharray="3 4" opacity={0.45} />
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="#38bdf8" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point, index) => (
        <circle
          key={`sim-point-${index}`}
          cx={x(point.phase)}
          cy={y(point.maxIndex)}
          r={2.3}
          fill="#081016"
          stroke={loadIndexColor(point.maxIndex)}
          strokeWidth={1.6}
        />
      ))}
      <line
        x1={x(phase)}
        y1={6}
        x2={x(phase)}
        y2={height - 14}
        stroke="#e2e8f0"
        strokeWidth={1}
        strokeDasharray="2 3"
        opacity={0.65}
      />
      <text x={6} y={height - 3} fill="#446070" fontSize={7}>
        верх
      </text>
      <text x={width - 6} y={height - 3} fill="#446070" fontSize={7} textAnchor="end">
        низ
      </text>
    </svg>
  );
};

const MetricReadout: React.FC<{
  label: string;
  value: number;
  unit: string;
  status?: 'pass' | 'near' | 'fail';
  hint?: string;
}> = ({ label, value, unit, status, hint }) => (
  <div className={`rounded-xl border px-2.5 py-2 ${status ? statusColor(status) : 'border-[#223442] bg-[#0b131a] text-slate-300'}`}>
    <div className="text-[9px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
    <div className="mt-0.5 text-base font-black">
      {Math.round(value)} <span className="text-[10px] font-medium opacity-70">{unit}</span>
    </div>
    {hint && <div className="mt-0.5 text-[9px] leading-tight opacity-70">{hint}</div>}
  </div>
);

const RuleRow: React.FC<{ result: ExerciseEvaluation['results'][number] }> = ({ result }) => {
  const tone =
    result.status === 'fail'
      ? 'border-rose-500/30 bg-rose-500/5'
      : result.status === 'near'
        ? 'border-amber-500/25 bg-amber-500/5'
        : 'border-[#223442] bg-[#0b131a]';
  const Icon = result.status === 'fail' ? AlertCircle : result.status === 'near' ? AlertTriangle : CheckCircle2;
  const iconTone = result.status === 'fail' ? 'text-rose-400' : result.status === 'near' ? 'text-amber-400' : 'text-emerald-400';
  const span = Math.max(1, result.max - result.min);
  const marker = Math.max(0, Math.min(100, ((result.value - result.min) / span) * 100));

  return (
    <div className={`rounded-xl border p-2.5 ${tone}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-1.5">
          <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${iconTone}`} />
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-200">{result.label}</div>
            <div className="text-[9px] text-slate-500">
              безопасно {result.min}–{result.max}° · ориентир {result.ideal}
            </div>
          </div>
        </div>
        <span className={`shrink-0 text-xs font-black ${iconTone}`}>
          {result.value}°
        </span>
      </div>
      <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-[#162530]">
        <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-emerald-500/20" />
        <div
          className={`absolute -top-0.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-[#081016] ${
            result.status === 'fail' ? 'bg-rose-400' : result.status === 'near' ? 'bg-amber-400' : 'bg-emerald-400'
          }`}
          style={{ left: `${marker}%` }}
        />
      </div>
      {result.status === 'fail' && (
        <div className="mt-1.5 text-[9px] leading-snug text-rose-200/80">{result.advice}</div>
      )}
    </div>
  );
};

const MomentArmRow: React.FC<{ arm: MomentArm }> = ({ arm }) => {
  const tone =
    arm.level === 'high'
      ? 'bg-amber-400'
      : arm.level === 'moderate'
        ? 'bg-emerald-400'
        : 'bg-cyan-400';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="font-semibold text-slate-300">{arm.label}</span>
        <span className="font-mono text-slate-400">{formatNumber(arm.valueCm)} см</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#162530]">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, (arm.ratio / 0.28) * 100)}%` }} />
      </div>
      <div className="text-[9px] text-slate-600">{arm.note}</div>
    </div>
  );
};

const InsightCard: React.FC<{ insight: ProportionInsight }> = ({ insight }) => (
  <div className={`rounded-xl border p-2.5 ${insightTone(insight.status)}`}>
    <div className="flex items-start justify-between gap-2">
      <span className="text-[10px] font-bold text-slate-200">{insight.title}</span>
      <span className="shrink-0 text-[11px] font-black">{insight.value}</span>
    </div>
    <p className="mt-1 text-[9px] leading-snug opacity-80">{insight.hint}</p>
  </div>
);

const SymmetryRow: React.FC<{
  label: string;
  left?: number;
  right?: number;
}> = ({ label, left, right }) => {
  if (left === undefined && right === undefined) return null;
  const max = Math.max(left || 0, right || 0) || 1;
  const percent =
    left !== undefined && right !== undefined
      ? Math.round((Math.abs(left - right) / Math.max(left, right, 0.1)) * 1000) / 10
      : undefined;
  return (
    <div className="rounded-xl border border-[#223442] bg-[#0b131a] p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-300">{label}</span>
        <span
          className={`text-[10px] font-black ${
            percent === undefined ? 'text-slate-600' : percent <= 3 ? 'text-emerald-400' : percent <= 6 ? 'text-amber-400' : 'text-rose-400'
          }`}
        >
          {percent === undefined ? '—' : `${formatNumber(percent)}%`}
        </span>
      </div>
      <div className="mt-1.5 space-y-1">
        {[
          { side: 'Л', value: left, color: 'bg-cyan-400' },
          { side: 'П', value: right, color: 'bg-emerald-400' },
        ].map((row) => (
          <div key={row.side} className="flex items-center gap-2">
            <span className="w-3 text-[9px] text-slate-500">{row.side}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#162530]">
              <div
                className={`h-full rounded-full ${row.color}`}
                style={{ width: `${Math.min(100, ((row.value || 0) / max) * 100)}%` }}
              />
            </div>
            <span className="w-10 text-right font-mono text-[9px] text-slate-400">
              {row.value !== undefined ? formatNumber(row.value) : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const VolumeRow: React.FC<{ volume: MuscleVolume; max: number }> = ({ volume, max }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: volume.color }} />
        <span className="text-[10px] font-semibold text-slate-300">{volume.label}</span>
        <span className="text-[9px] text-slate-600">{volume.sessions} тр.</span>
      </div>
      <span className="font-mono text-[10px] text-slate-400">{formatVolume(volume.volumeKg)}</span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-[#162530]">
      <div
        className="h-full rounded-full"
        style={{ width: `${max > 0 ? (volume.volumeKg / max) * 100 : 0}%`, backgroundColor: volume.color }}
      />
    </div>
  </div>
);

const GrowthRowView: React.FC<{ row: GrowthRow }> = ({ row }) => (
  <div className="rounded-xl border border-[#223442] bg-[#0b131a] p-2.5">
    <div className="flex items-start justify-between gap-2">
      <div>
        <div className="text-[10px] font-bold text-slate-300">{row.label}</div>
        <div className="text-[9px] text-slate-600">
          {formatDateShort(row.baselineDate)} → {formatDateShort(row.currentDate)}
        </div>
      </div>
      <span
        className={`text-[11px] font-black ${
          row.status === 'grow' ? 'text-emerald-400' : row.status === 'down' ? 'text-rose-400' : 'text-slate-500'
        }`}
      >
        {row.deltaCm > 0 ? '+' : ''}
        {formatNumber(row.deltaCm)} см
      </span>
    </div>
    <div className="mt-1.5 flex items-center justify-between text-[9px] text-slate-500">
      <span>{formatNumber(row.currentCm)} см сейчас</span>
      <span>{row.volumeKg > 0 ? `${formatVolume(row.volumeKg)} объёма` : 'нет объёма в периоде'}</span>
    </div>
    {row.volumeKg > 0 && (
      <div className="mt-0.5 text-[9px] text-slate-600">
        {formatNumber(row.ratioCmPerTon, 2)} см на тонну нагрузки
      </div>
    )}
  </div>
);

const buildRecommendations = (
  profile: BodyProfile,
  insights: ProportionInsight[],
  volumes: MuscleVolume[],
  hasMeasurements: boolean,
): string[] => {
  if (!hasMeasurements) {
    return [
      'Добавьте первый замер: вес, талия, грудь и плечи уже дадут базовую картину.',
      'Укажите рост во вкладке «Модель» — от него строятся все пропорции.',
    ];
  }
  const tips: string[] = [];
  const totalVolume = volumes.reduce((sum, item) => sum + item.volumeKg, 0);
  if (totalVolume <= 0) {
    tips.push('Ведите тренировки в приложении: тогда появится сравнение объёма по группам мышц с ростом замеров.');
  }
  const grow = insights.filter((insight) => insight.status === 'grow');
  if (grow.some((insight) => insight.id === 'symmetry')) {
    tips.push('Добавьте одностороннюю работу на слабую сторону: болгарский выпад, тягу одной рукой или жим гантели.');
  }
  if (grow.some((insight) => insight.id === 'v-taper' || insight.id === 'shoulder-hip')) {
    tips.push('Для верха: 2–3 подхода махов в стороны и тяги к лицу в неделю, без роста талии.');
  }
  if (grow.some((insight) => insight.id === 'thigh-calf')) {
    tips.push('Для голеней: 2–3 подхода подъёмов на носки с паузой в верхней точке.');
  }
  if (grow.some((insight) => insight.id === 'bicep-forearm')) {
    tips.push('Для рук: добавьте сгибания на бицепс и отдельную работу на хват/предплечье.');
  }
  if (insights.some((insight) => insight.status === 'strong') && tips.length < 3) {
    tips.push('Сильные пропорции уже есть — сохраняйте текущий объём и следите за восстановлением.');
  }
  if (profile.measurements.length < 3) {
    tips.push('Повторяйте замеры раз в 2–4 недели в одинаковых условиях, чтобы видеть тренд, а не шум.');
  }
  return tips.slice(0, 4);
};

export const BodyBiomechanicsView: React.FC<BodyBiomechanicsViewProps> = ({
  user,
  pastWorkouts,
  onUpdateUser,
}) => {
  const profile = useMemo(() => normalizeBodyProfile(user.bodyProfile), [user.bodyProfile]);
  const [tab, setTab] = useState<BodyTab>('measurements');
  const [view, setView] = useState<BodyView>('side');
  const [pose, setPose] = useState<BodyPose>(() => createDefaultPose());
  const [selectedExerciseId, setSelectedExerciseId] = useState('squat');
  const [appliedExerciseId, setAppliedExerciseId] = useState<string | null>(null);
  const [showAngles, setShowAngles] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BodyMeasurementEntry | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [avatarHint, setAvatarHint] = useState<string | null>(null);
  const [analysisDays, setAnalysisDays] = useState(90);
  const [trendKey, setTrendKey] = useState<TrendKey>('waistCm');
  const [simExerciseId, setSimExerciseId] = useState('squat');
  const [simWeight, setSimWeight] = useState(60);
  const [simAmplitude, setSimAmplitude] = useState(1);
  const [simPhase, setSimPhase] = useState(0);
  const [simPlaying, setSimPlaying] = useState(false);
  const simPhaseRef = useRef(0);
  simPhaseRef.current = simPhase;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const latest = latestMeasurement(profile);
  const previous = previousMeasurement(profile);
  const dimensions = useMemo(() => computeBodyDimensions(profile), [profile]);
  const exercise = exerciseById(selectedExerciseId) || EXERCISE_PRESETS[0];
  const evaluation = useMemo(() => evaluateExercise(exercise, pose), [exercise, pose]);
  const metrics = useMemo(() => computePoseMetrics(pose), [pose]);
  const sideGeometry = useMemo(() => buildSideGeometry(pose.side, dimensions), [pose.side, dimensions]);
  const frontGeometry = useMemo(() => buildFrontGeometry(pose.front, dimensions), [pose.front, dimensions]);
  const momentArms = useMemo(
    () => estimateMomentArms(exercise.id, sideGeometry, frontGeometry, dimensions),
    [exercise.id, sideGeometry, frontGeometry, dimensions],
  );
  const visibleMetrics = LIVE_METRICS.filter((metric) => metric.view === view);
  const statusByMetric = useMemo(() => metricStatusMap(evaluation), [evaluation]);
  const bodyWeight = latest?.weightKg || user.currentWeight || 0;
  const simExercise = simulationById(simExerciseId) || SIMULATION_EXERCISES[0];
  const simBodyWeight = bodyWeight > 0 ? bodyWeight : 75;
  const simPose = useMemo(
    () => simulationPose(simExercise, simPhase * simAmplitude, dimensions),
    [simExercise, simPhase, simAmplitude, dimensions],
  );
  const simLoads = useMemo(
    () => estimateSimulationLoads(simExercise, simPose, dimensions, simBodyWeight, simWeight),
    [simExercise, simPose, dimensions, simBodyWeight, simWeight],
  );
  const simScan = useMemo(
    () => scanSimulation(simExercise, dimensions, simBodyWeight, simWeight, 1),
    [simExercise, dimensions, simBodyWeight, simWeight],
  );
  const simSeries = useMemo(
    () => simulationSeries(simExercise, dimensions, simBodyWeight, simWeight, 29),
    [simExercise, dimensions, simBodyWeight, simWeight],
  );
  const simHeat = useMemo(() => {
    const result: Partial<Record<LoadJoint, LoadLevel>> = {};
    for (const load of simLoads) {
      const previousLevel = result[load.joint];
      if (!previousLevel || LOAD_LEVEL_RANK[load.level] > LOAD_LEVEL_RANK[previousLevel]) {
        result[load.joint] = load.level;
      }
    }
    return result;
  }, [simLoads]);
  const simPeak = simLoads.reduce((best, load) => (load.index > best.index ? load : best), simLoads[0]);
  const simSelectedPeakIndex = useMemo(() => {
    let peak = 0;
    for (const point of simSeries) {
      if (point.phase <= simAmplitude + 0.0001) peak = Math.max(peak, point.maxIndex);
    }
    return Math.max(peak, ...simLoads.map((load) => load.index));
  }, [simSeries, simAmplitude, simLoads]);
  const simSelectedLevel = loadLevel(simSelectedPeakIndex);
  const simEquipment = {
    kind: simExercise.equipment,
    weightKg: simWeight,
    anchor: simExercise.id === 'squat' ? ('shoulder' as const) : ('hand' as const),
  };

  useEffect(() => {
    if (!simPlaying) return;
    let raf = 0;
    let last = performance.now();
    let direction = 1;
    let phase = simPhaseRef.current >= 0.995 ? 0 : simPhaseRef.current;
    const tick = (now: number) => {
      const delta = Math.min(80, Math.max(0, now - last));
      last = now;
      phase += direction * (delta / 1500);
      if (phase >= 1) {
        phase = 1;
        direction = -1;
      }
      if (phase <= 0) {
        phase = 0;
        direction = 1;
      }
      simPhaseRef.current = phase;
      setSimPhase(phase);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [simPlaying]);
  const volumes = useMemo(
    () => muscleVolumesFromWorkouts(pastWorkouts, analysisDays, bodyWeight),
    [pastWorkouts, analysisDays, bodyWeight],
  );
  const growthRows = useMemo(
    () => buildGrowthRows(profile, pastWorkouts, analysisDays, bodyWeight),
    [profile, pastWorkouts, analysisDays, bodyWeight],
  );
  const insights = useMemo(() => buildProportionInsights(profile), [profile]);
  const totalVolume = volumes.reduce((sum, item) => sum + item.volumeKg, 0);
  const maxVolume = volumes.reduce((max, item) => Math.max(max, item.volumeKg), 0);
  const trendOption = BODY_TREND_OPTIONS.find((option) => option.key === trendKey) || BODY_TREND_OPTIONS[0];
  const trendPoints = measurementSeries(profile, trendKey);
  const recommendations = buildRecommendations(profile, insights, volumes, Boolean(latest));

  const updateBody = (next: BodyProfile, extra: Partial<UserProfile> = {}) => {
    onUpdateUser({ bodyProfile: next, ...extra });
  };

  const openNewMeasurement = () => {
    hapticImpact('light');
    setEditingEntry(null);
    setFormOpen(true);
  };

  const openEditMeasurement = (entry: BodyMeasurementEntry) => {
    hapticImpact('light');
    setEditingEntry(entry);
    setFormOpen(true);
  };

  const handleSaveMeasurement = (entry: BodyMeasurementEntry) => {
    const measurements = [entry, ...profile.measurements.filter((item) => item.id !== entry.id)];
    const next = normalizeBodyProfile({ ...profile, measurements });
    updateBody(next, entry.weightKg !== undefined ? { currentWeight: entry.weightKg } : {});
    setFormOpen(false);
    setEditingEntry(null);
    hapticNotify('success');
  };

  const handleDeleteMeasurement = (entry: BodyMeasurementEntry) => {
    const confirmed =
      typeof window === 'undefined' || typeof window.confirm !== 'function'
        ? true
        : window.confirm(`Удалить замер от ${formatDateLong(entry.date)}?`);
    if (!confirmed) return;
    hapticImpact('medium');
    updateBody({
      ...profile,
      measurements: profile.measurements.filter((item) => item.id !== entry.id),
    });
  };

  const handleHeightChange = (raw: string) => {
    const parsed = Number(raw.replace(',', '.'));
    const heightCm =
      Number.isFinite(parsed) && parsed >= 100 && parsed <= 250 ? Math.round(parsed) : undefined;
    updateBody(
      { ...profile, heightCm },
      heightCm !== undefined ? { heightCm } : {},
    );
  };

  const handleSexChange = (sex: 'male' | 'female') => {
    hapticSelect();
    updateBody({ ...profile, sex });
  };

  const handleAvatarFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarHint('Выберите файл изображения.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setAvatarHint('Файл больше 12 МБ — выберите фото поменьше.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarSrc(typeof reader.result === 'string' ? reader.result : null);
      setAvatarHint(null);
    };
    reader.onerror = () => setAvatarHint('Не удалось прочитать файл.');
    reader.readAsDataURL(file);
  };

  const handleTelegramPhoto = () => {
    const photo = getTelegramPhotoUrl();
    if (!photo) {
      setAvatarHint('В Telegram нет доступного фото. Загрузите файл вручную.');
      return;
    }
    hapticNotify('success');
    updateBody({ ...profile, avatarUrl: photo });
    setAvatarHint('Фото взято из профиля Telegram.');
  };

  const applyExercise = (id: string) => {
    const preset = exerciseById(id);
    if (!preset) return;
    hapticSelect();
    setSelectedExerciseId(id);
    setAppliedExerciseId(id);
    setPose(poseForExercise(preset));
    setView(preset.view);
  };

  const handleTabChange = (next: BodyTab) => {
    hapticSelect();
    setTab(next);
    if (next !== 'simulation') setSimPlaying(false);
    if (next === 'exercises' && !appliedExerciseId) applyExercise(selectedExerciseId);
  };

  const chooseSimulation = (id: string) => {
    const next = simulationById(id);
    if (!next) return;
    hapticSelect();
    setSimExerciseId(id);
    setSimPhase(0);
    setSimPlaying(false);
    setSimWeight(next.equipment === 'barbell' ? 60 : next.equipment === 'dumbbell' ? 20 : 0);
  };

  const resetFreePose = () => {
    hapticImpact('light');
    setPose(createDefaultPose());
    setAppliedExerciseId(null);
  };

  const applyReferencePose = () => {
    hapticImpact('light');
    setPose(poseForExercise(exercise));
    setView(exercise.view);
    setAppliedExerciseId(exercise.id);
  };

  const latestMetricRows = BODY_METRIC_FIELDS.filter(
    (field) => measurementValue(latest, field.key) !== undefined,
  );

  return (
    <div className="space-y-3 pb-6">
      {formOpen && (
        <BodyMeasurementForm
          key={editingEntry?.id || 'new'}
          initial={editingEntry}
          heightCm={profile.heightCm || user.heightCm}
          onSave={handleSaveMeasurement}
          onClose={() => {
            setFormOpen(false);
            setEditingEntry(null);
          }}
        />
      )}
      {avatarSrc && (
        <BodyAvatarModal
          src={avatarSrc}
          onSave={(dataUrl) => {
            updateBody({ ...profile, avatarUrl: dataUrl });
            setAvatarSrc(null);
            setAvatarHint('Фото сохранено в профиле.');
            hapticNotify('success');
          }}
          onClose={() => setAvatarSrc(null)}
        />
      )}

      {/* Шапка раздела */}
      <div
        id="tour-body-header"
        className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/45 via-[#0f1b22] to-cyan-950/25 p-3.5"
      >
        <div className="absolute -right-12 -top-14 h-36 w-36 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/10 text-emerald-300">
              <PersonStanding className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-black tracking-tight text-slate-100">Тело и биомеханика</div>
              <p className="mt-0.5 text-[10px] leading-snug text-slate-400">
                Замеры, пропорции и безопасные углы. Модель — схема, а не медицинская диагностика.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleTabChange('model')}
            className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-emerald-400/40 bg-[#13212b] text-emerald-300"
            aria-label="Открыть модель тела"
          >
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Фото для модели" className="h-full w-full object-cover" />
            ) : (
              <PersonStanding className="h-6 w-6" />
            )}
          </button>
        </div>
        <div className="relative mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-[#263b49]/70 bg-[#091217]/60 px-2 py-1.5">
            <div className="text-sm font-black text-slate-100">{profile.measurements.length}</div>
            <div className="text-[8px] uppercase tracking-wider text-slate-500">замеров</div>
          </div>
          <div className="rounded-xl border border-[#263b49]/70 bg-[#091217]/60 px-2 py-1.5">
            <div className="text-sm font-black text-slate-100">{profile.heightCm ? `${profile.heightCm}` : '—'}</div>
            <div className="text-[8px] uppercase tracking-wider text-slate-500">рост, см</div>
          </div>
          <div className="rounded-xl border border-[#263b49]/70 bg-[#091217]/60 px-2 py-1.5">
            <div className="text-sm font-black text-emerald-300">
              {latest?.weightKg ? formatNumber(latest.weightKg) : '—'}
            </div>
            <div className="text-[8px] uppercase tracking-wider text-slate-500">вес, кг</div>
          </div>
        </div>
      </div>

      {/* Вкладки */}
      <div
        id="tour-body-tabs"
        className="grid grid-cols-5 gap-1 rounded-2xl border border-[#223442] bg-[#0a1218] p-1"
      >
        {BODY_TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              id={item.tourId}
              type="button"
              onClick={() => handleTabChange(item.id)}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[9px] font-semibold transition-colors ${
                active
                  ? 'bg-emerald-500/15 text-emerald-300 shadow-inner shadow-emerald-500/10'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* ---------------- Замеры ---------------- */}
      {tab === 'measurements' && (
        <div id="tour-body-measurements" className="space-y-3">
          {!latest ? (
            <div className="rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                <Ruler className="h-6 w-6" />
              </div>
              <div className="mt-2 text-sm font-bold text-slate-100">Начните с первого замера</div>
              <p className="mx-auto mt-1 max-w-xs text-[10px] leading-relaxed text-slate-400">
                Вес, талия, грудь и плечи уже позволяют построить модель и увидеть пропорции.
                Обхваты рук и ног можно добавить позже.
              </p>
              <button
                id="body-add-measurement-empty"
                type="button"
                onClick={openNewMeasurement}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/20"
              >
                <Plus className="h-3.5 w-3.5" />
                Добавить замер
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <MiniStat
                  label="Вес"
                  value={latest.weightKg ? formatNumber(latest.weightKg) : '—'}
                  unit="кг"
                  delta={
                    latest.weightKg !== undefined && previous?.weightKg !== undefined
                      ? Math.round((latest.weightKg - previous.weightKg) * 10) / 10
                      : undefined
                  }
                  deltaUnit="кг"
                />
                <MiniStat
                  label="Талия"
                  value={latest.waistCm ? formatNumber(latest.waistCm) : '—'}
                  unit="см"
                  delta={
                    latest.waistCm !== undefined && previous?.waistCm !== undefined
                      ? Math.round((latest.waistCm - previous.waistCm) * 10) / 10
                      : undefined
                  }
                />
                <MiniStat
                  label="Грудь"
                  value={latest.chestCm ? formatNumber(latest.chestCm) : '—'}
                  unit="см"
                  delta={
                    latest.chestCm !== undefined && previous?.chestCm !== undefined
                      ? Math.round((latest.chestCm - previous.chestCm) * 10) / 10
                      : undefined
                  }
                />
                <MiniStat
                  label="Плечи"
                  value={latest.shouldersCm ? formatNumber(latest.shouldersCm) : '—'}
                  unit="см"
                  delta={
                    latest.shouldersCm !== undefined && previous?.shouldersCm !== undefined
                      ? Math.round((latest.shouldersCm - previous.shouldersCm) * 10) / 10
                      : undefined
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-2 rounded-xl border border-[#223442] bg-[#0a1218] px-3 py-2">
                <div className="text-[10px] text-slate-400">
                  Последний замер: <span className="font-semibold text-slate-200">{formatDateLong(latest.date)}</span>
                </div>
                <button
                  id="body-add-measurement"
                  type="button"
                  onClick={openNewMeasurement}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[10px] font-bold text-slate-950"
                >
                  <Plus className="h-3 w-3" />
                  Новый
                </button>
              </div>
            </>
          )}

          {latest && (
            <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200">Динамика</span>
                </div>
                <select
                  id="body-trend-select"
                  value={trendKey}
                  onChange={(event) => setTrendKey(event.target.value as TrendKey)}
                  className="rounded-lg border border-[#263a4a] bg-[#081016] px-2 py-1 text-[10px] font-semibold text-slate-300 outline-none"
                >
                  {BODY_TREND_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2">
                <TrendChart points={trendPoints} unit={trendOption.unit} />
              </div>
              {trendPoints.length >= 2 && (
                <div className="mt-1 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[9px] text-slate-600">начало</div>
                    <div className="text-[11px] font-bold text-slate-300">
                      {formatNumber(trendPoints[0].value)} {trendOption.unit}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-600">сейчас</div>
                    <div className="text-[11px] font-bold text-slate-200">
                      {formatNumber(trendPoints[trendPoints.length - 1].value)} {trendOption.unit}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-600">дельта</div>
                    <div
                      className={`text-[11px] font-black ${
                        trendPoints[trendPoints.length - 1].value - trendPoints[0].value >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {deltaLabel(
                        Math.round(
                          (trendPoints[trendPoints.length - 1].value - trendPoints[0].value) * 10,
                        ) / 10,
                        trendOption.unit,
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {latest && latestMetricRows.length > 0 && (
            <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-200">Все обхваты</div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditMeasurement(latest)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#263a4a] text-slate-400 hover:text-cyan-300"
                    aria-label="Изменить последний замер"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteMeasurement(latest)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#263a4a] text-slate-400 hover:text-rose-300"
                    aria-label="Удалить последний замер"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {latestMetricRows.map((field) => {
                  const current = latest[field.key] as number;
                  const before = previous?.[field.key] as number | undefined;
                  const delta =
                    before !== undefined ? Math.round((current - before) * 10) / 10 : undefined;
                  return (
                    <div
                      key={field.key}
                      className="flex items-center justify-between rounded-lg border border-[#1f303d] bg-[#091117] px-2 py-1.5"
                    >
                      <span className="text-[9px] text-slate-500">{field.short}</span>
                      <span className="text-[10px] font-bold text-slate-300">
                        {formatNumber(current)}
                        {delta !== undefined && (
                          <span
                            className={`ml-1 text-[9px] font-semibold ${
                              delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-slate-600'
                            }`}
                          >
                            {delta > 0 ? '+' : ''}
                            {formatNumber(delta)}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
              {latest.notes && (
                <div className="mt-2 rounded-lg border border-[#1f303d] bg-[#091117] px-2 py-1.5 text-[9px] leading-snug text-slate-400">
                  {latest.notes}
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Ruler className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-200">История замеров</span>
              </div>
              <span className="text-[9px] text-slate-600">{profile.measurements.length}</span>
            </div>
            <div className="mt-2 space-y-1.5">
              {profile.measurements.length === 0 && (
                <div className="py-6 text-center text-[10px] text-slate-500">
                  Замеров пока нет. Добавьте первый — история появится здесь.
                </div>
              )}
              {[...profile.measurements]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((entry) => {
                  const summary = BODY_METRIC_FIELDS.filter(
                    (field) => measurementValue(entry, field.key) !== undefined,
                  )
                    .slice(0, 3)
                    .map((field) => `${field.short} ${formatNumber(measurementValue(entry, field.key) as number)}`)
                    .join(' · ');
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-[#1f303d] bg-[#091117] px-2.5 py-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-300">{formatDateLong(entry.date)}</span>
                          {entry.weightKg !== undefined && (
                            <span className="rounded bg-emerald-500/10 px-1 py-0.5 text-[9px] font-semibold text-emerald-300">
                              {formatNumber(entry.weightKg)} кг
                            </span>
                          )}
                        </div>
                        <div className="truncate text-[9px] text-slate-600">{summary || 'без обхватов'}</div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => openEditMeasurement(entry)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#263a4a] text-slate-500 hover:text-cyan-300"
                          aria-label={`Изменить замер ${entry.date}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMeasurement(entry)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#263a4a] text-slate-500 hover:text-rose-300"
                          aria-label={`Удалить замер ${entry.date}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Модель ---------------- */}
      {tab === 'model' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
            <div className="flex items-center gap-1.5">
              <Target className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-bold text-slate-200">Пропорции модели</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-slate-500">Рост, см</span>
                <input
                  id="body-height-input"
                  type="number"
                  min={100}
                  max={250}
                  value={profile.heightCm ?? ''}
                  onChange={(event) => handleHeightChange(event.target.value)}
                  placeholder="175"
                  className="w-full rounded-xl border border-[#263a4a] bg-[#081016] px-3 py-2 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-500/60"
                />
              </label>
              <div>
                <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-slate-500">Телосложение</span>
                <div className="grid grid-cols-2 gap-1 rounded-xl border border-[#263a4a] bg-[#081016] p-1">
                  {[
                    { id: 'male' as const, label: 'Муж.' },
                    { id: 'female' as const, label: 'Жен.' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      id={`body-sex-${option.id}`}
                      type="button"
                      onClick={() => handleSexChange(option.id)}
                      className={`rounded-lg px-2 py-1.5 text-[10px] font-semibold transition-colors ${
                        (profile.sex || 'male') === option.id
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-[#1f303d] bg-[#091117] p-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-cyan-500/30 bg-[#13212b] text-cyan-300">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="Фото для головы модели" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold text-slate-200">Лицо на модели</div>
                <div className="text-[8px] leading-snug text-slate-500">
                  Фото из Telegram или файл. Можно подвинуть и увеличить.
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#2b4050] bg-[#121c25] px-2 py-1 text-[9px] font-semibold text-slate-300 hover:text-cyan-300"
                >
                  <Upload className="h-2.5 w-2.5" />
                  Файл
                </button>
                <button
                  type="button"
                  onClick={handleTelegramPhoto}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#2b4050] bg-[#121c25] px-2 py-1 text-[9px] font-semibold text-slate-300 hover:text-cyan-300"
                >
                  <Camera className="h-2.5 w-2.5" />
                  Telegram
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFile}
                className="hidden"
              />
            </div>
            {profile.avatarUrl && (
              <button
                type="button"
                onClick={() => updateBody({ ...profile, avatarUrl: undefined })}
                className="mt-1.5 text-[9px] font-semibold text-slate-500 hover:text-rose-300"
              >
                Убрать фото
              </button>
            )}
            {avatarHint && <div className="mt-1.5 text-[9px] leading-snug text-cyan-300/80">{avatarHint}</div>}
          </div>

          <div id="tour-body-model" className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <PersonStanding className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200">2D-модель</span>
              </div>
              <div className="flex gap-1 rounded-lg border border-[#263a4a] bg-[#081016] p-0.5">
                {[
                  { id: 'side' as const, label: 'Сбоку' },
                  { id: 'front' as const, label: 'Спереди' },
                ].map((option) => (
                  <button
                    key={option.id}
                    id={`body-view-${option.id}`}
                    type="button"
                    onClick={() => {
                      hapticSelect();
                      setView(option.id);
                    }}
                    className={`rounded-md px-2 py-1 text-[9px] font-semibold ${
                      view === option.id ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-500'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {appliedExerciseId && appliedExerciseId === exercise.id ? (
              <button
                type="button"
                onClick={() => handleTabChange('exercises')}
                className="mt-2 flex w-full items-center justify-between gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-2.5 py-1.5 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[9px] font-bold text-emerald-300">{exercise.name}</span>
                  <span className="block truncate text-[8px] text-slate-500">{exercise.checkpoint}</span>
                </span>
                <ChevronRight className="h-3 w-3 shrink-0 text-emerald-400" />
              </button>
            ) : (
              <div className="mt-2 rounded-lg border border-[#1f303d] bg-[#091117] px-2.5 py-1.5 text-[9px] text-slate-500">
                Свободная поза. Выберите упражнение во вкладке «Упражнения», чтобы включить проверку углов.
              </div>
            )}

            <div className="mt-2 flex justify-center">
              <BodyModel2D
                view={view}
                pose={pose}
                dimensions={dimensions}
                avatarUrl={profile.avatarUrl}
                showAngles={showAngles}
                evaluation={appliedExerciseId === exercise.id ? evaluation : null}
                onChangePose={setPose}
              />
            </div>

            <div className="mt-1 flex items-center justify-between gap-2 rounded-xl border border-[#1f303d] bg-[#091117] px-2.5 py-2">
              <div className="flex items-center gap-1 text-[9px] text-slate-500">
                <Info className="h-3 w-3 text-cyan-400" />
                Тяните таз для приседа, маркеры — суставы
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    hapticImpact('light');
                    setShowAngles((value) => !value);
                  }}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-semibold ${
                    showAngles
                      ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                      : 'border-[#263a4a] text-slate-500'
                  }`}
                >
                  <Eye className="h-2.5 w-2.5" />
                  Углы
                </button>
                <button
                  type="button"
                  onClick={resetFreePose}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#263a4a] px-2 py-1 text-[9px] font-semibold text-slate-400"
                >
                  <RefreshCw className="h-2.5 w-2.5" />
                  Стойка
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
            <div className="flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-bold text-slate-200">Углы сейчас</span>
              <span className="ml-auto text-[8px] uppercase tracking-wider text-slate-600">
                {view === 'side' ? 'сбоку' : 'спереди'}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {visibleMetrics.map((metric) => (
                <MetricReadout
                  key={metric.id}
                  label={metric.short}
                  value={metrics[metric.id]}
                  unit={metric.unit}
                  status={
                    appliedExerciseId === exercise.id ? statusByMetric[metric.id] : undefined
                  }
                  hint={metric.label}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[9px] leading-relaxed text-amber-200/75">
            <ShieldCheck className="mr-1 inline h-3 w-3" />
            Модель использует рост и обхваты для приблизительных пропорций. Она не показывает
            реальную кость, сустав или степень повреждения. При боли или ограничении движения
            обратитесь к врачу или тренеру.
          </div>
        </div>
      )}

      {/* ---------------- Упражнения ---------------- */}
      {tab === 'exercises' && (
        <div id="tour-body-exercises" className="space-y-3">
          <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Dumbbell className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-200">Упражнение</span>
              </div>
              <span className="text-[9px] text-slate-600">{EXERCISE_PRESETS.length} пресетов</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {EXERCISE_PRESETS.map((preset) => {
                const active = preset.id === selectedExerciseId;
                return (
                  <button
                    key={preset.id}
                    id={`body-exercise-${preset.id}`}
                    type="button"
                    onClick={() => applyExercise(preset.id)}
                    className={`rounded-xl border p-2 text-left transition-colors ${
                      active
                        ? 'border-emerald-500/45 bg-emerald-500/10 text-emerald-300'
                        : 'border-[#223442] bg-[#0b131a] text-slate-300 hover:border-cyan-500/30'
                    }`}
                  >
                    <div className="text-[10px] font-bold">{preset.name}</div>
                    <div className={`mt-0.5 text-[8px] ${active ? 'text-emerald-400/70' : 'text-slate-600'}`}>
                      {preset.focus}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-black text-slate-100">{exercise.name}</div>
                <div className="mt-0.5 text-[9px] text-slate-500">{exercise.checkpoint}</div>
              </div>
              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/10">
                <span className="text-lg font-black text-emerald-300">{evaluation.score}</span>
                <span className="text-[7px] uppercase tracking-wider text-emerald-500/70">из 100</span>
              </div>
            </div>
            <div
              className={`mt-2 rounded-xl border px-2.5 py-2 ${
                evaluation.tone === 'risk'
                  ? 'border-rose-500/35 bg-rose-500/8 text-rose-200'
                  : evaluation.tone === 'attention'
                    ? 'border-amber-500/35 bg-amber-500/8 text-amber-200'
                    : 'border-emerald-500/35 bg-emerald-500/8 text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[11px] font-bold">
                {evaluation.tone === 'risk' ? (
                  <AlertCircle className="h-3.5 w-3.5" />
                ) : evaluation.tone === 'attention' ? (
                  <AlertTriangle className="h-3.5 w-3.5" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {evaluation.headline}
              </div>
              <div className="mt-0.5 text-[9px] opacity-75">
                {evaluation.passed} в коридоре · {evaluation.near} у границы · {evaluation.failed} вне
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-400">{exercise.cue}</p>
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={applyReferencePose}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-500 px-2 py-2 text-[10px] font-bold text-slate-950"
              >
                <RefreshCw className="h-3 w-3" />
                Эталонная поза
              </button>
              <button
                type="button"
                onClick={() => {
                  setView(exercise.view);
                  setTab('model');
                }}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-[#263a4a] bg-[#121c25] px-2 py-2 text-[10px] font-semibold text-slate-300"
              >
                <PersonStanding className="h-3 w-3" />
                Открыть модель
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-bold text-slate-200">Проверка техники</span>
              <span className="ml-auto text-[8px] uppercase tracking-wider text-slate-600">
                {exercise.view === 'side' ? 'вид сбоку' : 'вид спереди'}
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              {evaluation.results.map((result) => (
                <RuleRow key={`${result.metric}-${result.label}`} result={result} />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
            <div className="flex items-center gap-1.5">
              <Scale className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-bold text-slate-200">Моментные плечи</span>
            </div>
            <div className="mt-2 space-y-2">
              {momentArms.map((arm) => (
                <MomentArmRow key={arm.id} arm={arm} />
              ))}
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-slate-600">
              Оценка по 2D-проекции: показывает, как поза меняет рычаг нагрузки. Это не
              точное измерение силы и не медицинский вывод.
            </p>
          </div>

          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[9px] leading-relaxed text-amber-200/75">
            <Info className="mr-1 inline h-3 w-3" />
            Безопасный коридор — ориентир, а не диагноз. Индивидуальная амплитуда зависит от
            подвижности, боли и опыта. При неприятных ощущениях остановитесь.
          </div>
        </div>
      )}

      {/* ---------------- Симуляция ---------------- */}
      {tab === 'simulation' && (
        <div id="tour-body-simulation" className="space-y-3">
          <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/35 via-[#0d151c] to-cyan-950/20 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200">Симуляция движения</span>
                </div>
                <div className="mt-0.5 truncate text-[10px] font-semibold text-emerald-300">{simExercise.name}</div>
              </div>
              <span className="shrink-0 rounded-lg border border-[#2b4050] bg-[#0b131a] px-2 py-1 text-[9px] font-semibold text-slate-400">
                {Math.round(simPhase * simAmplitude * 100)}% амплитуды
              </span>
            </div>

            <div className="mt-1 flex justify-center">
              <BodyModel2D
                view={simExercise.view}
                pose={simPose}
                dimensions={dimensions}
                avatarUrl={profile.avatarUrl}
                showAngles={false}
                showHandles={false}
                showGrid={false}
                heat={simHeat}
                equipment={simEquipment}
                onChangePose={() => undefined}
              />
            </div>

            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  hapticImpact('light');
                  setSimPlaying((value) => !value);
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-[10px] font-bold text-slate-950 shadow-lg shadow-emerald-500/15"
              >
                {simPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {simPlaying ? 'Пауза' : 'Запустить'}
              </button>
              <div className="min-w-0 flex-1">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={Math.min(1, simPhase * simAmplitude)}
                  onChange={(event) => {
                    setSimPlaying(false);
                    const value = Number(event.target.value);
                    setSimPhase(simAmplitude > 0 ? Math.min(1, value / simAmplitude) : 0);
                  }}
                  className="w-full accent-emerald-400"
                  aria-label="Фаза движения"
                />
                <div className="flex justify-between text-[8px] text-slate-600">
                  <span>{simExercise.phaseLabels[0]}</span>
                  <span>{simExercise.phaseLabels[1]}</span>
                </div>
              </div>
            </div>

            <div className="mt-1 flex items-center justify-between gap-2 text-[8px] text-slate-600">
              <span>Тепловая карта: зелёный — низкая, красный — очень высокая нагрузка</span>
              <span className="shrink-0">{simExercise.view === 'side' ? 'сбоку' : 'спереди'}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
            <div className="flex items-center gap-1.5">
              <Dumbbell className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-bold text-slate-200">Параметры</span>
            </div>

            <label className="mt-2 block">
              <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                Упражнение
              </span>
              <select
                id="body-simulation-exercise"
                value={simExercise.id}
                onChange={(event) => chooseSimulation(event.target.value)}
                className="w-full rounded-xl border border-[#263a4a] bg-[#081016] px-3 py-2 text-xs font-semibold text-slate-100 outline-none focus:border-cyan-500/60"
              >
                {SIMULATION_EXERCISES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-3">
              <div className="flex items-center justify-between text-[9px]">
                <span className="font-semibold uppercase tracking-wider text-slate-500">Доп. вес</span>
                <span className="font-bold text-slate-200">{formatNumber(simWeight)} кг</span>
              </div>
              <input
                id="body-simulation-weight"
                type="range"
                min={0}
                max={200}
                step={2.5}
                value={simWeight}
                onChange={(event) => {
                  setSimWeight(Number(event.target.value));
                  setSimPlaying(false);
                }}
                className="mt-1 w-full accent-cyan-400"
              />
              <div className="flex justify-between text-[8px] text-slate-600">
                <span>без веса</span>
                <span>{simExercise.bodyweightLoad > 0 ? 'собственный вес уже учтён' : 'гриф + блины'}</span>
                <span>200 кг</span>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-[9px]">
                <span className="font-semibold uppercase tracking-wider text-slate-500">Амплитуда</span>
                <span className="font-bold text-slate-200">{Math.round(simAmplitude * 100)}%</span>
              </div>
              <input
                id="body-simulation-amplitude"
                type="range"
                min={0.3}
                max={1}
                step={0.05}
                value={simAmplitude}
                onChange={(event) => {
                  setSimAmplitude(Number(event.target.value));
                  setSimPlaying(false);
                }}
                className="mt-1 w-full accent-cyan-400"
              />
              <div className="flex justify-between text-[8px] text-slate-600">
                <span>30% — короткая</span>
                <span>100% — полная</span>
              </div>
            </div>

            <p className="mt-2 text-[9px] leading-relaxed text-slate-600">{simExercise.cue}</p>
          </div>

          <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-200">Нагрузка по фазе</span>
              </div>
              <span className="text-[9px] text-slate-500">пик {formatNumber(simSelectedPeakIndex * 100, 0)}%</span>
            </div>
            <div className="mt-2">
              <SimulationLoadChart points={simSeries} phase={Math.min(1, simPhase * simAmplitude)} />
            </div>
            <p className="mt-1 text-[9px] leading-relaxed text-slate-600">
              Линия — максимум по суставам на каждой фазе. Красная пунктирная граница — зона,
              где модель считает нагрузку очень высокой.
            </p>
          </div>

          <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Target className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200">Суставы под нагрузкой</span>
              </div>
              <span className="text-[9px] text-slate-500">{simExercise.focus}</span>
            </div>
            <div className="mt-2 space-y-1.5">
              {simLoads.map((load) => (
                <div key={load.joint} className="rounded-xl border border-[#223442] bg-[#0b131a] px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-200">{load.label}</span>
                    <span
                      className="text-[9px] font-black"
                      style={{ color: LOAD_LEVEL_COLOR[load.level] }}
                    >
                      {loadLevelLabel(load.level)} · {formatNumber(load.torqueNm, 0)} Н·м
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#16232d]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (load.index / 0.55) * 100)}%`,
                        background: LOAD_LEVEL_COLOR[load.level],
                      }}
                    />
                  </div>
                  <div className="mt-0.5 text-[8px] text-slate-500">{load.muscles}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 rounded-xl border border-[#1f303d] bg-[#091117] px-2.5 py-2 text-[9px] text-slate-400">
              Сейчас максимальная нагрузка —{' '}
              <span className="font-bold" style={{ color: LOAD_LEVEL_COLOR[simPeak.level] }}>
                {simPeak.label.toLowerCase()}, {loadLevelLabel(simPeak.level)}
              </span>
              . Индекс {formatNumber(simPeak.index * 100, 0)}% от ориентировочного максимума.
            </div>
          </div>

          <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-bold text-slate-200">Где начинается небезопасно</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-[#223442] bg-[#0b131a] px-2.5 py-2">
                <div className="text-[8px] uppercase tracking-wider text-slate-500">жёлтая зона с</div>
                <div className="mt-0.5 text-sm font-black text-amber-300">
                  {simScan.cautionFromKg !== null ? `${formatNumber(simScan.cautionFromKg, 0)} кг` : '—'}
                </div>
              </div>
              <div className="rounded-xl border border-[#223442] bg-[#0b131a] px-2.5 py-2">
                <div className="text-[8px] uppercase tracking-wider text-slate-500">красная зона с</div>
                <div className="mt-0.5 text-sm font-black text-rose-300">
                  {simScan.unsafeFromKg !== null ? `${formatNumber(simScan.unsafeFromKg, 0)} кг` : 'не достигнута'}
                </div>
              </div>
              <div className="rounded-xl border border-[#223442] bg-[#0b131a] px-2.5 py-2">
                <div className="text-[8px] uppercase tracking-wider text-slate-500">безопасный вес</div>
                <div className="mt-0.5 text-sm font-black text-emerald-300">
                  {simScan.safeWeightKg !== null ? `до ${formatNumber(simScan.safeWeightKg, 0)} кг` : '—'}
                </div>
              </div>
              <div className="rounded-xl border border-[#223442] bg-[#0b131a] px-2.5 py-2">
                <div className="text-[8px] uppercase tracking-wider text-slate-500">безопасная амплитуда</div>
                <div className="mt-0.5 text-sm font-black text-cyan-300">
                  до {formatNumber(simScan.safeAmplitude * 100, 0)}%
                </div>
              </div>
            </div>

            {simSelectedLevel === 'veryHigh' ? (
              <div className="mt-2 rounded-xl border border-rose-500/35 bg-rose-500/10 px-2.5 py-2 text-[9px] leading-relaxed text-rose-200">
                <AlertTriangle className="mr-1 inline h-3 w-3" />
                При этой амплитуде нагрузка оказывается в красной зоне. Уменьшите вес или амплитуду —
                модель показывает расчётный ориентир, а не безопасный для вас вес.
              </div>
            ) : simSelectedLevel === 'high' ? (
              <div className="mt-2 rounded-xl border border-orange-500/35 bg-orange-500/10 px-2.5 py-2 text-[9px] leading-relaxed text-orange-200">
                <AlertTriangle className="mr-1 inline h-3 w-3" />
                Нагрузка высокая. Следите за техникой и не увеличивайте вес, пока амплитуда
                остаётся такой.
              </div>
            ) : null}

            {simScan.safeAmplitude < simAmplitude && (
              <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[9px] leading-relaxed text-amber-200">
                При текущем весе модель держит нагрузку в норме примерно до{' '}
                {formatNumber(simScan.safeAmplitude * 100, 0)}% амплитуды. Выбранные{' '}
                {formatNumber(simAmplitude * 100, 0)}% уже выходят за этот ориентир.
              </div>
            )}

            <p className="mt-2 text-[9px] leading-relaxed text-slate-600">
              Расчёт упрощённый: момент силы по 2D-проекции с учётом вашего веса и дополнительного
              веса. Он помогает сравнить амплитуду и нагрузку, но не учитывает связки, технику,
              разминку и индивидуальные ограничения.
            </p>
          </div>

          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[9px] leading-relaxed text-amber-200/75">
            <ShieldCheck className="mr-1 inline h-3 w-3" />
            Это обучающая симуляция, а не медицинская диагностика и не персональная программа.
            При боли, травме или ограничении подвижности остановитесь и обратитесь к специалисту.
          </div>
        </div>
      )}

      {/* ---------------- Анализ ---------------- */}
      {tab === 'analysis' && (
        <div id="tour-body-analysis" className="space-y-3">
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#223442] bg-[#0d151c] p-2.5">
            <div className="text-[10px] font-semibold text-slate-400">Период сравнения</div>
            <div className="flex gap-1 rounded-lg border border-[#263a4a] bg-[#081016] p-0.5">
              {[30, 90, 180].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => {
                    hapticSelect();
                    setAnalysisDays(days);
                  }}
                  className={`rounded-md px-2 py-1 text-[9px] font-semibold ${
                    analysisDays === days ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-500'
                  }`}
                >
                  {days} дн.
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Dumbbell className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200">Объём по группам</span>
              </div>
              <span className="text-[9px] text-slate-500">{formatVolume(totalVolume)}</span>
            </div>
            {totalVolume <= 0 ? (
              <div className="mt-2 rounded-xl border border-dashed border-[#263a4a] bg-[#091117] px-3 py-5 text-center text-[10px] leading-relaxed text-slate-500">
                За выбранный период нет тренировок с распознанными упражнениями.
                Добавьте силовые упражнения в дневник — объём появится здесь.
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                {volumes
                  .filter((volume) => volume.volumeKg > 0)
                  .map((volume) => (
                    <VolumeRow key={volume.group} volume={volume} max={maxVolume} />
                  ))}
              </div>
            )}
            <p className="mt-2 text-[9px] leading-relaxed text-slate-600">
              Объём = вес × повторения; для упражнений с собственным весом используется
              доля массы тела. Упражнения сопоставляются с группой по названию.
            </p>
          </div>

          <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-200">Рост замеров и нагрузка</span>
              </div>
              <span className="text-[9px] text-slate-500">{analysisDays} дн.</span>
            </div>
            {growthRows.length === 0 ? (
              <div className="mt-2 rounded-xl border border-dashed border-[#263a4a] bg-[#091117] px-3 py-5 text-center text-[10px] leading-relaxed text-slate-500">
                Нужно минимум два замера с одинаковыми обхватами за период.
                Повторите замер через 2–4 недели.
              </div>
            ) : (
              <div className="mt-2 grid gap-1.5">
                {growthRows.map((row) => (
                  <GrowthRowView key={row.key} row={row} />
                ))}
              </div>
            )}
            <p className="mt-2 text-[9px] leading-relaxed text-slate-600">
              Сравнение показывает совместную динамику, но не доказывает причинность:
              на замеры влияют питание, сон, вода и техника измерения.
            </p>
          </div>

          <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-bold text-slate-200">Сильные стороны и пропорции</span>
            </div>
            {insights.length === 0 ? (
              <div className="mt-2 rounded-xl border border-dashed border-[#263a4a] bg-[#091117] px-3 py-5 text-center text-[10px] leading-relaxed text-slate-500">
                Добавьте плечи, грудь, талию и бёдра — появятся пропорции и зоны роста.
              </div>
            ) : (
              <div className="mt-2 grid gap-1.5">
                {insights.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </div>
            )}
          </div>

          {latest && (
            <div className="rounded-2xl border border-[#223442] bg-[#0d151c] p-3">
              <div className="flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-200">Симметрия сторон</span>
              </div>
              <div className="mt-2 grid gap-1.5">
                <SymmetryRow label="Бицепс" left={latest.bicepLCm} right={latest.bicepRCm} />
                <SymmetryRow label="Предплечье" left={latest.forearmLCm} right={latest.forearmRCm} />
                <SymmetryRow label="Бедро" left={latest.thighLCm} right={latest.thighRCm} />
                <SymmetryRow label="Голень" left={latest.calfLCm} right={latest.calfRCm} />
              </div>
              {!latest.bicepLCm && !latest.forearmLCm && !latest.thighLCm && !latest.calfLCm && (
                <div className="mt-2 text-[10px] text-slate-500">
                  Добавьте обхваты левой и правой стороны, чтобы увидеть асимметрию.
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-1.5">
              <Target className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-200">Что сделать дальше</span>
            </div>
            <ul className="mt-2 space-y-1.5">
              {recommendations.map((tip) => (
                <li key={tip} className="flex items-start gap-1.5 text-[10px] leading-snug text-slate-300">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[9px] leading-relaxed text-amber-200/75">
            <ShieldCheck className="mr-1 inline h-3 w-3" />
            Раздел помогает замечать тренды и безопасные углы. Он не заменяет очную оценку
            техники тренером и не ставит медицинских диагнозов.
          </div>
        </div>
      )}
    </div>
  );
};
