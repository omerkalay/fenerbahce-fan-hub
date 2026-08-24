const { onSchedule } = require("firebase-functions/v2/scheduler");
const { db } = require('../config');
const { getEspnLeaguesForMatch } = require('../constants/espnCompetitions');
const { normalizeEventFlags, parseSummaryKeyEvent, extractLineupsFromSummary, buildSummaryPayloadFromLiveData } = require('../services/espn');
const { fetchWithTimeout } = require('../utils/fetchWithTimeout');
const { isSameMatch } = require('../utils/matchIdentity');
const { buildFinalMatchCachePlan, shouldStopFinalPolling } = require('../utils/finalMatchCache');
const { shouldPollLineups } = require('../utils/lineupAutomation');
const { observeEspnLineups, mergePublishedWithLiveLineups } = require('../services/lineupPublishing');

/**
 * Runs every minute. Lineup discovery starts 90 minutes before kickoff,
 * while full live-match polling continues in the final 30 minutes.
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

        const ninetyMinBefore = matchTime - (90 * 60 * 1000);
        const thirtyMinBefore = matchTime - (30 * 60 * 1000);
        const lineupOnly = now < thirtyMinBefore;
        // Keep polling through a possible extra-time window.
        const threeHoursAfter = matchTime + (3 * 60 * 60 * 1000);

        if (now < ninetyMinBefore || now > threeHoursAfter) {
            // Remove only the transient live payload outside the match window.
            const liveSnapshot = await db.ref('cache/liveMatch').once('value');
            if (liveSnapshot.val()) {
                await db.ref('cache/liveMatch').remove();
                console.log('🗑️ Live match cache cleaned (outside match window)');
            }
            return;
        }

        if (lineupOnly && !shouldPollLineups({ matchTime, now })) {
            return;
        }

        let existingFinalMatch = null;
        if (now >= matchTime) {
            const finalSnapshot = await db.ref('cache/lastFinishedMatch').once('value');
            existingFinalMatch = finalSnapshot.val();

            if (shouldStopFinalPolling({
                finalData: existingFinalMatch,
                scheduledMatch: nextMatch,
                now,
                matches: isSameMatch
            })) {
                if (!existingFinalMatch.liveCacheClearedAt) {
                    await Promise.all([
                        db.ref('cache/liveMatch').remove(),
                        db.ref('cache/lastFinishedMatch/liveCacheClearedAt').set(now)
                    ]);
                    console.log('🗑️ Transient live cache cleaned; final match archive preserved');
                }
                return;
            }
        }

        console.log('⚽ Checking ESPN match and lineup data...');
        await db.ref('ops/health/liveMatchScheduler').update({
            lastRunAt: now,
            status: 'running',
            matchId: String(nextMatch.id || '')
        });

        // Find the corresponding Fenerbahçe event across supported ESPN competitions.
        const formatEspnDate = (date) => date.toISOString().split('T')[0].replace(/-/g, '');
        const dateCandidates = Array.from(new Set([-1, 0, 1].map((dayOffset) => (
            formatEspnDate(new Date(matchTime + dayOffset * 24 * 60 * 60 * 1000))
        ))));
        const leagues = getEspnLeaguesForMatch(nextMatch);
        if (leagues.length === 0) {
            const liveSnapshot = await db.ref('cache/liveMatch').once('value');
            if (liveSnapshot.val()) {
                await db.ref('cache/liveMatch').remove();
            }
            await db.ref('ops/health/liveMatchScheduler').update({
                lastRunAt: now,
                completedAt: Date.now(),
                status: 'manual-fallback',
                matchId: String(nextMatch.id || ''),
                lineupsAvailable: false
            });
            console.log('ℹ️ ESPN live lookup skipped for unsupported competition');
            return;
        }
        let fenerbahceMatch = null;
        let matchLeague = null;

        outer:
        for (const dateStr of dateCandidates) {
            for (const league of leagues) {
                try {
                    const scoreboardUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${dateStr}`;
                    const response = await fetchWithTimeout(scoreboardUrl);
                    if (!response.ok) continue;

                    const data = await response.json();
                    const match = data.events?.find(event => {
                        const competitors = event.competitions?.[0]?.competitors || [];
                        const candidateHome = competitors.find((team) => team.homeAway === 'home');
                        const candidateAway = competitors.find((team) => team.homeAway === 'away');
                        const candidateStartTime = new Date(event.date || event.competitions?.[0]?.date).getTime();
                        const candidate = {
                            startTimestamp: candidateStartTime,
                            homeTeam: { name: candidateHome?.team?.displayName },
                            awayTeam: { name: candidateAway?.team?.displayName }
                        };
                        return Number.isFinite(candidateStartTime)
                            && Math.abs(candidateStartTime - matchTime) <= 3 * 60 * 60 * 1000
                            && isSameMatch(candidate, nextMatch);
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
            // Clear only transient live data when the scheduled SofaScore match cannot be verified on ESPN.
            // The durable final-match archive remains available to the client.
            await db.ref('cache/liveMatch').remove();
            await db.ref('ops/health/liveMatchScheduler').update({
                lastRunAt: now,
                completedAt: Date.now(),
                status: 'not-found',
                matchId: String(nextMatch.id || ''),
                lineupsAvailable: false
            });
            console.log('ℹ️ The scheduled match was not verified on ESPN; transient live cache cleared');
            return;
        }

        // Resolve the event state and teams.
        const matchState = fenerbahceMatch.status?.type?.state; // 'pre' | 'in' | 'post'
        const competition = fenerbahceMatch.competitions?.[0];
        const homeTeam = competition?.competitors?.find(c => c.homeAway === 'home');
        const awayTeam = competition?.competitors?.find(c => c.homeAway === 'away');
        const homeTeamId = String(homeTeam?.team?.id || '');
        const awayTeamId = String(awayTeam?.team?.id || '');
        const parsedStartTimestamp = Math.floor(new Date(fenerbahceMatch.date || competition?.date).getTime() / 1000);
        const startTimestamp = Number.isFinite(parsedStartTimestamp)
            ? parsedStartTimestamp
            : nextMatch.startTimestamp;
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
            const summaryResponse = await fetchWithTimeout(summaryUrl);
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

        let lineupObservation = null;
        if (summaryLineups) {
            try {
                lineupObservation = await observeEspnLineups({
                    scheduledMatch: nextMatch,
                    espnEventId: fenerbahceMatch.id,
                    league: matchLeague,
                    matchState,
                    lineups: summaryLineups,
                    homeTeam: {
                        id: homeTeam?.team?.id,
                        name: homeTeam?.team?.displayName,
                        logo: homeTeam?.team?.logo
                    },
                    awayTeam: {
                        id: awayTeam?.team?.id,
                        name: awayTeam?.team?.displayName,
                        logo: awayTeam?.team?.logo
                    },
                    now
                });
            } catch (lineupError) {
                console.error('ESPN lineup observation failed:', lineupError?.code || lineupError?.message || 'unknown');
            }
        }

        if (lineupOnly) {
            await db.ref('ops/health/liveMatchScheduler').update({
                lastRunAt: now,
                completedAt: Date.now(),
                status: 'ok',
                mode: 'lineup-discovery',
                matchId: String(nextMatch.id || ''),
                espnEventId: String(fenerbahceMatch.id || ''),
                lineupsAvailable: Boolean(summaryLineups),
                detectionStatus: lineupObservation?.status || 'incomplete'
            });
            return;
        }

        const publishedLineupSnapshot = await db.ref(`cache/matchLineups/${String(nextMatch.id)}`).once('value');
        const publishedLineup = publishedLineupSnapshot.val();
        const effectiveLineups = mergePublishedWithLiveLineups(publishedLineup?.lineups, summaryLineups);

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

        // Build the shared live payload.
        const liveData = {
            matchState: matchState,
            matchId: fenerbahceMatch.id,
            league: matchLeague,
            startTimestamp,
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
            lineups: effectiveLineups,
            lastUpdated: now
        };

        // Persist transient live data and durable final-match data.
        if (matchState === 'post') {
            const finalPlan = buildFinalMatchCachePlan({
                liveData,
                existingFinal: existingFinalMatch,
                now
            });
            await db.ref('cache/lastFinishedMatch').set(finalPlan.finalPayload);

            if (finalPlan.expired) {
                await db.ref('cache/liveMatch').remove();
            } else {
                await db.ref('cache/liveMatch').set(finalPlan.livePayload);
            }

            const summaryRef = db.ref(`cache/matchSummaries/${String(liveData.matchId)}`);
            const summarySnapshot = await summaryRef.once('value');
            if (!summarySnapshot.val()) {
                const summaryPayload = buildSummaryPayloadFromLiveData(liveData, now, 'live-post-final');
                await summaryRef.set(summaryPayload);
                console.log(`🧾 Match summary stored for fixture: ${liveData.matchId}`);
            }
        } else {
            await db.ref('cache/liveMatch').set(liveData);
        }
        await db.ref('ops/health/liveMatchScheduler').update({
            lastRunAt: now,
            completedAt: Date.now(),
            status: 'ok',
            matchId: String(nextMatch.id || ''),
            espnEventId: String(fenerbahceMatch.id || ''),
            lineupsAvailable: Boolean(effectiveLineups)
        });
        console.log(`✅ Live match updated: ${liveData.homeTeam.name} ${liveData.homeTeam.score} - ${liveData.awayTeam.score} ${liveData.awayTeam.name} [${matchState}]`);

    } catch (error) {
        console.error('❌ Live match update failed:', error);
        await db.ref('ops/health/liveMatchScheduler').update({
            lastRunAt: Date.now(),
            status: 'error',
            errorCode: error?.code || 'live-match/unknown'
        }).catch(() => {});
    }
});

module.exports = { updateLiveMatch };
