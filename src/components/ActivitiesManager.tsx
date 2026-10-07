import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';

type Activity = {
  id: number;
  title: string;
  location: string | null;
  days: string[];
  start_time: string;
  end_time: string;
  starts_on: string;
  ends_on: string;
};

const DAYS: { key: string; label: string; js: number }[] = [
  { key: 'mon', label: 'Mon', js: 1 },
  { key: 'tue', label: 'Tue', js: 2 },
  { key: 'wed', label: 'Wed', js: 3 },
  { key: 'thu', label: 'Thu', js: 4 },
  { key: 'fri', label: 'Fri', js: 5 },
  { key: 'sat', label: 'Sat', js: 6 },
  { key: 'sun', label: 'Sun', js: 0 }
];

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Every session of a weekly activity between two dates (device local time). */
function sessions(a: Omit<Activity, 'id'>): { start: Date; end: Date }[] {
  const out: { start: Date; end: Date }[] = [];
  const wanted = new Set(DAYS.filter((d) => a.days.includes(d.key)).map((d) => d.js));
  const [sh, sm] = a.start_time.split(':').map(Number);
  const [eh, em] = a.end_time.split(':').map(Number);
  const cur = new Date(`${a.starts_on}T00:00:00`);
  const last = new Date(`${a.ends_on}T00:00:00`);
  for (let i = 0; cur <= last && i < 400; i++) {
    if (wanted.has(cur.getDay())) {
      const s = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), sh, sm);
      const e = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), eh, em);
      if (e <= s) e.setDate(e.getDate() + 1);
      out.push({ start: s, end: e });
    }
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** CCAs and other weekly activities added by hand; sessions appear in the calendar like classes. */
export const ActivitiesManager: React.FC = () => {
  const { currentUser, refreshFromSupabase, showToast } = useApp();
  const [list, setList] = useState<Activity[]>([]);
  const [open, setOpen] = useState(false);
  const today = new Date();
  const [form, setForm] = useState({
    title: '',
    location: '',
    days: [] as string[],
    start_time: '19:00',
    end_time: '21:00',
    starts_on: isoDate(today),
    ends_on: isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7 * 13))
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!currentUser?.id) return;
    const { data } = await supabase.from('activities').select('*').eq('user_id', currentUser.id).order('created_at');
    setList((data ?? []) as Activity[]);
  };
  useEffect(() => {
    load();
  }, [currentUser?.id]);

  const save = async () => {
    if (!currentUser?.id) return;
    if (!form.title.trim() || !form.days.length) return showToast('Add a name and at least one day.');
    if (form.ends_on < form.starts_on) return showToast('The end date is before the start date.');
    setSaving(true);
    const { data: act, error } = await supabase
      .from('activities')
      .insert({ ...form, title: form.title.trim(), location: form.location.trim() || null, user_id: currentUser.id })
      .select('*')
      .single();
    if (error || !act) {
      setSaving(false);
      return showToast(`Couldn't save: ${error?.message}`);
    }
    const rows = sessions(form).map(({ start, end }) => ({
      user_id: currentUser.id,
      external_id: `act:${act.id}|${start.toISOString()}`,
      course: form.title.trim(),
      title: form.title.trim(),
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      location: form.location.trim() || null,
      source: 'activity'
    }));
    const { error: cErr } = rows.length ? await supabase.from('classes').insert(rows) : { error: null };
    setSaving(false);
    if (cErr) return showToast(`Saved, but sessions failed: ${cErr.message}`);
    showToast(`${form.title.trim()} added: ${rows.length} sessions`);
    setOpen(false);
    setForm({ ...form, title: '', location: '', days: [] });
    await load();
    await refreshFromSupabase();
  };

  const remove = async (a: Activity) => {
    await supabase.from('classes').delete().like('external_id', `act:${a.id}|%`);
    await supabase.from('activities').delete().eq('id', a.id);
    setList((l) => l.filter((x) => x.id !== a.id));
    await refreshFromSupabase();
  };

  return (
    <section className="space-y-3 border-t border-gray-100 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900">CCAs & weekly activities</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Practices, rehearsals, part-time shifts. Shown in your calendar and "Next class". Cancel or move one session from
            the calendar.
          </p>
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="px-3 py-2 rounded-lg bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] text-xs font-bold">
            + Add activity
          </button>
        )}
      </div>

      {open && (
        <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-gray-900 flex flex-col gap-1">
              Name
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Dance practice" className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-normal" />
            </label>
            <label className="text-xs font-semibold text-gray-900 flex flex-col gap-1">
              Place (optional)
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Sports Hall" className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-normal" />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days">
            {DAYS.map((d) => {
              const on = form.days.includes(d.key);
              return (
                <button
                  key={d.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setForm({ ...form, days: on ? form.days.filter((x) => x !== d.key) : [...form.days, d.key] })}
                  className={`w-12 py-1.5 rounded-lg border text-xs font-semibold ${on ? 'border-[#D4A94F] bg-amber-50 text-gray-900' : 'border-gray-300 bg-white text-gray-600'}`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                ['start_time', 'From', 'time'],
                ['end_time', 'To', 'time'],
                ['starts_on', 'Starting', 'date'],
                ['ends_on', 'Until', 'date']
              ] as const
            ).map(([k, label, type]) => (
              <label key={k} className="text-xs font-semibold text-gray-900 flex flex-col gap-1">
                {label}
                <input type={type} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="px-2 py-2 rounded-lg border border-gray-300 text-sm font-normal" />
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold bg-white">
              Cancel
            </button>
            <button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] text-sm font-bold disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {list.map((a) => (
        <div key={a.id} className="flex items-center justify-between gap-2 p-3 rounded-xl border border-gray-200 text-sm">
          <div>
            <p className="font-semibold text-gray-900">{a.title}</p>
            <p className="text-xs text-gray-500">
              {DAYS.filter((d) => a.days.includes(d.key)).map((d) => d.label).join(', ')} · {a.start_time.slice(0, 5)}–{a.end_time.slice(0, 5)}
              {a.location ? ` · ${a.location}` : ''} · until {new Date(`${a.ends_on}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' })}
            </p>
          </div>
          <button type="button" onClick={() => remove(a)} className="text-xs text-gray-500 hover:text-red-700">
            Remove
          </button>
        </div>
      ))}
    </section>
  );
};
