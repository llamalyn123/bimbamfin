import React, { useState } from 'react';
import { TONES, alertsPermission, capyAlert, playSound, requestAlerts, setSoundSettings, useSoundSettings } from '../lib/notify';

const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string; hint: string }> = ({ on, onChange, label, hint }) => (
  <label className="flex items-start justify-between gap-4 py-2 cursor-pointer">
    <span>
      <span className="block text-sm font-semibold text-gray-900">{label}</span>
      <span className="block text-xs text-gray-500">{hint}</span>
    </span>
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`shrink-0 mt-0.5 w-10 h-6 rounded-full transition-colors ${on ? 'bg-[#363FEF]' : 'bg-gray-300'}`}
    >
      <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </button>
  </label>
);

/** Settings: Capy's sounds and "tell me when I'm away" alerts. */
export const SoundSettings: React.FC = () => {
  const s = useSoundSettings();
  const [perm, setPerm] = useState(alertsPermission());
  const ios = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
  const installed = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-2">
      <div>
        <h2 className="text-base font-bold text-gray-900 font-display">Sounds & Capy alerts</h2>
        <p className="text-xs text-gray-500 mt-0.5">Capy tells you when a note or quiz is ready, or your focus time is up, even if you moved to another screen, tab or app.</p>
      </div>
      <Toggle
        on={s.sound}
        onChange={(v) => {
          setSoundSettings({ sound: v });
          if (v) playSound('ready');
        }}
        label="Alert sound"
        hint="A short chime when something is ready or a timer ends."
      />
      {s.sound && (
        <div className="pb-2">
          <span className="block text-xs font-semibold text-gray-700 mb-1.5">Alert tone (tap to hear it)</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Alert tone">
            {TONES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={s.tone === t.id}
                onClick={() => {
                  setSoundSettings({ tone: t.id });
                  playSound('ready', t.id);
                }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${s.tone === t.id ? 'bg-[#363FEF] text-white border-[#363FEF]' : 'bg-white text-gray-800 border-gray-300 hover:border-[#363FEF]'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <Toggle
        on={s.capySounds}
        onChange={(v) => {
          setSoundSettings({ capySounds: v });
          if (v) playSound('capy');
        }}
        label="Capy movement sounds"
        hint="A soft boop when Capy hops, cheers or reacts."
      />
      <div className="flex items-start justify-between gap-4 py-2">
        <span>
          <span className="block text-sm font-semibold text-gray-900">Alerts when I'm away</span>
          <span className="block text-xs text-gray-500">
            {perm === 'granted'
              ? 'On. Capy will pop up on your screen when you are in another tab or app.'
              : perm === 'denied'
                ? 'Blocked in your browser settings. Allow notifications for this site to turn them on.'
                : perm === 'unsupported'
                  ? ios && !installed
                    ? 'On iPhone, add Bimbam to your Home Screen (Share → Add to Home Screen) to get alerts. Inside the app you still get Capy cards and sounds.'
                    : 'This browser does not support alerts. Inside the app you still get Capy cards and sounds.'
                  : 'Your browser will ask once. Nothing is sent to us; alerts come from this page only.'}
          </span>
        </span>
        {perm === 'default' && (
          <button type="button" onClick={async () => setPerm(await requestAlerts())} className="shrink-0 px-3 py-1.5 rounded-lg bg-[#363FEF] text-white text-xs font-semibold">
            Turn on
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => capyAlert({ title: 'Hi! This is how Capy tells you', body: 'Your notes, quizzes and focus timer alerts look like this.', always: true })}
        className="text-xs text-[#363FEF] underline"
      >
        Try a test alert
      </button>
    </div>
  );
};
