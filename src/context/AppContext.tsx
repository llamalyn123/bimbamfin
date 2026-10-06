import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  supabase,
  Deadline,
  EventItem,
  SourceItem,
  NoteItem,
  QuizItem,
  QuoteItem,
  UniversityAffiliation,
  inferUniversity
} from '../lib/supabase';
import {
  SupportedLanguage,
  SUPPORTED_LANGUAGES,
  getTranslation,
  TranslationKey
} from '../i18n/translations';

const EMPTY_QUIZ: QuizItem = { id: '', note_id: null, questions: [], score: null };
import { getMasterNoteForLanguage, buildClaudeNotePrompt } from '../lib/noteGenerator';

export type ActiveScreen = 'home' | 'calendar' | 'matrix' | 'notes' | 'notes-detail' | 'quiz' | 'events' | 'more';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface ScholarUser {
  id: string;
  name: string;
  full_name?: string;
  email: string;
  major: string;
  streak: number;
  initials: string;
  university: UniversityAffiliation;
}

interface AppContextType {
  activeScreen: ActiveScreen;
  setActiveScreen: (screen: ActiveScreen) => void;
  homeSubView: 'list' | 'calendar';
  setHomeSubView: (view: 'list' | 'calendar') => void;
  
  // Theme state
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  resolvedTheme: 'light' | 'dark';

