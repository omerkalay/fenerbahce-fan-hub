const APP_PATH = '/fenerbahce-fan-hub/';
const X_HOSTS = new Set(['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com']);
const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com']);

export interface NotificationTarget {
    url: string;
    external: boolean;
}

export const resolveNotificationTarget = (rawUrl: unknown, currentOrigin: string): NotificationTarget => {
    const fallback = new URL(APP_PATH, currentOrigin).toString();
    let url: URL;
    try {
        url = new URL(typeof rawUrl === 'string' ? rawUrl : fallback, currentOrigin);
    } catch {
        return { url: fallback, external: false };
    }
    if (url.protocol !== 'https:' && url.origin !== currentOrigin) return { url: fallback, external: false };
    if (url.username || url.password) return { url: fallback, external: false };

    const hostname = url.hostname.toLowerCase();
    const segments = url.pathname.split('/').filter(Boolean);
    if ((url.origin === currentOrigin || hostname === 'omerkalay.com') && url.pathname.startsWith(APP_PATH)) {
        return { url: url.toString(), external: false };
    }
    if (X_HOSTS.has(hostname)) {
        const officialProfile = segments[0]?.toLowerCase() === 'fenerbahce';
        const officialStatus = segments.length === 3
            && segments[1]?.toLowerCase() === 'status'
            && /^\d+$/.test(segments[2] || '');
        if (officialProfile && (segments.length === 1 || officialStatus)) {
            return { url: url.toString(), external: true };
        }
    }
    if (INSTAGRAM_HOSTS.has(hostname)) {
        const first = segments[0]?.toLowerCase();
        const trustedPath = (first === 'fenerbahce' && segments.length === 1)
            || (segments.length === 2 && new Set(['p', 'reel', 'tv']).has(first) && /^[A-Za-z0-9_-]+$/.test(segments[1] || ''));
        if (trustedPath) return { url: url.toString(), external: true };
    }
    return { url: fallback, external: false };
};
