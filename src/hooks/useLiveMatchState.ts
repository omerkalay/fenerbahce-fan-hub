import { useState, useCallback, useEffect, useRef } from 'react';
import { BACKEND_URL } from '../services/api';
import { isLiveMatchForScheduledMatch } from '../utils/matchIdentity';
import type { MatchData, LiveMatchState, LiveMatchData, CachedMatchPayload } from '../types';

const hasStarted = (match: MatchData | null | undefined): boolean => Boolean(
  match?.startTimestamp && match.startTimestamp * 1000 <= Date.now()
);
const isPageHidden = () => document.visibilityState === 'hidden';

export function useLiveMatchState(
  cachedData: CachedMatchPayload | null,
  currentMatch: MatchData | null,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const [liveMatchState, setLiveMatchState] = useState<LiveMatchState>(
    enabled ? (hasStarted(currentMatch ?? cachedData?.nextMatch) ? 'checking' : 'countdown') : 'idle'
  );
  const [liveMatchData, setLiveMatchData] = useState<LiveMatchData | null>(null);
  const [liveMatchError, setLiveMatchError] = useState<string | null>(null);
  const [countdownEndedFor, setCountdownEndedFor] = useState<string | null>(null);
  // A refreshed object for the same fixture must not restart a finished match.
  const matchKey = currentMatch ? JSON.stringify([
    currentMatch.id, currentMatch.startTimestamp,
    currentMatch.homeTeam.id, currentMatch.awayTeam.id,
    currentMatch.homeTeam.name, currentMatch.awayTeam.name,
  ]) : '';
  const currentMatchRef = useRef(currentMatch);
  useEffect(() => { currentMatchRef.current = currentMatch; }, [currentMatch]);

  useEffect(() => {
    const match = currentMatchRef.current;
    setLiveMatchData(null);
    setLiveMatchError(null);
    if (!enabled || !match) {
      setLiveMatchState('idle');
      return;
    }
    if (!hasStarted(match) && countdownEndedFor !== matchKey) {
      setLiveMatchState('countdown');
      return;
    }

    setLiveMatchState('checking');
    let cancelled = false;
    let stopped = false;
    let hasLiveData = false;
    let nextPoll: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | null = null;

    const poll = async () => {
      if (cancelled || stopped || request || isPageHidden()) return;
      const controller = new AbortController();
      request = controller;
      // Covers both response headers and JSON decoding, not just fetch resolution.
      const timeout = setTimeout(() => controller.abort(), 15_000);
      try {
        const response = await fetch(`${BACKEND_URL}/live-match`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Live match request failed: ${response.status}`);
        const data: LiveMatchData = await response.json();
        if (cancelled || controller.signal.aborted) return;

        if (data.matchState === 'unsupported') {
          setLiveMatchData(null);
          setLiveMatchState('unsupported');
          setLiveMatchError(null);
          stopped = true;
        } else if (data.matchState === 'no-match' || !isLiveMatchForScheduledMatch(data, match)) {
          hasLiveData = false;
          setLiveMatchData(null);
          setLiveMatchError(null);
          setLiveMatchState(hasStarted(match) ? 'checking' : 'countdown');
          stopped = !hasStarted(match);
        } else {
          hasLiveData = true;
          setLiveMatchData(data);
          setLiveMatchState(data.matchState);
          setLiveMatchError(null);
          stopped = data.matchState === 'post';
        }
      } catch {
        if (!cancelled) {
          setLiveMatchError(hasLiveData
            ? 'Canlı maç verisi yenilenemedi. Son alınan bilgiler gösteriliyor.'
            : 'Canlı maç verisi alınamadı. Yeniden deneniyor.');
        }
      } finally {
        clearTimeout(timeout);
        request = null;
        if (!cancelled && !stopped && !isPageHidden()) {
          nextPoll = setTimeout(() => { void poll(); }, 30_000);
        }
      }
    };

    const handleResume = () => {
      clearTimeout(nextPoll);
      if (!isPageHidden()) void poll();
    };
    void poll();
    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('online', handleResume);
    window.addEventListener('pageshow', handleResume);
    return () => {
      cancelled = true;
      clearTimeout(nextPoll);
      request?.abort();
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('online', handleResume);
      window.removeEventListener('pageshow', handleResume);
    };
  }, [enabled, matchKey, countdownEndedFor]);

  const onCountdownEnd = useCallback(() => {
    if (enabled && matchKey) setCountdownEndedFor(matchKey);
  }, [enabled, matchKey]);

  return { liveMatchState, liveMatchData, liveMatchError, onCountdownEnd };
}
