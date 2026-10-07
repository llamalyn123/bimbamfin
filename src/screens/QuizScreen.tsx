import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { QuizBuilder } from '../components/QuizBuilder';

type QConcept = { id: string; note_id?: string; heading?: string };
type Question = {
  id: string;
  kind?: 'understanding' | 'application' | 'connection';
  prompt: string;
  prompt_en?: string;
  options: string[];
  options_en?: string[];
  correct_index: number;
  explanation: string;
  explanation_en?: string;
  concepts?: QConcept[];
};

const weekOf = (conceptId: string) => conceptId.match(/^W(\d+)/)?.[1];

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
    t
  } = useApp();

  const questions = (Array.isArray(quiz.questions) ? quiz.questions : []) as Question[];
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [finished, setFinished] = useState(false);
  const subtitles = language !== 'en' && showEnglishSubtitles;

  // New quiz -> start fresh
  useEffect(() => {
    setIndex(0);
    setPicked({});
    setFinished(false);
  }, [quiz.id]);

  const [progress, setProgress] = useState<ProgressLite | null>(null);

  // Message is chosen once per finished quiz, so it doesn't change on re-render
  const message = useMemo(() => {
    if (!finished || !questions.length) return null;
    const correct = questions.filter((qq, i) => picked[i] === qq.correct_index).length;
    const ratio = correct / questions.length;
    const tier = ratio === 1 ? 'perfect' : ratio >= 0.6 ? 'good' : 'tough';
    const nailed = new Map<string, string>();
    const revisit = new Map<string, { id: string; heading: string }>();
    questions.forEach((qq, i) => {
      for (const c of qq.concepts ?? []) {
        if (!c.heading) continue;
        if (picked[i] === qq.correct_index) nailed.set(c.heading, c.heading);
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
  const answered = choice !== undefined;
  const correctCount = questions.filter((qq, i) => picked[i] === qq.correct_index).length;

  const finish = async () => {
    setFinished(true);
    const answers = questions.map((qq, i) => ({
      question_id: qq.id,
      picked_index: picked[i] ?? null,
      correct: picked[i] === qq.correct_index
    }));
    await saveQuizResult(correctCount, answers);
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

  if (finished) {
    return (
      <div className="flex flex-col gap-4 pb-16">
        <div className="bg-white rounded-2xl border border-[#C9D1DB] p-8 flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-[#64748B]">Quiz complete</p>
          <p className="text-4xl font-bold text-[#0E0E12]">
            {correctCount} / {questions.length}
          </p>
          <p className="text-base font-semibold text-[#0E0E12] max-w-md">{message?.line}</p>
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
          picked[i] === qq.correct_index ? null : (
            <div key={qq.id} className="bg-white rounded-2xl border border-[#C9D1DB] p-5 flex flex-col gap-1.5">
              <p className="font-semibold text-[#0E0E12]">{qq.prompt}</p>
              <p className="text-sm text-emerald-800">
                <span className="font-semibold">Answer: </span>
                {qq.options[qq.correct_index]}
              </p>
              <p className="text-sm text-[#334155]">{qq.explanation}</p>
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
            {quiz.course ? ` · ${quiz.course}${quiz.scope?.from_week ? ` W${quiz.scope.from_week}–${quiz.scope.to_week}` : ''}` : ''}
          </span>
          <button type="button" onClick={() => window.confirm('Leave this quiz? Your answers so far won\'t be saved.') && newQuiz()} className="underline hover:text-[#0E0E12]">
            Exit
          </button>
        </span>
        {q.kind === 'connection' && (
          <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-[#E2E8F0] font-semibold text-[#475569]">
            {isCourseQuiz ? 'Links two weeks' : 'Links to an earlier week'}
          </span>
        )}
      </div>
      <div className="w-full h-1.5 bg-[#F4F7FB] rounded-full overflow-hidden" aria-hidden="true">
        <div className="h-full bg-[#D4A94F]" style={{ width: `${((index + (answered ? 1 : 0)) / questions.length) * 100}%` }}></div>
      </div>

      <section className="bg-white rounded-2xl border border-[#C9D1DB] p-6 flex flex-col gap-4">
        <div>
          <h2 className="font-headline-sm text-lg font-bold text-[#0E0E12]">{q.prompt}</h2>
          {subtitles && q.prompt_en && <p className="text-xs text-[#64748B] italic mt-1">{q.prompt_en}</p>}
        </div>

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
                </span>
              </button>
            );
          })}
        </div>

        {answered && (
          <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 flex flex-col gap-2">
            <p className="text-sm font-semibold text-[#0E0E12]">
              {choice === q.correct_index ? 'Correct.' : 'Not quite.'}
            </p>
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
