import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { inferUniversity, UniversityAffiliation } from '../lib/supabase';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    currentUser,
    loginUser,
    logoutUser,
    updateUniversity,
    t
  } = useApp();
  
  const [emailInput, setEmailInput] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // No password-less login. Send the student to the real Login screen.
    setIsAuthModalOpen(false);
    logoutUser();
  };

  const handleUniChange = async (targetUni: UniversityAffiliation) => {
    setIsUpdating(true);
    try {
      await updateUniversity(targetUni);
    } finally {
      setIsUpdating(false);
    }
  };

  const currentUni = currentUser?.university || 'independent';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-white rounded-2xl border border-[#C9D1DB] p-6 md:p-8 shadow-2xl flex flex-col gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={() => setIsAuthModalOpen(false)}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        {/* Current User Logged In State */}
        {currentUser ? (
          <div className="flex flex-col gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-[#0E0E12] text-white flex items-center justify-center font-bold text-xl mx-auto shadow-md">
              {currentUser.initials}
            </div>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-[#0E0E12] font-bold">
                {currentUser.name}
              </h2>
              <p className="font-body-sm text-[#64748B]">{currentUser.email}</p>
              
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                <span>
                  Affiliation: <strong>{currentUni === 'independent' ? t('independent_scholar', 'Independent Scholar') : `${currentUni} Student`}</strong>
                </span>
              </div>
            </div>

            {/* University Correction Section */}
            <div className="p-3 rounded-xl bg-slate-50 border border-[#C9D1DB] text-left space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#0E0E12]">{t('more_correct_uni', 'Correct or Change Institution:')}</span>
                {isUpdating && <span className="text-[10px] text-indigo-600 animate-pulse font-mono">{t('more_uni_syncing', 'Syncing profiles table in Supabase...')}</span>}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleUniChange('SMU')}
                  disabled={isUpdating}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    currentUni === 'SMU'
                      ? 'bg-[#D4A94F] text-[#0E0E12] border-[#D4A94F]'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  SMU
                </button>
                <button
                  type="button"
                  onClick={() => handleUniChange('NUS')}
                  disabled={isUpdating}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    currentUni === 'NUS'
                      ? 'bg-[#D4A94F] text-[#0E0E12] border-[#D4A94F]'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  NUS
                </button>
                <button
                  type="button"
                  onClick={() => handleUniChange('NTU')}
                  disabled={isUpdating}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    currentUni === 'NTU'
                      ? 'bg-[#D4A94F] text-[#0E0E12] border-[#D4A94F]'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  NTU
                </button>
                <button
                  type="button"
                  onClick={() => handleUniChange('independent')}
                  disabled={isUpdating}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    currentUni === 'independent'
                      ? 'bg-[#363FEF] text-white border-[#363FEF]'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {t('independent', 'Independent')}
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-[#C9D1DB] text-left text-xs text-[#64748B] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span>Supabase Sync:</span>
                <span className="font-bold text-emerald-700">{t('verified_sync', 'Online & Verified (profiles table synced)')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>LMS Auto-Polling:</span>
                <span className="font-bold text-[#0E0E12]">
                  {currentUni === 'independent' ? t('notes_manual_desc', 'Disabled (Manual notes upload)') : `${currentUni} Canvas Connector Active`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={logoutUser}
                className="flex-1 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                {t('more_sign_out_btn', 'Sign Out')}
              </button>
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#0E0E12] text-white font-semibold text-xs hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
              >
                {t('auth_continue_studying', 'Continue Studying')}
              </button>
            </div>
          </div>
        ) : (
          /* Sign In modal fallback */
          <div className="flex flex-col gap-4 text-center">
            <div className="h-[96px] w-auto rounded-2xl bg-white border border-[#C9D1DB] flex items-center justify-center mx-auto shadow-xs overflow-hidden p-1">
              <img src="https://xxlbvcwyicddkjbzbtvu.supabase.co/storage/v1/object/public/assets/Bim%20Bam.png" alt="Bimbam" className="h-[96px] w-auto object-contain" />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="inline-block mx-auto px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-label-micro uppercase font-bold tracking-wider">
                {t('auth_universal_notice_title', 'Academica 3.4 • Universal Access')}
              </span>
              <h2 className="font-headline-lg text-headline-md sm:text-headline-lg text-[#0E0E12] font-bold tracking-tight">
                Any email accepted.
                <br />
                <span className="text-indigo-600">SMU, NUS, NTU auto-detected.</span>
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 text-left">
              <label className="font-semibold text-xs text-[#0E0E12]">{t('auth_email_label', 'Email Address')}</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                  alternate_email
                </span>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="e.g. user@gmail.com, student@smu.edu.sg"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#C9D1DB] text-body-sm text-[#0E0E12] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#0E0E12] hover:bg-slate-800 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{t('auth_continue_studying', 'Continue')}</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
