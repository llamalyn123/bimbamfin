import React from 'react';
import { useApp, ActiveScreen } from '../context/AppContext';

export const BottomNav: React.FC = () => {
  const { activeScreen, setActiveScreen, currentUser, t } = useApp();

  if (!currentUser) return null;

  const navItems: { id: ActiveScreen; label: string; icon: string }[] = [
    { id: 'home', label: t('nav_today', 'Today'), icon: 'calendar_today' },
    { id: 'notes', label: t('nav_notes', 'Notes'), icon: 'description' },
    { id: 'quiz', label: t('nav_quiz', 'Quiz'), icon: 'quiz' },
    { id: 'events', label: t('nav_events', 'Events'), icon: 'celebration' },
    { id: 'more', label: t('nav_more', 'More'), icon: 'more_horiz' }
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-[#C9D1DB] z-50 flex items-center justify-around px-2 shadow-lg transition-colors">
      {navItems.map((item) => {
        const isActive =
          activeScreen === item.id ||
          (item.id === 'home' && (activeScreen === 'calendar' || activeScreen === 'matrix')) ||
          (item.id === 'notes' && activeScreen === 'notes-detail');

        return (
          <button
            key={item.id}
            onClick={() => setActiveScreen(item.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
              isActive ? 'text-[#D4A94F] font-bold' : 'text-[#64748B] hover:text-[#0E0E12]'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[22px] transition-transform ${
                isActive ? 'scale-110 text-[#D4A94F]' : ''
              }`}
            >
              {item.icon}
            </span>
            <span className="text-[10px] tracking-tight mt-0.5">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
