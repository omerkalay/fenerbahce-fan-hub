import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/fetchWithTimeout', () => ({ fetchWithTimeout: vi.fn() }));

import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import {
    clearSessionRequest,
    fetchWithSingleRetry,
    getEspnFallbackUrl,
    getEspnPreferredUrl,
    runSessionRequest,
    settleWithConcurrency
} from './request-policy';

const mockedFetchWithTimeout = vi.mocked(fetchWithTimeout);

describe('ESPN request policy', () => {
    beforeEach(() => {
        mockedFetchWithTimeout.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('retries one browser-level failure and returns the second response', async () => {
        vi.useFakeTimers();
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const response = { ok: true, status: 200 } as Response;
        mockedFetchWithTimeout
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce(response);

        const request = fetchWithSingleRetry('https://site.api.espn.com/test', 10);
        await vi.runAllTimersAsync();

        await expect(request).resolves.toBe(response);
        expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(2);
        expect(mockedFetchWithTimeout).toHaveBeenNthCalledWith(1, 'https://site.web.api.espn.com/test');
        expect(mockedFetchWithTimeout).toHaveBeenNthCalledWith(2, 'https://site.api.espn.com/test');
    });

    it('only rewrites the exact official ESPN hostnames', () => {
        expect(getEspnPreferredUrl('https://site.api.espn.com/apis/v2/test?season=2026'))
            .toBe('https://site.web.api.espn.com/apis/v2/test?season=2026');
        expect(getEspnFallbackUrl('https://site.web.api.espn.com/apis/v2/test?season=2026'))
            .toBe('https://site.api.espn.com/apis/v2/test?season=2026');
        expect(getEspnPreferredUrl('https://example.com/site.api.espn.com/test'))
            .toBe('https://example.com/site.api.espn.com/test');
    });

    it('limits concurrent requests without changing result order', async () => {
        let active = 0;
        let peak = 0;
        const results = await settleWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
            active += 1;
            peak = Math.max(peak, active);
            await new Promise((resolve) => globalThis.setTimeout(resolve, 2));
            active -= 1;
            return value * 2;
        });

        expect(peak).toBe(2);
        expect(results).toEqual([
            { status: 'fulfilled', value: 2 },
            { status: 'fulfilled', value: 4 },
            { status: 'fulfilled', value: 6 },
            { status: 'fulfilled', value: 8 },
            { status: 'fulfilled', value: 10 }
        ]);
    });

    it('deduplicates a session request unless a forced refresh is requested', async () => {
        const key = 'request-policy-test';
        clearSessionRequest(key);
        const loader = vi.fn(async () => loader.mock.calls.length);

        const first = runSessionRequest(key, loader);
        const duplicate = runSessionRequest(key, loader);
        expect(first).toBe(duplicate);
        await expect(first).resolves.toBe(1);

        await expect(runSessionRequest(key, loader, true)).resolves.toBe(2);
        expect(loader).toHaveBeenCalledTimes(2);
        clearSessionRequest(key);
    });

    it('retries after a rejected session request instead of replaying the failure', async () => {
        const key = 'request-policy-rejection';
        clearSessionRequest(key);
        const loader = vi.fn()
            .mockRejectedValueOnce(new Error('provider down'))
            .mockResolvedValueOnce('recovered');

        await expect(runSessionRequest(key, loader)).rejects.toThrow('provider down');
        await expect(runSessionRequest(key, loader)).resolves.toBe('recovered');
        expect(loader).toHaveBeenCalledTimes(2);
        clearSessionRequest(key);
    });

    it('retries after an unusable result while still deduplicating usable results', async () => {
        const key = 'request-policy-empty-result';
        clearSessionRequest(key);
        const loader = vi.fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValue({ rows: 18 });
        const shouldCache = (value: unknown) => value !== null;

        await expect(runSessionRequest(key, loader, false, shouldCache)).resolves.toBeNull();
        await expect(runSessionRequest(key, loader, false, shouldCache)).resolves.toEqual({ rows: 18 });
        await expect(runSessionRequest(key, loader, false, shouldCache)).resolves.toEqual({ rows: 18 });
        expect(loader).toHaveBeenCalledTimes(2);
        clearSessionRequest(key);
    });
});
