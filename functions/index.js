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

// Stable date key for per-day notification dedupe in Istanbul timezone.
const formatDateKey = (timestamp, timeZone = ISTANBUL_TIMEZONE) => (
    new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date(timestamp))
);

const pickAssistNameFromSummaryItem = (item, scorerName = '') => {
    const explicitAssist = (Array.isArray(item?.assists) ? item.assists : [])
        .find((assist) => assist?.athlete?.displayName)?.athlete?.displayName || '';
    if (explicitAssist && explicitAssist !== scorerName) {
        return explicitAssist;
    }

    const participantAssist = (Array.isArray(item?.participants) ? item.participants : [])
        .map((participant) => participant?.athlete?.displayName || '')
        .find((name) => name && name !== scorerName);

    return participantAssist || '';
};

const normalizeEventFlags = (event = {}) => {
    const normalized = {
        ...event,
        isGoal: Boolean(event.isGoal),
        isPenalty: Boolean(event.isPenalty),
        isOwnGoal: Boolean(event.isOwnGoal),
        isYellowCard: Boolean(event.isYellowCard),
        isRedCard: Boolean(event.isRedCard),
        isSubstitution: Boolean(event.isSubstitution)
    };

    // Aynı event birden fazla kategori taşısa bile UI'da tek anlamlı ikon gösterilsin.
    if (normalized.isGoal) {
        normalized.isYellowCard = false;
        normalized.isRedCard = false;
    } else if (normalized.isRedCard) {
        normalized.isYellowCard = false;
    }

    return normalized;
};

const normalizeSummaryEvents = (events = []) =>
    events
        .map((event) => normalizeEventFlags(event))
        .filter((event) => (event.isGoal || event.isYellowCard || event.isRedCard) && !event.isSubstitution)
        .map((event) => ({
            clock: event.clock || '',
            team: String(event.team || ''),
            type: event.type || '',
            player: event.player || '',
            assist: event.assist || '',
            isGoal: Boolean(event.isGoal),
            isPenalty: Boolean(event.isPenalty),
            isOwnGoal: Boolean(event.isOwnGoal),
            isYellowCard: Boolean(event.isYellowCard),
            isRedCard: Boolean(event.isRedCard)
        }));

const pickOrderedSummaryStats = (homeStatMap, awayStatMap) => (
    SUMMARY_STAT_GROUPS
        .map((group) => {
            const selectedKey = group.keys.find((key) => homeStatMap.has(key) || awayStatMap.has(key));
            if (!selectedKey) return null;
            return {
                key: selectedKey,
                label: group.label,
                homeValue: String(homeStatMap.get(selectedKey) ?? '0'),
                awayValue: String(awayStatMap.get(selectedKey) ?? '0')
            };
        })
        .filter(Boolean)
);

const buildSummaryPayloadFromLiveData = (liveData, now, source = 'live-post') => {
    const homeStatMap = new Map((liveData.stats || []).map((stat) => [stat.name, stat.homeValue]));
    const awayStatMap = new Map((liveData.stats || []).map((stat) => [stat.name, stat.awayValue]));

    const events = normalizeSummaryEvents(liveData.events || []);
    const homeYellowCards = events.filter((event) => event.isYellowCard && event.team === String(liveData.homeTeam?.id || '')).length;
    const awayYellowCards = events.filter((event) => event.isYellowCard && event.team === String(liveData.awayTeam?.id || '')).length;
    const homeRedCards = events.filter((event) => event.isRedCard && event.team === String(liveData.homeTeam?.id || '')).length;
    const awayRedCards = events.filter((event) => event.isRedCard && event.team === String(liveData.awayTeam?.id || '')).length;

    if (!homeStatMap.has('yellowCards')) homeStatMap.set('yellowCards', String(homeYellowCards));
    if (!awayStatMap.has('yellowCards')) awayStatMap.set('yellowCards', String(awayYellowCards));
    if (!homeStatMap.has('redCards')) homeStatMap.set('redCards', String(homeRedCards));
    if (!awayStatMap.has('redCards')) awayStatMap.set('redCards', String(awayRedCards));

    return {
        matchId: String(liveData.matchId),
        league: liveData.league || null,
        matchState: liveData.matchState || 'post',
        statusDetail: liveData.statusDetail || 'FT',
        displayClock: liveData.displayClock || '',
        homeTeam: {
            id: liveData.homeTeam?.id || null,
            name: liveData.homeTeam?.name || 'Home',
            logo: liveData.homeTeam?.logo || null,
            score: String(liveData.homeTeam?.score ?? '0')
        },
        awayTeam: {
            id: liveData.awayTeam?.id || null,
            name: liveData.awayTeam?.name || 'Away',
            logo: liveData.awayTeam?.logo || null,
            score: String(liveData.awayTeam?.score ?? '0')
        },
        stats: pickOrderedSummaryStats(homeStatMap, awayStatMap),
        events,
        source,
        updatedAt: now
    };
};

