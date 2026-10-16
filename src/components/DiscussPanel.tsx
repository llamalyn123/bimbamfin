import React, { useEffect, useRef, useState } from 'react';
import { invokeEdge } from '../lib/edge';
import { useChatThread } from '../lib/chatThreads';
import { ChatHistory, RecapCard } from './ChatHistory';
import { Capy, capyMood } from './Capy';

type SourceRef = { id: unknown; label: string; name: string };
type Correction = { student_said: string; correction: string; source_ids: string[] };
type TutorReply = { reply: string; corrections: Correction[]; follow_up?: string; not_covered: boolean };
type Msg = { role: 'user' | 'assistant'; content: string; data?: TutorReply };
type Feedback = {
  summary: string;
  strengths: string[];
  issues: { quote: string; problem: string; what_material_says: string; source_ids: string[] }[];
  gaps: string[];
  question?: string;
};

const PROBLEM_LABEL: Record<string, string> = {
  inaccurate: 'Not accurate',
  misread: 'Misread',
  unsupported: 'Not supported by the material',
  oversimplified: 'Oversimplified'
};

const Tags: React.FC<{ ids: string[]; sources: SourceRef[] }> = ({ ids, sources }) => (
  <>
    {ids.map((l) => {
      const s = sources.find((x) => x.label === l);
      return (
        <span
          key={l}
          title={s?.name}
          className="ml-1 px-1.5 py-0.5 rounded bg-slate-100 border border-[#E2E8F0] text-[10px] font-semibold text-[#475569]"
        >
          {l}
        </span>
      );
    })}
  </>
);

/**
 * "Discuss" (chat tutor) + "Feedback on my writing", grounded only in this
 * week's master note. The chat is saved to the student's account (chat_threads)
 * with past chats and AI recaps; writing feedback is not saved.
 */
