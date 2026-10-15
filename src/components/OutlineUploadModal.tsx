import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { invokeEdge } from '../lib/edge';
import { toLocalInput } from '../lib/changes';

type Item = {
  title: string;
  type: string;
  weight: number | null;
  due_date: string | null;
  submission: string | null;
  evidence: string | null;
  notes: string[];
};
type Row = Item & { include: boolean; when: string };

const readFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.readAsDataURL(file);
  });

async function toPayload(file: File): Promise<{ data: string; media_type: string }> {
  if (file.type === 'application/pdf') {
    if (file.size > 10_000_000) throw new Error('That PDF is too large (max 10 MB).');
    return { data: (await readFile(file)).split(',')[1], media_type: 'application/pdf' };
  }
  const office = /\.pptx$/i.test(file.name) ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : /\.docx$/i.test(file.name) ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : null;
  if (office) {
    if (file.size > 10_000_000) throw new Error('That file is too large (max 10 MB).');
    return { data: (await readFile(file)).split(',')[1], media_type: office };
  }
  if (!file.type.startsWith('image/')) throw new Error('Upload a PDF, Word (.docx), PowerPoint (.pptx) or an image.');
  const url = await readFile(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const el = new Image();
    el.onload = () => res(el);
    el.onerror = () => rej(new Error("Couldn't open that image."));
    el.src = url;
  });
  const scale = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return { data: c.toDataURL('image/jpeg', 0.9).split(',')[1], media_type: 'image/jpeg' };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const TYPES = ['assignment', 'quiz', 'exam', 'presentation', 'project', 'report', 'participation', 'other'];

