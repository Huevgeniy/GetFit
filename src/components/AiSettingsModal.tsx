import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  ShieldCheck, 
  BrainCircuit, 
  AlertCircle, 
  Pill, 
  Dumbbell, 
  Check, 
  Cpu, 
  Zap,
  Info
} from 'lucide-react';
import { UserProfile } from '../types';

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
}

const QUICK_PROMPT_PRESETS = [
  'Фокус на жим лежа и гипертрофию верха тела',
  'Не предлагать становую тягу и осевую нагрузку (грыжа поясницы)',
  'Строго научный подход, шкала RPE и авторегуляция нагрузки',
  'Подготовка к соревнованиям по пауэрлифтингу WRPF',
  'Тренируюсь дома: только гантели до 24 кг и турник',
  'Акцент на восстановление, суставы и снижение травматизма',
];

const QUICK_SUPPLEMENTS = [
  'Креатин моногидрат 5г',
  'Сывороточный протеин 30г',
  'Омега-3 2000мг',
  'Витамин D3 + K2',
  'Магний бисглицинат 400мг',
  'Кофеин 200мг перед тренировкой',
];

export const AiSettingsModal: React.FC<AiSettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateUser,
}) => {
  const [personalPrompt, setPersonalPrompt] = useState(user.aiPersonalPrompt || '');
  const [injuries, setInjuries] = useState(user.injuriesAndLimitations || '');
  const [supplements, setSupplements] = useState(user.activeSupplements || '');
  const [trainingStyle, setTrainingStyle] = useState<UserProfile['trainingStylePreference']>(
    user.trainingStylePreference || 'strength_powerlifting'
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdateUser({
      aiPersonalPrompt: personalPrompt.trim(),
      injuriesAndLimitations: injuries.trim(),
      activeSupplements: supplements.trim(),
      trainingStylePreference: trainingStyle,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  const handleAddPreset = (preset: string) => {
    if (personalPrompt.includes(preset)) return;
    setPersonalPrompt(prev => prev ? `${prev.trim()}\n• ${preset}` : `• ${preset}`);
  };

  const handleAddSupplement = (supp: string) => {
    if (supplements.includes(supp)) return;
    setSupplements(prev => prev ? `${prev.trim()}, ${supp}` : supp);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        id="ai-settings-modal"
        className="w-full max-w-lg bg-[#0f1720] border border-[#1e293b] rounded-2xl p-5 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1e293b]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                Настройки и Промт ИИ-Тренера
              </h2>
              <p className="text-xs text-slate-400">Персонализация интеллекта под твой организм</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dual AI Engine Indicator */}
        <div className="my-4 p-3 rounded-xl bg-gradient-to-r from-cyan-950/40 via-emerald-950/30 to-slate-900 border border-cyan-500/30 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
            <Cpu className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="flex items-center gap-2 font-bold text-white">
              <span>Двухъядерный ИИ-движок активен</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Синхронизировано
              </span>
            </div>
            <p className="text-slate-300 mt-1 leading-relaxed">
              <strong className="text-cyan-400">Gemini (DeepMind)</strong> + <strong className="text-emerald-400">Grok (xAI)</strong> работают в паре. Запросы обрабатываются мгновенно, с автоматическим резервным переключением без задержек.
            </p>
          </div>
        </div>

        {/* Section: Style of training */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Dumbbell className="w-3.5 h-3.5 text-amber-400" />
              Приоритетная методика тренировок
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'strength_powerlifting', label: 'Пауэрлифтинг & 1ПМ', desc: 'WRPF нормативы, сила' },
                { id: 'hypertrophy_bodybuilding', label: 'Бодибилдинг & Масса', desc: 'Гипертрофия, объем' },
                { id: 'streetlifting_calisthenics', label: 'Стритлифтинг', desc: 'Подтягивания/брусья с весом' },
                { id: 'functional_endurance', label: 'ОФП & Выносливость', desc: 'Функционал, дыхалка' },
              ].map(style => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setTrainingStyle(style.id as any)}
                  className={`p-2.5 rounded-xl text-left border transition text-xs ${
                    trainingStyle === style.id
                      ? 'bg-amber-500/10 border-amber-500/50 text-white shadow-sm'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-slate-200">{style.label}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{style.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Section: Personal Prompt for AI */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Личный промт и директивы для ИИ
              </label>
              <span className="text-[10px] text-slate-400">Внедряется в каждый запрос</span>
            </div>
            <textarea
              value={personalPrompt}
              onChange={e => setPersonalPrompt(e.target.value)}
              placeholder="Например: Я готовлюсь к нормативу КМС по жиму WRPF в категории до 82.5 кг. Всегда предлагай прогрессию по RPE. Не предлагай становую тягу..."
              rows={4}
              className="w-full bg-[#0a0f14] border border-[#1e293b] rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition"
            />

            {/* Quick Presets */}
            <div className="mt-2">
              <div className="text-[11px] text-slate-400 mb-1.5 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                Быстро добавить в промт одним нажатием:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPT_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddPreset(preset)}
                    className="text-[11px] px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition flex items-center gap-1 text-left"
                  >
                    <span>+</span> {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Injuries and Limitations */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              Травмы и физические ограничения (Обязательно для безопасности)
            </label>
            <input
              type="text"
              value={injuries}
              onChange={e => setInjuries(e.target.value)}
              placeholder="Например: плечевой импинджмент справа, грыжа поясницы L5-S1"
              className="w-full bg-[#0a0f14] border border-[#1e293b] rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500/60 transition"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              ИИ будет автоматически фильтровать опасные упражнения и предупреждать о нагрузке на эти зоны.
            </p>
          </div>

          {/* Section: Active Supplements */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Pill className="w-3.5 h-3.5 text-emerald-400" />
              Спортивное питание и добавки (для аналитики Research Lab)
            </label>
            <input
              type="text"
              value={supplements}
              onChange={e => setSupplements(e.target.value)}
              placeholder="Креатин 5г, Омега-3 2000мг, Протеин 30г"
              className="w-full bg-[#0a0f14] border border-[#1e293b] rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK_SUPPLEMENTS.map((supp, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddSupplement(supp)}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 hover:bg-emerald-900/50 transition"
                >
                  + {supp}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-[#1e293b] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-900 border border-slate-800 transition"
          >
            Отмена
          </button>
          <button
            id="save-ai-settings-btn"
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 transition shadow-lg shadow-cyan-900/30 flex items-center justify-center gap-1.5"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4" />
                Сохранено в профиль и ИИ-память!
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Сохранить персональные настройки
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
