import React, { useState, useEffect } from 'react';
import { 
  FlaskConical, 
  Calendar, 
  TrendingUp, 
  Sparkles, 
  CheckCircle2, 
  Plus, 
  ArrowRight, 
  Layers, 
  Sliders, 
  BrainCircuit, 
  Info, 
  Activity, 
  LineChart, 
  Clock, 
  Check, 
  ChevronRight, 
  Dumbbell, 
  Flame, 
  AlertCircle,
  HelpCircle,
  X,
  RefreshCw,
  Zap,
  Target
} from 'lucide-react';
import { Experiment, TrainingBlock, CustomMetric, UserProfile, WorkoutRecord } from '../types';

interface ResearchLabViewProps {
  user: UserProfile;
  pastWorkouts: WorkoutRecord[];
  onUpdateUser?: (updated: Partial<UserProfile>) => void;
}

const EXPERIMENT_TEMPLATES = [
  {
    title: '💧 Гидратация 3.5л + Сон 8ч → 1ПМ в жиме лежа',
    hypothesis: 'Увеличение суточного потребления воды до 3.5л и стабилизация сна 8ч увеличит 1ПМ в жиме лежа на 3-5% за 21 день.',
    durationDays: 21,
    dependentMetric: { name: '1ПМ Жим лежа', unit: 'кг', type: 'performance' as const },
    independentMetrics: [
      { name: 'Вода', unit: 'литры', targetValue: 3.5, type: 'hydration' as const },
      { name: 'Сон', unit: 'часы', targetValue: 8, type: 'sleep' as const },
    ],
    baselineValue: '100 кг',
  },
  {
    title: '⚡ Креатин моногидрат 5г/день → Тоннаж и повторения',
    hypothesis: 'Ежедневный прием 5г креатина увеличит суммарный рабочий тоннаж на 7-10% в базовых движениях к 28 дню.',
    durationDays: 28,
    dependentMetric: { name: 'Рабочий тоннаж', unit: 'кг', type: 'volume' as const },
    independentMetrics: [
      { name: 'Креатин', unit: 'г', targetValue: 5, type: 'supplement' as const },
    ],
    baselineValue: '12 500 кг за тренировку',
  },
  {
    title: '☕ Кофеин 200мг за 35 мин до тренировки → Снижение RPE',
    hypothesis: 'Прием кофеина снизит субъективное ощущение нагрузки (RPE) на тяжелых подходах с 9.0 до 8.0 при том же рабочем весе.',
    durationDays: 14,
    dependentMetric: { name: 'Средний RPE тяжелых подходов', unit: 'RPE (1-10)', type: 'rpe' as const },
    independentMetrics: [
      { name: 'Кофеин', unit: 'мг', targetValue: 200, type: 'supplement' as const },
    ],
    baselineValue: 'RPE 8.8',
  },
  {
    title: '🥩 Белок 2.0г/кг веса тела → Скорость восстановления мышц',
    hypothesis: 'Увеличение белка до 2.0г/кг снизит мышечную крепатуру через 48 часов после тренировки ног и ускорит суперкомпенсацию.',
    durationDays: 21,
    dependentMetric: { name: 'Крепатура через 48ч', unit: 'баллы (1-10)', type: 'recovery' as const },
    independentMetrics: [
      { name: 'Белок', unit: 'г/день', targetValue: 170, type: 'nutrition' as const },
    ],
    baselineValue: 'Крепатура 7/10',
  },
];

