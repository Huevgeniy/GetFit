import React, { useState } from 'react';
import { 
  LineChart as LineChartIcon, 
  Calculator, 
  TrendingUp, 
  ArrowUpRight, 
  HelpCircle, 
  Sliders, 
  Info,
  Calendar,
  Sparkles,
  FlaskConical
} from 'lucide-react';
import { WorkoutRecord, UserProfile } from '../types';
import { calculateOneRepMax, calculateNormalizedReps } from '../utils/oneRepMax';
import { ResearchLabView } from './ResearchLabView';

interface ProgressChartsProps {
  pastWorkouts: WorkoutRecord[];
  activeWorkoutSets?: { weight: number; reps: number }[];
  user?: UserProfile;
}

type ChartMetric = 'one_rep_max' | 'normalized_reps' | 'max_weight' | 'tonnage';

export const ProgressCharts: React.FC<ProgressChartsProps> = ({
  pastWorkouts,
  activeWorkoutSets = [],
  user,
}) => {
  const userDisciplines = user?.selectedDisciplines || ['powerlifting', 'streetlifting', 'fitness'];
  const hasStrengthDiscipline = userDisciplines.some(d => 
    ['powerlifting', 'streetlifting', 'bodybuilding', 'weightlifting', 'crossfit'].includes(d)
  );

  const [activeTab, setActiveTab] = useState<'chart' | 'calculator' | 'lab'>('chart');
  const [selectedExercise, setSelectedExercise] = useState<string>('Жим штанги лежа');
  const [chartMetric, setChartMetric] = useState<ChartMetric>('one_rep_max');
  const [baseWeightForNormalization, setBaseWeightForNormalization] = useState<number>(100);

  // Standalone 1RM calculator state
  const [calcWeight, setCalcWeight] = useState<number>(105);
  const [calcReps, setCalcReps] = useState<number>(9);
  const [calcExerciseName, setCalcExerciseName] = useState<string>('Жим штанги лежа');

  // Available exercises across history
  const allExerciseNames = React.useMemo(() => {
    const names = new Set<string>();
    pastWorkouts?.forEach(w => {
      w.exercises?.forEach(ex => {
        if (ex?.name) names.add(ex.name);
      });
    });
    if (names.size === 0) names.add('Жим штанги лежа');
    return Array.from(names);
  }, [pastWorkouts]);

  // Extract chart data points for the selected exercise
  const chartPoints = React.useMemo(() => {
    const points: {
      date: string;
      workoutTitle: string;
      actualWeight: number;
      actualReps: number;
      oneRepMax: number;
      normalizedReps: number;
      maxWeight: number;
      tonnage: number;
    }[] = [];

    pastWorkouts?.forEach(w => {
      const ex = w.exercises?.find(
        e => (e?.name && e.name.toLowerCase().includes(selectedExercise.toLowerCase())) ||
             (e?.name && selectedExercise.toLowerCase().includes(e.name.toLowerCase()))
      );
      if (ex && ex.sets && ex.sets.length > 0) {
        // Find best set in workout (highest 1RM)
        let bestSet = ex.sets[0];
        let best1RM = 0;
        let tonnage = 0;
        let maxWeight = 0;

        ex.sets.forEach(s => {
          tonnage += s.weight * s.reps;
          if (s.weight > maxWeight) maxWeight = s.weight;
          const s1rm = s.calculated1RM || calculateOneRepMax(s.weight, s.reps).honestConsensus;
          if (s1rm > best1RM) {
            best1RM = s1rm;
            bestSet = s;
          }
        });

        const normReps = calculateNormalizedReps(bestSet.weight, bestSet.reps, baseWeightForNormalization);

        points.push({
          date: new Date(w.startedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
          workoutTitle: w.title,
          actualWeight: bestSet.weight,
          actualReps: bestSet.reps,
          oneRepMax: best1RM,
          normalizedReps: normReps,
          maxWeight,
          tonnage,
        });
      }
    });

    return points;
  }, [pastWorkouts, selectedExercise, baseWeightForNormalization]);

  // Calculator result
  const calcResult = calculateOneRepMax(calcWeight, calcReps);
  const calcNormalizedRepsAt100 = calculateNormalizedReps(calcWeight, calcReps, baseWeightForNormalization);

  // Selected tooltip state
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(
    chartPoints.length > 0 ? chartPoints.length - 1 : null
  );

  // Values range for SVG scaling
  const getMetricValue = (pt: (typeof chartPoints)[0]) => {
    switch (chartMetric) {
      case 'one_rep_max':
        return pt.oneRepMax;
      case 'normalized_reps':
        return pt.normalizedReps;
      case 'max_weight':
        return pt.maxWeight;
      case 'tonnage':
        return pt.tonnage;
    }
  };

  const values = chartPoints.map(getMetricValue);
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 100;
  // Padding for chart Y
  const yRange = maxValue - minValue || 10;
  const chartMinY = Math.max(0, Math.floor(minValue - yRange * 0.15));
  const chartMaxY = Math.ceil(maxValue + yRange * 0.15);

  const deltaValue = values.length >= 2 
    ? Math.round((values[values.length - 1] - values[0]) * 10) / 10 
    : 0;

  const activePoint = selectedPointIndex !== null && chartPoints[selectedPointIndex] 
    ? chartPoints[selectedPointIndex] 
    : chartPoints[chartPoints.length - 1];

  return (
    <div className="space-y-4 pb-20">
      {/* Top mode switch */}
      <div className="flex bg-[#12181f] p-1 rounded-xl border border-[#1e293b] gap-1">
        <button
          onClick={() => setActiveTab('chart')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'chart'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LineChartIcon className="w-3.5 h-3.5" />
          <span>Динамика</span>
        </button>
        {hasStrengthDiscipline && (
          <button
            onClick={() => setActiveTab('calculator')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'calculator'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>1ПМ</span>
          </button>
        )}
        <button
          onClick={() => setActiveTab('lab')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'lab'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-extrabold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FlaskConical className="w-3.5 h-3.5 text-cyan-400 group-hover:text-cyan-300" />
          <span>Research Lab</span>
        </button>
      </div>

      {activeTab === 'lab' ? (
        <ResearchLabView user={user || ({} as any)} pastWorkouts={pastWorkouts} />
      ) : activeTab === 'chart' ? (
        <div className="space-y-4">
          {/* Exercise Selector */}
          <div className="bg-[#12181f] border border-[#1e293b] rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Упражнение для анализа
              </span>
              <span className="text-[11px] text-emerald-400 font-mono">
                {chartPoints.length} сессий в базе
              </span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {allExerciseNames.map(name => (
                <button
                  key={name}
                  onClick={() => {
                    setSelectedExercise(name);
                    setSelectedPointIndex(null);
                  }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedExercise === name
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                      : 'bg-[#161f28] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Metric Selector (1ПМ vs Пересчет на 100 кг) */}
          <div className="bg-[#12181f] border border-[#1e293b] rounded-xl p-3">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Тип графика прогресса
              </span>
              {chartMetric === 'normalized_reps' && (
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-slate-400 text-[11px]">Базовый вес:</span>
                  <input
                    type="number"
                    value={baseWeightForNormalization}
                    onChange={e => setBaseWeightForNormalization(Math.max(20, parseInt(e.target.value, 10) || 100))}
                    className="w-14 bg-[#18232f] border border-[#253342] text-emerald-400 font-mono text-center text-xs py-0.5 rounded"
                  />
                  <span className="text-xs text-slate-400">кг</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => setChartMetric('one_rep_max')}
                className={`p-2 rounded-lg text-left transition-all ${
                  chartMetric === 'one_rep_max'
                    ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
                    : 'bg-[#151c24] border border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className="text-[10px] uppercase font-bold">1ПМ (кг)</div>
                <div className="text-xs font-semibold mt-0.5">Расчетный максимум</div>
              </button>

              <button
                onClick={() => setChartMetric('normalized_reps')}
                className={`p-2 rounded-lg text-left transition-all ${
                  chartMetric === 'normalized_reps'
                    ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
                    : 'bg-[#151c24] border border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className="text-[10px] uppercase font-bold text-teal-300">Пересчет</div>
                <div className="text-xs font-semibold mt-0.5">На {baseWeightForNormalization} кг (повт)</div>
              </button>

              <button
                onClick={() => setChartMetric('max_weight')}
                className={`p-2 rounded-lg text-left transition-all ${
                  chartMetric === 'max_weight'
                    ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
                    : 'bg-[#151c24] border border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className="text-[10px] uppercase font-bold">Рабочий вес</div>
                <div className="text-xs font-semibold mt-0.5">Пиковый вес подхода</div>
              </button>

              <button
                onClick={() => setChartMetric('tonnage')}
                className={`p-2 rounded-lg text-left transition-all ${
                  chartMetric === 'tonnage'
                    ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
                    : 'bg-[#151c24] border border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className="text-[10px] uppercase font-bold">Тоннаж</div>
                <div className="text-xs font-semibold mt-0.5">Общий тоннаж (кг)</div>
              </button>
            </div>
          </div>

          {/* Interactive Chart Card */}
          <div className="bg-[#12181f] border border-[#1e293b] rounded-xl p-4">
            {/* Header with Delta */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-slate-400">
                  {chartMetric === 'one_rep_max' && 'Динамика 1ПМ:'}
                  {chartMetric === 'normalized_reps' && `Эквивалент повторов на ${baseWeightForNormalization} кг:`}
                  {chartMetric === 'max_weight' && 'Пиковый вес подхода:'}
                  {chartMetric === 'tonnage' && 'Суммарный объем (тоннаж):'}
                </div>
                <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                  {activePoint ? (
                    <>
                      {getMetricValue(activePoint)}{' '}
                      <span className="text-xs text-slate-400">
                        {chartMetric === 'normalized_reps' ? 'повт.' : 'кг'}
                      </span>
                    </>
                  ) : (
                    '—'
                  )}
                </div>
              </div>

              {deltaValue !== 0 && (
                <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>
                    +{deltaValue} {chartMetric === 'normalized_reps' ? 'повт' : 'кг'}
                  </span>
                </div>
              )}
            </div>

            {/* SVG Chart */}
            {chartPoints.length > 0 ? (
              <div className="w-full h-44 relative select-none">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 340 140" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="mintGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal grid lines */}
                  <line x1="0" y1="20" x2="340" y2="20" stroke="#1f2937" strokeDasharray="3 3" />
                  <line x1="0" y1="70" x2="340" y2="70" stroke="#1f2937" strokeDasharray="3 3" />
                  <line x1="0" y1="120" x2="340" y2="120" stroke="#1f2937" strokeDasharray="3 3" />

                  {/* Area fill */}
                  {(() => {
                    const coords = chartPoints.map((pt, idx) => {
                      const x = (idx / Math.max(1, chartPoints.length - 1)) * 320 + 10;
                      const val = getMetricValue(pt);
                      const normalizedY = (val - chartMinY) / Math.max(1, chartMaxY - chartMinY);
                      const y = 120 - normalizedY * 100;
                      return { x, y };
                    });

                    const pathD = coords.reduce((acc, curr, idx) => {
                      return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
                    }, '');

                    const areaD = `${pathD} L ${coords[coords.length - 1].x} 130 L ${coords[0].x} 130 Z`;

                    return (
                      <>
                        <path d={areaD} fill="url(#mintGradient)" />
                        <path d={pathD} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        {coords.map((c, idx) => {
                          const isSelected = selectedPointIndex === idx || (selectedPointIndex === null && idx === coords.length - 1);
                          return (
                            <g key={idx} onClick={() => setSelectedPointIndex(idx)} className="cursor-pointer">
                              <circle
                                cx={c.x}
                                cy={c.y}
                                r={isSelected ? 6 : 4}
                                fill={isSelected ? '#34d399' : '#059669'}
                                stroke="#0b0f12"
                                strokeWidth="2"
                              />
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>

                {/* X Axis dates */}
                <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-2 px-2">
                  {chartPoints.map((pt, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedPointIndex(idx)}
                      className={`hover:text-emerald-400 ${
                        selectedPointIndex === idx ? 'text-emerald-400 font-bold' : ''
                      }`}
                    >
                      {pt.date}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-xs text-slate-400">
                Нет данных для выбранного упражнения
              </div>
            )}

            {/* Selected point details card */}
            {activePoint && (
              <div className="mt-4 p-3 bg-[#0d141b] rounded-xl border border-[#1f2a37] text-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Тренировка от {activePoint.date}</span>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-mono">
                    Сделано: {activePoint.actualWeight} кг × {activePoint.actualReps} повт.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="bg-[#141d27] p-2 rounded-lg">
                    <div className="text-[10px] text-slate-400 uppercase">Расчетный 1ПМ</div>
                    <div className="text-emerald-400 font-bold text-sm mt-0.5">
                      {activePoint.oneRepMax} кг
                    </div>
                  </div>

                  <div className="bg-[#141d27] p-2 rounded-lg">
                    <div className="text-[10px] text-slate-400 uppercase">
                      Пересчет на {baseWeightForNormalization} кг
                    </div>
                    <div className="text-teal-300 font-bold text-sm mt-0.5">
                      ~{activePoint.normalizedReps} повторений
                    </div>
                  </div>
                </div>

                <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                  💡 <strong>Формула эквивалента:</strong> {activePoint.actualWeight} кг на {activePoint.actualReps} раз эквивалентны приблизительно <strong>{activePoint.normalizedReps} повторениям</strong> при работе со штангой {baseWeightForNormalization} кг.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Standalone 1RM Calculator Tab */
        <div className="space-y-4">
          <div className="bg-[#12181f] border border-[#1e293b] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-slate-100">Самый честный 1ПМ калькулятор</h3>
                <p className="text-[11px] text-slate-400">
                  Работает для жима лежа, приседа, становой и любого упражнения с доп. весом
                </p>
              </div>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Поднятый вес (кг)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={calcWeight}
                    onChange={e => setCalcWeight(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-[#18232f] border border-[#253342] focus:border-emerald-500 rounded-xl px-3 py-2 text-base font-mono font-bold text-slate-100 focus:outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">кг</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Чистые повторения
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={calcReps}
                    onChange={e => setCalcReps(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full bg-[#18232f] border border-[#253342] focus:border-emerald-500 rounded-xl px-3 py-2 text-base font-mono font-bold text-slate-100 focus:outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">повт</span>
                </div>
              </div>
            </div>

            {/* Honest 1RM Big Output Card */}
            <div className="bg-gradient-to-r from-emerald-950/70 to-teal-950/70 border border-emerald-500/40 rounded-xl p-4 text-center">
              <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">
                Честный консенсусный 1ПМ
              </div>
              <div className="text-3xl font-extrabold font-mono text-emerald-400 my-1">
                {calcResult.honestConsensus} <span className="text-sm font-normal text-slate-300">кг</span>
              </div>
              <div className="text-xs text-slate-300 mt-1">
                В пересчете на 100 кг: <strong className="text-emerald-300 font-mono">{calcNormalizedRepsAt100} повт.</strong>
              </div>
            </div>

            {/* Formula Comparison Table */}
            <div className="mt-4 pt-3 border-t border-[#1e293b]">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">
                Сравнение популярных формул 1ПМ:
              </span>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div className="bg-[#16202a] p-2 rounded-lg text-center">
                  <div className="text-[10px] text-slate-400">Epley</div>
                  <div className="font-bold text-slate-200">{calcResult.epley} кг</div>
                </div>
                <div className="bg-[#16202a] p-2 rounded-lg text-center">
                  <div className="text-[10px] text-slate-400">Brzycki</div>
                  <div className="font-bold text-slate-200">{calcResult.brzycki} кг</div>
                </div>
                <div className="bg-[#16202a] p-2 rounded-lg text-center">
                  <div className="text-[10px] text-slate-400">Lander</div>
                  <div className="font-bold text-slate-200">{calcResult.lander} кг</div>
                </div>
              </div>
            </div>

            {/* Percentages Training Table */}
            <div className="mt-4 pt-3 border-t border-[#1e293b]">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">
                Тренировочные зоны (% от 1ПМ):
              </span>
              <div className="grid grid-cols-4 gap-2 text-xs font-mono">
                {calcResult.percentages.slice(0, 4).map(p => (
                  <div key={p.percentage} className="bg-[#141d26] p-2 rounded-lg text-center border border-[#1e2a38]">
                    <div className="text-[10px] text-emerald-400 font-bold">{p.percentage}%</div>
                    <div className="font-bold text-slate-100">{p.weight} кг</div>
                    <div className="text-[9px] text-slate-400">~{p.targetReps} повт.</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