const parseSummaryKeyEvent = (item) => {
    const rawType = String(item?.type?.type || '').toLowerCase();
    const rawText = String(item?.type?.text || item?.text || item?.shortText || '');
    const isSubstitution = rawType === 'substitution' || /substitution/i.test(rawText);

    if (isSubstitution) return null;

    const isGoal = Boolean(item?.scoringPlay) || rawType.includes('goal') || /goal|penalty - scored/i.test(rawText);
    const isYellowCard = rawType.includes('yellow-card') || /yellow card/i.test(rawText);
    const isRedCard = rawType.includes('red-card') || /red card/i.test(rawText);

    if (!(isGoal || isYellowCard || isRedCard)) {
        return null;
    }

    const participants = Array.isArray(item?.participants) ? item.participants : [];
    const firstParticipant = participants.find((participant) => participant?.athlete?.displayName);
    const playerName = firstParticipant?.athlete?.displayName || item?.athlete?.displayName || item?.shortText || '';
    const participantTeamId = firstParticipant?.team?.id || '';
    const teamId = String(item?.team?.id || participantTeamId || '');
    const isOwnGoal = Boolean(item?.ownGoal) || /own goal/i.test(rawText);
    const assistName = isGoal && !isOwnGoal
        ? pickAssistNameFromSummaryItem(item, playerName)
        : '';

    return normalizeEventFlags({
        clock: item?.clock?.displayValue || item?.time?.displayValue || '',
        team: teamId,
        type: item?.type?.text || rawText,
        player: playerName,
        assist: assistName,
        isGoal,
        isPenalty: Boolean(item?.penaltyKick) || /penalty/i.test(rawText),
        isOwnGoal,
        isYellowCard,
        isRedCard
    });
};

const extractTeamStatMap = (summaryJson, teamId, fallbackStats = []) => {
    const boxscoreTeams = Array.isArray(summaryJson?.boxscore?.teams) ? summaryJson.boxscore.teams : [];
    const matchedTeam = boxscoreTeams.find((teamItem) => String(teamItem?.team?.id || '') === String(teamId));
    const statsArray = Array.isArray(matchedTeam?.statistics) ? matchedTeam.statistics : fallbackStats;
    return new Map(statsArray.map((stat) => [stat.name, stat.displayValue ?? stat.value ?? '0']));
};

