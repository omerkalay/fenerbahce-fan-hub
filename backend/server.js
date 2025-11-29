const express = require('express');
const cron = require('node-cron');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// CORS Configuration - Only allow specific origins
const allowedOrigins = [
    'https://omerkalay.com',
    'https://www.omerkalay.com',
    'https://omerkalay.github.io',
    'http://localhost:5173', // Dev mode
    'http://localhost:5174', // Dev mode (alternate port)
    'http://localhost:3000'  // Dev mode
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// Rate Limiting - Prevent DDOS attacks
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for localhost in development
        const ip = req.ip || req.connection.remoteAddress;
        return ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
    }
});

// Stricter rate limit for POST endpoints (like /api/reminder)
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 POST requests per windowMs
    message: 'Too many POST requests, please slow down.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for localhost in development
        const ip = req.ip || req.connection.remoteAddress;
        return ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
    }
});

// Apply rate limiting to all requests
app.use(limiter);

app.use(express.json({ limit: '10mb' })); // Limit JSON payload size

// Cache for API data
let cache = {
    nextMatch: null,
    next3Matches: [],
    squad: [],
    standings: [],
    lastUpdate: null
};

// Notification system storage (in-memory)
// Time-based reminders: per match, per player
let matchReminders = [];
// Format: { playerId, matchId, options, createdAt, sentNotifications, scheduledNotifications }

// Daily check subscribers: not tied to a specific match
let dailyCheckSubscribers = new Set();
// Format: Set(['playerId1', 'playerId2', ...])

// Track sent daily notifications to prevent duplicates
let sentDailyNotifications = new Map();
// Format: Map(playerId => { matchId, date })


const MATCH_NOTIFICATION_CONFIG = {
    threeHours: {
        offsetMs: 3 * 60 * 60 * 1000,
        timeText: '3 saat kaldı',
        badge: '⏳ 3 Saat'
    },
    oneHour: {
        offsetMs: 1 * 60 * 60 * 1000,
        timeText: '1 saat kaldı',
        badge: '⌛️ 1 Saat'
    },
    thirtyMinutes: {
        offsetMs: 30 * 60 * 1000,
        timeText: '30 dakika kaldı',
        badge: '🕒 30dk'
    },
    fifteenMinutes: {
        offsetMs: 15 * 60 * 1000,
        timeText: '15 dakika kaldı',
        badge: '⚡️ 15dk'
    }
};

const FENERBAHCE_ID = 3052;
const API_KEY = process.env.RAPIDAPI_KEY;
const API_HOST = process.env.RAPIDAPI_HOST || 'sofascore.p.rapidapi.com';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3001';
const SOFASCORE_IMAGE_BASE_HTTP = 'http://img.sofascore.com/api/v1';
const IMAGE_USER_AGENT = process.env.IMAGE_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 6 * * *';
const ENABLE_CRON = process.env.DISABLE_CRON !== 'true';

const headers = {
    'x-rapidapi-key': API_KEY,
    'x-rapidapi-host': API_HOST
};

const sanitizeBaseUrl = (url = '') => {
    if (!url) return '';
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
        return url.replace(/\/$/, '');
    }
    return url.replace(/^http:\/\//i, 'https://').replace(/\/$/, '');
};

const getAbsoluteBaseUrl = (req = null) => {
    const normalizedEnvUrl = sanitizeBaseUrl(PUBLIC_BASE_URL);
    if (normalizedEnvUrl) {
        return normalizedEnvUrl;
    }
    if (!req) {
        return '';
    }
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    return `${protocol}://${req.get('host')}`.replace(/\/$/, '');
};

