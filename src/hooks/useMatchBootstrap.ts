import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { fetchMatchStatus } from '../services/api';
import type { MatchData, CachedMatchPayload, SeasonMeta, SeasonState } from '../types';

const readCachedMatchData = (): CachedMatchPayload | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('fb_last_match');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('fb_last_match parse error:', err);
    return null;
  }
};

const persistMatchData = (payload: CachedMatchPayload) => {
  try {
    localStorage.setItem('fb_last_match', JSON.stringify(payload));
  } catch {
    // A storage failure must not turn a successful network response into an error.
  }
};

export function useMatchBootstrap({ enabled = true }: { enabled?: boolean } = {}) {
  const cachedData = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return readCachedMatchData();
  }, []);

  const [matchData, setMatchData] = useState<MatchData | null>(cachedData?.nextMatch ?? null);
  const [next3Matches, setNext3Matches] = useState<MatchData[]>(cachedData?.next3Matches ?? []);
  const [seasonState, setSeasonState] = useState<SeasonState>(cachedData?.seasonState ?? (cachedData?.nextMatch ? 'active' : 'unknown'));
  const [season, setSeason] = useState<SeasonMeta | null>(cachedData?.season ?? null);
  const [loading, setLoading] = useState(enabled && !cachedData);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasDataRef = useRef(Boolean(cachedData?.nextMatch));
  const inFlightRef = useRef(false);
  const lastAttemptRef = useRef<number | null>(null);
  const requestGenerationRef = useRef(0);

  useEffect(() => {
    hasDataRef.current = Boolean(matchData);
  }, [matchData]);

  const loadMatchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    lastAttemptRef.current = Date.now();
    const generation = requestGenerationRef.current;
    const hasCached = hasDataRef.current;
    setErrorMessage(null);
    if (!hasCached) {
      setLoading(true);
    }

    try {
      const status = await fetchMatchStatus();
      if (generation !== requestGenerationRef.current) return;
      const nextMatch = status.nextMatch;
      const upcomingMatches = status.next3Matches;
      const resolvedSeasonState = status.seasonState ?? (nextMatch ? 'active' : 'unknown');
      const timestamp = status.lastUpdate ?? Date.now();

      const normalizedUpcoming = Array.isArray(upcomingMatches) ? upcomingMatches : [];

      if (nextMatch) {
        setNext3Matches(normalizedUpcoming);
        setSeasonState(resolvedSeasonState);
        setSeason(status.season);
        setMatchData(nextMatch);
        const payload: CachedMatchPayload = {
          nextMatch,
          next3Matches: normalizedUpcoming,
          timestamp,
          seasonState: resolvedSeasonState,
          season: status.season
        };

        persistMatchData(payload);

      } else if (resolvedSeasonState === 'offseason') {
        setNext3Matches(normalizedUpcoming);
        setSeasonState(resolvedSeasonState);
        setSeason(status.season);
        setMatchData(null);
        setErrorMessage(null);

        const payload: CachedMatchPayload = {
          nextMatch: null,
          next3Matches: normalizedUpcoming,
          timestamp,
          seasonState: resolvedSeasonState,
          season: status.season
        };

        persistMatchData(payload);

      } else {
        if (!hasCached) {
          setMatchData(null);
          setNext3Matches([]);
          setSeasonState(resolvedSeasonState);
          setSeason(status.season);
        }
        setErrorMessage(
          hasCached
            ? 'Maç verisi şu anda yenilenemedi. Son kayıtlı bilgiler gösteriliyor.'
            : 'Maç verisi şu anda yenilenemedi. Lütfen biraz sonra tekrar dene.'
        );
      }
    } catch (err) {
      if (generation !== requestGenerationRef.current) return;
      console.error('loadMatchData error:', err);
      if (!hasCached) {
        setMatchData(null);
        setNext3Matches([]);
      }
      setErrorMessage(
        hasCached
          ? 'Maç verisi şu anda yenilenemedi. Son kayıtlı bilgiler gösteriliyor.'
          : 'Beklenmeyen bir hata oluştu. Tekrar dene veya biraz sonra gel.'
      );
    } finally {
      if (generation === requestGenerationRef.current) {
        inFlightRef.current = false;
        setLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void loadMatchData();
    const refreshOnResume = () => {
      if (document.visibilityState === 'hidden') return;
      if (lastAttemptRef.current !== null && Date.now() - lastAttemptRef.current < 30_000) return;
      void loadMatchData();
    };
    document.addEventListener('visibilitychange', refreshOnResume);
    window.addEventListener('pageshow', refreshOnResume);
    window.addEventListener('online', refreshOnResume);
    return () => {
      requestGenerationRef.current += 1;
      inFlightRef.current = false;
      document.removeEventListener('visibilitychange', refreshOnResume);
      window.removeEventListener('pageshow', refreshOnResume);
      window.removeEventListener('online', refreshOnResume);
    };
  }, [enabled, loadMatchData]);

  return {
    cachedData,
    matchData,
    next3Matches,
    seasonState,
    season,
    loading,
    errorMessage,
    loadMatchData,
  };
}
