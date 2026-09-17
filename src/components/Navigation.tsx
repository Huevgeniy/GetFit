import React from 'react';
import { Dumbbell, Utensils, LineChart, FlaskConical, Award, ShieldCheck, User } from 'lucide-react';

export type NavTab = 'workouts' | 'nutrition' | 'charts' | 'lab' | 'ranks' | 'discipline' | 'profile' | 'battles';

interface NavigationProps {
  currentTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  pendingPenaltiesCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onChangeTab,
  pendingPenaltiesCount = 0,
}) => {
  const tabs = [
    { id: 'workouts' as NavTab, label: 'Тренировки', icon: Dumbbell },
    { id: 'nutrition' as NavTab, label: 'Питание/Сон', icon: Utensils },
    { id: 'charts' as NavTab, label: 'Прогресс', icon: LineChart },
    { id: 'lab' as NavTab, label: 'Лаборатория', icon: FlaskConical },
    { id: 'ranks' as NavTab, label: 'Разряды', icon: Award },
    { 
      id: 'discipline' as NavTab, 
      label: 'Дисциплина', 
      icon: ShieldCheck,
      badge: pendingPenaltiesCount > 0 ? pendingPenaltiesCount : undefined 
    },
    { id: 'profile' as NavTab, label: 'Профиль', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#0b0f12]/95 backdrop-blur-lg border-t border-[#1a232f] px-1 py-1.5 max-w-lg mx-auto">
      <div className="flex items-center justify-between overflow-x-auto no-scrollbar">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tour-tab-${tab.id}`}
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all duration-150 min-w-[46px] ${
                isActive
                  ? 'text-emerald-400 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${
                    isActive ? 'scale-110 text-emerald-400' : 'text-slate-400'
                  }`}
                />
                {tab.badge && (
                  <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[10px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center border border-[#0b0f12]">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[9px] sm:text-[10px] mt-0.5 whitespace-nowrap ${isActive ? 'font-semibold text-emerald-400' : 'text-slate-400'}`}>
                {tab.label}
              </span>
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-emerald-400 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
