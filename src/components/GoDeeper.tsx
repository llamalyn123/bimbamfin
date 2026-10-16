import React, { useState } from 'react';
import { CapyError, CapyLoading } from './CapyStates';
import { invokeEdge } from '../lib/edge';

type Mode = 'simpler' | 'terms' | 'links';
type Term = { term: string; term_en?: string; definition: string; definition_en?: string };
type Link = { url: string; title: string; trusted: boolean };

const TABS: { mode: Mode; label: string; icon: string; note: string }[] = [
  { mode: 'simpler', label: 'Explain simpler', icon: 'lightbulb', note: 'General explanation, not from your sources.' },
  { mode: 'terms', label: 'Key terms', icon: 'translate', note: 'General definitions, not from your sources.' },
  {
    mode: 'links',
    label: 'Outside reading',
    icon: 'travel_explore',
    note: 'Outside pages. They may differ from your lecturer; exams follow your course.'
  }
];

/**
 * Optional extra layer under one concept. Clearly separated and labelled,
 * so the cited master note above stays 100% from the student's own sources.
 */
export const GoDeeper: React.FC<{
  noteId: string;
  conceptId: string;
  language: string;
  subtitles: boolean;
}> = ({ noteId, conceptId, language, subtitles }) => {
  const [open, setOpen] = useState<Mode | null>(null);
  const [loading, setLoading] = useState<Mode | null>(null);
  const [data, setData] = useState<Partial<Record<Mode, any>>>({});
  const [error, setError] = useState<string | null>(null);
  const [openTerm, setOpenTerm] = useState<string | null>(null);

  const load = async (mode: Mode) => {
    if (open === mode) return setOpen(null);
    setOpen(mode);
    setError(null);
    if (data[mode]) return;
    setLoading(mode);
    const { data: res, error: err } = await invokeEdge('explain-concept', {
      note_id: noteId,
      concept_id: conceptId,
      mode,
      language
    });
    setLoading(null);
    if (err) return setError(err.message);
    setData((d) => ({ ...d, [mode]: res }));
  };

  const tab = TABS.find((t) => t.mode === open);
  const res = open ? data[open] : null;

  return (
    <div className="mt-2 pt-3 border-t border-[#E2E8F0] flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Go deeper">
        {TABS.map((t) => (
          <button
            key={t.mode}
            type="button"
            role="tab"
            aria-selected={open === t.mode}
            onClick={() => load(t.mode)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 transition-colors ${
              open === t.mode
                ? 'bg-[#0E0E12] text-white border-[#0E0E12]'
                : 'bg-white text-[#475569] border-[#C9D1DB] hover:border-[#94A3B8]'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {open && (
        <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3 flex flex-col gap-2 text-sm">
          <p className="text-[11px] text-[#64748B] flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">info</span>
            {tab?.note}
          </p>

          {loading === open && <CapyLoading mood="thinking" size={40} text="Capy is looking into it…" />}
          {error && <CapyError compact message={error} />}

          {open === 'simpler' && res && (
            <>
              <p className="text-[#1E293B]">{res.simple}</p>
              {subtitles && res.simple_en && <p className="text-xs text-[#64748B] italic">{res.simple_en}</p>}
              <p className="text-[#334155]">
                <span className="font-semibold">Example: </span>
                {res.example}
              </p>
              {subtitles && res.example_en && <p className="text-xs text-[#64748B] italic">{res.example_en}</p>}
            </>
          )}

          {open === 'terms' && res && (
            <>
              {(res.terms as Term[]).length === 0 && <p className="text-xs text-[#64748B]">No tricky terms here.</p>}
              <div className="flex flex-wrap gap-1.5">
                {(res.terms as Term[]).map((tm) => (
                  <button
                    key={tm.term}
                    type="button"
                    aria-expanded={openTerm === tm.term}
                    onClick={() => setOpenTerm(openTerm === tm.term ? null : tm.term)}
                    className={`px-2 py-0.5 rounded-md text-xs border ${
                      openTerm === tm.term ? 'bg-white border-[#D4A94F] text-[#0E0E12]' : 'bg-white border-[#C9D1DB] text-[#334155]'
                    }`}
                  >
                    {tm.term}
                  </button>
                ))}
              </div>
              {(res.terms as Term[])
                .filter((tm) => tm.term === openTerm)
                .map((tm) => (
                  <div key={tm.term}>
                    <p className="text-[#1E293B]">
                      <span className="font-semibold">{tm.term}</span>
                      {tm.term_en && tm.term_en !== tm.term ? ` (${tm.term_en})` : ''}: {tm.definition}
                    </p>
                    {subtitles && tm.definition_en && <p className="text-xs text-[#64748B] italic">{tm.definition_en}</p>}
                  </div>
                ))}
            </>
          )}

          {open === 'links' && res && (
            <>
              {res.summary && <p className="text-[#1E293B]">{res.summary}</p>}
              {res.differs && (
                <p className="text-xs text-[#92400E] flex items-start gap-1">
                  <span className="material-symbols-outlined text-[14px]">compare_arrows</span>
                  <span>
                    <span className="font-semibold">Differs from your course: </span>
                    {res.differs}
                  </span>
                </p>
              )}
              <ul className="flex flex-col gap-1">
                {(res.links as Link[]).map((l) => (
                  <li key={l.url}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-[#1D4ED8] underline underline-offset-2 break-words"
                    >
                      {l.title}
                    </a>
                    {!l.trusted && <span className="ml-1 text-[10px] text-[#64748B]">(less known site)</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
};
