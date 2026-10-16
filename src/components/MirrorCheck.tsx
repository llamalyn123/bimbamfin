import React, { useState } from 'react';
import { CapyError } from './CapyStates';
import { invokeEdge } from '../lib/edge';
import { confetti } from '../lib/celebrate';
import { Capy } from './Capy';

type SourceRef = { id: unknown; label: string; name: string };
type Mirror = {
  rating: 'clear' | 'almost' | 'not_yet';
  reflection: string;
  got_right: { point: string; source_ids: string[] }[];
  missing: { hint: string; source_ids: string[] }[];
  misconception: { quote: string; why: string; source_ids: string[] } | null;
};

const RATING = {
  clear: { label: 'Crystal clear 🪞✨', cls: 'bg-emerald-50 border-emerald-300 text-emerald-800', mood: 'sparkle' as const },
  almost: { label: 'Almost there 🪞', cls: 'bg-amber-50 border-amber-300 text-amber-800', mood: 'thinking' as const },
  not_yet: { label: 'Not quite yet 🔍', cls: 'bg-rose-50 border-rose-300 text-rose-800', mood: 'oops' as const }
};

const Cite: React.FC<{ ids: string[]; sources: SourceRef[] }> = ({ ids, sources }) => (
  <>
    {ids.map((l) => (
      <span key={l} title={sources.find((x) => x.label === l)?.name} className="ml-1 px-1.5 py-0.5 rounded bg-slate-100 border border-[#E2E8F0] text-[10px] font-semibold text-[#475569]">
        {l}
      </span>
    ))}
  </>
);

/**
 * Capy mirror check: explain the week in one or two sentences, in your own words.
 * Capy reflects back what you got right (with citations), flags anything wrong, and turns
 * missing ideas into questions. It never writes the "right" sentence for you.
 */
export const MirrorCheck: React.FC<{ noteId: string; language: string; sources: SourceRef[] }> = ({ noteId, language, sources }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<Mirror | null>(null);
  const [tries, setTries] = useState(0);

  const words = text.trim().split(/\s+/).filter(Boolean).length;

  const run = async () => {
    setBusy(true);
    setError(null);
    const { data, error: err } = await invokeEdge<Mirror>('discuss', { note_id: noteId, mode: 'mirror', language, text });
    setBusy(false);
    if (err || !data) return setError(err?.message ?? 'Something went wrong.');
    setRes(data);
    setTries((t) => t + 1);
    if (data.rating === 'clear') confetti();
  };

  const r = res ? RATING[res.rating] : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 items-start">
        <Capy size={36} mood="happy" />
        <p className="text-sm text-[#334155]">
          <span className="block text-[10px] font-bold text-[#8B5E2F]">Capy</span>
          Hold up the mirror: explain this week in <b>one or two sentences</b>, in your own words, without peeking. I'll show you what you really got. No cap.
        </p>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 600))}
        rows={3}
        placeholder="This week is about…"
        aria-label="Your one-sentence explanation of this week"
        className="w-full px-3 py-2 rounded-xl border border-[#C9D1DB] text-sm focus:outline-none focus:border-[#D4A94F]"
      />
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11px] ${words > 80 ? 'text-red-700' : 'text-[#64748B]'}`}>{words} words · aim for 15–60</span>
        <button
          type="button"
          onClick={run}
          disabled={busy || words < 5 || words > 80}
          className="px-5 py-2 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] font-bold text-sm disabled:opacity-50 flex items-center gap-2"
        >
          {busy && <Capy size={22} mood="thinking" searching />}
          {busy ? 'Capy is looking…' : tries ? 'Check again' : 'Mirror check'}
        </button>
      </div>
      {error && <CapyError compact message={error} />}

      {res && r && (
        <div className="flex flex-col gap-3 text-sm">
          <div className={`flex gap-3 items-start p-3 rounded-xl border ${r.cls}`}>
            <Capy size={40} mood={r.mood} react key={tries} />
            <div>
              <p className="font-bold">{r.label}</p>
              <p className="text-[#1E293B]">{res.reflection}</p>
            </div>
          </div>

          {res.got_right.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-emerald-700">What you got right</p>
              <ul className="list-disc pl-5 text-[#334155]">
                {res.got_right.map((g, i) => (
                  <li key={i}>
                    {g.point}
                    <Cite ids={g.source_ids} sources={sources} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {res.misconception && (
            <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/60">
              <p className="text-xs font-semibold text-rose-700">Check this part</p>
              <p className="italic text-[#64748B]">“{res.misconception.quote}”</p>
              <p className="text-[#1E293B]">
                {res.misconception.why}
                <Cite ids={res.misconception.source_ids} sources={sources} />
              </p>
            </div>
          )}

          {res.missing.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#3730A3]">Questions to find what's missing (look in your note)</p>
              <ul className="list-disc pl-5 text-[#334155]">
                {res.missing.map((m, i) => (
                  <li key={i}>
                    {m.hint}
                    <Cite ids={m.source_ids} sources={sources} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {res.rating !== 'clear' && <p className="text-xs text-[#64748B]">Edit your sentence above and check again. Capy never writes it for you.</p>}
        </div>
      )}
    </div>
  );
};
