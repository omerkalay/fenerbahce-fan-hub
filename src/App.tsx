import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Dashboard from './components/Dashboard';
import FormationBuilder from './components/FormationBuilder';
import NotificationSettings from './components/NotificationSettings';
import FixtureSchedule from './components/FixtureSchedule';
import Statistics from './components/Statistics';
import ErrorBoundary from './components/ErrorBoundary';
import { BarChart2 } from 'lucide-react';
import { fetchNextMatch, fetchNext3Matches, BACKEND_URL } from './services/api';
import type { MatchData, LiveMatchState, LiveMatchData, CachedMatchPayload } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';

type TabId = 'dashboard' | 'fixtures' | 'statistics' | 'builder';

const readCachedMatchData = (): CachedMatchPayload | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('fb_last_match');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('fb_last_match parse error:', err);
    return null;
  }
};

const shouldCheckLiveImmediately = (match: MatchData | null | undefined): boolean => {
  if (!match?.startTimestamp) return false;
  return (match.startTimestamp * 1000) <= Date.now();
};


const GoogleSignInButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-white text-gray-800 font-semibold hover:bg-gray-100 transition-all duration-200 shadow-lg"
  >
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
    Google ile Giriş Yap
  </button>
);

function UserAvatar() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  if (!user) {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 text-slate-400 hover:bg-white/10 hover:text-yellow-400 transition-all duration-300"
          title="Giriş yap"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </button>
        {showModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fadeIn" onClick={() => setShowModal(false)}>
            <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 max-w-sm w-full animate-slideUp shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-white">Hesap</h2>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white hover:rotate-90 transition-all duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-400/10 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Giriş Yap</h3>
                <p className="text-sm text-slate-400 mb-6">
                  Oy kullan, bildirim al ve ayarlarını tüm cihazlarda senkronize tut.
                </p>
                <GoogleSignInButton onClick={async () => {
                  try { await signInWithGoogle(); setShowModal(false); } catch (err) { console.error('Google sign-in failed:', err); }
                }} />
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 bg-white/5 text-yellow-400/80 ring-2 ring-yellow-400/60 hover:bg-white/10 hover:ring-yellow-400 hover:scale-110"
        title={user.displayName || 'Hesap'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </button>
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-12 bg-[#0f172a] border border-white/10 rounded-xl p-3 z-50 min-w-[180px] shadow-2xl">
            <p className="text-sm text-white font-medium truncate">{user.displayName}</p>
            <p className="text-xs text-slate-400 truncate mb-2">{user.email}</p>
            <button
              onClick={async () => { setShowMenu(false); await signOut(); }}
              className="w-full text-left text-sm text-red-400 hover:text-red-300 py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              Çıkış Yap
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function AppContent() {
  const [fontsReady, setFontsReady] = useState(typeof window === 'undefined');
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const cachedData = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return readCachedMatchData();
  }, []);
  const [matchData, setMatchData] = useState<MatchData | null>(cachedData?.nextMatch ?? null);
  const [next3Matches, setNext3Matches] = useState<MatchData[]>(cachedData?.next3Matches ?? []);
  const [lastUpdated, setLastUpdated] = useState<number | null>(cachedData?.timestamp ?? null);
  const [loading, setLoading] = useState(!cachedData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasDataRef = useRef(Boolean(cachedData?.nextMatch));

  // Live match states
  const [liveMatchState, setLiveMatchState] = useState<LiveMatchState>(
    shouldCheckLiveImmediately(cachedData?.nextMatch) ? 'checking' : 'countdown'
  );
  const [liveMatchData, setLiveMatchData] = useState<LiveMatchData | null>(null);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const livePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    hasDataRef.current = Boolean(matchData);
  }, [matchData]);

  // Foreground FCM: uygulama açıkken gelen bildirimleri göster
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    const setupForegroundMessaging = async () => {
      try {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        const { messaging } = await import('./firebase');
        const { onMessage } = await import('firebase/messaging');
        if (!messaging) return;

        unsubscribe = onMessage(messaging, (payload) => {
          console.log('📩 Foreground message:', payload);
          const { title, body } = payload.notification || {};
          if (title) {
            new Notification(title, {
              body: body || '',
              icon: 'https://media.api-sports.io/football/teams/611.png',
              data: payload.data
            });
          }
        });
      } catch (err) {
        console.error('Foreground messaging setup error:', err);
      }
    };

    setupForegroundMessaging();
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  // Fetch match data once when app loads
  const loadMatchData = useCallback(async () => {
    const hasCached = hasDataRef.current;
    setErrorMessage(null);
    if (hasCached) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [nextMatch, upcomingMatches] = await Promise.all([
        fetchNextMatch(),
        fetchNext3Matches()
      ]);

      const normalizedUpcoming = Array.isArray(upcomingMatches) ? upcomingMatches : [];
      setNext3Matches(normalizedUpcoming);

      if (nextMatch) {
        setMatchData(nextMatch);
        setCurrentMatchIndex(0);
        const payload: CachedMatchPayload = {
          nextMatch,
          next3Matches: normalizedUpcoming,
          timestamp: Date.now()
        };

        if (typeof window !== 'undefined') {
          localStorage.setItem('fb_last_match', JSON.stringify(payload));
        }

        setLastUpdated(payload.timestamp);
      } else {
        setMatchData(null);
        setErrorMessage('Maç verisi alınamadı. Lütfen bağlantını kontrol edip tekrar dene.');
      }
    } catch (err) {
      console.error('loadMatchData error:', err);
      setMatchData(null);
      setNext3Matches([]);
      setErrorMessage('Beklenmeyen bir hata oluştu. Tekrar dene veya biraz sonra gel.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMatchData();
  }, [loadMatchData]);

  // Get current match based on index
  const currentMatch = useMemo(() => {
    if (currentMatchIndex === 0) return matchData;
    if (next3Matches.length > currentMatchIndex) return next3Matches[currentMatchIndex];
    return matchData;
  }, [matchData, next3Matches, currentMatchIndex]);

  // Live match polling
  const fetchLiveMatch = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch(`${BACKEND_URL}/live-match`);
      if (!response.ok) {
        setLiveMatchData(null);
        return null;
      }
      const data: LiveMatchData = await response.json();
      if (data.matchState === 'no-match') {
        setLiveMatchData(null);
        return 'no-match';
      }
      setLiveMatchData(data);
      return data.matchState;
    } catch (err) {
      console.error('Live match fetch error:', err);
      return null;
    }
  }, []);

  const stopLivePolling = useCallback(() => {
    if (livePollingRef.current) {
      clearInterval(livePollingRef.current);
      livePollingRef.current = null;
    }
  }, []);

  const resolveNoMatchState = useCallback((): LiveMatchState => {
    if (!currentMatch?.startTimestamp) return 'checking';
    return (currentMatch.startTimestamp * 1000) > Date.now() ? 'countdown' : 'checking';
  }, [currentMatch]);

  // Start live polling when countdown reaches 0
  const startLivePolling = useCallback(() => {
    if (livePollingRef.current) return; // Already polling

    const poll = async () => {
      const state = await fetchLiveMatch();
      if (state) {
        setLiveMatchState(state === 'no-match' ? resolveNoMatchState() : state as LiveMatchState);
      }
    };

    // Initial check
    poll();

    // Poll every 30 seconds
    livePollingRef.current = setInterval(poll, 30000);
  }, [fetchLiveMatch, resolveNoMatchState]);

  // Handle countdown reaching 0 — transition to live checking
  const onCountdownEnd = useCallback(() => {
    setLiveMatchState('checking');
    startLivePolling();
  }, [startLivePolling]);

  // If cached/current match is already started, avoid rendering stale countdown/pre flashes.
  useEffect(() => {
    if (!currentMatch?.startTimestamp) return;

    const started = shouldCheckLiveImmediately(currentMatch);

    if (started && liveMatchState === 'countdown') {
      setLiveMatchState('checking');
      return;
    }

    if (!started && (liveMatchState === 'pre' || liveMatchState === 'checking') && !liveMatchData) {
      stopLivePolling();
      setLiveMatchState('countdown');
    }
  }, [currentMatch, liveMatchState, liveMatchData, stopLivePolling]);

  // Checking state reuses existing live polling flow without adding extra calls.
  useEffect(() => {
    if (liveMatchState === 'checking') {
      startLivePolling();
    }
  }, [liveMatchState, startLivePolling]);

  // Post state is stable (no auto-transition). Stop polling to avoid unnecessary requests.
  useEffect(() => {
    if (liveMatchState === 'post') {
      stopLivePolling();
    }
  }, [liveMatchState, stopLivePolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLivePolling();
    };
  }, [stopLivePolling]);

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
