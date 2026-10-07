import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ChangeItemModal, EditableItem } from '../components/ChangeItemModal';

type CalItem = {
  id: string;
  category: 'Assignment' | 'Quiz' | 'Event' | 'Class';
  categoryBadge: string;
  time: string;
  courseOrHost: string;
  title: string;
  subtitle: string;
  weightOrStatus: string;
  actionText: string;
  actionType: 'note' | 'event';
  course?: string;
  dateMs: number;
  edit?: EditableItem;
};

const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const DONE = ['completed', 'cleared', 'done'];

export const CalendarView: React.FC = () => {
  const { deadlines, events, classes, setActiveScreen, setSelectedCourse, t } = useApp();
  const [editItem, setEditItem] = useState<EditableItem | null>(null);

  const today = new Date();
  const todayKey = toKey(today);
  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedKey, setSelectedKey] = useState<string>(todayKey);
  const [filterType, setFilterType] = useState<'all' | 'deadlines' | 'events'>('all');

  // Real deadlines + events grouped by local calendar day
  const itemsByDay = useMemo(() => {
    const map: Record<string, CalItem[]> = {};
    const add = (d: Date, item: CalItem) => {
      const k = toKey(d);
      (map[k] ||= []).push(item);
    };
    for (const dl of deadlines) {
      const d = new Date(dl.due_date);
      if (!dl.due_date || isNaN(d.getTime())) continue;
      const done = DONE.includes(String(dl.status).toLowerCase());
      add(d, {
        id: `d-${dl.id}`,
        category: /quiz/i.test(String(dl.type)) ? 'Quiz' : 'Assignment',
        categoryBadge: dl.type ? String(dl.type) : 'Deadline',
        time: fmtTime(d),
        courseOrHost: dl.course || '',
        title: dl.title,
        subtitle: String(dl.source).startsWith('ics') ? 'From your school calendar' : 'Added by you',
        weightOrStatus: done ? 'Done' : 'Due',
        actionText: 'Open notes',
        actionType: 'note',
        course: dl.course,
        dateMs: d.getTime(),
        edit: { type: 'deadline', id: dl.id, title: dl.title, course: dl.course, start: dl.due_date }
      });
    }
    for (const ev of events) {
      const d = new Date(ev.event_date);
      if (!ev.event_date || isNaN(d.getTime())) continue;
      add(d, {
        id: `e-${ev.id}`,
        category: 'Event',
        categoryBadge: 'Event',
        time: fmtTime(d),
        courseOrHost: ev.source || '',
        title: ev.title,
        subtitle: ev.location || '',
        weightOrStatus: '',
        actionText: 'View event',
        actionType: 'event',
        dateMs: d.getTime()
      });
    }
    for (const c of classes) {
      const d = new Date(c.starts_at);
      add(d, {
        id: `c-${c.id}`,
        category: 'Class',
        categoryBadge: 'Class',
        time: c.ends_at ? `${fmtTime(d)}–${fmtTime(new Date(c.ends_at))}` : fmtTime(d),
        courseOrHost: c.course || '',
        title: c.title,
        subtitle: c.location || '',
        weightOrStatus: '',
        actionText: 'Open notes',
        actionType: 'note',
        course: c.course,
        dateMs: d.getTime(),
        edit: { type: 'class', id: c.id, external_id: c.external_id, title: c.title, course: c.course, start: c.starts_at, end: c.ends_at }
      });
    }
    Object.values(map).forEach((list) => list.sort((a, b) => a.dateMs - b.dateMs));
    return map;
  }, [deadlines, events, classes]);

  // Month grid, weeks starting Monday
  const calendarCells = useMemo(() => {
    const y = viewMonth.getFullYear();
    const m = viewMonth.getMonth();
    const startOffset = (viewMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const total = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const d = new Date(y, m, 1 - startOffset + i);
      const key = toKey(d);
      const items = itemsByDay[key] || [];
      const dueItems = items.filter((x) => x.category === 'Assignment' || x.category === 'Quiz');
      const eventItems = items.filter((x) => x.category === 'Event');
      return {
        key,
        day: d.getDate(),
        prevMonth: i < startOffset,
        nextMonth: i >= startOffset + daysInMonth,
        isToday: key === todayKey,
        hasDeadline: dueItems.length > 0,
        hasEvent: eventItems.length > 0,
        label: dueItems.length > 1 ? `${dueItems.length} due` : dueItems[0]?.title,
        eventLabel: eventItems[0]?.title
      };
    });
  }, [viewMonth, itemsByDay, todayKey]);

  const selectedDay = new Date(`${selectedKey}T00:00:00`);
  const selectedItems = itemsByDay[selectedKey] || [];
  const dueCount = selectedItems.filter((x) => x.category === 'Assignment' || x.category === 'Quiz').length;
  const classCount = selectedItems.filter((x) => x.category === 'Class').length;
  const eventCount = selectedItems.length - dueCount - classCount;
  const currentInspector = {
    dateLabel: selectedDay.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
    subtext: selectedItems.length
      ? [
          dueCount ? `${dueCount} due` : '',
          classCount ? `${classCount} class${classCount > 1 ? 'es' : ''}` : '',
          eventCount ? `${eventCount} event${eventCount > 1 ? 's' : ''}` : ''
        ]
          .filter(Boolean)
          .join(', ') + ' on this day.'
      : 'Nothing scheduled on this day.',
    items: selectedItems
  };

  const filteredItems = currentInspector.items.filter((item) => {
    if (filterType === 'deadlines') return item.category === 'Assignment' || item.category === 'Quiz';
    if (filterType === 'events') return item.category === 'Event';
    return true;
  });

  const handleAction = (item: CalItem) => {
    if (item.actionType === 'note') {
      if (item.course) setSelectedCourse(item.course);
      setActiveScreen('notes');
    } else {
      setActiveScreen('events');
    }
  };

  const shiftMonth = (delta: number) =>
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  const hasSchoolCalendar = deadlines.some((d) => String(d.source).startsWith('ics'));

  return (
    <div className="flex flex-col w-full gap-5">
      {/* Month Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-[#E2E8F0] rounded-xl px-1 py-1 shadow-xs">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#0E0E12] hover:bg-slate-100 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="px-4 font-headline-sm text-headline-sm text-[#0E0E12] font-bold tracking-tight">
              {viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#0E0E12] hover:bg-slate-100 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
              setSelectedKey(todayKey);
            }}
            className="px-4 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#0E0E12] font-label-tabular text-label-tabular font-medium transition-colors shadow-xs cursor-pointer"
          >
            {t('cal_today_btn', 'Today')}
          </button>
        </div>

        {/* Sync notification tag */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#E2E8F0] text-[#64748B] font-label-micro text-label-micro shadow-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <span>{hasSchoolCalendar ? 'School calendar connected' : 'Connect your school calendar in More'}</span>
        </div>
      </div>

      {/* Two-Column Workspace Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Month Grid (8 Cols on xl) */}
        <div className="xl:col-span-8 flex flex-col gap-4 bg-white border border-[#C9D1DB] rounded-xl p-5 shadow-xs">
          {/* Day Headers (Mon - Sun) */}
          <div className="grid grid-cols-7 gap-1 text-center pb-2 border-b border-[#E2E8F0]">
            {[
              t('cal_mon', 'Mon'),
              t('cal_tue', 'Tue'),
              t('cal_wed', 'Wed'),
              t('cal_thu', 'Thu'),
              t('cal_fri', 'Fri'),
              t('cal_sat', 'Sat'),
              t('cal_sun', 'Sun')
            ].map((day, idx) => (
              <div
                key={idx}
                className="font-label-tabular text-label-tabular text-[#64748B] uppercase tracking-wider py-1 font-semibold"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid Cells */}
          <div className="grid grid-cols-7 gap-1 bg-[#F8FAFC] rounded-xl p-1">
            {calendarCells.map((cell, idx) => {
              const isSelected = selectedKey === cell.key && !cell.prevMonth && !cell.nextMonth;
              const isToday = cell.isToday;

              return (
                <div
                  key={cell.key}
                  onClick={() => {
                    if (!cell.prevMonth && !cell.nextMonth) {
                      setSelectedKey(cell.key);
                    }
                  }}
                  className={`min-h-[105px] p-1.5 rounded-lg flex flex-col justify-between transition-all cursor-pointer ${
                    cell.prevMonth || cell.nextMonth
                      ? 'bg-slate-50 border border-[#E2E8F0]/70 opacity-40 cursor-default'
                      : isSelected
                      ? 'bg-amber-50/80 border-2 border-amber-400 shadow-xs'
                      : isToday
                      ? 'bg-white border-2 border-amber-300 hover:border-amber-400'
                      : 'bg-white border border-[#E2E8F0] hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-label-tabular text-label-tabular ${
                        isToday
                          ? 'w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs'
                          : isSelected
                          ? 'font-bold text-amber-900'
                          : 'text-[#1E293B]'
                      }`}
                    >
                      {cell.day}
                    </span>

                    {isToday && (
                      <span className="font-label-micro text-label-micro font-bold text-amber-700 uppercase bg-amber-100/90 px-1 py-0.5 rounded">
                        Today
                      </span>
                    )}
                  </div>

                  {/* Badges inside date cell */}
                  <div className="flex flex-col gap-1 mt-1">
                    {cell.hasDeadline && (
                      <div className="px-1 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-label-micro text-label-micro truncate font-semibold">
                        {cell.label || 'Deadline'}
                      </div>
                    )}
                    {cell.hasEvent && (
                      <div className="px-1 py-0.5 rounded bg-purple-50 border border-purple-200 text-purple-800 font-label-micro text-label-micro truncate font-semibold">
                        {cell.eventLabel || 'Event'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Calendar Legend */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-1 mt-1 text-xs text-[#64748B]">
            <div className="flex flex-wrap items-center gap-5">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-amber-500"></span>
                <span className="font-label-tabular text-label-tabular">Deadlines & Quizzes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-purple-600"></span>
                <span className="font-label-tabular text-label-tabular">Campus & Career Events</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center text-white font-label-micro text-[10px] font-bold">
                  {today.getDate()}
                </span>
                <span className="font-label-tabular text-label-tabular">Today</span>
              </div>
            </div>
            <span>Tap a date to see what's on</span>
          </div>
        </div>

        {/* RIGHT COLUMN: Active Inspector Panel (4 Cols on xl) */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          {/* Inspector Header Card */}
          <div className="bg-white border border-[#C9D1DB] rounded-xl p-5 flex flex-col gap-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-[20px]">calendar_today</span>
                <span className="font-label-micro text-label-micro font-semibold uppercase tracking-wider text-amber-700">
                  Selected day
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-md bg-slate-100 border border-[#E2E8F0] text-[#1E293B] font-label-tabular text-label-tabular font-medium">
                {currentInspector.items.length} {currentInspector.items.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            <div>
              <h2 className="font-headline-lg text-headline-md sm:text-headline-lg text-[#0E0E12] font-bold tracking-tight">
                {currentInspector.dateLabel}
              </h2>
              <p className="font-body-sm text-body-sm text-[#64748B] mt-0.5">
                {currentInspector.subtext}
              </p>
            </div>

            {/* Filter Sub-toggles */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 border border-[#E2E8F0] rounded-xl">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`py-1 px-2 text-center rounded-lg font-body-sm text-xs font-semibold transition-all cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-white text-[#0E0E12] shadow-xs border border-[#E2E8F0]'
                    : 'text-[#64748B] hover:text-[#0E0E12]'
                }`}
              >
                {t('cal_all_items', 'All')} ({currentInspector.items.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('deadlines')}
                className={`py-1 px-2 text-center rounded-lg font-body-sm text-xs font-semibold transition-all cursor-pointer ${
                  filterType === 'deadlines'
                    ? 'bg-white text-[#0E0E12] shadow-xs border border-[#E2E8F0]'
                    : 'text-[#64748B] hover:text-[#0E0E12]'
                }`}
              >
                {t('cal_deadlines_only', 'Deadlines')}
              </button>
              <button
                type="button"
                onClick={() => setFilterType('events')}
                className={`py-1 px-2 text-center rounded-lg font-body-sm text-xs font-semibold transition-all cursor-pointer ${
                  filterType === 'events'
                    ? 'bg-white text-[#0E0E12] shadow-xs border border-[#E2E8F0]'
                    : 'text-[#64748B] hover:text-[#0E0E12]'
                }`}
              >
                {t('cal_events_only', 'Events')}
              </button>
            </div>
          </div>

          {/* Scheduled Item Cards */}
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => {
              const isEvent = item.category === 'Event';
              return (
                <div
                  key={item.id}
                  className="bg-white border border-[#C9D1DB] rounded-xl p-4 flex flex-col gap-3 shadow-xs relative overflow-hidden group hover:border-slate-400 transition-colors"
                >
                  {/* Priority bar */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                      isEvent ? 'bg-purple-600' : 'bg-amber-500'
                    }`}
                  ></div>

                  <div className="pl-2 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-label-micro text-label-micro uppercase font-semibold px-2 py-0.5 rounded tracking-wider ${
                          isEvent
                            ? 'text-purple-800 bg-purple-50 border border-purple-200'
                            : 'text-amber-800 bg-amber-50 border border-amber-200'
                        }`}
                      >
                        {item.categoryBadge}
                      </span>
                      <span
                        className={`font-label-tabular text-label-tabular font-semibold ${
                          isEvent ? 'text-purple-800' : 'text-amber-700'
                        }`}
                      >
                        {item.time}
                      </span>
                    </div>

                    <div>
                      <div className="font-label-tabular text-label-tabular text-[#64748B] font-medium">
                        {item.courseOrHost}
                      </div>
                      <h3 className="font-headline-sm text-headline-sm text-[#0E0E12] tracking-tight mt-0.5 font-bold">
                        {item.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-[#64748B] pt-0.5">
                      <span className="material-symbols-outlined text-[15px] text-[#64748B]">
                        {isEvent ? 'location_on' : 'sync_saved_locally'}
                      </span>
                      <span>{item.subtitle}</span>
                    </div>
                  </div>

                  <div className="pl-2 pt-2 flex items-center justify-between border-t border-[#E2E8F0]">
                    <span className="font-label-micro text-label-micro text-[#64748B] uppercase font-medium">
                      {item.weightOrStatus}
                    </span>
                    {item.edit && (
                      <button
                        type="button"
                        onClick={() => setEditItem(item.edit!)}
                        title="Moved or cancelled?"
                        aria-label={`Change ${item.title}`}
                        className="px-2 py-1.5 rounded-xl bg-white border border-[#E2E8F0] hover:bg-slate-100 text-[#475569]"
                      >
                        <span className="material-symbols-outlined text-[15px]">edit_calendar</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAction(item)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-50 border border-[#E2E8F0] hover:bg-slate-100 text-[#0E0E12] font-body-sm text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>{item.actionText}</span>
                      <span className="material-symbols-outlined text-[15px]">north_east</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 rounded-xl bg-white border border-[#C9D1DB] text-center flex flex-col items-center justify-center gap-2 text-[#64748B]">
              <span className="material-symbols-outlined text-[32px] text-slate-400">event_available</span>
              <span className="font-body-sm">Nothing here for this day.</span>
            </div>
          )}

          {/* Footnote */}
          <div className="px-4 py-2.5 rounded-xl bg-white border border-[#E2E8F0] flex items-center gap-2 text-[#64748B] shadow-xs">
            <span className="material-symbols-outlined text-amber-600 text-[18px]">verified</span>
            <span className="font-label-micro text-label-micro leading-snug">
              Deadlines come from your school calendar and anything you add yourself.
            </span>
          </div>
        </div>
      </div>
      <ChangeItemModal item={editItem} onClose={() => setEditItem(null)} />
    </div>
  );
};
