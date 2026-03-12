/** Default timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Wrapper around fetch that aborts if the request exceeds `timeoutMs`.
 */
const fetchWithTimeout = (url, init, timeoutMs = DEFAULT_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, { ...init, signal: controller.signal }).finally(() =>
        clearTimeout(timer)
    );
};

module.exports = { fetchWithTimeout };
