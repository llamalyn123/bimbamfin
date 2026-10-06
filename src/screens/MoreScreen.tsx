import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ConnectedCalendars } from '../components/ConnectedCalendars';
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
  Trash2,
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
  const [deadlineAlerts, setDeadlineAlerts] = useState(true);
  const [eventRecommendations, setEventRecommendations] = useState(true);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [isUpdatingUni, setIsUpdatingUni] = useState(false);

  // If university changes to independent, ensure tab reverts away from institutional-only features
  useEffect(() => {
    if (!isInstitutional && (activeTab === 'lms' || activeTab === 'facilities')) {
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

  const handleClearLocalCache = () => {
    localStorage.removeItem('nocturne_deadlines_cache');
    localStorage.removeItem('nocturne_events_cache');
    localStorage.removeItem('nocturne_notes_cache');
    localStorage.removeItem('nocturne_sources_cache');
    localStorage.removeItem('nocturne_quiz_cache');
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 3000);
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
              <span>{isSyncing ? 'Syncing...' : 'Sync Supabase'}</span>
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
              <span>{t('more_tab_notifications', 'Notifications')}</span>
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
              <span>{t('more_tab_storage', 'Storage & Data')}</span>
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
              <span>{t('more_tab_compliance', 'Privacy & FERPA')}</span>
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

                {/* DETECTED UNIVERSITY & CORRECTION CONTROLS */}
                <div className="p-4 rounded-xl border border-[#C9D1DB] bg-gradient-to-br from-white to-gray-50 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-[#0E0E12] flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-[#D4A94F]" />
                        {t('more_detected_uni', 'Detected Institution Affiliation')}
                      </span>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {currentUni === 'SMU' && 'Singapore Management University • Verified Institutional Access'}
                        {currentUni === 'NUS' && 'National University of Singapore • Verified Institutional Access'}
                        {currentUni === 'NTU' && 'Nanyang Technological University • Verified Institutional Access'}
                        {currentUni === 'independent' && 'Independent Scholar • Manual notes, quizzes, and personal deadline tracking'}
                      </p>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
                      isInstitutional ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {currentUni === 'independent' ? 'INDEPENDENT' : `${currentUni} AFFILIATED`}
                    </span>
                  </div>

                  {/* Correction Switcher */}
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wider font-mono">
                        {t('more_correct_uni', 'Correct or Change Institution:')}
                      </span>
                      {isUpdatingUni && (
                        <span className="text-[10px] text-indigo-600 font-mono animate-pulse">{t('more_uni_syncing', 'Syncing profiles table...')}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => handleUniversityChange('SMU')}
                        disabled={isUpdatingUni}
                        className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition cursor-pointer flex flex-col items-center gap-0.5 ${
                          currentUni === 'SMU'
                            ? 'border-[#D4A94F] bg-[#FFFBEB] text-[#92400E] shadow-xs'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="font-bold text-sm">SMU</span>
                        <span className="text-[10px] font-normal text-gray-500">Singapore Mgmt</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUniversityChange('NUS')}
                        disabled={isUpdatingUni}
                        className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition cursor-pointer flex flex-col items-center gap-0.5 ${
                          currentUni === 'NUS'
                            ? 'border-[#D4A94F] bg-[#FFFBEB] text-[#92400E] shadow-xs'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="font-bold text-sm">NUS</span>
                        <span className="text-[10px] font-normal text-gray-500">Natl Univ of Singapore</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUniversityChange('NTU')}
                        disabled={isUpdatingUni}
                        className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition cursor-pointer flex flex-col items-center gap-0.5 ${
                          currentUni === 'NTU'
                            ? 'border-[#D4A94F] bg-[#FFFBEB] text-[#92400E] shadow-xs'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="font-bold text-sm">NTU</span>
                        <span className="text-[10px] font-normal text-gray-500">Nanyang Tech Univ</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUniversityChange('independent')}
                        disabled={isUpdatingUni}
                        className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition cursor-pointer flex flex-col items-center gap-0.5 ${
                          currentUni === 'independent'
                            ? 'border-[#363FEF] bg-indigo-50 text-indigo-800 shadow-xs'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="font-bold text-sm">Independent</span>
                        <span className="text-[10px] font-normal text-gray-500">General Scholar</span>
                      </button>
                    </div>
                  </div>
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
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider font-mono">{t('more_theme_title', 'Workspace Theme')}</h3>
                    <span className="text-[11px] font-mono text-gray-400">
                      Active: <strong className="text-[#0E0E12]">{resolvedTheme === 'dark' ? 'Dark (Ink Black #0E0E12)' : 'Light (Ice White #F4F7FB)'}</strong>
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
                      <span className="font-semibold">{t('theme_light', 'Editorial Light')}</span>
                      <span className="text-[10px] text-gray-400 mt-0.5">Ice White #F4F7FB</span>
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
                      <span className="font-semibold">{t('theme_dark', 'Nocturne Dark')}</span>
                      <span className="text-[10px] text-gray-400 mt-0.5">Ink Black #0E0E12</span>
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
                      <span className="font-semibold">{t('theme_system', 'System Match')}</span>
                      <span className="text-[10px] text-gray-400 mt-0.5">Auto Device Sync</span>
                    </button>
                  </div>

                  {/* Shared Accents Palette Showcase */}
                  <div className="pt-2 flex flex-col gap-2">
                    <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wider">
                      {t('more_theme_palette_title', 'Shared Color Tokens (Calibrated for Light & Dark)')}
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-[10px] font-mono">
                      <div className="p-2 rounded-lg bg-[rgba(212,169,79,0.15)] border border-[#D4A94F] text-[#92400E]">
                        <span className="block font-bold">#D4A94F</span>
                        <span className="text-[9px] uppercase">Gold Accent</span>
                      </div>
                      <div className="p-2 rounded-lg bg-[rgba(255,79,163,0.15)] border border-[#FF4FA3] text-[#FF4FA3]">
                        <span className="block font-bold">#FF4FA3</span>
                        <span className="text-[9px] uppercase">Orchid Events</span>
                      </div>
                      <div className="p-2 rounded-lg bg-[rgba(124,92,255,0.15)] border border-[#7C5CFF] text-[#7C5CFF]">
                        <span className="block font-bold">#7C5CFF</span>
                        <span className="text-[9px] uppercase">Violet Category</span>
                      </div>
                      <div className="p-2 rounded-lg bg-[rgba(255,107,107,0.15)] border border-[#FF6B6B] text-[#FF6B6B]">
                        <span className="block font-bold">#FF6B6B</span>
                        <span className="text-[9px] uppercase">Red Urgency</span>
                      </div>
                      <div className="p-2 rounded-lg bg-[rgba(242,169,59,0.15)] border border-[#F2A93B] text-[#F2A93B]">
                        <span className="block font-bold">#F2A93B</span>
                        <span className="text-[9px] uppercase">Amber Warning</span>
                      </div>
                    </div>
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
                <div className="p-4 rounded-xl bg-slate-50 border border-gray-200 space-y-3">
                  <span className="text-xs font-bold text-gray-900 uppercase tracking-wider font-mono block">
                    Live UI Text Demonstration ({SUPPORTED_LANGUAGES.find(l => l.code === language)?.nativeName})
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                      <span className="text-[10px] text-gray-400 uppercase block font-mono">nav_today</span>
                      <span className="font-semibold text-gray-900">{t('nav_today')}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                      <span className="text-[10px] text-gray-400 uppercase block font-mono">nav_calendar</span>
                      <span className="font-semibold text-gray-900">{t('nav_calendar')}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                      <span className="text-[10px] text-gray-400 uppercase block font-mono">nav_matrix</span>
                      <span className="font-semibold text-gray-900">{t('nav_matrix')}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                      <span className="text-[10px] text-gray-400 uppercase block font-mono">nav_notes</span>
                      <span className="font-semibold text-gray-900">{t('nav_notes')}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                      <span className="text-[10px] text-gray-400 uppercase block font-mono">nav_quiz</span>
                      <span className="font-semibold text-gray-900">{t('nav_quiz')}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                      <span className="text-[10px] text-gray-400 uppercase block font-mono">nav_events</span>
                      <span className="font-semibold text-gray-900">{t('nav_events')}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                      <span className="text-[10px] text-gray-400 uppercase block font-mono">home_mark_complete</span>
                      <span className="font-semibold text-gray-900">{t('home_mark_complete')}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                      <span className="text-[10px] text-gray-400 uppercase block font-mono">matrix_add_deadline_btn</span>
                      <span className="font-semibold text-gray-900">{t('matrix_add_deadline_btn')}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 font-mono">
                    ✓ {t('more_lang_saved_notice', 'Language preference persists automatically across sessions.')}
                  </p>
                </div>
              </div>
            )}

            {/* CONNECTED ACCOUNTS: real calendar sync */}
            {activeTab === 'lms' && <ConnectedCalendars />}

            {/* FACILITIES TAB - GATED BY INSTITUTION */}
            {activeTab === 'facilities' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-6">
                <div>
                  <h2 className="text-base font-bold text-gray-900 font-display">{t('facilities_title', 'Campus Facilities & Study Lounges')}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{t('facilities_subtitle', 'Availability and direct booking links for campus research labs and discussion carrels.')}</p>
                </div>

                {isInstitutional ? (
                  /* Institutional Booking Links for SMU, NUS, NTU */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {currentUni === 'SMU' && (
                      <>
                        <div className="p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-900">SMU Li Ka Shing Bloomberg Lab</span>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-mono font-semibold rounded">4 of 8 FREE</span>
                          </div>
                          <p className="text-xs text-gray-600">Terminal 03 & 04 reserved for Valuation Modeling & Capstone Projects.</p>
                          <div className="pt-2 flex items-center justify-between">
                            <span className="text-[11px] text-gray-400 font-mono">Open until 02:00 AM</span>
                            <button className="text-xs font-semibold text-[#363FEF] hover:underline inline-flex items-center gap-1 cursor-pointer">
                              Book Slot <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-900">SMU Connexion Research Pods</span>
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-mono font-semibold rounded">HIGH DEMAND</span>
                          </div>
                          <p className="text-xs text-gray-600">Sound-dampened individual study carrels with dual 4K monitors.</p>
                          <div className="pt-2 flex items-center justify-between">
                            <span className="text-[11px] text-gray-400 font-mono">24/7 Keycard Access</span>
                            <button className="text-xs font-semibold text-[#363FEF] hover:underline inline-flex items-center gap-1 cursor-pointer">
                              Reserve <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {currentUni === 'NUS' && (
                      <>
                        <div className="p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-900">NUS Central Library Bloomberg Hub</span>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-mono font-semibold rounded">6 FREE</span>
                          </div>
                          <p className="text-xs text-gray-600">Level 4 Financial Analytics workstation cluster.</p>
                          <div className="pt-2 flex items-center justify-between">
                            <span className="text-[11px] text-gray-400 font-mono">Open 08:30 AM - Midnight</span>
                            <button className="text-xs font-semibold text-[#363FEF] hover:underline inline-flex items-center gap-1 cursor-pointer">
                              NUS Booking <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-900">NUS UTown Mac Commons</span>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-mono font-semibold rounded">AVAILABLE</span>
                          </div>
                          <p className="text-xs text-gray-600">Quiet study carrels and collaborative workstations with high-speed Wi-Fi.</p>
                          <div className="pt-2 flex items-center justify-between">
                            <span className="text-[11px] text-gray-400 font-mono">24/7 Access</span>
                            <button className="text-xs font-semibold text-[#363FEF] hover:underline inline-flex items-center gap-1 cursor-pointer">
                              Reserve <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {currentUni === 'NTU' && (
                      <>
                        <div className="p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-900">NTU Lee Wee Nam Bloomberg Lab</span>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-mono font-semibold rounded">5 FREE</span>
                          </div>
                          <p className="text-xs text-gray-600">Financial trading and portfolio analytics suite.</p>
                          <div className="pt-2 flex items-center justify-between">
                            <span className="text-[11px] text-gray-400 font-mono">Open 08:30 AM - 10:00 PM</span>
                            <button className="text-xs font-semibold text-[#363FEF] hover:underline inline-flex items-center gap-1 cursor-pointer">
                              NTU Booking <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-900">The Arc Learning Pods</span>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-mono font-semibold rounded">ROOM 3B FREE</span>
                          </div>
                          <p className="text-xs text-gray-600">Smart project rooms with wireless projection and collaboration whiteboards.</p>
                          <div className="pt-2 flex items-center justify-between">
                            <span className="text-[11px] text-gray-400 font-mono">Open until 11:00 PM</span>
                            <button className="text-xs font-semibold text-[#363FEF] hover:underline inline-flex items-center gap-1 cursor-pointer">
                              Reserve Room <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  /* Independent Scholar Notice: Facility Booking Restricted */
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                      <div className="flex items-center gap-2 font-bold text-amber-900">
                        <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Campus Facility Booking Restricted</span>
                      </div>
                      <p className="text-amber-800 leading-relaxed text-[11px]">
                        Booking links for university Bloomberg labs and discussion pods are reserved for enrolled students at SMU, NUS, or NTU with institutional keycard credentials.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2 text-xs text-gray-600">
                      <span className="font-bold text-gray-900">Open Public & Independent Workstations</span>
                      <p className="text-[11px] leading-relaxed">
                        Independent scholars are recommended to utilize Singapore National Library Board (NLB) reference pods, open-access university library floors, or co-working study lounges.
                      </p>
                      <div className="pt-2">
                        <button
                          onClick={() => handleUniversityChange('SMU')}
                          className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition cursor-pointer"
                        >
                          Switch to SMU / NUS / NTU Student Profile
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* NOTIFICATIONS TAB */}
            {activeTab === 'notifications' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-6">
                <div>
                  <h2 className="text-base font-bold text-gray-900 font-display">Notification Preferences</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Tune deadline countdown warnings and campus event notifications.</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div>
                      <p className="text-xs font-bold text-gray-800">Deadline Escalation (24h / 6h / 1h)</p>
                      <p className="text-[11px] text-gray-500">Receive progressive browser reminders when high-weight exams or problem sets approach.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={deadlineAlerts}
                      onChange={(e) => setDeadlineAlerts(e.target.checked)}
                      className="rounded text-[#363FEF] focus:ring-[#363FEF] w-4 h-4 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div>
                      <p className="text-xs font-bold text-gray-800">Campus Events & Recruiter Coffee Chats</p>
                      <p className="text-[11px] text-gray-500">Alert for industry recruiter visits (VC, Quant, Consulting) matching your curriculum tags.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={eventRecommendations}
                      onChange={(e) => setEventRecommendations(e.target.checked)}
                      className="rounded text-[#363FEF] focus:ring-[#363FEF] w-4 h-4 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STORAGE & DATA TAB */}
            {activeTab === 'storage' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-6">
                <div>
                  <h2 className="text-base font-bold text-gray-900 font-display">Supabase Live Connection & Cache</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Direct connection to the remote PostgreSQL cluster hosting your academic repository.</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 font-mono text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Supabase Endpoint:</span>
                    <span className="text-gray-900 font-medium">https://xxlbvcwyicddkjbzbtvu.supabase.co</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Active Tables:</span>
                    <span className="text-emerald-700 font-semibold">profiles, deadlines, events, sources, notes, quizzes, user_event_interest, quotes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Affiliation Profile:</span>
                    <span className="text-indigo-700 font-semibold">{currentUni} (in profiles table)</span>
                  </div>
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

                <div className="pt-2 flex items-center justify-between">
                  <button
                    onClick={handleClearLocalCache}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Reset Local Storage Cache</span>
                  </button>
                  {cacheCleared && (
                    <span className="text-xs text-emerald-600 font-medium">Local storage cache cleared!</span>
                  )}
                </div>
              </div>
            )}

            {/* PRIVACY & COMPLIANCE TAB */}
            {activeTab === 'compliance' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-6">
                <div>
                  <h2 className="text-base font-bold text-gray-900 font-display">Data Privacy, FERPA & Compliance</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Strict academic privacy standards for notes, grades, and intellectual property.</p>
                </div>

                <div className="space-y-3 text-xs text-gray-600 leading-relaxed">
                  <p>
                    All ingested notes, slide decks, and formula synthesis materials are encrypted in transit with TLS 1.3 and at rest with AES-256 within your Supabase PostgreSQL cluster.
                  </p>
                  <p>
                    Row Level Security policies prevent unauthorized access across students. Your quiz evaluations, streak records, and RSVP intentions remain strictly confined to your authenticated scholar session.
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                  <span className="text-xs font-bold text-gray-900">Student Data Ownership</span>
                  <p className="text-[11px] text-gray-500">
                    You retain 100% intellectual property ownership of your annotated notes and synthesized study packs. You can export or purge your data at any time.
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
                      Export Full JSON Archive
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