// Helper to delay execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch data from SofaScore API
async function fetchDataFromAPI() {
    console.log('🔄 Fetching data from SofaScore API...');

    try {
        // Fetch next match
        const matchResponse = await fetch(`https://${API_HOST}/teams/get-next-matches?teamId=${FENERBAHCE_ID}`, { headers });
        const matchData = await matchResponse.json();

        if (matchData.events && matchData.events.length > 0) {
            cache.nextMatch = matchData.events[0];
            cache.next3Matches = matchData.events.slice(0, 3);
            console.log('✅ Next matches fetched successfully');
        }

        // Wait 2 seconds to avoid rate limit
        await sleep(2000);

        // Fetch squad
        const squadResponse = await fetch(`https://${API_HOST}/teams/get-squad?teamId=${FENERBAHCE_ID}`, { headers });
        const squadData = await squadResponse.json();

        if (squadData.players) {
            cache.squad = squadData.players.map(item => ({
                id: item.player.id,
                name: item.player.name,
                position: item.player.position,
                number: item.player.jerseyNumber,
                photoPath: `/api/player-image/${item.player.id}`,
                country: item.player.country?.name,
                marketValue: item.player.proposedMarketValue,
                status: null
            }));
            console.log('✅ Squad fetched successfully');
        }

        // Wait 2 seconds before fetching standings
        await sleep(2000);

        // Fetch Standings
        // await fetchStandings(); // Disabled: API requires paid subscription for standings
        cache.standings = []; // Reset standings to empty

        cache.lastUpdate = new Date();
        console.log(`✨ Cache updated at ${cache.lastUpdate.toISOString()}`);
    } catch (error) {
        console.error('❌ Error fetching data:', error.message);
    }
}

