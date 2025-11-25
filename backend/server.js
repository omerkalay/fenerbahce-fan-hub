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

const USE_ONESIGNAL_SCHEDULER = process.env.USE_ONESIGNAL_SCHEDULER !== 'false';
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

// Cron job: Fetch data every day at 03:00 UTC (06:00 TR)
if (ENABLE_CRON) {
    try {
        // Use hardcoded schedule to avoid timezone issues
        const schedule = '0 3 * * *'; // 03:00 UTC = 06:00 TR
        cron.schedule(schedule, () => {
            console.log('⏰ Scheduled fetch triggered (03:00 UTC = 06:00 TR)');
            fetchDataFromAPI();
        });
        console.log(`✅ Data fetch cron scheduled: ${schedule} (03:00 UTC = 06:00 TR)`);
    } catch (error) {
        console.error('❌ Cron schedule error:', error.message);
    }
} else {
    console.log('⚠️ Cron disabled via DISABLE_CRON env');
}

// Cron job: Check and send notifications every minute (legacy fallback)
if (!USE_ONESIGNAL_SCHEDULER) {
    try {
        cron.schedule('* * * * *', () => {
            checkAndSendNotifications();
        });
        console.log('✅ Notification check cron scheduled: Every minute (UTC)');
    } catch (error) {
        console.error('❌ Notification cron error:', error.message);
    }
} else {
    console.log('ℹ️ Legacy match reminder cron disabled (using OneSignal scheduling)');
}

// Function to check and send notifications
function checkAndSendNotifications() {
    // Skip if cache not ready
    if (!cache.next3Matches || cache.next3Matches.length === 0) {
        return;
    }
    
    const now = new Date();
    
    matchReminders.forEach(reminder => {
        const { playerId, matchId, options, sentNotifications } = reminder;
        
        // Get CURRENT match data from cache (always up-to-date!)
        const matchData = cache.next3Matches.find(m => m.id === matchId);
        
        if (!matchData) {
            console.warn(`⚠️ Match ${matchId} not found in cache for player ${playerId}`);
            return;
        }
        
        const matchTime = new Date(matchData.startTimestamp * 1000);
        const timeDiff = matchTime - now; // milliseconds until match
        
        // Skip if match already happened
        if (timeDiff < 0) return;
        
        // Calculate time thresholds
        const threeHoursInMs = 3 * 60 * 60 * 1000;
        const oneHourInMs = 1 * 60 * 60 * 1000;
        const thirtyMinInMs = 30 * 60 * 1000;
        const fifteenMinInMs = 15 * 60 * 1000;
        
        // Check each notification type (1-minute window)
        if (options.threeHours && !sentNotifications.includes('threeHours')) {
            if (timeDiff <= threeHoursInMs && timeDiff > (threeHoursInMs - 60000)) {
                sendNotification({ playerId, matchData, type: 'threeHours', timeText: '3 saat kaldı' });
                sentNotifications.push('threeHours');
                console.log(`✅ Sent 3h reminder to ${playerId} for match ${matchId}`);
            }
        }
        
        if (options.oneHour && !sentNotifications.includes('oneHour')) {
            if (timeDiff <= oneHourInMs && timeDiff > (oneHourInMs - 60000)) {
                sendNotification({ playerId, matchData, type: 'oneHour', timeText: '1 saat kaldı' });
                sentNotifications.push('oneHour');
                console.log(`✅ Sent 1h reminder to ${playerId} for match ${matchId}`);
            }
        }
        
        if (options.thirtyMinutes && !sentNotifications.includes('thirtyMinutes')) {
            if (timeDiff <= thirtyMinInMs && timeDiff > (thirtyMinInMs - 60000)) {
                sendNotification({ playerId, matchData, type: 'thirtyMinutes', timeText: '30 dakika kaldı' });
                sentNotifications.push('thirtyMinutes');
                console.log(`✅ Sent 30min reminder to ${playerId} for match ${matchId}`);
            }
        }
        
        if (options.fifteenMinutes && !sentNotifications.includes('fifteenMinutes')) {
            if (timeDiff <= fifteenMinInMs && timeDiff > (fifteenMinInMs - 60000)) {
                sendNotification({ playerId, matchData, type: 'fifteenMinutes', timeText: '15 dakika kaldı' });
                sentNotifications.push('fifteenMinutes');
                console.log(`✅ Sent 15min reminder to ${playerId} for match ${matchId}`);
            }
        }
    });
    
    // Clean up old match reminders (matches that are 2 hours past)
    const cleanupBefore = now.getTime() - (2 * 60 * 60 * 1000);
    matchReminders = matchReminders.filter(reminder => {
        const matchData = cache.next3Matches.find(m => m.id === reminder.matchId);
        if (!matchData) return false;
        const matchTime = matchData.startTimestamp * 1000;
        return matchTime > cleanupBefore;
    });
}

