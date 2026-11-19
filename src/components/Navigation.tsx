import React, { useEffect, useState } from 'react';
import {
  Dumbbell,
  Utensils,
  LineChart,
  FlaskConical,
  Award,
  ShieldCheck,
  User,
  Layers,
  Swords,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { hapticSelect } from '../lib/telegram';
import { FeatureFlags, FEATURES, FeatureKey } from '../lib/features';

/** «Отчёты» больше не отдельная вкладка: они открываются кнопкой внутри «Прогресса». */
export type NavTab =
  | 'workouts'
  | 'nutrition'
  | 'charts'
  | 'lab'
  | 'periodization'
  | 'ranks'
  | 'discipline'
  | 'profile'
  | 'battles';

interface NavigationProps {
  currentTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  pendingPenaltiesCount?: number;
  features?: FeatureFlags;
}

interface TabDef {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  description?: string;
}

const featureDescription = (key: FeatureKey): string =>
  FEATURES.find((feature) => feature.key === key)?.description ?? '';

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onChangeTab,
  pendingPenaltiesCount = 0,
  features,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [currentTab]);

  const primary: TabDef[] = [
    { id: 'workouts', label: 'Тренировки', icon: Dumbbell },
    { id: 'nutrition', label: 'Питание', icon: Utensils },
    { id: 'charts', label: 'Прогресс', icon: LineChart },
    { id: 'profile', label: 'Профиль', icon: User },
  ];

  const optional: TabDef[] = [
    ...(features?.battles
      ? [{ id: 'battles' as NavTab, label: 'Зарубы', icon: Swords, description: featureDescription('battles') }]
      : []),
    ...(features?.discipline
      ? [
          {
            id: 'discipline' as NavTab,
            label: 'Дисциплина',
            icon: ShieldCheck,
            badge: pendingPenaltiesCount > 0 ? pendingPenaltiesCount : undefined,
            description: featureDescription('discipline'),
          },
        ]
      : []),
    ...(features?.ranks
      ? [{ id: 'ranks' as NavTab, label: 'Разряды', icon: Award, description: featureDescription('ranks') }]
      : []),
    ...(features?.lab
      ? [{ id: 'lab' as NavTab, label: 'Лаборатория', icon: FlaskConical, description: featureDescription('lab') }]
      : []),
    ...(features?.periodization
      ? [{ id: 'periodization' as NavTab, label: 'Циклы', icon: Layers, description: featureDescription('periodization') }]
      : []),
  ];

  // Один дополнительный раздел показываем напрямую. Если включено два и больше,
  // нижняя панель не растягивается: четыре базовые вкладки + «Ещё».
  const hasOverflow = optional.length > 1;
  const visible: TabDef[] = hasOverflow
    ? [...primary, { id: 'profile', label: 'Ещё', icon: MoreHorizontal }]
    : [...primary.slice(0, 3), ...optional, primary[3]];

  const hiddenActive = hasOverflow && optional.some((tab) => tab.id === currentTab);
  const hiddenBadge = pendingPenaltiesCount > 0 && features?.discipline ? pendingPenaltiesCount : undefined;

  return (
    <>
      {menuOpen && hasOverflow && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Дополнительные разделы">
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 h-full w-full bg-black/70 backdrop-blur-sm"
            aria-label="Закрыть меню разделов"
          />
          <div className="absolute bottom-0 left-0 right-0 mx-auto w-full max-w-lg safe-bottom rounded-t-2xl border-t border-[#263546] bg-[#0d141b] px-3 pb-3 pt-2 shadow-2xl">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-600/60" />
            <div className="mb-2 flex items-center justify-between px-1">
              <div>
                <div className="text-xs font-bold text-slate-200">Ещё разделы</div>
                <div className="text-[10px] text-slate-500">Включены в настройках профиля</div>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="w-7 h-7 rounded-lg bg-[#1a2636] hover:bg-[#25374d] text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                aria-label="Закрыть"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {optional.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      hapticSelect();
                      onChangeTab(tab.id);
                      setMenuOpen(false);
                    }}
                    className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors ${
                      isActive
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                        : 'border-[#22303f] bg-[#111a23] text-slate-300 hover:border-emerald-500/30'
                    }`}
                  >
                    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#18232f]">
                      <Icon className="w-4 h-4" />
                      {tab.badge && (
                        <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[#0b0f12] bg-rose-500 text-[9px] font-bold text-white">
                          {tab.badge}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold">{tab.label}</span>
                      <span className="block truncate text-[10px] text-slate-500">{tab.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                onChangeTab('profile');
                setMenuOpen(false);
              }}
              className="mt-2 w-full rounded-xl border border-[#22303f] bg-[#111a23] px-3 py-2 text-[11px] font-semibold text-slate-400 hover:text-slate-200"
            >
              Настроить разделы в профиле
            </button>
          </div>
        </div>
      )}

      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-30 bg-[#0b0f12]/95 backdrop-blur-lg border-t border-[#1a232f] px-1 py-1.5 max-w-lg mx-auto">
        <div className="flex items-stretch gap-0.5">
          {visible.map((tab) => {
            const Icon = tab.icon;
            const isMore = tab.label === 'Ещё';
            const isActive = currentTab === tab.id && !isMore;
            const moreActive = isMore && hiddenActive;
            const active = isActive || moreActive;
            const badge = isMore ? hiddenBadge : tab.badge;
            return (
              <button
                key={`${tab.id}-${tab.label}`}
                id={isMore ? 'tour-tab-more' : `tour-tab-${tab.id}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  if (isMore) {
                    hapticSelect();
                    setMenuOpen(true);
                    return;
                  }
                  if (currentTab !== tab.id) hapticSelect();
                  onChangeTab(tab.id);
                }}
                className={`relative flex min-w-0 flex-1 flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all duration-150 ${
                  active ? 'text-emerald-400 font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${
                      active ? 'scale-110 text-emerald-400' : 'text-slate-400'
                    }`}
                  />
                  {badge && (
                    <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[10px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center border border-[#0b0f12]">
                      {badge}
                    </span>
                  )}
                  {moreActive && (
                    <span className="absolute -bottom-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                </div>
                <span className={`text-[9px] sm:text-[10px] mt-0.5 whitespace-nowrap ${active ? 'font-semibold text-emerald-400' : 'text-slate-400'}`}>
                  {tab.label}
                </span>
                {active && <div className="w-1 h-1 rounded-full bg-emerald-400 mt-0.5" />}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