async function fetchStandings() {
    console.log('🔄 Fetching standings...');
    try {
        const standingsData = [];

        // 1. Süper Lig (Always fetch)
        let superLigSeasonId = 77805; // Default fallback
        let superLigTournamentId = 52;

        // Try to find Super Lig season ID from next matches if available
        if (cache.next3Matches && cache.next3Matches.length > 0) {
            const slMatch = cache.next3Matches.find(m => m.tournament?.uniqueTournament?.id === 52);
            if (slMatch && slMatch.season) {
                superLigSeasonId = slMatch.season.id;
                console.log(`Using Super Lig Season ID from match: ${superLigSeasonId}`);
            }
        } else {
            console.log(`Using default Super Lig Season ID: ${superLigSeasonId}`);
        }

        const slUrl = `https://${API_HOST}/tournaments/get-standings?seasonId=${superLigSeasonId}&tournamentId=${superLigTournamentId}`;
        console.log(`Fetching: ${slUrl}`);

        const slResponse = await fetch(slUrl, { headers });

        if (!slResponse.ok) {
            console.error(`❌ Super Lig standings failed: ${slResponse.status}`);
            const errorText = await slResponse.text();
            console.error('Error response:', errorText);
        } else {
            const slData = await slResponse.json();
            console.log('Super Lig response keys:', Object.keys(slData));

            if (slData.standings && slData.standings.length > 0) {
                const totalTable = slData.standings.find(t => t.type === 'total') || slData.standings[0];
                standingsData.push({
                    id: 'super-lig',
                    name: 'Süper Lig',
                    rows: totalTable.rows
                });
                console.log(`✅ Süper Lig standings fetched (${totalTable.rows.length} teams)`);
            } else {
                console.warn('⚠️ No standings data in response');
            }
        }

        // 2. Check for other active tournaments
        if (cache.nextMatch && cache.nextMatch.tournament?.uniqueTournament?.id !== 52) {
            const otherTournId = cache.nextMatch.tournament.uniqueTournament.id;
            const otherSeasonId = cache.nextMatch.season.id;
            const otherTournName = cache.nextMatch.tournament.name;

            console.log(`Fetching standings for ${otherTournName} (ID: ${otherTournId}, Season: ${otherSeasonId})`);

            const otherUrl = `https://${API_HOST}/tournaments/get-standings?seasonId=${otherSeasonId}&tournamentId=${otherTournId}`;
            const otherResponse = await fetch(otherUrl, { headers });

            if (otherResponse.ok) {
                const otherData = await otherResponse.json();
                if (otherData.standings && otherData.standings.length > 0) {
                    const totalTable = otherData.standings.find(t => t.type === 'total') || otherData.standings[0];
                    standingsData.push({
                        id: `tourn-${otherTournId}`,
                        name: otherTournName,
                        rows: totalTable.rows
                    });
                    console.log(`✅ ${otherTournName} standings fetched (${totalTable.rows.length} teams)`);
                }
            } else {
                console.warn(`⚠️ Failed to fetch ${otherTournName} standings: ${otherResponse.status}`);
            }
        }

        cache.standings = standingsData;
        console.log(`✨ Standings cache updated with ${standingsData.length} league(s)`);

    } catch (error) {
        console.error('❌ Error fetching standings:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Cron job: Fetch data every day at 03:00 UTC (06:00 TR)
if (ENABLE_CRON) {
    try {
        // Use hardcoded schedule to avoid timezone issues
        const schedule = '0 3 * * *'; // 03:00 UTC = 06:00 TR
        cron.schedule(schedule, () => {
            console.log('⏰ Scheduled fetch triggered (03:00 UTC = 06:00 TR)');
            fetchDataFromAPI();
        }, {
            timezone: "UTC"
        });
        console.log(`✅ Data fetch cron scheduled: ${schedule} (03:00 UTC = 06:00 TR)`);
    } catch (error) {
        console.error('❌ Cron schedule error:', error.message);
    }
} else {
    console.log('⚠️ Cron disabled via DISABLE_CRON env');
}

// Notification cron removed - Migrated to Firebase Cloud Functions
// See functions/index.js for the new logic

// Function to check and send notifications (reads from Firebase)
// checkAndSendNotifications function removed - Migrated to Firebase Cloud Functions

// Daily check for matches (Günlük Maç Kontrolü) - 06:00 UTC = 09:00 TR
if (ENABLE_CRON) {
    try {
        cron.schedule('0 6 * * *', () => {
            console.log('⏰ Daily match check triggered (06:00 UTC = 09:00 TR)');

            if (!cache.nextMatch || dailyCheckSubscribers.size === 0) {
                console.log('ℹ️ No daily check subscribers or no upcoming match');
                return;
            }

            const matchTime = new Date(cache.nextMatch.startTimestamp * 1000);
            const today = new Date();
            const todayStr = today.toDateString();

            // Check if match is TODAY
            if (matchTime.toDateString() === todayStr) {
                console.log(`🎯 Match today! Notifying ${dailyCheckSubscribers.size} subscribers`);

                dailyCheckSubscribers.forEach(playerId => {
                    // Check if already notified today for this match
                    const lastSent = sentDailyNotifications.get(playerId);
                    if (lastSent && lastSent.matchId === cache.nextMatch.id && lastSent.date === todayStr) {
                        console.log(`⏭️ Already notified ${playerId} today for match ${cache.nextMatch.id}`);
                        return;
                    }

                    // Send notification
                    sendNotification({
                        playerId,
                        matchData: cache.nextMatch,
                        type: 'dailyCheck',
                        timeText: 'Bugün maç günü'
                    });

                    // Record that we sent this notification
                    sentDailyNotifications.set(playerId, {
                        matchId: cache.nextMatch.id,
                        date: todayStr
                    });

                    console.log(`✅ Sent daily check to ${playerId} for match ${cache.nextMatch.id}`);
                });
            } else {
                console.log('ℹ️ No match today');
            }
        }, {
            timezone: "UTC"
        });
        console.log('✅ Daily match check cron scheduled: 06:00 UTC (09:00 TR)');
    } catch (error) {
        console.error('❌ Daily check cron error:', error.message);
    }
} else {
    console.log('⚠️ Daily check cron disabled via DISABLE_CRON env');
}

// Firebase Admin SDK
const admin = require('firebase-admin');

// Initialize Firebase Admin
let db = null;
try {
    // Read service account from environment variable (Render.com) or local file (development)
    let serviceAccount;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        console.log('📦 Loading Firebase credentials from environment variable');
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
        console.log('📦 Loading Firebase credentials from serviceAccountKey.json');
        serviceAccount = require('./serviceAccountKey.json');
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://fb-hub-ed9de-default-rtdb.europe-west1.firebasedatabase.app"
    });
    db = admin.database();
    console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
}

// Send notification function with Firebase Cloud Messaging
async function sendNotification({ playerId, matchData, type, timeText, sendAfter = null, externalId = null }) {
    const FENERBAHCE_ID = 3052;
    const isHome = matchData.homeTeam?.id === FENERBAHCE_ID;
    const opponent = isHome ? matchData.awayTeam?.name : matchData.homeTeam?.name;
    const matchTime = new Date(matchData.startTimestamp * 1000);
    const timeString = matchTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    // Format: "💛💙 Fenerbahçe - Rakip\n20:45 · 1 saat kaldı"
    const title = `💛💙 Fenerbahçe - ${opponent}`;
    const body = `${timeString} · ${timeText}`;

    // FCM Message
    const message = {
        token: playerId, // playerId is now the FCM token
        notification: {
            title: title,
            body: body
        },
        data: {
            matchId: String(matchData.id),
            type: type,
            tournament: matchData.tournament?.name || ''
        },
        webpush: {
            fcmOptions: {
                link: 'https://omerkalay.com/fenerbahce-fan-hub/'
            }
        }
    };

    try {
        if (!admin.apps.length) {
            console.log(`📢 [MOCK FCM] ${title} - ${body} (Token: ${playerId})`);
            return { id: `mock-${Date.now()}` };
        }

        // With Firebase Cloud Messaging, we send notifications immediately
        // The calling function `checkAndSendNotifications` handles the timing via cron
        // So we can just send immediately.

        const response = await admin.messaging().send(message);
        console.log(`✅ FCM Notification sent: ${response}`);
        return { id: response };
    } catch (error) {
        console.error('❌ FCM Notification error:', error);
        // throw error; // Don't throw to avoid crashing the loop
        return null;
    }
}

// Legacy scheduling function - kept for compatibility but simplified
async function scheduleMatchNotification(playerId, matchData, optionKey) {
    // With the cron-based approach in checkAndSendNotifications, we don't strictly need to "schedule" 
    // individual messages on the provider side anymore if we run the check every minute.
    // However, if we want to support "send at specific time" without running a minutely cron,
    // we would need a persistent job queue.

    // For this migration, we will rely on the `checkAndSendNotifications` cron job 
    // which checks every minute if it's time to send.

    return {
        notificationId: `scheduled-${Date.now()}`,
        sendAfter: new Date().toISOString(), // Placeholder
        optionKey,
        externalId: `${matchData.id}-${playerId}-${optionKey}`
    };
}

async function cancelScheduledNotification(notificationId) {
    // Not applicable for immediate sending via cron
    // If we used a DB for scheduled tasks, we would delete the row here.
    console.log(`ℹ️ Cancel notification request for ${notificationId} (handled by clearing local state)`);
}

async function cancelReminderSchedules(reminder) {
    // Just a placeholder as we manage state in memory/DB
    return;
}

// Manual refresh endpoint for testing
app.get('/api/refresh', async (req, res) => {
    await fetchDataFromAPI();
    res.json({ message: 'Data refreshed', lastUpdate: cache.lastUpdate });
});

// API Endpoints
app.get('/api/next-match', (req, res) => {
    res.json(cache.nextMatch);
});

app.get('/api/next-3-matches', (req, res) => {
    res.json(cache.next3Matches);
});

app.get('/api/squad', (req, res) => {
    const squad = cache.squad.map(player => {
        const { photoPath, ...rest } = player;
        const resolvedPath = photoPath || `/api/player-image/${player.id}`;
        const absolutePhoto = resolvedPath.startsWith('http')
            ? resolvedPath
            : `${PUBLIC_BASE_URL}${resolvedPath.startsWith('/') ? '' : '/'}${resolvedPath}`;

        return {
            ...rest,
            photo: absolutePhoto
        };
    });
    res.json(squad);
});

app.get('/api/standings', (req, res) => {
    res.json(cache.standings || []);
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        lastUpdate: cache.lastUpdate,
        cacheSize: {
            nextMatch: cache.nextMatch ? 'loaded' : 'empty',
            next3Matches: cache.next3Matches.length,
            squad: cache.squad.length
        },
        notifications: {
            matchReminders: matchReminders.length,
            dailyCheckSubscribers: dailyCheckSubscribers.size,
            sentDailyNotifications: sentDailyNotifications.size
        }
    });
});

