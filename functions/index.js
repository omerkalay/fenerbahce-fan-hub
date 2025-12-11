/**
 * Firebase Cloud Functions - Fenerbahçe Fan Hub Backend
 * 
 * Bu dosya Render.com backend'inin yerini alıyor.
 * Tüm API endpoint'leri ve scheduled functions burada.
 */

const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
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

// Helper to get API host (must be called inside function context)
const getApiHost = () => rapidApiHost.value() || DEFAULT_API_HOST;

// Helper to get headers (must be called inside function context)
const getSofascoreHeaders = () => ({
    'x-rapidapi-key': rapidApiKey.value(),
    'x-rapidapi-host': getApiHost()
});

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

// Helper: Sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// SCHEDULED FUNCTIONS
// ============================================

/**
 * Daily Data Refresh - Günde 1 kez çalışır
 * SofaScore ve ESPN'den veri çeker, Firebase'e cache'ler
 * 03:00 UTC = 06:00 TR
 */
exports.dailyDataRefresh = onSchedule({
    schedule: "0 3 * * *",
    secrets: [rapidApiKey, rapidApiHost]
}, async (event) => {
    console.log('⏰ Daily data refresh started (03:00 UTC = 06:00 TR)');

    try {
        const cache = {
            nextMatch: null,
            next3Matches: [],
            squad: [],
            standings: [],
            lastUpdate: Date.now()
        };

        // 1. Fetch matches from SofaScore
        console.log('1️⃣ Fetching matches from SofaScore...');
        const matchResponse = await fetch(
            `https://${getApiHost()}/teams/get-next-matches?teamId=${FENERBAHCE_ID}`,
            { headers: getSofascoreHeaders() }
        );

        if (matchResponse.ok) {
            const matchData = await matchResponse.json();
            if (matchData.events && matchData.events.length > 0) {
                cache.nextMatch = matchData.events[0];
                cache.next3Matches = matchData.events.slice(0, 3);
                console.log(`✅ Fetched ${matchData.events.length} matches`);
            }
        } else {
            console.error(`❌ Match fetch failed: ${matchResponse.status}`);
        }

        await sleep(2000); // Rate limit protection

        // 2. Fetch squad from SofaScore
        console.log('2️⃣ Fetching squad from SofaScore...');
        const squadResponse = await fetch(
            `https://${getApiHost()}/teams/get-squad?teamId=${FENERBAHCE_ID}`,
            { headers: getSofascoreHeaders() }
        );

        if (squadResponse.ok) {
            const squadData = await squadResponse.json();
            if (squadData.players) {
                cache.squad = squadData.players.map(item => ({
                    id: item.player.id,
                    name: item.player.name || 'Unknown',
                    position: item.player.position || null,
                    number: item.player.jerseyNumber || null,
                    country: item.player.country?.name || null,
                    marketValue: item.player.proposedMarketValue || null
                }));
                console.log(`✅ Fetched ${cache.squad.length} players`);
            }
        } else {
            console.error(`❌ Squad fetch failed: ${squadResponse.status}`);
        }

        await sleep(2000);

        // 3. Fetch standings from ESPN (FREE!)
        console.log('3️⃣ Fetching standings from ESPN...');
        const standingsData = [];

        // Süper Lig
        const slResponse = await fetch(
            'https://site.api.espn.com/apis/v2/sports/soccer/tur.1/standings?season=2025'
        );
        if (slResponse.ok) {
            const slData = await slResponse.json();
            if (slData.children && slData.children.length > 0) {
                const standings = slData.children[0].standings.entries;
                standingsData.push({
                    id: 'super-lig',
                    name: 'Trendyol Süper Lig',
                    rows: standings.map(entry => ({
                        team: {
                            id: entry.team.id,
                            name: entry.team.displayName,
                            logo: entry.team.logos?.[0]?.href || ''
                        },
                        rank: entry.stats.find(s => s.name === 'rank')?.value || 0,
                        points: entry.stats.find(s => s.name === 'points')?.value || 0,
                        matches: entry.stats.find(s => s.name === 'gamesPlayed')?.value || 0,
                        wins: entry.stats.find(s => s.name === 'wins')?.value || 0,
                        draws: entry.stats.find(s => s.name === 'ties')?.value || 0,
                        losses: entry.stats.find(s => s.name === 'losses')?.value || 0,
                        goalsFor: entry.stats.find(s => s.name === 'pointsFor')?.value || 0,
                        goalsAgainst: entry.stats.find(s => s.name === 'pointsAgainst')?.value || 0,
                        goalDiff: entry.stats.find(s => s.name === 'pointDifferential')?.value || 0
                    }))
                });
                console.log(`✅ Süper Lig: ${standings.length} teams`);
            }
        }

        // Europa League
        const elResponse = await fetch(
            'https://site.api.espn.com/apis/v2/sports/soccer/uefa.europa/standings?season=2025'
        );
        if (elResponse.ok) {
            const elData = await elResponse.json();
            if (elData.children && elData.children.length > 0) {
                const leagueStandings = elData.children.find(c => c.name === 'League Phase') || elData.children[0];
                const standings = leagueStandings.standings.entries;
                standingsData.push({
                    id: 'europa-league',
                    name: 'UEFA Avrupa Ligi',
                    rows: standings.map(entry => ({
                        team: {
                            id: entry.team.id,
                            name: entry.team.displayName,
                            logo: entry.team.logos?.[0]?.href || ''
                        },
                        rank: entry.stats.find(s => s.name === 'rank')?.value || 0,
                        points: entry.stats.find(s => s.name === 'points')?.value || 0,
                        matches: entry.stats.find(s => s.name === 'gamesPlayed')?.value || 0,
                        wins: entry.stats.find(s => s.name === 'wins')?.value || 0,
                        draws: entry.stats.find(s => s.name === 'ties')?.value || 0,
                        losses: entry.stats.find(s => s.name === 'losses')?.value || 0,
                        goalsFor: entry.stats.find(s => s.name === 'pointsFor')?.value || 0,
                        goalsAgainst: entry.stats.find(s => s.name === 'pointsAgainst')?.value || 0,
                        goalDiff: entry.stats.find(s => s.name === 'pointDifferential')?.value || 0
                    }))
                });
                console.log(`✅ Europa League: ${standings.length} teams`);
            }
        }

        cache.standings = standingsData;

        // 4. Save to Firebase
        console.log('4️⃣ Saving to Firebase cache...');
        await db.ref('cache').set(cache);
        console.log(`✨ Cache updated at ${new Date().toISOString()}`);

    } catch (error) {
        console.error('❌ Daily refresh failed:', error);
    }
});

