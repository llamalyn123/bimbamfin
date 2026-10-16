import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import type { CaseRow } from './CaseStudies';

type Kind = 'source' | 'case';
type Row = {
  key: string;
  kind: Kind;
  id: string | number;
  path: string;
  name: string;
  course: string;
  week: string;
  newKind: Kind;
  newCourse: string;
  newWeek: string;
  saving?: boolean;
};

const fileName = (path: string) => {
  const raw = (path || '').split('/').pop() || 'file';
  try {
    return decodeURIComponent(raw.replace(/^\d{10,}-/, ''));
  } catch {
    return raw.replace(/^\d{10,}-/, '');
  }
};
const mediaType = (name: string) =>
  /\.pptx$/i.test(name)
    ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    : /\.docx$/i.test(name)
    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : /\.pdf$/i.test(name)
    ? 'application/pdf'
    : /\.png$/i.test(name)
      ? 'image/png'
      : /\.jpe?g$/i.test(name)
        ? 'image/jpeg'
        : /\.webp$/i.test(name)
          ? 'image/webp'
          : 'text/plain';

const WEEKS = Array.from({ length: 16 }, (_, i) => String(i + 1));

/**
 * Fix files after upload: change week, switch Course material <-> Case study,
 * move to another course, or delete. The file itself stays where it is in storage;
 * only its label row changes (except Delete, which removes the file too).
 */
