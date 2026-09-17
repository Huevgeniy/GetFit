import React, { useState } from 'react';
import { 
  Activity, 
  Plus, 
  Upload, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Sparkles, 
  Camera, 
  Check, 
  Info, 
  Flame, 
  Droplet, 
  Dumbbell, 
  ShieldCheck,
  ChevronDown,
  Loader2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { InBodyRecord, UserProfile } from '../types';

interface InBodyTrackerProps {
  records: InBodyRecord[];
  user: UserProfile;
  onAddRecord: (record: InBodyRecord) => void;
}

export const InBodyTracker: React.FC<InBodyTrackerProps> = ({
  records,
  user,
  onAddRecord,
}) => {
  const [showManualModal, setShowManualModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Manual Form State
  const [weightKg, setWeightKg] = useState<number>(user?.currentWeight || 84.5);
  const [smmKg, setSmmKg] = useState<number>(41.2);
  const [bodyFatPercent, setBodyFatPercent] = useState<number>(14.8);
  const [totalWaterL, setTotalWaterL] = useState<number>(53.1);
  const [proteinKg, setProteinKg] = useState<number>(12.0);
  const [mineralsKg, setMineralsKg] = useState<number>(4.2);
  const [visceralFat, setVisceralFat] = useState<number>(5);
  const [bmrKcal, setBmrKcal] = useState<number>(1935);

  // AI Scan State
  const [scanImageBase64, setScanImageBase64] = useState<string | null>(null);
  const [scanText, setScanText] = useState<string>('');

  const latestRecord = records[0] || null;
  const previousRecord = records[1] || null;

  // Calculate deltas if 2+ records exist
  const muscleDelta = latestRecord && previousRecord 
    ? Math.round((latestRecord.skeletalMuscleMassKg - previousRecord.skeletalMuscleMassKg) * 10) / 10
    : 0;

  const fatPercentDelta = latestRecord && previousRecord
    ? Math.round((latestRecord.bodyFatPercent - previousRecord.bodyFatPercent) * 10) / 10
    : 0;

  const weightDelta = latestRecord && previousRecord
    ? Math.round((latestRecord.weightKg - previousRecord.weightKg) * 10) / 10
    : 0;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fatMass = Math.round((weightKg * (bodyFatPercent / 100)) * 10) / 10;
    const newRecord: InBodyRecord = {
      id: `inbody_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      weightKg,
      skeletalMuscleMassKg: smmKg,
      bodyFatMassKg: fatMass,
      bodyFatPercent,
      totalBodyWaterL: totalWaterL,
      proteinKg,
      mineralsKg,
      visceralFatLevel: visceralFat,
      bmrKcal,
      inBodyScore: Math.min(100, Math.round(80 + (smmKg / weightKg) * 20 - (bodyFatPercent - 12))),
      coachNotes: 'Замер добавлен вручную.',
    };

    onAddRecord(newRecord);
    setShowManualModal(false);
    confetti({ particleCount: 60, spread: 60 });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setScanImageBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAiScanSubmit = async () => {
    if (!scanImageBase64 && !scanText.trim()) return;

    setIsScanning(true);
    setScanError(null);

    try {
      const response = await fetch('/api/ai/parse-inbody', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: scanImageBase64,
          text: scanText,
          userProfile: user,
        }),
      });

      const data = await response.json();
      if (data.success && data.record) {
        onAddRecord(data.record);
        setShowScanModal(false);
        setScanImageBase64(null);
        setScanText('');
        confetti({ particleCount: 70, spread: 70 });
      } else {
        setScanError(data.error || 'Не удалось распознать скан. Попробуйте еще раз или введите вручную.');
      }
    } catch (err: any) {
      console.error(err);
      setScanError('Ошибка при связи с сервером ИИ.');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Quick Action Buttons */}
      <div className="bg-gradient-to-r from-emerald-950/60 via-[#12181f] to-teal-950/60 border border-emerald-500/30 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Биоимпеданс InBody</h2>
              <p className="text-[11px] text-slate-300">
                Мышцы, жир %, вода, белок, минералы и висцеральный уровень
              </p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-3.5 pt-3 border-t border-[#1e2a38]">
          <button
            onClick={() => setShowScanModal(true)}
            className="py-2.5 px-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Скан/Скриншот с ИИ</span>
          </button>

          <button
            onClick={() => setShowManualModal(true)}
            className="py-2.5 px-3 bg-[#17222e] hover:bg-[#202e3d] text-emerald-300 border border-emerald-500/30 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ввести вручную</span>
          </button>
        </div>
      </div>

      {latestRecord ? (
        <div className="space-y-4">
          {/* Latest Test Overview Card */}
          <div className="bg-[#12181f] border border-[#1e293b] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">
                  Замер от {new Date(latestRecord.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              {latestRecord.inBodyScore && (
                <span className="text-xs text-slate-300 font-mono">
                  Балл InBody: <strong className="text-emerald-400">{latestRecord.inBodyScore}/100</strong>
                </span>
              )}
            </div>

            {/* Muscle-Fat Analysis (Classic InBody D-Shape View) */}
            <div className="bg-[#0b1016] rounded-xl p-3 border border-[#1a2533] space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold uppercase">
                <span>Анализ «Мышцы — Жир»</span>
                <span className="text-emerald-400 font-mono">Атлетический D-тип</span>
              </div>

              {/* Weight bar */}
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">Вес</span>
                  <span className="font-bold text-slate-100">{latestRecord.weightKg} кг</span>
                </div>
                <div className="w-full bg-[#18232f] h-2 rounded-full overflow-hidden">
                  <div className="bg-slate-400 h-full rounded-full" style={{ width: `${Math.min(100, (latestRecord.weightKg / 120) * 100)}%` }} />
                </div>
              </div>

              {/* Skeletal Muscle Mass (SMM) */}
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Dumbbell className="w-3 h-3" />
                    <span>Скелетные мышцы (SMM)</span>
                  </span>
                  <span className="font-bold text-emerald-400">{latestRecord.skeletalMuscleMassKg} кг</span>
                </div>
                <div className="w-full bg-[#18232f] h-2.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${Math.min(100, (latestRecord.skeletalMuscleMassKg / 60) * 100)}%` }} />
                </div>
              </div>

              {/* Body Fat Mass */}
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">Масса жира</span>
                  <span className="font-bold text-slate-200">{latestRecord.bodyFatMassKg} кг ({latestRecord.bodyFatPercent}%)</span>
                </div>
                <div className="w-full bg-[#18232f] h-2 rounded-full overflow-hidden">
                  <div className="bg-teal-600 h-full rounded-full" style={{ width: `${Math.min(100, (latestRecord.bodyFatMassKg / 35) * 100)}%` }} />
                </div>
              </div>
            </div>

            {/* Compared with previous test (Deltas) */}
            {previousRecord && (
              <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-center">
                <div className="bg-[#151e29] p-2 rounded-xl border border-[#202e3f]">
                  <span className="text-[10px] text-slate-400 uppercase block">Вес</span>
                  <span className={`text-xs font-bold mt-0.5 block ${weightDelta <= 0 ? 'text-emerald-400' : 'text-slate-200'}`}>
                    {weightDelta > 0 ? `+${weightDelta}` : weightDelta} кг
                  </span>
                </div>

                <div className="bg-[#151e29] p-2 rounded-xl border border-[#202e3f]">
                  <span className="text-[10px] text-slate-400 uppercase block">Мышцы SMM</span>
                  <span className={`text-xs font-bold mt-0.5 block ${muscleDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {muscleDelta > 0 ? `+${muscleDelta}` : muscleDelta} кг
                  </span>
                </div>

                <div className="bg-[#151e29] p-2 rounded-xl border border-[#202e3f]">
                  <span className="text-[10px] text-slate-400 uppercase block">Жир PBF</span>
                  <span className={`text-xs font-bold mt-0.5 block ${fatPercentDelta <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {fatPercentDelta > 0 ? `+${fatPercentDelta}` : fatPercentDelta}%
                  </span>
                </div>
              </div>
            )}

            {/* Detailed Body Composition Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono pt-1">
              <div className="bg-[#151d26] p-2.5 rounded-xl">
                <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                  <Droplet className="w-3 h-3 text-teal-400" />
                  <span>Общая вода (TBW)</span>
                </div>
                <div className="text-slate-100 font-bold text-sm mt-0.5">
                  {latestRecord.totalBodyWaterL} л
                </div>
              </div>

              <div className="bg-[#151d26] p-2.5 rounded-xl">
                <div className="text-[10px] text-slate-400 uppercase">Протеин (белок)</div>
                <div className="text-slate-100 font-bold text-sm mt-0.5">
                  {latestRecord.proteinKg} кг
                </div>
              </div>

              <div className="bg-[#151d26] p-2.5 rounded-xl">
                <div className="text-[10px] text-slate-400 uppercase">Минералы</div>
                <div className="text-slate-100 font-bold text-sm mt-0.5">
                  {latestRecord.mineralsKg} кг
                </div>
              </div>

              <div className="bg-[#151d26] p-2.5 rounded-xl">
                <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>Висцеральный жир</span>
                </div>
                <div className="text-emerald-400 font-bold text-sm mt-0.5">
                  Уровень {latestRecord.visceralFatLevel} (норма 1-9)
                </div>
              </div>

              <div className="bg-[#151d26] p-2.5 rounded-xl col-span-2 sm:col-span-1">
                <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-400" />
                  <span>Базальный метаболизм</span>
                </div>
                <div className="text-amber-400 font-bold text-sm mt-0.5">
                  {latestRecord.bmrKcal} ккал/день
                </div>
              </div>
            </div>

            {/* Coach AI Insights / Notes */}
            {latestRecord.coachNotes && (
              <div className="mt-2 p-3 bg-gradient-to-r from-emerald-950/40 to-[#12181f] rounded-xl border border-emerald-500/20 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Заключение и рекомендации ИИ-тренера:</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  {latestRecord.coachNotes}
                </p>
              </div>
            )}
          </div>

          {/* History of InBody Records */}
          <div className="bg-[#12181f] border border-[#1e293b] rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2.5">
              История замеров InBody ({records.length})
            </span>
            <div className="space-y-2">
              {records.map(rec => (
                <div
                  key={rec.id}
                  className="bg-[#151d27] p-2.5 rounded-xl border border-[#222e3d] flex items-center justify-between text-xs font-mono"
                >
                  <div>
                    <div className="font-bold text-slate-100">{rec.date}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Вес: {rec.weightKg} кг • Мышцы: {rec.skeletalMuscleMassKg} кг
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-400 font-bold">{rec.bodyFatPercent}% жира</div>
                    <div className="text-[10px] text-slate-400">TBW: {rec.totalBodyWaterL} л</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#12181f] border border-[#1e293b] rounded-xl p-6 text-center text-xs text-slate-400 space-y-2">
          <Activity className="w-8 h-8 text-slate-600 mx-auto" />
          <p>Замеров InBody пока нет. Загрузи скан или введи показатели выше, чтобы отслеживать состав тела!</p>
        </div>
      )}

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12181f] border border-[#253342] rounded-2xl p-4 max-w-sm w-full max-h-[90vh] overflow-y-auto space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Ввод показателей InBody</span>
              </h3>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-slate-200 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-2.5 text-xs font-mono">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Вес (кг):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={weightKg}
                    onChange={e => setWeightKg(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-emerald-400 uppercase font-bold block mb-1">Мышцы SMM (кг):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={smmKg}
                    onChange={e => setSmmKg(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Процент жира (%):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bodyFatPercent}
                    onChange={e => setBodyFatPercent(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Общая вода TBW (л):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={totalWaterL}
                    onChange={e => setTotalWaterL(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Белок / Протеин (кг):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={proteinKg}
                    onChange={e => setProteinKg(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Минералы (кг):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={mineralsKg}
                    onChange={e => setMineralsKg(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Висцеральный жир (1-20):</label>
                  <input
                    type="number"
                    value={visceralFat}
                    onChange={e => setVisceralFat(parseInt(e.target.value, 10) || 5)}
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Метаболизм (ккал):</label>
                  <input
                    type="number"
                    value={bmrKcal}
                    onChange={e => setBmrKcal(parseInt(e.target.value, 10) || 1800)}
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[#1a2430] text-slate-300 font-semibold"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-500/20"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Scanner / Screenshot Modal */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12181f] border border-[#253342] rounded-2xl p-4 max-w-sm w-full space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>ИИ-распознавание InBody</span>
              </h3>
              <button
                onClick={() => setShowScanModal(false)}
                className="text-slate-400 hover:text-slate-200 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Загрузи фото распечатки теста InBody или вставь скриншот/текст из приложения зала. ИИ моментально считает все параметры и внесет в базу!
            </p>

            {/* File upload input */}
            <div className="space-y-2">
              <label className="block border-2 border-dashed border-[#293a4d] hover:border-emerald-500/50 rounded-xl p-4 text-center cursor-pointer transition-colors bg-[#0e141a]">
                <Camera className="w-6 h-6 text-emerald-400 mx-auto mb-1.5" />
                <span className="text-xs text-slate-200 font-semibold block">
                  {scanImageBase64 ? 'Фото выбрано (нажми для смены)' : 'Выбрать фото или скриншот'}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">JPG, PNG, HEIC</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {scanImageBase64 && (
                <div className="relative rounded-lg overflow-hidden max-h-36 border border-emerald-500/40">
                  <img src={scanImageBase64} alt="InBody Preview" className="w-full h-full object-cover" />
                </div>
              )}

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Или вставьте текст/параметры из отчета:
                </label>
                <textarea
                  value={scanText}
                  onChange={e => setScanText(e.target.value)}
                  placeholder="Вес 84.5 кг, скелетные мышцы 41.2 кг, процент жира 14.8%..."
                  rows={2}
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>
            </div>

            {scanError && (
              <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs">
                {scanError}
              </div>
            )}

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setShowScanModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#1a2430] text-slate-300 font-semibold text-xs"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleAiScanSubmit}
                disabled={isScanning || (!scanImageBase64 && !scanText.trim())}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-xs shadow-md flex items-center justify-center gap-1.5"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Анализирую...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Распознать с ИИ</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
