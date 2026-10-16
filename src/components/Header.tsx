import React, { useState } from 'react';
import { HowItWorksButton } from './HowItWorks';
import { Logo } from './Logo';
import { useApp } from '../context/AppContext';
import { SUPPORTED_LANGUAGES } from '../i18n/translations';

export const Header: React.FC = () => {
  const {
    isSyncing,
    refreshFromSupabase,
    setIsAuthModalOpen,
    currentUser,
    resolvedTheme,
    themeMode,
    setThemeMode,
    language,
    setLanguage,
    t
  } = useApp();

  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  if (!currentUser) return null;

  return (
    <header className="fixed top-0 left-0 md:left-20 lg:left-64 right-0 h-16 bg-white/95 backdrop-blur-xl border-b border-[#C9D1DB] z-40 flex items-center justify-between px-4 sm:px-6 transition-colors">
      {/* Left title & context */}
      <div className="flex items-center gap-3">
        <Logo size="h-[35px] w-[35px] md:hidden" />
        <span className="font-headline-sm text-sm sm:text-headline-sm text-[#0E0E12] tracking-tight font-bold">
          {t('core_heading', 'Bimbam')}
        </span>
        <div className="h-4 w-[1px] bg-[#C9D1DB] hidden sm:block"></div>
        
        {/* Active Sync Badge */}
        <button
          onClick={refreshFromSupabase}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F1F5F9] border border-[#C9D1DB] hover:bg-slate-200 transition-colors cursor-pointer"
          title="Refresh your data"
        >
          <span className={`w-1.5 h-1.5 rounded-full bg-[#10B981] ${isSyncing ? 'animate-ping' : 'animate-pulse'}`}></span>
          <span className="font-label-micro text-label-micro text-[#4B5563] uppercase tracking-wider font-semibold">
            {isSyncing ? 'Refreshing…' : 'Refresh'}
          </span>
        </button>

        {/* Theme switch: Light → Dark → Auto (dark 7pm–7am or when device is dark) */}
        <button
          type="button"
          onClick={() => setThemeMode(themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'system' : 'light')}
          title="Switch theme"
          aria-label={`Theme: ${themeMode === 'system' ? 'auto' : themeMode}. Click to switch.`}
          className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#F8FAFC] border border-[#C9D1DB] text-[11px] text-[#64748B] hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[14px] text-[#D4A94F]">
            {themeMode === 'system' ? 'contrast' : resolvedTheme === 'dark' ? 'dark_mode' : 'light_mode'}
          </span>
          <span className="font-label-micro text-label-micro font-medium">
            {themeMode === 'system' ? 'Auto' : themeMode === 'dark' ? 'Dark' : 'Light'}
          </span>
        </button>

        {/* University Affiliation Badge */}
        {currentUser?.university && (
          <div className="hidden lg:flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 border border-[#C9D1DB] text-[11px] font-mono font-semibold text-[#0E0E12]">
            <span className={`w-1.5 h-1.5 rounded-full ${currentUser.university === 'independent' ? 'bg-gray-400' : 'bg-indigo-600'}`}></span>
            <span>{currentUser.university === 'independent' ? t('independent', 'Independent') : currentUser.university}</span>
          </div>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        <HowItWorksButton />
        {/* Language selector dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F8FAFC] border border-[#C9D1DB] hover:bg-[#F1F5F9] transition-colors cursor-pointer shadow-xs"
            title="Switch Language (English, 中文, தமிழ், Deutsch)"
          >
            <span className="text-sm">{SUPPORTED_LANGUAGES.find(l => l.code === language)?.flag}</span>
            <span className="font-label-tabular text-label-tabular text-[#0E0E12] font-semibold uppercase">{language}</span>
            <span className="material-symbols-outlined text-[#64748B] text-[16px]">expand_more</span>
          </button>

          {isLangMenuOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl border border-[#C9D1DB] shadow-lg py-1 z-50 animate-in fade-in duration-150">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsLangMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-slate-50 transition cursor-pointer ${
                    language === lang.code ? 'font-bold text-[#363FEF] bg-indigo-50/50' : 'text-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{lang.flag}</span>
                    <span>{lang.nativeName}</span>
                  </span>
                  {language === lang.code && (
                    <span className="material-symbols-outlined text-[16px] text-[#363FEF]">check</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User avatar button */}
        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="w-8 h-8 rounded-full bg-[#0E0E12] text-white flex items-center justify-center shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
          title="Account profile & SSO"
        >
          <span className="font-label-micro font-bold">{currentUser.initials}</span>
        </button>
      </div>
    </header>
  );
};
