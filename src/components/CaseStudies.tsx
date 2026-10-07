import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { invokeEdge } from '../lib/edge';

export type CaseRow = { id: number; course: string; week: number | null; title: string; file_path: string; created_at: string };

type Brief = {
  situation: string;
  key_facts: { fact: string; page?: string }[];
  stakeholders: { name: string; interest: string }[];
  decision: string;
  constraints?: string[];
  open_questions?: string[];
};
type Turn = { role: 'user' | 'assistant'; content: string; data?: any };
type Mode = 'brief' | 'chat' | 'coldcall' | 'frameworks';

const Page: React.FC<{ p?: string }> = ({ p }) =>
  p ? <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-100 border border-[#E2E8F0] text-[10px] font-semibold text-[#475569]">{p}</span> : null;

/** Full-screen case room: brief, discussion, cold-call practice, framework hints. */
export const CaseRoom: React.FC<{ item: CaseRow | null; onClose: () => void }> = ({ item, onClose }) => {
  const { language } = useApp();
  const [mode, setMode] = useState<Mode>('brief');
  const [brief, setBrief] = useState<Brief | null>(null);
  const [frameworks, setFrameworks] = useState<any[] | null>(null);
  const [chat, setChat] = useState<Turn[]>([]);
  const [cold, setCold] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMode('brief');
    setBrief(null);
    setFrameworks(null);
    setChat([]);
    setCold([]);
    setError(null);
  }, [item?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [chat, cold, busy]);

  const call = async (m: Mode, messages?: Turn[]) => {
    if (!item) return null;
    setBusy(true);
    setError(null);
    const { data, error: err } = await invokeEdge('case-chat', {
      case_id: item.id,
      mode: m,
      language,
      messages: (messages ?? []).map((t) => ({ role: t.role, content: t.content }))
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return null;
    }
    return data;
  };

  // auto-load per tab
  useEffect(() => {
    if (!item) return;
    if (mode === 'brief' && !brief && !busy) call('brief').then((d) => d && setBrief(d));
    if (mode === 'frameworks' && !frameworks && !busy) call('frameworks').then((d) => d && setFrameworks(d.suggestions || []));
    if (mode === 'coldcall' && cold.length === 0 && !busy)
      call('coldcall', []).then((d) => d && setCold([{ role: 'assistant', content: d.next_question, data: d }]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, item?.id]);

  if (!item) return null;

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    if (mode === 'chat') {
      const next: Turn[] = [...chat, { role: 'user', content: text }];
      setChat(next);
      const d = await call('chat', next);
      if (d) setChat([...next, { role: 'assistant', content: [d.reply, d.follow_up].filter(Boolean).join(' '), data: d }]);
    } else if (mode === 'coldcall') {
      const next: Turn[] = [...cold, { role: 'user', content: text }];
      setCold(next);
      const d = await call('coldcall', next);
      if (d) setCold([...next, { role: 'assistant', content: d.next_question, data: d }]);
    }
  };

  const RATING: Record<string, string> = { strong: '✅ Strong', partial: '◐ Partly there', missed: '✗ Missed the point' };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`Case: ${item.title}`}
        className="w-full max-w-3xl bg-white sm:rounded-2xl p-5 flex flex-col gap-3 h-full sm:h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-[#64748B]">
              {item.course} · Case study{item.week ? ` · Week ${item.week}` : ''}
            </p>
            <h2 className="text-lg font-bold text-[#0E0E12] truncate">{item.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 shrink-0">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-1" role="tablist">
          {(
            [
              ['brief', 'Case brief'],
              ['chat', 'Talk it through'],
              ['coldcall', 'Cold call practice'],
              ['frameworks', 'Frameworks to try']
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                mode === m ? 'bg-[#0E0E12] text-white border-[#0E0E12]' : 'bg-white text-[#475569] border-[#C9D1DB]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[#64748B]">Based only on this case (page refs shown). It won't write your analysis. Chats aren't saved.</p>

        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 text-sm">
          {busy && <p className="text-xs text-[#64748B]">Reading the case…</p>}
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}

          {mode === 'brief' && brief && (
            <div className="flex flex-col gap-3">
              <p className="text-[#1E293B]">{brief.situation}</p>
              <div>
                <p className="text-xs font-semibold text-[#0E0E12]">The decision</p>
                <p className="text-[#1E293B]">{brief.decision}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#0E0E12]">Key facts</p>
                <ul className="list-disc pl-5 text-[#334155]">
                  {brief.key_facts.map((f, i) => (
                    <li key={i}>
                      {f.fact}
                      <Page p={f.page} />
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#0E0E12]">Stakeholders</p>
                <ul className="list-disc pl-5 text-[#334155]">
                  {brief.stakeholders.map((s, i) => (
                    <li key={i}>
                      <b>{s.name}:</b> {s.interest}
                    </li>
                  ))}
                </ul>
              </div>
              {brief.constraints?.length ? (
                <div>
                  <p className="text-xs font-semibold text-[#0E0E12]">Constraints</p>
                  <ul className="list-disc pl-5 text-[#334155]">
                    {brief.constraints.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {brief.open_questions?.length ? (
                <div>
                  <p className="text-xs font-semibold text-[#0E0E12]">Questions class will probably ask</p>
                  <ul className="list-disc pl-5 text-[#334155]">
                    {brief.open_questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}

          {mode === 'frameworks' && frameworks && (
            <div className="flex flex-col gap-2">
              {frameworks.map((f, i) => (
                <div key={i} className="p-3 rounded-xl border border-[#E2E8F0]">
                  <p className="font-semibold text-[#0E0E12]">{f.framework}</p>
                  <p className="text-[#334155]">
                    {f.why}
                    <Page p={f.page} />
                  </p>
                  <p className="text-[#1E293B] mt-1">
                    <span className="text-xs text-[#64748B] block">Try this:</span>
                    {f.question}
                  </p>
                </div>
              ))}
            </div>
          )}

          {mode === 'chat' && (
            <>
              {chat.length === 0 && !busy && (
                <p className="text-[#475569]">Share your take on the case: the core problem, what you'd recommend, or a question. I'll check it against the case.</p>
              )}
              {chat.map((t, i) =>
                t.role === 'user' ? (
                  <div key={i} className="self-end max-w-[85%] px-3 py-2 rounded-2xl rounded-br-md bg-[#0E0E12] text-white whitespace-pre-wrap">
                    {t.content}
                  </div>
                ) : (
                  <div key={i} className="self-start max-w-[90%] flex flex-col gap-2">
                    <div className="px-3 py-2 rounded-2xl rounded-bl-md bg-[#F8FAFC] border border-[#E2E8F0] text-[#1E293B]">
                      {t.data?.reply}
                      {t.data?.not_in_case && <p className="mt-1 text-xs text-[#92400E]">Some of that isn't in the case.</p>}
                    </div>
                    {(t.data?.corrections ?? []).map((c: any, ci: number) => (
                      <div key={ci} className="px-3 py-2 rounded-xl border border-[#FDE68A] bg-[#FFFDF7]">
                        <p className="text-xs text-[#92400E] font-semibold">Check this</p>
                        <p className="text-[#64748B] line-through decoration-1">{c.student_said}</p>
                        <p className="text-[#1E293B]">
                          {c.case_says}
                          <Page p={c.page} />
                        </p>
                      </div>
                    ))}
                    {t.data?.follow_up && (
                      <div className="px-3 py-2 rounded-xl border border-[#C9D1DB] bg-white">
                        <span className="text-xs text-[#64748B] block">Think about this:</span>
                        {t.data.follow_up}
                      </div>
                    )}
                  </div>
                )
              )}
            </>
          )}

          {mode === 'coldcall' &&
            cold.map((t, i) =>
              t.role === 'user' ? (
                <div key={i} className="self-end max-w-[85%] px-3 py-2 rounded-2xl rounded-br-md bg-[#0E0E12] text-white whitespace-pre-wrap">
                  {t.content}
                </div>
              ) : (
                <div key={i} className="self-start max-w-[90%] flex flex-col gap-2">
                  {t.data?.feedback && (
                    <div className="px-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                      {t.data.rating && <p className="text-xs font-semibold text-[#0E0E12]">{RATING[t.data.rating] ?? ''}</p>}
                      <p className="text-[#1E293B]">{t.data.feedback}</p>
                      {t.data.case_says && (
                        <p className="text-[#334155] mt-1">
                          <span className="text-xs text-[#64748B]">The case: </span>
                          {t.data.case_says}
                          <Page p={t.data.page} />
                        </p>
                      )}
                    </div>
                  )}
                  <div className="px-3 py-2 rounded-2xl rounded-bl-md bg-white border-2 border-[#D4A94F] text-[#0E0E12] font-semibold">
                    🎤 {t.content}
                  </div>
                </div>
              )
            )}
          <div ref={endRef} />
        </div>

        {(mode === 'chat' || mode === 'coldcall') && (
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={2}
              placeholder={mode === 'coldcall' ? 'Answer like you would in class…' : 'Your analysis or question… (Enter to send)'}
              aria-label="Your message"
              className="flex-1 px-3 py-2 rounded-xl border border-[#C9D1DB] text-sm focus:outline-none focus:border-[#D4A94F] resize-none"
            />
            <button
              type="button"
              onClick={send}
              disabled={busy || !input.trim()}
              className="h-10 px-4 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] font-bold disabled:opacity-50"
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/** List of a course's case studies. */
export const CasesSection: React.FC<{ course: string; cases: CaseRow[]; onChanged: () => void }> = ({ course, cases, onChanged }) => {
  const { showToast } = useApp();
  const [open, setOpen] = useState<CaseRow | null>(null);
  const mine = cases.filter((c) => c.course === course);
  if (!mine.length) return null;

  const remove = async (c: CaseRow) => {
    await supabase.storage.from('sources').remove([c.file_path]);
    const { error } = await supabase.from('cases').delete().eq('id', c.id);
    if (error) return showToast(`Couldn't delete: ${error.message}`);
    onChanged();
  };

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-bold text-[#0E0E12] mt-2">Case studies</h3>
      {mine.map((c) => (
        <div key={c.id} className="p-4 rounded-xl bg-white border border-[#C9D1DB] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="material-symbols-outlined text-[20px] text-[#B45309]">cases</span>
            <div className="min-w-0">
              <p className="font-semibold text-[#0E0E12] truncate">{c.title}</p>
              <p className="text-xs text-[#64748B]">{c.week ? `Week ${c.week}` : 'No specific week'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setOpen(c)}
              className="font-label-tabular text-xs text-[#B47B16] bg-[#FEF3C7] border border-[#FDE68A] px-3 py-1 rounded-lg font-bold hover:bg-amber-100"
            >
              Open case
            </button>
            <button type="button" onClick={() => remove(c)} aria-label={`Delete ${c.title}`} className="text-slate-400 hover:text-red-700">
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        </div>
      ))}
      <CaseRoom item={open} onClose={() => setOpen(null)} />
    </div>
  );
};
