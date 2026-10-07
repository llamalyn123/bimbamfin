import React from 'react';
import { Logo } from './Logo';
import { useApp, ActiveScreen } from '../context/AppContext';

export const Sidebar: React.FC = () => {
  const { activeScreen, setActiveScreen, currentUser, setIsAuthModalOpen, t } = useApp();

  if (!currentUser) return null;

  const navItems: { id: ActiveScreen; label: string; icon: string }[] = [
    { id: 'home', label: t('nav_today', 'Today'), icon: 'calendar_today' },
    { id: 'notes', label: t('nav_notes', 'Notes'), icon: 'description' },
    { id: 'quiz', label: t('nav_quiz', 'Quiz'), icon: 'quiz' },
    { id: 'events', label: t('nav_events', 'Events'), icon: 'celebration' },
    { id: 'more', label: t('nav_more', 'More'), icon: 'more_horiz' }
  ];

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-20 lg:w-64 bg-white border-r border-[#C9D1DB] z-50 flex-col justify-between transition-colors">
      <div className="flex flex-col">
        {/* Brand header */}
        <div 
          onClick={() => setActiveScreen('home')}
          className="h-16 flex items-center justify-center lg:justify-start px-3 lg:px-5 border-b border-[#C9D1DB] gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
        >
          <Logo size="h-[44px] w-[44px] lg:h-[52px] lg:w-[52px]" />
          <div className="hidden lg:flex flex-col">
            <span className="font-headline-sm text-headline-sm text-[#0E0E12] tracking-tight leading-none font-bold">
              Bimbam
            </span>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex flex-col gap-1.5 p-3">
          {navItems.map((item) => {
            const isActive =
              activeScreen === item.id ||
              (item.id === 'home' && (activeScreen === 'calendar' || activeScreen === 'matrix')) ||
              (item.id === 'notes' && activeScreen === 'notes-detail');
            return (
              <button
                key={item.id}
                onClick={() => setActiveScreen(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                  isActive
                    ? 'bg-[#F1F5F9] text-[#0E0E12] border-l-4 border-[#D4A94F] font-semibold shadow-xs'
                    : 'text-[#4B5563] hover:bg-[#F1F5F9] hover:text-[#0E0E12]'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[20px] ${
                    isActive ? 'text-[#D4A94F]' : 'text-[#64748B]'
                  }`}
                >
                  {item.icon}
                </span>
                <span className="hidden lg:inline font-body-md text-body-md">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info & Profile */}
      <div className="p-3 border-t border-[#C9D1DB] flex flex-col gap-2">

        {/* User profile toggle */}
        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="w-full flex items-center justify-between p-1.5 lg:p-2 rounded-xl bg-white hover:bg-slate-50 border border-[#C9D1DB] transition-colors cursor-pointer group"
          title="Student Account & Single Sign-On"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#0E0E12] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              {currentUser.initials}
            </div>
            <div className="hidden lg:flex flex-col text-left min-w-0">
              <span className="font-body-sm text-body-sm font-semibold text-[#0E0E12] truncate">
                {currentUser.name}
              </span>
              <span className="font-label-micro text-label-micro text-[#64748B] truncate">
                {currentUser.university === 'independent' ? 'Independent' : `${currentUser.university} Scholar`}
              </span>
            </div>
          </div>
          <span className="hidden lg:inline material-symbols-outlined text-[#64748B] text-[16px] group-hover:text-[#0E0E12]">
            unfold_more
          </span>
        </button>
      </div>
    </aside>
  );
};
