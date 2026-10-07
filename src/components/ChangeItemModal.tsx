import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { changeClass, changeDeadline, fmtWhen, toLocalInput } from '../lib/changes';

export type EditableItem =
  | { type: 'deadline'; id: string; title: string; course: string; start: string }
  | { type: 'class'; id: string | number; external_id: string; title: string; course: string; start: string; end: string | null };

/** Two taps: "Moved" (pick new date/time) or "Cancelled". */
export const ChangeItemModal: React.FC<{ item: EditableItem | null; onClose: () => void }> = ({ item, onClose }) => {
  const { refreshFromSupabase, showToast } = useApp();
  const [mode, setMode] = useState<'move' | 'cancel'>('move');
  const [when, setWhen] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setMode('move');
      setWhen(toLocalInput(item.start));
    }
  }, [item]);

  if (!item) return null;

  const save = async () => {
    setSaving(true);
    const newStart = mode === 'move' ? new Date(when).toISOString() : null;
    const err =
      item.type === 'deadline'
        ? await changeDeadline(item.id, mode, newStart)
        : await changeClass({ id: item.id, external_id: item.external_id, starts_at: item.start, ends_at: item.end }, mode, newStart);
    setSaving(false);
    if (err) return showToast(`Couldn't save: ${err}`);
    showToast(mode === 'cancel' ? `${item.title} cancelled` : `${item.title} moved to ${fmtWhen(newStart!)}`);
    await refreshFromSupabase();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`Change ${item.title}`}
        className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-xs text-[#64748B]">{item.course} · {item.type === 'class' ? 'Class' : 'Deadline'}</p>
          <h2 className="font-headline-sm text-lg font-bold text-[#0E0E12]">{item.title}</h2>
          <p className="text-xs text-[#64748B]">Currently {fmtWhen(item.start)}</p>
        </div>

        <div className="flex gap-2" role="radiogroup" aria-label="What changed">
          {(['move', 'cancel'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`flex-1 px-3 py-2 rounded-xl border text-sm font-semibold ${
                mode === m ? 'border-[#D4A94F] bg-amber-50 text-[#0E0E12]' : 'border-[#C9D1DB] bg-white text-[#475569]'
              }`}
            >
              {m === 'move' ? 'Moved' : 'Cancelled'}
            </button>
          ))}
        </div>

        {mode === 'move' ? (
          <label className="flex flex-col gap-1 text-xs font-semibold text-[#0E0E12]">
            New date and time
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#C9D1DB] text-sm font-normal"
            />
          </label>
        ) : (
          <p className="text-sm text-[#334155]">
            {item.type === 'class'
              ? 'This session will be hidden. Other weeks stay as they are.'
              : "This deadline will be hidden and won't remind you."}
          </p>
        )}

        <p className="text-[11px] text-[#64748B]">Your change is kept even when your school calendar syncs again.</p>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-[#C9D1DB] text-sm font-semibold">
            Close
          </button>
          <button
            type="button"
            disabled={saving || (mode === 'move' && !when)}
            onClick={save}
            className="px-4 py-2 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] text-sm font-bold disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
