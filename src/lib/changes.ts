import { supabase } from './supabase';

/**
 * Student-confirmed changes. Marked as manual so a later calendar sync
 * never silently undoes them.
 */
export async function changeDeadline(id: string, action: 'move' | 'cancel', newStart?: string | null) {
  const patch =
    action === 'cancel'
      ? { status: 'cancelled', manual_override: true }
      : { due_date: newStart, manual_override: true };
  const { error } = await supabase.from('deadlines').update(patch).eq('id', id);
  return error?.message ?? null;
}

export async function changeClass(
  cls: { id: string | number; external_id: string; starts_at: string; ends_at: string | null },
  action: 'move' | 'cancel',
  newStart?: string | null,
  newEnd?: string | null
) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return 'Please sign in again.';
  const end =
    newEnd ??
    (newStart && cls.ends_at
      ? new Date(new Date(newStart).getTime() + (new Date(cls.ends_at).getTime() - new Date(cls.starts_at).getTime())).toISOString()
      : null);

  const { error: oErr } = await supabase.from('class_overrides').upsert(
    {
      user_id: auth.user.id,
      external_id: cls.external_id,
      action,
      new_starts_at: action === 'move' ? newStart : null,
      new_ends_at: action === 'move' ? end : null
    },
    { onConflict: 'user_id,external_id' }
  );
  if (oErr) return oErr.message;

  const { error } =
    action === 'cancel'
      ? await supabase.from('classes').delete().eq('id', cls.id)
      : await supabase.from('classes').update({ starts_at: newStart, ends_at: end }).eq('id', cls.id);
  return error?.message ?? null;
}

/** ISO -> value for <input type="datetime-local"> in the device's time zone */
export const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
