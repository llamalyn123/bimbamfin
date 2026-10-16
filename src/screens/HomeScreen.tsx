import { isDeadlineEvent } from '../lib/eventKinds';
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Capy } from '../components/Capy';
import { HowItWorksNudge } from '../components/HowItWorks';
import { CapyCorner } from '../components/CapyCorner';
import { sourceLabel } from '../lib/labels';
import { PasteUpdateModal } from '../components/PasteUpdateModal';
import { ChangeItemModal, EditableItem } from '../components/ChangeItemModal';
import { CalendarView } from './CalendarView';
import { SUPPORTED_LANGUAGES } from '../i18n/translations';
import { supabase } from '../lib/supabase';
import {
  getGreetingTimeSlot,
  extractFirstName,
  getLocalizedGreeting,
  GreetingTimeSlot
} from '../utils/greeting';

export const HomeScreen: React.FC = () => {
  const {
    homeSubView,
    setHomeSubView,
    deadlines,
    events,
    activeQuote,
    toggleDeadline,
    setActiveScreen,
    toggleEventRegister,
    toggleEventReminder,
    userEventInterests,
    reminders,
    currentUser,
    language,
    setLanguage,
    t,
    classes,
    changeAlerts,
    dismissAlert,
    lastSyncedText,
    quiz,
    setQuiz
  } = useApp();

  const [eventCategoryFilter, setEventCategoryFilter] = useState<string>('All');

  const isDone = (status: string) => ['completed', 'cleared', 'done', 'cancelled'].includes(String(status).toLowerCase());

  // ---------- Exam countdown: exams in the next 6 weeks ----------
  const isExam = (d: { type?: string; title?: string }) =>
    /exam/i.test(String(d.type)) || /\b(final exam|finals|mid-?terms?|examination|exam)\b/i.test(String(d.title));
  const examSoon = deadlines
    .filter((d) => !isDone(d.status) && isExam(d))
    .filter((d) => {
      const t = new Date(d.due_date).getTime();
      return t > Date.now() && t < Date.now() + 42 * 864e5;
    })
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  const daysUntil = (iso: string) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - start.getTime()) / 864e5);
  };

  // Calm, quirky countdown titles. Phase depends on days left; the line rotates weekly.
  const COUNTDOWN_TITLES: Record<'far' | 'mid' | 'near' | 'close', string[]> = {
    far: [
      'Exams are on the horizon. Plenty of runway.',
      'Future you is cheering. Small steps count.',
      'Long game mode: a little each week.',
      'Exams spotted in the distance. No rush, just rhythm.'
    ],
    mid: [
      'The plot thickens (gently).',
      'Halfway-ish there. Your notes are doing the heavy lifting.',
      'Steady pace beats sprinting. You’ve got this.',
      'Quiz a little, rest a little. Repeat.'
    ],
    near: [
      'Final stretch. Trust the work you’ve done.',
      'Review mode: unlocked.',
      'Revise, snack, sleep. In that order.',
      'You know more than you think.'
    ],
    close: [
      'Almost there. Be kind to yourself this week.',
      'Light review, good sleep, water bottle. That’s the plan.',
      'You’ve prepared for this. Breathe.',
      'Last laps. Rest counts as revision too.'
    ]
  };
  const weekIndex = Math.floor(Date.now() / (7 * 864e5));
  const countdownTitle = (days: number) => {
    const phase = days > 28 ? 'far' : days > 14 ? 'mid' : days > 7 ? 'near' : 'close';
    const pool = COUNTDOWN_TITLES[phase];
    return pool[weekIndex % pool.length];
  };
  // "(EXAM) International Business" -> "International Business"; hide placeholder course names
  const examName = (t: string) => t.replace(/^\(?\s*(final\s+)?exam(ination)?\b\s*\)?\s*[:\-–]?\s*/i, '').trim() || t;
  const realCourse = (c?: string) => (c && !/^general$/i.test(c) ? c : '');

  // ---------- Due soon: explicit deadlines only ----------
  // Submissions, presentations, quizzes + key events you added (hackathons, auditions,
  // competitions, performances) + registration deadlines. Classes/lectures and weekly
  // CCA sessions live in the calendar, never here. Exams go in the countdown above.
  const KEY_EVENT = /\b(hackathon|audition|try-?outs?|competition|case comp|pitch|showcase|performance|recital|concert|interview|submission|deadline)\b/i;
  type DueItem = { key: string; eventId?: string; kind: 'deadline' | 'event' | 'register' | 'eventdue'; title: string; tag: string; when: string; badge: string; onOpen: () => void; sub: string };
  const dueSoon: DueItem[] = [
    ...deadlines
      .filter((d) => !isDone(d.status) && !(examSoon.length && isExam(d)))
      .filter((d) => new Date(d.due_date).getTime() > Date.now() - 864e5)
      .map((d) => ({
        key: `d-${d.id}`,
        kind: 'deadline' as const,
        title: d.title,
        tag: d.course,
        when: d.due_date,
        badge: String(d.type || 'Due'),
        sub: [sourceLabel(d.source), d.weight != null ? `${d.weight}%` : ''].filter(Boolean).join(' · '),
        onOpen: () => setActiveScreen('matrix')
      })),
    ...events
      .filter((e) => e.created_by === currentUser?.id || userEventInterests[e.id] || reminders[e.id])
      .flatMap((e) => {
        const out: DueItem[] = [];
        if (e.registration_deadline && !userEventInterests[e.id] && new Date(e.registration_deadline).getTime() > Date.now()) {
          out.push({ key: `r-${e.id}`, eventId: e.id, kind: 'register', title: `Register: ${e.title}`, tag: 'Event', when: e.registration_deadline, badge: 'Register', sub: e.location || 'Event', onOpen: () => setActiveScreen('events') });
        }
        const text = `${e.title} ${(e.interest_tags || []).join(' ')} ${e.description || ''}`;
        if (isDeadlineEvent(e)) {
          // Course registration, add/drop, applications…: a deadline, tick Done to clear it
          if (!userEventInterests[e.id] && new Date(e.event_date).getTime() > Date.now() - 864e5) {
            out.push({ key: `ed-${e.id}`, eventId: e.id, kind: 'eventdue', title: e.title, tag: 'Deadline', when: e.event_date, badge: 'Deadline', sub: e.location || e.description || 'Added from Events', onOpen: () => setActiveScreen('events') });
          }
        } else if (KEY_EVENT.test(text) && new Date(e.event_date).getTime() > Date.now()) {
          out.push({ key: `e-${e.id}`, kind: 'event', title: e.title, tag: 'Event', when: e.event_date, badge: (text.match(KEY_EVENT)?.[1] || 'Event'), sub: e.location || 'Event', onOpen: () => setActiveScreen('events') });
        }
        return out;
      })
  ].sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime());

  // More than 15 days away -> weekly check-in instead of the main list.
  // "Seen it" hides an item until next week (Monday-based week, this device).
  const FAR_DAYS = 15;
  const weekNo = Math.floor((Date.now() / 864e5 + 3) / 7);
  const [seenWeek, setSeenWeek] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('bimbam_weekly_seen') || '{}');
    } catch {
      return {};
    }
  });
  const markSeen = (key: string) => {
    const next = { ...seenWeek, [key]: weekNo };
    setSeenWeek(next);
    try {
      localStorage.setItem('bimbam_weekly_seen', JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  const isFar = (iso: string) => new Date(iso).getTime() - Date.now() > FAR_DAYS * 864e5;
  const nearDue = dueSoon.filter((d) => !isFar(d.when));
  const farAll = dueSoon.filter((d) => isFar(d.when));
  const farDue = farAll.filter((d) => seenWeek[d.key] !== weekNo);

  const relDue = (iso: string) => {
    const h = (new Date(iso).getTime() - Date.now()) / 36e5;
    // Today/tomorrow: solid red. Within 14 days: red tint. Further out: normal colours.
    const URGENT = 'bg-red-600 text-white';
    const SOON = 'bg-red-500/15 text-red-600 ring-1 ring-red-500/30';
    if (h < 0) return { text: 'Overdue', cls: URGENT };
    if (h < 24) return { text: h < 1 ? 'Within the hour' : `In ${Math.round(h)} h`, cls: URGENT };
    const d = daysUntil(iso);
    if (d <= 1) return { text: 'Tomorrow', cls: URGENT };
    if (d <= 14) return { text: `In ${d} days`, cls: SOON };
    return { text: `In ${d} days`, cls: 'bg-[#F1F5F9] text-[#475569]' };
  };
  // Real progress from the get_progress database function
  type Progress = {
    week_streak: number;
    quizzes_this_week: number;
    quizzes_total: number;
    avg_score_pct_30d: number | null;
    last_quiz: { score: number; total: number | null } | null;
  };
  const [progress, setProgress] = useState<Progress | null>(null);
  useEffect(() => {
    if (!currentUser?.id) return;
    supabase.rpc('get_progress').then(({ data, error }) => {
      if (error) console.warn('get_progress', error.message);
      else setProgress(data as Progress);
    });
  }, [currentUser?.id, deadlines.length]);
  const hasProgress = Boolean(progress && progress.quizzes_total > 0);

  const [pasteOpen, setPasteOpen] = useState(false);
  const [editItem, setEditItem] = useState<EditableItem | null>(null);

  // Next class today, else the first one tomorrow
  const nextClass = (() => {
    const now = Date.now();
    const upcoming = classes.filter((c) => new Date(c.starts_at).getTime() > now);
    const first = upcoming[0];
    if (!first) return null;
    const d = new Date(first.starts_at);
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const label =
      d.toDateString() === today.toDateString()
        ? 'Next class'
        : d.toDateString() === tomorrow.toDateString()
        ? 'Tomorrow'
        : d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
    return { cls: first, label };
  })();
  const fmtT = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  // "My events": only things this student added or saved, upcoming, soonest first.
  // Anything with an open registration deadline in the next 7 days goes first.
  const filteredEvents = events
    .filter(
      (e) =>
        (e.created_by === currentUser?.id || userEventInterests[e.id] || reminders[e.id]) &&
        new Date(e.event_date).getTime() > Date.now() - 3 * 36e5
    )
    .sort((a, b) => {
      const urgent = (e: typeof a) =>
        e.registration_deadline && !userEventInterests[e.id] && new Date(e.registration_deadline).getTime() - Date.now() < 7 * 864e5 ? 0 : 1;
      return urgent(a) - urgent(b) || new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
    });

  // Greeting time slot calculation based on student's local device time
  const [timeSlot, setTimeSlot] = useState<GreetingTimeSlot>(() => getGreetingTimeSlot());
  const [profileFirstName, setProfileFirstName] = useState<string | null>(() =>
    extractFirstName(currentUser?.full_name)
  );

  // Recalculate greeting when Home opens, when app returns to foreground, and on visibility change
  useEffect(() => {
    // 1. Recalculate immediately when Home opens
    setTimeSlot(getGreetingTimeSlot());

    // 2. Recalculate when returning to foreground or gaining focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTimeSlot(getGreetingTimeSlot());
      }
    };

    const handleFocus = () => {
      setTimeSlot(getGreetingTimeSlot());
    };

    // 3. Periodic check every 30 seconds to update smoothly across time boundaries
    const interval = setInterval(() => {
      setTimeSlot(getGreetingTimeSlot());
    }, 30000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []);

  // Fetch or sync first word of profiles.full_name for the logged-in user
  // If missing or query fails, drop name entirely. Never show "Alex" or placeholders.
  useEffect(() => {
    let isMounted = true;
    const initialFirst = extractFirstName(currentUser?.full_name);
    if (initialFirst) {
      setProfileFirstName(initialFirst);
      return;
    }

    if (currentUser?.id) {
      const fetchProfile = async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', currentUser.id)
            .limit(1);

          if (!isMounted) return;
          if (!error && data && data.length > 0) {
            setProfileFirstName(extractFirstName(data[0].full_name));
          } else {
            setProfileFirstName(null);
          }
        } catch {
          if (isMounted) setProfileFirstName(null);
        }
      };

      fetchProfile();
    } else {
      setProfileFirstName(null);
    }

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id, currentUser?.full_name]);

  const greetingText = getLocalizedGreeting(timeSlot, profileFirstName, t);

  return (
    <div className="flex flex-col w-full pb-12">
      {/* Segmented View Toggle Control (List vs Calendar) */}
      <div className="flex items-center justify-between py-1 mb-4">
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-[#CBD5E1] home-toggle">
          <button
            type="button"
            onClick={() => setHomeSubView('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body-sm transition-all cursor-pointer ${
              homeSubView === 'list'
                ? 'bg-white text-[#0E0E12] font-semibold shadow-sm'
                : 'text-[#64748B] hover:text-[#0E0E12]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">format_list_bulleted</span>
            <span className="font-headline-sm text-body-sm">{t('home_list_view', 'List')}</span>
          </button>
          <button
            type="button"
            onClick={() => setHomeSubView('calendar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body-sm transition-all cursor-pointer ${
              homeSubView === 'calendar'
                ? 'bg-white text-[#0E0E12] font-semibold shadow-sm'
                : 'text-[#64748B] hover:text-[#0E0E12]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">calendar_month</span>
            <span className="font-headline-sm text-body-sm">{t('home_calendar_view', 'Calendar')}</span>
          </button>
        </div>
        <span className="font-label-tabular text-label-micro text-[#64748B] hidden sm:inline-block font-medium">
          {lastSyncedText}
        </span>
      </div>

      {/* If Calendar subview is chosen, show Calendar layout */}
      {homeSubView === 'calendar' ? (
        <CalendarView />
      ) : (
        /* 2-Column Dashboard Grid */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Academic Focus & Momentum (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Academic Briefing Header with dynamic Supabase quote */}
            <section className="flex flex-col gap-2 bg-white border border-[#E2E8F0] p-6 rounded-xl shadow-xs">
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <h1 className="font-display-hero text-display-hero text-[#0E0E12] tracking-tight font-bold text-3xl sm:text-4xl">
                  <span className="inline-flex items-center gap-2">
                    <span className="capy-peek inline-flex">
                      <Capy size={48} mood="happy" wave title="Capy waving hello" />
                    </span>
                    <span>{greetingText}</span>
                  </span>
                </h1>
                <span className="font-label-tabular text-label-tabular text-[#B45309] font-medium px-3 py-1 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg">
                  {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                </span>
              </div>
              {activeQuote && (
                <p className="font-body-md text-body-md text-[#64748B] italic mt-1">
                  “{activeQuote.quote_text}”{' '}
                  <span className="not-italic text-[#94A3B8]">
                    — {activeQuote.speaker}{activeQuote.source_title ? `, ${activeQuote.source_title}` : ''}
                  </span>
                </p>
              )}
            </section>

            <HowItWorksNudge />

            <CapyCorner />

            {/* Change alerts from calendar syncs */}
            {changeAlerts.length > 0 && (
              <section className="rounded-xl border border-[#F2A93B]/50 bg-[#FFFBEB] p-3 flex flex-col gap-2" aria-label="Schedule changes">
                {changeAlerts.map((a) => (
                  <div key={a.id} className="flex items-start gap-2 text-sm">
                    <span className="material-symbols-outlined text-[18px] text-[#B45309]">
                      {a.kind.includes('removed') ? 'event_busy' : 'update'}
                    </span>
                    <span className="flex-1 text-[#1E293B]">{a.message}</span>
                    <button
                      type="button"
                      onClick={() => dismissAlert(a.id)}
                      aria-label="Dismiss"
                      className="text-[#64748B] hover:text-[#0E0E12]"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                ))}
              </section>
            )}

            {/* Next class + paste a change */}
            <div className="flex flex-wrap items-center gap-2">
              {nextClass && (
                <button
                  type="button"
                  onClick={() =>
                    setEditItem({
                      type: 'class',
                      id: nextClass.cls.id,
                      external_id: nextClass.cls.external_id,
                      title: nextClass.cls.title,
                      course: nextClass.cls.course,
                      start: nextClass.cls.starts_at,
                      end: nextClass.cls.ends_at
                    })
                  }
                  className="flex-1 min-w-[220px] text-left px-3 py-2 rounded-xl bg-white border border-[#C9D1DB] text-sm text-[#1E293B] hover:border-[#94A3B8]"
                  title="Tap if this class moved or was cancelled"
                >
                  <span className="font-semibold">{nextClass.label}:</span> {nextClass.cls.course} · {fmtT(nextClass.cls.starts_at)}
                  {nextClass.cls.ends_at ? `–${fmtT(nextClass.cls.ends_at)}` : ''}
                  {nextClass.cls.location ? ` · ${nextClass.cls.location}` : ''}
                </button>
              )}
              <button
                type="button"
                onClick={() => setPasteOpen(true)}
                className="px-3 py-2 rounded-xl bg-white border border-[#C9D1DB] text-sm font-semibold text-[#0E0E12] hover:border-[#D4A94F] flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[18px]">edit_calendar</span>
                Paste a change
              </button>
            </div>

            {/* Achievement strip: gold glow only once something is earned */}
            {hasProgress && progress ? (
              <section className="relative rounded-xl bg-[#FFFDF5] border border-[#FDE68A] p-4 shadow-[0_4px_20px_rgba(212,169,79,0.16)]">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-[#FEF3C7] border border-[#FCD34D] flex items-center justify-center text-[#D97706] shadow-xs">
                      <span className="material-symbols-outlined text-[28px]">local_fire_department</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-headline-md text-headline-md text-[#78350F] font-bold tracking-tight">
                        {progress.week_streak}-week streak
                      </span>
                      <span className="font-label-tabular text-label-tabular text-[#92400E]">
                        {progress.quizzes_this_week} {progress.quizzes_this_week === 1 ? 'quiz' : 'quizzes'} this week
                        {progress.avg_score_pct_30d !== null ? ` · avg ${progress.avg_score_pct_30d}%` : ''}
                      </span>
                    </div>
                  </div>
                  {progress.last_quiz && progress.last_quiz.total ? (
                    <div className="flex flex-col text-right">
                      <span className="font-label-micro text-label-micro text-[#92400E] font-semibold">Latest quiz</span>
                      <span className="font-headline-md text-headline-md text-[#78350F] font-bold">
                        {progress.last_quiz.score} / {progress.last_quiz.total}
                      </span>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : (
              <section className="rounded-xl bg-white border border-[#E2E8F0] p-4 flex items-center gap-3">
                <span className="material-symbols-outlined text-[24px] text-[#94A3B8]">local_fire_department</span>
                <span className="font-body-sm text-[#64748B]">Take your first quiz to start a streak.</span>
              </section>
            )}

            {/* Due soon: explicit deadlines + key events only (classes live in the calendar) */}
            <section className="flex flex-col bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="font-headline-sm text-headline-sm text-[#0E0E12] font-bold">
                    {t('home_due_soon', 'Due soon')}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569] font-label-tabular text-label-micro font-semibold border border-[#E2E8F0]">
                    {nearDue.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveScreen('matrix')}
                  className="font-label-tabular text-label-tabular text-[#B45309] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  View all deadlines
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>

              <div className="flex flex-col divide-y divide-[#E2E8F0]">
                {nearDue.length === 0 && farDue.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#64748B] flex flex-col items-center gap-2">
                    <span className="italic">
                      {farAll.length
                        ? `Nothing due in the next ${FAR_DAYS} days. ${farAll.length} later deadline${farAll.length === 1 ? '' : 's'} checked this week.`
                        : 'Nothing due. Deadlines come from your course outlines, Telegram groups, or things you add.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveScreen('matrix')}
                      className="px-3 py-1.5 rounded-lg border border-[#C9D1DB] text-[#0E0E12] font-semibold not-italic hover:border-[#D4A94F]"
                    >
                      Upload a course outline
                    </button>
                  </div>
                ) : (
                  nearDue.slice(0, 5).map((item) => {
                    const rel = relDue(item.when);
                    return (
                      <div
                        key={item.key}
                        className="group w-full flex items-center justify-between py-3 hover:bg-[#F8FAFC] px-1 rounded-lg transition-colors"
                      >
                        <button type="button" onClick={item.onOpen} className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer">
                          <span className="material-symbols-outlined text-[18px] text-[#B45309] shrink-0" aria-hidden="true">
                            {item.kind === 'deadline' || item.kind === 'eventdue' ? 'flag' : item.kind === 'register' ? 'how_to_reg' : 'celebration'}
                          </span>
                          <div className="px-2 py-0.5 rounded bg-[#FEF3C7] border border-[#FDE68A] font-label-tabular text-label-micro text-[#B45309] font-bold shrink-0 max-w-[110px] truncate">
                            {item.tag}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-body-md text-body-md text-[#0E0E12] font-semibold truncate">{item.title}</span>
                            <span className="font-label-tabular text-label-micro text-[#64748B]">
                              {item.sub} •{' '}
                              {new Date(item.when).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </div>
                        </button>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className={`px-2.5 py-0.5 rounded-full font-label-tabular text-label-micro font-bold ${rel.cls}`}>{rel.text}</span>
                          {(item.kind === 'register' || item.kind === 'eventdue') && item.eventId ? (
                            <button
                              type="button"
                              onClick={() => toggleEventRegister(item.eventId!)}
                              title="I've registered. Hide this."
                              aria-label={`Done: registered for ${item.title}`}
                              className="px-2 py-0.5 rounded-lg border border-[#C9D1DB] text-xs font-semibold text-[#0E0E12] hover:border-emerald-500 hover:text-emerald-700 flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[14px]">check</span>
                              Done
                            </button>
                          ) : (
                            <span className="material-symbols-outlined text-[18px] text-[#94A3B8] group-hover:translate-x-1 transition-transform">chevron_right</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {farDue.length > 0 && (
                <div className="mt-3 pt-3 border-t border-dashed border-[#CBD5E1] flex flex-col gap-2" aria-label="Weekly check-in">
                  <p className="text-[11px] uppercase tracking-wider text-[#64748B] font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">event_repeat</span>
                    Weekly check-in · more than {FAR_DAYS} days away
                  </p>
                  {farDue.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-2 text-sm">
                      <button type="button" onClick={item.onOpen} className="min-w-0 flex-1 text-left flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-[#94A3B8] shrink-0">
                          {item.kind === 'deadline' || item.kind === 'eventdue' ? 'flag' : item.kind === 'register' ? 'how_to_reg' : 'celebration'}
                        </span>
                        <span className="truncate text-[#334155]">{item.title}</span>
                        <span className="text-xs text-[#64748B] shrink-0">
                          {new Date(item.when).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} · in{' '}
                          {Math.ceil((new Date(item.when).getTime() - Date.now()) / 864e5)} days
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => markSeen(item.key)}
                        title="Hide until next week. It moves to Due soon when it's 15 days away."
                        className="shrink-0 px-2 py-0.5 rounded-lg border border-[#C9D1DB] text-xs font-semibold text-[#475569] hover:text-[#0E0E12]"
                      >
                        Seen it
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Electric Violet CTA: Start a 5-question quiz */}
            <section>
              <button
                type="button"
                onClick={() => {
                  if (quiz.score != null) setQuiz({ id: '', note_id: null, questions: [], score: null });
                  setActiveScreen('quiz');
                }}
                className="w-full relative group overflow-hidden rounded-xl bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#4338CA] p-5 text-left shadow-md transition-transform active:scale-[0.99] flex items-center justify-between border-0 text-white cursor-pointer"
              >
                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                <div className="flex items-center gap-4 z-10">
                  <div className="w-12 h-12 rounded-xl bg-white/15 text-white flex items-center justify-center shadow-inner">
                    <span className="material-symbols-outlined text-[26px]">psychology</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-headline-sm text-headline-sm text-white font-bold flex items-center gap-1.5">
                      Quiz a whole course
                      <span className="material-symbols-outlined text-[18px] text-white/90 group-hover:translate-x-1 transition-transform">
                        arrow_forward
                      </span>
                    </span>
                    <span className="font-body-sm text-body-sm text-indigo-100 font-medium">
                      Pick a course. Questions from every week you've noted.
                    </span>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-lg text-white font-semibold z-10 border border-white/20">
                  <span className="font-label-tabular text-label-tabular">{t('home_quick_jump', 'Quick Start')}</span>
                  <span className="material-symbols-outlined text-[14px]">bolt</span>
                </div>
              </button>
            </section>

          </div>

          {/* RIGHT COLUMN: Live & Upcoming Events Panel (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Exam countdown: top of the right column, above your events */}
            {examSoon.length > 0 && (
              <section className="flex flex-col gap-3 bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs" aria-label="Exam countdown">
                <div className="flex items-start gap-3">
                  <Capy
                    size={52}
                    mood={daysUntil(examSoon[0].due_date) <= 14 ? 'thinking' : 'happy'}
                    react
                    title={daysUntil(examSoon[0].due_date) <= 14 ? 'Capy in revision mode' : 'Capy, chilling'}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-[#64748B] font-semibold">Exam countdown</p>
                    <p className="font-headline-sm text-[#0E0E12] font-bold leading-snug">
                      {countdownTitle(daysUntil(examSoon[0].due_date))}
                    </p>
                    <p className="text-[11px] text-[#8B5E2F] font-semibold mt-0.5">
                      {daysUntil(examSoon[0].due_date) <= 14 ? 'Capy has the detective hat on. Revision mode 🔍' : 'Capy says: chill pace, steady wins 🍊'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-[#F1F5F9] border border-[#E2E8F0] text-[#0E0E12] shrink-0">
                    <span className="text-2xl font-bold leading-none">{Math.max(0, daysUntil(examSoon[0].due_date))}</span>
                    <span className="text-[10px] font-semibold text-[#64748B]">{daysUntil(examSoon[0].due_date) === 1 ? 'day' : 'days'}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[#0E0E12] truncate">{examName(examSoon[0].title)}</p>
                    <p className="text-xs text-[#64748B]">
                      {[realCourse(examSoon[0].course), new Date(examSoon[0].due_date).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </div>
                {examSoon.length > 1 && (
                  <ul className="flex flex-col gap-1.5 border-t border-[#E2E8F0] pt-3">
                    {examSoon.slice(1, 5).map((x) => (
                      <li key={x.id} className="flex items-center justify-between text-sm gap-2">
                        <span className="truncate text-[#1E293B]">{examName(x.title)}</span>
                        <span className="text-xs text-[#64748B] shrink-0">{daysUntil(x.due_date)} days</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-headline-sm text-[#0E0E12] font-bold tracking-tight">
                  Your upcoming events
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#EDE9FE] text-[#7C3AED] border border-[#DDD6FE] font-label-tabular text-label-micro font-bold">
                  {filteredEvents.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveScreen('events')}
                className="font-label-tabular text-label-tabular text-[#64748B] hover:text-[#0E0E12] flex items-center gap-0.5 font-medium cursor-pointer"
              >
                See all
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>

            {filteredEvents.length === 0 && (
              <button
                type="button"
                onClick={() => setActiveScreen('events')}
                className="rounded-2xl border border-dashed border-[#C9D1DB] p-5 text-left text-sm text-[#64748B] hover:border-[#FF4FA3]"
              >
                <span className="font-semibold text-[#0E0E12] block">No events yet</span>
                Snap a poster, paste an email or forward from Telegram. Bimbam tracks the date, registration deadline and
                reminders.
              </button>
            )}

            {/* Event Cards */}
            {filteredEvents.slice(0, 3).map((ev) => {
              const isRegistered = Boolean(userEventInterests[ev.id]);
              const hasReminder = Boolean(reminders[ev.id]);

              return (
                <div
                  key={ev.id}
                  className="relative rounded-2xl bg-white border border-[#E2E8F0] p-5 flex flex-col gap-3 shadow-xs hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-block transform -rotate-1 rounded-full border font-headline-sm text-label-micro uppercase tracking-wider px-3 py-0.5 font-bold shadow-2xs ${
                        daysUntil(
                          ev.registration_deadline && !isRegistered && new Date(ev.registration_deadline).getTime() > Date.now()
                            ? ev.registration_deadline
                            : ev.event_date
                        ) <= 14
                          ? 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]'
                          : 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]'
                      }`}
                    >
                      {ev.registration_deadline && !isRegistered && new Date(ev.registration_deadline).getTime() > Date.now()
                        ? `Register by ${new Date(ev.registration_deadline).toLocaleDateString([], { day: 'numeric', month: 'short' })}`
                        : ev.source === 'booking'
                        ? 'Booking'
                        : new Date(ev.event_date).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    {ev.attendees_count ? (
                      <div className="flex items-center gap-1 text-[#64748B] font-label-tabular text-label-micro font-medium">
                        <span className="material-symbols-outlined text-[16px] text-[#7C3AED]">groups</span>
                        <span>{ev.attendees_count} attending</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <h2 className="font-headline-sm text-headline-sm text-[#0E0E12] font-bold tracking-tight group-hover:text-[#4F46E5] transition-colors">
                      {ev.title}
                    </h2>
                    <p className="font-body-sm text-body-sm text-[#64748B]">
                      {new Date(ev.event_date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} • {ev.location}
                    </p>
                  </div>

                  {ev.banner_image && (
                    <div className="relative w-full h-28 rounded-xl overflow-hidden bg-[#F1F5F9] border border-[#E2E8F0]">
                      <img
                        className="w-full h-full object-cover"
                        src={ev.banner_image}
                        alt={ev.title}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                      <span className="absolute bottom-2 left-3 font-label-micro text-label-micro text-white bg-black/60 px-2 py-0.5 rounded backdrop-blur-xs font-medium">
                        {ev.location}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    {ev.registration_url && (
                      <a
                        href={ev.registration_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2.5 px-4 rounded-xl text-body-sm font-semibold text-center flex items-center justify-center gap-1.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white shadow-xs"
                      >
                        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                        <span>Sign up</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleEventReminder(ev.id)}
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                        hasReminder
                          ? 'bg-[#FEF3C7] border-[#FDE68A] text-[#D97706]'
                          : 'bg-[#F8FAFC] border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0E0E12]'
                      }`}
                      title={hasReminder ? t('events_reminded_badge', 'Reminder Set') : t('events_remind_btn', 'Set Reminder')}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {hasReminder ? 'bookmark' : 'bookmark_border'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}

          </div>
        </div>
      )}
      <PasteUpdateModal open={pasteOpen} onClose={() => setPasteOpen(false)} />
      <ChangeItemModal item={editItem} onClose={() => setEditItem(null)} />
    </div>
  );
};
