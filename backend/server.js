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
    'http://localhost:3000'  // Dev mode
];

app.use(cors({
    origin: function(origin, callback) {
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
});

// Stricter rate limit for POST endpoints (like /api/reminder)
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 POST requests per windowMs
    message: 'Too many requests, please try again later.',
});

// Apply rate limiting to all requests
app.use(limiter);

app.use(express.json({ limit: '10mb' })); // Limit JSON payload size

// Cache for API data
let cache = {
    nextMatch: null,
    next3Matches: [],
    squad: [],
    lastUpdate: null
};

// Reminders storage (in-memory)
let reminders = [];
// Format: { playerId, options: {threeHours, oneHour, ...}, matchData, createdAt }

const FENERBAHCE_ID = 3052;
const API_KEY = process.env.RAPIDAPI_KEY;
const API_HOST = process.env.RAPIDAPI_HOST || 'sofascore.p.rapidapi.com';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
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

        cache.lastUpdate = new Date();
        console.log(`✨ Cache updated at ${cache.lastUpdate.toISOString()}`);
    } catch (error) {
        console.error('❌ Error fetching data:', error.message);
    }
}

// Cron job: Fetch data every day at configured time (default 03:00 UTC = 06:00 TR)
if (ENABLE_CRON && CRON_SCHEDULE) {
    try {
        cron.schedule(CRON_SCHEDULE, () => {
            console.log('⏰ Scheduled fetch triggered');
            fetchDataFromAPI();
        });
        console.log(`✅ Data fetch cron scheduled: ${CRON_SCHEDULE}`);
    } catch (error) {
        console.error('❌ Cron schedule error:', error.message);
    }
} else {
    console.log('⚠️ Cron disabled via DISABLE_CRON env or invalid CRON_SCHEDULE');
}

// Cron job: Check and send notifications every minute
cron.schedule('* * * * *', () => {
    checkAndSendNotifications();
}, {
    timezone: "Europe/Istanbul"
});
console.log('✅ Notification check cron scheduled: Every minute');

// Function to check and send notifications
function checkAndSendNotifications() {
    const now = new Date();
    
    reminders.forEach(reminder => {
        const { playerId, options, matchData, sentNotifications } = reminder;
        const matchTime = new Date(matchData.startTimestamp * 1000);
        const timeDiff = matchTime - now; // milliseconds until match
        
        // Calculate time differences
        const threeHoursInMs = 3 * 60 * 60 * 1000;
        const oneHourInMs = 1 * 60 * 60 * 1000;
        const thirtyMinInMs = 30 * 60 * 1000;
        const fifteenMinInMs = 15 * 60 * 1000;
        
        // Check each notification type
        if (options.threeHours && !sentNotifications.includes('threeHours')) {
            if (timeDiff <= threeHoursInMs && timeDiff > (threeHoursInMs - 60000)) {
                sendNotification(playerId, matchData, 'threeHours', '3 saat kaldı');
                sentNotifications.push('threeHours');
            }
        }
        
        if (options.oneHour && !sentNotifications.includes('oneHour')) {
            if (timeDiff <= oneHourInMs && timeDiff > (oneHourInMs - 60000)) {
                sendNotification(playerId, matchData, 'oneHour', '1 saat kaldı');
                sentNotifications.push('oneHour');
            }
        }
        
        if (options.thirtyMinutes && !sentNotifications.includes('thirtyMinutes')) {
            if (timeDiff <= thirtyMinInMs && timeDiff > (thirtyMinInMs - 60000)) {
                sendNotification(playerId, matchData, 'thirtyMinutes', '30 dakika kaldı');
                sentNotifications.push('thirtyMinutes');
            }
        }
        
        if (options.fifteenMinutes && !sentNotifications.includes('fifteenMinutes')) {
            if (timeDiff <= fifteenMinInMs && timeDiff > (fifteenMinInMs - 60000)) {
                sendNotification(playerId, matchData, 'fifteenMinutes', '15 dakika kaldı');
                sentNotifications.push('fifteenMinutes');
            }
        }
    });
    
    // Clean up old reminders (matches that already happened)
    reminders = reminders.filter(r => {
        const matchTime = new Date(r.matchData.startTimestamp * 1000);
        return matchTime > now;
    });
}

