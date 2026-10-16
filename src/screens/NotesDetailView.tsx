import { savedDifficulty } from '../components/QuizBuilder';
import { Capy } from '../components/Capy';
import { CapyError } from '../components/CapyStates';
import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { invokeEdge, EdgeError } from '../lib/edge';
import { GoDeeper } from '../components/GoDeeper';
import { DiscussPanel } from '../components/DiscussPanel';

type Point = { text: string; text_en?: string; source_ids?: unknown[]; location?: string };
type Concept = {
  id?: string;
  heading?: string;
  heading_en?: string;
  explanation?: string;
  explanation_en?: string;
  points?: Point[];
  source?: string; // older notes
};
type Flag = { type: 'contradiction' | 'sparse' | 'unclear'; message: string; message_en?: string; source_ids?: unknown[] };
type NoteContent = {
  title?: string;
  title_en?: string;
  summary?: string;
  summary_en?: string;
  concepts?: Concept[];
  flags?: Flag[];
  sources?: { id: unknown; label: string; name: string }[];
  skipped?: { name: string; reason: string }[];
  user_additions?: { text: string; at: string }[];
};

const FLAG_LABEL: Record<string, { label: string; icon: string }> = {
  contradiction: { label: 'Sources disagree', icon: 'compare_arrows' },
  sparse: { label: 'Not much detail here', icon: 'help' },
  unclear: { label: "Couldn't read clearly", icon: 'visibility_off' }
};

const parseContent = (raw: unknown): NoteContent | null => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw as NoteContent;
  try {
    return JSON.parse(String(raw)) as NoteContent;
  } catch {
    return null;
  }
};

const fileLabel = (fileUrl: string) =>
  decodeURIComponent((String(fileUrl || '').split('/').pop() || 'Source').replace(/^\d{10,}-/, ''));

const StudyLamp: React.FC = () => (
  <svg width="40" height="56" viewBox="0 0 46 64" aria-hidden="true">
    <path d="M14 22 L40 64 H-2 Z" fill="#FDE68A" opacity="0.4" />
    <path d="M6 6 h18 l5 14 h-28z" fill="#D4A94F" stroke="#92400E" strokeWidth="1" />
    <path d="M15 20 v38" stroke="#64748B" strokeWidth="2.5" />
    <rect x="5" y="57" width="20" height="5" rx="2" fill="#64748B" />
  </svg>
);

