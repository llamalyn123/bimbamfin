import React, { useEffect, useMemo, useState } from 'react';
import { Capy } from '../components/Capy';
import { FriendIcon } from '../components/CapyFriends';
import { FRIENDS, Friend, requestDiscussMode, takeNewUnlocks } from '../lib/capyProgress';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { QuizBuilder } from '../components/QuizBuilder';
import { invokeEdge } from '../lib/edge';

type QConcept = { id: string; note_id?: string; heading?: string };
type Format = 'mcq' | 'true_false' | 'fill_blank' | 'explain';
type Grade = { verdict: 'got_it' | 'partly' | 'not_yet'; covered: number[]; missing_hints: string[]; feedback: string };
type Typed = { value: string; correct: boolean; grade?: Grade; self?: boolean };
type Question = {
  id: string;
  format?: Format;
  style?: 'scenario' | 'which_not' | 'cause_effect' | 'compare' | 'spot_error' | 'definition';
  accept?: string[];
  key_points?: string[];
  kind?: 'understanding' | 'application' | 'connection';
  prompt: string;
  prompt_en?: string;
  options: string[];
  options_en?: string[];
  correct_index: number;
  explanation: string;
  explanation_en?: string;
  why_not?: string[];
  why_not_en?: string[];
  concepts?: QConcept[];
};

const weekOf = (conceptId: string) => conceptId.match(/^W(\d+)/)?.[1];
const fmt = (q: Question): Format => q.format ?? 'mcq';
const isTyped = (q: Question) => fmt(q) === 'fill_blank' || fmt(q) === 'explain';

const STYLE_LABEL: Record<string, string> = {
  scenario: 'Scenario',
  which_not: 'Which is NOT?',
  cause_effect: 'Cause & effect',
  compare: 'Compare',
  spot_error: 'Spot the error',
  definition: 'Definition'
};
const FORMAT_LABEL: Record<Format, string> = {
  mcq: 'Multiple choice',
  true_false: 'True or false',
  fill_blank: 'Fill in the blank',
  explain: 'Explain in your own words'
};