// POST /api/reminder - Save user notification preferences to Firebase
app.post('/api/reminder', strictLimiter, async (req, res) => {
    const { playerId, matchId, options } = req.body;

    if (!playerId || !options) {
        return res.status(400).json({ error: 'Missing required fields: playerId, options' });
    }

    if (!db) {
        return res.status(500).json({ error: 'Firebase Database not initialized' });
    }

    try {
        const playerRef = db.ref(`notifications/${playerId}`);

        // Read current data
        const snapshot = await playerRef.once('value');
        const currentData = snapshot.val() || {};

        // Update dailyCheck
        if (options.dailyCheck) {
            currentData.dailyCheck = true;
            console.log(`✅ Enabled daily check for ${playerId}`);
        } else {
            currentData.dailyCheck = false;
            console.log(`➖ Disabled daily check for ${playerId}`);
        }

        // Update match-specific reminders
        if (matchId) {
            // Validate that matchId exists in cache
            const matchData = cache.next3Matches.find(m => m.id === matchId);
            if (!matchData) {
                return res.status(400).json({ error: 'Invalid matchId - match not found in cache' });
            }

            const hasTimeBasedOptions = options.threeHours || options.oneHour ||
                options.thirtyMinutes || options.fifteenMinutes;

            if (!currentData.matches) {
                currentData.matches = {};
            }

            if (hasTimeBasedOptions) {
                // Save this match's reminder options
                currentData.matches[matchId] = {
                    threeHours: options.threeHours || false,
                    oneHour: options.oneHour || false,
                    thirtyMinutes: options.thirtyMinutes || false,
                    fifteenMinutes: options.fifteenMinutes || false,
                    sentNotifications: currentData.matches?.[matchId]?.sentNotifications || [],
                    updatedAt: Date.now()
                };
                console.log(`✅ Saved match ${matchId} reminders for ${playerId}`);
            } else {
                // Remove this match's reminders if no options selected
                if (currentData.matches[matchId]) {
                    delete currentData.matches[matchId];
                    console.log(`🗑️ Removed match ${matchId} reminders for ${playerId}`);
                }
            }
        }

        // Write to Firebase
        await playerRef.set(currentData);

        const activeMatchCount = currentData.matches ? Object.keys(currentData.matches).length : 0;

        res.json({
            success: true,
            message: 'Notification preferences saved to Firebase',
            activeMatchReminders: activeMatchCount,
            dailyCheckActive: currentData.dailyCheck || false
        });

    } catch (error) {
        console.error('❌ Error saving to Firebase:', error);
        res.status(500).json({ error: 'Failed to save notification preferences' });
    }
});

