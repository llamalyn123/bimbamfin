import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Capy } from './Capy';
import { FriendIcon } from './CapyFriends';
import { openFocus } from './FocusTimer';
import { confetti } from '../lib/celebrate';
import {
  FRIENDS,
  OUTFITS,
  Outfit,
  requestDiscussMode,
  setWorn,
  takeNewUnlocks,
  unlockedFriends,
  unlockedOutfits,
  useCapyStats,
  useWornOutfit,
  yuzus
} from '../lib/capyProgress';

type Action = { kind: 'focus'; task: string } | { kind: 'note'; course: string; week: number; mirror?: boolean } | { kind: 'screen'; screen: 'notes' | 'quiz' };
type Suggestion = { title: string; why: string; cta: string; action: Action };

const isDone = (st: string) => ['completed', 'cleared', 'done', 'cancelled'].includes(String(st).toLowerCase());
const hoursUntil = (iso: string) => (new Date(iso).getTime() - Date.now()) / 36e5;
const rel = (iso: string) => {
  const h = hoursUntil(iso);
  if (h < 0) return h > -24 ? `${Math.round(-h)}h ago` : `${Math.round(-h / 24)} days ago`;
  return h < 24 ? `in ${Math.max(1, Math.round(h))}h` : `in ${Math.round(h / 24)} days`;
};

/**
 * Capy's corner on Home: Capy (in the outfit you picked) with the friends you've earned,
 * plus "What's next?", the focus timer and Capy's wardrobe.
 * "What's next?" is simple rules, not AI: same inputs, same answer, nothing sent anywhere.
 */
