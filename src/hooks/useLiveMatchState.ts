import { useState, useCallback, useEffect, useRef } from 'react';
import { BACKEND_URL } from '../services/api';
import { isLiveMatchForScheduledMatch } from '../utils/matchIdentity';
import type { MatchData, LiveMatchState, LiveMatchData, CachedMatchPayload } from '../types';

const shouldCheckLiveImmediately = (match: MatchData | null | undefined): boolean => {
  if (!match?.startTimestamp) return false;
  return (match.startTimestamp * 1000) <= Date.now();
};

export function useLiveMatchState(
  cachedData: CachedMatchPayload | null,
  currentMatch: MatchData | null,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const [liveMatchState, setLiveMatchState] = useState<LiveMatchState>(
    enabled ? (shouldCheckLiveImmediately(cachedData?.nextMatch) ? 'checking' : 'countdown') : 'idle'
  );
  const [liveMatchData, setLiveMatchData] = useState<LiveMatchData | null>(null);
  const livePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentMatchRef = useRef<MatchData | null>(currentMatch);

  useEffect(() => {
    currentMatchRef.current = currentMatch;
  }, [currentMatch]);

  const fetchLiveMatch = useCallback(async (): Promise<string | null> => {
    if (!enabled) return null;
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
      if (data.matchState === 'unsupported') {
        setLiveMatchData(null);
        return 'unsupported';
      }
      if (!isLiveMatchForScheduledMatch(data, currentMatchRef.current)) {
        console.warn('Ignoring live cache from a different fixture');
        setLiveMatchData(null);
        return 'no-match';
      }
      setLiveMatchData(data);
      return data.matchState;
    } catch (err) {
      console.error('Live match fetch error:', err);
      return null;
    }
  }, [enabled]);

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
    if (!enabled || livePollingRef.current) return;

    const poll = async () => {
      const state = await fetchLiveMatch();
      if (state) {
        setLiveMatchState(state === 'no-match' ? resolveNoMatchState() : state as LiveMatchState);
      }
    };

    poll();
    livePollingRef.current = setInterval(poll, 30000);
  }, [enabled, fetchLiveMatch, resolveNoMatchState]);

  const onCountdownEnd = useCallback(() => {
    if (!enabled) return;
    setLiveMatchState('checking');
    startLivePolling();
  }, [enabled, startLivePolling]);

  // If cached/current match is already started, avoid rendering stale countdown/pre flashes.
  useEffect(() => {
    if (!enabled) return;
    if (!currentMatch?.startTimestamp) return;

    const started = shouldCheckLiveImmediately(currentMatch);

    if (started && liveMatchState === 'countdown') {
      setLiveMatchState('checking');
      return;
    }

    if (!started && (liveMatchState === 'pre' || liveMatchState === 'checking' || liveMatchState === 'unsupported') && !liveMatchData) {
      stopLivePolling();
      setLiveMatchState('countdown');
    }
  }, [currentMatch, enabled, liveMatchState, liveMatchData, stopLivePolling]);

  // Checking state reuses existing live polling flow without adding extra calls.
  useEffect(() => {
    if (!enabled) return;
    if (liveMatchState === 'checking') {
      startLivePolling();
    }
  }, [enabled, liveMatchState, startLivePolling]);

  // Post state is stable (no auto-transition). Stop polling to avoid unnecessary requests.
  useEffect(() => {
    if (!enabled) return;
    if (liveMatchState === 'post' || liveMatchState === 'unsupported') {
      stopLivePolling();
    }
  }, [enabled, liveMatchState, stopLivePolling]);

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
