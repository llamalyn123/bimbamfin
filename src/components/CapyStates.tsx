import React from 'react';
import { Capy, CapyMood } from './Capy';

/**
 * Friendly Capy versions of the app's error and loading states.
 * The real error message is always still shown, so nothing is hidden from the student.
 */

type Kind = 'busy' | 'limit' | 'offline' | 'auth' | 'input' | 'other';

const kindOf = (code?: string, message = ''): Kind => {
  const c = (code ?? '').toUpperCase();
  const m = message.toLowerCase();
  if (c === 'AI_UNAVAILABLE' || /busy|unavailable|overloaded|try again in a/.test(m)) return 'busy';
  if (c === 'RATE_LIMITED' || /limit/.test(m)) return 'limit';
  if (c === 'NETWORK' || /connection|reach bimbam|offline|network/.test(m)) return 'offline';
  if (c === 'UNAUTHENTICATED' || /sign in/.test(m)) return 'auth';
  if (['BAD_REQUEST', 'TOO_LONG', 'TOO_LARGE', 'SPARSE', 'NO_SOURCES', 'NO_NOTES'].includes(c)) return 'input';
  return 'other';
};

const HEADLINE: Record<Kind, { text: string; mood: CapyMood }> = {
  busy: { text: "Capy's AI brain is busy right now", mood: 'nap' },
  limit: { text: "That's today's limit. Capy needs a rest too", mood: 'nap' },
  offline: { text: "Capy can't reach Bimbam", mood: 'thinking' },
  auth: { text: 'Please sign in again', mood: 'thinking' },
  input: { text: 'Capy needs a little more first', mood: 'thinking' },
  other: { text: 'Hmm, something went wrong', mood: 'oops' }
};

const TIP: Partial<Record<Kind, string>> = {
  busy: 'Give it a minute and try again. Your work is safe.',
  limit: 'Limits keep Bimbam free for everyone. It resets tomorrow.',
  offline: 'Check your Wi-Fi or data, then try again.'
};

export const CapyError: React.FC<{ message: string; code?: string; compact?: boolean; children?: React.ReactNode }> = ({
  message,
  code,
  compact = false,
  children
}) => {
  const k = kindOf(code, message);
  const h = HEADLINE[k];
  return (
    <div role="alert" className={`flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-950 ${compact ? 'p-2.5' : 'p-3.5'}`}>
      <Capy size={compact ? 30 : 42} mood={h.mood} react outfit="none" />
      <div className="min-w-0 flex-1">
        <p className={`font-bold ${compact ? 'text-xs' : 'text-sm'}`}>{h.text}</p>
        <p className={`${compact ? 'text-[11px]' : 'text-xs'} text-amber-900/90`}>{message}</p>
        {TIP[k] && !compact && <p className="text-[11px] text-amber-800/80 mt-0.5">{TIP[k]}</p>}
        {children}
      </div>
    </div>
  );
};

/** Sleepy Capy instead of a spinner. */
export const CapyLoading: React.FC<{ text?: string; size?: number; mood?: CapyMood; className?: string }> = ({
  text = 'Loading…',
  size = 56,
  mood = 'nap',
  className = ''
}) => (
  <div className={`flex flex-col items-center gap-2 text-center ${className}`} role="status" aria-live="polite">
    <Capy size={size} mood={mood} searching={mood === 'thinking'} />
    <span className="text-xs text-[#64748B]">{text}</span>
  </div>
);
