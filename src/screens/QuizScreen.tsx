import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';

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

export const QuizScreen: React.FC = () => {
  const {
    quiz,
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

  if (questions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#C9D1DB] p-10 flex flex-col items-center gap-3 text-center">
        <span className="material-symbols-outlined text-[40px] text-[#D97706]">quiz</span>
        <h2 className="font-headline-lg text-2xl font-bold text-[#0E0E12]">No quiz open</h2>
        <p className="font-body-md text-[#64748B] max-w-md">
          Open a week's master note in Notes and tap "Quiz me on this week".
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
  };

  const openConcept = (c: QConcept) => {
    const w = weekOf(c.id);
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
          <p className="text-sm text-[#64748B]">
            {correctCount === questions.length
              ? 'Every answer right.'
              : 'Review the ones you missed below.'}
          </p>
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
              onClick={() => setActiveScreen('notes-detail')}
              className="px-5 py-2.5 rounded-xl bg-white border border-[#C9D1DB] font-semibold text-[#0E0E12] hover:bg-slate-50"
            >
              Back to note
            </button>
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
        <span>
          Question {index + 1} of {questions.length}
        </span>
        {q.kind === 'connection' && (
          <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-[#E2E8F0] font-semibold text-[#475569]">
            Links to an earlier week
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
