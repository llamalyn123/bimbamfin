import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { sourceLabel } from '../lib/labels';
import { PasteUpdateModal } from '../components/PasteUpdateModal';
import { ChangeItemModal, EditableItem } from '../components/ChangeItemModal';
import { OutlineUploadModal } from '../components/OutlineUploadModal';
import { AddDeadlineModal } from '../components/AddDeadlineModal';

export const DeadlineMatrixView: React.FC = () => {
  const {
    deadlines,
    toggleDeadline,
    setActiveScreen,
    setSelectedCourse,
    setSelectedWeek,
    refreshFromSupabase,
    isSyncing,
    t
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('All');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [isArchiveOpen, setIsArchiveOpen] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [pasteOpen, setPasteOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [editItem, setEditItem] = useState<EditableItem | null>(null);

  const isDone = (status: string) => ['completed', 'cleared', 'done'].includes(String(status).toLowerCase());
  const now = Date.now();
  const hoursLeft = (due: string) => (new Date(due).getTime() - now) / 36e5;

  // Stats calculation
  const pendingCount = deadlines.filter(d => !isDone(d.status)).length;
  const clearedCount = deadlines.filter(d => isDone(d.status)).length;
  const urgentCount = deadlines.filter(d => !isDone(d.status) && hoursLeft(d.due_date) <= 24).length;

  // Real course list from the student's own deadlines
  const courseOptions = Array.from(new Set(deadlines.map(d => d.course).filter(Boolean))).sort();
  const categoryOptions = ['All', ...Array.from(new Set(deadlines.map(d => String(d.type || '')).filter(Boolean))).sort()];

  // Filtered lists
  const filteredDeadlines = deadlines
    .filter(d => {
      if (selectedCourseFilter !== 'All' && d.course !== selectedCourseFilter) return false;
      if (selectedCategoryFilter !== 'All' && d.type !== selectedCategoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return [d.title, d.course, d.source].some(v => String(v || '').toLowerCase().includes(q));
      }
      return true;
    })
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const open = filteredDeadlines.filter(d => !isDone(d.status));
  const soonItems = open.filter(d => hoursLeft(d.due_date) <= 48);
  const weekItems = open.filter(d => hoursLeft(d.due_date) > 48 && hoursLeft(d.due_date) <= 24 * 7);
  const laterItems = open.filter(d => hoursLeft(d.due_date) > 24 * 7);
  const completedItems = filteredDeadlines.filter(d => isDone(d.status));

  const groups = [
    { key: 'soon', title: 'Next 48 hours', icon: 'emergency', iconClass: 'text-red-600', badgeClass: 'bg-red-100 text-red-800', items: soonItems },
    { key: 'week', title: 'This week', icon: 'event_upcoming', iconClass: 'text-[#D97706]', badgeClass: 'bg-[#FEF3C7] text-[#92400E]', items: weekItems },
    { key: 'later', title: 'Later', icon: 'schedule', iconClass: 'text-[#64748B]', badgeClass: 'bg-slate-100 text-[#475569]', items: laterItems }
  ];

  const dueLabel = (due: string) => {
    const h = hoursLeft(due);
    const d = new Date(due);
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (h < 0) return `Overdue · ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    if (d.toDateString() === today.toDateString()) return `Due today ${time}`;
    if (d.toDateString() === tomorrow.toDateString()) return `Due tomorrow ${time}`;
    return `Due ${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ${time}`;
  };

  const handleAction = (item: any) => {
    if (/rsvp|event/i.test(String(item.type))) {
      setActiveScreen('events');
    } else {
      if (item.course) setSelectedCourse(item.course);
      setActiveScreen('notes');
    }
  };

  const handleBatchMarkDone = () => {
    soonItems.forEach(item => toggleDeadline(item.id));
  };

  return (
    <div className="flex flex-col w-full pb-16">
      {/* 2-Column Active Matrix Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full items-start">
        {/* LEFT COLUMN: Filters, Search & Metrics Sidebar (xl:col-span-3) */}
        <aside className="xl:col-span-3 flex flex-col gap-4 w-full">
          {/* Breadcrumb Meta Panel */}
          <div className="p-4 rounded-xl bg-white border border-[#C9D1DB] shadow-xs flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
              <span className="font-label-micro uppercase tracking-wider text-[#92400E] font-bold">Workspace</span>
              <span>/</span>
              <span className="font-label-micro text-[#0E0E12]">Deadlines & Registrations</span>
            </div>
            <h2 className="font-headline-sm text-headline-sm text-[#0E0E12] font-bold mt-1 tracking-tight">
              {t('matrix_header_title', 'Active Matrix')}
            </h2>
            <p className="font-body-sm text-[#64748B]">
              {t('matrix_header_subtitle', 'Course deliverables & collegiate timeline')}
            </p>
          </div>

          {/* Search Input Container */}
          <div className="relative w-full rounded-xl bg-white border border-[#C9D1DB] p-1.5 transition-colors focus-within:border-[#C5983E]">
            <div className="flex items-center gap-2 px-2 py-1">
              <span className="material-symbols-outlined text-[#64748B] text-[18px]">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('matrix_search_placeholder', 'Search deadlines')}
                className="w-full bg-transparent font-body-sm text-body-sm text-[#0E0E12] placeholder:text-[#64748B] focus:outline-none"
              />
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 font-label-micro text-label-micro text-[#64748B] uppercase border border-slate-200">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* Quick Metrics Ribbon (Bento) */}
          <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-white border border-[#C9D1DB] shadow-xs">
            <div className="flex flex-col p-2.5 rounded-lg bg-[#FEF3C7] border border-[#FDE68A]">
              <span className="font-headline-sm text-headline-sm text-[#0E0E12] font-bold leading-tight">
                {pendingCount < 10 ? `0${pendingCount}` : pendingCount}
              </span>
              <span className="font-label-micro text-label-micro text-[#92400E] font-semibold uppercase mt-0.5">
                {t('matrix_status_pending', 'Pending')}
              </span>
            </div>
            <div className="flex flex-col p-2.5 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] relative overflow-hidden">
              <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#D97706]"></div>
              <span className="font-headline-sm text-headline-sm text-[#92400E] font-bold leading-tight">
                {urgentCount < 10 ? `0${urgentCount}` : urgentCount}
              </span>
              <span className="font-label-micro text-label-micro text-[#B45309] font-bold uppercase mt-0.5">
                {t('matrix_urgent_count', '<24h Left')}
              </span>
            </div>
            <div className="flex flex-col p-2.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0]">
              <span className="font-headline-sm text-headline-sm text-[#15803D] font-bold leading-tight">
                {clearedCount < 10 ? `0${clearedCount}` : clearedCount}
              </span>
              <span className="font-label-micro text-label-micro text-[#166534] font-semibold uppercase mt-0.5">
                {t('matrix_status_cleared', 'Cleared')}
              </span>
            </div>
          </div>

          {/* Filter Modules */}
          <div className="p-4 rounded-xl bg-white border border-[#C9D1DB] flex flex-col gap-4 shadow-xs">
            {/* Courses Filter */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between mb-1">
                <span className="font-label-micro text-label-micro uppercase tracking-wider text-[#64748B] font-semibold">
                  Courses & Sources
                </span>
                <span className="font-label-micro text-label-micro text-[#92400E] font-bold">{courseOptions.length} active</span>
              </div>

              {[
                { label: 'All courses', key: 'All', count: deadlines.length },
                ...courseOptions.map(c => ({ label: c, key: c, count: deadlines.filter(d => d.course === c).length }))
              ].map(c => {
                const isSelected = selectedCourseFilter === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setSelectedCourseFilter(c.key)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg font-label-tabular text-label-tabular transition-all ${
                      isSelected
                        ? 'bg-slate-100 text-[#0E0E12] font-bold border border-slate-300'
                        : 'text-[#4B5563] hover:bg-slate-50 hover:text-[#0E0E12]'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[#C5983E]' : 'bg-[#C9D1DB]'}`}></span>
                      {c.label}
                    </span>
                    <span className="font-label-micro text-label-micro px-1.5 py-0.5 rounded bg-slate-100 text-[#64748B]">
                      {c.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Type Selector */}
            <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-100">
              <span className="font-label-micro text-label-micro uppercase tracking-wider text-[#64748B] font-semibold mb-0.5">
                Deliverable Category
              </span>
              <div className="flex flex-wrap gap-1.5">
                {categoryOptions.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded font-label-tag text-label-tag transition-all cursor-pointer ${
                      selectedCategoryFilter === cat
                        ? 'bg-slate-900 text-white font-bold shadow-xs'
                        : 'bg-slate-100 text-[#4B5563] hover:bg-slate-200'
                    }`}
                  >
                    {cat === 'All' ? `All (${deadlines.length})` : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Action / Add Deadline Button */}
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="mt-1 w-full py-2.5 px-3 rounded-xl bg-white border border-[#C9D1DB] hover:bg-slate-50 text-[#92400E] flex items-center justify-center gap-1.5 transition-transform active:scale-[0.98] shadow-2xs font-semibold cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-[#C5983E]">add</span>
              <span className="font-label-tabular text-label-tabular tracking-wide">{t('matrix_add_deadline_btn', '+ Add Deadline')}</span>
            </button>
          </div>

        </aside>

        {/* RIGHT COLUMN: Schedule Matrix Table (xl:col-span-9) */}
        <main className="xl:col-span-9 flex flex-col gap-4 w-full min-w-0">
          {/* Top Action Bar & Control Header */}
          <div className="p-5 rounded-xl bg-white border border-[#C9D1DB] shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#D4A94F]"></span>
                <span className="font-label-micro text-label-micro uppercase tracking-wider text-[#64748B] font-bold">
                  Master Dispatch
                </span>
              </div>
              <h1 className="font-headline-lg text-headline-lg text-[#0E0E12] font-bold tracking-tight mt-0.5">
                Upcoming Deliverables & RSVPs
              </h1>
              <p className="font-body-sm text-[#64748B]">
                Sorted by due date
              </p>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              <button
                type="button"
                onClick={handleBatchMarkDone}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#0E0E12] transition-colors font-label-tabular text-label-tabular flex items-center gap-1.5 cursor-pointer font-medium"
              >
                <span className="material-symbols-outlined text-[16px] text-[#64748B]">checklist</span>
                <span>Mark next 48h done</span>
              </button>


              <button
                type="button"
                onClick={() => setOutlineOpen(true)}
                className="px-3.5 py-2 rounded-lg bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] transition-colors font-label-tabular text-label-tabular flex items-center gap-1.5 cursor-pointer font-bold"
              >
                <span className="material-symbols-outlined text-[16px]">upload_file</span>
                <span>Upload course outline</span>
              </button>
              <button
                type="button"
                onClick={() => setPasteOpen(true)}
                className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 border border-[#C9D1DB] text-[#0E0E12] transition-colors font-label-tabular text-label-tabular flex items-center gap-1.5 cursor-pointer font-medium"
              >
                <span className="material-symbols-outlined text-[16px]">edit_calendar</span>
                <span>Paste a change</span>
              </button>
              <button
                type="button"
                onClick={refreshFromSupabase}
                className="px-3.5 py-2 rounded-lg bg-[#C5983E] hover:bg-[#D4A94F] text-[#0E0E12] font-label-tabular text-label-tabular font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <span className={`material-symbols-outlined text-[16px] ${isSyncing ? 'animate-spin' : ''}`}>
                  sync
                </span>
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Schedule Table Shell */}
          <div className="w-full rounded-xl bg-white border border-[#C9D1DB] shadow-xs overflow-hidden flex flex-col">
            {/* Tabular Grid Header */}
            <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-50 text-[#64748B] font-label-micro text-label-micro uppercase tracking-wider items-center border-b border-[#C9D1DB]">
              <div className="col-span-1 flex items-center justify-center font-bold">Status</div>
              <div className="col-span-3 font-bold">Urgency / Due Horizon</div>
              <div className="col-span-2 font-bold">Source / Unit</div>
              <div className="col-span-4 font-bold">Deliverable & Notes</div>
              <div className="col-span-2 text-right font-bold">Direct Action</div>
            </div>

            {open.length === 0 && (
              <div className="p-8 flex flex-col items-center justify-center gap-2 text-center text-[#64748B]">
                <span className="material-symbols-outlined text-[32px] text-slate-400">task_alt</span>
                <span className="font-body-sm">
                  {deadlines.length === 0
                    ? 'No deadlines yet. Upload a course outline, use /due in a Telegram study group, or add one yourself.'
                    : 'Nothing open for these filters.'}
                </span>
                {deadlines.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setOutlineOpen(true)}
                    className="mt-1 px-3.5 py-2 rounded-lg bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] font-label-tabular text-xs font-bold"
                  >
                    Upload course outline
                  </button>
                )}
              </div>
            )}

            {groups.filter(g => g.items.length > 0).map(group => (
              <div key={group.key} className="flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-[#C9D1DB]">
                  <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined text-[18px] ${group.iconClass}`}>{group.icon}</span>
                    <span className="font-headline-sm text-headline-sm text-[#0E0E12] font-bold">{group.title}</span>
                    <span className={`px-2 py-0.5 rounded font-label-micro font-bold ${group.badgeClass}`}>
                      {group.items.length} due
                    </span>
                  </div>
                </div>

                {group.items.map(item => {
                  const urgent = hoursLeft(item.due_date) <= 24;
                  return (
                    <div
                      key={item.id}
                      className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 hover:bg-slate-50 transition-colors items-center border-b border-slate-100 group"
                    >
                      <div className="col-span-1 flex items-center md:justify-center">
                        <input
                          type="checkbox"
                          aria-label={`Mark ${item.title} done`}
                          checked={isDone(item.status)}
                          onChange={() => toggleDeadline(item.id)}
                          className="w-4 h-4 rounded text-[#D4A94F] focus:ring-[#D4A94F] border-slate-300 cursor-pointer"
                        />
                      </div>
                      <div className="col-span-3 flex flex-col gap-0.5">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded w-fit ${urgent ? 'bg-red-100 text-red-800' : 'bg-[#FEF3C7] text-[#92400E]'}`}>
                          <span className="material-symbols-outlined text-[14px]">{urgent ? 'warning' : 'schedule'}</span>
                          <span className="font-label-micro font-bold">{dueLabel(item.due_date)}</span>
                        </div>
                      </div>
                      <div className="col-span-2 flex flex-col">
                        <span className="font-label-tabular text-label-tabular text-[#0E0E12] font-bold">{item.course}</span>
                        <span className="font-body-sm text-xs text-[#64748B] truncate">
                          {sourceLabel(item.source)}
                        </span>
                      </div>
                      <div className="col-span-4 flex flex-col">
                        <span className="font-body-md text-[#0E0E12] font-semibold">{item.title}</span>
                        {item.type && (
                          <div className="flex items-center gap-2 mt-1 flex-wrap font-label-micro text-xs text-[#64748B]">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[#475569]">{item.type}</span>
                            {item.weight != null && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[#475569] font-semibold">{item.weight}%</span>}
                            {item.notes && <span className="truncate max-w-[280px]" title={item.notes}>{item.notes}</span>}
                          </div>
                        )}
                      </div>
                      <div className="col-span-2 flex justify-start md:justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setEditItem({ type: 'deadline', id: item.id, title: item.title, course: item.course, start: item.due_date })
                          }
                          title="Moved or cancelled?"
                          aria-label={`Change ${item.title}`}
                          className="px-2 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-[#C9D1DB] text-[#475569]"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit_calendar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAction(item)}
                          className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-[#C9D1DB] text-[#0E0E12] transition-all font-label-tabular text-xs font-semibold flex items-center gap-1 shadow-2xs"
                        >
                          <span>{/rsvp|event/i.test(String(item.type)) ? 'View event' : 'Open notes'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* ================= SECTION 4: COMPLETED DELIVERABLES ================= */}
            <div className="flex flex-col border-t border-[#C9D1DB]">
              <button
                type="button"
                onClick={() => setIsArchiveOpen(!isArchiveOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px]">verified</span>
                  <span className="font-label-tabular text-label-tabular text-[#0E0E12] font-bold">
                    {t('matrix_completed_archive', 'Completed Archive')} ({completedItems.length})
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[#64748B]">
                  <span className="font-label-micro uppercase font-semibold">Toggle Archive</span>
                  <span className="material-symbols-outlined text-[18px]">
                    {isArchiveOpen ? 'expand_less' : 'expand_more'}
                  </span>
                </div>
              </button>

              {isArchiveOpen && (
                <div className="flex flex-col divide-y divide-slate-100">
                  {completedItems.map(item => (
                    <div
                      key={item.id}
                      className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 bg-slate-50/50 items-center opacity-75 hover:opacity-100 transition-opacity"
                    >
                      <div className="col-span-1 flex items-center md:justify-center">
                        <span
                          onClick={() => toggleDeadline(item.id)}
                          className="material-symbols-outlined text-emerald-600 text-[20px] cursor-pointer"
                        >
                          check_circle
                        </span>
                      </div>
                      <div className="col-span-3 flex flex-col">
                        <span className="font-label-micro text-[#64748B]">Was due</span>
                        <span className="font-label-tabular text-label-tabular text-emerald-700 font-bold">
                          {new Date(item.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <div className="col-span-2 flex flex-col">
                        <span className="font-label-tabular text-label-tabular text-[#0E0E12] font-semibold">
                          {item.course}
                        </span>
                      </div>
                      <div className="col-span-4 flex flex-col">
                        <span className="font-body-md text-[#0E0E12] line-through font-medium">
                          {item.title}
                        </span>
                        <span className="font-label-micro text-[#64748B]">{sourceLabel(item.source)}</span>
                      </div>
                      <div className="col-span-2 flex justify-start md:justify-end">
                        <span className="px-2 py-1 rounded bg-slate-200 font-label-micro text-[#64748B] font-semibold">
                          Done
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </main>
      </div>

      {/* Add Custom Deadline Modal */}
      <AddDeadlineModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
      <PasteUpdateModal open={pasteOpen} onClose={() => setPasteOpen(false)} />
      <ChangeItemModal item={editItem} onClose={() => setEditItem(null)} />
      <OutlineUploadModal open={outlineOpen} onClose={() => setOutlineOpen(false)} />
    </div>
  );
};