export const ManageMaterialsModal: React.FC<{
  open: boolean;
  onClose: () => void;
  course: string;
  cases: CaseRow[];
  onChanged: () => void;
}> = ({ open, onClose, course, cases, onChanged }) => {
  const { sources, notes, refreshFromSupabase, showToast } = useApp();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState<string[]>([]);

  const notedWeeks = useMemo(
    () => new Set(notes.map((n) => `${String(n.course).toUpperCase()}|${Number(n.week)}`)),
    [notes]
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    const code = course.toUpperCase();
    const src: Row[] = sources
      .filter((s) => String(s.course).toUpperCase() === code)
      .sort((a, b) => Number(a.week) - Number(b.week))
      .map((s) => ({
        key: `s-${s.id}`,
        kind: 'source',
        id: s.id,
        path: s.file_url,
        name: fileName(s.file_url),
        course: code,
        week: String(Number(s.week) || ''),
        newKind: 'source',
        newCourse: code,
        newWeek: String(Number(s.week) || '')
      }));
    const cs: Row[] = cases
      .filter((c) => String(c.course).toUpperCase() === code)
      .map((c) => ({
        key: `c-${c.id}`,
        kind: 'case',
        id: c.id,
        path: c.file_path,
        name: c.title || fileName(c.file_path),
        course: code,
        week: c.week ? String(c.week) : '',
        newKind: 'case',
        newCourse: code,
        newWeek: c.week ? String(c.week) : ''
      }));
    setRows([...src, ...cs]);
  }, [open, course, sources, cases]);

  useEffect(() => {
    if (open) setStale([]);
  }, [open]);

  if (!open) return null;

  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const changed = (r: Row) =>
    r.newKind !== r.kind || r.newCourse.trim().toUpperCase() !== r.course || r.newWeek !== r.week;

  // A material leaving or joining a week makes that week's note out of date
  const markStale = (r: Row, removed = false) => {
    const hits: string[] = [];
    const before = r.kind === 'source' && r.week ? `${r.course}|${Number(r.week)}` : null;
    const after =
      !removed && r.newKind === 'source' && r.newWeek ? `${r.newCourse.trim().toUpperCase()}|${Number(r.newWeek)}` : null;
    if (before !== after) {
      for (const k of [before, after]) if (k && notedWeeks.has(k)) hits.push(k.replace('|', ' · Week '));
    }
    if (hits.length) setStale((s) => Array.from(new Set([...s, ...hits])));
  };

  const finish = async () => {
    await refreshFromSupabase();
    onChanged();
  };

  const save = async (r: Row) => {
    setError(null);
    const code = r.newCourse.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9 _-]{1,15}$/.test(code)) return setError('Enter a course like IS112.');
    if (r.newKind === 'source' && !r.newWeek) return setError(`Pick a week for "${r.name}". Course materials need one.`);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return setError('Please sign in again.');
    const weekNum = r.newWeek ? Number(r.newWeek) : null;
    patch(r.key, { saving: true });

    let err: { message: string } | null = null;
    if (r.newKind === r.kind) {
      const res =
        r.kind === 'source'
          ? await supabase.from('sources').update({ course: code, week: weekNum }).eq('id', r.id).select('id')
          : await supabase.from('cases').update({ course: code, week: weekNum }).eq('id', r.id).select('id');
      err = res.error ?? (res.data && res.data.length === 0 ? { message: 'Not allowed to change this file.' } : null);
    } else if (r.newKind === 'case') {
      const ins = await supabase.from('cases').insert({
        user_id: auth.user.id,
        course: code,
        week: weekNum,
        title: r.name.replace(/\.[^.]+$/, ''),
        file_path: r.path,
        media_type: mediaType(r.path)
      });
      err = ins.error;
      if (!err) err = (await supabase.from('sources').delete().eq('id', r.id)).error;
    } else {
      const ins = await supabase.from('sources').insert({
        user_id: auth.user.id,
        course: code,
        week: weekNum,
        file_url: r.path,
        upload_method: 'upload'
      });
      err = ins.error;
      if (!err) err = (await supabase.from('cases').delete().eq('id', r.id)).error;
    }

    patch(r.key, { saving: false });
    if (err) return setError(`Couldn't save "${r.name}": ${err.message}`);
    markStale(r);
    showToast(`Saved "${r.name}"`);
    await finish();
  };

  const remove = async (r: Row) => {
    if (!window.confirm(`Delete "${r.name}"? This removes the file too.`)) return;
    setError(null);
    patch(r.key, { saving: true });
    const del =
      r.kind === 'source'
        ? await supabase.from('sources').delete().eq('id', r.id)
        : await supabase.from('cases').delete().eq('id', r.id);
    if (del.error) {
      patch(r.key, { saving: false });
      return setError(`Couldn't delete "${r.name}": ${del.error.message}`);
    }
    await supabase.storage.from('sources').remove([r.path]); // best effort
    markStale(r, true);
    showToast(`Deleted "${r.name}"`);
    await finish();
  };

  const select = 'px-2 py-1.5 rounded-lg border border-[#C9D1DB] bg-white text-sm text-[#0E0E12]';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Manage files"
        className="w-full max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-3 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#0E0E12]">Manage files · {course}</h2>
            <p className="text-xs text-[#64748B]">Wrong week or type? Change it here, then Save.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {stale.length > 0 && (
          <div className="p-3 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] text-sm text-[#0E0E12] flex gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#B47B16]">refresh</span>
            <span>
              Regenerate these notes so they match the files: <b>{stale.join(', ')}</b>
            </span>
          </div>
        )}
        {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

        {rows.length === 0 && <p className="text-sm text-[#64748B] py-6 text-center">No files in this course yet.</p>}

        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.key} className="p-3 rounded-xl border border-[#C9D1DB] flex flex-col gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[18px] text-[#64748B]">
                  {r.kind === 'case' ? 'cases' : 'description'}
                </span>
                <span className="text-sm font-semibold text-[#0E0E12] truncate" title={r.name}>
                  {r.name}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`${r.key}-kind`}>Type</label>
                <select
                  id={`${r.key}-kind`}
                  className={select}
                  value={r.newKind}
                  onChange={(e) => {
                    const k = e.target.value as Kind;
                    patch(r.key, { newKind: k, newWeek: k === 'source' && !r.newWeek ? '1' : r.newWeek });
                  }}
                >
                  <option value="source">Course material</option>
                  <option value="case">Case study</option>
                </select>
                <label className="sr-only" htmlFor={`${r.key}-week`}>Week</label>
                <select
                  id={`${r.key}-week`}
                  className={select}
                  value={r.newWeek}
                  onChange={(e) => patch(r.key, { newWeek: e.target.value })}
                >
                  {r.newKind === 'case' && <option value="">No specific week</option>}
                  {r.newKind === 'source' && !r.newWeek && <option value="">Pick week</option>}
                  {WEEKS.map((w) => (
                    <option key={w} value={w}>
                      Week {w}
                    </option>
                  ))}
                </select>
                <label className="sr-only" htmlFor={`${r.key}-course`}>Course</label>
                <input
                  id={`${r.key}-course`}
                  className={`${select} w-24 uppercase`}
                  value={r.newCourse}
                  onChange={(e) => patch(r.key, { newCourse: e.target.value })}
                  placeholder="Course"
                />
                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    disabled={!changed(r) || r.saving}
                    onClick={() => save(r)}
                    className="px-3 py-1.5 rounded-lg bg-[#D4A94F] text-[#0E0E12] text-sm font-semibold disabled:opacity-40 hover:bg-[#c7993a]"
                  >
                    {r.saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    disabled={r.saving}
                    onClick={() => remove(r)}
                    aria-label={`Delete ${r.name}`}
                    className="px-2 py-1.5 rounded-lg border border-[#C9D1DB] text-red-600 hover:bg-red-50 disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-[#64748B]">
          Moving a file doesn't change existing notes. Regenerate the week's note to update it.
        </p>
      </div>
    </div>
  );
};
