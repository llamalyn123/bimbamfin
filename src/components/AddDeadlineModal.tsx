import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

interface AddDeadlineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddDeadlineModal: React.FC<AddDeadlineModalProps> = ({ isOpen, onClose }) => {
  const { addDeadline, deadlines, sources, t } = useApp();
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const courseSuggestions = Array.from(
    new Set([...deadlines.map((d) => d.course), ...sources.map((s) => s.course)].filter(Boolean))
  ).sort();

  const [title, setTitle] = useState('');
  const [course, setCourse] = useState('');
  const [type, setType] = useState('Assignment');
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState('23:59');
  const [source, setSource] = useState('Added by you');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !course.trim()) return;

    setIsSubmitting(true);
    const dueIso = new Date(`${date}T${time}:00`).toISOString();

    await addDeadline({
      title: title.trim(),
      course: course.trim(),
      due_date: dueIso,
      status: 'pending',
      type,
      source
    });

    setIsSubmitting(false);
    setTitle('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-white rounded-2xl border border-[#C9D1DB] p-6 shadow-2xl flex flex-col gap-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-[#D97706] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">calendar_add_on</span>
          </div>
          <div>
            <h2 className="font-headline-sm text-headline-sm text-[#0E0E12] font-bold">
              {t('matrix_add_deadline_btn', 'Add Custom Deadline')}
            </h2>
            <p className="font-body-sm text-[#64748B]">Saved to your deadlines</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
          {/* Title */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#0E0E12]">Deliverable Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lab 4 report"
              className="w-full px-3 py-2 rounded-xl border border-[#C9D1DB] text-body-sm text-[#0E0E12] focus:outline-none focus:border-[#C5983E]"
            />
          </div>

          {/* Course & Type Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="deadline-course" className="text-xs font-semibold text-[#0E0E12]">Course</label>
              <input
                id="deadline-course"
                type="text"
                required
                list="deadline-course-options"
                value={course}
                onChange={(e) => setCourse(e.target.value.toUpperCase())}
                placeholder="e.g. IS112"
                className="w-full px-3 py-2 rounded-xl border border-[#C9D1DB] text-body-sm text-[#0E0E12] bg-white focus:outline-none focus:border-[#C5983E]"
              />
              <datalist id="deadline-course-options">
                {courseSuggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0E0E12]">Category</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#C9D1DB] text-body-sm text-[#0E0E12] bg-white focus:outline-none focus:border-[#C5983E]"
              >
                <option value="Assignment">Assignment</option>
                <option value="Quiz">Quiz</option>
                <option value="RSVP">RSVP / Event</option>
                <option value="Case Study">Case Study</option>
              </select>
            </div>
          </div>

          {/* Due Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0E0E12]">Due Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#C9D1DB] text-body-sm text-[#0E0E12] focus:outline-none focus:border-[#C5983E]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0E0E12]">Due Time</label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#C9D1DB] text-body-sm text-[#0E0E12] focus:outline-none focus:border-[#C5983E]"
              />
            </div>
          </div>

          {/* Source notes */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#0E0E12]">Source / Instructions</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. Canvas LMS Synced, Turnitin Portal"
              className="w-full px-3 py-2 rounded-xl border border-[#C9D1DB] text-body-sm text-[#0E0E12] focus:outline-none focus:border-[#C5983E]"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#C9D1DB] text-body-sm text-[#64748B] hover:text-[#0E0E12] hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#C5983E] hover:bg-[#D4A94F] text-[#0E0E12] font-semibold text-body-sm shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">save</span>
              <span>{isSubmitting ? t('syncing', 'Saving...') : t('matrix_add_deadline_btn', 'Add Deadline')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
