import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { invokeEdge } from '../lib/edge';
import { changeClass, changeDeadline, fmtWhen } from '../lib/changes';

type Proposal = {
  type: 'deadline' | 'class';
  id: string;
  external_id: string | null;
  title: string;
  course: string;
  action: 'move' | 'cancel';
  current_start: string;
  new_start: string | null;
  new_end: string | null;
  quote: string | null;
  unsure: string | null;
};

/** Paste a "class cancelled / deadline extended" message → confirm each proposed change. */
export const PasteUpdateModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { refreshFromSupabase, showToast } = useApp();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [unmatched, setUnmatched] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const close = () => {
    setText('');
    setProposals(null);
    setUnmatched(null);
    setError(null);
    onClose();
  };

  const find = async () => {
    setBusy(true);
    setError(null);
    const { data, error: err } = await invokeEdge('apply-update', { text });
    setBusy(false);
    if (err) return setError(err.message);
    setProposals(data.proposals || []);
    setUnmatched(data.unmatched || null);
  };

  const confirm = async (p: Proposal, idx: number) => {
    const err =
      p.type === 'deadline'
        ? await changeDeadline(p.id, p.action, p.new_start)
        : await changeClass({ id: p.id, external_id: p.external_id!, starts_at: p.current_start, ends_at: null }, p.action, p.new_start, p.new_end);
    if (err) return showToast(`Couldn't apply: ${err}`);
    setProposals((prev) => (prev || []).filter((_, i) => i !== idx));
    showToast('Updated');
    await refreshFromSupabase();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={close}>
      <div
        role="dialog"
        aria-label="Paste a change"
        className="w-full max-w-xl bg-white rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-3 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-headline-sm text-lg font-bold text-[#0E0E12]">Paste a change</h2>
          <button type="button" onClick={close} aria-label="Close" className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {proposals === null ? (
          <>
            <p className="text-xs text-[#64748B]">
              Paste a message from your lecturer or school, e.g. "No class this Friday" or "Assignment 2 extended to 30 Oct".
              Bimbam finds the matching item and asks you to confirm.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              aria-label="Announcement text"
              className="w-full px-3 py-2 rounded-xl border border-[#C9D1DB] text-sm focus:outline-none focus:border-[#D4A94F]"
            />
            {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
            <button
              type="button"
              disabled={busy || text.trim().length < 10}
              onClick={find}
              className="self-end px-5 py-2.5 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] font-bold disabled:opacity-50"
            >
              {busy ? 'Reading…' : 'Find changes'}
            </button>
          </>
        ) : (
          <>
            {proposals.length === 0 && !unmatched && (
              <p className="text-sm text-[#334155]">No changes to your items found in that message.</p>
            )}
            {proposals.map((p, idx) => (
              <div key={`${p.type}-${p.id}`} className="rounded-xl border border-[#C9D1DB] p-4 flex flex-col gap-1.5">
                <p className="text-xs text-[#64748B]">{p.course} · {p.type === 'class' ? 'Class' : 'Deadline'}</p>
                <p className="font-semibold text-[#0E0E12]">{p.title}</p>
                <p className="text-sm text-[#1E293B]">
                  {p.action === 'cancel' ? (
                    <>
                      <span className="line-through text-[#64748B]">{fmtWhen(p.current_start)}</span> → <b>Cancelled</b>
                    </>
                  ) : (
                    <>
                      {fmtWhen(p.current_start)} → <b>{fmtWhen(p.new_start!)}</b>
                    </>
                  )}
                </p>
                {p.quote && <p className="text-xs text-[#64748B]">From the message: “{p.quote}”</p>}
                {p.unsure && (
                  <p className="text-xs text-[#92400E] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">warning</span>
                    {p.unsure}
                  </p>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setProposals((prev) => (prev || []).filter((_, i) => i !== idx))}
                    className="px-3 py-1.5 rounded-lg border border-[#C9D1DB] text-xs font-semibold"
                  >
                    Ignore
                  </button>
                  <button
                    type="button"
                    onClick={() => confirm(p, idx)}
                    className="px-4 py-1.5 rounded-lg bg-[#D4A94F] text-[#0E0E12] text-xs font-bold"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            ))}
            {unmatched && (
              <p className="text-xs text-[#64748B]">Not in your list, so not changed: {unmatched}</p>
            )}
            <button type="button" onClick={close} className="self-end px-4 py-2 rounded-xl border border-[#C9D1DB] text-sm font-semibold">
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
};
