import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
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
    dismissAlert
  } = useApp();

  const [eventCategoryFilter, setEventCategoryFilter] = useState<string>('All');

  // Due soon: open deadlines from the last day onwards, soonest first
  const isDone = (status: string) => ['completed', 'cleared', 'done'].includes(String(status).toLowerCase());
  const pendingDeadlines = deadlines
    .filter((d) => !isDone(d.status) && new Date(d.due_date).getTime() > Date.now() - 864e5)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

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

  // Filter events
  const filteredEvents = events.filter((e) => {
    if (eventCategoryFilter === 'All') return true;
    return e.category?.toLowerCase() === eventCategoryFilter.toLowerCase();
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
      {/* Top Sync & Semester Cycle Context */}
      <div className="flex items-center justify-between py-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
          <span className="font-label-tabular text-label-tabular text-[#64748B]">
            {t('sync_notice', 'Synced from Supabase 5 min ago')}
          </span>
          <span className="text-[#CBD5E1] font-label-tabular text-label-tabular">/</span>
          <span className="font-label-tabular text-label-tabular text-[#94A3B8]">
            {t('semester_cycle', 'Semester Cycle 01')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#E2E8F0] rounded-full shadow-xs">
            <span className="material-symbols-outlined text-[14px] text-[#10B981]">verified_user</span>
            <span className="font-label-micro text-label-micro text-[#475569] uppercase tracking-wider font-semibold">
              {t('verified_sync', 'Verified Sync')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const idx = SUPPORTED_LANGUAGES.findIndex(l => l.code === language);
              const next = SUPPORTED_LANGUAGES[(idx + 1) % SUPPORTED_LANGUAGES.length];
              setLanguage(next.code);
            }}
            className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#0E0E12] rounded-lg transition-colors shadow-xs cursor-pointer"
            title="Switch Language"
          >
            <span className="text-xs">{SUPPORTED_LANGUAGES.find(l => l.code === language)?.flag}</span>
            <span className="font-label-tabular text-label-tabular uppercase tracking-wider font-semibold">{language}</span>
            <span className="material-symbols-outlined text-[14px] text-[#64748B]">arrow_drop_down</span>
          </button>
        </div>
      </div>

      {/* Segmented View Toggle Control (List vs Calendar) */}
      <div className="flex items-center justify-between py-1 mb-4">
        <div className="flex items-center p-1 bg-[#E2E8F0]/70 rounded-xl border border-[#CBD5E1]/60">
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
          {t('academic_focus_mode', 'Academic Focus Mode')}
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
                  {greetingText} <span className="inline-block transform hover:rotate-12 transition-transform select-none">👋</span>
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

            {/* Due Soon List Module */}
            <section className="flex flex-col bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="font-headline-sm text-headline-sm text-[#0E0E12] font-bold">
                    {t('home_due_soon', 'Due soon')}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569] font-label-tabular text-label-micro font-semibold border border-[#E2E8F0]">
                    {pendingDeadlines.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveScreen('matrix')}
                  className="font-label-tabular text-label-tabular text-[#B45309] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  {t('home_view_all_events', 'View all')}
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>

              <div className="flex flex-col divide-y divide-[#E2E8F0]">
                {pendingDeadlines.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#64748B] italic">
                    {t('home_all_caught_up', 'All caught up! No pending deadlines.')}
                  </div>
                ) : (
                  pendingDeadlines.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => toggleDeadline(item.id)}
                      className="group flex items-center justify-between py-3 hover:bg-[#F8FAFC] px-1 rounded-lg transition-colors cursor-pointer"
                      title="Click to toggle status"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {item.type === 'RSVP' ? (
                          <div className="w-7 h-7 rounded-lg bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center shrink-0 border border-[#DDD6FE]">
                            <span className="material-symbols-outlined text-[16px]">confirmation_number</span>
                          </div>
                        ) : (
                          <span className="w-1.5 h-8 rounded-full bg-[#D97706] shrink-0"></span>
                        )}

                        <div className="px-2 py-0.5 rounded bg-[#FEF3C7] border border-[#FDE68A] font-label-tabular text-label-micro text-[#B45309] font-bold shrink-0">
                          {item.course}
                        </div>

                        <div className="flex flex-col min-w-0">
                          <span className="font-body-md text-body-md text-[#0E0E12] font-semibold truncate group-hover:text-[#4F46E5] transition-colors">
                            {item.title}
                          </span>
                          <span className="font-label-tabular text-label-micro text-[#64748B]">
                            {String(item.source).startsWith('ics') ? 'School calendar' : item.source} •{' '}
                            {new Date(item.due_date).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] font-label-tabular text-label-micro font-bold uppercase border border-[#FDE68A]">
                          {item.type}
                        </span>
                        <span className="material-symbols-outlined text-[18px] text-[#94A3B8] group-hover:translate-x-1 transition-transform">
                          chevron_right
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Electric Violet CTA: Start a 5-question quiz */}
            <section>
              <button
                type="button"
                onClick={() => setActiveScreen('notes')}
                className="w-full relative group overflow-hidden rounded-xl bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#4338CA] p-5 text-left shadow-md transition-transform active:scale-[0.99] flex items-center justify-between border-0 text-white cursor-pointer"
              >
                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                <div className="flex items-center gap-4 z-10">
                  <div className="w-12 h-12 rounded-xl bg-white/15 text-white flex items-center justify-center shadow-inner">
                    <span className="material-symbols-outlined text-[26px]">psychology</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-headline-sm text-headline-sm text-white font-bold flex items-center gap-1.5">
                      {t('quiz_header_title', 'Start a 5-question quiz')}
                      <span className="material-symbols-outlined text-[18px] text-white/90 group-hover:translate-x-1 transition-transform">
                        arrow_forward
                      </span>
                    </span>
                    <span className="font-body-sm text-body-sm text-indigo-100 font-medium">
                      Pick a week's note in Notes, then tap Quiz me
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
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-headline-sm text-[#0E0E12] font-bold tracking-tight">
                  {t('events_header_title', 'Live & Upcoming Events')}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#EDE9FE] text-[#7C3AED] border border-[#DDD6FE] font-label-tabular text-label-micro font-bold">
                  {events.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveScreen('events')}
                className="font-label-tabular text-label-tabular text-[#64748B] hover:text-[#0E0E12] flex items-center gap-0.5 font-medium cursor-pointer"
              >
                {t('events_cat_all', 'All Events')}
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>

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
                    <span className="inline-block transform -rotate-1 rounded-full bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA] font-headline-sm text-label-micro uppercase tracking-wider px-3 py-0.5 font-bold shadow-2xs">
                      {ev.category || 'EVENT'}
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
                    <button
                      type="button"
                      onClick={() => toggleEventRegister(ev.id)}
                      className={`flex-1 py-2.5 px-4 rounded-xl font-headline-sm text-body-sm font-semibold transition-all transform active:scale-95 text-center flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
                        isRegistered
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-[#4F46E5] hover:bg-[#4338CA] text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {isRegistered ? 'check_circle' : 'how_to_reg'}
                      </span>
                      <span>{isRegistered ? t('events_registered_badge', 'Registered ✓') : t('events_register_btn', 'RSVP / Register')}</span>
                    </button>

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
