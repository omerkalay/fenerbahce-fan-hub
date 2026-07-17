// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { fetchMatchStatus } from '../services/api';
import { useMatchBootstrap } from './useMatchBootstrap';
import type { CachedMatchPayload, MatchData } from '../types';

vi.mock('../services/api', () => ({
  fetchMatchStatus: vi.fn()
}));

const mockedFetchMatchStatus = vi.mocked(fetchMatchStatus);

const cachedMatch: MatchData = {
  id: 10,
  startTimestamp: 1_900_000_000,
  homeTeam: { id: 3052, name: 'Fenerbahçe' },
  awayTeam: { id: 1, name: 'Rakip' },
  tournament: { name: 'Süper Lig' }
};

const cachedPayload: CachedMatchPayload = {
  nextMatch: cachedMatch,
  next3Matches: [cachedMatch],
  timestamp: 123,
  seasonState: 'active',
  season: { startYear: 2026, label: '2026/27' }
};

describe('useMatchBootstrap', () => {
  beforeEach(() => {
    localStorage.clear();
    mockedFetchMatchStatus.mockReset();
  });

  it('keeps locally cached match data when the backend refresh failed', async () => {
    localStorage.setItem('fb_last_match', JSON.stringify(cachedPayload));
    mockedFetchMatchStatus.mockResolvedValue({
      nextMatch: null,
      next3Matches: [],
      seasonState: 'unknown',
      season: { startYear: 2026, label: '2026/27' },
      matchFetchStatus: 'error',
      lastUpdate: 456
    });

    const { result } = renderHook(() => useMatchBootstrap());

    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(result.current.matchData).toEqual(cachedMatch);
    expect(result.current.next3Matches).toEqual([cachedMatch]);
    expect(result.current.errorMessage).toContain('Son kayıtlı bilgiler');
  });

  it('keeps locally cached match data when the request throws', async () => {
    localStorage.setItem('fb_last_match', JSON.stringify(cachedPayload));
    mockedFetchMatchStatus.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useMatchBootstrap());

    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(result.current.matchData).toEqual(cachedMatch);
    expect(result.current.next3Matches).toEqual([cachedMatch]);
    expect(result.current.errorMessage).toContain('Son kayıtlı bilgiler');
  });

  it('shows an error when neither backend nor local cache has match data', async () => {
    mockedFetchMatchStatus.mockResolvedValue({
      nextMatch: null,
      next3Matches: [],
      seasonState: 'unknown',
      season: { startYear: 2026, label: '2026/27' },
      matchFetchStatus: 'error',
      lastUpdate: 456
    });

    const { result } = renderHook(() => useMatchBootstrap());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.matchData).toBeNull();
    expect(result.current.errorMessage).toContain('biraz sonra tekrar dene');
  });
});