const buildSummaryPayloadFromEspnSummary = (summaryJson, league, now, source = 'espn-summary') => {
    const competition = summaryJson?.header?.competitions?.[0];
    if (!competition) return null;

    const homeCompetitor = (competition.competitors || []).find((item) => item.homeAway === 'home');
    const awayCompetitor = (competition.competitors || []).find((item) => item.homeAway === 'away');

    if (!homeCompetitor || !awayCompetitor) {
        return null;
    }

    const homeTeamId = String(homeCompetitor?.team?.id || '');
    const awayTeamId = String(awayCompetitor?.team?.id || '');

    const homeStatMap = extractTeamStatMap(summaryJson, homeTeamId, homeCompetitor?.statistics || []);
    const awayStatMap = extractTeamStatMap(summaryJson, awayTeamId, awayCompetitor?.statistics || []);

    let events = (summaryJson?.keyEvents || [])
        .map(parseSummaryKeyEvent)
        .filter(Boolean);

    if (events.length === 0) {
        const detailEvents = Array.isArray(competition.details) ? competition.details : [];
        events = detailEvents
            .map((detail) => {
                const playerName = detail?.athletesInvolved?.[0]?.displayName || '';
                const assistCandidate = detail?.athletesInvolved?.[1]?.displayName || '';
                const isOwnGoal = Boolean(detail?.ownGoal);
                return normalizeEventFlags({
                    clock: detail?.clock?.displayValue || '',
                    team: String(detail?.team?.id || ''),
                    type: detail?.type?.text || '',
                    player: playerName,
                    assist: !isOwnGoal && assistCandidate && assistCandidate !== playerName ? assistCandidate : '',
                    isGoal: Boolean(detail?.scoringPlay),
                    isPenalty: Boolean(detail?.penaltyKick),
                    isOwnGoal,
                    isYellowCard: Boolean(detail?.yellowCard),
                    isRedCard: Boolean(detail?.redCard)
                });
            })
            .filter((event) => event.isGoal || event.isYellowCard || event.isRedCard);
    }

    const homeYellowCards = events.filter((event) => event.isYellowCard && event.team === homeTeamId).length;
    const awayYellowCards = events.filter((event) => event.isYellowCard && event.team === awayTeamId).length;
    const homeRedCards = events.filter((event) => event.isRedCard && event.team === homeTeamId).length;
    const awayRedCards = events.filter((event) => event.isRedCard && event.team === awayTeamId).length;

    if (!homeStatMap.has('yellowCards')) homeStatMap.set('yellowCards', String(homeYellowCards));
    if (!awayStatMap.has('yellowCards')) awayStatMap.set('yellowCards', String(awayYellowCards));
    if (!homeStatMap.has('redCards')) homeStatMap.set('redCards', String(homeRedCards));
    if (!awayStatMap.has('redCards')) awayStatMap.set('redCards', String(awayRedCards));

    return {
        matchId: String(competition?.id || summaryJson?.header?.id || ''),
        league: league || null,
        matchState: competition?.status?.type?.state || 'post',
        statusDetail: competition?.status?.type?.detail || competition?.status?.type?.shortDetail || '',
        displayClock: competition?.status?.displayClock || '',
        homeTeam: {
            id: homeCompetitor?.team?.id || null,
            name: homeCompetitor?.team?.displayName || 'Home',
            logo: homeCompetitor?.team?.logos?.[0]?.href || null,
            score: String(homeCompetitor?.score ?? '0')
        },
        awayTeam: {
            id: awayCompetitor?.team?.id || null,
            name: awayCompetitor?.team?.displayName || 'Away',
            logo: awayCompetitor?.team?.logos?.[0]?.href || null,
            score: String(awayCompetitor?.score ?? '0')
        },
        stats: pickOrderedSummaryStats(homeStatMap, awayStatMap),
        events: normalizeSummaryEvents(events),
        source,
        updatedAt: now
    };
};

