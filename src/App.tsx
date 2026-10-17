import React, { useState, useEffect } from 'react';
import { CapyLoading } from './components/CapyStates';
import { Logo } from './components/Logo';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { HowItWorks } from './components/HowItWorks';
import { FocusTimer } from './components/FocusTimer';
import { BottomNav } from './components/BottomNav';
import { AuthModal } from './components/AuthModal';
import { LoginScreen } from './screens/LoginScreen';
import { CapyNotice } from './components/CapyNotice';
import { PasswordRecovery, useRecoveryGate } from './components/PasswordRecovery';
import { HomeScreen } from './screens/HomeScreen';
import { CalendarView } from './screens/CalendarView';
import { NotesScreen } from './screens/NotesScreen';
import { NotesDetailView } from './screens/NotesDetailView';
import { QuizScreen } from './screens/QuizScreen';
import { EventsScreen } from './screens/EventsScreen';
import { DeadlineMatrixView } from './screens/DeadlineMatrixView';
import { MoreScreen } from './screens/MoreScreen';

const MainLayout: React.FC = () => {
  const { activeScreen, currentUser, isAuthChecking } = useApp();
  // A password-reset link must never open the app directly: lock it until a new password is set
  const recoveryPending = useRecoveryGate();

  // Hidden developer route state (/dev-login or #/dev-login)
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return (window.location.pathname + window.location.hash).toLowerCase();
    }
    return '/';
  });

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath((window.location.pathname + window.location.hash).toLowerCase());
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);


  // 1. Initial auth verification splash
  if (recoveryPending) return <PasswordRecovery />;

  if (isAuthChecking) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F4F7FB] text-[#0E0E12] transition-colors">
        <Logo size="h-[105px] w-[105px] mb-5" />
        <CapyLoading text="Capy is waking up…" size={64} />
      </div>
    );
  }

  // 2. Unauthenticated state: strictly show Login/Signup entry point
  // Side rail, bottom nav, and header are NOT rendered.
  if (!currentUser) {
    return (
      <LoginScreen />
    );
  }

  // 3. Authenticated state: render navigation rail, header, bottom bar, and active screen
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[#F4F7FB] text-[#0E0E12] font-sans antialiased transition-colors">
      {/* Desktop / iPad Landscape Side Rail */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden min-w-0 md:ml-20 lg:ml-64">
        {/* Top Header */}
        <Header />
        <HowItWorks />
        <FocusTimer />
        <CapyNotice />

        {/* Screen Viewport with top offset for fixed header and bottom padding for mobile bar */}
        <main className="app-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain pt-16 pb-24 md:pb-0 flex flex-col min-w-0">
          {activeScreen === 'home' && <HomeScreen />}
          {activeScreen === 'calendar' && <CalendarView />}
          {activeScreen === 'matrix' && <DeadlineMatrixView />}
          {activeScreen === 'notes' && <NotesScreen />}
          {activeScreen === 'notes-detail' && <NotesDetailView />}
          {activeScreen === 'quiz' && <QuizScreen />}
          {activeScreen === 'events' && <EventsScreen />}
          {activeScreen === 'more' && <MoreScreen />}
        </main>

        {/* Mobile / Tablet Portrait Bottom Tab Bar */}
        <BottomNav />
      </div>

      {/* Profile & Account Switcher Modal */}
      <AuthModal />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
