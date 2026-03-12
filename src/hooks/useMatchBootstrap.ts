import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { fetchNextMatch, fetchNext3Matches } from '../services/api';
import type { MatchData, CachedMatchPayload } from '../types';

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

export function useMatchBootstrap() {
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

  useEffect(() => {
    hasDataRef.current = Boolean(matchData);
  }, [matchData]);

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

  const currentMatch = matchData;

  return {
    cachedData,
    matchData,
    next3Matches,
    lastUpdated,
    loading,
    isRefreshing,
    errorMessage,
    currentMatch,
    loadMatchData,
  };
}