/**
 * Check Match Notifications - Her dakika çalışır
 * ARTIK API CALL YAPMIYOR! Cache'den okuyor.
 */
exports.checkMatchNotifications = onSchedule("every 1 minutes", async (event) => {
    console.log('🔔 Checking notifications...');

    try {
        // 1. Cache'den maç verisi oku (API CALL YOK!)
        const cacheSnapshot = await db.ref('cache').once('value');
        const cache = cacheSnapshot.val();

        if (!cache || !cache.next3Matches || cache.next3Matches.length === 0) {
            console.log('ℹ️ No matches in cache');
            return;
        }

        const nextMatches = cache.next3Matches;
        const now = Date.now();

        // 2. Kullanıcı tercihlerini oku
        const notifSnapshot = await db.ref('notifications').once('value');
        const allNotifications = notifSnapshot.val() || {};

        const MATCH_CONFIG = {
            threeHours: { offsetMs: 3 * 60 * 60 * 1000, timeText: '3 saat kaldı' },
            oneHour: { offsetMs: 1 * 60 * 60 * 1000, timeText: '1 saat kaldı' },
            thirtyMinutes: { offsetMs: 30 * 60 * 1000, timeText: '30 dakika kaldı' },
            fifteenMinutes: { offsetMs: 15 * 60 * 1000, timeText: '15 dakika kaldı' }
        };

        const notificationsToSend = [];
        const updates = {};

        // 3. Her kullanıcı için kontrol
        // Daily check SADECE sabah 09:00-09:02 İstanbul saatinde çalışsın
        const istanbulNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
        const istanbulHour = istanbulNow.getHours();
        const istanbulMinute = istanbulNow.getMinutes();
        const isDailyCheckTime = istanbulHour === 9 && istanbulMinute <= 2; // 09:00-09:02 arası

        for (const [playerId, playerData] of Object.entries(allNotifications)) {
            // Daily check - SADECE sabah 09:00-09:02 arasında
            if (playerData.dailyCheck && isDailyCheckTime) {
                const todayStr = new Date().toDateString();
                const nextMatch = nextMatches[0];
                const matchDate = new Date(nextMatch.startTimestamp * 1000);

                if (matchDate.toDateString() === todayStr) {
                    const lastDaily = playerData.lastDailyNotification;
                    if (!lastDaily || lastDaily !== todayStr) {
                        const isHome = nextMatch.homeTeam.id === FENERBAHCE_ID;
                        const opponent = isHome ? nextMatch.awayTeam.name : nextMatch.homeTeam.name;
                        const timeString = matchDate.toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Europe/Istanbul'
                        });

                        notificationsToSend.push({
                            token: playerId,
                            notification: {
                                title: '📅 Bugün Maç Var!',
                                body: `💛💙 Fenerbahçe - ${opponent} | ${timeString}`
                            },
                            webpush: {
                                fcmOptions: { link: 'https://omerkalay.com/fenerbahce-fan-hub/' }
                            }
                        });

                        updates[`notifications/${playerId}/lastDailyNotification`] = todayStr;
                    }
                }
            }

            // Match-specific notifications
            if (!playerData.matches) continue;

            for (const [matchId, matchOptions] of Object.entries(playerData.matches)) {
                const match = nextMatches.find(m => String(m.id) === String(matchId));
                if (!match) continue;

                const matchTime = match.startTimestamp * 1000;
                const sentNotifications = matchOptions.sentNotifications || [];

                for (const [optionKey, config] of Object.entries(MATCH_CONFIG)) {
                    if (!matchOptions[optionKey]) continue;
                    if (sentNotifications.includes(optionKey)) continue;

                    const triggerTime = matchTime - config.offsetMs;
                    const triggerWindowEnd = triggerTime + (2 * 60 * 1000); // 2 dakikalık window

                    // Tam 2 dakikalık pencere içinde mi?
                    if (now >= triggerTime && now < triggerWindowEnd) {
                        const isHome = match.homeTeam.id === FENERBAHCE_ID;
                        const opponent = isHome ? match.awayTeam.name : match.homeTeam.name;
                        const timeString = new Date(matchTime).toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Europe/Istanbul'
                        });

                        notificationsToSend.push({
                            token: playerId,
                            notification: {
                                title: `💛💙 Fenerbahçe - ${opponent}`,
                                body: `${timeString} · ${config.timeText}`
                            },
                            data: {
                                matchId: String(match.id),
                                type: optionKey
                            },
                            webpush: {
                                fcmOptions: { link: 'https://omerkalay.com/fenerbahce-fan-hub/' }
                            }
                        });

                        const sentPath = `notifications/${playerId}/matches/${matchId}/sentNotifications`;
                        updates[sentPath] = [...sentNotifications, optionKey];
                    }
                }
            }
        }

        // 4. Bildirimleri gönder
        if (notificationsToSend.length > 0) {
            console.log(`🚀 Sending ${notificationsToSend.length} notifications...`);
            const results = await Promise.allSettled(
                notificationsToSend.map(msg => admin.messaging().send(msg))
            );
            const success = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            console.log(`✅ Sent: ${success}, ❌ Failed: ${failed}`);
        }

        // 5. Database güncelle
        if (Object.keys(updates).length > 0) {
            await db.ref().update(updates);
        }

    } catch (error) {
        console.error('❌ Notification check failed:', error);
    }
});