/** Upload a course outline → every assessment becomes a deadline (after the student checks it). */
export const OutlineUploadModal: React.FC<{ open: boolean; onClose: () => void; defaultCourse?: string }> = ({
  open,
  onClose,
  defaultCourse = ''
}) => {
  const { currentUser, sources, deadlines, refreshFromSupabase, showToast } = useApp();
  const [course, setCourse] = useState(defaultCourse);
  const [week1, setWeek1] = useState('');
  const [recess, setRecess] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setCourse(defaultCourse);
    try {
      setWeek1(localStorage.getItem('bimbam-week1') || '');
      setRecess(localStorage.getItem('bimbam-recess') || '');
    } catch {
      /* ignore */
    }
  }, [open, defaultCourse]);

  if (!open) return null;

  const close = () => {
    setRows(null);
    setFile(null);
    setText('');
    setError(null);
    onClose();
  };

  const courseOptions = Array.from(new Set([...sources.map((s) => s.course), ...deadlines.map((d) => d.course)].filter(Boolean))).sort();

  const read = async () => {
    setError(null);
    if (!course.trim()) return setError('Enter the course code.');
    if (!week1) return setError('Pick the Monday of Week 1 (needed to turn "Week 10" into a date).');
    try {
      localStorage.setItem('bimbam-week1', week1);
      localStorage.setItem('bimbam-recess', recess);
    } catch {
      /* ignore */
    }
    setBusy(true);
    let payload: { data: string; media_type: string } | undefined;
    try {
      payload = file ? await toPayload(file) : undefined;
    } catch (e: any) {
      setBusy(false);
      return setError(e.message);
    }
    const { data, error: err } = await invokeEdge('extract-outline', {
      course: course.trim(),
      week1_monday: week1,
      recess_after_week: recess ? Number(recess) : null,
      ...(payload ? { file: payload } : { text })
    });
    setBusy(false);
    if (err) return setError(err.message);
    setCourse(data.course);
    setRows(
      (data.items as Item[]).map((it) => ({
        ...it,
        include: Boolean(it.due_date),
        when: it.due_date ? toLocalInput(it.due_date) : ''
      }))
    );
  };

  const save = async () => {
    if (!rows || !currentUser?.id) return;
    const chosen = rows.filter((r) => r.include && r.when);
    if (!chosen.length) return showToast('Tick at least one item with a date.');
    setBusy(true);
    const code = course.trim().toUpperCase();
    const mk = (r: Row) => ({
      user_id: currentUser.id,
      external_id: `outline:${code}:${slug(r.title)}`,
      title: r.title,
      course: code,
      due_date: new Date(r.when).toISOString(),
      type: r.type,
      weight: r.weight,
      notes: [r.submission ? `Submit: ${r.submission}` : '', r.evidence ? `Outline: “${r.evidence}”` : ''].filter(Boolean).join(' · ') || null,
      source: 'outline',
      last_updated: new Date().toISOString()
    });
    // Re-uploading the same outline updates items without un-ticking finished ones
    const { data: existing } = await supabase
      .from('deadlines')
      .select('external_id')
      .eq('user_id', currentUser.id)
      .like('external_id', `outline:${code}:%`);
    const have = new Set((existing ?? []).map((e: any) => e.external_id));
    const all = chosen.map(mk);
    const fresh = all.filter((r) => !have.has(r.external_id)).map((r) => ({ ...r, status: 'pending' }));
    const update = all.filter((r) => have.has(r.external_id));
    const e1 = fresh.length ? (await supabase.from('deadlines').insert(fresh)).error : null;
    const e2 = update.length ? (await supabase.from('deadlines').upsert(update, { onConflict: 'user_id,external_id' })).error : null;
    setBusy(false);
    if (e1 || e2) return showToast(`Couldn't save: ${(e1 || e2)!.message}`);
    showToast(`${all.length} deadlines saved for ${code}`);
    await refreshFromSupabase();
    close();
  };

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs!.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={close}>
      <div
        role="dialog"
        aria-label="Upload course outline"
        className="w-full max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-3 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#0E0E12]">Upload course outline</h2>
          <button type="button" onClick={close} aria-label="Close" className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {!rows ? (
          <>
            <p className="text-xs text-[#64748B]">
              Bimbam reads the assessment section and turns every graded item into a deadline. You check each one before
              it's saved.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="text-xs font-semibold text-[#0E0E12] flex flex-col gap-1">
                Course code
                <input
                  list="outline-courses"
                  value={course}
                  onChange={(e) => setCourse(e.target.value.toUpperCase())}
                  placeholder="e.g. IS112"
                  className="px-3 py-2 rounded-lg border border-[#C9D1DB] text-sm font-normal"
                />
                <datalist id="outline-courses">
                  {courseOptions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label className="text-xs font-semibold text-[#0E0E12] flex flex-col gap-1">
                Monday of Week 1
                <input type="date" value={week1} onChange={(e) => setWeek1(e.target.value)} className="px-3 py-2 rounded-lg border border-[#C9D1DB] text-sm font-normal" />
              </label>
              <label className="text-xs font-semibold text-[#0E0E12] flex flex-col gap-1">
                Recess week after week (optional)
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={recess}
                  onChange={(e) => setRecess(e.target.value)}
                  placeholder="e.g. 7"
                  className="px-3 py-2 rounded-lg border border-[#C9D1DB] text-sm font-normal"
                />
              </label>
            </div>

            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-[#C9D1DB] hover:border-[#D4A94F] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[28px] text-[#D4A94F]">upload_file</span>
              <span className="text-sm text-[#334155] flex-1">
                {file ? <b>{file.name}</b> : <><b>Drop the outline (PDF, Word, PowerPoint or photo)</b> or click to choose</>}
              </span>
              <input
                type="file"
                accept="application/pdf,image/*,.docx,.pptx"
                className="hidden"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
              />
            </label>
            {!file && (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder="…or paste the assessment section here"
                aria-label="Outline text"
                className="w-full px-3 py-2 rounded-xl border border-[#C9D1DB] text-sm"
              />
            )}
            {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
            <button
              type="button"
              onClick={read}
              disabled={busy || (!file && text.trim().length < 40)}
              className="self-end px-5 py-2.5 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] font-bold disabled:opacity-50"
            >
              {busy ? 'Reading the outline…' : 'Find deadlines'}
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-[#64748B]">
              {course}: tick what to save and fix any date. Items without a date in the outline are unticked.
            </p>
            {rows.map((r, i) => (
              <div key={i} className={`rounded-xl border p-3 flex flex-col gap-2 ${r.include ? 'border-[#D4A94F]' : 'border-[#E2E8F0]'}`}>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={r.include}
                    onChange={(e) => setRow(i, { include: e.target.checked })}
                    aria-label={`Save ${r.title}`}
                    className="mt-1 w-4 h-4"
                  />
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <input
                      value={r.title}
                      onChange={(e) => setRow(i, { title: e.target.value })}
                      aria-label="Title"
                      className="font-semibold text-[#0E0E12] border-b border-transparent focus:border-[#D4A94F] focus:outline-none"
                    />
                    <div className="flex flex-wrap gap-2 items-center">
                      <input
                        type="datetime-local"
                        value={r.when}
                        onChange={(e) => setRow(i, { when: e.target.value, include: Boolean(e.target.value) || r.include })}
                        aria-label="Due"
                        className="px-2 py-1 rounded-lg border border-[#C9D1DB] text-xs"
                      />
                      <select
                        value={r.type}
                        onChange={(e) => setRow(i, { type: e.target.value })}
                        aria-label="Type"
                        className="px-2 py-1 rounded-lg border border-[#C9D1DB] text-xs"
                      >
                        {TYPES.map((tp) => (
                          <option key={tp} value={tp}>
                            {tp}
                          </option>
                        ))}
                      </select>
                      {r.weight !== null && <span className="text-xs font-semibold text-[#475569]">{r.weight}%</span>}
                      {r.submission && <span className="text-xs text-[#64748B]">Submit: {r.submission}</span>}
                    </div>
                    {!r.when && <p className="text-xs text-[#64748B]">No date in the outline. Add one to save it.</p>}
                    {r.evidence && <p className="text-xs text-[#64748B]">From the outline: “{r.evidence}”</p>}
                    {r.notes.map((n) => (
                      <p key={n} className="text-xs text-[#92400E] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">info</span>
                        {n}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRows(null)} className="px-4 py-2 rounded-xl border border-[#C9D1DB] text-sm font-semibold">
                Back
              </button>
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="px-5 py-2 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] text-sm font-bold disabled:opacity-50"
              >
                {busy ? 'Saving…' : `Save ${rows.filter((r) => r.include && r.when).length} deadlines`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
