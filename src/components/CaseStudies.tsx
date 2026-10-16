import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CapyError, CapyLoading } from './CapyStates';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { invokeEdge } from '../lib/edge';
import { useChatThread } from '../lib/chatThreads';
import { ChatHistory, RecapCard } from './ChatHistory';

export type CaseRow = { id: number; course: string; week: number | null; title: string; file_path: string; created_at: string };

type Brief = {
  situation: string;
  key_facts: { fact: string; page?: string }[];
  stakeholders: { name: string; interest: string }[];
  decision: string;
  constraints?: string[];
  open_questions?: string[];
  course_links?: { concept: string; where_in_case: string; page?: string }[];
};
type Turn = { role: 'user' | 'assistant'; content: string; data?: any };
type Mode = 'brief' | 'chat' | 'coldcall' | 'frameworks';

const Page: React.FC<{ p?: string }> = ({ p }) =>
  p ? <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-100 border border-[#E2E8F0] text-[10px] font-semibold text-[#475569]">{p}</span> : null;

type ConceptInfo = { label: string; week: number; heading: string; explanation: string; points: string[] };
const norm = (x: string) => x.toLowerCase().replace(/\[this week\]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const headingOf = (label: string) => label.replace(/^\s*week\s*\d+\s*[:\-–]\s*/i, '');

/** Tapping a chip inside the case room opens a quick peek instead of leaving the case. */
const PeekCtx = createContext<((label: string) => void) | null>(null);

/** "Week 5: Emotional intelligence" -> chip; peeks inside the case room, otherwise opens that week's note. */
const ConceptChip: React.FC<{ label: string; course: string; onOpen: () => void }> = ({ label, course, onOpen }) => {
  const { setSelectedCourse, setSelectedWeek, setActiveScreen } = useApp();
  const peek = useContext(PeekCtx);
  const week = Number(label.match(/week\s*(\d+)/i)?.[1] ?? NaN);
  return (
    <button
      type="button"
      disabled={!peek && Number.isNaN(week)}
      onClick={() => {
        if (peek) return peek(label);
        setSelectedCourse(course);
        setSelectedWeek(week);
        setActiveScreen('notes-detail');
        onOpen();
      }}
      title={peek ? 'Show this concept' : Number.isNaN(week) ? undefined : 'Open this week\'s note'}
      className="self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#C7D2FE] bg-[#EEF2FF] text-[11px] font-semibold text-[#3730A3] hover:border-[#4F46E5]"
    >
      <span className="material-symbols-outlined text-[12px]">school</span>
      {label}
    </button>
  );
};

const ConceptRow: React.FC<{ items?: string[]; course: string; onOpen: () => void }> = ({ items, course, onOpen }) =>
  items?.length ? (
    <div className="flex flex-wrap gap-1 items-center">
      <span className="text-[11px] text-[#64748B]">From your course:</span>
      {items.map((c) => (
        <ConceptChip key={c} label={c} course={course} onOpen={onOpen} />
      ))}
    </div>
  ) : null;

/** Full-screen case room: brief, discussion, cold-call practice, framework hints. */
export const CaseRoom: React.FC<{ item: CaseRow | null; onClose: () => void }> = ({ item, onClose }) => {
  const { language, notes, setSelectedCourse, setSelectedWeek, setActiveScreen } = useApp();
  const [mode, setMode] = useState<Mode>('brief');
  const [peeked, setPeeked] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false); // phone: bottom sheet
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [brief, setBrief] = useState<Brief | null>(null);
  const [frameworks, setFrameworks] = useState<any[] | null>(null);
  const chatThread = useChatThread<Turn>('case', item?.id, { title: item?.title, context: `Case discussion: ${item?.title ?? ''}`, language });
  const coldThread = useChatThread<Turn>('coldcall', item?.id, { title: item?.title, context: `Cold-call practice on the case: ${item?.title ?? ''}`, language });
  const chat = chatThread.messages;
  const setChat = chatThread.setMessages;
  const cold = coldThread.messages;
  const setCold = coldThread.setMessages;
  const activeThread = mode === 'chat' ? chatThread : mode === 'coldcall' ? coldThread : null;

  // Concepts from the student's notes for this course, case week and earlier
  const library = useMemo(() => {
    const out: ConceptInfo[] = [];
    if (!item) return out;
    for (const n of notes) {
      if (String(n.course).toUpperCase() !== String(item.course).toUpperCase()) continue;
      const w = Number(String(n.week).match(/\d+/)?.[0] ?? NaN);
      if (Number.isNaN(w) || (item.week && w > item.week)) continue;
      let c: any;
      try {
        c = typeof n.content === 'string' ? JSON.parse(n.content) : n.content;
      } catch {
        continue;
      }
      for (const k of c?.concepts ?? []) {
        out.push({
          label: `Week ${w}: ${k.heading}`,
          week: w,
          heading: String(k.heading ?? ''),
          explanation: String(k.explanation ?? ''),
          points: (k.points ?? []).map((p: any) => String(p.text ?? p)).filter(Boolean).slice(0, 4)
        });
      }
    }
    return out;
  }, [notes, item]);

  const lookup = (label: string): ConceptInfo | null => {
    const exact = library.find((c) => norm(c.label) === norm(label));
    if (exact) return exact;
    const h = norm(headingOf(label));
    const labelWeek = Number(label.match(/week\s*(\d+)/i)?.[1] ?? NaN);
    const pool = Number.isNaN(labelWeek) ? library : library.filter((c) => c.week === labelWeek).concat(library);
    const direct = pool.find((c) => norm(c.heading) === h) ?? pool.find((c) => h && (norm(c.heading).includes(h) || h.includes(norm(c.heading))));
    if (direct) return direct;
    // Word overlap: "Emotional intelligence" ~ "Emotional Intelligence (EI) and its four skills"
    const STOP = new Set(['the', 'of', 'and', 'a', 'an', 'in', 'to', 'for', 'its', 'on', 'vs']);
    const words = (x: string) => new Set(norm(x).split(' ').filter((w) => w.length > 2 && !STOP.has(w)));
    const want = words(h);
    if (!want.size) return null;
    let best: ConceptInfo | null = null;
    let bestScore = 0;
    for (const c of pool) {
      const have = words(`${c.heading} ${c.explanation.slice(0, 200)}`);
      const hit = [...want].filter((w) => have.has(w)).length / want.size;
      if (hit > bestScore) {
        best = c;
        bestScore = hit;
      }
    }
    return bestScore >= 0.6 ? best : null;
  };
  /** Week for a concept: from the matched note, else from its label ("Week 5: …"). */
  const weekOf = (label: string, info: ConceptInfo | null) => info?.week ?? (Number(label.match(/week\s*(\d+)/i)?.[1]) || null);

  // Every concept the case room has brought up so far, with how often
  const used = useMemo(() => {
    const counts = new Map<string, number>();
    const add = (l?: string) => l && counts.set(l, (counts.get(l) ?? 0) + 1);
    brief?.course_links?.forEach((l) => add(l.concept));
    (frameworks ?? []).forEach((f: any) => add(f.framework));
    [...chat, ...cold].forEach((t: any) => (t.data?.concepts_used ?? []).forEach(add));
    const merged = new Map<string, { label: string; count: number; info: ConceptInfo | null; week: number | null }>();
    for (const [label, count] of counts) {
      const info = lookup(label);
      const key = info ? info.label : norm(headingOf(label));
      const prev = merged.get(key);
      if (prev) prev.count += count;
      else merged.set(key, { label: info?.label ?? label, count, info, week: weekOf(label, info) });
    }
    return [...merged.values()].sort((a, b) => (b.week ?? 0) - (a.week ?? 0) || b.count - a.count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief, frameworks, chat, cold, library]);

  // Briefly highlight concepts that just appeared
  const seenRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const now = new Set(used.map((u) => u.label));
    if (seenRef.current) {
      const added = [...now].filter((l) => !seenRef.current!.has(l));
      if (added.length) {
        setFresh(new Set(added));
        const t = window.setTimeout(() => setFresh(new Set()), 4000);
        seenRef.current = now;
        return () => window.clearTimeout(t);
      }
    }
    seenRef.current = now;
  }, [used]);
  useEffect(() => {
    seenRef.current = null;
    setPeeked(null);
    setExpanded(null);
  }, [item?.id]);

  const openNote = (info: ConceptInfo | null, label: string) => {
    const week = info?.week ?? Number(label.match(/week\s*(\d+)/i)?.[1] ?? NaN);
    if (!item || Number.isNaN(week)) return;
    setSelectedCourse(item.course);
    setSelectedWeek(week);
    setActiveScreen('notes-detail');
    onClose();
  };
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMode('brief');
    setBrief(null);
    setFrameworks(null);
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
    if (mode === 'coldcall' && coldThread.loaded && cold.length === 0 && !busy)
      call('coldcall', []).then((d) => d && setCold([{ role: 'assistant', content: d.next_question, data: d }]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, item?.id, coldThread.loaded, cold.length]);

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
        className="relative w-full max-w-3xl lg:max-w-6xl bg-white sm:rounded-2xl p-5 flex gap-5 h-full sm:h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
       <PeekCtx.Provider value={setPeeked}>
        <div className="flex-1 min-w-0 flex flex-col gap-3">
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
        <p className="text-[11px] text-[#64748B]">Based on this case (page refs shown) and your notes up to this week. It won't write your analysis. Chats are saved to your account.</p>

        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 text-sm">
          {busy && <CapyLoading mood="thinking" size={44} text="Detective Capy is reading the case… 🔍" />}
          {error && <CapyError compact message={error} />}

          {mode === 'brief' && brief && (
            <div className="flex flex-col gap-3">
              <p className="text-[#1E293B]">{brief.situation}</p>
              <div>
                <p className="text-xs font-semibold text-[#0E0E12]">The decision</p>
                <p className="text-[#1E293B]">{brief.decision}</p>
              </div>
              {brief.course_links?.length ? (
                <div className="p-3 rounded-xl border border-[#C7D2FE] bg-[#F5F7FF] flex flex-col gap-2">
                  <p className="text-xs font-semibold text-[#3730A3]">
                    Links to your course{item.week ? ` (Week ${item.week} and earlier)` : ''}
                  </p>
                  {brief.course_links.map((l, i) => (
                    <div key={i} className="flex flex-col gap-0.5">
                      <ConceptChip label={l.concept} course={item.course} onOpen={onClose} />
                      <p className="text-[#334155]">
                        {l.where_in_case}
                        <Page p={l.page} />
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#64748B]">
                  Generate your {item.course} notes{item.week ? ` for Week ${item.week} and earlier` : ''} to see how this case links to what you've been taught.
                </p>
              )}
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
                  <ConceptChip label={f.framework} course={item.course} onOpen={onClose} />
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

          {activeThread?.current?.summary && <RecapCard s={activeThread.current.summary} compact />}
          {mode === 'chat' && (
            <>
              {chat.length === 0 && !busy && chatThread.loaded && (
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
                    <ConceptRow items={t.data?.concepts_used} course={item.course} onOpen={onClose} />
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
                  <ConceptRow items={t.data?.concepts_used} course={item.course} onOpen={onClose} />
                </div>
              )
            )}
          <div ref={endRef} />
          {activeThread && (
            <ChatHistory
              history={activeThread.history}
              summarizing={activeThread.summarizing}
              onSummarize={(t) => activeThread.summarize(t)}
              onResume={(t) => activeThread.resume(t)}
              onDelete={(t) => activeThread.remove(t)}
            />
          )}
        </div>

        {activeThread && activeThread.messages.length > 0 && (
          <div className="flex gap-3 items-center">
            <button type="button" onClick={() => activeThread.startOver()} className="text-xs text-[#64748B] underline">
              {mode === 'coldcall' ? 'New practice round (saves this one)' : 'Start over (saves this chat to history)'}
            </button>
            {activeThread.messages.length >= 2 && (
              <button
                type="button"
                disabled={!!activeThread.summarizing}
                onClick={() => activeThread.summarize(activeThread.current)}
                className="text-xs text-[#4F46E5] font-semibold disabled:opacity-50"
              >
                {activeThread.summarizing ? 'Making a recap…' : '✨ Recap so far'}
              </button>
            )}
            {activeThread.error && <span className="text-xs text-red-700">{activeThread.error}</span>}
          </div>
        )}

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

        {/* Concepts side panel (desktop) / bottom sheet (phone) */}
        <aside
          aria-label="Concepts in this case"
          className={`${panelOpen ? 'flex' : 'hidden'} lg:flex flex-col gap-2 absolute lg:static inset-x-0 bottom-0 max-h-[70%] lg:max-h-none lg:w-80 shrink-0 bg-white lg:bg-[#F8FAFF] border-t lg:border border-[#C7D2FE] lg:rounded-xl p-4 overflow-y-auto shadow-2xl lg:shadow-none rounded-t-2xl z-10`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0E0E12] flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px] text-[#4F46E5]">school</span>
              Concepts in play
            </h3>
            <button type="button" onClick={() => setPanelOpen(false)} className="lg:hidden text-xs text-[#64748B] underline">
              Close
            </button>
          </div>
          <p className="text-[11px] text-[#64748B]">
            From your {item.course} notes{item.week ? `, Week ${item.week} and earlier` : ''}. Updates as the tutor brings them up.
          </p>
          {used.length === 0 && (
            <p className="text-xs text-[#64748B] py-2">
              {library.length ? 'None yet. Open the case brief or start talking it through.' : `No ${item.course} notes${item.week ? ` up to Week ${item.week}` : ''} yet. Generate them in Notes to link concepts.`}
            </p>
          )}
          {used.map(({ label, count, info, week }) => {
            const isOpen = expanded === label;
            return (
              <div
                key={label}
                className={`rounded-xl border p-2.5 transition-colors ${fresh.has(label) ? 'border-[#4F46E5] bg-[#EEF2FF] ring-2 ring-[#C7D2FE]' : 'border-[#E2E8F0] bg-white'}`}
              >
                <button type="button" onClick={() => setExpanded(isOpen ? null : label)} className="w-full text-left flex items-start gap-2">
                  <span
                    title={week ? `Week ${week}` : 'Course concept'}
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.week && week === item.week ? 'bg-[#4F46E5] text-white' : 'bg-slate-100 text-[#475569]'}`}
                  >
                    {week ? `W${week}` : <span className="material-symbols-outlined text-[12px] align-middle">school</span>}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-[#0E0E12]">{info?.heading ?? headingOf(label)}</span>
                  <span className="text-[10px] text-[#64748B]" title="Times it came up">×{count}</span>
                </button>
                {info?.explanation && <p className={`text-xs text-[#334155] mt-1 ${isOpen ? '' : 'line-clamp-2'}`}>{info.explanation}</p>}
                {isOpen && (
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    {info?.points?.length ? (
                      <ul className="list-disc pl-4 text-xs text-[#334155]">
                        {info.points.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    ) : null}
                    <button type="button" onClick={() => openNote(info, label)} className="self-start text-xs font-semibold text-[#4F46E5]">
                      {week ? `Open Week ${week} note →` : 'Find it in Notes →'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </aside>

        {/* Phone: button to open the concepts sheet */}
        {!panelOpen && (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="lg:hidden absolute right-16 top-6 px-3 py-1 rounded-full bg-[#4F46E5] text-white text-xs font-semibold shadow"
          >
            Concepts ({used.length})
          </button>
        )}

        {/* Quick peek (tap any concept chip) */}
        {peeked && (() => {
          const info = lookup(peeked);
          return (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 rounded-2xl p-4" onClick={() => setPeeked(null)}>
              <div role="dialog" aria-label={peeked} className="w-full max-w-md bg-white rounded-2xl p-4 flex flex-col gap-2 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold text-[#4F46E5]">
                      {item.course}{(info?.week ?? peeked.match(/week\s*(\d+)/i)?.[1]) ? ` · Week ${info?.week ?? peeked.match(/week\s*(\d+)/i)?.[1]}` : ''}
                      {item.week && info?.week === item.week ? ' · this case\'s week' : ''}
                    </p>
                    <h4 className="text-base font-bold text-[#0E0E12]">{info?.heading ?? headingOf(peeked)}</h4>
                  </div>
                  <button type="button" onClick={() => setPeeked(null)} aria-label="Close" className="w-7 h-7 rounded-full bg-slate-100 shrink-0">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
                {info ? (
                  <>
                    {info.explanation && <p className="text-sm text-[#334155]">{info.explanation}</p>}
                    {info.points.length > 0 && (
                      <ul className="list-disc pl-5 text-sm text-[#334155]">
                        {info.points.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-[#64748B]">This concept isn't in your saved notes word-for-word. Open the week's note to find it.</p>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setPeeked(null)} className="px-3 py-1.5 rounded-lg border border-[#C9D1DB] text-sm font-semibold">
                    Back to case
                  </button>
                  <button type="button" onClick={() => openNote(info, peeked)} className="px-3 py-1.5 rounded-lg bg-[#4F46E5] text-white text-sm font-semibold">
                    Open full note
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
       </PeekCtx.Provider>
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
