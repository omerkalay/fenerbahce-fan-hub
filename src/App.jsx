import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Dashboard from './components/Dashboard';
import FormationBuilder from './components/FormationBuilder';
import NotificationSettings from './components/NotificationSettings';
import { fetchNextMatch, fetchNext3Matches, BACKEND_URL } from './services/api';

const readCachedMatchData = () => {
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

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const cachedData = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return readCachedMatchData();
  }, []);
  const [matchData, setMatchData] = useState(cachedData?.nextMatch ?? null);
  const [next3Matches, setNext3Matches] = useState(cachedData?.next3Matches ?? []);
  const [lastUpdated, setLastUpdated] = useState(cachedData?.timestamp ?? null);
  const [loading, setLoading] = useState(!cachedData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const hasDataRef = useRef(Boolean(cachedData?.nextMatch));

  // Live match states
  const [liveMatchState, setLiveMatchState] = useState('countdown'); // countdown | pre | in | post | idle
  const [liveMatchData, setLiveMatchData] = useState(null);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const livePollingRef = useRef(null);
  const postTransitionRef = useRef(null);

  useEffect(() => {
    hasDataRef.current = Boolean(matchData);
  }, [matchData]);

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
        const payload = {
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
  const fetchLiveMatch = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/live-match`);
      if (!response.ok) {
        setLiveMatchData(null);
        return null;
      }
      const data = await response.json();
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

  // Start live polling when countdown reaches 0
  const startLivePolling = useCallback(() => {
    if (livePollingRef.current) return; // Already polling

    const poll = async () => {
      const state = await fetchLiveMatch();
      if (state) {
        setLiveMatchState(state === 'no-match' ? 'pre' : state);
      }
    };

    // Initial check
    poll();

    // Poll every 30 seconds
    livePollingRef.current = setInterval(poll, 30000);
  }, [fetchLiveMatch]);

  const stopLivePolling = useCallback(() => {
    if (livePollingRef.current) {
      clearInterval(livePollingRef.current);
      livePollingRef.current = null;
    }
  }, []);

  // Handle countdown reaching 0 — transition to live checking
  const onCountdownEnd = useCallback(() => {
    setLiveMatchState('pre');
    startLivePolling();
  }, [startLivePolling]);

  // Handle post-match: wait 30s then move to next match
  useEffect(() => {
    if (liveMatchState === 'post') {
      postTransitionRef.current = setTimeout(() => {
        stopLivePolling();
        setLiveMatchData(null);
        setLiveMatchState('countdown');

        // Move to next match
        if (next3Matches.length > currentMatchIndex + 1) {
          setCurrentMatchIndex(prev => prev + 1);
        }
      }, 30000); // 30 seconds
    }

    return () => {
      if (postTransitionRef.current) {
        clearTimeout(postTransitionRef.current);
      }
    };
  }, [liveMatchState, currentMatchIndex, next3Matches.length, stopLivePolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLivePolling();
      if (postTransitionRef.current) {
        clearTimeout(postTransitionRef.current);
      }
    };
  }, [stopLivePolling]);

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
          )}
          {activeTab === 'builder' && <FormationBuilder />}
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[70%] max-w-xs glass-panel rounded-2xl p-2 flex justify-around items-center z-50">
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

export default App;
