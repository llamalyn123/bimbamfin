import { useSyncExternalStore } from 'react';

/**
 * Capy alerts: a sound, an in-app Capy card, and (when the student has switched tab or app)
 * a system notification plus a flashing tab title. Nothing here sends data anywhere.
 */
export type Tone = 'bubble' | 'marimba' | 'squeak' | 'chime';
export const TONES: { id: Tone; label: string }[] = [
  { id: 'bubble', label: 'Bubble pop' },
  { id: 'marimba', label: 'Marimba' },
  { id: 'squeak', label: 'Capy squeak' },
  { id: 'chime', label: 'Chime' }
];
type Settings = { sound: boolean; capySounds: boolean; tone: Tone };
const SKEY = 'bimbam_sound_settings';
const listeners = new Set<() => void>();
let settings: Settings = (() => {
  try {
    return { sound: true, capySounds: false, tone: 'bubble' as Tone, ...JSON.parse(localStorage.getItem(SKEY) || '{}') };
  } catch {
    return { sound: true, capySounds: false, tone: 'bubble' as Tone };
  }
})();
export const getSoundSettings = () => settings;
export const setSoundSettings = (patch: Partial<Settings>) => {
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(SKEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
};
const sub = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useSoundSettings = () => useSyncExternalStore(sub, getSoundSettings, getSoundSettings);

// ---------- sounds (made in the browser, no audio files) ----------
let ctx: AudioContext | null = null;
const audio = () => {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
};
// Browsers only allow sound after the student has tapped something once
if (typeof window !== 'undefined') {
  const unlock = () => {
    audio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

export type SoundKind = 'ready' | 'focus-done' | 'break-done' | 'capy' | 'oops';
/** Which notes to play (Hz, start time) for each moment; the chosen tone decides how they sound. */
const MELODY: Record<Exclude<SoundKind, 'capy'>, [number, number][]> = {
  ready: [[523, 0], [784, 0.14]],
  'focus-done': [[523, 0], [659, 0.14], [784, 0.28], [1047, 0.42]],
  'break-done': [[784, 0], [659, 0.16], [784, 0.32]],
  oops: [[440, 0], [349, 0.18]]
};

const note = (a: AudioContext, t: number, f: number, tone: Tone | 'boop') => {
  const o = a.createOscillator();
  const g = a.createGain();
  g.connect(a.destination);
  o.connect(g);
  const env = (peak: number, len: number) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.start(t);
    o.stop(t + len + 0.05);
  };
  if (tone === 'bubble') {
    // a quick rising "bloop", like a water drop
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.5, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.4, t + 0.09);
    env(0.18, 0.14);
  } else if (tone === 'marimba') {
    // warm wooden knock: a short note plus a fast-fading overtone
    o.type = 'sine';
    o.frequency.value = f;
    env(0.2, 0.35);
    const o2 = a.createOscillator();
    const g2 = a.createGain();
    o2.frequency.value = f * 4;
    g2.gain.setValueAtTime(0.06, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o2.connect(g2).connect(a.destination);
    o2.start(t);
    o2.stop(t + 0.08);
  } else if (tone === 'squeak') {
    // a little up-and-down squeak
    o.type = 'triangle';
    o.frequency.setValueAtTime(f * 1.2, t);
    o.frequency.exponentialRampToValueAtTime(f * 2, t + 0.06);
    o.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.12);
    env(0.12, 0.13);
  } else if (tone === 'chime') {
    o.type = 'sine';
    o.frequency.value = f;
    env(0.14, 0.6);
  } else {
    // Capy movement boop
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.12);
    env(0.06, 0.12);
  }
};

let lastCapy = 0;
export const playSound = (kind: SoundKind, tone?: Tone) => {
  const s = settings;
  if (kind === 'capy') {
    if (!s.capySounds || Date.now() - lastCapy < 1500) return;
    lastCapy = Date.now();
  } else if (!s.sound && !tone) return;
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + 0.01;
  if (kind === 'capy') return note(a, t0, 620, 'boop');
  const use = tone ?? s.tone;
  const gap = use === 'chime' ? 1.6 : 1;
  for (const [f, at] of MELODY[kind]) note(a, t0 + at * gap, f, use);
};

// ---------- where the student is ----------
let screen = 'home';
export const setCurrentScreen = (s: string) => (screen = s);
export const currentScreen = () => screen;
export const isAway = () => typeof document !== 'undefined' && document.hidden;

// ---------- system notifications ----------
export const alertsSupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const alertsPermission = (): NotificationPermission | 'unsupported' => (alertsSupported() ? Notification.permission : 'unsupported');
export const requestAlerts = async () => {
  if (!alertsSupported()) return 'unsupported' as const;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
};

let swReg: ServiceWorkerRegistration | null = null;
export const registerAlertsWorker = () => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker
    .register('/sw.js')
    .then((r) => (swReg = r))
    .catch(() => {
      /* alerts fall back to in-page notifications */
    });
  // Tapping a notification brings the student to the right screen
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'bimbam-open' && e.data.screen) window.dispatchEvent(new CustomEvent(OPEN_SCREEN, { detail: e.data.screen }));
  });
};
export const OPEN_SCREEN = 'bimbam:open-screen';

let flashTimer: number | null = null;
const flashTitle = (text: string) => {
  if (flashTimer) return;
  const base = () => document.title.replace(/^🐹 .*? · /, '');
  let on = false;
  flashTimer = window.setInterval(() => {
    on = !on;
    const b = base();
    document.title = on ? `🐹 ${text} · ${b}` : b;
  }, 1000);
  const stop = () => {
    if (document.hidden) return;
    if (flashTimer) window.clearInterval(flashTimer);
    flashTimer = null;
    document.title = base();
    document.removeEventListener('visibilitychange', stop);
  };
  document.addEventListener('visibilitychange', stop);
};

// ---------- the one call everything uses ----------
export type CapyAlert = {
  title: string;
  body?: string;
  /** screen to open when tapped */
  screen?: string;
  sound?: SoundKind;
  mood?: 'happy' | 'sparkle' | 'oops' | 'nap' | 'study';
  /** show the in-app card even if the student is on that screen */
  always?: boolean;
};
export const CAPY_ALERT = 'bimbam:capy-alert';

export const capyAlert = (a: CapyAlert) => {
  playSound(a.sound ?? 'ready');
  const hidden = isAway();
  if (a.always || hidden || (a.screen && a.screen !== screen)) {
    window.dispatchEvent(new CustomEvent<CapyAlert>(CAPY_ALERT, { detail: a }));
  }
  if (!hidden) return;
  flashTitle(a.title);
  if (alertsPermission() !== 'granted') return;
  const opts: NotificationOptions = { body: a.body, icon: '/favicon.png', badge: '/favicon.png', tag: `bimbam-${a.screen ?? 'note'}`, data: { screen: a.screen } };
  if (swReg) {
    void swReg.showNotification(`Capy: ${a.title}`, opts).catch(() => undefined);
    return;
  }
  try {
    const n = new Notification(`Capy: ${a.title}`, opts);
    n.onclick = () => {
      window.focus();
      if (a.screen) window.dispatchEvent(new CustomEvent(OPEN_SCREEN, { detail: a.screen }));
      n.close();
    };
  } catch {
    /* some phones only allow notifications from an installed app */
  }
};