const DEFAULT_TRAINING_BLOCKS: TrainingBlock[] = [
  {
    id: 'block_hypertrophy_1',
    title: 'Блок гипертрофии и накопления объема',
    type: 'hypertrophy',
    startDate: new Date(Date.now() - 35 * 86400000).toISOString().split('T')[0],
    endDate: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
    targetRpeRange: [7, 8.5],
    completedWorkoutsCount: 12,
    totalTonnage: 142800,
    averageRpe: 7.8,
    notes: 'Отличный рост объема грудных и спины, базовый вес вырос на 2.5 кг.',
    isCurrent: false,
  },
  {
    id: 'block_strength_peak',
    title: 'Силовой пик (Интенсификация 1ПМ)',
    type: 'strength',
    startDate: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 21 * 86400000).toISOString().split('T')[0],
    targetRpeRange: [8, 9.5],
    completedWorkoutsCount: 3,
    totalTonnage: 38200,
    averageRpe: 8.6,
    notes: 'Выход на пиковые силовые к нормативу WRPF.',
    isCurrent: true,
  },
];

export const ResearchLabView: React.FC<ResearchLabViewProps> = ({
  user,
  pastWorkouts,
}) => {
  const [subTab, setSubTab] = useState<'experiments' | 'periodization' | 'custom_metrics'>('experiments');

  // Experiments State
  const [experiments, setExperiments] = useState<Experiment[]>(() => {
    try {
      const saved = localStorage.getItem('getfit_experiments');
      if (saved) return JSON.parse(saved);
    } catch {}
    // Initial experiment sample
    return [
      {
        id: 'exp_hydration_bench',
        title: '💧 Гидратация 3.5л + Сон 8ч → 1ПМ в жиме лежа',
        hypothesis: 'Увеличение суточного потребления воды до 3.5л и стабилизация сна 8ч увеличит 1ПМ в жиме лежа на 3-5% за 21 день.',
        startDate: new Date(Date.now() - 9 * 86400000).toISOString().split('T')[0],
        endDate: new Date(Date.now() + 12 * 86400000).toISOString().split('T')[0],
        durationDays: 21,
        status: 'active',
        dependentMetric: { name: '1ПМ Жим лежа', unit: 'кг', type: 'performance' },
        independentMetrics: [
          { name: 'Вода', unit: 'л', targetValue: 3.5, type: 'hydration' },
          { name: 'Сон', unit: 'ч', targetValue: 8, type: 'sleep' },
        ],
        baselineValue: '100 кг',
        dailyLogs: {
          [new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0]]: {
            date: new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0],
            independentValues: { 'Вода': 3.2, 'Сон': 7.5 },
            dependentValue: 101,
            notes: 'Легкость в движениях',
          },
          [new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0]]: {
            date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
            independentValues: { 'Вода': 3.6, 'Сон': 8.0 },
            dependentValue: 102.5,
            notes: 'Отличный памп и скорость штанги',
          },
          [new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0]]: {
            date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
            independentValues: { 'Вода': 3.5, 'Сон': 8.5 },
            dependentValue: 103.5,
            notes: 'Пожал уверенно',
          },
        },
      },
    ];
  });

  // Training Blocks State
  const [trainingBlocks, setTrainingBlocks] = useState<TrainingBlock[]>(() => {
    try {
      const saved = localStorage.getItem('getfit_training_blocks');
      return saved ? JSON.parse(saved) : DEFAULT_TRAINING_BLOCKS;
    } catch {
      return DEFAULT_TRAINING_BLOCKS;
    }
  });

  // Custom Metrics State
  const [customMetrics, setCustomMetrics] = useState<CustomMetric[]>(() => {
    try {
      const saved = localStorage.getItem('getfit_custom_metrics');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 'cm_shoulder_pain', name: 'Дискомфорт в плече', unit: 'баллы (1-10)', category: 'recovery', trackingType: 'scale_1_10' },
      { id: 'cm_creatine', name: 'Креатин принят', unit: 'да/нет', category: 'supplement', trackingType: 'boolean' },
      { id: 'cm_work_stress', name: 'Стресс на работе', unit: 'баллы (1-10)', category: 'lifestyle', trackingType: 'scale_1_10' },
    ];
  });

  // Modal States
  const [showNewExperimentModal, setShowNewExperimentModal] = useState(false);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(experiments[0] || null);
  const [showDailyCheckinModal, setShowDailyCheckinModal] = useState(false);

  // Daily log input state
  const [logIndependent, setLogIndependent] = useState<Record<string, number>>({});
  const [logDependent, setLogDependent] = useState<number>(100);
  const [logNotes, setLogNotes] = useState('');

  // AI Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any>(null);

  // Periodization AI Recommendation state
  const [isPeriodizationLoading, setIsPeriodizationLoading] = useState(false);
  const [periodizationRecommendation, setPeriodizationRecommendation] = useState<any>(null);

  // Sync to local storage and cloud backend
  useEffect(() => {
    localStorage.setItem('getfit_experiments', JSON.stringify(experiments));
  }, [experiments]);

  useEffect(() => {
    localStorage.setItem('getfit_training_blocks', JSON.stringify(trainingBlocks));
  }, [trainingBlocks]);

  useEffect(() => {
    localStorage.setItem('getfit_custom_metrics', JSON.stringify(customMetrics));
  }, [customMetrics]);

  // Load from backend if available
  useEffect(() => {
    fetch('/api/experiments')
      .then(res => res.json())
      .then(data => {
        if (data.experiments && data.experiments.length > 0) {
          setExperiments(data.experiments);
        }
      })
      .catch(() => {});

    fetch('/api/cycles')
      .then(res => res.json())
      .then(data => {
        if (data.cycles && data.cycles.length > 0) {
          setTrainingBlocks(data.cycles);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveExperimentToBackend = async (exp: Experiment) => {
    try {
      await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exp),
      });
    } catch (e) {
      console.warn('Backend sync error:', e);
    }
  };

  const handleCreateFromTemplate = (template: typeof EXPERIMENT_TEMPLATES[0]) => {
    const newExp: Experiment = {
      id: `exp_${Date.now()}`,
      title: template.title,
      hypothesis: template.hypothesis,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + template.durationDays * 86400000).toISOString().split('T')[0],
      durationDays: template.durationDays,
      status: 'active',
      dependentMetric: template.dependentMetric,
      independentMetrics: template.independentMetrics,
      baselineValue: template.baselineValue,
      dailyLogs: {},
    };

    setExperiments(prev => [newExp, ...prev]);
    setSelectedExperiment(newExp);
    setShowNewExperimentModal(false);
    handleSaveExperimentToBackend(newExp);
  };

  const handleOpenCheckin = (exp: Experiment) => {
    setSelectedExperiment(exp);
    const initialIndep: Record<string, number> = {};
    exp.independentMetrics.forEach(m => {
      initialIndep[m.name] = (typeof m.targetValue === 'number' ? m.targetValue : Number(m.targetValue)) || 0;
    });
    setLogIndependent(initialIndep);

    // Try to auto-derive dependent value from today's workout if available
    const todayStr = new Date().toISOString().split('T')[0];
    const todaysWorkout = pastWorkouts.find(w => w.date === todayStr || (w.startedAt && w.startedAt.split('T')[0] === todayStr));
    let autoVal = 100;
    if (todaysWorkout && todaysWorkout.exercises?.length) {
      const matchEx = todaysWorkout.exercises.find(e => 
        e.name.toLowerCase().includes(exp.dependentMetric.name.toLowerCase()) ||
        exp.dependentMetric.name.toLowerCase().includes(e.name.toLowerCase())
      );
      if (matchEx && matchEx.sets?.length) {
        autoVal = Math.max(...matchEx.sets.map(s => s.calculated1RM || (s.weight * (1 + s.reps / 30))));
      }
    }
    setLogDependent(Math.round(autoVal * 10) / 10);
    setLogNotes('');
    setShowDailyCheckinModal(true);
  };

  const handleSaveDailyCheckin = () => {
    if (!selectedExperiment) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const updatedExp: Experiment = {
      ...selectedExperiment,
      dailyLogs: {
        ...(selectedExperiment.dailyLogs || {}),
        [todayStr]: {
          date: todayStr,
          independentValues: logIndependent,
          dependentValue: logDependent,
          notes: logNotes,
        },
      },
    };

    setExperiments(prev => prev.map(e => e.id === updatedExp.id ? updatedExp : e));
    setSelectedExperiment(updatedExp);
    handleSaveExperimentToBackend(updatedExp);
    setShowDailyCheckinModal(false);
  };

  const handleRunAiAnalysis = async (exp: Experiment) => {
    setIsAnalyzing(true);
    setAiAnalysisResult(null);
    try {
      const res = await fetch('/api/ai/experiment-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experiment: exp,
          userProfile: user,
        }),
      });
      const data = await res.json();
      setAiAnalysisResult(data);
    } catch (err: any) {
      console.error('Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRunPeriodizationRecommend = async () => {
    setIsPeriodizationLoading(true);
    setPeriodizationRecommendation(null);
    try {
      const res = await fetch('/api/ai/periodization-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocks: trainingBlocks,
          pastWorkouts: pastWorkouts.slice(-8),
          userProfile: user,
        }),
      });
      const data = await res.json();
      setPeriodizationRecommendation(data);
    } catch (err) {
      console.error('Periodization recommend error:', err);
    } finally {
      setIsPeriodizationLoading(false);
    }
  };

  return (
    <div className="space-y-4 pb-20 animate-fade-in">
      {/* Top Banner: Research Lab Identity */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/50 via-slate-900 to-indigo-950/40 border border-cyan-500/30 flex items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white">Research Lab & Biohacking</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                N=1 Наука
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Тестируй гипотезы на себе, управляй циклами периодизации и находи скрытые корреляции
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900/80 rounded-xl border border-slate-800">
        <button
          type="button"
          onClick={() => setSubTab('experiments')}
          className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            subTab === 'experiments'
              ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FlaskConical className="w-3.5 h-3.5" />
          <span>Эксперименты</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('periodization')}
          className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            subTab === 'periodization'
              ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Периодизация</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('custom_metrics')}
          className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            subTab === 'custom_metrics'
              ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Метрики & R</span>
        </button>
      </div>

      {/* TAB 1: EXPERIMENTS (N=1 Self Studies) */}
      {subTab === 'experiments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Твои исследования ({experiments.length})
            </span>
            <button
              type="button"
              onClick={() => setShowNewExperimentModal(true)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition flex items-center gap-1 shadow-md shadow-cyan-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Новый эксперимент
            </button>
          </div>

          {/* List of experiments */}
          <div className="space-y-3">
            {experiments.map(exp => {
              const logsCount = Object.keys(exp.dailyLogs || {}).length;
              const isSelected = selectedExperiment?.id === exp.id;

              return (
                <div
                  key={exp.id}
                  onClick={() => setSelectedExperiment(exp)}
                  className={`p-4 rounded-2xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#111a24] border-cyan-500/50 shadow-lg shadow-cyan-950/40'
                      : 'bg-[#0e141b] border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                        {exp.status === 'active' ? '● В процессе' : '✓ Завершен'}
                      </span>
                      <h3 className="text-sm font-bold text-white mt-1.5">{exp.title}</h3>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-extrabold text-cyan-400">
                        {logsCount} / {exp.durationDays} дн
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">дней замеров</div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 mt-2 italic leading-relaxed">
                    «{exp.hypothesis}»
                  </p>

                  {/* Independent & Dependent badges */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] pt-3 border-t border-slate-800/80">
                    <span className="text-slate-400">Влияние:</span>
                    {exp.independentMetrics.map((ind, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {ind.name} ({ind.targetValue} {ind.unit})
                      </span>
                    ))}
                    <ArrowRight className="w-3 h-3 text-cyan-400" />
                    <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-bold border border-cyan-700/50">
                      🎯 {exp.dependentMetric.name} ({exp.dependentMetric.unit})
                    </span>
                  </div>

                  {/* Action buttons if selected */}
                  {isSelected && (
                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCheckin(exp);
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 text-xs font-bold hover:brightness-110 transition flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Внести замер за сегодня
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRunAiAnalysis(exp);
                        }}
                        disabled={isAnalyzing}
                        className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 text-xs font-bold transition flex items-center gap-1.5"
                      >
                        {isAnalyzing ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <BrainCircuit className="w-3.5 h-3.5" />
                        )}
                        ИИ-Анализ N=1
                      </button>
                    </div>
                  )}

                  {/* AI Analysis Verdict if exists */}
                  {isSelected && aiAnalysisResult && (
                    <div className="mt-4 p-3.5 rounded-xl bg-gradient-to-br from-cyan-950/60 to-slate-900 border border-cyan-500/40 text-xs space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          Вердикт Research Lab ({aiAnalysisResult.aiProvider || 'Gemini + Grok'})
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {aiAnalysisResult.effectPercent > 0 ? `+${aiAnalysisResult.effectPercent}%` : `${aiAnalysisResult.effectPercent}%`} эффект
                        </span>
                      </div>
                      <p className="text-slate-200 leading-relaxed font-medium">
                        {aiAnalysisResult.summary}
                      </p>
                      <div className="text-[11px] text-cyan-300 font-mono bg-cyan-950/50 p-2 rounded-lg border border-cyan-800/40">
                        📊 Статистика: {aiAnalysisResult.statsText}
                      </div>
                      {aiAnalysisResult.recommendations && (
                        <div className="text-slate-300 text-[11px] pt-1">
                          <strong className="text-white block mb-0.5">Рекомендации тренера:</strong>
                          {aiAnalysisResult.recommendations}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: PERIODIZATION & TRAINING BLOCKS */}
      {subTab === 'periodization' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <h3 className="text-xs font-bold text-white">Управление циклами и волнами</h3>
                <p className="text-[11px] text-slate-300">Чередование фаз объема, силового пика и делода</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRunPeriodizationRecommend}
              disabled={isPeriodizationLoading}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center gap-1 shrink-0"
            >
              {isPeriodizationLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <BrainCircuit className="w-3 h-3" />}
              Совет ИИ по циклу
            </button>
          </div>

          {/* AI Periodization recommendation */}
          {periodizationRecommendation && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/40 text-xs space-y-2.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Рекомендация методиста GetFit
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                  Следующий блок: {periodizationRecommendation.nextBlockType}
                </span>
              </div>
              <p className="text-slate-200 leading-relaxed">
                {periodizationRecommendation.verdictSummary}
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">Длительность:</span>
                  <span className="font-bold text-white">{periodizationRecommendation.recommendedDurationWeeks} недели</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">Интенсивность:</span>
                  <span className="font-bold text-amber-400">{periodizationRecommendation.intensityRange}</span>
                </div>
              </div>
              {periodizationRecommendation.keyAdvice && (
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-300 pt-1">
                  {periodizationRecommendation.keyAdvice.map((adv: string, idx: number) => (
                    <li key={idx}>{adv}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Training blocks cards */}
          <div className="space-y-3">
            {trainingBlocks.map(block => (
              <div
                key={block.id}
                className={`p-4 rounded-2xl border transition ${
                  block.isCurrent
                    ? 'bg-[#141b24] border-amber-500/50 shadow-md'
                    : 'bg-[#0d1217] border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    block.isCurrent
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {block.isCurrent ? 'Текущий активный блок' : 'Завершенный блок'}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    {block.startDate} — {block.endDate}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-white mt-2">{block.title}</h4>
                <p className="text-xs text-slate-400 mt-1">{block.notes}</p>

                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-center">
                  <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Тоннаж</span>
                    <span className="text-xs font-extrabold text-amber-400">
                      {(block.totalTonnage || 0).toLocaleString('ru-RU')} кг
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Тренировок</span>
                    <span className="text-xs font-extrabold text-white">
                      {block.completedWorkoutsCount || 0}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Ср. RPE</span>
                    <span className="text-xs font-extrabold text-emerald-400">
                      {block.averageRpe || 8.0}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CUSTOM METRICS & CORRELATIONS */}
      {subTab === 'custom_metrics' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-emerald-400" />
              Конструктор персональных биомаркеров
            </h3>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Фиксируй любые факторы (боль, кофеин, сон, стресс, сауна) и сопоставляй с ростом силовых
            </p>
          </div>

          <div className="space-y-2.5">
            {customMetrics.map(cm => (
              <div
                key={cm.id}
                className="p-3 bg-[#0e141a] rounded-xl border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-white">{cm.name}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Категория: {cm.category} • Единица: {cm.unit}
                  </div>
                </div>
                <span className="text-xs font-mono px-2 py-1 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                  {cm.trackingType}
                </span>
              </div>
            ))}
          </div>

          {/* Correlation Insight Sample */}
          <div className="p-4 rounded-xl bg-[#111922] border border-cyan-500/30 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-cyan-400">Корреляционная матрица</span>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">r = +0.81 (Высокая)</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Обнаружена сильная прямая связь между <strong>качеством сна (≥7.5 часов)</strong> и <strong>весом первого рабочего подхода в жиме</strong>. В дни с качественным сном тоннаж был в среднем на 8.5% выше.
            </p>
          </div>
        </div>
      )}

      {/* Modal: Create Experiment from Templates */}
      {showNewExperimentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-[#0f1720] border border-[#1e293b] rounded-2xl p-5 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-cyan-400" />
                Выбери протокол эксперимента
              </h3>
              <button
                onClick={() => setShowNewExperimentModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 mt-4">
              {EXPERIMENT_TEMPLATES.map((tmpl, idx) => (
                <div
                  key={idx}
                  onClick={() => handleCreateFromTemplate(tmpl)}
                  className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/60 cursor-pointer transition text-xs group"
                >
                  <div className="flex items-center justify-between font-bold text-white group-hover:text-cyan-300 transition">
                    <span>{tmpl.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                      {tmpl.durationDays} дн
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-1.5 leading-relaxed">
                    {tmpl.hypothesis}
                  </p>
                  <div className="mt-2 text-[10px] text-slate-500">
                    Базовый уровень: {tmpl.baselineValue}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Daily Check-in */}
      {showDailyCheckinModal && selectedExperiment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#0f1720] border border-[#1e293b] rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">Замер за сегодня</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{selectedExperiment.title}</p>
              </div>
              <button
                onClick={() => setShowDailyCheckinModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Independent variables inputs */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300 block">
                Независимые переменные (факторы влияния):
              </label>
              {selectedExperiment.independentMetrics.map(m => (
                <div key={m.name} className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-xs">
                  <span className="text-slate-300 font-medium">{m.name} ({m.unit}):</span>
                  <input
                    type="number"
                    step="0.1"
                    value={logIndependent[m.name] || ''}
                    onChange={e => setLogIndependent(prev => ({ ...prev, [m.name]: parseFloat(e.target.value) || 0 }))}
                    className="w-24 text-right bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-cyan-400 font-bold focus:outline-none"
                  />
                </div>
              ))}

              {/* Dependent variable input */}
              <div className="pt-2 border-t border-slate-800">
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Зависимый показатель: {selectedExperiment.dependentMetric.name} ({selectedExperiment.dependentMetric.unit})
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={logDependent}
                  onChange={e => setLogDependent(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-cyan-500/50 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">Заметка о самочувствии:</label>
                <input
                  type="text"
                  value={logNotes}
                  onChange={e => setLogNotes(e.target.value)}
                  placeholder="Отличный памп, легко пожал..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDailyCheckinModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveDailyCheckin}
                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition shadow-md"
              >
                Зафиксировать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
