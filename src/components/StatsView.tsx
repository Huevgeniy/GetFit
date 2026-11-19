import React, { useMemo, useState } from 'react';
import { Activity, BarChart3, Calendar, Flame, Footprints, Moon, Scale, TrendingDown, TrendingUp, Trophy, Dumbbell, Utensils, X } from 'lucide-react';
import { DailyNutritionRecord, FriendBattle, InBodyRecord, SleepRecord, UserProfile, WorkoutRecord } from '../types';
import { hapticSelect } from '../lib/telegram';

interface StatsViewProps {
  user: UserProfile;
  pastWorkouts: WorkoutRecord[];
  dailyNutritionRecords: DailyNutritionRecord[];
  sleepRecords: SleepRecord[];
  battles?: FriendBattle[];
  /** Показывать ли блок заруб: в базовом режиме он не нужен. */
  showBattles?: boolean;
  /** Закрывает модальный отчёт; в отдельном экране можно не передавать. */
  onClose?: () => void;
}

type PeriodKey = '7' | '30' | '90' | 'all';

const PERIODS: { key: PeriodKey; label: string; days: number | null }[] = [
  { key: '7', label: '7 дней', days: 7 },
  { key: '30', label: '30 дней', days: 30 },
  { key: '90', label: '90 дней', days: 90 },
  { key: 'all', label: 'Всё время', days: null },
];

const DAY_MS = 24 * 60 * 60 * 1000;

const dayKey = (value: Date) => value.toISOString().slice(0, 10);

const parseDate = (value?: string): number | null => {
  if (!value) return null;
  const direct = new Date(value).getTime();
  if (Number.isFinite(direct)) return direct;
  const [day, month, year] = String(value).split('.').map(Number);
  if (day && month && year) return new Date(year, month - 1, day).getTime();
  return null;
};

const workoutTime = (w: WorkoutRecord): number | null =>
  parseDate(w.completedAt) ?? parseDate(w.startedAt) ?? parseDate(w.date);

