import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { invokeEdge } from './edge';

export type ChatKind = 'discuss' | 'case' | 'coldcall';
export type ChatSummary = { summary: string; key_points: string[]; open_questions: string[] };
export type ChatThread<M = any> = {
  id: string;
  kind: ChatKind;
  ref_id: string;
  title: string | null;
  messages: M[];
  summary: ChatSummary | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

const plain = (m: any) => ({
  role: m.role,
  content:
    m.role === 'assistant' && m.data
      ? [m.data.reply, m.data.feedback, m.data.case_says, m.data.follow_up, m.data.next_question].filter(Boolean).join(' ') || m.content
      : m.content
});

/**
 * Saved conversation for one note (discuss) or one case (case / coldcall).
 * - The open conversation is restored when the student comes back.
 * - "Start over" files it under history (with an AI recap when it has a few turns).
 * - Past chats can be recapped, continued or deleted.
 */
export function useChatThread<M extends { role: string; content: string }>(
  kind: ChatKind,
  refId: string | number | null | undefined,
  opts: { title?: string; context?: string; language?: string } = {}
) {
  const ref = refId == null ? '' : String(refId);
  const [messages, setMessagesState] = useState<M[]>([]);
  const [current, setCurrent] = useState<ChatThread<M> | null>(null);
  const [history, setHistory] = useState<ChatThread<M>[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [summarizing, setSummarizing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!ref) return;
    const { data, error: err } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('kind', kind)
      .eq('ref_id', ref)
      .order('updated_at', { ascending: false })
      .limit(30);
    if (err) {
      // Table missing (SQL not run yet) -> behave like before: chat works, just isn't saved
      setError(null);
      setLoaded(true);
      return;
    }
    const rows = (data ?? []) as ChatThread<M>[];
    const active = rows.find((r) => !r.archived) ?? null;
    idRef.current = active?.id ?? null;
    setCurrent(active);
    setMessagesState(active?.messages ?? []);
    setHistory(rows.filter((r) => r.archived));
    setLoaded(true);
  }, [kind, ref]);

  useEffect(() => {
    setLoaded(false);
    setMessagesState([]);
    setCurrent(null);
    setHistory([]);
    idRef.current = null;
    load();
  }, [load]);

  /** Replace the open conversation's messages and save them. */
  const setMessages = useCallback(
    async (next: M[]) => {
      setMessagesState(next);
      if (!ref || next.length === 0) return;
      const now = new Date().toISOString();
      if (!idRef.current) idRef.current = crypto.randomUUID();
      const row = {
        id: idRef.current,
        kind,
        ref_id: ref,
        title: opts.title ?? null,
        messages: next,
        archived: false,
        updated_at: now
      };
      const { data } = await supabase.from('chat_threads').upsert(row).select('*').single();
      if (data) setCurrent(data as ChatThread<M>);
    },
    [kind, ref, opts.title]
  );

  const summarize = useCallback(
    async (thread: ChatThread<M> | null) => {
      if (!thread || (thread.messages?.length ?? 0) < 2) return null;
      setSummarizing(thread.id);
      setError(null);
      const { data, error: err } = await invokeEdge<ChatSummary>('discuss', {
        mode: 'summary',
        messages: thread.messages.map(plain),
        context: opts.context,
        language: opts.language
      });
      setSummarizing(null);
      if (err || !data) {
        setError(err?.message ?? "Couldn't make a recap right now.");
        return null;
      }
      await supabase.from('chat_threads').update({ summary: data }).eq('id', thread.id);
      setHistory((h) => h.map((t) => (t.id === thread.id ? { ...t, summary: data } : t)));
      setCurrent((c) => (c && c.id === thread.id ? { ...c, summary: data } : c));
      return data;
    },
    [opts.context, opts.language]
  );

  /** File the open chat under history (recap it if it has a few turns) and start fresh. */
  const startOver = useCallback(async () => {
    const open = current;
    setMessagesState([]);
    setCurrent(null);
    idRef.current = null;
    if (!open) return;
    await supabase.from('chat_threads').update({ archived: true }).eq('id', open.id);
    const filed = { ...open, archived: true };
    setHistory((h) => [filed, ...h]);
    if (!open.summary && open.messages.length >= 4) summarize(filed);
  }, [current, summarize]);

  /** Re-open a past chat (the open one, if any, goes to history first). */
  const resume = useCallback(
    async (thread: ChatThread<M>) => {
      if (current && current.messages.length) {
        await supabase.from('chat_threads').update({ archived: true }).eq('id', current.id);
      }
      await supabase.from('chat_threads').update({ archived: false, updated_at: new Date().toISOString() }).eq('id', thread.id);
      await load();
    },
    [current, load]
  );

  const remove = useCallback(async (thread: ChatThread<M>) => {
    await supabase.from('chat_threads').delete().eq('id', thread.id);
    setHistory((h) => h.filter((t) => t.id !== thread.id));
  }, []);

  return { messages, setMessages, current, history, loaded, summarize, summarizing, startOver, resume, remove, error };
}
