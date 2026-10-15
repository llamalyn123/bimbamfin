import React, { useState } from 'react';
import type { ChatSummary, ChatThread } from '../lib/chatThreads';

const when = (iso: string) =>
  new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Recap card: summary, things to remember, still unclear. */
export const RecapCard: React.FC<{ s: ChatSummary; compact?: boolean }> = ({ s, compact }) => (
  <div className={`rounded-xl border border-[#C7D2FE] bg-[#EEF2FF] ${compact ? 'p-2.5' : 'p-3'} text-sm flex flex-col gap-1.5`}>
    <p className="text-[#1E293B]">{s.summary}</p>
    {s.key_points?.length > 0 && (
      <div>
        <p className="text-[11px] font-semibold text-[#3730A3]">Remember</p>
        <ul className="list-disc pl-5 text-[#334155]">
          {s.key_points.map((k, i) => (
            <li key={i}>{k}</li>
          ))}
        </ul>
      </div>
    )}
    {s.open_questions?.length > 0 && (
      <div>
        <p className="text-[11px] font-semibold text-[#92400E]">Still to work out</p>
        <ul className="list-disc pl-5 text-[#334155]">
          {s.open_questions.map((k, i) => (
            <li key={i}>{k}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

/** "Past chats" list under a chat: recap, peek at the transcript, continue, delete. */
export const ChatHistory: React.FC<{
  history: ChatThread[];
  summarizing: string | null;
  onSummarize: (t: ChatThread) => void;
  onResume: (t: ChatThread) => void;
  onDelete: (t: ChatThread) => void;
}> = ({ history, summarizing, onSummarize, onResume, onDelete }) => {
  const [open, setOpen] = useState(false);
  const [peek, setPeek] = useState<string | null>(null);
  if (!history.length) return null;

  return (
    <div className="border-t border-[#E2E8F0] pt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-xs font-semibold text-[#475569] flex items-center gap-1 hover:text-[#0E0E12]"
      >
        <span className="material-symbols-outlined text-[16px]">history</span>
        Past chats ({history.length})
        <span className="material-symbols-outlined text-[16px]">{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open && (
        <ul className="mt-2 flex flex-col gap-2">
          {history.map((t) => (
            <li key={t.id} className="p-3 rounded-xl border border-[#E2E8F0] flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-[#64748B]">
                  {when(t.updated_at)} · {t.messages.length} messages
                </span>
                <span className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPeek(peek === t.id ? null : t.id)}
                    className="px-2 py-0.5 rounded-lg border border-[#C9D1DB] text-xs font-semibold text-[#0E0E12]"
                  >
                    {peek === t.id ? 'Hide' : 'Read'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onResume(t)}
                    className="px-2 py-0.5 rounded-lg border border-[#C9D1DB] text-xs font-semibold text-[#0E0E12]"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={() => window.confirm('Delete this chat?') && onDelete(t)}
                    aria-label="Delete chat"
                    className="px-1.5 py-0.5 rounded-lg border border-[#C9D1DB] text-red-600"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                  </button>
                </span>
              </div>
              {t.summary ? (
                <RecapCard s={t.summary} compact />
              ) : (
                <button
                  type="button"
                  disabled={summarizing === t.id}
                  onClick={() => onSummarize(t)}
                  className="self-start text-xs text-[#4F46E5] font-semibold disabled:opacity-50"
                >
                  {summarizing === t.id ? 'Making a recap…' : '✨ Recap this chat'}
                </button>
              )}
              {peek === t.id && (
                <div className="max-h-64 overflow-y-auto flex flex-col gap-1.5 text-sm border-t border-[#E2E8F0] pt-2">
                  {t.messages.map((m: any, i: number) => (
                    <p key={i} className={m.role === 'user' ? 'text-[#0E0E12]' : 'text-[#475569]'}>
                      <b className="text-xs">{m.role === 'user' ? 'You' : 'Tutor'}:</b>{' '}
                      {m.role === 'assistant' && m.data
                        ? [m.data.reply, m.data.feedback, m.data.follow_up, m.data.next_question].filter(Boolean).join(' ') || m.content
                        : m.content}
                    </p>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