// ============================================
// HTTP ENDPOINTS
// ============================================

/**
 * Main API - Express-style routing
 */
exports.api = onRequest({
    ...corsOptions,
    secrets: [rapidApiKey, rapidApiHost]
}, async (req, res) => {
    const path = req.path.replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
    const segments = path.split('/');
    const endpoint = segments[0];
    const param = segments[1];

    console.log(`📥 ${req.method} /${path}`);

    try {
        switch (endpoint) {
            case 'next-match':
            case 'nextMatch':
                return await handleNextMatch(req, res);

            case 'next-3-matches':
            case 'next3Matches':
                return await handleNext3Matches(req, res);

            case 'squad':
                return await handleSquad(req, res);

            case 'standings':
                return await handleStandings(req, res);

            case 'live-match':
            case 'liveMatch':
                return await handleLiveMatch(req, res);

            case 'player-image':
            case 'playerImage':
                return await handlePlayerImage(req, res, param);

            case 'team-image':
            case 'teamImage':
                return await handleTeamImage(req, res, param);

            case 'reminder':
                if (req.method === 'POST') {
                    return await handleReminder(req, res);
                }
                return res.status(405).json({ error: 'Method not allowed' });

            case 'health':
                return await handleHealth(req, res);

            case 'refresh':
                return await handleRefresh(req, res);

            default:
                return res.json({
                    message: 'Fenerbahçe Fan Hub API (Firebase)',
                    version: '2.0.0',
                    endpoints: [
                        '/next-match',
                        '/next-3-matches',
                        '/squad',
                        '/standings',
                        '/live-match',
                        '/player-image/:id',
                        '/team-image/:id',
                        '/reminder (POST)',
                        '/health',
                        '/refresh'
                    ]
                });
        }
    } catch (error) {
        console.error('❌ API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Handler functions
async function handleNextMatch(req, res) {
    const snapshot = await db.ref('cache/nextMatch').once('value');
    const data = snapshot.val();
    if (!data) {
        return res.status(404).json({ error: 'No match data. Run /refresh first.' });
    }
    return res.json(data);
}

async function handleNext3Matches(req, res) {
    const snapshot = await db.ref('cache/next3Matches').once('value');
    const data = snapshot.val() || [];
    return res.json(data);
}

async function handleSquad(req, res) {
    const snapshot = await db.ref('cache/squad').once('value');
    const squad = snapshot.val() || [];

    // Add photo URLs
    const baseUrl = `https://us-central1-fb-hub-ed9de.cloudfunctions.net/api`;
    const enrichedSquad = squad.map(player => ({
        ...player,
        photo: `${baseUrl}/player-image/${player.id}`
    }));

    return res.json(enrichedSquad);
}

async function handleStandings(req, res) {
    const snapshot = await db.ref('cache/standings').once('value');
    const data = snapshot.val() || [];
    return res.json(data);
}

async function handleLiveMatch(req, res) {
    // Live match - her zaman ESPN'den taze veri çek (maç canlıyken)
    try {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');

        const scoreboardUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard?dates=${dateStr}`;
        const response = await fetch(scoreboardUrl);

        if (!response.ok) {
            return res.status(404).json({ error: 'No live match data' });
        }

        const data = await response.json();
        const fenerbahceMatch = data.events?.find(event => {
            const competitors = event.competitions?.[0]?.competitors || [];
            return competitors.some(team =>
                team.team.displayName.toLowerCase().includes('fenerbahce') ||
                team.team.displayName.toLowerCase().includes('fenerbahçe')
            );
        });

        if (!fenerbahceMatch) {
            return res.status(404).json({ error: 'No Fenerbahçe match today' });
        }

        const status = fenerbahceMatch.status.type.state;
        if (status !== 'in' && status !== 'post') {
            return res.status(404).json({ error: 'Match not started yet' });
        }

        // Get detailed match data
        const matchId = fenerbahceMatch.id;
        const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/summary?event=${matchId}`;
        const summaryResponse = await fetch(summaryUrl);

        if (summaryResponse.ok) {
            return res.json(await summaryResponse.json());
        }

        return res.json(fenerbahceMatch);

    } catch (error) {
        console.error('Live match error:', error);
        return res.status(500).json({ error: 'Failed to fetch live match' });
    }
}

async function handlePlayerImage(req, res, playerId) {
    if (!playerId) {
        return res.status(400).json({ error: 'Player ID required' });
    }

    try {
        const imageUrl = `${SOFASCORE_IMAGE_BASE}/player/${playerId}/image`;
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': IMAGE_USER_AGENT,
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
            }
        });

        if (!response.ok) {
            return res.status(404).send('Image not found');
        }

        res.set('Content-Type', response.headers.get('content-type') || 'image/png');
        res.set('Cache-Control', 'public, max-age=86400');

        const buffer = Buffer.from(await response.arrayBuffer());
        return res.send(buffer);
    } catch (error) {
        console.error('Player image error:', error);
        return res.status(500).send('Error loading image');
    }
}

async function handleTeamImage(req, res, teamId) {
    if (!teamId) {
        return res.status(400).json({ error: 'Team ID required' });
    }

    try {
        const imageUrl = `${SOFASCORE_IMAGE_BASE}/team/${teamId}/image`;
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': IMAGE_USER_AGENT,
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
            }
        });

        if (!response.ok) {
            return res.status(404).send('Image not found');
        }

        res.set('Content-Type', response.headers.get('content-type') || 'image/png');
        res.set('Cache-Control', 'public, max-age=86400');

        const buffer = Buffer.from(await response.arrayBuffer());
        return res.send(buffer);
    } catch (error) {
        console.error('Team image error:', error);
        return res.status(500).send('Error loading image');
    }
}