// Daily check for matches (Günlük Maç Kontrolü) - 06:00 UTC = 09:00 TR
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
    });
    console.log('✅ Daily match check cron scheduled: 06:00 UTC (09:00 TR)');
} catch (error) {
    console.error('❌ Daily check cron error:', error.message);
}

// Send notification function with OneSignal REST API
async function sendNotification({ playerId, matchData, type, timeText, sendAfter = null, externalId = null }) {
    const FENERBAHCE_ID = 3052;
    const isHome = matchData.homeTeam?.id === FENERBAHCE_ID;
    const opponent = isHome ? matchData.awayTeam?.name : matchData.homeTeam?.name;
    const matchTime = new Date(matchData.startTimestamp * 1000);
    const timeString = matchTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    
    // Format: "💛💙 Fenerbahçe - Rakip\n20:45 · 1 saat kaldı"
    const heading = `💛💙 Fenerbahçe - ${opponent}`;
    const message = `${timeString} · ${timeText}`;
    
    // OneSignal REST API integration (modern approach)
    if (process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY) {
        try {
            const body = {
                app_id: process.env.ONESIGNAL_APP_ID,
                include_player_ids: [playerId],
                headings: { tr: heading, en: heading },
                contents: { tr: message, en: message },
                url: 'https://omerkalay.com/fenerbahce-fan-hub/',
                priority: 10,
                ttl: 86400, // 24 hours
                data: {
                    matchId: matchData.id,
                    type: type,
                    tournament: matchData.tournament?.name
                }
            };

            if (sendAfter) {
                body.send_after = new Date(sendAfter).toUTCString();
            }

            if (externalId) {
                body.external_id = externalId;
            }

            const response = await fetch('https://onesignal.com/api/v1/notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`
                },
                body: JSON.stringify(body)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('OneSignal API error:', errorData);
                throw new Error(`OneSignal API returned ${response.status}`);
            }
            
            const result = await response.json();
            const scheduleInfo = sendAfter ? `scheduled for ${new Date(sendAfter).toISOString()}` : 'sent immediately';
            console.log(`📢 Notification queued for player ${playerId}: ${heading} - ${message} (${scheduleInfo}, recipients: ${result.recipients})`);
            return result;
        } catch (err) {
            console.error('❌ OneSignal notification error:', err.message);
            throw err;
        }
    } else {
        const scheduleInfo = sendAfter ? `Scheduled at ${new Date(sendAfter).toISOString()}` : 'Immediate';
        console.log(`📢 [TEST MODE] ${heading}\n${message} (Player: ${playerId}, Type: ${type}, ${scheduleInfo})`);
        return { id: `test-${Date.now()}`, recipients: 1 };
    }
}

async function scheduleMatchNotification(playerId, matchData, optionKey) {
    if (!USE_ONESIGNAL_SCHEDULER) {
        return null;
    }

    const config = MATCH_NOTIFICATION_CONFIG[optionKey];

    if (!config) {
        console.warn(`⚠️ Unknown notification option: ${optionKey}`);
        return null;
    }

    const matchTime = new Date(matchData.startTimestamp * 1000);
    const sendAfter = new Date(matchTime.getTime() - config.offsetMs);

    if (sendAfter.getTime() <= Date.now()) {
        console.warn(`⏭️ Skipping ${optionKey} schedule for ${playerId}, send time already passed (${sendAfter.toISOString()})`);
        return null;
    }

    const externalId = `${matchData.id}-${playerId}-${optionKey}`;

    const result = await sendNotification({
        playerId,
        matchData,
        type: optionKey,
        timeText: config.timeText,
        sendAfter,
        externalId
    });

    return {
        notificationId: result?.id,
        sendAfter: sendAfter.toISOString(),
        optionKey,
        externalId
    };
}

