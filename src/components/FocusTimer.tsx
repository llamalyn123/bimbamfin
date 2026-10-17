import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Capy } from './Capy';
import { confetti } from '../lib/celebrate';
import { dayKey, focusLog, logFocusSession, yuzus } from '../lib/capyProgress';
import { capyAlert } from '../lib/notify';

/**
 * Capy Focus timer: focus with Capy studying under a lamp, then a short break while Capy naps.
 * 4 sessions in a day earn a yuzu. Keeps running while you move around the app (mounted in App),
 * and survives a page refresh (end time is stored, not a counter).
 */
const OPEN_EVENT = 'bimbam:focus-open';
const KEY = 'bimbam_focus_state';

export const openFocus = (task?: string) => window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: task ?? '' }));

type Phase = 'focus' | 'break';
type State = {
  phase: Phase;
  running: boolean;
  endsAt: number; // when running
  left: number; // ms left when paused
  focusMin: number;
  breakMin: number;
  task: string;
};

const PRESETS = [
  { focus: 15, brk: 3, label: '15 / 3' },
  { focus: 25, brk: 5, label: '25 / 5' },
  { focus: 50, brk: 10, label: '50 / 10' }
];

const fresh = (focusMin = 25, breakMin = 5, task = ''): State => ({
  phase: 'focus',
  running: false,
  endsAt: 0,
  left: focusMin * 60_000,
  focusMin,
  breakMin,
  task
});

const load = (): State | null => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    return s && typeof s.left === 'number' ? s : null;
  } catch {
    return null;
  }
};
const save = (s: State | null) => {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* fine */
  }
};

const mmss = (ms: number) => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

const Lamp: React.FC = () => (
  <svg width="46" height="64" viewBox="0 0 46 64" aria-hidden="true">
    <path d="M14 22 L40 64 H-2 Z" fill="#FDE68A" opacity="0.35" />
    <path d="M6 6 h18 l5 14 h-28z" fill="#D4A94F" stroke="#92400E" strokeWidth="1" />
    <path d="M15 20 v38" stroke="#64748B" strokeWidth="2.5" />
    <rect x="5" y="57" width="20" height="5" rx="2" fill="#64748B" />
  </svg>
);