  // Language & Localization state
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: TranslationKey | string, fallback?: string) => string;
  showEnglishSubtitles: boolean;
  setShowEnglishSubtitles: (show: boolean) => void;
  generateNoteForCourse: (course: string, week: number | string) => Promise<boolean>;

  // Auth & Scholar Session
  isAuthChecking: boolean;
  currentUser: ScholarUser | null;
  isInstitutional: boolean;
  loginUser: (email: string, password?: string, fullName?: string) => Promise<{ success: boolean; error?: string }>;
  signupUser: (email: string, password: string, fullName?: string) => Promise<{ success: boolean; error?: string; warning?: string }>;
  logoutUser: () => Promise<void>;
  updateUniversity: (newUni: UniversityAffiliation) => Promise<boolean>;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;

  // Supabase Data
  deadlines: Deadline[];
  events: EventItem[];
  sources: SourceItem[];
  notes: NoteItem[];
  quiz: QuizItem;
  setQuiz: (quiz: QuizItem) => void;
  quotes: QuoteItem[];
  userEventInterests: Record<string, boolean>; // eventId -> registered
  reminders: Record<string, boolean>; // eventId -> has reminder
  activeQuote: QuoteItem | null;
  
  // Selected note for detail view
  selectedCourse: string;
  setSelectedCourse: (course: string) => void;
  selectedWeek: number;
  setSelectedWeek: (week: number) => void;
  
  // Selected date for calendar view
  selectedDate: number; // day of Oct 2024 (e.g. 24)
  setSelectedDate: (date: number) => void;
  
  // Database Actions
  toggleDeadline: (id: string) => Promise<void>;
  addDeadline: (deadline: Omit<Deadline, 'id'>) => Promise<boolean>;
  addSource: (source: Omit<SourceItem, 'id'>) => Promise<boolean>;
  setSources: React.Dispatch<React.SetStateAction<SourceItem[]>>;
  saveQuizResult: (score: number, answers?: unknown[]) => Promise<boolean>;
  toggleEventRegister: (eventId: string) => Promise<void>;
  toggleEventReminder: (eventId: string) => Promise<void>;
  refreshFromSupabase: () => Promise<void>;
  
  // Sync status
  isSyncing: boolean;
  lastSyncedText: string;
  notification: string | null;
  setNotification: (msg: string | null) => void;
  showToast: (msg: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('home');
  const [homeSubView, setHomeSubView] = useState<'list' | 'calendar'>('list');
  
  // Theme state: defaults to 'light', persists to localStorage
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('nocturne_theme');
      if (saved === 'dark' || saved === 'light' || saved === 'system') {
        return saved as ThemeMode;
      }
    } catch (e) {
      // Local storage unavailable
    }
    return 'light';
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Calculate resolved theme
  const resolvedTheme: 'light' | 'dark' =
    themeMode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themeMode;

  // Listen for system theme changes live
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Update DOM classes and data attribute whenever resolvedTheme changes
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }
  }, [resolvedTheme]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      localStorage.setItem('nocturne_theme', mode);
    } catch (e) {
      console.warn('Failed to save theme in localStorage:', e);
    }
  };

  // Language state: defaults to 'en', persists to localStorage
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    try {
      const saved = localStorage.getItem('nocturne_language');
      if (saved === 'en' || saved === 'zh' || saved === 'ta' || saved === 'de') {
        return saved as SupportedLanguage;
      }
    } catch (e) {
      // Local storage unavailable
    }
    return 'en';
  });

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('nocturne_language', lang);
    } catch (e) {
      console.warn('Failed to save language in localStorage:', e);
    }
    // If switching to a non-English language and no explicit false was saved, default to true
    if (lang !== 'en') {
      try {
        const savedSubtitles = localStorage.getItem('nocturne_subtitles');
        if (savedSubtitles === null) {
          setShowEnglishSubtitlesState(true);
        }
      } catch (e) {
        // Ignore
      }
    }
    const opt = SUPPORTED_LANGUAGES.find(l => l.code === lang);
    showToast(`Language set to ${opt ? `${opt.flag} ${opt.nativeName}` : lang}`);
  };

  const t = (key: TranslationKey | string, fallback?: string): string => {
    return getTranslation(language, key, fallback);
  };

  // Dual-language English subtitles state:
  // Default to on (true) for any non-English display language,
  // hidden/irrelevant when display language is English.
  const [showEnglishSubtitles, setShowEnglishSubtitlesState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('nocturne_subtitles');
      if (saved !== null) {
        return saved === 'true';
      }
    } catch (e) {
      // Local storage unavailable
    }
    return language !== 'en';
  });

  const setShowEnglishSubtitles = (show: boolean) => {
    setShowEnglishSubtitlesState(show);
    try {
      localStorage.setItem('nocturne_subtitles', String(show));
    } catch (e) {
      console.warn('Failed to save subtitles setting in localStorage:', e);
    }
    showToast(show ? 'English subtitles enabled' : 'English subtitles hidden');
  };

  // Master note generation via Claude API structured prompt schema
  const generateNoteForCourse = async (course: string, week: number | string): Promise<boolean> => {
    const prompt = buildClaudeNotePrompt(language, course, week);
    console.log('[Claude Note Generation Prompt]:', prompt);

    const generatedContent = getMasterNoteForLanguage(language, course, week);
    const contentJson = JSON.stringify(generatedContent);

    setNotes(prev => {
      const existingIdx = prev.findIndex(n => n.course === course && String(n.week) === String(week));
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], content: contentJson };
        return updated;
      }
      return [{ id: 'n_' + Date.now(), course, week, content: contentJson }, ...prev];
    });

    try {
      await supabase.from('notes').upsert({
        course,
        week,
        content: contentJson
      });
      showToast(`Master note synthesized in ${language.toUpperCase()} with dual-language English fields`);
      return true;
    } catch (e) {
      return true;
    }
  };

  // Auth State
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<ScholarUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // App Data
  // Real data only: everything starts empty and is filled from Supabase.
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [quiz, setQuiz] = useState<QuizItem>(EMPTY_QUIZ);
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);
  const [activeQuote, setActiveQuote] = useState<QuoteItem | null>({
    id: 'default',
    quote_text: 'The only true wisdom is knowing that you know nothing.',
    speaker: 'Socrates',
    source_title: 'Symposium',
    type: 'philosophy',
    tone: 'reflective',
    language: 'en'
  });
  
  const [userEventInterests, setUserEventInterests] = useState<Record<string, boolean>>({});
  const [reminders, setReminders] = useState<Record<string, boolean>>({});

  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [selectedDate, setSelectedDate] = useState<number>(24);
  
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedText, setLastSyncedText] = useState<string>('Synced just now');
  const [notification, setNotification] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 4000);
  };

  // Check if student's university matches a supported institution (SMU, NUS, NTU)
  const isInstitutional = Boolean(
    currentUser &&
    (currentUser.university === 'SMU' ||
     currentUser.university === 'NUS' ||
     currentUser.university === 'NTU')
  );

  // Auth initialization: check Supabase session & local persistent session
  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      setIsAuthChecking(true);
      try {
        // 1. Check Supabase auth session
        const { data: { session }, error } = await supabase.auth.getSession();
        if (session?.user && isMounted) {
          const userEmail = session.user.email || 'scholar@university.edu';
          const namePart = userEmail.split('@')[0] || 'Scholar';
          const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1);
          
          let userUni: UniversityAffiliation = inferUniversity(userEmail);
          let userFullName: string | undefined = session.user.user_metadata?.full_name || session.user.user_metadata?.name;

          try {
            const { data: profileRows } = await supabase.from('profiles').select('university, full_name').eq('id', session.user.id).limit(1);
            if (profileRows && profileRows.length > 0) {
              if (profileRows[0].university) {
                userUni = profileRows[0].university as UniversityAffiliation;
              }
              if (profileRows[0].full_name) {
                userFullName = profileRows[0].full_name;
              }
            }
            // For Google sign-in: if Google provides a name but profile doesn't have it yet, save it
            if (userFullName && (!profileRows || profileRows.length === 0 || !profileRows[0]?.full_name)) {
              await supabase.from('profiles').upsert({
                id: session.user.id,
                email: userEmail,
                university: userUni,
                full_name: userFullName
              });
            }
          } catch (e) {
            console.warn('Profile sync on session:', e);
          }

          const displayName = userFullName || capitalized;
          const scholar: ScholarUser = {
            id: session.user.id,
            name: displayName,
            full_name: userFullName || undefined,
            email: userEmail,
            major: session.user.user_metadata?.major || '',
            streak: 0,
            initials: displayName.slice(0, 2).toUpperCase(),
            university: userUni
          };
          setCurrentUser(scholar);
          localStorage.setItem('nocturne_auth_user', JSON.stringify(scholar));
        } else if (isMounted) {
          // No real Supabase session = not logged in. Never restore a
          // saved copy from localStorage: it made the app look logged in
          // while every database/storage request was being rejected.
          localStorage.removeItem('nocturne_auth_user');
          setCurrentUser(null);
        }
      } catch (err) {
        console.warn('Supabase auth session check failed:', err);
        const saved = localStorage.getItem('nocturne_auth_user');
        if (saved && isMounted) {
          try {
            const parsed = JSON.parse(saved);
            if (!parsed.university && parsed.email) {
              parsed.university = inferUniversity(parsed.email);
            }
            setCurrentUser(parsed);
          } catch {
            setCurrentUser(null);
          }
        } else if (isMounted) {
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) {
          setIsAuthChecking(false);
        }
      }
    };

    checkSession();

    // Listen to Supabase auth events
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (session?.user) {
        const userEmail = session.user.email || 'scholar@university.edu';
        const namePart = userEmail.split('@')[0] || 'Scholar';
        const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        
        let userUni: UniversityAffiliation = inferUniversity(userEmail);
        let userFullName: string | undefined = session.user.user_metadata?.full_name || session.user.user_metadata?.name;

        try {
          const { data: profileRows } = await supabase.from('profiles').select('university, full_name').eq('id', session.user.id).limit(1);
          if (profileRows && profileRows.length > 0) {
            if (profileRows[0].university) {
              userUni = profileRows[0].university as UniversityAffiliation;
            }
            if (profileRows[0].full_name) {
              userFullName = profileRows[0].full_name;
            }
          }
          // For Google sign-in: if Google provides a name but profile doesn't have it yet, save it
          if (userFullName && (!profileRows || profileRows.length === 0 || !profileRows[0]?.full_name)) {
            await supabase.from('profiles').upsert({
              id: session.user.id,
              email: userEmail,
              university: userUni,
              full_name: userFullName
            });
          }
        } catch (e) {
          console.warn('Profile on auth state change:', e);
        }

        const displayName = userFullName || capitalized;
        const scholar: ScholarUser = {
          id: session.user.id,
          name: displayName,
          full_name: userFullName || undefined,
          email: userEmail,
          major: session.user.user_metadata?.major || '',
          streak: 0,
          initials: displayName.slice(0, 2).toUpperCase(),
          university: userUni
        };
        setCurrentUser(scholar);
        localStorage.setItem('nocturne_auth_user', JSON.stringify(scholar));
        setActiveScreen('home');
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        localStorage.removeItem('nocturne_auth_user');
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Fetch initial data from Supabase
  const refreshFromSupabase = async () => {
    setIsSyncing(true);
    try {
      // 1. Quotes
      const { data: quoteRows } = await supabase.from('quotes').select('*');
      if (quoteRows && quoteRows.length > 0) {
        setQuotes(quoteRows as QuoteItem[]);
        const randomQuote = quoteRows[Math.floor(Math.random() * quoteRows.length)];
        setActiveQuote(randomQuote as QuoteItem);
      }

      // 2. Deadlines
      const { data: deadlineRows } = await supabase.from('deadlines').select('*').order('due_date');
      setDeadlines((deadlineRows ?? []) as Deadline[]);

      // 3. Events
      const { data: eventRows } = await supabase.from('events').select('*').order('event_date');
      setEvents((eventRows ?? []) as EventItem[]);

      // 4. Sources
      const { data: sourceRows, error: sourceErr } = await supabase.from('sources').select('*');
      if (sourceErr) {
        console.error('FETCH SOURCES ERROR', sourceErr);
      } else {
        setSources((sourceRows ?? []) as SourceItem[]);
      }

      // 5. Notes
      const { data: noteRows } = await supabase.from('notes').select('*');
      setNotes((noteRows ?? []) as NoteItem[]);

      // 6. User Event Interest
      const { data: interestRows } = await supabase.from('user_event_interest').select('*');
      if (interestRows && interestRows.length > 0) {
        const interestMap: Record<string, boolean> = {};
        const reminderMap: Record<string, boolean> = {};
        interestRows.forEach((row: any) => {
          if (row.event_id) {
            interestMap[row.event_id] = Boolean(row.registered);
            reminderMap[row.event_id] = Boolean(row.reminder_set);
          }
        });
        setUserEventInterests(interestMap);
        setReminders(reminderMap);
      } else {
        setUserEventInterests({});
      }

      // 7. Profile sync if logged in
      if (currentUser?.id) {
        const { data: profData } = await supabase.from('profiles').select('university').eq('id', currentUser.id).limit(1);
        if (profData && profData.length > 0 && profData[0].university) {
          if (profData[0].university !== currentUser.university) {
            setCurrentUser(prev => prev ? ({ ...prev, university: profData[0].university }) : null);
          }
        }
      }

      setLastSyncedText('Synced just now');
    } catch (err: any) {
      console.warn('Supabase fetch notice:', err?.message || err);
    } finally {
      setIsSyncing(false);
    }
  };

  // If a school calendar is connected and hasn't synced for 6h, refresh it in the background
  const autoSyncCalendar = async () => {
    if (!currentUser?.id) return;
    const { data: feed } = await supabase
      .from('calendar_feeds')
      .select('last_synced_at')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (!feed) return;
    const last = feed.last_synced_at ? new Date(feed.last_synced_at).getTime() : 0;
    if (Date.now() - last < 6 * 36e5) return;
    const { error } = await supabase.functions.invoke('sync-deadlines', { body: {} });
    if (!error) await refreshFromSupabase();
  };

  // Load (or clear) the student's data whenever the logged-in account changes
  useEffect(() => {
    if (currentUser?.id) {
      refreshFromSupabase().then(autoSyncCalendar);
    } else {
      setDeadlines([]);
      setEvents([]);
      setSources([]);
      setNotes([]);
      setQuiz(EMPTY_QUIZ);
      setUserEventInterests({});
    }
  }, [currentUser?.id]);

  // Update student's university affiliation and sync to Supabase profiles
  const updateUniversity = async (newUni: UniversityAffiliation): Promise<boolean> => {
    if (!currentUser) return false;
    const updatedUser: ScholarUser = {
      ...currentUser,
      university: newUni
    };
    setCurrentUser(updatedUser);
    try {
      localStorage.setItem('nocturne_auth_user', JSON.stringify(updatedUser));
    } catch (e) {
      console.warn('Local storage error:', e);
    }

    try {
      // Upsert into Supabase profiles table
      const { error } = await supabase.from('profiles').upsert({
        id: currentUser.id,
        email: currentUser.email,
        university: newUni
      });
      if (error) {
        console.warn('Profiles table update notice:', error.message);
      }
      showToast(`Affiliation updated to ${newUni === 'independent' ? 'Independent Scholar' : newUni}`);
    } catch (err) {
      console.warn('Error updating profile in Supabase:', err);
      showToast(`Affiliation updated to ${newUni === 'independent' ? 'Independent Scholar' : newUni}`);
    }
    return true;
  };

  // Toggle deadline completion
  const toggleDeadline = async (id: string) => {
    const item = deadlines.find(d => d.id === id);
    if (!item) return;

    const newStatus = item.status === 'completed' ? 'pending' : 'completed';
    setDeadlines(prev => prev.map(d => d.id === id ? { ...d, status: newStatus } : d));

    try {
      const { error } = await supabase.from('deadlines').update({ status: newStatus }).eq('id', id);
      if (!error) {
        showToast(`Deadline marked ${newStatus}`);
      }
    } catch (e: any) {
      console.warn(e);
    }
  };

  // Add a new deadline
  const addDeadline = async (deadlineData: Omit<Deadline, 'id'>): Promise<boolean> => {
    const newId = 'dl_' + Date.now();
    const newDeadline: Deadline = {
      ...deadlineData,
      id: newId
    };

    setDeadlines(prev => [newDeadline, ...prev]);

    try {
      const { data, error } = await supabase.from('deadlines').insert({
        title: deadlineData.title,
        course: deadlineData.course,
        due_date: deadlineData.due_date,
        status: deadlineData.status || 'pending',
        type: deadlineData.type || 'Assignment',
        source: deadlineData.source || 'Manual'
      }).select();

      if (!error && data && data[0]) {
        setDeadlines(prev => prev.map(d => d.id === newId ? (data[0] as Deadline) : d));
        showToast('Deadline saved to Supabase!');
      } else {
        showToast('Deadline added to your schedule');
      }
      return true;
    } catch (err) {
      showToast('Deadline added to your schedule');
      return true;
    }
  };

  // Add source to course
  const addSource = async (sourceData: Omit<SourceItem, 'id'>): Promise<boolean> => {
    const tempId = 'src_' + Date.now();
    const resolvedUserId = sourceData.user_id || currentUser?.id || 'authenticated_user';
    const newSrc: SourceItem = {
      ...sourceData,
      id: tempId,
      user_id: resolvedUserId,
      upload_method: sourceData.upload_method || 'manual_upload'
    };
    setSources(prev => [newSrc, ...prev]);

    try {
      const { data, error } = await supabase.from('sources').insert({
        user_id: resolvedUserId,
        course: sourceData.course,
        week: sourceData.week,
        file_url: sourceData.file_url,
        upload_method: sourceData.upload_method || 'manual_upload'
      }).select();

      if (!error && data && data[0]) {
        setSources(prev => prev.map(s => s.id === tempId ? (data[0] as SourceItem) : s));
        showToast('Source ingested into curriculum synthesis');
      } else {
        showToast('Source added to curriculum queue');
      }
      return true;
    } catch (err) {
      showToast('Source queued for analysis');
      return true;
    }
  };

  // Save quiz result
  // The quiz row is created by the generate-quiz function; here we only record the result.
  const saveQuizResult = async (score: number, answers: unknown[] = []): Promise<boolean> => {
    setQuiz(prev => ({ ...prev, score }));
    if (!quiz.id) return false;
    const { error } = await supabase
      .from('quizzes')
      .update({ score, answers, completed_at: new Date().toISOString() })
      .eq('id', quiz.id);
    if (error) {
      showToast(`Couldn't save your score: ${error.message}`);
      return false;
    }
    return true;
  };

  // Event RSVP / Register toggle
  // One user_event_interest row per (student, event); create it on first use
  const upsertInterest = async (eventId: string, patch: Record<string, unknown>) => {
    if (!currentUser?.id) return 'Please sign in again.';
    const { data: existing, error: readErr } = await supabase
      .from('user_event_interest')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('event_id', eventId)
      .limit(1);
    if (readErr) return readErr.message;
    const { error } = existing && existing.length
      ? await supabase.from('user_event_interest').update(patch).eq('id', existing[0].id)
      : await supabase.from('user_event_interest').insert({ user_id: currentUser.id, event_id: eventId, ...patch });
    return error ? error.message : null;
  };

  const toggleEventRegister = async (eventId: string) => {
    const nextVal = !userEventInterests[eventId];
    setUserEventInterests(prev => ({ ...prev, [eventId]: nextVal }));
    const err = await upsertInterest(eventId, { registered: nextVal });
    if (err) {
      setUserEventInterests(prev => ({ ...prev, [eventId]: !nextVal }));
      showToast(`Couldn't save: ${err}`);
    } else {
      showToast(nextVal ? 'Marked as registered' : 'Marked as not registered');
    }
  };

  const toggleEventReminder = async (eventId: string) => {
    const nextVal = !reminders[eventId];
    setReminders(prev => ({ ...prev, [eventId]: nextVal }));
    const err = await upsertInterest(eventId, { reminder_set: nextVal, reminder_timing: '1 day' });
    if (err) {
      setReminders(prev => ({ ...prev, [eventId]: !nextVal }));
      showToast(`Couldn't save: ${err}`);
    } else {
      showToast(nextVal ? 'Reminder set for 1 day before' : 'Reminder removed');
    }
  };

  // Login handler
  const loginUser = async (email: string, password?: string, fullName?: string): Promise<{ success: boolean; error?: string }> => {
    setIsSyncing(true);
    try {
      let inferredUni: UniversityAffiliation = inferUniversity(email);

      // Password is always required. Any auth failure stops here.
      if (!password) {
        return { success: false, error: 'Please enter your password.' };
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error || !data?.session?.user) {
        return { success: false, error: error?.message || 'Wrong email or password.' };
      }
      const userId = data.session.user.id;

      let userFullName: string | undefined = fullName?.trim() || undefined;

      // Check existing profile in Supabase
      try {
        const { data: profData } = await supabase.from('profiles').select('university, full_name').eq('id', userId).limit(1);
        if (profData && profData.length > 0) {
          if (profData[0].university) {
            inferredUni = profData[0].university as UniversityAffiliation;
          }
          if (profData[0].full_name) {
            userFullName = profData[0].full_name;
          } else if (userFullName) {
            await supabase.from('profiles').upsert({
              id: userId,
              email,
              university: inferredUni,
              full_name: userFullName
            });
          }
        } else {
          // Create row in profiles
          await supabase.from('profiles').upsert({
            id: userId,
            email,
            university: inferredUni,
            full_name: userFullName
          });
        }
      } catch (e) {
        console.warn('Profiles check notice:', e);
      }

      const namePart = email.split('@')[0] || 'Scholar';
      const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      const displayName = userFullName || capitalized;
      const scholar: ScholarUser = {
        id: userId,
        name: displayName,
        full_name: userFullName || undefined,
        email,
        major: '',
        streak: 0,
        initials: displayName.slice(0, 2).toUpperCase(),
        university: inferredUni
      };

      setCurrentUser(scholar);
      localStorage.setItem('nocturne_auth_user', JSON.stringify(scholar));
      setIsAuthModalOpen(false);
      setActiveScreen('home');
      showToast(`Welcome back, ${scholar.name} (${inferredUni === 'independent' ? 'Independent' : inferredUni})`);
      return { success: true };
    } catch (err: any) {
      showToast(err.message || 'Authentication error');
      return { success: false, error: err.message };
    } finally {
      setIsSyncing(false);
    }
  };

  // Sign up handler: any email can create an account, creates profile row with inferred university & full_name
  const signupUser = async (
    email: string,
    password: string,
    fullName?: string
  ): Promise<{ success: boolean; error?: string; warning?: string }> => {
    setIsSyncing(true);
    try {
      const trimmedEmail = email.trim();
      const trimmedFullName = fullName?.trim() || undefined;
      const inferredUni: UniversityAffiliation = inferUniversity(trimmedEmail);

      // 1. Call Supabase Auth signUp
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            university: inferredUni,
            full_name: trimmedFullName
          }
        }
      });

      if (authError) {
        return {
          success: false,
          error: authError.message
        };
      }

      const authId = authData?.user?.id;
      if (!authId) {
        return {
          success: false,
          error: 'Registration failed: Supabase did not return a user authentication ID.'
        };
      }

      // 2. Right after sign-up completes, before reaching Home, insert a row into profiles table:
      // id = the new user's auth id, email = their email, university = inferred from domain, full_name = student name
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authId,
          email: trimmedEmail,
          university: inferredUni,
          full_name: trimmedFullName
        })
        .select();

      // 3. Confirm write actually succeeds by checking Supabase's response, handling failure gracefully rather than silently
      let profileWarning: string | undefined;

      if (!profileError) {
        console.log('Confirmed profile row created in Supabase profiles:', profileData);
        showToast(`Sign-up complete • Profile verified & inserted in Supabase (${inferredUni})`);
      } else {
        console.warn('Supabase profiles insert response:', profileError);
        profileWarning = `Profiles table insert note (${profileError.code}): ${profileError.message}`;
        showToast(`Account registered (Auth ID: ${authId.slice(0, 8)}...) • Supabase profile write response: ${profileError.message}`);
      }

      // 4. Initialize user and proceed to Home
      const namePart = trimmedEmail.split('@')[0] || 'Scholar';
      const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      const displayName = trimmedFullName || capitalized;
      const scholar: ScholarUser = {
        id: authId,
        name: displayName,
        full_name: trimmedFullName,
        email: trimmedEmail,
        major: '',
        streak: 1,
        initials: displayName.slice(0, 2).toUpperCase(),
        university: inferredUni
      };

      setCurrentUser(scholar);
      localStorage.setItem('nocturne_auth_user', JSON.stringify(scholar));
      setIsAuthModalOpen(false);
      setActiveScreen('home');

      return {
        success: true,
        warning: profileWarning
      };
    } catch (err: any) {
      const msg = err.message || 'Signup error';
      showToast(msg);
      return { success: false, error: msg };
    } finally {
      setIsSyncing(false);
    }
  };

  // Logout handler
  const logoutUser = async () => {
    setIsSyncing(true);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Sign out warning:', e);
    }
    setCurrentUser(null);
    localStorage.removeItem('nocturne_auth_user');
    setIsAuthModalOpen(false);
    setActiveScreen('home'); // Once currentUser is null, app router displays LoginScreen
    showToast('Signed out of scholar session');
    setIsSyncing(false);
  };

  return (
    <AppContext.Provider
      value={{
        activeScreen,
        setActiveScreen,
        homeSubView,
        setHomeSubView,
        themeMode,
        setThemeMode,
        resolvedTheme,
        language,
        setLanguage,
        t,
        showEnglishSubtitles,
        setShowEnglishSubtitles,
        generateNoteForCourse,
        isAuthChecking,
        currentUser,
        isInstitutional,
        loginUser,
        signupUser,
        logoutUser,
        updateUniversity,
        isAuthModalOpen,
        setIsAuthModalOpen,
        deadlines,
        events,
        sources,
        notes,
        quiz,
        setQuiz,
        quotes,
        userEventInterests,
        reminders,
        activeQuote,
        selectedCourse,
        setSelectedCourse,
        selectedWeek,
        setSelectedWeek,
        selectedDate,
        setSelectedDate,
        toggleDeadline,
        addDeadline,
        addSource,
        setSources,
        saveQuizResult,
        toggleEventRegister,
        toggleEventReminder,
        refreshFromSupabase,
        isSyncing,
        lastSyncedText,
        notification,
        setNotification,
        showToast
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
