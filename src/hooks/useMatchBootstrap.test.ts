// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
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
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
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

    await waitFor(() => expect(result.current.errorMessage).toContain('Son kayıtlı bilgiler'));
    expect(result.current.matchData).toEqual(cachedMatch);
    expect(result.current.next3Matches).toEqual([cachedMatch]);
  });

  it('keeps locally cached match data when the request throws', async () => {
    localStorage.setItem('fb_last_match', JSON.stringify(cachedPayload));
    mockedFetchMatchStatus.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useMatchBootstrap());

    await waitFor(() => expect(result.current.errorMessage).toContain('Son kayıtlı bilgiler'));
    expect(result.current.matchData).toEqual(cachedMatch);
    expect(result.current.next3Matches).toEqual([cachedMatch]);
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

  it('refreshes on resume and deduplicates a burst of resume and reconnect events', async () => {
    let now = 1_900_000_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const status = { nextMatch: cachedMatch, next3Matches: [], seasonState: 'active' as const, season: null, lastUpdate: 1 };
    mockedFetchMatchStatus.mockResolvedValueOnce(status);
    const { result } = renderHook(() => useMatchBootstrap());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const nextMatch = { ...cachedMatch, id: 20 };
    let resolve!: (value: typeof status) => void;
    mockedFetchMatchStatus.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    now += 60_000;
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('pageshow'));
      window.dispatchEvent(new Event('online'));
    });
    expect(mockedFetchMatchStatus).toHaveBeenCalledTimes(2);
    await act(async () => { resolve({ ...status, nextMatch }); });
    expect(result.current.matchData?.id).toBe(20);
  });

  it('does not turn a successful response into an error when local storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    mockedFetchMatchStatus.mockResolvedValue({ nextMatch: cachedMatch, next3Matches: [], seasonState: 'active', season: null, lastUpdate: 1 });
    const { result } = renderHook(() => useMatchBootstrap());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.matchData).toEqual(cachedMatch);
    expect(result.current.errorMessage).toBeNull();
  });
});
