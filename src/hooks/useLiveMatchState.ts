import { useState, useCallback, useEffect, useRef } from 'react';
import { BACKEND_URL } from '../services/api';
import type { MatchData, LiveMatchState, LiveMatchData, CachedMatchPayload } from '../types';

const shouldCheckLiveImmediately = (match: MatchData | null | undefined): boolean => {
  if (!match?.startTimestamp) return false;
  return (match.startTimestamp * 1000) <= Date.now();
};

export function useLiveMatchState(
  cachedData: CachedMatchPayload | null,
  currentMatch: MatchData | null,
) {
  const [liveMatchState, setLiveMatchState] = useState<LiveMatchState>(
    shouldCheckLiveImmediately(cachedData?.nextMatch) ? 'checking' : 'countdown'
  );
  const [liveMatchData, setLiveMatchData] = useState<LiveMatchData | null>(null);
  const livePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const startLivePolling = useCallback(() => {
    if (livePollingRef.current) return;

    const poll = async () => {
      const state = await fetchLiveMatch();
      if (state) {
        setLiveMatchState(state === 'no-match' ? resolveNoMatchState() : state as LiveMatchState);
      }
    };

    poll();
    livePollingRef.current = setInterval(poll, 30000);
  }, [fetchLiveMatch, resolveNoMatchState]);

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

  return {
    liveMatchState,
    liveMatchData,
    onCountdownEnd,
  };
}