// GET /api/reminder/:playerId - Get reminders for a player
app.get('/api/reminder/:playerId', (req, res) => {
    const { playerId } = req.params;
    const playerMatchReminders = matchReminders.filter(r => r.playerId === playerId);
    const hasDailyCheck = dailyCheckSubscribers.has(playerId);

    res.json({
        matchReminders: playerMatchReminders,
        dailyCheckActive: hasDailyCheck
    });
});

// DELETE /api/reminder/:playerId - Delete ALL reminders for a player
app.delete('/api/reminder/:playerId', async (req, res) => {
    const { playerId } = req.params;
    const initialLength = matchReminders.length;

    const remindersToDelete = matchReminders.filter(r => r.playerId === playerId);
    await Promise.allSettled(remindersToDelete.map(reminder => cancelReminderSchedules(reminder)));

    matchReminders = matchReminders.filter(r => r.playerId !== playerId);
    dailyCheckSubscribers.delete(playerId);
    sentDailyNotifications.delete(playerId);

    const deleted = initialLength - matchReminders.length;
    res.json({
        success: true,
        message: `Deleted ${deleted} match reminder(s) and daily check subscription`,
        deleted
    });
});

// DELETE /api/reminder/:playerId/:matchId - Delete a specific match reminder
app.delete('/api/reminder/:playerId/:matchId', async (req, res) => {
    const { playerId, matchId } = req.params;
    const initialLength = matchReminders.length;

    const targetReminder = matchReminders.find(r => r.playerId === playerId && r.matchId == matchId);

    if (!targetReminder) {
        return res.status(404).json({ error: 'Match reminder not found' });
    }

    await cancelReminderSchedules(targetReminder);

    matchReminders = matchReminders.filter(r => !(r.playerId === playerId && r.matchId == matchId));

    if (matchReminders.length < initialLength) {
        res.json({ success: true, message: 'Match reminder deleted' });
    } else {
        res.status(404).json({ error: 'Match reminder not found' });
    }
});