export const NotesDetailView: React.FC = () => {
  const {
    setActiveScreen,
    t,
    language,
    showEnglishSubtitles,
    selectedCourse,
    selectedWeek,
    notes,
    sources,
    setQuiz,
    refreshFromSupabase,
    showToast,
    logoutUser
  } = useApp();

  const [isGenerating, setIsGenerating] = useState(false);
  const [justMade, setJustMade] = useState(false);
  const [isQuizzing, setIsQuizzing] = useState(false);
  const [error, setError] = useState<EdgeError | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [newAddition, setNewAddition] = useState('');
  const [savingAddition, setSavingAddition] = useState(false);

  const course = selectedCourse;
  const week = selectedWeek;

  const noteRow = notes.find((n) => n.course === course && String(n.week) === String(week)) as any;
  const content = useMemo(() => parseContent(noteRow?.content), [noteRow]);
  const weekSources = sources.filter((s) => s.course === course && String(s.week) === String(week));
  const subtitles = language !== 'en' && showEnglishSubtitles;

  // source id -> "S1" label + file name, for the little tags on each point
  const sourceMap = useMemo(() => {
    const map = new Map<string, { label: string; name: string }>();
    (content?.sources || []).forEach((s) => map.set(String(s.id), { label: s.label, name: s.name }));
    return map;
  }, [content]);

  // Reading level for generated notes: Simple (default, plain words) or Standard
  const [level, setLevelState] = useState<'simple' | 'standard'>(() => {
    try {
      return localStorage.getItem('bimbam_note_level') === 'standard' ? 'standard' : 'simple';
    } catch {
      return 'simple';
    }
  });
  const setLevel = (l: 'simple' | 'standard') => {
    setLevelState(l);
    try {
      localStorage.setItem('bimbam_note_level', l);
    } catch {
      /* ignore */
    }
  };
  const LevelPicker = () => (
    <div className="flex flex-col items-center gap-1">
      <div className="inline-flex rounded-xl border border-[#C9D1DB] p-0.5 bg-white" role="radiogroup" aria-label="Reading level">
        {(['simple', 'standard'] as const).map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={level === l}
            onClick={() => setLevel(l)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold ${level === l ? 'bg-[#0E0E12] text-white' : 'text-[#475569]'}`}
          >
            {l === 'simple' ? 'Simple words' : 'Standard'}
          </button>
        ))}
      </div>
      <span className="text-[11px] text-[#64748B]">
        {level === 'simple' ? 'Short sentences, everyday words, one example per idea.' : 'Full university-level detail.'}
      </span>
    </div>
  );

  const generate = async () => {
    setIsGenerating(true);
    setError(null);
    const { data, error: err } = await invokeEdge('generate-note', { course, week, language, level });
    setIsGenerating(false);
    if (err) {
      if (err.code === 'UNAUTHENTICATED') return logoutUser();
      return setError(err);
    }
    setRemaining(data?.remaining_today ?? null);
    await refreshFromSupabase();
    showToast('Master note ready');
    setJustMade(true);
    window.setTimeout(() => setJustMade(false), 7000);
  };

  const startQuiz = async () => {
    if (!noteRow?.id) return;
    setIsQuizzing(true);
    setError(null);
    const { data, error: err } = await invokeEdge('generate-quiz', { note_id: noteRow.id, num_questions: 5, language, difficulty: savedDifficulty() });
    setIsQuizzing(false);
    if (err) return setError(err);
    setQuiz(data.quiz);
    setActiveScreen('quiz');
  };

  const saveAddition = async () => {
    const text = newAddition.trim();
    if (!text || !noteRow?.id || !content) return;
    setSavingAddition(true);
    const updated = { ...content, user_additions: [...(content.user_additions || []), { text, at: new Date().toISOString() }] };
    const { error: err } = await supabase.from('notes').update({ content: updated }).eq('id', noteRow.id);
    setSavingAddition(false);
    if (err) return showToast(`Couldn't save your note: ${err.message}`);
    setNewAddition('');
    await refreshFromSupabase();
  };

  const Sub = ({ text, main }: { text?: string; main?: string }) =>
    subtitles && text && text !== main ? <p className="text-xs text-[#64748B] mt-0.5 italic">{text}</p> : null;

  return (
    <div className="flex flex-col w-full pb-20 gap-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-[#C9D1DB] pb-3">
        <button
          type="button"
          onClick={() => setActiveScreen('notes')}
          className="flex items-center gap-1.5 text-body-sm font-semibold text-[#0E0E12] hover:text-[#B47B16] transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Back to courses</span>
        </button>
        <span className="text-xs text-[#64748B] font-medium">
          {course} · Week {week}
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* MAIN: the note */}
        <main className="xl:col-span-8 flex flex-col gap-4 min-w-0">
          {error && (
            <div className="flex flex-col gap-2">
              <CapyError message={error.message} code={error.code} />
              {error.skipped && error.skipped.length > 0 && (
                <ul className="text-xs text-red-800 pl-7 list-disc">
                  {error.skipped.map((s) => (
                    <li key={s.name}>
                      {s.name}: {s.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {isGenerating ? (
            <div className="bg-white rounded-2xl border border-[#C9D1DB] p-10 flex flex-col items-center gap-3 text-center">
              <div className="flex items-end justify-center rounded-xl bg-[#FFFBEB] px-6 pt-3">
                <StudyLamp />
                <Capy size={96} mood="study" />
              </div>
              <p className="font-headline-sm font-bold text-[#0E0E12]">Capy is reading your slides…</p>
              <p className="text-xs text-[#64748B]">Building your master note and linking every point to its source. This can take up to a minute.</p>
            </div>
          ) : !content ? (
            <div className="bg-white rounded-2xl border border-[#C9D1DB] p-10 flex flex-col items-center gap-3 text-center">
              <span className="material-symbols-outlined text-[40px] text-[#D97706]">auto_stories</span>
              <h2 className="font-headline-lg text-2xl font-bold text-[#0E0E12]">No master note for this week yet</h2>
              <p className="font-body-md text-[#64748B] max-w-md">
                {weekSources.length
                  ? `Bimbam will combine your ${weekSources.length} ${weekSources.length === 1 ? 'source' : 'sources'} into one note, with every point linked to where it came from.`
                  : 'Add at least one source for this week first.'}
              </p>
              {weekSources.length > 0 && <LevelPicker />}
              {weekSources.length > 0 ? (
                <button
                  type="button"
                  onClick={generate}
                  className="mt-1 px-6 py-3 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] font-bold shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  Generate note
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveScreen('notes')}
                  className="mt-1 px-5 py-2.5 rounded-xl bg-white border border-[#C9D1DB] font-semibold text-[#0E0E12] hover:bg-slate-50"
                >
                  Add a source
                </button>
              )}
              {remaining !== null && <p className="text-xs text-[#64748B]">{remaining} generations left today</p>}
            </div>
          ) : (
            <>
              {justMade && (
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200" role="status">
                  <Capy size={48} mood="sparkle" react />
                  <p className="text-sm font-semibold text-emerald-900">Done! Every point has its source, so you can check it 🪞</p>
                </div>
              )}
              <header className="bg-white rounded-2xl border border-[#C9D1DB] p-6 flex flex-col gap-2">
                <h1 className="font-headline-lg text-2xl sm:text-3xl font-bold text-[#0E0E12] tracking-tight">
                  {content.title || `Week ${week}`}
                </h1>
                <Sub text={content.title_en} main={content.title} />
                {content.summary && <p className="font-body-md text-[#334155]">{content.summary}</p>}
                <Sub text={content.summary_en} main={content.summary} />
              </header>

              {content.flags && content.flags.length > 0 && (
                <section className="rounded-2xl border border-[#FDE68A] bg-[#FFFDF7] p-4 flex flex-col gap-2">
                  <h2 className="font-headline-sm font-bold text-[#92400E]">Check this</h2>
                  {content.flags.map((f, i) => {
                    const meta = FLAG_LABEL[f.type] || FLAG_LABEL.unclear;
                    return (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="material-symbols-outlined text-[18px] text-[#B45309]">{meta.icon}</span>
                        <div>
                          <span className="font-semibold text-[#0E0E12]">{meta.label}: </span>
                          <span className="text-[#334155]">{f.message}</span>
                          <Sub text={f.message_en} main={f.message} />
                        </div>
                      </div>
                    );
                  })}
                </section>
              )}

              {(content.concepts || []).map((c, idx) => (
                <article key={c.id || idx} className="bg-white rounded-2xl border border-[#C9D1DB] p-5 flex flex-col gap-2">
                  <h3 className="font-headline-sm text-lg font-bold text-[#0E0E12]">{c.heading}</h3>
                  <Sub text={c.heading_en} main={c.heading} />
                  {c.explanation && <p className="font-body-md text-[#334155]">{c.explanation}</p>}
                  <Sub text={c.explanation_en} main={c.explanation} />
                  {c.points && c.points.length > 0 && (
                    <ul className="flex flex-col gap-1.5 mt-1">
                      {c.points.map((p, pi) => (
                        <li key={pi} className="text-sm text-[#1E293B] flex flex-col">
                          <span className="flex flex-wrap items-baseline gap-1.5">
                            <span>• {p.text}</span>
                            {(p.source_ids || []).map((sid) => {
                              const s = sourceMap.get(String(sid));
                              return s ? (
                                <span
                                  key={String(sid)}
                                  title={s.name}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 border border-[#E2E8F0] text-[10px] font-semibold text-[#475569]"
                                >
                                  {s.label}
                                  {p.location ? ` · ${p.location.replace(/^S\d+\s*/, '')}` : ''}
                                </span>
                              ) : null;
                            })}
                          </span>
                          <Sub text={p.text_en} main={p.text} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {!c.points && c.source && <span className="text-[10px] text-[#64748B]">{c.source}</span>}
                  {noteRow?.id && c.id && (
                    <GoDeeper noteId={noteRow.id} conceptId={c.id} language={language} subtitles={subtitles} />
                  )}
                </article>
              ))}

              {/* Student's own additions */}
              <section className="bg-white rounded-2xl border border-[#C9D1DB] p-5 flex flex-col gap-3">
                <h2 className="font-headline-sm font-bold text-[#0E0E12]">Your notes</h2>
                {(content.user_additions || []).map((a, i) => (
                  <p key={i} className="text-sm text-[#1E293B] border-l-2 border-[#D4A94F] pl-3">
                    {a.text}
                  </p>
                ))}
                <textarea
                  value={newAddition}
                  onChange={(e) => setNewAddition(e.target.value)}
                  rows={2}
                  placeholder="Add your own note or exam reminder"
                  aria-label="Add your own note"
                  className="w-full px-3 py-2 rounded-xl border border-[#C9D1DB] text-sm focus:outline-none focus:border-[#D4A94F]"
                />
                <button
                  type="button"
                  disabled={!newAddition.trim() || savingAddition}
                  onClick={saveAddition}
                  className="self-end px-4 py-2 rounded-lg bg-white border border-[#C9D1DB] text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                >
                  {savingAddition ? 'Saving…' : 'Save note'}
                </button>
              </section>

              {noteRow?.id && (
                <DiscussPanel noteId={noteRow.id} language={language} sources={content.sources || []} />
              )}
            </>
          )}
        </main>

        {/* SIDE: sources + actions */}
        <aside className="xl:col-span-4 flex flex-col gap-4">
          {content && (
            <div className="bg-white rounded-2xl border border-[#C9D1DB] p-5 flex flex-col gap-3">
              <button
                type="button"
                onClick={startQuiz}
                disabled={isQuizzing}
                className="w-full px-4 py-3 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] font-bold shadow-sm disabled:opacity-60"
              >
                {isQuizzing ? 'Writing your quiz…' : 'Quiz me on this week'}
              </button>
              <LevelPicker />
              <button
                type="button"
                onClick={generate}
                disabled={isGenerating}
                className="w-full px-4 py-2 rounded-xl bg-white border border-[#C9D1DB] text-sm font-semibold text-[#0E0E12] hover:bg-slate-50 disabled:opacity-60"
              >
                {isGenerating ? 'Rewriting your note…' : 'Regenerate note'}
              </button>
              {remaining !== null && <p className="text-xs text-[#64748B] text-center">{remaining} generations left today</p>}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-[#C9D1DB] p-5 flex flex-col gap-2">
            <h2 className="font-headline-sm font-bold text-[#0E0E12]">Sources this week</h2>
            {weekSources.length === 0 && <p className="text-xs text-[#64748B]">None yet.</p>}
            {weekSources.map((s) => {
              const tag = content?.sources?.find((x) => String(x.id) === String(s.id));
              return (
                <div key={s.id} className="flex items-center gap-2 text-sm text-[#1E293B]">
                  {tag && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-[#E2E8F0] text-[10px] font-semibold text-[#475569]">
                      {tag.label}
                    </span>
                  )}
                  <span className="truncate">{fileLabel(s.file_url)}</span>
                </div>
              );
            })}
            {content?.skipped && content.skipped.length > 0 && (
              <div className="mt-2 text-xs text-[#64748B]">
                <p className="font-semibold">Not used:</p>
                {content.skipped.map((s) => (
                  <p key={s.name}>
                    {s.name}: {s.reason}
                  </p>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