async function handleReminder(req, res) {
    const { playerId, matchId, options } = req.body;

    if (!playerId || !options) {
        return res.status(400).json({ error: 'Missing playerId or options' });
    }

    try {
        // Manuel bildirimler için kullanıcıyı genel topic'e abone et
        await admin.messaging().subscribeToTopic(playerId, 'all_fans');
        console.log(`✅ Subscribed ${playerId.slice(0, 10)}... to topic 'all_fans'`);
    } catch (subError) {
        console.error('Topic subscription failed:', subError);
        // Topic hatası akışı bozmasın, devam et
    }

    try {
        const playerRef = db.ref(`notifications/${playerId}`);
        const snapshot = await playerRef.once('value');
        const currentData = snapshot.val() || {};

        // Update dailyCheck
        currentData.dailyCheck = options.dailyCheck || false;

        // Update match-specific reminders
        if (matchId) {
            if (!currentData.matches) {
                currentData.matches = {};
            }

            const hasOptions = options.threeHours || options.oneHour ||
                options.thirtyMinutes || options.fifteenMinutes;

            if (hasOptions) {
                currentData.matches[matchId] = {
                    threeHours: options.threeHours || false,
                    oneHour: options.oneHour || false,
                    thirtyMinutes: options.thirtyMinutes || false,
                    fifteenMinutes: options.fifteenMinutes || false,
                    sentNotifications: currentData.matches?.[matchId]?.sentNotifications || [],
                    updatedAt: Date.now()
                };
            } else if (currentData.matches[matchId]) {
                delete currentData.matches[matchId];
            }
        }

        await playerRef.set(currentData);

        return res.json({
            success: true,
            message: 'Preferences saved',
            dailyCheckActive: currentData.dailyCheck,
            activeMatchReminders: Object.keys(currentData.matches || {}).length
        });

    } catch (error) {
        console.error('Reminder save error:', error);
        return res.status(500).json({ error: 'Failed to save preferences' });
    }
}

