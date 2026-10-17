import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Capy } from './Capy';
import { CAPY_ALERT, CapyAlert, OPEN_SCREEN, registerAlertsWorker, setCurrentScreen } from '../lib/notify';
import { useJobs } from '../lib/jobs';

type Shown = CapyAlert & { key: number };

/** In-app Capy cards ("Your note is ready!") plus a small "Capy is working on…" pill while jobs run. */
export const CapyNotice: React.FC = () => {
  const { activeScreen, setActiveScreen } = useApp();
  const [items, setItems] = useState<Shown[]>([]);
  const jobs = useJobs();

  useEffect(() => {
    setCurrentScreen(activeScreen);
  }, [activeScreen]);

  useEffect(() => {
    registerAlertsWorker();
    const onAlert = (e: Event) => {
      const a = (e as CustomEvent<CapyAlert>).detail;
      const key = Date.now() + Math.random();
      setItems((x) => [...x.slice(-2), { ...a, key }]);
      window.setTimeout(() => setItems((x) => x.filter((i) => i.key !== key)), 9000);
    };
    const onOpen = (e: Event) => {
      const screen = String((e as CustomEvent).detail || '');
      if (screen) setActiveScreen(screen as never);
    };
    window.addEventListener(CAPY_ALERT, onAlert);
    window.addEventListener(OPEN_SCREEN, onOpen);
    return () => {
      window.removeEventListener(CAPY_ALERT, onAlert);
      window.removeEventListener(OPEN_SCREEN, onOpen);
    };
  }, [setActiveScreen]);

  const close = (key: number) => setItems((x) => x.filter((i) => i.key !== key));
  // Jobs running for a screen the student isn't on
  const away = jobs.filter((j) => !(j.kind === 'note' && activeScreen === 'notes-detail') && !(j.kind === 'quiz' && activeScreen === 'quiz'));

  return (
    <div className="fixed z-[60] left-1/2 -translate-x-1/2 top-[68px] w-[min(420px,calc(100vw-32px))] flex flex-col gap-2 pointer-events-none" aria-live="polite">
      {away.map((j) => (
        <div key={j.id} className="pointer-events-auto self-center flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#C9D1DB] shadow-sm text-xs text-[#0E0E12]">
          <Capy size={22} mood="study" outfit="none" />
          <span>
            Capy is making your {j.label}… keep going, Capy will tell you
          </span>
        </div>
      ))}
      {items.map((a) => (
        <div key={a.key} role="status" className="pointer-events-auto flex items-start gap-3 p-3 rounded-2xl bg-white border border-[#D4A94F] shadow-lg">
          <Capy size={44} mood={a.mood ?? 'sparkle'} react />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#0E0E12]">{a.title}</p>
            {a.body && <p className="text-xs text-[#64748B] mt-0.5">{a.body}</p>}
            {a.screen && a.screen !== activeScreen && (
              <button
                type="button"
                onClick={() => {
                  setActiveScreen(a.screen as never);
                  close(a.key);
                }}
                className="mt-2 px-3 py-1 rounded-lg bg-[#0E0E12] text-white text-xs font-semibold"
              >
                Open
              </button>
            )}
          </div>
          <button type="button" aria-label="Dismiss" onClick={() => close(a.key)} className="text-[#64748B] hover:text-[#0E0E12]">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      ))}
    </div>
  );
};
