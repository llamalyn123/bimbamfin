import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { supabase } from './supabase';

/**
 * Capy's little reward layer: outfits Capy can wear, animal friends earned from good quiz scores,
 * a study streak, focus-session yuzus. All rewards come from studying, never from paying.
 * Small things (worn outfit, focus log, yuzus) live in this browser; progress itself is read from
 * the student's own rows (RLS keeps them private).
 */

export type Outfit = 'none' | 'headband' | 'gradcap' | 'headphones' | 'sunglasses';
export type Friend = 'duckling' | 'bird' | 'turtle' | 'kitten';

const PROGRESS_EVENT = 'bimbam:capy-progress';
export const bumpCapyProgress = () => window.dispatchEvent(new Event(PROGRESS_EVENT));

const ls = {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode: rewards still work for this visit */
    }
  }
};

/* ---------- worn outfit (tiny store so every <Capy> can wear it) ---------- */
const WORN_KEY = 'bimbam_capy_outfit';
let worn: Outfit = (ls.get(WORN_KEY) as Outfit) || 'none';
const listeners = new Set<() => void>();
export const getWorn = () => worn;
export const setWorn = (o: Outfit) => {
  worn = o;
  ls.set(WORN_KEY, o);
  listeners.forEach((l) => l());
};
export const useWornOutfit = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getWorn,
    getWorn
  );

/* ---------- focus sessions + yuzus ---------- */
const FOCUS_LOG = 'bimbam_focus_log';
const YUZU_KEY = 'bimbam_yuzus';
export const dayKey = (d: Date | string | number) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
export const focusLog = (): string[] => {
  try {
    return JSON.parse(ls.get(FOCUS_LOG) || '[]');
  } catch {
    return [];
  }
};
export const yuzus = () => Number(ls.get(YUZU_KEY) || 0);
/** Log one finished focus session. Returns true when it earned a yuzu (every 4th today). */
export const logFocusSession = (): boolean => {
  const log = [...focusLog(), new Date().toISOString()].slice(-500);
  ls.set(FOCUS_LOG, JSON.stringify(log));
  const today = dayKey(Date.now());
  const n = log.filter((t) => dayKey(t) === today).length;
  const earned = n % 4 === 0;
  if (earned) ls.set(YUZU_KEY, String(yuzus() + 1));
  bumpCapyProgress();
  return earned;
};

/* ---------- unlock rules ---------- */
export type Stats = { notes: number; quizzes: number; goodQuizzes: number; focus: number; streak: number; loaded?: boolean };

export const OUTFITS: { id: Exclude<Outfit, 'none'>; name: string; emoji: string; how: string; goal: (s: Stats) => [number, number] }[] = [
  { id: 'headband', name: 'Study headband', emoji: '🎀', how: 'Finish 1 focus session', goal: (s) => [s.focus, 1] },
  { id: 'gradcap', name: 'Grad cap', emoji: '🎓', how: 'Make 10 notes', goal: (s) => [s.notes, 10] },
  { id: 'headphones', name: 'Headphones', emoji: '🎧', how: 'Finish 5 quizzes', goal: (s) => [s.quizzes, 5] },
  { id: 'sunglasses', name: 'Sunglasses', emoji: '😎', how: 'Study 7 days in a row', goal: (s) => [s.streak, 7] }
];

export const FRIENDS: { id: Friend; name: string; need: number }[] = [
  { id: 'duckling', name: 'Duckling', need: 1 },
  { id: 'bird', name: 'Little bird', need: 2 },
  { id: 'turtle', name: 'Turtle', need: 4 },
  { id: 'kitten', name: 'Kitten', need: 6 }
];

export const unlockedOutfits = (s: Stats) => OUTFITS.filter((o) => { const [a, b] = o.goal(s); return a >= b; }).map((o) => o.id);
export const unlockedFriends = (s: Stats) => FRIENDS.filter((f) => s.goodQuizzes >= f.need).map((f) => f.id);

/** Days in a row with any study activity, counting back from today (or yesterday if today is still empty). */
export const streakFrom = (days: Set<string>) => {
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
};

type QuizRow = { score: number | null; questions: unknown; completed_at: string | null };

/** Live stats for the signed-in student. `extraDates` = other activity timestamps already in memory. */
export function useCapyStats(userId: string | undefined, notesCount: number, extraDates: (string | undefined | null)[]): Stats {
  const [quizRows, setQuizRows] = useState<QuizRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener(PROGRESS_EVENT, on);
    return () => window.removeEventListener(PROGRESS_EVENT, on);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    supabase
      .from('quizzes')
      .select('score, questions, completed_at')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .then(({ data }) => {
        if (!alive) return;
        setQuizRows((data as QuizRow[]) ?? []);
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [userId, tick]);

  const extraKey = extraDates.filter(Boolean).join('|');
  return useMemo(() => {
    const focus = focusLog();
    const days = new Set<string>();
    for (const t of [...extraDates, ...focus, ...quizRows.map((q) => q.completed_at)]) if (t) days.add(dayKey(t));
    const good = quizRows.filter((q) => {
      const total = Array.isArray(q.questions) ? q.questions.length : 0;
      return total > 0 && (q.score ?? 0) / total >= 0.8;
    }).length;
    return { notes: notesCount, quizzes: quizRows.length, goodQuizzes: good, focus: focus.length, streak: streakFrom(days), loaded };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizRows, notesCount, extraKey, tick, loaded]);
}

/** Remembers what was already unlocked so we only celebrate new things once. */
export const takeNewUnlocks = (ids: string[]): string[] => {
  const key = 'bimbam_capy_unlocked';
  let seen: string[] = [];
  try {
    seen = JSON.parse(ls.get(key) || '[]');
  } catch {
    seen = [];
  }
  const fresh = ids.filter((i) => !seen.includes(i));
  if (fresh.length) ls.set(key, JSON.stringify([...seen, ...fresh]));
  return fresh;
};

/* ---------- hand-off: open a note's Discuss panel on a given tab ---------- */
let pendingDiscussMode: 'mirror' | null = null;
export const requestDiscussMode = (m: 'mirror') => (pendingDiscussMode = m);
export const takeDiscussMode = () => {
  const m = pendingDiscussMode;
  pendingDiscussMode = null;
  return m;
};
