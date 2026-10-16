import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { isImageFile, photoToJpeg } from '../lib/image';

type Kind = 'source' | 'case';
type Staged = { id: string; file: File; kind: Kind; week: string; status: 'ready' | 'uploading' | 'done' | 'error'; error?: string };

const ACCEPT = '.pdf,.pptx,.docx,image/*,.heic,.heif,.txt,.md,.csv';
const OK_TYPES = /\.(pdf|pptx|docx|txt|md|csv)$/i;

const guessWeek = (name: string) => name.match(/\b(?:week|wk|w)[\s_-]*0?(\d{1,2})\b/i)?.[1] ?? '';
const guessKind = (name: string): Kind => (/\bcase\b|case[\s_-]?study/i.test(name) ? 'case' : 'source');
const mediaType = (f: File) =>
  (/\.pptx$/i.test(f.name) ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : /\.docx$/i.test(f.name) ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : '') ||
  f.type ||
  (/\.pdf$/i.test(f.name) ? 'application/pdf' : /\.png$/i.test(f.name) ? 'image/png' : /\.jpe?g$/i.test(f.name) ? 'image/jpeg' : /\.webp$/i.test(f.name) ? 'image/webp' : 'text/plain');

/**
 * Pick one or many files first, then decide for each: which week (or none for a case),
 * and whether it's course material or a case study. Nothing uploads until "Upload".
 */
