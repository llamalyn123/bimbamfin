import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ConnectedCalendars } from '../components/ConnectedCalendars';
import { CampusFacilities } from '../components/CampusFacilities';
import { UniversityAffiliation } from '../lib/supabase';
import {
  User,
  Shield,
  Layers,
  GraduationCap,
  HardDrive,
  Globe,
  Bell,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  LogOut,
  Moon,
  Sun,
  Lock,
  Building2,
  AlertCircle,
  Languages
} from 'lucide-react';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../i18n/translations';

export const MoreScreen: React.FC = () => {
  const {
    currentUser,
    isInstitutional,
    updateUniversity,
    setIsAuthModalOpen,
    logoutUser,
    isSyncing,
    refreshFromSupabase,
    lastSyncedText,
    deadlines,
    notes,
    events,
    sources,
    themeMode,
    setThemeMode,
    resolvedTheme,
    language,
    setLanguage,
    showEnglishSubtitles,
    setShowEnglishSubtitles,
    t
  } = useApp();

  const [activeTab, setActiveTab] = useState<'account' | 'language' | 'lms' | 'facilities' | 'notifications' | 'storage' | 'compliance'>('account');
  const [autoSyncLms, setAutoSyncLms] = useState(true);
  const [isUpdatingUni, setIsUpdatingUni] = useState(false);

  // Campus facilities is school-email only; Connected accounts is open to everyone
  useEffect(() => {
    if (!isInstitutional && activeTab === 'facilities') {
      setActiveTab('account');
    }
  }, [isInstitutional, activeTab]);

  const handleUniversityChange = async (targetUni: UniversityAffiliation) => {
    setIsUpdatingUni(true);
    try {
      await updateUniversity(targetUni);
    } finally {
      setIsUpdatingUni(false);
    }
  };

  const currentUni = currentUser?.university || 'independent';

  return (
    <div className="flex-1 overflow-y-auto bg-[#F4F7FB] p-4 sm:p-6 lg:p-8 transition-colors">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Breadcrumb & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono tracking-wider text-gray-500 uppercase">
              <span>Workspace</span>
              <span>/</span>
              <span className="text-[#363FEF] font-semibold">Settings & More</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-gray-900 mt-1">Preferences & Workspace Configuration</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={refreshFromSupabase}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition shadow-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#363FEF]' : ''}`} />
              <span>{isSyncing ? 'Refreshing…' : 'Refresh'}</span>
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{lastSyncedText}</span>
            </div>
          </div>
        </div>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
          {/* Navigation Sub-rail */}
          <div className="bg-white rounded-xl border border-gray-200 p-2 shadow-xs space-y-1">
            <button
              onClick={() => setActiveTab('account')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === 'account'
                  ? 'bg-[#363FEF] text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 shrink-0" />
                <span>{t('more_tab_account', 'Scholar Profile')}</span>
              </div>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold uppercase ${
                activeTab === 'account' ? 'bg-white/20 text-white' : 'bg-slate-100 text-gray-600'
              }`}>
                {currentUni === 'independent' ? 'General' : currentUni}
              </span>
            </button>

            {/* Language Switcher Tab */}
            <button
              onClick={() => setActiveTab('language')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === 'language'
                  ? 'bg-[#363FEF] text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Languages className="w-4 h-4 shrink-0" />
                <span>{t('more_tab_language', 'Language & Locale')}</span>
              </div>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                activeTab === 'language' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {language.toUpperCase()}
              </span>
            </button>

            {/* Connected accounts: school calendar in, phone calendar out (all students) */}
            {(
              <button
                onClick={() => setActiveTab('lms')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTab === 'lms'
                    ? 'bg-[#363FEF] text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Layers className="w-4 h-4 shrink-0" />
                  <span>{t('more_tab_connected', 'Connected accounts')}</span>
                </div>
              </button>
            )}

            {isInstitutional && (
              <button
                onClick={() => setActiveTab('facilities')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTab === 'facilities'
                    ? 'bg-[#363FEF] text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <GraduationCap className="w-4 h-4 shrink-0" />
                  <span>{t('more_tab_facilities', 'Campus Facilities')}</span>
                </div>
              </button>
            )}

            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition text-left cursor-pointer ${
                activeTab === 'notifications'
                  ? 'bg-[#363FEF] text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Bell className="w-4 h-4 shrink-0" />
              <span>Reminders</span>
            </button>

            <button
              onClick={() => setActiveTab('storage')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition text-left cursor-pointer ${
                activeTab === 'storage'
                  ? 'bg-[#363FEF] text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <HardDrive className="w-4 h-4 shrink-0" />
              <span>Your data</span>
            </button>

            <button
              onClick={() => setActiveTab('compliance')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition text-left cursor-pointer ${
                activeTab === 'compliance'
                  ? 'bg-[#363FEF] text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span>Privacy & PDPA</span>
            </button>
          </div>

          {/* Tab Content Panes */}
          <div className="md:col-span-3 space-y-6">
            {activeTab === 'account' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-6">
                <div>
                  <h2 className="text-base font-bold text-gray-900 font-display">{t('more_identity_title', 'Academic Identity & Institution')}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{t('more_identity_subtitle', 'Manage your credentials, detected university affiliation, and profile record.')}</p>
                </div>

                {/* Profile Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-[#181C26] text-white font-mono font-bold text-lg flex items-center justify-center shadow-xs shrink-0">
                      {currentUser?.initials || 'ST'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm">{currentUser?.name || 'Scholar'}</span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-mono font-semibold rounded-full">
                          ACTIVE SCHOLAR
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">{currentUser?.email || 'scholar@university.edu'}</p>
                      <p className="text-[11px] text-gray-400 mt-1 font-mono">Account ID: {currentUser?.id}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsAuthModalOpen(true)}
                      className="px-3.5 py-2 text-xs font-semibold text-[#363FEF] bg-[#EEF0FF] rounded-lg hover:bg-[#E0E4FF] transition cursor-pointer"
                    >
                      {t('open_quick_profile', 'Quick Profile')}
                    </button>
                    <button
                      onClick={logoutUser}
                      className="px-3.5 py-2 text-xs font-semibold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      {t('more_sign_out_btn', 'Sign Out')}
                    </button>
                  </div>
                </div>

                {/* INSTITUTION: derived from the login email's domain, not selectable */}
                <div className="p-4 rounded-xl border border-[#C9D1DB] bg-gray-50 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-[#0E0E12] flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-[#D4A94F]" />
                        Institution
                      </span>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {currentUni === 'SMU' && 'Singapore Management University'}
                        {currentUni === 'NUS' && 'National University of Singapore'}
                        {currentUni === 'NTU' && 'Nanyang Technological University'}
                        {currentUni === 'independent' && 'Independent: no school email on this account'}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                      {currentUni === 'independent' ? 'INDEPENDENT' : currentUni}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 flex items-start gap-1">
                    <span className="material-symbols-outlined text-[14px]">info</span>
                    <span>
                      {currentUni === 'independent'
                        ? 'Set from your login email. Sign up with your school email (e.g. @smu.edu.sg) to unlock school features like campus facilities.'
                        : `Set from your login email domain (${currentUser?.email?.split('@')[1] ?? ''}). It can't be changed by hand.`}
                    </span>
                  </p>
                </div>

                {/* UI Language Switcher */}
                <div className="border-t border-gray-100 pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <Languages className="w-3.5 h-3.5 text-[#363FEF]" />
                        <span>{t('more_lang_title', 'UI Language Switcher')}</span>
                      </h3>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {t('more_lang_subtitle', 'Instant app-wide localization for labels, buttons, navigation, and headings.')}
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-gray-400">
                      {t('more_lang_current', 'Active Language')}: <strong className="text-[#0E0E12]">{SUPPORTED_LANGUAGES.find(l => l.code === language)?.nativeName}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {SUPPORTED_LANGUAGES.map((lang) => {
                      const isSelected = language === lang.code;
                      return (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => setLanguage(lang.code)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                            isSelected
                              ? 'border-[#363FEF] bg-[#EEF0FF] text-[#1E26B0] shadow-xs ring-1 ring-[#363FEF]'
                              : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xl">{lang.flag}</span>
                            {isSelected ? (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#363FEF] text-white">
                                ACTIVE
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                {lang.code.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-xs block text-gray-900">
                              {lang.nativeName}
                            </span>
                            <span className="text-[10px] text-gray-500 block">
                              {lang.name}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-gray-400 font-mono">
                    ✓ {t('more_lang_saved_notice', 'Language preference persists automatically across sessions.')}
                  </p>

                  {/* English Subtitles Toggle - only visible when display language is not English */}
                  {language !== 'en' && (
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-gray-200 mt-2">
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-[20px] text-[#363FEF]">subtitles</span>
                        <div>
                          <label htmlFor="account-subtitles-toggle" className="text-xs font-bold text-gray-900 cursor-pointer block">
                            Show English subtitles
                          </label>
                          <p className="text-[11px] text-gray-500">
                            Display English translation beneath concept headings and explanations in master notes.
                          </p>
                        </div>
                      </div>
                      <button
                        id="account-subtitles-toggle"
                        type="button"
                        role="switch"
                        aria-checked={showEnglishSubtitles}
                        onClick={() => setShowEnglishSubtitles(!showEnglishSubtitles)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          showEnglishSubtitles ? 'bg-[#363FEF]' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            showEnglishSubtitles ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  )}
                </div>

                {/* Appearance Mode */}
                <div className="border-t border-gray-100 pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider font-mono">Theme</h3>
                    <span className="text-[11px] font-mono text-gray-400">
                      Now showing: <strong className="text-[#0E0E12]">{resolvedTheme === 'dark' ? 'Dark' : 'Light'}</strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setThemeMode('light')}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-medium transition cursor-pointer ${
                        themeMode === 'light'
                          ? 'border-[#D4A94F] bg-[#FFFBEB] text-[#92400E] shadow-xs'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Sun className="w-4 h-4 mb-1 text-[#D4A94F]" />
                      <span className="font-semibold">Light</span>
                      <span className="text-[10px] text-gray-400 mt-0.5">Bright, default</span>
                    </button>
                    <button
                      onClick={() => setThemeMode('dark')}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-medium transition cursor-pointer ${
                        themeMode === 'dark'
                          ? 'border-[#D4A94F] bg-[#1F1F27] text-white shadow-xs'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Moon className="w-4 h-4 mb-1 text-[#D4A94F]" />
                      <span className="font-semibold">Dark</span>
                      <span className="text-[10px] text-gray-400 mt-0.5">Easier at night</span>
                    </button>
                    <button
                      onClick={() => setThemeMode('system')}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-medium transition cursor-pointer ${
                        themeMode === 'system'
                          ? 'border-[#D4A94F] bg-indigo-50 text-indigo-700 shadow-xs'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Globe className="w-4 h-4 mb-1 text-indigo-600" />
                      <span className="font-semibold">Auto</span>
                      <span className="text-[10px] text-gray-400 mt-0.5">Dark 7pm–7am</span>
                    </button>
                  </div>

                </div>
              </div>
            )}

            {/* DEDICATED LANGUAGE & LOCALE TAB */}
            {activeTab === 'language' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 font-display flex items-center gap-2">
                      <Languages className="w-5 h-5 text-[#363FEF]" />
                      <span>{t('more_lang_title', 'UI Language Switcher')}</span>
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t('more_lang_subtitle', 'Instant app-wide localization for every label, button, and heading across all screens.')}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-indigo-50 border border-indigo-200 text-indigo-700">
                    {language.toUpperCase()} • {SUPPORTED_LANGUAGES.find(l => l.code === language)?.nativeName}
                  </span>
                </div>

                {/* 4 Language Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {SUPPORTED_LANGUAGES.map((lang) => {
                    const isSelected = language === lang.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => setLanguage(lang.code)}
                        className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                          isSelected
                            ? 'border-[#363FEF] bg-[#EEF0FF] shadow-sm ring-2 ring-[#363FEF]'
                            : 'border-gray-200 bg-gray-50/60 hover:bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-3xl">{lang.flag}</span>
                          {isSelected ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-[#363FEF] text-white">
                              CURRENT ACTIVE
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-white border border-gray-200 text-gray-600">
                              SELECT
                            </span>
                          )}
                        </div>

                        <div>
                          <span className="text-base font-bold text-gray-900 block font-display">
                            {lang.nativeName}
                          </span>
                          <span className="text-xs text-gray-500 block">
                            {lang.name} ({lang.code})
                          </span>
                        </div>

                        <div className="pt-2 border-t border-gray-200/60 text-[11px] text-gray-600 flex items-center justify-between">
                          <span>{lang.code === 'en' ? 'English (UK/US)' : lang.code === 'zh' ? '中文 (中国/新加坡)' : lang.code === 'ta' ? 'தமிழ் (சிங்கப்பூர்)' : 'Deutsch (DACH)'}</span>
                          <span className="font-mono text-[10px] text-gray-400">100% Translated</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* English Subtitles Toggle - only visible when display language is not English */}
                {language !== 'en' && (
                  <div className="flex items-center justify-between p-4 rounded-xl bg-indigo-50/60 border border-indigo-100">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-100 text-[#363FEF] flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px]">subtitles</span>
                      </div>
                      <div>
                        <label htmlFor="language-tab-subtitles-toggle" className="text-xs font-bold text-gray-900 cursor-pointer block">
                          Show English subtitles
                        </label>
                        <p className="text-[11px] text-gray-600">
                          Dual-language display: view master notes in {SUPPORTED_LANGUAGES.find(l => l.code === language)?.nativeName} with subordinate English subtitles beneath headings and explanations.
                        </p>
                      </div>
                    </div>
                    <button
                      id="language-tab-subtitles-toggle"
                      type="button"
                      role="switch"
                      aria-checked={showEnglishSubtitles}
                      onClick={() => setShowEnglishSubtitles(!showEnglishSubtitles)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        showEnglishSubtitles ? 'bg-[#363FEF]' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          showEnglishSubtitles ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* CONNECTED ACCOUNTS: real calendar sync */}
            {activeTab === 'lms' && <ConnectedCalendars />}

            {/* CAMPUS FACILITIES: public info + the student's own bookings */}
            {activeTab === 'facilities' && <CampusFacilities />}

            {/* REMINDERS TAB: how reminders actually reach the student */}
            {activeTab === 'notifications' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-5">
                <div>
                  <h2 className="text-base font-bold text-gray-900 font-display">Reminders</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Bimbam sends reminders through your phone's own calendar, so they arrive even when the app is closed.
                  </p>
                </div>
                <ul className="space-y-3 text-xs text-gray-700">
                  <li className="flex gap-3">
                    <span className="material-symbols-outlined text-[18px] text-[#B45309]">flag</span>
                    <span>
                      <span className="font-bold text-gray-900 block">Deadlines</span>
                      1 day and 2 hours before. Ticked-off deadlines stop reminding.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="material-symbols-outlined text-[18px] text-[#BE185D]">celebration</span>
                    <span>
                      <span className="font-bold text-gray-900 block">Events you add</span>
                      1 day before, or the time you pick with the bell. Register-by dates remind you until you tap Done.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="material-symbols-outlined text-[18px] text-[#4F46E5]">meeting_room</span>
                    <span>
                      <span className="font-bold text-gray-900 block">Bookings</span>
                      The time you chose when adding it (30 min, 1 hour or 1 day before).
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="material-symbols-outlined text-[18px] text-[#0EA5E9]">send</span>
                    <span>
                      <span className="font-bold text-gray-900 block">Telegram groups</span>
                      In a group with the Bimbam bot, /due adds a deadline for everyone who joined, e.g. /due Slides draft Fri 6pm. It lands in each member's Bimbam, so it reminds them like any other deadline.
                    </span>
                  </li>
                </ul>
                <div className="p-4 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                  <p className="text-xs text-[#0E0E12]">
                    <span className="font-bold">Not getting reminders?</span> Add Bimbam to your phone calendar once. It updates by itself.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('lms')}
                    className="px-3 py-1.5 rounded-lg bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] text-xs font-bold shrink-0 cursor-pointer"
                  >
                    Set up phone calendar
                  </button>
                </div>
              </div>
            )}

            {/* STORAGE & DATA TAB */}
            {activeTab === 'storage' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-6">
                <div>
                  <h2 className="text-base font-bold text-gray-900 font-display">Your data</h2>
                  <p className="text-xs text-gray-500 mt-0.5">What's saved in your Bimbam account. Download or learn more in Privacy & PDPA.</p>
                </div>

                {/* Data Statistics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-white border border-gray-200 rounded-lg text-center">
                    <div className="text-xl font-bold font-mono text-[#363FEF]">{deadlines.length}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Deadlines</div>
                  </div>
                  <div className="p-3 bg-white border border-gray-200 rounded-lg text-center">
                    <div className="text-xl font-bold font-mono text-[#363FEF]">{events.length}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Events</div>
                  </div>
                  <div className="p-3 bg-white border border-gray-200 rounded-lg text-center">
                    <div className="text-xl font-bold font-mono text-[#363FEF]">{notes.length}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Notes</div>
                  </div>
                  <div className="p-3 bg-white border border-gray-200 rounded-lg text-center">
                    <div className="text-xl font-bold font-mono text-[#363FEF]">{sources.length}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Sources</div>
                  </div>
                </div>

              </div>
            )}

            {/* PRIVACY & COMPLIANCE TAB */}
            {activeTab === 'compliance' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-6">
                <div>
                  <h2 className="text-base font-bold text-gray-900 font-display">Privacy & your data (PDPA)</h2>
                  <p className="text-xs text-gray-500 mt-0.5">What Bimbam keeps, who processes it, and what it never touches.</p>
                </div>
                <div className="space-y-3 text-xs text-gray-600 leading-relaxed">
                  <p>
                    <span className="font-semibold text-gray-900">What we store:</span> your account email and name, files you upload,
                    the notes and quizzes made from them, deadlines and classes from calendars you connect or upload, events and
                    bookings you choose to add, and your settings. Stored in Supabase (Singapore region if your project is set
                    there), encrypted in transit and at rest.
                  </p>
                  <p>
                    <span className="font-semibold text-gray-900">Who can see it:</span> only you. Database rules lock every row to
                    your account; other students can't read your data.
                  </p>
                  <p>
                    <span className="font-semibold text-gray-900">AI processing:</span> when you tap Generate, Quiz, Go deeper or
                    paste a message, that content is sent to the AI provider Bimbam uses to produce the result. Depending on the
                    provider's terms it may be kept or used to improve their models, so don't upload other people's personal data.
                  </p>
                  <p>
                    <span className="font-semibold text-gray-900">Telegram (if you connect it):</span> we store your Telegram
                    user ID and username, and which groups you joined with /join. The bot only reads commands and messages you
                    forward to it, never your chats. Forwarded messages are read by the AI once and not stored; only the event
                    details you approve are kept. They may include other people's words, so don't forward anything personal.
                    In groups, /meet shows times everyone is free, never what anyone is doing. Disconnect or leave a group
                    anytime in Connected accounts.
                  </p>
                  <p>
                    <span className="font-semibold text-gray-900">What we never access:</span> your university inbox, SMU login,
                    grades or bookings. Bimbam only sees what you upload, paste or connect yourself.
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                  <span className="text-xs font-bold text-gray-900">Student Data Ownership</span>
                  <p className="text-[11px] text-gray-500">
                    Your notes and uploads stay yours. Download a copy of your data at any time. To delete your account and everything in it, contact the Bimbam team (self-service deletion is coming).
                  </p>
                  <div className="pt-2 flex gap-3">
                    <button
                      onClick={() => {
                        const exportData = {
                          user: currentUser,
                          deadlines,
                          events,
                          notes,
                          sources,
                          exportedAt: new Date().toISOString()
                        };
                        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `bimbam-data-${new Date().toISOString().slice(0, 10)}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-[#363FEF] bg-[#EEF0FF] rounded-lg hover:bg-[#E0E4FF] transition cursor-pointer"
                    >
                      Download my data
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
