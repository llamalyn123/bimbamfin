import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { UploadMaterialsModal } from '../components/UploadMaterialsModal';
import { CasesSection, CaseRow } from '../components/CaseStudies';
import { supabase } from '../lib/supabase';
import { OutlineUploadModal } from '../components/OutlineUploadModal';

/** "uid/1730000000000-Week 3 slides.pdf" -> "Week 3 slides.pdf" */
const fileLabel = (fileUrl: string) => {
  const base = String(fileUrl || '').split('/').pop() || 'Source';
  return decodeURIComponent(base.replace(/^\d{10,}-/, ''));
};

const weekLabel = (w: number) => `W${String(w).padStart(2, '0')}`;

export const NotesScreen: React.FC = () => {
  const { sources, notes, selectedCourse, setSelectedCourse, setSelectedWeek, setActiveScreen, t, currentUser } = useApp();

  // Case studies (not tied to a week unless the student chose one)
  const [cases, setCases] = useState<CaseRow[]>([]);
  const loadCases = async () => {
    if (!currentUser?.id) return;
    const { data } = await supabase.from('cases').select('id, course, week, title, file_path, created_at').eq('user_id', currentUser.id).order('created_at');
    setCases((data ?? []) as CaseRow[]);
  };
  useEffect(() => {
    loadCases();
  }, [currentUser?.id, sources.length]);

  const [courseSearch, setCourseSearch] = useState('');
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [uploadCourse, setUploadCourse] = useState('');
  const [uploadWeek, setUploadWeek] = useState(1);

  // Everything below is built from the student's real uploads and notes.
  const courses = useMemo(() => {
    const codes = Array.from(
      new Set([...sources.map((s) => s.course), ...notes.map((n) => n.course), ...cases.map((c) => c.course)].filter(Boolean))
    ).sort();
    return codes.map((code) => {
      const courseSources = sources.filter((s) => s.course === code);
      const courseNotes = notes.filter((n) => n.course === code);
      const weeks = Array.from(
        new Set([...courseSources, ...courseNotes].map((x) => Number(x.week)).filter((w) => !Number.isNaN(w)))
      ).sort((a, b) => a - b);
      const notedWeeks = new Set(courseNotes.map((n) => Number(n.week)));
      return {
        code,
        sources: courseSources,
        weeks,
        notedWeeks,
        weeksWithNotes: weeks.filter((w) => notedWeeks.has(w)).length
      };
    });
  }, [sources, notes, cases]);

  const currentCourse = courses.find((c) => c.code === selectedCourse) || courses[0];

  const openAddSource = (course = currentCourse?.code || '', week?: number) => {
    setUploadCourse(course);
    const next = week ?? (currentCourse?.weeks.length ? Math.max(...currentCourse.weeks) : 1);
    setUploadWeek(next);
    if (week !== undefined) setSelectedWeek(week);
    setIsAddSourceModalOpen(true);
  };

  const openWeek = (course: string, week: number) => {
    setSelectedCourse(course);
    setSelectedWeek(week);
    setActiveScreen('notes-detail');
  };

  const filteredCourses = courses.filter(
    (c) => !courseSearch || c.code.toLowerCase().includes(courseSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col w-full pb-16">
      <div className="flex items-center justify-between py-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="font-headline-sm text-headline-sm text-[#0E0E12] font-bold">
            {t('notes_header_title', 'Master notes')}
          </span>
          {courses.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] font-label-micro font-bold">
              {courses.length} {courses.length === 1 ? 'course' : 'courses'}
            </span>
          )}
        </div>
      </div>

      {courses.length === 0 ? (
        /* Empty state: no sources uploaded yet */
        <div className="bg-white rounded-xl p-10 border border-[#C9D1DB] text-center flex flex-col items-center justify-center gap-4 shadow-sm">
          <div className="w-20 h-20 rounded-2xl bg-amber-50 border border-amber-200 text-[#D97706] flex items-center justify-center">
            <span className="material-symbols-outlined text-[40px]">auto_stories</span>
          </div>
          <div className="flex flex-col gap-1 max-w-md">
            <h2 className="font-headline-lg text-2xl font-bold text-[#0E0E12]">No notes yet</h2>
            <p className="font-body-md text-[#64748B]">
              Add this week's lecture slides, readings or your own notes. Bimbam turns them into one master note
              with every point linked to its source.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openAddSource('', 1)}
            className="px-6 py-3 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] font-headline-sm font-bold flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            <span>Add your first materials</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: course list */}
          <section className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
            {courses.length > 4 && (
              <div className="bg-white p-3 rounded-xl border border-[#C9D1DB] shadow-xs">
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-2.5 text-[#64748B] text-[18px]">search</span>
                  <input
                    type="text"
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    placeholder="Search courses"
                    aria-label="Search courses"
                    className="w-full bg-[#F4F7FB] text-[#0E0E12] placeholder:text-[#64748B] border border-[#C9D1DB] font-body-sm text-xs pl-8 pr-3 py-2 rounded-lg focus:outline-none focus:border-[#D4A94F] focus:bg-white transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {filteredCourses.map((course) => {
                const isSelected = currentCourse?.code === course.code;
                const progress = course.weeks.length
                  ? Math.round((course.weeksWithNotes / course.weeks.length) * 100)
                  : 0;
                return (
                  <button
                    type="button"
                    key={course.code}
                    onClick={() => setSelectedCourse(course.code)}
                    className={`relative text-left p-4 rounded-xl transition-all cursor-pointer shadow-xs ${
                      isSelected
                        ? 'bg-white border-2 border-[#D4A94F]'
                        : 'bg-white border border-[#C9D1DB] hover:border-[#D4A94F]/40'
                    }`}
                  >
                    <h3 className="font-headline-sm text-headline-sm text-[#0E0E12] font-bold">{course.code}</h3>
                    <div className="mt-2 mb-1 w-full h-1.5 bg-[#F4F7FB] border border-[#C9D1DB]/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isSelected ? 'bg-[#D4A94F]' : 'bg-[#64748B]'}`}
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#64748B]">
                      <span className="text-[#1E293B] font-medium">
                        {course.weeksWithNotes} of {course.weeks.length} {course.weeks.length === 1 ? 'week' : 'weeks'} have a note
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">folder_open</span>
                        {course.sources.length} {course.sources.length === 1 ? 'source' : 'sources'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => openAddSource('', 1)}
              className="p-3 rounded-xl bg-white border border-dashed border-[#C9D1DB] hover:border-[#D4A94F] text-xs font-semibold text-[#64748B] hover:text-[#0E0E12] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Add another course</span>
            </button>
          </section>

          {/* RIGHT: weeks of the selected course */}
          {currentCourse && (
            <section className="lg:col-span-7 xl:col-span-8 flex flex-col gap-5">
              <div className="bg-white p-6 rounded-2xl border border-[#C9D1DB] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                <div>
                  <h2 className="font-headline-lg text-2xl sm:text-3xl text-[#0E0E12] font-bold tracking-tight">
                    {currentCourse.code}
                  </h2>
                  <p className="font-body-sm text-[#64748B] mt-0.5">
                    {currentCourse.sources.length} {currentCourse.sources.length === 1 ? 'source' : 'sources'} across{' '}
                    {currentCourse.weeks.length} {currentCourse.weeks.length === 1 ? 'week' : 'weeks'}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setOutlineOpen(true)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-[#C9D1DB] text-[#0E0E12] font-semibold hover:border-[#D4A94F] transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">checklist</span>
                  <span>Course outline</span>
                </button>
                <button
                  type="button"
                  onClick={() => openAddSource(currentCourse.code)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#D4A94F] text-[#0E0E12] font-semibold hover:bg-[#c7993a] transition-all active:scale-[0.98] shadow-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  <span>Add materials</span>
                </button>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                {currentCourse.weeks.map((w) => {
                  const weekSources = currentCourse.sources.filter((s) => Number(s.week) === w);
                  const hasNote = currentCourse.notedWeeks.has(w);
                  return (
                    <div
                      key={w}
                      className="p-4 rounded-xl bg-white border border-[#C9D1DB] hover:border-[#D4A94F]/40 transition-all shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="font-label-tabular font-bold mt-0.5 text-[#64748B]">{weekLabel(w)}</span>
                        <div className="flex flex-col min-w-0">
                          <h4 className="font-body-md text-[#0E0E12] font-bold">Week {w}</h4>
                          <span className="text-xs text-[#64748B] mt-0.5 truncate">
                            {weekSources.length
                              ? weekSources.map((s) => fileLabel(s.file_url)).join(', ')
                              : 'No sources yet'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => openWeek(currentCourse.code, w)}
                          className={
                            hasNote
                              ? 'font-label-tabular text-xs text-[#B47B16] bg-[#FEF3C7] border border-[#FDE68A] px-3 py-1 rounded-lg font-bold hover:bg-amber-100 transition-colors cursor-pointer'
                              : 'font-label-tabular text-xs text-[#0E0E12] bg-white border border-[#C9D1DB] px-3 py-1 rounded-lg font-semibold hover:bg-slate-50 transition-colors cursor-pointer'
                          }
                        >
                          {hasNote ? t('notes_open_master_note', 'Open master note') : 'Open week'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openAddSource(currentCourse.code, w)}
                          className="p-1 rounded text-slate-400 hover:text-[#B47B16] hover:bg-amber-50 transition-colors cursor-pointer"
                          title={`Add a source to week ${w}`}
                          aria-label={`Add a source to week ${w}`}
                        >
                          <span className="material-symbols-outlined text-[18px]">add_circle</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() =>
                    openAddSource(
                      currentCourse.code,
                      (currentCourse.weeks.length ? Math.max(...currentCourse.weeks) : 0) + 1
                    )
                  }
                  className="p-3 rounded-xl border border-dashed border-[#C9D1DB] hover:border-[#D4A94F] text-xs font-semibold text-[#64748B] hover:text-[#0E0E12] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>
                    Add week {(currentCourse.weeks.length ? Math.max(...currentCourse.weeks) : 0) + 1}
                  </span>
                </button>
              </div>

              <CasesSection course={currentCourse.code} cases={cases} onChanged={loadCases} />
            </section>
          )}
        </div>
      )}

      <OutlineUploadModal open={outlineOpen} onClose={() => setOutlineOpen(false)} defaultCourse={currentCourse?.code || ''} />
      <UploadMaterialsModal
        isOpen={isAddSourceModalOpen}
        onClose={() => {
          setIsAddSourceModalOpen(false);
          loadCases();
        }}
        defaultCourse={uploadCourse}
        defaultWeek={uploadWeek}
      />
    </div>
  );
};
