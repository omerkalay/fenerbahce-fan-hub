/** Default timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Wrapper around fetch that aborts if the request exceeds `timeoutMs`.
 * Existing AbortSignals passed via init.signal are respected and merged.
 */
export const fetchWithTimeout = (
    input: RequestInfo | URL,
    init?: RequestInit,
    timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // If caller already provides a signal, abort our controller when it fires
    if (init?.signal) {
        init.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    return fetch(input, { ...init, signal: controller.signal }).finally(() =>
        clearTimeout(timer)
    );
};
