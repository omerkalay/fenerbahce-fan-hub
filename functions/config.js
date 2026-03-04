const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

// Define secrets (stored in Google Secret Manager)
const rapidApiKey = defineSecret("RAPIDAPI_KEY");
const rapidApiHost = defineSecret("RAPIDAPI_HOST");

// Initialize Firebase Admin
try {
    admin.initializeApp();
    console.log('✅ Firebase Admin initialized');
} catch (e) {
    console.error('❌ Firebase Admin initialization failed:', e);
}

const db = admin.database();

// Constants
const FENERBAHCE_ID = 3052;
const SOFASCORE_IMAGE_BASE = 'http://img.sofascore.com/api/v1';  // HTTP, not HTTPS!
const IMAGE_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
const DEFAULT_API_HOST = 'sofascore.p.rapidapi.com';
const ISTANBUL_TIMEZONE = 'Europe/Istanbul';
const ESPN_LEAGUES = ['tur.1', 'uefa.europa'];
const SUMMARY_STAT_GROUPS = [
    { label: 'Toplam Şut', keys: ['totalShots'] },
    { label: 'İsabetli Şut', keys: ['shotsOnTarget'] },
    { label: 'Topla Oynama %', keys: ['possessionPct', 'possession'] },
    { label: 'Korner', keys: ['wonCorners', 'corners'] },
    { label: 'Faul', keys: ['foulsCommitted', 'fouls'] },
    { label: 'Sarı Kart', keys: ['yellowCards', 'yellowCard'] },
    { label: 'Kırmızı Kart', keys: ['redCards', 'redCard'] }
];

// CORS configuration
const corsOptions = {
    cors: [
        'https://omerkalay.com',
        'https://www.omerkalay.com',
        'https://omerkalay.github.io',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000'
    ]
};

// Helper to get API host (must be called inside function context)
const getApiHost = () => rapidApiHost.value() || DEFAULT_API_HOST;

// Helper to get headers (must be called inside function context)
const getSofascoreHeaders = () => ({
    'x-rapidapi-key': rapidApiKey.value(),
    'x-rapidapi-host': getApiHost()
});

// Helper: Sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Stable date key for per-day notification dedupe in Istanbul timezone.
const formatDateKey = (timestamp, timeZone = ISTANBUL_TIMEZONE) => (
    new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date(timestamp))
);

module.exports = {
    admin,
    db,
    rapidApiKey,
    rapidApiHost,
    FENERBAHCE_ID,
    SOFASCORE_IMAGE_BASE,
    IMAGE_USER_AGENT,
    ISTANBUL_TIMEZONE,
    ESPN_LEAGUES,
    SUMMARY_STAT_GROUPS,
    corsOptions,
    getApiHost,
    getSofascoreHeaders,
    sleep,
    formatDateKey
};
