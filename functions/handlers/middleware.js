const { admin } = require('../config');

const getBearerToken = (req) => {
    const authHeader = req.headers.authorization;
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.slice(7).trim();
    return token || null;
};

async function requireAuthenticatedUid(req, res) {
    const idToken = getBearerToken(req);
    if (!idToken) {
        res.status(401).json({ error: 'Missing bearer token' });
        return null;
    }

    try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        return decoded.uid;
    } catch (error) {
        console.error('Auth verification failed:', error);
        res.status(401).json({ error: 'Invalid auth token' });
        return null;
    }
}

const RATE_LIMIT_CONFIGS = {
    default: { windowMs: 60 * 1000, max: 120 },
    expensive: { windowMs: 60 * 1000, max: 20 },
    asset: { windowMs: 60 * 1000, max: 90 },
    write: { windowMs: 15 * 60 * 1000, max: 25 },
    health: { windowMs: 60 * 1000, max: 10 }
};
const rateLimitBuckets = new Map();
let nextRateLimitSweepAt = 0;

const getClientAddress = (req) => {
    const forwardedFor = req.headers['x-forwarded-for'];
    const forwarded = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : String(forwardedFor || '').split(',')[0].trim();

    return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
};

const shouldBypassRateLimit = (req, clientAddress) => {
    const host = String(req.headers.host || '').toLowerCase();
    return host.includes('localhost') ||
        host.includes('127.0.0.1') ||
        ['::1', '127.0.0.1', '::ffff:127.0.0.1'].includes(clientAddress);
};

const sweepRateLimitBuckets = (now) => {
    if (now < nextRateLimitSweepAt) {
        return;
    }

    for (const [key, bucket] of rateLimitBuckets.entries()) {
        if (bucket.resetAt <= now) {
            rateLimitBuckets.delete(key);
        }
    }

    nextRateLimitSweepAt = now + 60 * 1000;
};

const enforceRateLimit = (req, res, profile = 'default') => {
    if (req.method === 'OPTIONS') {
        return true;
    }

    const config = RATE_LIMIT_CONFIGS[profile] || RATE_LIMIT_CONFIGS.default;
    const now = Date.now();
    const clientAddress = getClientAddress(req);

    if (shouldBypassRateLimit(req, clientAddress)) {
        return true;
    }

    sweepRateLimitBuckets(now);

    const bucketKey = `${profile}:${clientAddress}`;
    let bucket = rateLimitBuckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) {
        bucket = {
            count: 0,
            resetAt: now + config.windowMs
        };
    }

    bucket.count += 1;
    rateLimitBuckets.set(bucketKey, bucket);

    const remaining = Math.max(config.max - bucket.count, 0);
    res.set('X-RateLimit-Limit', String(config.max));
    res.set('X-RateLimit-Remaining', String(remaining));
    res.set('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > config.max) {
        res.set('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
        res.status(429).json({ error: 'Too many requests. Please try again later.' });
        return false;
    }

    return true;
};

const resolveRateLimitProfile = (endpoint, method) => {
    if (endpoint === 'match-summary' || endpoint === 'matchSummary') {
        return 'expensive';
    }

    if (
        endpoint === 'player-image' ||
        endpoint === 'playerImage' ||
        endpoint === 'team-image' ||
        endpoint === 'teamImage'
    ) {
        return 'asset';
    }

    if (endpoint === 'health') {
        return 'health';
    }

    if (
        method === 'POST' && (
            endpoint === 'reminder' ||
            endpoint === 'poll-vote' ||
            endpoint === 'pollVote'
        )
    ) {
        return 'write';
    }

    return 'default';
};

const getRequestOrigin = (req) => {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = Array.isArray(forwardedProto)
        ? forwardedProto[0]
        : String(forwardedProto || req.protocol || 'https').split(',')[0].trim();
    const forwardedHost = req.headers['x-forwarded-host'];
    const host = Array.isArray(forwardedHost)
        ? forwardedHost[0]
        : String(forwardedHost || req.headers.host || '').split(',')[0].trim();

    return host ? `${protocol}://${host}`.replace(/\/+$/g, '') : '';
};

const buildApiBaseUrl = (req) => {
    const origin = getRequestOrigin(req);
    return origin ? `${origin}/api` : 'https://us-central1-fb-hub-ed9de.cloudfunctions.net/api';
};

module.exports = { getBearerToken, requireAuthenticatedUid, enforceRateLimit, resolveRateLimitProfile, buildApiBaseUrl };