const round = (value: number, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const formatDelta = (current: number, previous: number): { text: string; positive: boolean } | null => {
  if (previous <= 0) return null;
  const diff = ((current - previous) / previous) * 100;
  if (!Number.isFinite(diff) || Math.abs(diff) < 0.5) return null;
  return { text: `${diff > 0 ? '+' : ''}${round(diff)}%`, positive: diff > 0 };
};

export const StatsView: React.FC<StatsViewProps> = ({
  user,
  pastWorkouts,
  dailyNutritionRecords,
  sleepRecords,
  battles = [],
  showBattles = true,
  onClose,
}) => {
  const [period, setPeriod] = useState<PeriodKey>('30');

  const stats = useMemo(() => {
    const selected = PERIODS.find((p) => p.key === period) ?? PERIODS[1];
    const now = Date.now();
    const from = selected.days ? now - selected.days * DAY_MS : 0;
    const previousFrom = selected.days ? from - selected.days * DAY_MS : 0;

    const inRange = (time: number | null, start: number, end: number) =>
      time !== null && time >= start && (selected.days ? time < end : true);

    const collect = (start: number, end: number) => {
      const workouts = pastWorkouts.filter((w) => inRange(workoutTime(w), start, end));
      const sleep = sleepRecords.filter((r) => inRange(parseDate(r.date), start, end));
      const food = dailyNutritionRecords.filter((r) => inRange(parseDate(r.date), start, end));
      const weights = [
        ...(user.inBodyRecords || []).filter((r) => inRange(parseDate(r.date), start, end)).map((r: InBodyRecord) => ({ time: parseDate(r.date)!, weight: r.weightKg, fat: r.bodyFatPercent })),
        ...food.filter((r) => typeof r.morningWeightKg === 'number' && r.morningWeightKg > 0).map((r) => ({ time: parseDate(r.date)!, weight: r.morningWeightKg as number, fat: undefined as number | undefined })),
      ].sort((a, b) => a.time - b.time);

      const sets = workouts.flatMap((w) => (w.exercises || []).flatMap((e) => (e.sets || []).map((s) => ({ ...s, exercise: e.name }))));
      const rpes = sets.map((s) => s.rpe).filter((r): r is number => typeof r === 'number' && r > 0);
      const bestSet = sets.reduce<{ oneRM: number; name: string; weight: number; reps: number } | null>((best, s) => {
        const oneRM = Number(s.calculated1RM) || 0;
        if (!best || oneRM > best.oneRM) return { oneRM, name: s.exercise, weight: s.weight, reps: s.reps };
        return best;
      }, null);

      // Шаги ведём на устройстве по дням — суммируем то, что есть
      let steps = 0;
      let stepsDays = 0;
      const daysCount = selected.days ?? 90;
      for (let i = 0; i < daysCount; i += 1) {
        const key = `getfit_today_steps_${dayKey(new Date(now - i * DAY_MS))}`;
        const raw = Number(localStorage.getItem(key));
        if (Number.isFinite(raw) && raw > 0) {
          steps += raw;
          stepsDays += 1;
        }
      }

      return {
        workouts,
        sleep,
        food,
        weights,
        setsCount: sets.length,
        tonnage: workouts.reduce((sum, w) => sum + (Number(w.totalTonnageKg) || 0), 0),
        duration: workouts.reduce((sum, w) => sum + (Number(w.durationMinutes) || 0), 0),
        avgRpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : 0,
        bestSet,
        avgSleep: sleep.length ? sleep.reduce((sum, r) => sum + (Number(r.durationHours) || 0), 0) / sleep.length : 0,
        avgSleepQuality: sleep.length ? sleep.reduce((sum, r) => sum + (Number(r.qualityScore) || 0), 0) / sleep.length : 0,
        avgCalories: food.length ? food.reduce((sum, r) => sum + (Number(r.totalCalories) || 0), 0) / food.length : 0,
        avgProtein: food.length ? food.reduce((sum, r) => sum + (Number(r.totalProtein) || 0), 0) / food.length : 0,
        steps,
        stepsDays,
      };
    };

    const current = collect(from, now);
    const previous = selected.days ? collect(previousFrom, from) : null;

    // Динамика веса за период
    let weightDelta: number | null = null;
    if (current.weights.length >= 2) {
      weightDelta = round(current.weights[current.weights.length - 1].weight - current.weights[0].weight, 1);
    }
    let fatDelta: number | null = null;
    const fatPoints = current.weights.filter((w) => typeof w.fat === 'number');
    if (fatPoints.length >= 2) {
      fatDelta = round((fatPoints[fatPoints.length - 1].fat as number) - (fatPoints[0].fat as number), 1);
    }

    // Разбивка тоннажа для графика
    const buckets = selected.days ?? 84;
    const bucketCount = Math.min(12, Math.max(4, Math.round(buckets / (selected.days === 7 ? 1 : 7))));
    const bucketSize = (selected.days ?? 84) / bucketCount;
    const chart = Array.from({ length: bucketCount }, (_, index) => {
      const end = now - index * bucketSize * DAY_MS;
      const start = end - bucketSize * DAY_MS;
      const value = pastWorkouts
        .filter((w) => inRange(workoutTime(w), start, end))
        .reduce((sum, w) => sum + (Number(w.totalTonnageKg) || 0), 0);
      return { value, label: selected.days === 7 ? dayKey(new Date(end)).slice(5) : `${Math.round(bucketSize * (index + 1))}д` };
    }).reverse();

    const activeBattles = battles.filter((b) => b.status === 'active');
    const wonBattles = battles.filter((b) => b.status === 'user_won');

    return { current, previous, weightDelta, fatDelta, chart, activeBattles, wonBattles, period: selected };
  }, [period, pastWorkouts, dailyNutritionRecords, sleepRecords, user.inBodyRecords, battles]);

  const { current, previous } = stats;
  const isEmpty =
    current.workouts.length === 0 && current.sleep.length === 0 && current.food.length === 0 && stats.chart.every((c) => c.value === 0);

  const card = 'bg-[#101820] border border-[#22303f] rounded-2xl p-3';
  const metric = (label: string, value: string, icon: React.ReactNode, delta?: { text: string; positive: boolean } | null, hint?: string) => (
    <div className={card} title={hint}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span className="text-lg font-bold text-slate-100">{value}</span>
        {delta && (
          <span className={`text-[10px] font-bold flex items-center gap-0.5 ${delta.positive ? 'text-emerald-400' : 'text-amber-400'}`}>
            {delta.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {delta.text}
          </span>
        )}
      </div>
    </div>
  );

  const maxTonnage = Math.max(1, ...stats.chart.map((c) => c.value));

  return (
    <div className="space-y-4 pb-6">
      <div className="bg-gradient-to-r from-cyan-950/60 via-[#12181f] to-emerald-950/60 border border-cyan-500/30 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Отчёты и статистика</h2>
              <p className="text-[11px] text-slate-400">Сводка за выбранный период и сравнение с предыдущим</p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              id="close-period-stats"
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-[#1a2636] hover:bg-[#25374d] text-slate-400 hover:text-white flex items-center justify-center transition-colors shrink-0"
              title="Закрыть отчёт"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 mt-3 overflow-x-auto no-scrollbar">
          {PERIODS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                hapticSelect();
                setPeriod(option.key);
              }}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                period === option.key
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                  : 'bg-[#141c24] border-[#22303f] text-slate-400 hover:text-slate-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {isEmpty ? (
        <div className="bg-[#101820] border border-[#22303f] rounded-2xl p-6 text-center space-y-2">
          <Calendar className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">За этот период данных пока нет</p>
          <p className="text-[11px] text-slate-500">
            Проведи тренировку, внеси сон или питание — и здесь появится сводка. Можно выбрать период пошире.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {metric(
              'Тренировок',
              String(current.workouts.length),
              <Dumbbell className="w-3 h-3 text-emerald-400" />,
              previous ? formatDelta(current.workouts.length, previous.workouts.length) : null,
            )}
            {metric(
              'Тоннаж',
              `${round(current.tonnage / 1000, 1)} т`,
              <Flame className="w-3 h-3 text-amber-400" />,
              previous ? formatDelta(current.tonnage, previous.tonnage) : null,
              'Суммарный поднятый вес за период',
            )}
            {metric(
              'Подходов',
              String(current.setsCount),
              <Activity className="w-3 h-3 text-cyan-400" />,
              previous ? formatDelta(current.setsCount, previous.setsCount) : null,
            )}
            {metric(
              'Средний RPE',
              current.avgRpe ? current.avgRpe.toFixed(1) : '—',
              <TrendingUp className="w-3 h-3 text-rose-400" />,
              previous && previous.avgRpe > 0 ? formatDelta(current.avgRpe, previous.avgRpe) : null,
              'Средняя субъективная тяжесть подходов',
            )}
            {metric(
              'Время в зале',
              `${Math.round(current.duration / 60)} ч`,
              <Calendar className="w-3 h-3 text-slate-400" />,
              previous ? formatDelta(current.duration, previous.duration) : null,
            )}
            {metric(
              'Средний сон',
              current.avgSleep ? `${current.avgSleep.toFixed(1)} ч` : '—',
              <Moon className="w-3 h-3 text-indigo-400" />,
              previous && previous.avgSleep > 0 ? formatDelta(current.avgSleep, previous.avgSleep) : null,
              current.avgSleepQuality ? `Средняя оценка качества: ${current.avgSleepQuality.toFixed(1)}/10` : undefined,
            )}
            {metric(
              'Калории/день',
              current.avgCalories ? String(Math.round(current.avgCalories)) : '—',
              <Utensils className="w-3 h-3 text-lime-400" />,
              previous && previous.avgCalories > 0 ? formatDelta(current.avgCalories, previous.avgCalories) : null,
              current.avgProtein ? `Белок в среднем: ${Math.round(current.avgProtein)} г/день` : undefined,
            )}
            {metric(
              'Шаги',
              current.steps ? `${Math.round(current.steps / 1000)} тыс.` : '—',
              <Footprints className="w-3 h-3 text-emerald-400" />,
              null,
              current.stepsDays ? `По ${current.stepsDays} дн. с этого устройства` : 'Шаги вносятся в профиле вручную',
            )}
            {metric(
              'Вес',
              current.weights.length ? `${round(current.weights[current.weights.length - 1].weight, 1)} кг` : user.currentWeight ? `${user.currentWeight} кг` : '—',
              <Scale className="w-3 h-3 text-cyan-400" />,
              stats.weightDelta !== null
                ? { text: `${stats.weightDelta > 0 ? '+' : ''}${stats.weightDelta} кг`, positive: stats.weightDelta < 0 }
                : null,
              stats.fatDelta !== null ? `Процент жира изменился на ${stats.fatDelta > 0 ? '+' : ''}${stats.fatDelta}%` : 'Вес берётся из замеров InBody и утренних записей',
            )}
            {showBattles &&
              metric(
                'Зарубы',
                `${stats.activeBattles.length} активн.`,
                <Trophy className="w-3 h-3 text-amber-400" />,
                null,
                `Побед: ${stats.wonBattles.length}`,
              )}
          </div>

          {current.bestSet && current.bestSet.oneRM > 0 && (
            <div className={card}>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold flex items-center gap-1.5">
                <Trophy className="w-3 h-3 text-amber-400" />
                Лучший подход за период
              </div>
              <div className="text-xs text-slate-200 mt-1">
                {current.bestSet.name}: {current.bestSet.weight} кг × {current.bestSet.reps} — расчётный 1ПМ{' '}
                <span className="font-bold text-emerald-400">{Math.round(current.bestSet.oneRM)} кг</span>
              </div>
            </div>
          )}

          <div className={card}>
            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-2">
              Тоннаж по интервалам
            </div>
            <div className="flex items-end gap-1.5 h-24">
              {stats.chart.map((bucket, index) => (
                <div key={index} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${Math.round(bucket.value)} кг`}>
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-emerald-700 to-emerald-400"
                    style={{ height: `${Math.max(2, (bucket.value / maxTonnage) * 80)}px` }}
                  />
                  <span className="text-[8px] text-slate-500 font-mono">{bucket.label}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              {current.workouts.length > 0
                ? `Средний тоннаж за тренировку: ${Math.round(current.tonnage / current.workouts.length)} кг`
                : 'Тренировок за период не было'}
            </p>
          </div>
        </>
      )}

      <p className="text-[10px] text-slate-500 px-1">
        Серия: {user.streakDays || 0} дн. · рекорд: {user.longestStreak || 0} дн. · дисциплина: {user.disciplineScore ?? 100}%.
        Данные считаются по твоему дневнику синхронизированному в облаке.
      </p>
    </div>
  );
};
