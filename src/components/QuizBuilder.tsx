import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { invokeEdge } from '../lib/edge';
import { runJob, useJobOfKind } from '../lib/jobs';
import { capyAlert, currentScreen } from '../lib/notify';

const COUNTS = [5, 10, 15, 20];
export type Difficulty = 'easy' | 'medium' | 'hard';
const LEVELS: { id: Difficulty; label: string; hint: string }[] = [
  { id: 'easy', label: 'Easy', hint: 'Core ideas in plain words. Good for a first pass.' },
  { id: 'medium', label: 'Medium', hint: 'Understanding plus short new scenarios.' },
  { id: 'hard', label: 'Hard', hint: 'Exam level: combine concepts, tricky "which is best" options.' }
];
/** Last difficulty the student picked (also used by "Quiz me on this week"). */
export const savedDifficulty = (): Difficulty => {
  try {
    const v = localStorage.getItem('bimbam_difficulty');
    return v === 'easy' || v === 'hard' ? v : 'medium';
  } catch {
    return 'medium';
  }
};
export type Formats = 'mixed' | 'mcq';
/** Question types the student picked: mixed (default) or multiple choice only. */
export const savedFormats = (): Formats => {
  try {
    return localStorage.getItem('bimbam_quiz_formats') === 'mcq' ? 'mcq' : 'mixed';
  } catch {
    return 'mixed';
  }
};
const weekNum = (w: unknown) => Number(String(w).match(/\d+/)?.[0] ?? NaN);

/**
 * Quiz tab home: build a quiz across a whole course (or a week range),
 * or quick-quiz a single week. Questions come only from the student's own notes.
 */