export const FocusTimer: React.FC = () => {
  const [s, setS] = useState<State | null>(load);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [msg, setMsg] = useState<string | null>(null);
  const finishing = useRef(false);

  const update = useCallback((next: State | null) => {
    save(next);
    setS(next);
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const task = String((e as CustomEvent).detail || '');
      setOpen(true);
      setMsg(null);
      setS((cur) => {
        if (cur) {
          if (task && !cur.running) {
            const n = { ...cur, task };
            save(n);
            return n;
          }
          return cur;
        }
        const n = fresh(25, 5, task);
        save(n);
        return n;
      });
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  // Tick while running
  useEffect(() => {
    if (!s?.running) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [s?.running]);

  // Background tabs tick slowly: check the clock as soon as the student comes back, and at the exact end time
  useEffect(() => {
    if (!s?.running) return;
    const onVis = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVis);
    const t = window.setTimeout(onVis, Math.max(0, s.endsAt - Date.now()) + 50);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.clearTimeout(t);
    };
  }, [s?.running, s?.endsAt]);

  const left = s ? (s.running ? s.endsAt - now : s.left) : 0;

  // Phase finished
  useEffect(() => {
    if (!s?.running || left > 0 || finishing.current) return;
    finishing.current = true;
    if (s.phase === 'focus') {
      const earned = logFocusSession();
      const today = focusLog().filter((t) => dayKey(t) === dayKey(Date.now())).length;
      confetti();
      setMsg(earned ? `Session ${today} done. 4 today, Capy earned a yuzu 🍊 Take a longer break.` : `Session ${today} done 🎉 Capy is taking a nap. You should rest too.`);
      const brk = (earned ? 3 : 1) * s.breakMin * 60_000;
      update({ ...s, phase: 'break', running: true, endsAt: Date.now() + brk, left: brk });
      setOpen(true);
      // Sound + (if they're in another tab/app) a system notification
      capyAlert({ title: 'Focus time is up! 🎉', body: `Take a ${Math.round(brk / 60_000)}-minute break. Capy is napping too.`, sound: 'focus-done', mood: 'nap' });
    } else {
      setMsg('Break over. Capy is awake and ready when you are 📚');
      update({ ...s, phase: 'focus', running: false, endsAt: 0, left: s.focusMin * 60_000 });
      setOpen(true);
      capyAlert({ title: 'Break over', body: 'Capy is awake. Ready for another focus round?', sound: 'break-done', mood: 'happy' });
    }
    window.setTimeout(() => (finishing.current = false), 800);
  }, [left, s, update]);

  // Tab title shows the timer
  useEffect(() => {
    const base = document.title.replace(/^[⏳💤] \d\d:\d\d · /, '');
    if (s?.running) document.title = `${s.phase === 'focus' ? '⏳' : '💤'} ${mmss(left)} · ${base}`;
    else document.title = base;
  }, [left, s?.running, s?.phase]);

  if (!s) return null;

  const start = () => update({ ...s, running: true, endsAt: Date.now() + s.left });
  const pause = () => update({ ...s, running: false, left: Math.max(0, s.endsAt - Date.now()) });
  const reset = () => {
    setMsg(null);
    update(fresh(s.focusMin, s.breakMin, s.task));
  };
  const stop = () => {
    update(null);
    setOpen(false);
    setMsg(null);
  };
  const skipBreak = () => update({ ...s, phase: 'focus', running: false, endsAt: 0, left: s.focusMin * 60_000 });
  const preset = (f: number, b: number) => update(fresh(f, b, s.task));

  const total = (s.phase === 'focus' ? s.focusMin : s.breakMin) * 60_000;
  const pct = Math.min(100, Math.max(0, 100 - (left / total) * 100));
  const todayCount = focusLog().filter((t) => dayKey(t) === dayKey(Date.now())).length;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-24 md:bottom-6 z-[55] flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full bg-[#0E0E12] text-white shadow-lg"
        aria-label="Open focus timer"
      >
        <Capy size={30} mood={s.phase === 'focus' ? 'study' : 'nap'} outfit="none" />
        <span className="font-mono text-sm font-bold tabular-nums">{mmss(left)}</span>
        <span className="text-[11px] text-white/70">{s.phase === 'focus' ? (s.running ? 'focus' : 'paused') : 'break'}</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[58] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-label="Focus with Capy"
        className="w-full max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#8B5E2F]">Focus with Capy</span>
          <div className="flex gap-1">
            <button type="button" onClick={() => setOpen(false)} aria-label="Minimise" title="Keep running in the corner" className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">remove</span>
            </button>
            <button type="button" onClick={stop} aria-label="Stop and close" title="Stop" className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        <div className={`relative flex items-end justify-center gap-0 rounded-xl py-3 ${s.phase === 'focus' ? 'bg-[#FFFBEB]' : 'bg-[#EEF2FF]'}`}>
          {s.phase === 'focus' && <Lamp />}
          <Capy size={110} mood={s.phase === 'focus' ? 'study' : 'nap'} outfit={s.phase === 'focus' ? 'auto' : 'none'} />
        </div>

        <div className="text-center">
          <p className="font-mono text-5xl font-bold tabular-nums text-[#0E0E12]" aria-live="off">{mmss(left)}</p>
          <p className="text-xs text-[#64748B] mt-1">
            {s.phase === 'focus' ? (s.running ? 'Capy is studying with you. Phone face down 📵' : 'Ready when you are') : 'Break: Capy is napping. Stretch, drink water 💧'}
          </p>
          <div className="h-1.5 rounded-full bg-slate-100 mt-3 overflow-hidden">
            <div className={`h-full ${s.phase === 'focus' ? 'bg-[#D4A94F]' : 'bg-[#818CF8]'} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        {msg && <p className="text-sm text-center font-semibold text-[#0E0E12]" role="status">{msg}</p>}

        <input
          value={s.task}
          onChange={(e) => update({ ...s, task: e.target.value.slice(0, 80) })}
          placeholder="What are you working on? (optional)"
          aria-label="What are you working on"
          className="px-3 py-2 rounded-lg border border-[#C9D1DB] text-sm"
        />

        {!s.running && s.phase === 'focus' && (
          <div className="flex justify-center gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => preset(p.focus, p.brk)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${s.focusMin === p.focus ? 'bg-[#0E0E12] text-white border-[#0E0E12]' : 'border-[#C9D1DB] text-[#475569]'}`}
              >
                {p.label} min
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-center gap-2">
          {s.phase === 'break' ? (
            <button type="button" onClick={skipBreak} className="px-4 py-2 rounded-xl border border-[#C9D1DB] text-sm font-semibold">
              Skip break
            </button>
          ) : (
            <button type="button" onClick={reset} className="px-4 py-2 rounded-xl border border-[#C9D1DB] text-sm font-semibold">
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={s.running ? pause : start}
            className="px-6 py-2 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] text-sm font-bold"
          >
            {s.running ? 'Pause' : s.left < (s.phase === 'focus' ? s.focusMin : s.breakMin) * 60_000 ? 'Resume' : 'Start'}
          </button>
        </div>

        <p className="text-[11px] text-center text-[#64748B]">
          Today: {todayCount} session{todayCount === 1 ? '' : 's'} · {4 - (todayCount % 4)} more for a yuzu · 🍊 × {yuzus()}
        </p>
      </div>
    </div>
  );
};