export const DiscussPanel: React.FC<{ noteId: string; language: string; sources: SourceRef[] }> = ({
  noteId,
  language,
  sources
}) => {
  const [mode, setMode] = useState<'chat' | 'feedback'>('chat');
  const thread = useChatThread<Msg>('discuss', noteId, { context: "Discussing this week's course note", language });
  const msgs = thread.messages;
  const setMsgs = thread.setMessages;
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [essay, setEssay] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [msgs, busy]);

  // new note -> clear writing feedback (the chat itself is loaded per note by useChatThread)
  useEffect(() => {
    setFeedback(null);
    setError(null);
  }, [noteId]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content }];
    setMsgs(next);
    setInput('');
    setBusy(true);
    setError(null);
    const { data, error: err } = await invokeEdge<TutorReply>('discuss', {
      note_id: noteId,
      mode: 'chat',
      language,
      messages: next.map((m) => ({
        role: m.role,
        content: m.role === 'assistant' && m.data ? [m.data.reply, m.data.follow_up].filter(Boolean).join(' ') : m.content
      }))
    });
    setBusy(false);
    if (err || !data) return setError(err?.message ?? 'Something went wrong.');
    setMsgs([...next, { role: 'assistant', content: data.reply, data }]);
  };

  /** Clean answers in a row up to message i (no corrections, covered) -> Capy sparkles on a streak. */
  const streakAt = (i: number) => {
    let n = 0;
    for (let j = i; j >= 0; j--) {
      const d = msgs[j]?.role === 'assistant' ? msgs[j].data : undefined;
      if (msgs[j]?.role !== 'assistant') continue;
      if (!d || (d.corrections?.length ?? 0) > 0 || d.not_covered) break;
      n++;
    }
    return n;
  };

  const getFeedback = async () => {
    setBusy(true);
    setError(null);
    setFeedback(null);
    const { data, error: err } = await invokeEdge<Feedback>('discuss', { note_id: noteId, mode: 'feedback', language, text: essay });
    setBusy(false);
    if (err || !data) return setError(err?.message ?? 'Something went wrong.');
    setFeedback(data);
  };

  return (
    <section className="bg-white rounded-2xl border border-[#C9D1DB] p-5 flex flex-col gap-3" aria-label="Discuss this week">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-headline-sm font-bold text-[#0E0E12] flex items-center gap-2">
          <Capy size={30} mood="happy" title="Capy" />
          Discuss with Capy
        </h2>
        <div className="flex gap-1" role="tablist">
          {(['chat', 'feedback'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                mode === m ? 'bg-[#0E0E12] text-white border-[#0E0E12]' : 'bg-white text-[#475569] border-[#C9D1DB]'
              }`}
            >
              {m === 'chat' ? 'Talk it through' : 'Feedback on my writing'}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-[#64748B] flex items-center gap-1">
        <span className="material-symbols-outlined text-[13px]">info</span>
        Capy only uses this week's note and your sources, and won't write work for you. Chats are saved to your account.
      </p>

      {mode === 'chat' ? (
        <>
          <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-1">
            {!thread.loaded && <p className="text-xs text-[#64748B]">Loading your chat…</p>}
            {thread.current?.summary && <RecapCard s={thread.current.summary} compact />}
            {thread.loaded && msgs.length === 0 && (
              <div className="text-sm text-[#475569] flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <Capy size={56} mood="happy" title="Capy" />
                  <p>
                    <b className="text-[#0E0E12]">Hey, I'm Capy 🪞</b>
                    <br />
                    Tell me how you understand this week. I'll reflect back what's spot on and what's a bit blurry. No cap.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['Here’s how I understand the main idea…', 'I think the key difference is…', 'Quiz me with one hard question'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setInput(s)}
                      className="px-2.5 py-1 rounded-full border border-[#C9D1DB] text-xs text-[#334155] hover:border-[#D4A94F]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="self-end max-w-[85%] px-3 py-2 rounded-2xl rounded-br-md bg-[#0E0E12] text-white text-sm whitespace-pre-wrap">
                  {m.content}
                </div>
              ) : (
                <div key={i} className="self-start max-w-[92%] flex gap-2 items-start">
                  <Capy size={34} mood={capyMood(m.data, streakAt(i))} className="mt-0.5" />
                  <div className="flex flex-col gap-2 min-w-0">
                  <div className="px-3 py-2 rounded-2xl rounded-tl-md bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#1E293B]">
                    <span className="block text-[10px] font-bold text-[#8B5E2F] mb-0.5">Capy</span>
                    {m.data?.reply}
                    {m.data?.not_covered && (
                      <p className="mt-1 text-xs text-[#92400E] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">help</span>
                        Your materials don't cover this.
                      </p>
                    )}
                  </div>
                  {(m.data?.corrections ?? []).map((c, ci) => (
                    <div key={ci} className="px-3 py-2 rounded-xl border border-[#FDE68A] bg-[#FFFDF7] text-sm">
                      <p className="text-xs text-[#92400E] font-semibold">Correction</p>
                      <p className="text-[#64748B] line-through decoration-1">{c.student_said}</p>
                      <p className="text-[#1E293B]">
                        {c.correction}
                        <Tags ids={c.source_ids ?? []} sources={sources} />
                      </p>
                    </div>
                  ))}
                  {m.data?.follow_up && i === msgs.length - 1 && (
                    <div className="self-start px-3 py-2 rounded-xl border border-[#C9D1DB] text-sm text-[#0E0E12] bg-white">
                      <span className="text-xs text-[#64748B] block">Think about this:</span>
                      {m.data.follow_up}
                    </div>
                  )}
                  </div>
                </div>
              )
            )}
            {busy && (
              <p className="text-xs text-[#64748B] flex items-center gap-2">
                <Capy size={28} mood="thinking" />
                Capy is checking your material…
              </p>
            )}
            <div ref={endRef} />
          </div>

          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
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
              placeholder="Type your thoughts… (Enter to send, Shift+Enter for a new line)"
              aria-label="Your message"
              className="flex-1 px-3 py-2 rounded-xl border border-[#C9D1DB] text-sm focus:outline-none focus:border-[#D4A94F] resize-none"
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="h-10 px-4 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] font-bold disabled:opacity-50"
            >
              Send
            </button>
          </div>
          {msgs.length > 0 && (
            <div className="flex gap-3 items-center">
              <button type="button" onClick={() => thread.startOver()} className="text-xs text-[#64748B] underline">
                Start over (saves this chat to history)
              </button>
              {msgs.length >= 2 && (
                <button
                  type="button"
                  disabled={!!thread.summarizing}
                  onClick={() => thread.summarize(thread.current)}
                  className="text-xs text-[#4F46E5] font-semibold disabled:opacity-50"
                >
                  {thread.summarizing ? 'Making a recap…' : '✨ Recap so far'}
                </button>
              )}
            </div>
          )}
          {thread.error && <p role="alert" className="text-xs text-red-700">{thread.error}</p>}
          <ChatHistory
            history={thread.history}
            summarizing={thread.summarizing}
            onSummarize={(t) => thread.summarize(t)}
            onResume={(t) => thread.resume(t)}
            onDelete={(t) => thread.remove(t)}
          />
        </>
      ) : (
        <>
          <textarea
            value={essay}
            onChange={(e) => setEssay(e.target.value)}
            rows={8}
            placeholder="Paste your thoughts, argument or essay draft on this week's material (up to ~2,000 words)."
            aria-label="Your writing"
            className="w-full px-3 py-2 rounded-xl border border-[#C9D1DB] text-sm focus:outline-none focus:border-[#D4A94F]"
          />
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          <button
            type="button"
            onClick={getFeedback}
            disabled={busy || essay.trim().length < 80}
            className="self-end px-5 py-2 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] font-bold disabled:opacity-50"
          >
            {busy ? 'Capy is reading your writing…' : 'Get feedback from Capy'}
          </button>

          {feedback && (
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex gap-2 items-start">
                <Capy size={34} mood={feedback.issues.length === 0 ? 'sparkle' : 'oops'} />
                <p className="text-[#1E293B]">
                  <span className="block text-[10px] font-bold text-[#8B5E2F]">Capy</span>
                  {feedback.summary}
                </p>
              </div>
              {feedback.strengths.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-700">What works</p>
                  <ul className="list-disc pl-5 text-[#334155]">
                    {feedback.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {feedback.issues.map((it, i) => (
                <div key={i} className="px-3 py-2 rounded-xl border border-[#FDE68A] bg-[#FFFDF7]">
                  <p className="text-xs font-semibold text-[#92400E]">{PROBLEM_LABEL[it.problem] ?? 'Check this'}</p>
                  <p className="text-[#64748B] italic">“{it.quote}”</p>
                  <p className="text-[#1E293B]">
                    {it.what_material_says}
                    <Tags ids={it.source_ids ?? []} sources={sources} />
                  </p>
                </div>
              ))}
              {feedback.gaps.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#0E0E12]">Ideas from the material you could use</p>
                  <ul className="list-disc pl-5 text-[#334155]">
                    {feedback.gaps.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}
              {feedback.question && (
                <p className="text-[#334155]">
                  <span className="text-xs text-[#64748B] block">Think about this:</span>
                  {feedback.question}
                </p>
              )}
              <p className="text-[11px] text-[#64748B]">
                Feedback only. Rewriting is up to you. Check your course's rules on using AI for assessed work.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
};
