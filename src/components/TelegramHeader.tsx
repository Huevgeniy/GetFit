import React from 'react';
import { Flame, ShieldCheck, Sparkles, BrainCircuit, HelpCircle } from 'lucide-react';
import { UserProfile } from '../types';

interface TelegramHeaderProps {
  user?: UserProfile;
  title?: string;
  subtitle?: string;
  disciplineScore?: number;
  streakDays?: number;
  isWorkoutActive?: boolean;
  /** Показывать ли дисциплину: в базовом режиме раздел выключен. */
  showDiscipline?: boolean;
  onOpenLiveWorkout?: () => void;
  onProfileClick?: () => void;
  onOpenAiSettings?: () => void;
  onOpenTutorial?: () => void;
}

/**
 * Компактная шапка Mini App.
 *
 * Свою «рамку Telegram» не рисуем: у клиента уже есть кнопки закрытия и меню.
 * Здесь только бренд, быстрые действия и карточка пользователя. Всё сжимается
 * до 320 px: ник скрывается, имя и подписи обрезаются, а не вылезают за экран.
 */
export const TelegramHeader: React.FC<TelegramHeaderProps> = ({
  user,
  title = 'GetFitBot',
  subtitle = 'AI Fitness & Discipline',
  disciplineScore,
  streakDays,
  isWorkoutActive = false,
  showDiscipline = true,
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

  const iconButton = 'w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-95 shrink-0 border';

  return (
    <header className="safe-top sticky top-0 z-40 bg-[#0b0f12]/95 backdrop-blur-md border-b border-[#1a242f] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 font-mono">
          <span className="w-2 h-2 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
          <span className="truncate text-xs font-semibold tracking-wide text-slate-300">{title}</span>
          <span className="shrink-0 text-[10px] text-emerald-400/90 font-mono bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/30">
            MINI APP
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isWorkoutActive && (
            <button
              type="button"
              onClick={onOpenLiveWorkout}
              className={`${iconButton} bg-emerald-500/15 border-emerald-500/40 text-emerald-400 animate-pulse`}
              title="Тренировка идёт — вернуться в зал"
              aria-label="Тренировка идёт — вернуться в зал"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}
          {onOpenTutorial && (
            <button
              id="header-tutorial-btn"
              type="button"
              onClick={onOpenTutorial}
              className={`${iconButton} bg-[#141c24] border-[#22303f] hover:border-amber-400/60 text-slate-300 hover:text-amber-300`}
              title="Обучение и интерактивный гайд по приложению"
              aria-label="Обучение"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          )}
          {onOpenAiSettings && (
            <button
              id="header-ai-brain-btn"
              type="button"
              onClick={onOpenAiSettings}
              className={`${iconButton} bg-gradient-to-br from-cyan-950/70 to-emerald-950/70 border-cyan-500/40 hover:border-cyan-400 text-cyan-400 shadow-sm shadow-cyan-950/40`}
              title={`${subtitle}. Настройки интеллекта и персональный промт ИИ`}
              aria-label="Настроить ИИ"
            >
              <BrainCircuit className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={onProfileClick}
          className="group flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center font-bold text-xs text-white shadow-sm border border-emerald-400/30 group-hover:scale-105 transition-transform">
              {userInitial}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0b0f12]" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-baseline gap-1.5">
              <span className="truncate text-sm font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                {userName}
              </span>
              <span className="hidden min-[360px]:inline truncate text-[10px] text-emerald-400/80 font-mono">
                {userTg}
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-slate-400">
              <span className="truncate">{userWeight}</span>
              <span className="text-slate-600">•</span>
              <span className="flex shrink-0 items-center gap-0.5 text-emerald-400">
                <Flame className="w-3 h-3 fill-emerald-400 text-emerald-400" />
                {userStreak} дн.
              </span>
            </div>
          </div>
        </button>

        {showDiscipline && (
          <button
            type="button"
            onClick={onProfileClick}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-[#22303f] bg-[#141c24] px-2 py-1.5 text-emerald-400 hover:border-emerald-500/40 transition-colors"
            title="Дисциплина: открой профиль, чтобы посмотреть детали"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="text-[11px] font-bold leading-none">{userDiscipline}%</span>
          </button>
        )}
      </div>
    </header>
  );
};
