import React, { useState, useEffect } from 'react';
import { Logo } from './components/Logo';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { HowItWorks } from './components/HowItWorks';
import { BottomNav } from './components/BottomNav';
import { AuthModal } from './components/AuthModal';
import { LoginScreen } from './screens/LoginScreen';
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
  if (isAuthChecking) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F4F7FB] text-[#0E0E12] transition-colors">
        <Logo size="h-[105px] w-[105px] mb-5" />
        <div className="flex items-center gap-2 text-xs font-mono text-[#64748B]">
          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping"></span>
          <span>Verifying Academic Session...</span>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated state: strictly show Login/Signup entry point
  // Side rail, bottom nav, and header are NOT rendered.
  if (!currentUser) {
    return <LoginScreen />;
  }

  // 3. Authenticated state: render navigation rail, header, bottom bar, and active screen
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F4F7FB] text-[#0E0E12] font-sans antialiased transition-colors">
      {/* Desktop / iPad Landscape Side Rail */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 md:ml-20 lg:ml-64">
        {/* Top Header */}
        <Header />
        <HowItWorks />

        {/* Screen Viewport with top offset for fixed header and bottom padding for mobile bar */}
        <main className="flex-1 overflow-y-auto pt-16 pb-20 md:pb-0 flex flex-col min-w-0">
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