async function handleHealth(req, res) {
    const cacheSnapshot = await db.ref('cache/lastUpdate').once('value');
    const lastUpdate = cacheSnapshot.val();

    const notifSnapshot = await db.ref('notifications').once('value');
    const notifCount = Object.keys(notifSnapshot.val() || {}).length;

    return res.json({
        status: 'ok',
        platform: 'Firebase Cloud Functions',
        lastCacheUpdate: lastUpdate ? new Date(lastUpdate).toISOString() : null,
        subscribedUsers: notifCount
    });
}

async function handleRefresh(req, res) {
    console.log('🔄 Manual refresh triggered');

    // Trigger daily refresh logic inline
    try {
        const cache = {
            nextMatch: null,
            next3Matches: [],
            squad: [],
            standings: [],
            lastUpdate: Date.now()
        };

        // Fetch matches
        const matchResponse = await fetch(
            `https://${getApiHost()}/teams/get-next-matches?teamId=${FENERBAHCE_ID}`,
            { headers: getSofascoreHeaders() }
        );

        if (matchResponse.ok) {
            const matchData = await matchResponse.json();
            if (matchData.events && matchData.events.length > 0) {
                cache.nextMatch = matchData.events[0];
                cache.next3Matches = matchData.events.slice(0, 3);
            }
        }

        await sleep(1000);

        // Fetch squad
        const squadResponse = await fetch(
            `https://${getApiHost()}/teams/get-squad?teamId=${FENERBAHCE_ID}`,
            { headers: getSofascoreHeaders() }
        );

        if (squadResponse.ok) {
            const squadData = await squadResponse.json();
            if (squadData.players) {
                cache.squad = squadData.players.map(item => ({
                    id: item.player.id,
                    name: item.player.name || 'Unknown',
                    position: item.player.position || null,
                    number: item.player.jerseyNumber || null,
                    country: item.player.country?.name || null
                }));
            }
        }

        await sleep(1000);

        // Fetch standings (abbreviated)
        const slResponse = await fetch(
            'https://site.api.espn.com/apis/v2/sports/soccer/tur.1/standings?season=2025'
        );
        if (slResponse.ok) {
            const slData = await slResponse.json();
            if (slData.children && slData.children.length > 0) {
                cache.standings.push({
                    id: 'super-lig',
                    name: 'Trendyol Süper Lig',
                    rows: slData.children[0].standings.entries.map(entry => ({
                        team: { id: entry.team.id, name: entry.team.displayName, logo: entry.team.logos?.[0]?.href || '' },
                        rank: entry.stats.find(s => s.name === 'rank')?.value || 0,
                        points: entry.stats.find(s => s.name === 'points')?.value || 0,
                        matches: entry.stats.find(s => s.name === 'gamesPlayed')?.value || 0
                    }))
                });
            }
        }

        // Europa League
        const elResponse = await fetch(
            'https://site.api.espn.com/apis/v2/sports/soccer/uefa.europa/standings?season=2025'
        );
        if (elResponse.ok) {
            const elData = await elResponse.json();
            if (elData.children && elData.children.length > 0) {
                const leagueStandings = elData.children.find(c => c.name === 'League Phase') || elData.children[0];
                cache.standings.push({
                    id: 'europa-league',
                    name: 'UEFA Avrupa Ligi',
                    rows: leagueStandings.standings.entries.map(entry => ({
                        team: { id: entry.team.id, name: entry.team.displayName, logo: entry.team.logos?.[0]?.href || '' },
                        rank: entry.stats.find(s => s.name === 'rank')?.value || 0,
                        points: entry.stats.find(s => s.name === 'points')?.value || 0,
                        matches: entry.stats.find(s => s.name === 'gamesPlayed')?.value || 0
                    }))
                });
            }
        }

        await db.ref('cache').set(cache);

        return res.json({
            success: true,
            message: 'Cache refreshed',
            lastUpdate: new Date(cache.lastUpdate).toISOString(),
            stats: {
                matches: cache.next3Matches.length,
                squad: cache.squad.length,
                standings: cache.standings.length
            }
        });

    } catch (error) {
        console.error('Refresh error:', error);
        return res.status(500).json({ error: 'Refresh failed', details: error.message });
    }
}
