import React, { useState } from 'react';
import { Capy } from '../components/Capy';
import { Logo } from '../components/Logo';
import { useApp } from '../context/AppContext';
import { supabase, inferUniversity } from '../lib/supabase';
import { SUPPORTED_LANGUAGES } from '../i18n/translations';

export const LoginScreen: React.FC = () => {
  const { loginUser, signupUser, isSyncing, language, setLanguage, t } = useApp();
  
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const previewUni = email.includes('@') ? inferUniversity(email) : null;

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) {
        setErrorMsg(error.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Google authentication error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    if (!trimmedEmail.includes('@') || trimmedEmail.length < 5) {
      setErrorMsg('Please enter a valid email address (e.g. name@domain.com).');
      return;
    }

    setIsSubmitting(true);
    try {
      if (authMode === 'signin') {
        if (!password) {
          setErrorMsg('Please enter your password.');
          setIsSubmitting(false);
          return;
        }
        const res = await loginUser(trimmedEmail, password);
        if (!res.success && res.error) {
          setErrorMsg(res.error);
        }
      } else {
        const trimmedFullName = fullName.trim();
        if (!trimmedFullName) {
          setErrorMsg('Please enter your full name.');
          setIsSubmitting(false);
          return;
        }
        if (!password || password.length < 6) {
          setErrorMsg('Password must be at least 6 characters long.');
          setIsSubmitting(false);
          return;
        }
        const res = await signupUser(trimmedEmail, password, trimmedFullName);
        if (!res.success && res.error) {
          setErrorMsg(res.error);
        } else if (res.warning) {
          setInfoMsg(res.warning);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F4F7FB] flex flex-col items-center justify-center p-4 sm:p-6 md:p-10 lg:p-12 transition-colors duration-200 relative">
      {/* Top right language switcher on login screen */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-1.5 bg-white border border-[#C9D1DB] p-1 rounded-xl shadow-xs">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => setLanguage(lang.code)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              language === lang.code
                ? 'bg-[#363FEF] text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            title={lang.name}
          >
            <span>{lang.flag}</span>
            <span className="hidden sm:inline font-mono text-[11px]">{lang.code.toUpperCase()}</span>
          </button>
        ))}
      </div>

      <div className="w-full max-w-md md:max-w-lg lg:max-w-md mx-auto flex flex-col gap-6 animate-in fade-in duration-300">
        
        {/* Brand Emblem & Welcome Header */}
        <div className="flex flex-col items-center text-center gap-4">
          <Logo size="h-[105px] w-[105px]" />

          <div className="flex flex-col items-center gap-1.5">
            <span className="px-3 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-label-micro text-[11px] font-bold uppercase tracking-wider">
              Academica 3.4 • Open Registration
            </span>
            <h1 className="font-headline-lg text-2xl sm:text-3xl text-[#0E0E12] font-bold tracking-tight mt-1">
              {t('app_title', 'Bimbam')}
            </h1>
            <p className="font-body-sm text-xs sm:text-sm text-[#64748B] max-w-xs sm:max-w-sm mt-0.5 leading-relaxed">
              Editorial workstation for coursework, notes, quizzes, deadlines, and campus events.
            </p>
          </div>
        </div>

        {/* Main Authentication Card */}
        <div className="bg-white rounded-2xl border border-[#C9D1DB] p-6 sm:p-8 shadow-xs flex flex-col gap-5 transition-colors">
          
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 border border-[#C9D1DB]">
            <button
              type="button"
              onClick={() => { setAuthMode('signin'); setErrorMsg(null); }}
              className={`py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                authMode === 'signin'
                  ? 'bg-white text-[#0E0E12] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0E0E12]'
              }`}
            >
              {t('auth_sign_in_title', 'Scholar Sign In')}
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('signup'); setErrorMsg(null); }}
              className={`py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                authMode === 'signup'
                  ? 'bg-white text-[#0E0E12] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0E0E12]'
              }`}
            >
              {t('auth_create_account_title', 'Create Account')}
            </button>
          </div>

          {/* Capy at the door */}
          <div className="flex items-center gap-3 -mb-1">
            <span className="capy-peek inline-flex">
              <Capy key={authMode + (errorMsg ? 'e' : '')} size={52} mood={errorMsg ? 'oops' : 'happy'} wave={!errorMsg} react={!!errorMsg} outfit="none" />
            </span>
            <p className="text-sm text-[#334155]">
              <span className="block text-[10px] font-bold text-[#8B5E2F]">Capy</span>
              {errorMsg
                ? "Hmm, that didn't work. Let's check it together 🔍"
                : authMode === 'signin'
                  ? 'Welcome back! Ready to study? 🍊'
                  : "New here? Hi! I'm Capy, your study buddy 🍊"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2" role="alert">
                <span className="material-symbols-outlined text-[18px] shrink-0">search</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {infoMsg && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0">info</span>
                <span>{infoMsg}</span>
              </div>
            )}

            {/* Full Name field (required for email sign-up, not needed for Google sign-in) */}
            {authMode === 'signup' && (
              <div className="flex flex-col gap-1.5 text-left animate-in fade-in duration-150">
                <label className="text-xs font-semibold text-[#0E0E12]">Full name</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                    badge
                  </span>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    required
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#C9D1DB] text-xs sm:text-sm text-[#0E0E12] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5 text-left">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#0E0E12]">{t('auth_email_label', 'Email Address')}</label>
                {previewUni && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 border border-[#C9D1DB] text-[#0E0E12] font-semibold">
                    {t('auth_detected_badge', 'Detected')}: {previewUni === 'independent' ? t('independent', 'Independent') : previewUni}
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                  alternate_email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. user@gmail.com, student@smu.edu.sg, nus@edu..."
                  required
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#C9D1DB] text-xs sm:text-sm text-[#0E0E12] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                />
              </div>
              <span className="text-[10px] text-[#64748B]">
                Any email domain is accepted. SMU, NUS, & NTU emails unlock institutional LMS sync.
              </span>
            </div>

            <div className="flex flex-col gap-1.5 text-left">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#0E0E12]">
                  {t('auth_password_label', 'Password')}
                </label>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                  lock
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={authMode === 'signup' ? 'Min 6 characters' : 'Enter your password'}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#C9D1DB] text-xs sm:text-sm text-[#0E0E12] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isSyncing}
              className="w-full mt-1 py-2.5 rounded-xl bg-[#0E0E12] hover:bg-slate-800 text-white font-semibold text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>{t('auth_verifying', 'Verifying & Setting Profile...')}</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">
                    {authMode === 'signin' ? 'login' : 'person_add'}
                  </span>
                  <span>{authMode === 'signin' ? t('auth_sign_in_btn', 'Sign In to Workspace') : t('auth_create_btn', 'Create Account & Auto-detect Affiliation')}</span>
                </>
              )}
            </button>

            {/* Google OAuth Sign-In Option */}
            <div className="relative flex items-center justify-center my-0.5">
              <div className="border-t border-[#C9D1DB] w-full"></div>
              <span className="bg-white px-2 text-[10px] text-[#64748B] uppercase tracking-wider font-semibold absolute">or</span>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting || isSyncing}
              className="w-full py-2.5 rounded-xl border border-[#C9D1DB] hover:bg-slate-50 text-[#0E0E12] font-semibold text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.28-2.1 3.66-5.2 3.66-9.12z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.13C3.25 21.3 7.31 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.57H1.27C.46 8.2 0 10.04 0 12s.46 3.8 1.27 5.43l4.01-3.14z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.57l4.01 3.14c.95-2.83 3.6-4.96 6.72-4.96z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          </form>

          {/* Institutional Compliance Notice */}
          <div className="p-3 rounded-xl bg-slate-50 border border-[#C9D1DB] text-left flex flex-col gap-1 text-[11px]">
            <div className="flex items-center gap-1.5 text-[#0E0E12] font-semibold">
              <span className="material-symbols-outlined text-emerald-600 text-[16px]">verified_user</span>
              <span>{t('auth_universal_notice_title', 'Universal Academic Access')}</span>
            </div>
            <p className="text-[#64748B] leading-relaxed">
              {t('auth_universal_notice_desc', 'Open to both affiliated university students (SMU, NUS, NTU) and independent scholars worldwide.')}
            </p>
          </div>

        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-[#64748B]">
          Bimbam • Row Level Security Enabled
        </div>
      </div>
    </div>
  );
};