async function cancelScheduledNotification(notificationId) {
    if (!notificationId) {
        return;
    }

    if (!(process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY)) {
        console.warn('⚠️ Cannot cancel OneSignal notification: missing credentials');
        return;
    }

    try {
        const url = `https://onesignal.com/api/v1/notifications/${notificationId}?app_id=${process.env.ONESIGNAL_APP_ID}`;
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`
            }
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.error(`❌ Failed to cancel OneSignal notification ${notificationId}`, err);
        } else {
            console.log(`🗑️ Cancelled OneSignal notification ${notificationId}`);
        }
    } catch (error) {
        console.error(`❌ Error cancelling OneSignal notification ${notificationId}`, error.message);
    }
}

async function cancelReminderSchedules(reminder) {
    if (!reminder?.scheduledNotifications) return;

    const cancellationPromises = Object.values(reminder.scheduledNotifications)
        .filter(entry => entry?.notificationId)
        .map(entry => cancelScheduledNotification(entry.notificationId));

    await Promise.allSettled(cancellationPromises);
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
        notifications: {
            matchReminders: matchReminders.length,
            dailyCheckSubscribers: dailyCheckSubscribers.size,
            sentDailyNotifications: sentDailyNotifications.size
        }
    });
});

// POST /api/reminder - Save user notification preferences
app.post('/api/reminder', strictLimiter, async (req, res) => {
    const { playerId, matchId, options } = req.body;

    if (!playerId || !options) {
        return res.status(400).json({ error: 'Missing required fields: playerId, options' });
    }

    // Validate that matchId exists in cache (if provided)
    let matchData = null;
    if (matchId) {
        matchData = cache.next3Matches.find(m => m.id === matchId);
        if (!matchData) {
            return res.status(400).json({ error: 'Invalid matchId - match not found in cache' });
        }
    }

    // Handle dailyCheck subscription
    if (options.dailyCheck) {
        dailyCheckSubscribers.add(playerId);
        console.log(`✅ Added ${playerId} to daily check subscribers (total: ${dailyCheckSubscribers.size})`);
    } else {
        dailyCheckSubscribers.delete(playerId);
        console.log(`➖ Removed ${playerId} from daily check subscribers (total: ${dailyCheckSubscribers.size})`);
    }

    // Handle time-based reminders (if matchId provided)
    const responseMeta = {
        scheduledCount: 0,
        scheduledOptions: [],
        skippedOptions: [],
        schedulerEnabled: USE_ONESIGNAL_SCHEDULER
    };

    if (matchId) {
        // Check if reminder already exists for this player and match
        const existingIndex = matchReminders.findIndex(r => 
            r.playerId === playerId && r.matchId === matchId
        );
        const existingReminder = existingIndex >= 0 ? matchReminders[existingIndex] : null;

        const hasTimeBasedOptions = options.threeHours || options.oneHour || 
                                     options.thirtyMinutes || options.fifteenMinutes;

        if (existingReminder) {
            await cancelReminderSchedules(existingReminder);
        }

        if (hasTimeBasedOptions) {
            const scheduledNotifications = {};

            if (USE_ONESIGNAL_SCHEDULER && matchData) {
                for (const optionKey of Object.keys(MATCH_NOTIFICATION_CONFIG)) {
                    if (!options[optionKey]) continue;
                    try {
                        const scheduled = await scheduleMatchNotification(playerId, matchData, optionKey);
                        if (scheduled) {
                            scheduledNotifications[optionKey] = scheduled;
                            responseMeta.scheduledCount += 1;
                            responseMeta.scheduledOptions.push(optionKey);
                        } else {
                            responseMeta.skippedOptions.push(optionKey);
                        }
                    } catch (error) {
                        console.error(`❌ Failed to schedule ${optionKey} for ${playerId}`, error.message);
                        responseMeta.skippedOptions.push(optionKey);
                    }
                }
            }

            const reminder = {
                playerId,
                matchId,
                options: {
                    threeHours: options.threeHours || false,
                    oneHour: options.oneHour || false,
                    thirtyMinutes: options.thirtyMinutes || false,
                    fifteenMinutes: options.fifteenMinutes || false
                },
                createdAt: new Date(),
                sentNotifications: existingReminder?.sentNotifications || [],
                scheduledNotifications
            };

            if (existingIndex >= 0) {
                matchReminders[existingIndex] = reminder;
                console.log(`🔄 Updated reminder for ${playerId} for match ${matchId}`);
            } else {
                matchReminders.push(reminder);
                console.log(`➕ Created reminder for ${playerId} for match ${matchId}`);
            }
        } else if (existingIndex >= 0) {
            // Remove if no time-based options selected
            matchReminders.splice(existingIndex, 1);
            console.log(`🗑️ Removed reminder for ${playerId} for match ${matchId}`);
        }
    }

    const activeCount = Object.values(options).filter(v => v === true).length;

    res.json({ 
        success: true, 
        message: 'Notification preferences saved',
        activeCount,
        dailyCheckActive: dailyCheckSubscribers.has(playerId),
        matchReminderActive: matchId ? matchReminders.some(r => r.playerId === playerId && r.matchId === matchId) : false,
        schedule: responseMeta
    });
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
app.listen(PORT, () => {
    console.log(`✅ Backend server running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
});