async function proxyImage(req, res, type = 'player') {
    try {
        const { id } = req.params;
        const imageUrl = `${SOFASCORE_IMAGE_BASE_HTTP}/${type}/${id}/image`;

        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': IMAGE_USER_AGENT,
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
            }
        });

        if (!response.ok) {
            console.warn(`Image proxy upstream error ${response.status} for ${imageUrl}`);
            return res.status(response.status).send('Image not found');
        }

        res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24h

        const buffer = Buffer.from(await response.arrayBuffer());
        res.send(buffer);
    } catch (error) {
        console.error('Error proxying image:', error.message);
        res.status(500).send('Error loading image');
    }
}

app.get('/api/player-image/:id', (req, res) => proxyImage(req, res, 'player'));
app.get('/api/team-image/:id', (req, res) => proxyImage(req, res, 'team'));

app.get('/', (req, res) => {
    res.json({
        message: 'Fenerbahçe Fan Hub API',
        version: '2.0.0',
        endpoints: [
            '/api/next-match (GET)',
            '/api/next-3-matches (GET)',
            '/api/squad (GET)',
            '/api/health (GET)',
            '/api/player-image/:playerId (GET)',
            '/api/team-image/:teamId (GET)',
            '/api/reminder (POST) - Save notification preferences',
            '/api/reminder/:playerId (GET) - Get user reminders',
            '/api/reminder/:playerId (DELETE) - Delete all reminders',
            '/api/reminder/:playerId/:matchId (DELETE) - Delete specific reminder'
        ],
        notificationSystem: {
            matchReminders: matchReminders.length,
            dailyCheckSubscribers: dailyCheckSubscribers.size
        }
    });
});

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Bind to all interfaces (required for Render.com)

app.listen(PORT, HOST, () => {
    console.log(`✅ Backend server running on ${HOST}:${PORT}`);
    console.log(`📍 Access via: http://localhost:${PORT}`);

    // Fetch initial data after server is ready (non-blocking)
    console.log('🔄 Starting initial data fetch...');
    fetchDataFromAPI().catch(err => {
        console.error('❌ Initial data fetch failed (will retry via cron):', err.message);
    });
});
