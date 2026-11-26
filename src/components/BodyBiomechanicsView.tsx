import React, { useId, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
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
} from 'lucide-react';
import type { BodyMeasurementEntry, BodyProfile, UserProfile, WorkoutRecord } from '../types';
import {
  BODY_METRIC_FIELDS,
  BODY_TREND_OPTIONS,
  GrowthRow,
  MuscleVolume,
  ProportionInsight,
  TrendKey,
  buildGrowthRows,
  buildProportionInsights,
  computeBodyDimensions,
  formatDateLong,
  formatDateShort,
  latestMeasurement,
  measurementSeries,
  measurementValue,
  muscleVolumesFromWorkouts,
  normalizeBodyProfile,
  previousMeasurement,
} from '../lib/bodyModel';
import { hapticImpact, hapticNotify, hapticSelect } from '../lib/telegram';
import { BodyMeasurementForm } from './BodyMeasurementForm';
import { ExerciseLibraryPanel } from './ExerciseLibraryPanel';
import { TechniquePanel } from './TechniquePanel';
import { techniqueExerciseById } from '../lib/exerciseTechnique';

interface BodyBiomechanicsViewProps {
  user: UserProfile;
  pastWorkouts: WorkoutRecord[];
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onAskAi?: (prompt: string) => void;
}

type BodyTab = 'measurements' | 'exercises' | 'technique' | 'analysis';

const BODY_TABS: Array<{
  id: BodyTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tourId: string;
}> = [
  { id: 'measurements', label: 'Замеры', icon: Ruler, tourId: 'body-tab-measurements' },
  { id: 'exercises', label: 'Упражнения', icon: Dumbbell, tourId: 'body-tab-exercises' },
  { id: 'technique', label: 'Техника', icon: PersonStanding, tourId: 'body-tab-technique' },
  { id: 'analysis', label: 'Анализ', icon: Activity, tourId: 'body-tab-analysis' },
];

const formatNumber = (value: number, digits = 1): string => {
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  return String(rounded).replace('.', ',');
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

const insightTone = (status: ProportionInsight['status']): string => {
  if (status === 'strong') return 'border-emerald-500/35 bg-emerald-500/8 text-emerald-300';
  if (status === 'balanced') return 'border-cyan-500/30 bg-cyan-500/8 text-cyan-300';
  return 'border-amber-500/35 bg-amber-500/8 text-amber-300';
};

/** Цвет на модели — доля сустава в общем моменте упражнения. */
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
  onAskAi,
}) => {
  const profile = useMemo(() => normalizeBodyProfile(user.bodyProfile), [user.bodyProfile]);
  const [tab, setTab] = useState<BodyTab>('measurements');
  const [techniqueExerciseId, setTechniqueExerciseId] = useState('squat');
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BodyMeasurementEntry | null>(null);
  const [analysisDays, setAnalysisDays] = useState(90);
  const [trendKey, setTrendKey] = useState<TrendKey>('waistCm');

  const latest = latestMeasurement(profile);
  const previous = previousMeasurement(profile);
  const dimensions = useMemo(() => computeBodyDimensions(profile), [profile]);
  const bodyWeight = latest?.weightKg || user.currentWeight || 0;
  const techniqueExercise = techniqueExerciseById(techniqueExerciseId) || techniqueExerciseById('squat')!;

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

  const handleTabChange = (next: BodyTab) => {
    hapticSelect();
    setTab(next);
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
                Замеры, библиотека упражнений и разбор техники. Схемы, углы и персональная нагрузка — не медицинская диагностика.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleTabChange('technique')}
            className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-emerald-400/40 bg-[#13212b] text-emerald-300"
            aria-label="Открыть разбор техники"
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
        className="grid grid-cols-4 gap-1 rounded-2xl border border-[#223442] bg-[#0a1218] p-1"
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
                Обхваты и длины рук и ног можно добавить позже.
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
                <div className="text-xs font-bold text-slate-200">Все замеры</div>
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

            {/* ---------------- Упражнения ---------------- */}
      {tab === 'exercises' && (
        <ExerciseLibraryPanel
          onSelect={(id) => {
            hapticSelect();
            setTechniqueExerciseId(id);
            setTab('technique');
          }}
        />
      )}

      {/* ---------------- Техника ---------------- */}
      {tab === 'technique' && (
        <TechniquePanel
          exercise={techniqueExercise}
          dimensions={dimensions}
          bodyWeightKg={bodyWeight}
          profile={profile}
          pastWorkouts={pastWorkouts}
          onUpdateBody={updateBody}
          onSelectExercise={(id) => {
            hapticSelect();
            setTechniqueExerciseId(id);
          }}
          onOpenLibrary={() => setTab('exercises')}
          onAskAi={onAskAi}
        />
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
