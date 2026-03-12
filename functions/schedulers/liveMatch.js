const { onSchedule } = require("firebase-functions/v2/scheduler");
const { db } = require('../config');
const { normalizeEventFlags, parseSummaryKeyEvent, extractLineupsFromSummary, buildSummaryPayloadFromLiveData } = require('../services/espn');

/**
 * Update Live Match - Her dakika çalışır
 * Maç günü ESPN'den canlı veri çeker, cache/liveMatch'e yazar
 * Maç yoksa veya bitmişse cache'i temizler
 */
const updateLiveMatch = onSchedule("every 1 minutes", async (_event) => {
    try {
        const nextMatchSnapshot = await db.ref('cache/nextMatch').once('value');
        const nextMatch = nextMatchSnapshot.val();

        if (!nextMatch) {
            return;
        }

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
        let summaryLineups = null;
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
                summaryLineups = extractLineupsFromSummary(summaryJson, homeTeamId, awayTeamId, summaryKeyEvents);
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
            lineups: summaryLineups || null,
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

        if (matchState === 'post') {
            const markedSnapshot = await db.ref('cache/liveMatch/postMarkedAt').once('value');
            const existingMark = markedSnapshot.val();

            if (!existingMark) {
                await db.ref('cache/liveMatch/postMarkedAt').set(now);
            } else if (now - existingMark > 5 * 60 * 1000) {
                await db.ref('cache/liveMatch').remove();
                console.log('🗑️ Live match cache cleaned (5 min after post)');
            }
        }

    } catch (error) {
        console.error('❌ Live match update failed:', error);
    }
});

module.exports = { updateLiveMatch };
