// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFixtureData } from './useFixtureData';
import { fetchFenerbahceFixtures, fetchMatchSummary } from '../services/api';
import type { FixtureMatch, MatchSummaryData } from '../types';

vi.mock('../services/api', () => ({ fetchFenerbahceFixtures: vi.fn(), fetchMatchSummary: vi.fn() }));
vi.mock('../contexts/dataSourceContextDef', () => ({ useDataSource: () => ({ modes: { fixtures: 'espn' } }) }));
vi.mock('../services/api/data-source', () => ({ readCachedFixtures: vi.fn() }));

const fixture = (id: string) => ({ id, summaryAvailable: true }) as FixtureMatch;
const summary = (name: string): MatchSummaryData => ({ homeTeam: { name, score: '1' }, events: [], stats: [] });
const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => { resolve = done; });
    return { promise, resolve };
};

describe('useFixtureData summary requests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchFenerbahceFixtures).mockResolvedValue({
            source: 'espn', seasonStartYear: 2026, season: null, team: null, matches: [],
        });
    });
    afterEach(cleanup);

    it.each([summary('A'), null])('ignores obsolete success or failure after opening another match', async (oldResult) => {
        const first = deferred<MatchSummaryData | null>();
        const second = deferred<MatchSummaryData | null>();
        vi.mocked(fetchMatchSummary).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const { result } = renderHook(() => useFixtureData());
        await act(async () => {});
        act(() => { void result.current.openSummaryModal(fixture('A')); });
        act(() => { result.current.closeSummaryModal(); });
        act(() => { void result.current.openSummaryModal(fixture('B')); });
        await act(async () => { second.resolve(summary('B')); });
        await act(async () => { first.resolve(oldResult); });
        expect(result.current.activeSummaryMatch?.id).toBe('B');
        expect(result.current.activeSummaryData?.homeTeam?.name).toBe('B');
        expect(result.current.summaryError).toBeNull();
        expect(result.current.summaryLoading).toBe(false);
    });

    it('does not complete the new loading state when an older response arrives first', async () => {
        const first = deferred<MatchSummaryData | null>();
        const second = deferred<MatchSummaryData | null>();
        vi.mocked(fetchMatchSummary).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const { result } = renderHook(() => useFixtureData());
        await act(async () => {});
        act(() => { void result.current.openSummaryModal(fixture('A')); });
        act(() => { void result.current.openSummaryModal(fixture('B')); });
        await act(async () => { first.resolve(summary('A')); });
        expect(result.current.summaryLoading).toBe(true);
        expect(result.current.activeSummaryData).toBeNull();
        act(() => { result.current.closeSummaryModal(); });
        await act(async () => { second.resolve(summary('B')); });
        expect(result.current.activeSummaryMatch).toBeNull();
        expect(result.current.activeSummaryData).toBeNull();
    });
});