/** Fill-in-the-blank check: ignore case, punctuation and "a/an/the"; allow one typo in longer words. */
const norm = (x: string) => x.toLowerCase().normalize('NFKC').replace(/[.,;:!?'"()\[\]]/g, ' ').replace(/\b(a|an|the)\b/g, ' ').replace(/\s+/g, ' ').trim();
const oneEditApart = (a: string, b: string) => {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
};
export const blankMatches = (value: string, accept: string[]) => {
  const v = norm(value);
  if (!v) return false;
  return accept.some((a) => {
    const t = norm(a);
    return v === t || (t.length >= 5 && oneEditApart(v, t));
  });
};

const LINES = {
  perfect: [
    'Flawless. Your future self says thanks.',
    "Locked in. This week's material is yours.",
    'Clean sweep. Go take a real break.',
    'Every answer right. That’s what showing up looks like.',
    'Full marks. Exam-you is going to be calm about this one.'
  ],
  good: [
    "Solid. One quick look at the misses and you've got it.",
    'Nearly there. The ones below are your shortcut.',
    'Strong run. Fix the gaps now while they’re fresh.',
    'Good work. A two-minute review closes this out.'
  ],
  tough: [
    'Good that it showed up now, not in the exam.',
    "Every miss below is something you'll remember next time.",
    'Tough round. That’s exactly what quizzes are for.',
    'Now you know where to look. That’s progress.'
  ]
};

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

/** Extra line based on the time of day (device time). */
const timeLine = () => {
  const h = new Date().getHours();
  if (h >= 22 || h < 5) return 'Late-night quiz done. Sleep is what locks it in.';
  if (h < 10) return 'Strong start to the day.';
  if (h >= 12 && h < 14) return 'Nice use of a lunch break.';
  return null;
};

type ProgressLite = { week_streak: number; quizzes_this_week: number; best_week_streak: number };

export const QuizScreen: React.FC = () => {
  const {
    quiz,
    setQuiz,
    setSelectedCourse,
    saveQuizResult,
    setActiveScreen,
    setSelectedWeek,
    language,
    showEnglishSubtitles,
    refreshFromSupabase,
    notes,
    currentUser,
    t
  } = useApp();
  const [newFriend, setNewFriend] = useState<Friend | null>(null);

  const questions = (Array.isArray(quiz.questions) ? quiz.questions : []) as Question[];
  // Progress survives leaving the Quiz tab (kept per quiz for this browser session)
  const progressKey = `bimbam_quiz_progress_${quiz.id}`;
  const saved = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(progressKey) || 'null') as { index: number; picked: Record<number, number>; typed?: Record<number, Typed>; finished: boolean } | null;
    } catch {
      return null;
    }
  })();
  const [index, setIndex] = useState(saved?.index ?? 0);
  const [picked, setPicked] = useState<Record<number, number>>(saved?.picked ?? {});
  const [typed, setTyped] = useState<Record<number, Typed>>(saved?.typed ?? {});
  const [draft, setDraft] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [finished, setFinished] = useState(saved?.finished ?? false);
  const subtitles = language !== 'en' && showEnglishSubtitles;

  // New quiz -> restore its saved progress, or start fresh
  useEffect(() => {
    setIndex(saved?.index ?? 0);
    setPicked(saved?.picked ?? {});
    setTyped(saved?.typed ?? {});
    setFinished(saved?.finished ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz.id]);
  useEffect(() => {
    if (!quiz.id) return;
    try {
      sessionStorage.setItem(progressKey, JSON.stringify({ index, picked, typed, finished }));
    } catch {
      /* ignore */
    }
  }, [progressKey, quiz.id, index, picked, typed, finished]);
  // Fresh input box for each question
  useEffect(() => {
    setDraft('');
    setCheckError(null);
    setShowKey(false);
  }, [index, quiz.id]);

  /** One place that knows whether question i is answered / right, for every format. */
  const answeredAt = (i: number) => (questions[i] && isTyped(questions[i]) ? typed[i] !== undefined : picked[i] !== undefined);
  const rightAt = (i: number) => (questions[i] && isTyped(questions[i]) ? !!typed[i]?.correct : picked[i] === questions[i]?.correct_index);

  const [progress, setProgress] = useState<ProgressLite | null>(null);

  // Message is chosen once per finished quiz, so it doesn't change on re-render
  const message = useMemo(() => {
    if (!finished || !questions.length) return null;
    const correct = questions.filter((_, i) => rightAt(i)).length;
    const ratio = correct / questions.length;
    const tier = ratio === 1 ? 'perfect' : ratio >= 0.6 ? 'good' : 'tough';
    const nailed = new Map<string, string>();
    const revisit = new Map<string, { id: string; heading: string }>();
    questions.forEach((qq, i) => {
      for (const c of qq.concepts ?? []) {
        if (!c.heading) continue;
        if (rightAt(i)) nailed.set(c.heading, c.heading);
        else revisit.set(c.heading, { id: c.id, heading: c.heading });
      }
    });
    for (const k of revisit.keys()) nailed.delete(k); // missed anywhere = revisit
    return {
      line: pick(LINES[tier]),
      time: timeLine(),
      nailed: [...nailed.values()].slice(0, 3),
      revisit: [...revisit.values()].slice(0, 3)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, quiz.id]);

  if (questions.length === 0) return <QuizBuilder />;

  const q = questions[index];
  const choice = picked[index];
  const answered = answeredAt(index);
  const rightNow = rightAt(index);
  const correctCount = questions.filter((_, i) => rightAt(i)).length;
  // Correct answers in a row, ending at this question
  let streakNow = 0;
  for (let i = index; i >= 0 && answeredAt(i) && rightAt(i); i--) streakNow++;

  const checkBlank = () => {
    const v = draft.trim();
    if (!v) return;
    setTyped((t) => ({ ...t, [index]: { value: v, correct: blankMatches(v, q.accept ?? []) } }));
  };
  const checkExplain = async () => {
    const v = draft.trim();
    if (!v) return;
    setChecking(true);
    setCheckError(null);
    const { data, error: err } = await invokeEdge<Grade>('generate-quiz', { mode: 'grade', quiz_id: quiz.id, question_id: q.id, answer: v, language });
    setChecking(false);
    if (err || !data) {
      setCheckError(err?.message ?? "Capy couldn't check that right now.");
      return;
    }
    setTyped((t) => ({ ...t, [index]: { value: v, correct: data.verdict === 'got_it', grade: data } }));
  };
  /** Plan B when the AI is busy: compare with the key points and mark it yourself. */
  const selfMark = (ok: boolean) => setTyped((t) => ({ ...t, [index]: { value: draft.trim(), correct: ok, self: true } }));

  const finish = async () => {
    setFinished(true);
    const answers = questions.map((qq, i) => ({
      question_id: qq.id,
      format: fmt(qq),
      picked_index: picked[i] ?? null,
      ...(isTyped(qq) ? { answer_text: typed[i]?.value ?? null, verdict: typed[i]?.grade?.verdict ?? (typed[i]?.self ? 'self' : null) } : {}),
      correct: rightAt(i)
    }));
    await saveQuizResult(correctCount, answers);
    // 80%+ may bring Capy a new friend: count great quizzes and show the one just earned
    if (questions.length && correctCount / questions.length >= 0.8 && currentUser?.id) {
      const { data: rows } = await supabase.from('quizzes').select('score, questions').eq('user_id', currentUser.id).not('completed_at', 'is', null);
      const good = (rows ?? []).filter((r: { score: number | null; questions: unknown }) => {
        const n = Array.isArray(r.questions) ? r.questions.length : 0;
        return n > 0 && (r.score ?? 0) / n >= 0.8;
      }).length;
      const f = FRIENDS.find((x) => x.need === good);
      if (f && takeNewUnlocks([f.id]).length) setNewFriend(f.id);
    }
    await refreshFromSupabase();
    const { data } = await supabase.rpc('get_progress');
    if (data) setProgress(data as ProgressLite);
  };

  const isCourseQuiz = !quiz.note_id;
  const newQuiz = () => setQuiz({ id: '', note_id: null, questions: [], score: null });

  const openConcept = (c: QConcept) => {
    const w = weekOf(c.id);
    if (quiz.course) setSelectedCourse(quiz.course);
    if (w) setSelectedWeek(Number(w));
    setActiveScreen('notes-detail');
  };

  const ratio = questions.length ? correctCount / questions.length : 0;
  const quizNote = notes.find((n) => n.id === quiz.note_id);
  const mirrorTarget = quizNote
    ? { course: quizNote.course, week: Number(quizNote.week) }
    : message?.revisit[0] && quiz.course && weekOf(message.revisit[0].id)
      ? { course: quiz.course, week: Number(weekOf(message.revisit[0].id)) }
      : null;
  const openMirror = () => {
    if (!mirrorTarget) return;
    setSelectedCourse(mirrorTarget.course);
    setSelectedWeek(mirrorTarget.week);
    requestDiscussMode('mirror');
    setActiveScreen('notes-detail');
  };

  if (finished) {
    return (
      <div className="flex flex-col gap-4 pb-16">
        <div className="bg-white rounded-2xl border border-[#C9D1DB] p-8 flex flex-col items-center gap-2 text-center">
          <Capy size={84} mood={ratio >= 0.8 ? 'sparkle' : ratio >= 0.5 ? 'happy' : 'thinking'} react wave={ratio >= 0.8} />
          <p className="text-sm text-[#64748B]">Quiz complete</p>
          <p className="text-4xl font-bold text-[#0E0E12]">
            {correctCount} / {questions.length}
          </p>
          <p className="text-base font-semibold text-[#0E0E12] max-w-md">{message?.line}</p>
          {newFriend && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200" role="status">
              <FriendIcon id={newFriend} size={36} />
              <p className="text-sm font-semibold text-emerald-900">
                New friend unlocked: {FRIENDS.find((f) => f.id === newFriend)?.name}! They'll sit with Capy on your Home screen.
              </p>
            </div>
          )}
          {!newFriend && ratio >= 0.8 && <p className="text-xs text-emerald-700 font-semibold">80%+ counts toward Capy's next friend 🐥</p>}
          {ratio < 0.5 && mirrorTarget && (
            <div className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] max-w-md">
              <p className="text-sm text-[#78350F]">No stress. Let's mirror-check that week first: explain it in one sentence and Capy shows what's missing.</p>
              <button type="button" onClick={openMirror} className="px-4 py-1.5 rounded-lg bg-[#0E0E12] text-white text-xs font-semibold">
                Mirror check {mirrorTarget.course} Week {mirrorTarget.week} 🪞
              </button>
            </div>
          )}
          {message?.time && <p className="text-sm text-[#64748B]">{message.time}</p>}

          {progress && (
            <p className="text-xs text-[#64748B] flex flex-wrap justify-center gap-x-3">
              <span>
                {progress.quizzes_this_week} {progress.quizzes_this_week === 1 ? 'quiz' : 'quizzes'} this week
              </span>
              {progress.week_streak > 0 && (
                <span className="text-[#B45309] font-semibold">
                  🔥 {progress.week_streak}-week streak
                  {progress.week_streak >= progress.best_week_streak && progress.week_streak > 1 ? ' · your best yet' : ''}
                </span>
              )}
            </p>
          )}

          {message && (message.nailed.length > 0 || message.revisit.length > 0) && (
            <div className="w-full max-w-md flex flex-col gap-2 mt-1 text-sm text-left">
              {message.nailed.length > 0 && (
                <p className="text-[#1E293B]">
                  <span className="text-emerald-700 font-semibold">Nailed: </span>
                  {message.nailed.join(', ')}
                </p>
              )}
              {message.revisit.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[#92400E] font-semibold">Worth another look:</span>
                  {message.revisit.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => openConcept(c)}
                      className="text-xs px-2 py-0.5 rounded border border-[#C9D1DB] hover:border-[#D4A94F] text-[#0E0E12] bg-white"
                    >
                      {c.heading}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => setActiveScreen('home')}
              className="px-5 py-2.5 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] font-bold"
            >
              {t('quiz_back_today', 'Back to Today')}
            </button>
            <button
              type="button"
              onClick={newQuiz}
              className="px-5 py-2.5 rounded-xl bg-white border border-[#C9D1DB] font-semibold text-[#0E0E12] hover:bg-slate-50"
            >
              New quiz
            </button>
            {!isCourseQuiz && (
              <button
                type="button"
                onClick={() => setActiveScreen('notes-detail')}
                className="px-5 py-2.5 rounded-xl bg-white border border-[#C9D1DB] font-semibold text-[#0E0E12] hover:bg-slate-50"
              >
                Back to note
              </button>
            )}
          </div>
        </div>

        {questions.map((qq, i) =>
          rightAt(i) ? null : (
            <div key={qq.id} className="bg-white rounded-2xl border border-[#C9D1DB] p-5 flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-[#64748B]">{FORMAT_LABEL[fmt(qq)]}</span>
              <p className="font-semibold text-[#0E0E12]">{qq.prompt}</p>
              {typed[i]?.value && <p className="text-sm text-[#7F1D1D]"><span className="font-semibold">You wrote: </span>{typed[i].value}</p>}
              {fmt(qq) === 'explain' ? (
                <div className="text-sm text-emerald-800">
                  <span className="font-semibold">A good answer covers: </span>
                  <ul className="list-disc pl-5">{(qq.key_points ?? []).map((k) => <li key={k}>{k}</li>)}</ul>
                </div>
              ) : (
                <p className="text-sm text-emerald-800">
                  <span className="font-semibold">Answer: </span>
                  {fmt(qq) === 'fill_blank' ? (qq.accept ?? []).join(' / ') : qq.options[qq.correct_index]}
                </p>
              )}
              <p className="text-sm text-[#334155]">{qq.explanation}</p>
              {picked[i] !== undefined && qq.why_not?.[picked[i]] && (
                <p className="text-sm text-[#7F1D1D]">
                  <span className="font-semibold">Why not “{qq.options[picked[i]]}”: </span>
                  {qq.why_not[picked[i]]}
                </p>
              )}
            </div>
          )
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-16 max-w-3xl w-full mx-auto">
      <div className="flex items-center justify-between text-xs text-[#64748B]">
        <span className="flex items-center gap-2">
          <span>
            Question {index + 1} of {questions.length}
            {quiz.scope?.difficulty ? ` · ${quiz.scope.difficulty[0].toUpperCase()}${quiz.scope.difficulty.slice(1)}` : ''}
            {quiz.course ? ` · ${quiz.course}${quiz.scope?.from_week ? ` W${quiz.scope.from_week}–${quiz.scope.to_week}` : ''}` : ''}
          </span>
          <button type="button" onClick={() => window.confirm('Leave this quiz? Your answers so far won\'t be saved.') && newQuiz()} className="underline hover:text-[#0E0E12]">
            Exit
          </button>
        </span>
        <span className="flex flex-wrap gap-1 justify-end">
          <span className="px-2 py-0.5 rounded-full bg-[#EEF2FF] border border-[#C7D2FE] font-semibold text-[#3730A3]">
            {fmt(q) === 'mcq' && q.style ? STYLE_LABEL[q.style] : FORMAT_LABEL[fmt(q)]}
          </span>
          {q.kind === 'connection' && (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-[#E2E8F0] font-semibold text-[#475569]">
              {isCourseQuiz ? 'Links two weeks' : 'Links to an earlier week'}
            </span>
          )}
        </span>
      </div>
      <div className="w-full h-1.5 bg-[#F4F7FB] rounded-full overflow-hidden" aria-hidden="true">
        <div className="h-full bg-[#D4A94F]" style={{ width: `${((index + (answered ? 1 : 0)) / questions.length) * 100}%` }}></div>
      </div>

      <section className="bg-white rounded-2xl border border-[#C9D1DB] p-6 flex flex-col gap-4">
        <div>
          <h2 className="font-headline-sm text-lg font-bold text-[#0E0E12]">{q.prompt}</h2>
          {subtitles && q.prompt_en && <p className="text-xs text-[#64748B] italic mt-1">{q.prompt_en}</p>}
        </div>

        {fmt(q) === 'fill_blank' && (
          <div className="flex flex-col gap-2">
            {answered ? (
              <div className={`p-3 rounded-xl border-2 ${rightNow ? 'border-emerald-400 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
                <p className="text-sm"><b>You wrote:</b> {typed[index]?.value}</p>
                <p className="text-sm text-emerald-800"><b>Answer:</b> {(q.accept ?? []).join(' / ')}</p>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && checkBlank()}
                  placeholder="Type the missing word or phrase"
                  aria-label="Your answer for the blank"
                  className="flex-1 px-3 py-2 rounded-xl border-2 border-[#C9D1DB] text-sm focus:outline-none focus:border-[#D4A94F]"
                />
                <button type="button" onClick={checkBlank} disabled={!draft.trim()} className="px-4 py-2 rounded-xl bg-[#0E0E12] text-white text-sm font-semibold disabled:opacity-40">
                  Check
                </button>
              </div>
            )}
          </div>
        )}

        {fmt(q) === 'explain' && (
          <div className="flex flex-col gap-2">
            {answered ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]"><b>You wrote:</b> {typed[index]?.value}</p>
                <div className="text-sm">
                  <p className="font-semibold text-[#0E0E12]">A good answer covers:</p>
                  <ul className="flex flex-col gap-1 mt-1">
                    {(q.key_points ?? []).map((k, ki) => {
                      const got = typed[index]?.grade?.covered.includes(ki);
                      return (
                        <li key={ki} className={`flex gap-2 ${typed[index]?.grade ? (got ? 'text-emerald-800' : 'text-[#92400E]') : 'text-[#334155]'}`}>
                          <span aria-hidden="true">{typed[index]?.grade ? (got ? '✓' : '○') : '•'}</span>
                          {k}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                {typed[index]?.grade && typed[index]!.grade!.missing_hints.length > 0 && (
                  <ul className="text-sm text-[#3730A3] list-disc pl-5">
                    {typed[index]!.grade!.missing_hints.map((h) => <li key={h}>{h}</li>)}
                  </ul>
                )}
              </div>
            ) : (
              <>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 1200))}
                  rows={4}
                  placeholder="Explain it in your own words, 1–3 sentences"
                  aria-label="Your answer in your own words"
                  className="w-full px-3 py-2 rounded-xl border-2 border-[#C9D1DB] text-sm focus:outline-none focus:border-[#D4A94F]"
                />
                <div className="flex flex-wrap items-center gap-2 justify-end">
                  {checking && <Capy size={26} mood="thinking" searching />}
                  <button type="button" onClick={checkExplain} disabled={checking || draft.trim().split(/\s+/).length < 3} className="px-4 py-2 rounded-xl bg-[#0E0E12] text-white text-sm font-semibold disabled:opacity-40">
                    {checking ? 'Capy is reading…' : 'Check with Capy'}
                  </button>
                </div>
                {checkError && (
                  <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-sm flex flex-col gap-2">
                    <p className="text-amber-900">{checkError} You can compare with the key points and mark it yourself.</p>
                    {!showKey ? (
                      <button type="button" onClick={() => setShowKey(true)} disabled={!draft.trim()} className="self-start px-3 py-1 rounded-lg border border-amber-300 text-xs font-semibold">
                        Show the key points
                      </button>
                    ) : (
                      <>
                        <ul className="list-disc pl-5 text-[#334155]">{(q.key_points ?? []).map((k) => <li key={k}>{k}</li>)}</ul>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => selfMark(true)} className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold">I covered them</button>
                          <button type="button" onClick={() => selfMark(false)} className="px-3 py-1 rounded-lg border border-[#C9D1DB] text-xs font-semibold">Not yet</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!isTyped(q) && (
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Answer options">
          {q.options.map((opt, oi) => {
            const isCorrect = oi === q.correct_index;
            const isPicked = choice === oi;
            const state = !answered
              ? 'border-[#C9D1DB] hover:border-[#D4A94F] bg-white'
              : isCorrect
              ? 'border-emerald-400 bg-emerald-50'
              : isPicked
              ? 'border-red-300 bg-red-50'
              : 'border-[#E2E8F0] bg-white opacity-70';
            return (
              <button
                type="button"
                role="radio"
                aria-checked={isPicked}
                key={oi}
                disabled={answered}
                onClick={() => setPicked((p) => ({ ...p, [index]: oi }))}
                className={`text-left p-3 rounded-xl border-2 transition-colors flex items-start gap-2 ${state}`}
              >
                {answered && (isCorrect || isPicked) && (
                  <span className={`material-symbols-outlined text-[18px] ${isCorrect ? 'text-emerald-600' : 'text-red-600'}`}>
                    {isCorrect ? 'check_circle' : 'cancel'}
                  </span>
                )}
                <span className="flex flex-col">
                  <span className="text-sm text-[#0E0E12]">{opt}</span>
                  {subtitles && q.options_en?.[oi] && <span className="text-xs text-[#64748B] italic">{q.options_en[oi]}</span>}
                  {answered && !isCorrect && q.why_not?.[oi] && (
                    <span className="text-xs text-[#7F1D1D] mt-1">
                      <b>Why not:</b> {q.why_not[oi]}
                      {subtitles && q.why_not_en?.[oi] && <span className="block text-[#64748B] italic">{q.why_not_en[oi]}</span>}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        )}

        {answered && (
          <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Capy key={`${quiz.id}-${index}`} size={40} mood={rightNow ? (streakNow >= 3 ? 'sparkle' : 'happy') : typed[index]?.grade?.verdict === 'partly' ? 'thinking' : 'oops'} react />
              <p className="text-sm font-semibold text-[#0E0E12]">
                {typed[index]?.grade?.feedback
                  ? typed[index]!.grade!.feedback
                  : rightNow
                    ? streakNow >= 3 ? `Correct! ${streakNow} in a row ✨` : 'Correct! Capy does a happy hop.'
                    : 'Not quite. Detective Capy found the page to check 🔍'}
              </p>
            </div>
            <p className="text-sm text-[#334155]">{q.explanation}</p>
            {subtitles && q.explanation_en && <p className="text-xs text-[#64748B] italic">{q.explanation_en}</p>}
            {q.concepts && q.concepts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-xs text-[#64748B]">From your notes:</span>
                {q.concepts.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => openConcept(c)}
                    className="text-xs px-2 py-0.5 rounded bg-white border border-[#C9D1DB] hover:border-[#D4A94F] text-[#0E0E12]"
                  >
                    {weekOf(c.id) ? `Week ${weekOf(c.id)}: ` : ''}
                    {c.heading}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <div className="flex justify-between">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((i) => i - 1)}
          className="px-4 py-2 rounded-xl bg-white border border-[#C9D1DB] text-sm font-semibold disabled:opacity-40"
        >
          Previous
        </button>
        {index < questions.length - 1 ? (
          <button
            type="button"
            disabled={!answered}
            onClick={() => setIndex((i) => i + 1)}
            className="px-5 py-2 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] text-sm font-bold disabled:opacity-40"
          >
            Next question
          </button>
        ) : (
          <button
            type="button"
            disabled={!answered}
            onClick={finish}
            className="px-5 py-2 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] text-sm font-bold disabled:opacity-40"
          >
            See results
          </button>
        )}
      </div>
    </div>
  );
};
