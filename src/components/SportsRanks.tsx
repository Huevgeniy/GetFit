import React, { useState } from 'react';
import { 
  Award, 
  ChevronRight, 
  CheckCircle2, 
  Target, 
  Dumbbell, 
  Sparkles, 
  Footprints, 
  Timer, 
  Zap,
  ArrowRight
} from 'lucide-react';
import { UserProfile, SportMovement, SportRankCriteria } from '../types';
import { SPORT_MOVEMENTS, compareResultWithRanks, RankComparisonResult } from '../data/ranksData';

interface SportsRanksProps {
  user: UserProfile;
  onSetTargetRank: (title: string, movementId: string, goalValue: number) => void;
}

export const SportsRanks: React.FC<SportsRanksProps> = ({
  user,
  onSetTargetRank,
}) => {
  const [federationFilter, setFederationFilter] = useState<string>('all');
  const [selectedMovementId, setSelectedMovementId] = useState<string>('wrpf_bench_press');
  const [inputWeight, setInputWeight] = useState<number>(user?.currentWeight || 84.5);
  const [inputResult, setInputResult] = useState<number>(115);
  const [comparison, setComparison] = useState<RankComparisonResult | null>(() => {
    return compareResultWithRanks('wrpf_bench_press', user?.currentWeight || 84.5, 115);
  });

  const selectedMovement = SPORT_MOVEMENTS.find(m => m.id === selectedMovementId) || SPORT_MOVEMENTS[0];

  const filteredMovements = React.useMemo(() => {
    if (federationFilter === 'all') return SPORT_MOVEMENTS;
    return SPORT_MOVEMENTS.filter(m => m.federation === federationFilter);
  }, [federationFilter]);

  const handleCompare = () => {
    const res = compareResultWithRanks(selectedMovementId, inputWeight, inputResult);
    setComparison(res);
  };

  const handleSelectMovement = (id: string) => {
    setSelectedMovementId(id);
    let defaultVal = 100;
    if (id.includes('bench_press')) defaultVal = 115;
    if (id.includes('squat')) defaultVal = 160;
    if (id.includes('deadlift')) defaultVal = 190;
    if (id === 'wsf_pullups') defaultVal = 35;
    if (id === 'wsf_dips') defaultVal = 55;
    if (id === 'bodyweight_pullups') defaultVal = 20;
    if (id === 'bodyweight_dips') defaultVal = 35;
    if (id === 'run_1000m') defaultVal = 200;
    if (id === 'run_100m') defaultVal = 13.0;
    if (id === 'swim_50m') defaultVal = 30.0;
    if (id === 'daily_steps') defaultVal = 12500;

    setInputResult(defaultVal);
    const res = compareResultWithRanks(id, inputWeight, defaultVal);
    setComparison(res);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'powerlifting':
        return <Dumbbell className="w-4 h-4 text-emerald-400" />;
      case 'workout':
        return <Zap className="w-4 h-4 text-teal-400" />;
      case 'athletics':
        return <Timer className="w-4 h-4 text-emerald-300" />;
      case 'steps':
        return <Footprints className="w-4 h-4 text-emerald-400" />;
      default:
        return <Award className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-950/70 via-[#12181f] to-teal-950/70 border border-emerald-500/30 rounded-2xl p-4">
        <div className="flex items-center gap-2.5 mb-1.5">
          <Award className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold text-slate-100">Спортивные разряды и нормативы</h2>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Проверь, на какой разряд ты тянешь прямо сейчас, выбери цель и отслеживай оставшиеся килограммы, секунды или шаги до следующего звания!
        </p>
      </div>

      {/* Movement Selector Chips with Federation Filter */}
      <div className="bg-[#12181f] border border-[#1e293b] rounded-xl p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
            Нормативы и Федерации
          </span>
          <span className="text-[10px] text-emerald-400 font-mono">
            {filteredMovements.length} стандартов
          </span>
        </div>

        {/* Federation Filter Pills */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'all', label: 'Все' },
            { id: 'WRPF', label: 'WRPF (Пауэрлифтинг)' },
            { id: 'WSF', label: 'WSF (Стритлифтинг)' },
            { id: 'Минспорт / ЕВСК', label: 'ЕВСК (Бег/Спорт)' },
            { id: 'ОФП / Фитнес', label: 'ОФП & Шаги' },
          ].map(fed => (
            <button
              key={fed.id}
              onClick={() => setFederationFilter(fed.id)}
              className={`py-1 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                federationFilter === fed.id
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-[#18232f] text-slate-400 hover:text-slate-200'
              }`}
            >
              {fed.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filteredMovements.map(mov => {
            const isSelected = mov.id === selectedMovementId;
            return (
              <button
                key={mov.id}
                onClick={() => handleSelectMovement(mov.id)}
                className={`p-2.5 rounded-xl text-left flex items-center gap-2.5 transition-all ${
                  isSelected
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                    : 'bg-[#151c24] text-slate-400 border border-transparent hover:text-slate-200'
                }`}
              >
                <div className="p-1.5 rounded-lg bg-[#0b0f12]">
                  {getCategoryIcon(mov.category)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate text-slate-100">{mov.name}</div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                    {mov.federation && (
                      <span className="text-emerald-400 font-mono font-semibold">{mov.federation}</span>
                    )}
                    <span>• {mov.unit}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Input Form & Compare Button */}
      <div className="bg-[#12181f] border border-[#1e293b] rounded-xl p-4">
        <div className="grid grid-cols-2 gap-3 mb-3">
          {selectedMovement.weightCategories && (
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Твой вес (кг)
              </label>
              <input
                type="number"
                value={inputWeight}
                onChange={e => setInputWeight(parseFloat(e.target.value) || 70)}
                className="w-full bg-[#18232f] border border-[#253342] rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          <div className={selectedMovement.weightCategories ? '' : 'col-span-2'}>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Твой результат ({selectedMovement.unit})
            </label>
            <input
              type="number"
              value={inputResult}
              onChange={e => setInputResult(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#18232f] border border-[#253342] rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <button
          onClick={handleCompare}
          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>Сравнить мой результат с разрядами</span>
        </button>
      </div>

      {/* Comparison Results */}
      {comparison && (
        <div className="space-y-4">
          {/* Current Rank Banner */}
          <div className="bg-gradient-to-br from-[#131c26] to-[#0e141c] border border-[#243344] rounded-2xl p-4 relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Твой текущий уровень ({comparison.weightCategoryLabel || comparison.movement.name})
                </span>
                <h3 className="text-xl font-extrabold text-emerald-400 mt-0.5">
                  {comparison.currentRank ? comparison.currentRank.title : 'Ниже 3 юношеского'}
                </h3>
              </div>

              {comparison.currentRank && (
                <div className="px-2.5 py-1 rounded-lg bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold">
                  {comparison.currentRank.shortTitle}
                </div>
              )}
            </div>

            {/* Next Rank Goal & Distance */}
            {comparison.nextRank ? (
              <div className="mt-3 pt-3 border-t border-[#1e2a38]">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-300">
                    Следующая цель: <strong>{comparison.nextRank.title}</strong>
                  </span>
                  <span className="text-emerald-400 font-mono font-bold">
                    {comparison.movement.isLowerBetter ? 'Быстрее на ' : 'Осталось: +'}
                    {comparison.remainingToNext} {comparison.movement.unit}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-[#18232f] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${comparison.percentToNext}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                  <span>{comparison.percentToNext}% пути пройдено</span>
                  <span>Цель: {comparison.nextRank.requiredValue} {comparison.movement.unit}</span>
                </div>

                {/* Set as profile goal button */}
                <button
                  onClick={() => {
                    if (comparison.nextRank) {
                      onSetTargetRank(
                        `${comparison.nextRank.title} (${comparison.nextRank.requiredValue} ${comparison.movement.unit})`,
                        comparison.movement.id,
                        comparison.nextRank.requiredValue
                      );
                    }
                  }}
                  className="mt-3 w-full py-2 rounded-lg bg-[#192430] hover:bg-[#223040] text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-emerald-500/20 transition-colors"
                >
                  <Target className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Установить «{comparison.nextRank.shortTitle}» целью в профиле</span>
                </button>
              </div>
            ) : (
              <div className="mt-3 text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Высший разряд норматива достигнут! Ты абсолютный топ!</span>
              </div>
            )}
          </div>

          {/* Full Ladder of Ranks */}
          <div className="bg-[#12181f] border border-[#1e293b] rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-[#161f28] border-b border-[#1f2937] flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">
                Сетка разрядов ({comparison.movement.name})
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {comparison.weightCategoryLabel || 'Общие нормы'}
              </span>
            </div>

            <div className="divide-y divide-[#1b2532]">
              {comparison.allRanks.map(({ criteria, status }) => {
                const isAchieved = status === 'achieved' || status === 'current';
                const isCurrent = status === 'current';
                const isNext = status === 'next';

                return (
                  <div
                    key={criteria.level}
                    className={`px-4 py-2.5 flex items-center justify-between text-xs transition-colors ${
                      isCurrent
                        ? 'bg-emerald-950/40 border-l-4 border-emerald-500'
                        : isNext
                        ? 'bg-[#151e29]'
                        : 'bg-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          isAchieved
                            ? 'bg-emerald-500 text-slate-950'
                            : isNext
                            ? 'bg-teal-900 text-teal-300 border border-teal-500/40'
                            : 'bg-[#18232f] text-slate-400'
                        }`}
                      >
                        {isAchieved ? '✓' : '•'}
                      </div>
                      <div>
                        <div className={`font-semibold ${isAchieved ? 'text-slate-100' : 'text-slate-400'}`}>
                          {criteria.title}
                        </div>
                        {criteria.description && (
                          <div className="text-[10px] text-slate-400">{criteria.description}</div>
                        )}
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className={`font-bold ${isCurrent ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {criteria.requiredValue} {criteria.unit}
                      </div>
                      {isCurrent && (
                        <div className="text-[10px] text-emerald-400 font-sans font-semibold">
                          Твой разряд
                        </div>
                      )}
                      {isNext && (
                        <div className="text-[10px] text-teal-400 font-sans font-semibold">
                          Следующая ступень
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