export const CapyCorner: React.FC<{ greeting?: React.ReactNode; date?: React.ReactNode; quote?: React.ReactNode }> = ({ greeting, date, quote }) => {
  const { deadlines, sources, notes, currentUser, setActiveScreen, setSelectedCourse, setSelectedWeek, showToast } = useApp();
  const worn = useWornOutfit();
  const [showNext, setShowNext] = useState(false);
  const [nextIdx, setNextIdx] = useState(0);
  const [showWardrobe, setShowWardrobe] = useState(false);

  const stats = useCapyStats(
    currentUser?.id,
    notes.length,
    [
      ...notes.map((n) => n.created_at),
      ...sources.map((s) => s.created_at),
      ...deadlines.filter((d) => isDone(d.status)).map((d) => (d as { last_updated?: string }).last_updated)
    ]
  );
  const outfits = unlockedOutfits(stats);
  const friends = unlockedFriends(stats);

  // Celebrate new unlocks once (and put on a new outfit if Capy isn't wearing one)
  const unlockKey = [...outfits, ...friends].join(',');
  useEffect(() => {
    if (!currentUser?.id || !stats.loaded) return;
    const fresh = takeNewUnlocks([...outfits, ...friends]);
    if (!fresh.length) return;
    const names = fresh.map((id) => OUTFITS.find((o) => o.id === id)?.name ?? FRIENDS.find((f) => f.id === id)?.name ?? id);
    showToast(`Capy unlocked: ${names.join(', ')} 🎉`);
    confetti();
    const newOutfit = fresh.find((id) => OUTFITS.some((o) => o.id === id)) as Outfit | undefined;
    if (newOutfit && worn === 'none') setWorn(newOutfit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockKey, currentUser?.id, stats.loaded]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const out: Suggestion[] = [];
    const open = deadlines.filter((d) => !isDone(d.status)).sort((a, b) => +new Date(a.due_date) - +new Date(b.due_date));
    for (const d of open.filter((d) => hoursUntil(d.due_date) < 0).slice(0, 2))
      out.push({ title: `Catch up: ${d.title}`, why: `It was due ${rel(d.due_date)}. Finish it or tick it off so it stops nagging you.`, cta: 'Focus on it (25 min)', action: { kind: 'focus', task: d.title } });
    for (const d of open.filter((d) => hoursUntil(d.due_date) >= 0 && hoursUntil(d.due_date) <= 48).slice(0, 2))
      out.push({ title: `Finish ${d.title}`, why: `Due ${rel(d.due_date)}${d.course ? ` (${d.course})` : ''}. One focus session now beats a panic later.`, cta: 'Focus on it (25 min)', action: { kind: 'focus', task: d.title } });

    const noted = new Set(notes.map((n) => `${n.course}|${Number(n.week)}`));
    const missing = Array.from(new Set(sources.map((s) => `${s.course}|${Number(s.week)}`)))
      .filter((k) => !noted.has(k) && !k.endsWith('|NaN'))
      .map((k) => ({ course: k.split('|')[0], week: Number(k.split('|')[1]) }))
      .sort((a, b) => b.week - a.week);
    for (const m of missing.slice(0, 2))
      out.push({ title: `Make your ${m.course} Week ${m.week} note`, why: 'You uploaded the material but there is no note yet. It takes about a minute.', cta: 'Open Week ' + m.week, action: { kind: 'note', ...m } });

    const latest = [...notes].sort((a, b) => +new Date(b.created_at ?? 0) - +new Date(a.created_at ?? 0))[0];
    if (latest)
      out.push({ title: `Mirror check: ${latest.course} Week ${latest.week}`, why: 'Explain the week in one sentence. Capy shows what you really got, and what you missed.', cta: 'Try the mirror check', action: { kind: 'note', course: latest.course, week: Number(latest.week), mirror: true } });

    for (const d of open.filter((d) => hoursUntil(d.due_date) > 48 && hoursUntil(d.due_date) <= 24 * 7).slice(0, 1))
      out.push({ title: `Get ahead on ${d.title}`, why: `Due ${rel(d.due_date)}. Starting early is the chill way.`, cta: 'Focus on it (25 min)', action: { kind: 'focus', task: d.title } });
    if (latest)
      out.push({ title: `Quiz yourself on ${latest.course}`, why: 'A 5-minute quiz shows what stuck. 80%+ might bring Capy a new friend 🐥', cta: 'Go to Quiz', action: { kind: 'screen', screen: 'quiz' } });
    if (!out.length)
      out.push({ title: "Upload this week's slides", why: 'Start with one file. Capy turns it into a note you can check and quiz yourself on.', cta: 'Go to Notes', action: { kind: 'screen', screen: 'notes' } });
    return out;
  }, [deadlines, sources, notes]);

  const s = suggestions[nextIdx % suggestions.length];
  const go = (a: Action) => {
    setShowNext(false);
    if (a.kind === 'focus') return openFocus(a.task);
    if (a.kind === 'screen') return setActiveScreen(a.screen);
    setSelectedCourse(a.course);
    setSelectedWeek(a.week);
    if (a.mirror) requestDiscussMode('mirror');
    setActiveScreen('notes-detail');
  };

  return (
    <section className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs p-5 sm:p-6 flex flex-col gap-4" aria-label="Today with Capy">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="relative flex items-end shrink-0 capy-peek">
          <Capy size={greeting ? 72 : 64} mood={stats.streak >= 3 ? 'sparkle' : 'happy'} wave />
          {friends.length > 0 && (
            <div className="flex items-end -ml-1 gap-0.5" aria-label={`Capy's friends: ${friends.join(', ')}`}>
              {friends.map((f) => (
                <FriendIcon key={f} id={f} size={24} />
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            {greeting ?? <p className="text-sm font-bold text-[#0E0E12]">Capy's corner</p>}
            {date}
          </div>
          <p className="text-xs text-[#64748B]">
            🔥 {stats.streak}-day streak · 🍊 × {yuzus()} · {friends.length} friend{friends.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>
      {quote}

      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => { setNextIdx(0); setShowNext((v) => !v); }} className="px-2 py-2 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] text-xs font-bold">
          What's next?
        </button>
        <button type="button" onClick={() => openFocus()} className="px-2 py-2 rounded-xl border border-[#C9D1DB] text-xs font-semibold hover:border-[#D4A94F]">
          ⏳ Focus
        </button>
        <button type="button" onClick={() => setShowWardrobe(true)} className="px-2 py-2 rounded-xl border border-[#C9D1DB] text-xs font-semibold hover:border-[#D4A94F]">
          👕 Wardrobe
        </button>
      </div>

      {showNext && s && (
        <div className="p-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] flex gap-3" role="status">
          <Capy size={40} mood="thinking" react key={nextIdx} />
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <p className="text-sm font-bold text-[#0E0E12]">{s.title}</p>
            <p className="text-xs text-[#475569]">{s.why}</p>
            <div className="flex flex-wrap gap-2 mt-1">
              <button type="button" onClick={() => go(s.action)} className="px-3 py-1.5 rounded-lg bg-[#0E0E12] text-white text-xs font-semibold">
                {s.cta}
              </button>
              {suggestions.length > 1 && (
                <button type="button" onClick={() => setNextIdx((i) => i + 1)} className="px-3 py-1.5 rounded-lg border border-[#C9D1DB] text-xs font-semibold">
                  Something else
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showWardrobe && (
        <div className="fixed inset-0 z-[57] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => setShowWardrobe(false)}>
          <div role="dialog" aria-label="Capy's wardrobe" className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-4 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8B5E2F]">Capy's wardrobe</span>
              <button type="button" onClick={() => setShowWardrobe(false)} aria-label="Close" className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <p className="text-xs text-[#64748B]">Outfits are earned by studying, never bought. Tap one to put it on.</p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWorn('none')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1 ${worn === 'none' ? 'border-[#D4A94F] bg-[#FFFBEB]' : 'border-[#E2E8F0]'}`}
              >
                <Capy size={56} outfit="none" blink={false} />
                <span className="text-xs font-semibold">Classic yuzu 🍊</span>
                <span className="text-[10px] text-[#64748B]">{worn === 'none' ? 'Wearing' : 'Always yours'}</span>
              </button>
              {OUTFITS.map((o) => {
                const [have, need] = o.goal(stats);
                const ok = have >= need;
                return (
                  <button
                    key={o.id}
                    type="button"
                    disabled={!ok}
                    onClick={() => setWorn(o.id)}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 disabled:cursor-not-allowed ${worn === o.id ? 'border-[#D4A94F] bg-[#FFFBEB]' : 'border-[#E2E8F0]'}`}
                  >
                    <span className={ok ? '' : 'opacity-35 grayscale'}>
                      <Capy size={56} outfit={o.id} blink={false} />
                    </span>
                    <span className="text-xs font-semibold">
                      {o.name} {o.emoji}
                    </span>
                    {ok ? (
                      <span className="text-[10px] text-[#64748B]">{worn === o.id ? 'Wearing' : 'Tap to wear'}</span>
                    ) : (
                      <span className="w-full flex flex-col gap-0.5">
                        <span className="text-[10px] text-[#64748B]">{o.how}</span>
                        <span className="h-1 rounded-full bg-slate-100 overflow-hidden">
                          <span className="block h-full bg-[#D4A94F]" style={{ width: `${Math.min(100, (have / need) * 100)}%` }} />
                        </span>
                        <span className="text-[10px] text-[#64748B]">
                          {Math.min(have, need)} / {need}
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div>
              <p className="text-sm font-bold text-[#0E0E12]">Capy's friends</p>
              <p className="text-xs text-[#64748B] mb-2">Score 80% or more on a quiz and a new friend comes to sit with Capy. ({stats.goodQuizzes} so far)</p>
              <div className="grid grid-cols-4 gap-2">
                {FRIENDS.map((f) => {
                  const ok = friends.includes(f.id);
                  return (
                    <div key={f.id} className="flex flex-col items-center gap-1 p-2 rounded-xl border border-[#E2E8F0]">
                      <FriendIcon id={f.id} size={34} locked={!ok} />
                      <span className="text-[10px] font-semibold text-center">{ok ? f.name : `${f.need} great quiz${f.need === 1 ? '' : 'zes'}`}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
