import React from 'react';
import { Flame, ShieldCheck, MoreVertical, X, Sparkles, BrainCircuit, HelpCircle } from 'lucide-react';
import { UserProfile } from '../types';

interface TelegramHeaderProps {
  user?: UserProfile;
  title?: string;
  subtitle?: string;
  disciplineScore?: number;
  streakDays?: number;
  isWorkoutActive?: boolean;
  onOpenLiveWorkout?: () => void;
  onProfileClick?: () => void;
  onOpenAiSettings?: () => void;
  onOpenTutorial?: () => void;
}

export const TelegramHeader: React.FC<TelegramHeaderProps> = ({
  user,
  title = 'GetFitBot',
  subtitle = 'AI Fitness & Discipline',
  disciplineScore,
  streakDays,
  isWorkoutActive = false,
  onOpenLiveWorkout,
  onProfileClick,
  onOpenAiSettings,
  onOpenTutorial,
}) => {
  const userName = user?.name && user.name.trim().length > 0 ? user.name : 'Атлет';
  const userInitial = userName.charAt(0).toUpperCase() || 'A';
  const userTg = user?.telegramUsername && user.telegramUsername.trim().length > 0 ? user.telegramUsername : '@username';
  const userWeight = user?.currentWeight && user.currentWeight > 0 ? `${user.currentWeight} кг` : 'Внести вес';
  const userStreak = streakDays ?? user?.streakDays ?? 0;
  const userDiscipline = disciplineScore ?? user?.disciplineScore ?? 100;

  return (
    <header className="sticky top-0 z-40 bg-[#0b0f12]/95 backdrop-blur-md border-b border-[#1a242f] px-4 py-2.5">
      {/* Telegram simulated frame top bar */}
      <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 select-none">
        <div className="flex items-center gap-1.5 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-slate-300 font-semibold tracking-wide">{title}</span>
          <span className="text-[10px] text-emerald-400/90 font-mono bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/30">
            MINI APP
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            type="button"
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
            title={subtitle}
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          <button 
            type="button"
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
            title="Закрыть"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* User Status Bar */}
      <div className="flex items-center justify-between pt-0.5">
        <div 
          onClick={onProfileClick}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center font-bold text-sm text-white shadow-sm border border-emerald-400/30 group-hover:scale-105 transition-transform">
              {userInitial}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0b0f12]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                {userName}
              </span>
              <span className="text-xs text-emerald-400/80 font-mono">{userTg}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>{userWeight} кг</span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 flex items-center gap-0.5">
                <Flame className="w-3 h-3 fill-emerald-400 text-emerald-400" />
                {userStreak} дн. стрик
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Active workout indicator button */}
          {isWorkoutActive && (
            <button
              onClick={onOpenLiveWorkout}
              className="flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-400 px-2.5 py-1.5 rounded-lg text-xs font-semibold animate-pulse transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>В процессе</span>
            </button>
          )}

          {/* AI Settings & Personal Prompt Quick Button */}
          {onOpenAiSettings && (
            <button 
              id="header-ai-brain-btn"
              onClick={onOpenAiSettings}
              className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-950/60 to-emerald-950/60 border border-cyan-500/40 hover:border-cyan-400 px-2.5 py-1.5 rounded-lg text-cyan-400 transition-all active:scale-95 shadow-sm shadow-cyan-950/40"
              title="Настройки интеллекта и персональный промт ИИ"
            >
              <BrainCircuit className="w-3.5 h-3.5 text-cyan-400" />
              <div className="text-left leading-none">
                <div className="text-[9px] text-cyan-300/80 uppercase font-semibold">ИИ Мозг</div>
                <div className="text-[11px] font-bold text-white mt-0.5">Промт</div>
              </div>
            </button>
          )}

          {/* Tutorial / Guide Question Mark button */}
          {onOpenTutorial && (
            <button
              id="header-tutorial-btn"
              type="button"
              onClick={onOpenTutorial}
              className="w-8 h-8 rounded-xl bg-[#141c24] border border-[#22303f] hover:border-amber-400/60 text-slate-300 hover:text-amber-300 flex items-center justify-center transition-all active:scale-95 shrink-0 shadow-sm"
              title="Обучение и интерактивный гайд по приложению"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          )}

          {/* Discipline Score Badge */}
          <div 
            onClick={onProfileClick}
            className="flex items-center gap-1.5 bg-[#141c24] border border-[#22303f] px-2.5 py-1.5 rounded-lg cursor-pointer hover:border-emerald-500/40 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold leading-none">
                Дисциплина
              </div>
              <div className="text-xs font-bold text-emerald-400 leading-tight">
                {userDiscipline}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
