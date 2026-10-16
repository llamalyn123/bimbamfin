import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Capy, CapyMood } from './Capy';

/**
 * "How Bimbam works": a short Capy-guided slideshow.
 * Open it from anywhere with openHowItWorks(). Mounted once in App.
 * New users are told about it by <HowItWorksNudge /> on Home and the "?" in the header.
 */
const OPEN_EVENT = 'bimbam:how-it-works';
const SEEN_KEY = 'bimbam_how_seen';

export const openHowItWorks = () => window.dispatchEvent(new Event(OPEN_EVENT));

const readSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
};
const markSeen = () => {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* private mode: fine, the nudge just shows again */
  }
  window.dispatchEvent(new Event(`${OPEN_EVENT}:seen`));
};

type Screen = 'home' | 'notes' | 'quiz' | 'events' | 'more';
type Card = { mood: CapyMood; title: string; body: string; points: string[]; go?: { screen: Screen; label: string } };

const CARDS: Card[] = [
  {
    mood: 'happy',
    title: "Hi, I'm Capy 🍊",
    body: 'Bimbam means "mirror" in Tamil. I reflect back what you actually understand, using only your own course materials. No cap.',
    points: ['Swipe or tap Next to see the 5 things Bimbam does', 'You can reopen this anytime from the ? at the top']
  },
  {
    mood: 'happy',
    title: '1 · Turn your slides into notes',
    body: 'Upload your slides, readings or a photo of your notes. Bimbam makes a clear study note for the week.',
    points: [
      'Notes → Upload materials → pick the course and week',
      'Every point shows where it came from, like [S1], so you can check it',
      'Choose "Simple words" or "Standard", in English, 中文, தமிழ் or Deutsch'
    ],
    go: { screen: 'notes', label: 'Go to Notes' }
  },
  {
    mood: 'thinking',
    title: '2 · Discuss with Capy',
    body: 'Open any note and tap Discuss. I ask questions and correct mistakes, but I never write your assignments.',
    points: [
      'Talk it through: chat about the week’s ideas',
      'Feedback on my ideas: paste your draft and I point out gaps',
      'Polish my English: I explain each language issue and you write the fix'
    ],
    go: { screen: 'notes', label: 'Open a note' }
  },
  {
    mood: 'sparkle',
    title: '3 · Quiz yourself',
    body: 'Make a quiz from any note and see what stuck before the exam does.',
    points: ['Quiz → pick a note → start', 'Wrong answers point you back to the right page'],
    go: { screen: 'quiz', label: 'Go to Quiz' }
  },
  {
    mood: 'happy',
    title: '4 · Never miss a deadline',
    body: 'Today shows what is due soon. Red means it is close.',
    points: [
      'Tick off to-dos for a little confetti 🎉',
      'Events → paste an event email and Bimbam pulls out the date for you',
      'Exam countdown on Today, with Capy in revision mode near the date'
    ],
    go: { screen: 'events', label: 'Go to Events' }
  },
  {
    mood: 'happy',
    title: '5 · Connect your other apps',
    body: 'Bring your timetable in and send deadlines out to your phone.',
    points: [
      'More → Connected accounts: school calendar, phone calendar and the Telegram bot @nocapBBot',
      'In Telegram, add deadlines with /due and find a group meeting time with /meet',
      'School emails (SMU, NUS, NTU) also unlock Campus facilities'
    ],
    go: { screen: 'more', label: 'Go to More' }
  },
  {
    mood: 'sparkle',
    title: 'Your data stays yours',
    body: 'Only you can see your notes, chats and files. Download or delete them anytime in More → Your data.',
    points: ['Start with one file from this week. That’s all it takes.'],
    go: { screen: 'notes', label: 'Upload my first file' }
  }
];

export const HowItWorks: React.FC = () => {
  const { setActiveScreen } = useApp();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    const show = () => {
      setI(0);
      setOpen(true);
      markSeen();
    };
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  const close = useCallback(() => setOpen(false), []);
  const next = useCallback(() => setI((x) => Math.min(CARDS.length - 1, x + 1)), []);
  const back = useCallback(() => setI((x) => Math.max(0, x - 1)), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close, next, back]);

  if (!open) return null;
  const c = CARDS[i];
  const last = i === CARDS.length - 1;
  let touchX = 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How Bimbam works"
        className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => (touchX = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - touchX;
          if (dx < -50) next();
          if (dx > 50) back();
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#8B5E2F]">How Bimbam works</span>
          <button type="button" onClick={close} aria-label="Close" className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div key={i} className="flex flex-col items-center text-center gap-3">
          <Capy size={88} mood={c.mood} wave={i === 0} react />
          <h2 className="text-xl font-bold text-[#0E0E12]">{c.title}</h2>
          <p className="text-sm text-[#334155]">{c.body}</p>
          <ul className="w-full text-left text-sm text-[#1E293B] flex flex-col gap-1.5">
            {c.points.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="text-[#D4A94F] font-bold">•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
          {c.go && (
            <button
              type="button"
              onClick={() => {
                setActiveScreen(c.go!.screen);
                close();
              }}
              className="text-sm font-semibold text-[#363FEF] hover:underline"
            >
              {c.go.label} →
            </button>
          )}
        </div>

        <div className="flex justify-center gap-1.5" aria-label={`Card ${i + 1} of ${CARDS.length}`}>
          {CARDS.map((_, k) => (
            <button
              key={k}
              type="button"
              onClick={() => setI(k)}
              aria-label={`Go to card ${k + 1}`}
              className={`h-2 rounded-full transition-all ${k === i ? 'w-5 bg-[#D4A94F]' : 'w-2 bg-slate-300'}`}
            />
          ))}
        </div>

        <div className="flex justify-between gap-2">
          <button type="button" onClick={i === 0 ? close : back} className="px-4 py-2 rounded-xl border border-[#C9D1DB] text-sm font-semibold">
            {i === 0 ? 'Skip' : 'Back'}
          </button>
          <button
            type="button"
            onClick={last ? close : next}
            className="px-5 py-2 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] text-sm font-bold"
          >
            {last ? "Let's go" : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Small Capy card on Home telling new users the guide exists. Hides once opened or dismissed. */
export const HowItWorksNudge: React.FC = () => {
  const [seen, setSeen] = useState(readSeen);

  useEffect(() => {
    const hide = () => setSeen(true);
    window.addEventListener(`${OPEN_EVENT}:seen`, hide);
    return () => window.removeEventListener(`${OPEN_EVENT}:seen`, hide);
  }, []);

  if (seen) return null;
  return (
    <section className="flex items-center gap-3 p-4 rounded-xl border border-[#FDE68A] bg-[#FFFBEB]">
      <Capy size={40} mood="happy" wave />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#0E0E12]">New here? Let Capy show you around</p>
        <p className="text-xs text-[#64748B]">1-minute guide. Reopen it anytime from the ? at the top.</p>
      </div>
      <button type="button" onClick={openHowItWorks} className="px-3 py-1.5 rounded-lg bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] text-xs font-bold shrink-0">
        Show me
      </button>
      <button type="button" onClick={markSeen} aria-label="Dismiss" className="text-[#94A3B8] hover:text-[#334155] shrink-0">
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </section>
  );
};

/** "?" button for the header. */
export const HowItWorksButton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <button
    type="button"
    onClick={openHowItWorks}
    title="How Bimbam works"
    aria-label="How Bimbam works"
    className={`w-8 h-8 rounded-full bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] hover:bg-[#FDE68A] flex items-center justify-center font-bold text-sm ${className}`}
  >
    ?
  </button>
);
