import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import FormationBuilder from './components/FormationBuilder';
import NotificationSettings from './components/NotificationSettings';
import FixtureSchedule from './components/FixtureSchedule';
import Statistics from './components/Statistics';
import ErrorBoundary from './components/ErrorBoundary';
import UserAvatar from './components/UserAvatar';
import { BarChart2 } from 'lucide-react';
import { AuthProvider } from './contexts/AuthContext';
import { useMatchBootstrap } from './hooks/useMatchBootstrap';
import { useLiveMatchState } from './hooks/useLiveMatchState';
import { useForegroundMessaging } from './hooks/useForegroundMessaging';

type TabId = 'dashboard' | 'fixtures' | 'statistics' | 'builder';

function AppContent() {
  const [fontsReady, setFontsReady] = useState(typeof window === 'undefined');
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  const {
    cachedData,
    matchData,
    next3Matches,
    lastUpdated,
    loading,
    isRefreshing,
    errorMessage,
    currentMatch,
    loadMatchData,
  } = useMatchBootstrap();

  const { liveMatchState, liveMatchData, onCountdownEnd } = useLiveMatchState(cachedData, currentMatch);

  useForegroundMessaging();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!document.fonts) {
      setFontsReady(true);
      return;
    }

    let cancelled = false;
    const markReady = () => {
      if (!cancelled) setFontsReady(true);
    };

    if (document.fonts.check('1em "Outfit"')) {
      markReady();
      return () => {
        cancelled = true;
      };
    }

    const timeoutMs = 1200;
    Promise.race([
      Promise.all([
        document.fonts.load('400 1em "Outfit"').catch(() => null),
        document.fonts.load('700 1em "Outfit"').catch(() => null),
        document.fonts.ready.catch(() => null)
      ]),
      new Promise((resolve) => setTimeout(resolve, timeoutMs))
    ]).then(markReady);

    return () => {
      cancelled = true;
    };
  }, []);

  if (!fontsReady) {
    return (
      <div className="min-h-screen bg-slate-950 text-white pb-24 relative overflow-hidden">
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
          <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-yellow-500/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[100px]"></div>
        </div>
        <div className="relative z-10 max-w-md mx-auto h-full min-h-screen flex flex-col px-4 pt-6">
          <div className="h-10 w-52 rounded-xl bg-white/10 animate-pulse mb-2"></div>
          <div className="h-5 w-28 rounded-lg bg-white/5 animate-pulse mb-8"></div>
          <div className="glass-card rounded-3xl p-6 mb-6">
            <div className="h-6 w-56 rounded-full bg-white/10 animate-pulse mb-6"></div>
            <div className="h-28 rounded-2xl bg-white/5 animate-pulse mb-6"></div>
            <div className="h-24 rounded-2xl bg-white/5 animate-pulse"></div>
          </div>
          <div className="glass-panel rounded-2xl p-4 space-y-3">
            <div className="h-5 w-36 rounded-lg bg-white/10 animate-pulse"></div>
            <div className="h-14 rounded-xl bg-white/5 animate-pulse"></div>
            <div className="h-14 rounded-xl bg-white/5 animate-pulse"></div>
            <div className="h-14 rounded-xl bg-white/5 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24 relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-yellow-500/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative z-10 max-w-md mx-auto h-full min-h-screen flex flex-col">
        {/* Header */}
        <header className="p-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-yellow-200">
              Fenerbahçe Hub
            </h1>
            <p className="text-slate-400 text-xs">Taraftarın Sesi</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationSettings />
            <UserAvatar />
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 p-0.5 shadow-lg shadow-yellow-500/20">
              <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
                <img src="https://media.api-sports.io/football/teams/611.png" alt="FB Logo" className="w-8 h-8 object-contain" />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 overflow-y-auto no-scrollbar">
          {activeTab === 'dashboard' && (
            <ErrorBoundary fallbackTitle="Pano">
              <Dashboard
                matchData={currentMatch}
                next3Matches={next3Matches}
                loading={loading && !matchData}
                onRetry={loadMatchData}
                errorMessage={errorMessage}
                lastUpdated={lastUpdated}
                isRefreshing={isRefreshing}
                liveMatchState={liveMatchState}
                liveMatchData={liveMatchData}
                onCountdownEnd={onCountdownEnd}
              />
            </ErrorBoundary>
          )}
          {activeTab === 'fixtures' && (
            <ErrorBoundary fallbackTitle="Fikstür">
              <FixtureSchedule />
            </ErrorBoundary>
          )}
          {activeTab === 'statistics' && (
            <ErrorBoundary fallbackTitle="İstatistikler">
              <Statistics />
            </ErrorBoundary>
          )}
          {activeTab === 'builder' && (
            <ErrorBoundary fallbackTitle="Kadro Kur">
              <FormationBuilder />
            </ErrorBoundary>
          )}
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[88%] max-w-sm glass-panel rounded-2xl p-2 flex justify-around items-center z-50">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all duration-300 ${activeTab === 'dashboard' ? 'bg-white/10 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'text-slate-400 hover:text-white'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-[10px] mt-1 font-medium">Pano</span>
          </button>

          <button
            onClick={() => setActiveTab('fixtures')}
            className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all duration-300 ${activeTab === 'fixtures' ? 'bg-white/10 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'text-slate-400 hover:text-white'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
            </svg>
            <span className="text-[10px] mt-1 font-medium">Fikstür</span>
          </button>

          <button
            onClick={() => setActiveTab('statistics')}
            className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all duration-300 ${activeTab === 'statistics' ? 'bg-white/10 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'text-slate-400 hover:text-white'}`}
          >
            <BarChart2 className="h-7 w-7" />
            <span className="text-[10px] mt-1 font-medium">İstatistikler</span>
          </button>

          <button
            onClick={() => setActiveTab('builder')}
            className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all duration-300 ${activeTab === 'builder' ? 'bg-yellow-500 text-white shadow-[0_0_20px_rgba(234,179,8,0.5)] scale-110' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="text-[10px] mt-1 font-medium">Kadro Kur</span>
          </button>
        </nav>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