// Daily check for matches (Günlük Maç Kontrolü) - 09:00 TR
cron.schedule('0 9 * * *', () => {
    console.log('⏰ Daily match check triggered (09:00 TR)');
    
    // Get all players with dailyCheck enabled
    const dailyCheckPlayers = reminders.filter(r => r.options.dailyCheck);
    
    if (cache.nextMatch && dailyCheckPlayers.length > 0) {
        const matchTime = new Date(cache.nextMatch.startTimestamp * 1000);
        const today = new Date();
        
        // Check if match is today
        if (matchTime.toDateString() === today.toDateString()) {
            dailyCheckPlayers.forEach(reminder => {
                sendNotification(
                    reminder.playerId, 
                    cache.nextMatch, 
                    'dailyCheck', 
                    'Bugün maç günü'
                );
            });
        }
    }
}, {
    timezone: "Europe/Istanbul"
});
console.log('✅ Daily match check cron scheduled: 09:00 TR');

// Send notification function with OneSignal
async function sendNotification(playerId, matchData, type, timeText) {
    const FENERBAHCE_ID = 3052;
    const isHome = matchData.homeTeam?.id === FENERBAHCE_ID;
    const opponent = isHome ? matchData.awayTeam?.name : matchData.homeTeam?.name;
    const matchTime = new Date(matchData.startTimestamp * 1000);
    const timeString = matchTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    
    // Format: "Fenerbahçe - Rakip\n20:45 · 1 saat kaldı"
    const heading = `💛💙 Fenerbahçe - ${opponent}`;
    const message = `${timeString} · ${timeText}`;
    
    // OneSignal integration
    if (process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY) {
        try {
            const OneSignal = require('onesignal-node');
            const client = new OneSignal.Client(
                process.env.ONESIGNAL_APP_ID,
                process.env.ONESIGNAL_REST_API_KEY
            );
            
            const notification = {
                contents: { 'tr': message },
                headings: { 'tr': heading },
                include_player_ids: [playerId]
            };
            
            await client.createNotification(notification);
            console.log(`📢 Notification sent to player ${playerId}: ${heading} - ${message}`);
        } catch (err) {
            console.error('OneSignal error:', err.message);
        }
    } else {
        console.log(`📢 [TEST MODE] ${heading}\n${message} (Player: ${playerId})`);
    }
}

// Initial fetch on server start
fetchDataFromAPI();

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
    const baseUrl = getAbsoluteBaseUrl(req);
    const squad = cache.squad.map(player => {
        const { photoPath, ...rest } = player;
        const resolvedPath = photoPath || `/api/player-image/${player.id}`;
        const absolutePhoto = resolvedPath.startsWith('http')
            ? resolvedPath
            : `${baseUrl}${resolvedPath.startsWith('/') ? '' : '/'}${resolvedPath}`;

        return {
            ...rest,
            photo: absolutePhoto
        };
    });
    res.json(squad);
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
        reminders: reminders.length
    });
});

// POST /api/reminder - Save user notification preferences
app.post('/api/reminder', strictLimiter, (req, res) => {
    const { playerId, options, matchData } = req.body;

    if (!playerId || !options || !matchData) {
        return res.status(400).json({ error: 'Missing required fields: playerId, options, matchData' });
    }

    // Check if reminder already exists for this player and match
    const existingIndex = reminders.findIndex(r => 
        r.playerId === playerId && 
        r.matchData.id === matchData.id
    );

    const reminder = {
        playerId,
        options,
        matchData,
        createdAt: new Date(),
        sentNotifications: []
    };

    if (existingIndex >= 0) {
        reminders[existingIndex] = reminder;
    } else {
        reminders.push(reminder);
    }

    res.json({ 
        success: true, 
        message: 'Reminder saved successfully',
        activeCount: Object.values(options).filter(v => v).length
    });
});

// GET /api/reminder/:playerId - Get reminders for a player
app.get('/api/reminder/:playerId', (req, res) => {
    const { playerId } = req.params;
    const playerReminders = reminders.filter(r => r.playerId === playerId);
    res.json(playerReminders);
});

// DELETE /api/reminder/:playerId/:matchId - Delete a specific reminder
app.delete('/api/reminder/:playerId/:matchId', (req, res) => {
    const { playerId, matchId } = req.params;
    const initialLength = reminders.length;
    reminders = reminders.filter(r => !(r.playerId === playerId && r.matchData.id == matchId));
    
    if (reminders.length < initialLength) {
        res.json({ success: true, message: 'Reminder deleted' });
    } else {
        res.status(404).json({ error: 'Reminder not found' });
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
        version: '1.0.0',
        endpoints: [
            '/api/next-match',
            '/api/next-3-matches',
            '/api/squad',
            '/api/health',
            '/api/player-image/:playerId',
            '/api/reminder (POST)',
            '/api/reminder/:playerId (GET)',
            '/api/reminder/:playerId/:matchId (DELETE)'
        ]
    });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`✅ Backend server running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
});