export const QuizBuilder: React.FC = () => {
  const { notes, setQuiz, language, selectedCourse, setActiveScreen } = useApp();

  // course -> sorted weeks that have a note
  const courses = useMemo(() => {
    const m = new Map<string, Map<number, string>>();
    for (const n of notes) {
      const code = String(n.course || '').toUpperCase();
      const w = weekNum(n.week);
      if (!code || Number.isNaN(w)) continue;
      if (!m.has(code)) m.set(code, new Map());
      m.get(code)!.set(w, n.id);
    }
    return [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, weeks]) => ({ code, weeks: [...weeks.entries()].sort((a, b) => a[0] - b[0]) }));
  }, [notes]);

  const [course, setCourse] = useState('');
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(0);
  const [count, setCount] = useState(10);
  const [focus, setFocus] = useState<'even' | 'weak'>('even');
  const [difficulty, setDifficultyState] = useState<Difficulty>(savedDifficulty);
  const setDifficulty = (d: Difficulty) => {
    setDifficultyState(d);
    try {
      localStorage.setItem('bimbam_difficulty', d);
    } catch {
      /* ignore */
    }
  };
  const [formats, setFormatsState] = useState<Formats>(savedFormats);
  const setFormats = (f: Formats) => {
    setFormatsState(f);
    try {
      localStorage.setItem('bimbam_quiz_formats', f);
    } catch {
      /* ignore */
    }
  };
  // Quiz building is a background job, so leaving the Quiz tab doesn't lose it
  const job = useJobOfKind('quiz');
  const busy = job?.id.startsWith('builder:') ? job.id.slice(8) : job ? 'other' : null;
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);

  const current = courses.find((c) => c.code === course);

  useEffect(() => {
    if (!courses.length) return;
    const pick = courses.find((c) => c.code === String(selectedCourse).toUpperCase()) ?? courses[0];
    if (!current) setCourse(pick.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses]);

  useEffect(() => {
    if (!current) return;
    setFrom(current.weeks[0][0]);
    setTo(current.weeks[current.weeks.length - 1][0]);
  }, [course, current?.weeks.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (label: string, body: Record<string, unknown>) => {
    setError(null);
    const { data, error: err } = await runJob({ id: `builder:${label}`, kind: 'quiz', label: 'quiz' }, () =>
      invokeEdge('generate-quiz', { ...body, language, difficulty, formats })
    );
    if (err) {
      capyAlert({ title: "Capy couldn't build your quiz", body: err.message, screen: 'quiz', sound: 'oops', mood: 'oops' });
      return setError(err.message);
    }
    if (typeof data?.remaining_today === 'number') setLeft(data.remaining_today);
    setQuiz(data.quiz);
    capyAlert({ title: 'Your quiz is ready!', body: 'Tap to start.', screen: 'quiz', always: currentScreen() !== 'quiz' || document.hidden });
  };

  const startCourse = () => {
    if (!current) return;
    run('course', { course: current.code, from_week: Math.min(from, to), to_week: Math.max(from, to), num_questions: count, focus });
  };

  if (!courses.length) {
    return (
      <div className="bg-white rounded-2xl border border-[#C9D1DB] p-10 flex flex-col items-center gap-3 text-center">
        <span className="material-symbols-outlined text-[40px] text-[#D97706]">quiz</span>
        <h2 className="font-headline-lg text-2xl font-bold text-[#0E0E12]">No notes to quiz on yet</h2>
        <p className="font-body-md text-[#64748B] max-w-md">
          Quizzes come from your own notes. Upload a week's materials in Notes and generate its note first.
        </p>
        <button
          type="button"
          onClick={() => setActiveScreen('notes')}
          className="mt-1 px-5 py-2.5 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] font-bold"
        >
          Go to Notes
        </button>
      </div>
    );
  }

  const chip = (on: boolean) =>
    `px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors ${
      on ? 'bg-[#0E0E12] text-white border-[#0E0E12]' : 'bg-white text-[#0E0E12] border-[#C9D1DB] hover:border-[#D4A94F]'
    }`;
  const select = 'px-3 py-2 rounded-lg border border-[#C9D1DB] bg-white text-sm text-[#0E0E12]';
  const weeksInRange = current ? current.weeks.filter(([w]) => w >= Math.min(from, to) && w <= Math.max(from, to)).length : 0;

  return (
    <div className="flex flex-col gap-4 pb-16 max-w-3xl w-full mx-auto">
      <div>
        <h1 className="font-headline-lg text-2xl font-bold text-[#0E0E12]">Quiz</h1>
        <p className="text-sm text-[#64748B]">Pick a course. Questions come only from your notes, each linked back to its week.</p>
      </div>

      <section className="bg-white rounded-2xl border border-[#C9D1DB] p-5 flex flex-col gap-4">
        <h2 className="text-lg font-bold text-[#0E0E12] flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-[#4F46E5]">library_books</span>
          Whole-course quiz
        </h2>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-[#64748B]">Course</span>
          <div className="flex flex-wrap gap-2">
            {courses.map((c) => (
              <button key={c.code} type="button" className={chip(c.code === course)} onClick={() => setCourse(c.code)}>
                {c.code}
                <span className="ml-1.5 text-xs opacity-70">
                  {c.weeks.length} wk{c.weeks.length === 1 ? '' : 's'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {current && current.weeks.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-[#64748B]">Weeks</span>
            <div className="flex items-center gap-2 flex-wrap">
              <select aria-label="From week" className={select} value={from} onChange={(e) => setFrom(Number(e.target.value))}>
                {current.weeks.map(([w]) => (
                  <option key={w} value={w}>
                    Week {w}
                  </option>
                ))}
              </select>
              <span className="text-sm text-[#64748B]">to</span>
              <select aria-label="To week" className={select} value={to} onChange={(e) => setTo(Number(e.target.value))}>
                {current.weeks.map(([w]) => (
                  <option key={w} value={w}>
                    Week {w}
                  </option>
                ))}
              </select>
              <span className="text-xs text-[#64748B]">
                {weeksInRange} note{weeksInRange === 1 ? '' : 's'} included
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-[#64748B]">Questions</span>
          <div className="flex flex-wrap gap-2">
            {COUNTS.map((n) => (
              <button key={n} type="button" className={chip(n === count)} onClick={() => setCount(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-[#64748B]">Difficulty</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Difficulty">
            {LEVELS.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={difficulty === l.id} className={chip(difficulty === l.id)} onClick={() => setDifficulty(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-[#64748B]">{LEVELS.find((l) => l.id === difficulty)?.hint} Applies to the quick 5 below too.</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-[#64748B]">Question types</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Question types">
            <button type="button" role="radio" aria-checked={formats === 'mixed'} className={chip(formats === 'mixed')} onClick={() => setFormats('mixed')}>
              Mixed
            </button>
            <button type="button" role="radio" aria-checked={formats === 'mcq'} className={chip(formats === 'mcq')} onClick={() => setFormats('mcq')}>
              Multiple choice only
            </button>
          </div>
          <span className="text-xs text-[#64748B]">
            {formats === 'mixed'
              ? 'Scenarios, "which is NOT", spot the error, true or false, fill in the blank, and explain-in-your-own-words checked by Capy.'
              : 'Multiple choice in varied styles: scenarios, "which is NOT", cause and effect, compare, spot the error.'}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-[#64748B]">Focus</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(focus === 'even')} onClick={() => setFocus('even')}>
              Even spread
            </button>
            <button type="button" className={chip(focus === 'weak')} onClick={() => setFocus('weak')}>
              My weak spots
            </button>
          </div>
          <span className="text-xs text-[#64748B]">
            {focus === 'even'
              ? 'Questions spread across every week in range.'
              : 'Half the questions target concepts you got wrong before. With no past misses, it falls back to an even spread.'}
          </span>
        </div>

        {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            disabled={!!busy || !current}
            onClick={startCourse}
            className="px-5 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold disabled:opacity-50 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">{busy === 'course' ? 'hourglass_top' : 'bolt'}</span>
            {busy === 'course' ? 'Building your quiz…' : `Start ${count}-question ${difficulty} quiz`}
          </button>
          {busy === 'course' && <span className="text-xs text-[#64748B]">Reading {weeksInRange} weeks of notes. Can take up to a minute.</span>}
          {left !== null && !busy && <span className="text-xs text-[#64748B]">{left} quizzes left today</span>}
        </div>
      </section>

      {current && (
        <section className="bg-white rounded-2xl border border-[#C9D1DB] p-5 flex flex-col gap-3">
          <h2 className="text-base font-bold text-[#0E0E12]">Or a quick 5 on one week · {current.code}</h2>
          <div className="flex flex-wrap gap-2">
            {current.weeks.map(([w, noteId]) => (
              <button
                key={w}
                type="button"
                disabled={!!busy}
                onClick={() => run(`w${w}`, { note_id: noteId, num_questions: 5 })}
                className={`${chip(false)} disabled:opacity-50`}
              >
                {busy === `w${w}` ? 'Building…' : `Week ${w}`}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
