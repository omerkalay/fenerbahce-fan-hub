import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

const sessionRequests = new Map<string, Promise<unknown>>();

const evictOwnEntry = (key: string, request: Promise<unknown>): void => {
    if (sessionRequests.get(key) === request) sessionRequests.delete(key);
};
const ESPN_PREFERRED_HOST = 'site.web.api.espn.com';
const ESPN_LEGACY_HOST = 'site.api.espn.com';

const wait = (ms: number) => new Promise((resolve) => globalThis.setTimeout(resolve, ms));

const replaceEspnHostname = (url: string, from: string, to: string): string => {
    try {
        const parsed = new URL(url);
        if (parsed.hostname !== from) return url;
        parsed.hostname = to;
        return parsed.toString();
    } catch {
        return url;
    }
};

export const getEspnPreferredUrl = (url: string): string => (
    replaceEspnHostname(url, ESPN_LEGACY_HOST, ESPN_PREFERRED_HOST)
);

export const getEspnFallbackUrl = (url: string): string => (
    replaceEspnHostname(url, ESPN_PREFERRED_HOST, ESPN_LEGACY_HOST)
);

export const fetchWithSingleRetry = async (
    url: string,
    retryDelayMs = 350
): Promise<Response> => {
    let firstResponse: Response | null = null;
    const preferredUrl = getEspnPreferredUrl(url);

    try {
        firstResponse = await fetchWithTimeout(preferredUrl);
        if (firstResponse.ok || (firstResponse.status < 500 && firstResponse.status !== 429)) {
            return firstResponse;
        }
    } catch {
        // A browser-level network/CORS failure is retried once below.
    }

    await wait(retryDelayMs + Math.floor(Math.random() * 200));
    return fetchWithTimeout(getEspnFallbackUrl(preferredUrl));
};

export const settleWithConcurrency = async <T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> => {
    const results: PromiseSettledResult<R>[] = new Array(items.length);
    let cursor = 0;

    const runWorker = async () => {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            try {
                results[index] = { status: 'fulfilled', value: await worker(items[index], index) };
            } catch (reason) {
                results[index] = { status: 'rejected', reason };
            }
        }
    };

    const workerCount = Math.max(1, Math.min(Math.floor(concurrency), items.length));
    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
    return results;
};

export const runSessionRequest = <T>(
    key: string,
    loader: () => Promise<T>,
    force = false,
    shouldCache: (value: T) => boolean = () => true
): Promise<T> => {
    if (!force) {
        const existing = sessionRequests.get(key);
        if (existing) return existing as Promise<T>;
    }

    // A failed attempt must not outlive itself. Loaders report provider failure as a
    // resolved empty value or a rejection, so without this eviction one transient ESPN
    // error would keep serving the same failure for the rest of the browser session.
    const request: Promise<T> = loader().then(
        (value) => {
            if (!shouldCache(value)) evictOwnEntry(key, request);
            return value;
        },
        (error) => {
            evictOwnEntry(key, request);
            throw error;
        }
    );
    sessionRequests.set(key, request);
    return request;
};

export const clearSessionRequest = (key: string): void => {
    sessionRequests.delete(key);
};