export const UploadMaterialsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  defaultCourse?: string;
  defaultWeek?: number;
}> = ({ isOpen, onClose, defaultCourse = '', defaultWeek = 1 }) => {
  const { sources, refreshFromSupabase, showToast, logoutUser } = useApp();
  const [course, setCourse] = useState(defaultCourse);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCourse(defaultCourse || '');
      setStaged([]);
      setError(null);
    }
  }, [isOpen, defaultCourse]);

  if (!isOpen) return null;

  const courseOptions = Array.from(new Set(sources.map((s) => s.course).filter(Boolean))).sort();

  const addFiles = async (list: FileList | File[] | null) => {
    if (!list) return;
    const problems: string[] = [];
    const good: File[] = [];
    for (const f of Array.from(list)) {
      if (isImageFile(f)) {
        // Photos (incl. iPhone HEIC) are turned into a small JPEG before upload
        try {
          good.push(await photoToJpeg(f));
        } catch {
          problems.push(
            /\.hei[cf]$/i.test(f.name)
              ? `${f.name}: this browser can't open iPhone HEIC photos. Open Bimbam in Safari, or export the photo as JPG (or take a screenshot of it).`
              : `${f.name}: couldn't open this image. Try a screenshot of it instead.`
          );
        }
      } else if (!OK_TYPES.test(f.name)) {
        problems.push(`${f.name}: use PDF, PowerPoint (.pptx), Word (.docx), photos or text. Old .ppt/.doc files: save as .pptx/.docx first.`);
      } else if (f.size > 20_000_000) {
        problems.push(`${f.name}: too large (max 20 MB).`);
      } else {
        good.push(f);
      }
    }
    setError(problems.length ? `Skipped ${problems.join(' ')}` : null);
    setStaged((prev) => [
      ...prev,
      ...good.map((f) => {
        const kind = guessKind(f.name);
        const w = guessWeek(f.name);
        return {
          id: `${f.name}-${f.size}-${Math.random()}`,
          file: f,
          kind,
          week: w || (kind === 'case' ? '' : String(defaultWeek || 1)),
          status: 'ready' as const
        };
      })
    ]);
  };

  const update = (id: string, patch: Partial<Staged>) => setStaged((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const uploadAll = async () => {
    setError(null);
    const code = course.trim().toUpperCase();
    if (!code) return setError('Enter the course first (e.g. IS112).');
    const missing = staged.filter((s) => s.status !== 'done' && s.kind === 'source' && !s.week);
    if (missing.length) return setError('Pick a week for each course material (case studies can have no week).');

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      showToast('Please sign in again.');
      return logoutUser();
    }
    setBusy(true);
    let ok = 0;
    for (const s of staged) {
      if (s.status === 'done') continue;
      update(s.id, { status: 'uploading', error: undefined });
      const safe = s.file.name.replace(/[^\w.\- ]+/g, '_');
      const path = s.kind === 'case' ? `${auth.user.id}/cases/${Date.now()}-${safe}` : `${auth.user.id}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from('sources').upload(path, s.file, { contentType: mediaType(s.file) });
      if (upErr) {
        update(s.id, { status: 'error', error: upErr.message });
        continue;
      }
      const { error: insErr } =
        s.kind === 'case'
          ? await supabase.from('cases').insert({
              user_id: auth.user.id,
              course: code,
              week: s.week ? Number(s.week) : null,
              title: s.file.name.replace(/\.[^.]+$/, ''),
              file_path: path,
              media_type: mediaType(s.file)
            })
          : await supabase.from('sources').insert({
              user_id: auth.user.id,
              course: code,
              week: Number(s.week),
              file_url: path,
              upload_method: 'upload'
            });
      if (insErr) {
        update(s.id, { status: 'error', error: insErr.message });
        continue;
      }
      update(s.id, { status: 'done' });
      ok++;
    }
    setBusy(false);
    await refreshFromSupabase();
    if (ok) showToast(`${ok} file${ok === 1 ? '' : 's'} added to ${code}`);
    if (ok && staged.every((s) => s.status === 'done' || s.status === 'ready')) onClose();
  };

  const pending = staged.filter((s) => s.status !== 'done');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-label="Add materials"
        className="w-full max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-3 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#0E0E12]">Add materials</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <label className="text-xs font-semibold text-[#0E0E12] flex flex-col gap-1 sm:w-60">
          Course
          <input
            list="upload-courses"
            value={course}
            onChange={(e) => setCourse(e.target.value.toUpperCase())}
            placeholder="e.g. IS112"
            className="px-3 py-2 rounded-lg border border-[#C9D1DB] text-sm font-normal"
          />
          <datalist id="upload-courses">
            {courseOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center justify-center gap-1 p-5 rounded-xl border-2 border-dashed cursor-pointer text-center transition-colors ${
            dragOver ? 'border-[#D4A94F] bg-amber-50' : 'border-[#C9D1DB] hover:border-[#D4A94F]'
          }`}
        >
          <span className="material-symbols-outlined text-[28px] text-[#D4A94F]">upload_file</span>
          <span className="text-sm font-semibold text-[#0E0E12]">Drop files here or click to choose (several at once is fine)</span>
          <span className="text-xs text-[#64748B]">Slides, readings, your notes, case studies · PDF, PowerPoint, Word, photos or text · max 20 MB each</span>
          <input
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>

        {staged.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-[#64748B]">Now choose what each file is and which week it belongs to. Weeks in file names are filled in for you.</p>
            {staged.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-[#E2E8F0]">
                <span className="material-symbols-outlined text-[18px] text-[#64748B]">
                  {s.status === 'done' ? 'check_circle' : s.status === 'error' ? 'error' : s.kind === 'case' ? 'cases' : 'description'}
                </span>
                <span className="flex-1 min-w-[140px] text-sm text-[#0E0E12] truncate" title={s.file.name}>
                  {s.file.name}
                </span>
                <select
                  value={s.kind}
                  disabled={s.status === 'done' || busy}
                  onChange={(e) => update(s.id, { kind: e.target.value as Kind })}
                  aria-label="Type"
                  className="px-2 py-1 rounded-lg border border-[#C9D1DB] text-xs"
                >
                  <option value="source">Course material</option>
                  <option value="case">Case study</option>
                </select>
                <select
                  value={s.week}
                  disabled={s.status === 'done' || busy}
                  onChange={(e) => update(s.id, { week: e.target.value })}
                  aria-label="Week"
                  className="px-2 py-1 rounded-lg border border-[#C9D1DB] text-xs"
                >
                  {s.kind === 'case' ? <option value="">No specific week</option> : <option value="">Pick week…</option>}
                  {Array.from({ length: 16 }, (_, i) => i + 1).map((w) => (
                    <option key={w} value={String(w)}>
                      Week {w}
                    </option>
                  ))}
                </select>
                {s.status !== 'done' && !busy && (
                  <button
                    type="button"
                    onClick={() => setStaged((x) => x.filter((y) => y.id !== s.id))}
                    aria-label={`Remove ${s.file.name}`}
                    className="text-[#64748B] hover:text-red-700"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
                {s.status === 'uploading' && <span className="text-xs text-[#64748B] w-full">Uploading…</span>}
                {s.status === 'error' && <span className="text-xs text-red-700 w-full">{s.error}</span>}
              </div>
            ))}
          </div>
        )}

        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 rounded-xl border border-[#C9D1DB] text-sm font-semibold">
            {staged.some((s) => s.status === 'done') ? 'Done' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={uploadAll}
            disabled={busy || pending.length === 0}
            className="px-5 py-2 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] text-sm font-bold disabled:opacity-50"
          >
            {busy ? 'Uploading…' : `Upload ${pending.length || ''}`.trim()}
          </button>
        </div>
      </div>
    </div>
  );
};
