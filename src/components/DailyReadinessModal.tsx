import React, { useState } from 'react';
import { 
  HeartPulse, 
  Moon, 
  Activity, 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  TrendingUp, 
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { DailyReadiness, UserProfile } from '../types';

interface DailyReadinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentReadiness?: DailyReadiness;
  onSaveReadiness: (readiness: DailyReadiness) => void;
  user?: UserProfile;
}

const BODY_AREAS = [
  'Плечи / Ротаторы',
  'Поясница / Спина',
  'Колени / Квадрицепс',
  'Локти / Сухожилия',
  'Грудь / Ребра',
  'Шея / Трапеции',
];

export const DailyReadinessModal: React.FC<DailyReadinessModalProps> = ({
  isOpen,
  onClose,
  currentReadiness,
  onSaveReadiness,
  user,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [sleepHours, setSleepHours] = useState<number>(currentReadiness?.sleepHours || 7.5);
  const [sleepQuality, setSleepQuality] = useState<number>(currentReadiness?.sleepQuality || 8);
  const [muscleSoreness, setMuscleSoreness] = useState<number>(currentReadiness?.muscleSoreness || 3);
  const [stressLevel, setStressLevel] = useState<number>(currentReadiness?.stressLevel || 4);
  const [energyLevel, setEnergyLevel] = useState<number>(currentReadiness?.energyLevel || 8);
  const [selectedPainAreas, setSelectedPainAreas] = useState<string[]>(
    currentReadiness?.painAreas || []
  );

  if (!isOpen) return null;

  // Calculate composite readiness score (0-100)
  // Optimal sleep: 8h -> 25 pts, quality: 10 -> 25 pts, energy: 10 -> 25 pts
  // Soreness penalty: (soreness/10)*15, Stress penalty: (stress/10)*10
  const rawSleepScore = Math.min(1, sleepHours / 8) * 25;
  const sleepQualScore = (sleepQuality / 10) * 25;
  const energyScore = (energyLevel / 10) * 25;
  const sorenessPenalty = (muscleSoreness / 10) * 15;
  const stressPenalty = (stressLevel / 10) * 10;
  const painPenalty = selectedPainAreas.length * 4;

  const calculatedScore = Math.max(
    20,
    Math.min(100, Math.round(rawSleepScore + sleepQualScore + energyScore - sorenessPenalty - stressPenalty - painPenalty + 15))
  );

  // Recommendations based on score
  let statusText = '';
  let statusColor = '';
  let advice = '';
  let suggestedRpeMax = 9;

  if (calculatedScore >= 85) {
    statusText = 'Пиковая готовность (Peak Readiness)';
    statusColor = 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40';
    advice = 'Организм и ЦНС полностью восстановлены. Сегодня идеальный день для штурма 1ПМ, тяжелых подходов и прогрессии весов!';
    suggestedRpeMax = 9.5;
  } else if (calculatedScore >= 68) {
    statusText = 'Рабочая готовность (Optimal)';
    statusColor = 'text-cyan-400 border-cyan-500/40 bg-cyan-950/40';
    advice = 'Хороший уровень восстановления. Работай в целевом диапазоне RPE 7.5 - 8.5 без форсированных отказов.';
    suggestedRpeMax = 8.5;
  } else {
    statusText = 'Повышенная утомляемость ЦНС (Fatigue)';
    statusColor = 'text-amber-400 border-amber-500/40 bg-amber-950/40';
    advice = 'Высокий стресс или недосып. Рекомендуется снизить рабочий вес на 5-10% или сократить 1 рабочий подход (делод-корректировка).';
    suggestedRpeMax = 7.5;
  }

  const togglePainArea = (area: string) => {
    setSelectedPainAreas(prev => 
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  const handleSave = () => {
    const readiness: DailyReadiness = {
      date: todayStr,
      sleepHours,
      sleepQuality,
      muscleSoreness,
      stressLevel,
      energyLevel,
      painAreas: selectedPainAreas,
      overallReadinessScore: calculatedScore,
      notes: advice,
    };
    onSaveReadiness(readiness);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        id="daily-readiness-modal"
        className="w-full max-w-lg bg-[#0f1720] border border-[#1e293b] rounded-2xl p-5 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1e293b]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500/20 to-amber-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                Оценка готовности & RPE
              </h2>
              <p className="text-xs text-slate-400">Авторегуляция веса под состояние ЦНС и суставов</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Score Banner */}
        <div className={`my-4 p-4 rounded-xl border ${statusColor} flex items-center justify-between gap-4 transition-all`}>
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold opacity-80">Индекс восстановления ЦНС</div>
            <div className="text-sm font-bold mt-0.5">{statusText}</div>
            <p className="text-xs mt-1 leading-relaxed opacity-90">{advice}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-3xl font-extrabold tracking-tight">{calculatedScore}%</div>
            <div className="text-[11px] font-semibold opacity-75">Макс RPE: {suggestedRpeMax}</div>
          </div>
        </div>

        {/* Sliders & Inputs */}
        <div className="space-y-4">
          {/* Sleep Hours & Quality */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                Сон прошлой ночью
              </span>
              <span className="font-bold text-indigo-400">{sleepHours} ч</span>
            </div>
            <input
              type="range"
              min="4"
              max="11"
              step="0.5"
              value={sleepHours}
              onChange={e => setSleepHours(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
              <span className="text-slate-400">Качество сна:</span>
              <div className="flex gap-1">
                {[4, 6, 8, 10].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setSleepQuality(val)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      sleepQuality === val
                        ? 'bg-indigo-500 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {val === 10 ? 'Идеально' : val === 8 ? 'Хорошо' : val === 6 ? 'Средне' : 'Плохо'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Muscle / Joint Soreness */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                Крепатура / Боль в мышцах (1-10)
              </span>
              <span className={`font-bold ${muscleSoreness > 6 ? 'text-rose-400' : 'text-amber-400'}`}>
                {muscleSoreness} / 10
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={muscleSoreness}
              onChange={e => setMuscleSoreness(parseInt(e.target.value, 10))}
              className="w-full accent-amber-500 cursor-pointer"
            />

            {/* Problem Areas */}
            <div className="pt-2 border-t border-slate-800/60">
              <span className="text-[11px] text-slate-400 block mb-1.5">Есть дискомфорт в конкретных зонах?</span>
              <div className="flex flex-wrap gap-1.5">
                {BODY_AREAS.map(area => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => togglePainArea(area)}
                    className={`text-[11px] px-2 py-1 rounded-lg border transition ${
                      selectedPainAreas.includes(area)
                        ? 'bg-rose-500/20 border-rose-500/60 text-rose-300 font-bold'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
                    }`}
                  >
                    {selectedPainAreas.includes(area) ? '⚠️ ' : ''}{area}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Energy & Stress */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-300 font-semibold flex items-center gap-1">
                  <Zap className="w-3 h-3 text-cyan-400" /> Бодрость
                </span>
                <span className="font-bold text-cyan-400">{energyLevel}/10</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={energyLevel}
                onChange={e => setEnergyLevel(parseInt(e.target.value, 10))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-300 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-400" /> Стресс
                </span>
                <span className="font-bold text-rose-400">{stressLevel}/10</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={stressLevel}
                onChange={e => setStressLevel(parseInt(e.target.value, 10))}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-5 pt-4 border-t border-[#1e293b] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-900 border border-slate-800 transition"
          >
            Закрыть
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 transition shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            Применить индекс и RPE к тренировке
          </button>
        </div>
      </div>
    </div>
  );
};