const fetchEspnSummaryForMatch = async (matchId) => {
    for (const league of ESPN_LEAGUES) {
        try {
            const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/summary?event=${matchId}`;
            const response = await fetch(summaryUrl);
            if (!response.ok) continue;
            const summaryJson = await response.json();
            const payload = buildSummaryPayloadFromEspnSummary(summaryJson, league, Date.now(), 'espn-summary-on-demand');
            if (payload && payload.matchId) {
                return payload;
            }
        } catch (error) {
            console.warn(`⚠️ ESPN summary fetch failed for ${matchId} (${league}):`, error.message);
        }
    }
    return null;
};

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
        const existingSummariesSnapshot = await db.ref('cache/matchSummaries').once('value');
        const existingMatchSummaries = existingSummariesSnapshot.val() || {};

        const cache = {
            nextMatch: null,
            next3Matches: [],
            lastFinishedMatch: null,
            matchSummaries: existingMatchSummaries,
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

        // 5. Eski poll verilerini temizle
        console.log('5️⃣ Cleaning up old poll data...');
        const currentMatchId = String(cache.nextMatch?.id);
        const pollsSnapshot = await db.ref('match_polls').once('value');
        const allPolls = pollsSnapshot.val() || {};
        const deleteOps = {};
        for (const pollMatchId of Object.keys(allPolls)) {
            if (pollMatchId !== currentMatchId) {
                deleteOps[`match_polls/${pollMatchId}`] = null;
            }
        }
        if (Object.keys(deleteOps).length > 0) {
            await db.ref().update(deleteOps);
            console.log(`🗑️ Silinen eski poll: ${Object.keys(deleteOps).length}`);
        } else {
            console.log('✅ Temizlenecek eski poll yok');
        }

        // 6. Eski sentNotifications kayıtlarını temizle
        console.log('6️⃣ Cleaning up old notification records...');
        const activeMatchIds = new Set(
            cache.next3Matches.map(m => String(m.id))
        );
        const notifSnapshot = await db.ref('notifications').once('value');
        const allNotifs = notifSnapshot.val() || {};
        const notifDeletes = {};
        for (const [token, data] of Object.entries(allNotifs)) {
            if (data.sentNotifications) {
                for (const matchId of Object.keys(data.sentNotifications)) {
                    if (!activeMatchIds.has(matchId)) {
                        notifDeletes[`notifications/${token}/sentNotifications/${matchId}`] = null;
                    }
                }
            }
            if (data.lastDailyNotification) {
                const today = new Date().toDateString();
                if (data.lastDailyNotification !== today) {
                    notifDeletes[`notifications/${token}/lastDailyNotification`] = null;
                }
            }
        }
        if (Object.keys(notifDeletes).length > 0) {
            await db.ref().update(notifDeletes);
            console.log(`🗑️ Silinen eski notification kayıtları: ${Object.keys(notifDeletes).length}`);
        } else {
            console.log('✅ Temizlenecek eski notification kaydı yok');
        }

    } catch (error) {
        console.error('❌ Daily refresh failed:', error);
    }
});

// ============================================
// LIVE MATCH UPDATER
// ============================================

/**
 * Update Live Match - Her dakika çalışır
 * Maç günü ESPN'den canlı veri çeker, cache/liveMatch'e yazar
 * Maç yoksa veya bitmişse cache'i temizler
 */
exports.updateLiveMatch = onSchedule("every 1 minutes", async (event) => {
    try {
        // 1. Cache'den maç verisini oku
        const cacheSnapshot = await db.ref('cache').once('value');
        const cache = cacheSnapshot.val();

        if (!cache || !cache.nextMatch) {
            return;
        }

        const nextMatch = cache.nextMatch;
        const matchTime = nextMatch.startTimestamp * 1000;
        const now = Date.now();

        // Maç saatine 30dk'dan fazla varsa çalışma
        const thirtyMinBefore = matchTime - (30 * 60 * 1000);
        // Maç başlangıcından 3 saat sonrasına kadar kontrol et (uzatmalar dahil)
        const threeHoursAfter = matchTime + (3 * 60 * 60 * 1000);

        if (now < thirtyMinBefore || now > threeHoursAfter) {
            // Maç penceresi dışında — liveMatch varsa temizle
            const liveSnapshot = await db.ref('cache/liveMatch').once('value');
            if (liveSnapshot.val()) {
                await db.ref('cache/liveMatch').remove();
                console.log('🗑️ Live match cache cleaned (outside match window)');
            }
            return;
        }

        console.log('⚽ Checking live match from ESPN...');

        // 2. ESPN'den Fenerbahçe maçını ara (Süper Lig + Europa League)
        const nowDate = new Date();
        const formatEspnDate = (date) => date.toISOString().split('T')[0].replace(/-/g, '');
        const dateCandidates = [
            formatEspnDate(nowDate),
            formatEspnDate(new Date(nowDate.getTime() - 24 * 60 * 60 * 1000))
        ];
        const leagues = ['tur.1', 'uefa.europa'];
        let fenerbahceMatch = null;
        let matchLeague = null;

        outer:
        for (const dateStr of dateCandidates) {
            for (const league of leagues) {
                try {
                    const scoreboardUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${dateStr}`;
                    const response = await fetch(scoreboardUrl);
                    if (!response.ok) continue;

                    const data = await response.json();
                    const match = data.events?.find(event => {
                        const competitors = event.competitions?.[0]?.competitors || [];
                        return competitors.some(team =>
                            team.team.displayName.toLowerCase().includes('fenerbahce') ||
                            team.team.displayName.toLowerCase().includes('fenerbahçe')
                        );
                    });

                    if (match) {
                        fenerbahceMatch = match;
                        matchLeague = league;
                        break outer;
                    }
                } catch (err) {
                    console.error(`ESPN ${league} (${dateStr}) error:`, err.message);
                }
            }
        }

        if (!fenerbahceMatch) {
            // Maç bulunamadığında liveMatch'i temizle; handleLiveMatch lastFinishedMatch'e düşsün.
            // Böylece biten maç sonrası kart "pre" ile ezilmez.
            await db.ref('cache/liveMatch').remove();
            console.log('ℹ️ No Fenerbahçe match found on ESPN today, liveMatch cache cleared');
            return;
        }

        // 3. Maç durumunu belirle
        const matchState = fenerbahceMatch.status?.type?.state; // 'pre' | 'in' | 'post'
        const competition = fenerbahceMatch.competitions?.[0];
        const homeTeam = competition?.competitors?.find(c => c.homeAway === 'home');
        const awayTeam = competition?.competitors?.find(c => c.homeAway === 'away');
        const homeTeamId = String(homeTeam?.team?.id || '');
        const awayTeamId = String(awayTeam?.team?.id || '');
        const rawDetails = competition?.details || [];
        const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${matchLeague}/summary?event=${fenerbahceMatch.id}`;
        let summaryGoalAssistLookup = new Map();

        const buildScoreboardEvent = (detail, index) => {
            const clock = detail.clock?.displayValue || '';
            const playerName = detail.athletesInvolved?.[0]?.displayName || '';
            const assistKey = `${clock}|${String(playerName).toLowerCase()}`;
            const fallbackAssist = summaryGoalAssistLookup.get(assistKey) || '';
            const assistCandidate = detail.athletesInvolved?.[1]?.displayName || fallbackAssist;
            const isOwnGoal = Boolean(detail.ownGoal);

            return normalizeEventFlags({
                type: detail.type?.text || '',
                clock,
                clockValue: Number.isFinite(Number(detail.clock?.value)) ? Number(detail.clock.value) : null,
                sourceOrder: index,
                team: detail.team?.id || '',
                isGoal: Boolean(detail.scoringPlay),
                isYellowCard: Boolean(detail.yellowCard),
                isRedCard: Boolean(detail.redCard),
                isPenalty: Boolean(detail.penaltyKick),
                isOwnGoal,
                isSubstitution: false,
                player: playerName,
                playerOut: '',
                assist: !isOwnGoal && assistCandidate && assistCandidate !== playerName ? assistCandidate : ''
            });
        };

        const buildSummarySubstitutionEvent = (item, index) => {
            const participants = Array.isArray(item.participants) ? item.participants : [];
            const playerIn = participants[0]?.athlete?.displayName || '';
            const playerOut = participants[1]?.athlete?.displayName || '';

            return normalizeEventFlags({
                type: item.type?.text || 'Substitution',
                clock: item.clock?.displayValue || '',
                clockValue: Number.isFinite(Number(item.clock?.value)) ? Number(item.clock.value) : null,
                sourceOrder: rawDetails.length + index,
                team: item.team?.id || '',
                isGoal: false,
                isYellowCard: false,
                isRedCard: false,
                isPenalty: false,
                isOwnGoal: false,
                isSubstitution: true,
                player: playerIn || item.shortText?.replace(/\s*Substitution\s*$/i, '') || '',
                playerOut,
                assist: ''
            });
        };

        let summaryKeyEvents = [];
        try {
            const summaryResponse = await fetch(summaryUrl);
            if (summaryResponse.ok) {
                const summaryJson = await summaryResponse.json();
                summaryKeyEvents = Array.isArray(summaryJson?.keyEvents) ? summaryJson.keyEvents : [];
                summaryGoalAssistLookup = new Map(
                    summaryKeyEvents
                        .map(parseSummaryKeyEvent)
                        .filter((event) => event?.isGoal && event.player && event.assist)
                        .map((event) => [
                            `${String(event.clock || '')}|${String(event.player || '').toLowerCase()}`,
                            event.assist
                        ])
                );
            }
        } catch (summaryError) {
            console.warn(`⚠️ ESPN summary keyEvents unavailable for ${fenerbahceMatch.id}:`, summaryError.message);
        }

        const scoreboardEvents = rawDetails.map(buildScoreboardEvent);
        const summarySubstitutionEvents = summaryKeyEvents
            .filter((item) => item?.type?.type === 'substitution')
            .map(buildSummarySubstitutionEvent)
            .filter((event) => event.clock || event.player);

        const buildEventDedupKey = (event) => ([
            String(event.clock || ''),
            String(event.team || ''),
            String(event.type || '').toLowerCase(),
            String(event.player || '').toLowerCase(),
            String(event.playerOut || '').toLowerCase(),
            String(event.assist || '').toLowerCase(),
            event.isGoal ? 'goal' : '',
            event.isYellowCard ? 'yellow' : '',
            event.isRedCard ? 'red' : '',
            event.isPenalty ? 'penalty' : '',
            event.isSubstitution ? 'sub' : ''
        ].join('|'));

        const events = [...scoreboardEvents, ...summarySubstitutionEvents]
            .map((event) => normalizeEventFlags(event))
            .sort((a, b) => {
                const aClock = Number.isFinite(a.clockValue) ? a.clockValue : Number.POSITIVE_INFINITY;
                const bClock = Number.isFinite(b.clockValue) ? b.clockValue : Number.POSITIVE_INFINITY;
                if (aClock !== bClock) return aClock - bClock;
                return (a.sourceOrder || 0) - (b.sourceOrder || 0);
            })
            .filter((event, idx, arr) => {
                const key = buildEventDedupKey(event);
                return idx === arr.findIndex((candidate) => buildEventDedupKey(candidate) === key);
            });

        const homeStatistics = homeTeam?.statistics || [];
        const awayStatistics = awayTeam?.statistics || [];
        const homeStatMap = new Map(homeStatistics.map(stat => [stat.name, stat.displayValue]));
        const awayStatMap = new Map(awayStatistics.map(stat => [stat.name, stat.displayValue]));
        const statNames = Array.from(new Set([
            ...homeStatistics.map(stat => stat.name),
            ...awayStatistics.map(stat => stat.name)
        ]));

        const stats = statNames.map((name) => ({
            name,
            homeValue: homeStatMap.get(name) || '0',
            awayValue: awayStatMap.get(name) || '0'
        }));

        const countCards = (teamId, cardType) => rawDetails.filter((detail) => {
            const detailTeamId = String(detail.team?.id || '');
            if (detailTeamId !== teamId) return false;
            return cardType === 'yellow'
                ? Boolean(detail.yellowCard)
                : Boolean(detail.redCard);
        }).length;

        const upsertStat = (name, homeValue, awayValue) => {
            const existingIndex = stats.findIndex((stat) => stat.name === name);
            const payload = {
                name,
                homeValue: String(homeValue),
                awayValue: String(awayValue)
            };

            if (existingIndex >= 0) {
                stats[existingIndex] = payload;
            } else {
                stats.push(payload);
            }
        };

        upsertStat('yellowCards', countCards(homeTeamId, 'yellow'), countCards(awayTeamId, 'yellow'));
        upsertStat('redCards', countCards(homeTeamId, 'red'), countCards(awayTeamId, 'red'));

        // Temel veriyi hazırla
        const liveData = {
            matchState: matchState,
            matchId: fenerbahceMatch.id,
            league: matchLeague,
            displayClock: fenerbahceMatch.status?.displayClock || '',
            period: fenerbahceMatch.status?.period || 0,
            statusDetail: fenerbahceMatch.status?.type?.detail || '',
            homeTeam: {
                id: homeTeam?.team?.id,
                name: homeTeam?.team?.displayName,
                logo: homeTeam?.team?.logo,
                score: homeTeam?.score || '0'
            },
            awayTeam: {
                id: awayTeam?.team?.id,
                name: awayTeam?.team?.displayName,
                logo: awayTeam?.team?.logo,
                score: awayTeam?.score || '0'
            },
            events,
            stats,
            lastUpdated: now
        };

        // 4. Cache'e yaz
        await db.ref('cache/liveMatch').set(liveData);
        if (matchState === 'post') {
            await db.ref('cache/lastFinishedMatch').set({
                ...liveData,
                archivedAt: now
            });

            const summaryRef = db.ref(`cache/matchSummaries/${String(liveData.matchId)}`);
            const summarySnapshot = await summaryRef.once('value');
            if (!summarySnapshot.val()) {
                const summaryPayload = buildSummaryPayloadFromLiveData(liveData, now, 'live-post-final');
                await summaryRef.set(summaryPayload);
                console.log(`🧾 Match summary stored for fixture: ${liveData.matchId}`);
            }
        }
        console.log(`✅ Live match updated: ${liveData.homeTeam.name} ${liveData.homeTeam.score} - ${liveData.awayTeam.score} ${liveData.awayTeam.name} [${matchState}]`);

        // 5. Maç bittiyse, 5 dk sonra temizlenmesi için işaretle
        if (matchState === 'post') {
            const postTime = liveData.postMarkedAt || now;
            if (!liveData.postMarkedAt) {
                await db.ref('cache/liveMatch/postMarkedAt').set(now);
            } else if (now - postTime > 5 * 60 * 1000) {
                // 5 dk geçtiyse temizle
                await db.ref('cache/liveMatch').remove();
                console.log('🗑️ Live match cache cleaned (5 min after post)');
            }
        }

    } catch (error) {
        console.error('❌ Live match update failed:', error);
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

        const pendingNotifications = [];

        // 3. Her kullanıcı için kontrol
        // Daily check SADECE sabah 09:00-09:02 İstanbul saatinde çalışsın
        const istanbulNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
        const istanbulHour = istanbulNow.getHours();
        const istanbulMinute = istanbulNow.getMinutes();
        const isDailyCheckTime = istanbulHour === 9 && istanbulMinute <= 2; // 09:00-09:02 arası

        for (const [playerId, playerData] of Object.entries(allNotifications)) {
            // Daily check - SADECE sabah 09:00-09:02 arasında
            if (playerData.dailyCheck && isDailyCheckTime) {
                const todayStr = formatDateKey(now);
                const nextMatch = nextMatches[0];
                const matchDate = new Date(nextMatch.startTimestamp * 1000);
                const matchDayStr = formatDateKey(matchDate.getTime());

                if (matchDayStr === todayStr) {
                    const lastDaily = playerData.lastDailyNotification;
                    if (!lastDaily || lastDaily !== todayStr) {
                        const isHome = nextMatch.homeTeam.id === FENERBAHCE_ID;
                        const opponent = isHome ? nextMatch.awayTeam.name : nextMatch.homeTeam.name;
                        const timeString = matchDate.toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Europe/Istanbul'
                        });

                        pendingNotifications.push({
                            playerId,
                            message: {
                                token: playerId,
                                notification: {
                                    title: '📅 Bugün Maç Var!',
                                    body: `💛💙 Fenerbahçe - ${opponent} | ${timeString}`
                                },
                                webpush: {
                                    fcmOptions: { link: 'https://omerkalay.com/fenerbahce-fan-hub/' }
                                }
                            },
                            successUpdates: {
                                [`notifications/${playerId}/lastDailyNotification`]: todayStr
                            }
                        });
                    }
                }
            }

            // Global default options - TÜM maçlara uygulanır
            if (!playerData.defaultOptions) continue;

            const defaultOpts = playerData.defaultOptions;
            const sentNotificationsMap = playerData.sentNotifications || {};

            // Her upcoming maç için kontrol et
            for (const match of nextMatches) {
                const matchId = String(match.id);
                const matchTime = match.startTimestamp * 1000;
                const sentForMatch = sentNotificationsMap[matchId] || [];

                for (const [optionKey, config] of Object.entries(MATCH_CONFIG)) {
                    if (!defaultOpts[optionKey]) continue;
                    if (sentForMatch.includes(optionKey)) continue;

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

                        // Gönderilen bildirimleri takip et (yeni yapı)
                        const sentPath = `notifications/${playerId}/sentNotifications/${matchId}`;
                        pendingNotifications.push({
                            playerId,
                            message: {
                                token: playerId,
                                notification: {
                                    title: `💛💙 Fenerbahçe - ${opponent}`,
                                    body: `${timeString} · ${config.timeText}`
                                },
                                data: {
                                    matchId: matchId,
                                    type: optionKey
                                },
                                webpush: {
                                    fcmOptions: { link: 'https://omerkalay.com/fenerbahce-fan-hub/' }
                                }
                            },
                            successUpdates: {
                                [sentPath]: [...sentForMatch, optionKey]
                            }
                        });
                    }
                }
            }
        }

        // 4. Bildirimleri gönder
        const updates = {};
        const invalidTokenDeletes = {};

        if (pendingNotifications.length > 0) {
            console.log(`🚀 Sending ${pendingNotifications.length} notifications...`);
            const results = await Promise.allSettled(
                pendingNotifications.map(item => admin.messaging().send(item.message))
            );
            const success = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            console.log(`✅ Sent: ${success}, ❌ Failed: ${failed}`);

            results.forEach((result, index) => {
                const item = pendingNotifications[index];
                if (result.status === 'fulfilled') {
                    Object.assign(updates, item.successUpdates);
                    return;
                }

                const errorCode = result.reason?.code || result.reason?.errorInfo?.code;
                if (errorCode === 'messaging/registration-token-not-registered' || errorCode === 'messaging/invalid-registration-token') {
                    invalidTokenDeletes[`notifications/${item.playerId}`] = null;
                    console.log(`🧹 Removing invalid token: ${item.playerId.slice(0, 10)}...`);
                }
            });
        }

        // 5. Database güncelle
        for (const deletePath of Object.keys(invalidTokenDeletes)) {
            for (const updatePath of Object.keys(updates)) {
                if (updatePath === deletePath || updatePath.startsWith(`${deletePath}/`)) {
                    delete updates[updatePath];
                }
            }
        }

        const dbUpdates = { ...updates, ...invalidTokenDeletes };
        if (Object.keys(dbUpdates).length > 0) {
            await db.ref().update(dbUpdates);
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

            case 'match-summary':
            case 'matchSummary':
                return await handleMatchSummary(req, res, param);

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
                        '/match-summary/:matchId',
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
    // Live match - Realtime Database cache'den oku
    // updateLiveMatch scheduled function ESPN'den çeker ve buraya yazar
    try {
        const liveSnapshot = await db.ref('cache/liveMatch').once('value');
        const liveData = liveSnapshot.val();
        if (liveData) {
            return res.json(liveData);
        }

        const lastFinishedSnapshot = await db.ref('cache/lastFinishedMatch').once('value');
        const lastFinished = lastFinishedSnapshot.val();
        if (lastFinished) {
            return res.json(lastFinished);
        }

        return res.json({ matchState: 'no-match' });
    } catch (error) {
        console.error('Live match error:', error);
        return res.status(500).json({ error: 'Failed to fetch live match' });
    }
}

async function handleMatchSummary(req, res, matchId) {
    if (!matchId) {
        return res.status(400).json({ error: 'Match ID required' });
    }

    const normalizedMatchId = String(matchId);

    try {
        const snapshot = await db.ref(`cache/matchSummaries/${normalizedMatchId}`).once('value');
        const cachedSummary = snapshot.val();
        if (cachedSummary) {
            return res.json(cachedSummary);
        }

        const fetchedSummary = await fetchEspnSummaryForMatch(normalizedMatchId);
        if (!fetchedSummary) {
            return res.status(404).json({ error: 'Match summary not found' });
        }

        await db.ref(`cache/matchSummaries/${normalizedMatchId}`).set(fetchedSummary);
        return res.json(fetchedSummary);
    } catch (error) {
        console.error('Match summary error:', error);
        return res.status(500).json({ error: 'Failed to fetch match summary' });
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

        // Update global default options (tüm maçlara uygulanır)
        currentData.defaultOptions = {
            threeHours: options.threeHours || false,
            oneHour: options.oneHour || false,
            thirtyMinutes: options.thirtyMinutes || false,
            fifteenMinutes: options.fifteenMinutes || false,
            updatedAt: Date.now()
        };

        // Eski matches verisini temizle (artık kullanılmıyor)
        if (currentData.matches) {
            delete currentData.matches;
        }

        await playerRef.set(currentData);

        const activeCount = Object.values(currentData.defaultOptions)
            .filter(v => v === true).length;

        return res.json({
            success: true,
            message: 'Preferences saved',
            dailyCheckActive: currentData.dailyCheck,
            activeNotifications: activeCount
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
        const existingSummariesSnapshot = await db.ref('cache/matchSummaries').once('value');
        const existingMatchSummaries = existingSummariesSnapshot.val() || {};

        const cache = {
            nextMatch: null,
            next3Matches: [],
            lastFinishedMatch: null,
            matchSummaries: existingMatchSummaries,
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
