import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { supabase, SourceItem } from '../lib/supabase';

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCourse?: string;
  defaultWeek?: number;
}

export const AddSourceModal: React.FC<AddSourceModalProps> = ({
  isOpen,
  onClose,
  defaultCourse = '',
  defaultWeek = 1
}) => {
  const {
    sources,
    setSources,
    selectedCourse,
    selectedWeek,
    showToast,
    refreshFromSupabase,
    logoutUser,
    t
  } = useApp();

  const [course, setCourse] = useState(defaultCourse);
  const [week, setWeek] = useState(defaultWeek);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('Uploading...');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [placeholderNotice, setPlaceholderNotice] = useState<{ title: string; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync default course and week when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setCourse(defaultCourse || '');
      setWeek(defaultWeek ?? selectedWeek ?? 1);
      setUploadStatus('idle');
      setIsUploading(false);
      setErrorMessage(null);
      setSelectedFileName(null);
      setPlaceholderNotice(null);
    }
  }, [isOpen, defaultCourse, defaultWeek, selectedCourse, selectedWeek]);

  if (!isOpen) return null;

  // Triggers the native file picker
  const handleTriggerFilePicker = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setErrorMessage(null);
    setPlaceholderNotice(null);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle native file selection and upload flow
  const handleFileSelected = async (file: File) => {
    const trimmedCourse = course.trim();
    if (!trimmedCourse) {
      setUploadStatus('error');
      setErrorMessage('Enter the course code first (e.g. IS112), then choose the file again.');
      return;
    }

    // Step 1: Right after a file is picked: console.log("STEP 1 file picked", file.name) and show a toast "Uploading <file name>…"
    console.log("STEP 1 file picked", file.name);
    showToast(`Uploading ${file.name}…`);

    setSelectedFileName(file.name);
    setErrorMessage(null);
    setPlaceholderNotice(null);
    setUploadStatus('uploading');
    setIsUploading(true);
    setUploadProgressText(`Uploading ${file.name}...`);

    try {
      // 1. Get the signed-in user: const { data: { user } } = await supabase.auth.getUser();
      //    If no user, show "Please sign in again" and stop.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const authErr = 'Please sign in again';
        console.error('AUTH ERROR', authErr);
        setIsUploading(false);
        setUploadStatus('error');
        setErrorMessage(authErr);
        return;
      }

      // Step 2: Before storage upload: console.log("STEP 2 uploading to", path)
      const path = `${user.id}/${Date.now()}-${file.name}`;
      console.log("STEP 2 uploading to", path);

      // Step 3: Storage upload & result logging
      const { data: storageData, error: upErr } = await supabase.storage.from('sources').upload(path, file);
      console.log("STEP 3 storage result", storageData, upErr);

      if (upErr) {
        console.error("UPLOAD ERROR", upErr);
        setIsUploading(false);
        setUploadStatus('error');
        setErrorMessage(upErr.message);
        return;
      }

      // Step 4: Insert row into sources table & result logging
      const activeCourse = trimmedCourse;
      const activeWeek = (week !== undefined && week !== null) ? week : (defaultWeek || selectedWeek || 1);

      const { data: insertData, error: insErr } = await supabase.from('sources').insert({
        user_id: user.id,
        course: activeCourse,
        week: activeWeek,
        file_url: path,
        upload_method: 'upload'
      }).select();
      console.log("STEP 4 insert result", insertData, insErr);

      if (insErr) {
        console.error("SOURCES INSERT ERROR", insErr);
        setIsUploading(false);
        setUploadStatus('error');
        setErrorMessage(insErr.message);
        return;
      }

      // Step 6: On success show "Source added" and refresh the source list.
      setIsUploading(false);
      setUploadStatus('success');
      showToast('Source added');

      // Refresh the source list from Supabase
      try {
        const { data: refreshedSources, error: fetchErr } = await supabase.from('sources').select('*');
        if (fetchErr) {
          console.error('SOURCES REFRESH ERROR', fetchErr);
        } else if (refreshedSources) {
          setSources(refreshedSources as SourceItem[]);
        }
        await refreshFromSupabase();
      } catch (refreshErr) {
        console.error('REFRESH ERROR', refreshErr);
      }

      // Keep success message visible briefly before closing
      setTimeout(() => {
        onClose();
      }, 1200);

    } catch (err: any) {
      console.error("UPLOAD FLOW ERROR", err);
      setIsUploading(false);
      setUploadStatus('error');
      setErrorMessage(err?.message || 'An unexpected error occurred during upload. Please try again.');
    }
  };

  // Placeholder action for "Sync from LMS"
  const handleLmsPlaceholder = () => {
    setErrorMessage(null);
    setPlaceholderNotice({
      title: 'Sync from LMS (Canvas / Blackboard / Moodle)',
      text: 'Direct LMS synchronization requires an institutional Single Sign-On token (SMU Canvas, NUS Canvas, or NTULearn). Please use the "Upload a file" option to ingest course materials directly.'
    });
  };

  // Placeholder action for "Use browser extension"
  const handleExtensionPlaceholder = () => {
    setErrorMessage(null);
    setPlaceholderNotice({
      title: 'Bimbam Browser Extension',
      text: 'The Bimbam Scholar companion extension for Chrome & Edge is currently in private beta for select campus research cohorts. Please use the "Upload a file" option to upload slide decks.'
    });
  };

  return (
    <>
      {/* Hidden native file input.
          IMPORTANT: it must live OUTSIDE the backdrop below. The backdrop's onClick
          closes the modal; fileInputRef.current.click() bubbles up to it, which used
          to close (unmount) the modal while the picker was open, so onChange never fired. */}
      <input
        ref={fileInputRef}
        id="sources-file-input"
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv"
        className="hidden"
        style={{ display: 'none' }}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          const files = event.target.files;
          const file = files && files[0];
          // Reset the input value after each pick (event.target.value = "")
          // so picking the same file twice still triggers onChange
          event.target.value = '';
          if (file) {
            handleFileSelected(file);
          }
        }}
      />

    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={() => { if (!isUploading) onClose(); }}
    >
      {/* Sheet Content Card */}
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl border border-[#C9D1DB] p-6 shadow-2xl flex flex-col gap-5 relative animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-300 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) {
            handleFileSelected(file);
          }
        }}
      >
        {/* Mobile Pull Handle */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 sm:hidden"></div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isUploading}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-40 cursor-pointer"
          title="Close sheet"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        {/* Header */}
        <div className="flex items-start gap-3.5 pr-8">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-[#D97706] flex items-center justify-center shrink-0 shadow-2xs">
            <span className="material-symbols-outlined text-[24px]">add_notes</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-headline-sm text-lg font-bold text-[#0E0E12]">
                {t('notes_add_source_btn', 'Add Academic Source')}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                {course || "—"} • Week {String(week).padStart(2, "0")}
              </span>
            </div>
            <p className="font-body-sm text-xs text-[#64748B] mt-0.5">
              Ingest lecture slides, readings, and notes into your master synthesis.
            </p>
          </div>
        </div>

        {/* Course & Week Context Pill Bar */}
        <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between text-xs text-[#475569]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-[#64748B]">folder_open</span>
            <span className="font-semibold text-[#0E0E12]">{course || 'No course yet'}</span>
            <span>•</span>
            <span>Week {Number(week) < 10 ? `0${week}` : week}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              list="bimbam-course-options"
              value={course}
              onChange={(e) => setCourse(e.target.value.toUpperCase())}
              disabled={isUploading}
              placeholder="Course code"
              aria-label="Course code"
              className="w-28 bg-white border border-[#CBD5E1] rounded-lg px-2 py-1 text-[11px] font-semibold text-[#0E0E12] focus:outline-none focus:border-[#D4A94F]"
            />
            <datalist id="bimbam-course-options">
              {Array.from(new Set(sources.map((s) => s.course).filter(Boolean))).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <select
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              disabled={isUploading}
              className="bg-white border border-[#CBD5E1] rounded-lg px-2 py-1 text-[11px] font-semibold text-[#0E0E12] focus:outline-none focus:border-[#D4A94F]"
            >
              {Array.from({ length: 15 }, (_, i) => i + 1).map(w => (
                <option key={w} value={w}>W{w < 10 ? `0${w}` : w}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Visible Error Message on Screen */}
        {uploadStatus === 'error' && errorMessage && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 flex flex-col gap-2.5 animate-in fade-in duration-200">
            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[22px] text-red-600 shrink-0 mt-0.5">error</span>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-xs uppercase tracking-wider text-red-950 block">Error</span>
                <p className="text-[13px] text-red-800 leading-relaxed mt-1 break-words font-medium">
                  {errorMessage}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-red-200/60">
              {errorMessage === 'Please sign in again' ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    logoutUser();
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-[#363FEF] hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  Sign In
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => handleTriggerFilePicker(e)}
                  className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[15px]">refresh</span>
                  <span>Try Again</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Informative Placeholder Notice Banner */}
        {placeholderNotice && (
          <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
            <span className="material-symbols-outlined text-[18px] text-[#363FEF] shrink-0 mt-0.5">info</span>
            <div className="flex-1">
              <span className="font-bold block text-indigo-950">{placeholderNotice.title}</span>
              <p className="text-[11px] text-indigo-800 leading-relaxed mt-0.5">
                {placeholderNotice.text}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPlaceholderNotice(null)}
              className="text-indigo-400 hover:text-indigo-700 text-xs"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* Loading State Banner */}
        {uploadStatus === 'uploading' && (
          <div className="p-5 rounded-2xl bg-amber-50/80 border border-amber-200 flex flex-col items-center justify-center gap-3 text-center animate-in fade-in duration-200">
            <div className="w-12 h-12 rounded-full border-3 border-amber-300 border-t-[#D4A94F] animate-spin flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px] text-[#D4A94F]">cloud_upload</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-headline-sm text-sm font-bold text-[#0E0E12]">
                Uploading...
              </span>
              <p className="text-xs text-[#64748B] max-w-xs">
                {uploadProgressText}
              </p>
            </div>
            <div className="w-full max-w-xs bg-amber-200/60 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-[#D4A94F] rounded-full animate-pulse w-3/4"></div>
            </div>
          </div>
        )}

        {/* Visible Success Confirmation Banner */}
        {uploadStatus === 'success' && (
          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col items-center justify-center gap-2.5 text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[28px]">check_circle</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-headline-sm text-sm font-bold text-emerald-950">
                Source added
              </span>
              <p className="text-xs text-emerald-800">
                {selectedFileName ? `"${selectedFileName}" added to ` : ''}{course} · Week {week}.
              </p>
            </div>
            <span className="text-[11px] font-mono text-emerald-700 bg-white/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Refreshed source list
            </span>
          </div>
        )}

        {/* Main Sheet Options Grid */}
        {uploadStatus !== 'uploading' && uploadStatus !== 'success' && (
          <div className="flex flex-col gap-3">
            {/* Option 1: Sync from LMS (Placeholder) */}
            <div
              onClick={handleLmsPlaceholder}
              className="p-4 rounded-xl border border-gray-200 hover:border-gray-300 bg-white hover:bg-slate-50/60 transition-all cursor-pointer flex items-center justify-between gap-3 group select-none"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:bg-slate-200 transition-colors">
                  <span className="material-symbols-outlined text-[22px]">school</span>
                </div>
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-headline-sm text-sm font-bold text-gray-800">
                      Sync from LMS
                    </span>
                    <span className="px-2 py-0.2 rounded text-[10px] font-mono font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                      Placeholder
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Connect Canvas, Blackboard, or Moodle syllabi & decks
                  </p>
                </div>
              </div>
              <span className="material-symbols-outlined text-gray-400 group-hover:text-gray-600 text-[18px]">
                chevron_right
              </span>
            </div>

            {/* Option 2: Upload a file (Functional Option) */}
            <div
              onClick={(e) => handleTriggerFilePicker(e)}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col gap-2.5 relative overflow-hidden group shadow-xs select-none ${
                isDragging
                  ? 'border-[#D4A94F] bg-amber-50/60 ring-2 ring-[#D4A94F]'
                  : 'border-[#D4A94F] bg-gradient-to-br from-white to-[#FFFDF7] hover:border-[#B47B16] hover:shadow-md'
              }`}
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#D4A94F]/10 rounded-full blur-xl pointer-events-none"></div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] text-[#B47B16] border border-[#FDE68A] flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[22px]">upload_file</span>
                  </div>
                  <div className="flex flex-col text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-headline-sm text-sm font-bold text-[#0E0E12]">
                        Upload a file
                      </span>
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-mono font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                        Active • Upload
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Select lecture slides, readings, or notes to ingest
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleTriggerFilePicker(e)}
                  className="px-3 py-1.5 rounded-lg bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] text-xs font-bold transition-all shadow-xs flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <span>Choose file</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>

              {/* Notice */}
              <div className="mt-1 pt-2.5 border-t border-[#D4A94F]/20 flex items-center justify-between text-[11px] text-[#855B14]">
                <span className="flex items-center gap-1 font-medium">
                  <span className="material-symbols-outlined text-[14px]">attach_file</span>
                  <span>Uploads to Supabase Storage bucket "sources"</span>
                </span>
                <span className="font-mono text-[10px] text-[#B47B16]">
                  sources/{course || "…"}/W{String(week).padStart(2, "0")}
                </span>
              </div>
            </div>

            {/* Option 3: Use browser extension (Placeholder) */}
            <div
              onClick={handleExtensionPlaceholder}
              className="p-4 rounded-xl border border-gray-200 hover:border-gray-300 bg-white hover:bg-slate-50/60 transition-all cursor-pointer flex items-center justify-between gap-3 group select-none"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:bg-slate-200 transition-colors">
                  <span className="material-symbols-outlined text-[22px]">extension</span>
                </div>
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-headline-sm text-sm font-bold text-gray-800">
                      Use browser extension
                    </span>
                    <span className="px-2 py-0.2 rounded text-[10px] font-mono font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                      Placeholder
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Clip lecture slides and handouts directly from browser tabs
                  </p>
                </div>
              </div>
              <span className="material-symbols-outlined text-gray-400 group-hover:text-gray-600 text-[18px]">
                chevron_right
              </span>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-[#64748B]">
          <span className="text-[11px]">
            Target Course: <strong className="text-[#0E0E12]">{course}</strong> (Week {week})
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="text-xs font-semibold text-[#64748B] hover:text-[#0E0E12] transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
    </>
  );
};
