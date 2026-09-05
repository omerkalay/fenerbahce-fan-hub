// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveMatchState } from './useLiveMatchState';
import type { LiveMatchData, MatchData } from '../types';

vi.mock('../services/api', () => ({ BACKEND_URL: 'https://test.example/api' }));

const match: MatchData = {
  id: 1, startTimestamp: 1_800_000_000,
  homeTeam: { id: 3052, name: 'Fenerbahçe' }, awayTeam: { id: 2, name: 'Lyon' },
  tournament: { name: 'UEFA' },
};
const live: LiveMatchData = {
  matchId: 'provider-1', startTimestamp: match.startTimestamp, matchState: 'in',
  homeTeam: { name: 'Fenerbahçe', score: '2' }, awayTeam: { name: 'Lyon', score: '1' },
};
const response = (data: LiveMatchData) => ({ ok: true, json: async () => data }) as Response;
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
const fetchMock = vi.fn<typeof fetch>();

describe('useLiveMatchState request lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime((match.startTimestamp + 60) * 1000);
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('serializes requests, retains the score on failure, and clears the warning on recovery', async () => {
    fetchMock.mockResolvedValueOnce(response(live));
    const { result } = renderHook(() => useLiveMatchState(null, match));
    await act(async () => {});
    expect(result.current.liveMatchData).toEqual(live);

    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    act(() => {
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('pageshow'));
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => { pending.resolve({ ok: false, status: 503 } as Response); });
    expect(result.current.liveMatchData).toEqual(live);
    expect(result.current.liveMatchError).toContain('Son alınan bilgiler');

    fetchMock.mockResolvedValueOnce(response(live));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(result.current.liveMatchError).toBeNull();
  });

  it('aborts a hanging request after fifteen seconds and retries', async () => {
    let signal!: AbortSignal;
    fetchMock.mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
      signal = init!.signal!;
      signal.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')));
    }));
    const { result } = renderHook(() => useLiveMatchState(null, match));
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(signal.aborted).toBe(true);
    expect(result.current.liveMatchError).toContain('Yeniden deneniyor');
    fetchMock.mockResolvedValueOnce(response(live));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(result.current.liveMatchState).toBe('in');
  });

  it('ignores a late response after the scheduled fixture changes', async () => {
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    const { result, rerender } = renderHook(({ current }) => useLiveMatchState(null, current), {
      initialProps: { current: match },
    });
    const previousSignal = fetchMock.mock.calls[0][1]!.signal!;
    const future = { ...match, id: 3, startTimestamp: match.startTimestamp + 86400 };
    rerender({ current: future });
    expect(previousSignal.aborted).toBe(true);
    await act(async () => { pending.resolve(response(live)); });
    expect(result.current.liveMatchData).toBeNull();
    expect(result.current.liveMatchState).toBe('countdown');
  });

  it.each(['post', 'unsupported'] as const)('stops polling for %s but resets for a new fixture', async (state) => {
    fetchMock.mockResolvedValue(response({ ...live, matchState: state }));
    const { result, rerender } = renderHook(({ current }) => useLiveMatchState(null, current), {
      initialProps: { current: match },
    });
    await act(async () => {});
    rerender({ current: { ...match } });
    await act(async () => {
      window.dispatchEvent(new Event('pageshow'));
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.current.liveMatchState).toBe(state);
    rerender({ current: { ...match, id: 2, startTimestamp: match.startTimestamp + 86400 } });
    expect(result.current.liveMatchState).toBe('countdown');
    expect(result.current.liveMatchData).toBeNull();
  });

  it('pauses while hidden and fetches immediately on resume', async () => {
    fetchMock.mockResolvedValue(response(live));
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    renderHook(() => useLiveMatchState(null, match));
    await act(async () => {});
    visibility.mockReturnValue('hidden');
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(fetchMock).toHaveBeenCalledOnce();
    visibility.mockReturnValue('visible');
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('starts polling when the countdown ends and rejects another fixture payload', async () => {
    const future = { ...match, startTimestamp: match.startTimestamp + 3600 };
    fetchMock.mockResolvedValue(response({ ...live, awayTeam: { name: 'Konyaspor' } }));
    const { result } = renderHook(() => useLiveMatchState(null, future));
    expect(fetchMock).not.toHaveBeenCalled();
    vi.setSystemTime(future.startTimestamp * 1000);
    await act(async () => { result.current.onCountdownEnd(); });
    expect(result.current.liveMatchState).toBe('checking');
    expect(result.current.liveMatchData).toBeNull();
  });

  it('does not start requests in simulation safe mode', () => {
    const { result } = renderHook(() => useLiveMatchState(null, match, { enabled: false }));
    act(() => { result.current.onCountdownEnd(); });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.liveMatchState).toBe('idle');
  });
});
