const { ESPN_LEAGUES, SUMMARY_STAT_GROUPS } = require('../config');

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
        lineups: liveData.lineups || null,
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

const parseSubstitutionEvents = (keyEvents = []) =>
    keyEvents
        .filter((item) => {
            const rawType = String(item?.type?.type || '').toLowerCase();
            const rawText = String(item?.type?.text || item?.text || item?.shortText || '');
            return rawType === 'substitution' || /substitution/i.test(rawText);
        })
        .map((item) => {
            const participants = Array.isArray(item?.participants) ? item.participants : [];
            const playerIn = participants[0]?.athlete?.displayName || '';
            const playerOut = participants[1]?.athlete?.displayName || '';
            const teamId = String(item?.team?.id || participants[0]?.team?.id || '');
            return {
                minute: item?.clock?.displayValue || '',
                playerIn,
                playerOut,
                team: teamId
            };
        })
        .filter((sub) => sub.playerIn || sub.playerOut);

const classifyPosition = (positionStr = '') => {
    const p = positionStr.toLowerCase();
    if (p.includes('goalkeeper') || p.includes('kaleci') || p === 'gk') return 'GK';
    if (p.includes('defender') || p.includes('back') || p === 'def' || p === 'd') return 'DEF';
    if (p.includes('midfielder') || p.includes('midfield') || p === 'mid' || p === 'm') return 'MID';
    if (p.includes('forward') || p.includes('striker') || p.includes('wing') || p === 'fwd' || p === 'f') return 'FWD';
    return 'MID'; // safe fallback
};

const normalizeFormation = (raw) => {
    if (!raw) return null;
    if (typeof raw === 'string') return raw.trim() || null;
    // ESPN sometimes returns formation as an object with a text/formation field
    if (typeof raw === 'object') {
        const candidate = raw.formation || raw.formationName || raw.text || raw.displayName || raw.name || '';
        return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
    }
    return null;
};

const parseTeamRosterEntry = (rosterEntry, teamId, formation, substitutionEvents) => {
    const roster = Array.isArray(rosterEntry?.roster) ? rosterEntry.roster : [];
    if (roster.length === 0) return null;

    const teamName = rosterEntry?.team?.displayName || '';

    const starters = roster
        .filter((entry) => entry?.starter)
        .map((entry, idx) => ({
            name: entry?.athlete?.displayName || '',
            jersey: String(entry?.athlete?.jersey || ''),
            position: entry?.position?.displayName || entry?.position?.name || '',
            positionGroup: classifyPosition(entry?.position?.displayName || entry?.position?.name || ''),
            order: idx
        }))
        .filter((p) => p.name);

    const bench = roster
        .filter((entry) => !entry?.starter)
        .map((entry) => ({
            name: entry?.athlete?.displayName || '',
            jersey: String(entry?.athlete?.jersey || ''),
            position: entry?.position?.displayName || entry?.position?.name || ''
        }))
        .filter((p) => p.name);

    const teamSubs = substitutionEvents.filter((sub) => sub.team === teamId);

    if (starters.length === 0) return null;

    return { teamId, teamName, formation: normalizeFormation(formation), starters, bench, substitutions: teamSubs };
};

// Fallback: build roster-like entries from boxscore.players arrays
const buildRosterFromBoxscorePlayers = (summaryJson, homeTeamId, awayTeamId) => {
    const bsPlayers = Array.isArray(summaryJson?.boxscore?.players) ? summaryJson.boxscore.players : [];
    if (bsPlayers.length === 0) return [];

    return bsPlayers.map((teamBlock) => {
        const teamId = String(teamBlock?.team?.id || '');
        const teamName = teamBlock?.team?.displayName || '';
        const statistics = Array.isArray(teamBlock?.statistics) ? teamBlock.statistics : [];
        // Flatten all athlete entries across stat categories
        const athleteSet = new Map();
        for (const statGroup of statistics) {
            const athletes = Array.isArray(statGroup?.athletes) ? statGroup.athletes : [];
            for (const entry of athletes) {
                const id = entry?.athlete?.id;
                if (id && !athleteSet.has(id)) {
                    athleteSet.set(id, {
                        athlete: entry.athlete,
                        starter: Boolean(entry.starter),
                        position: entry.position || entry.athlete?.position || null
                    });
                }
            }
        }
        return {
            team: { id: teamId, displayName: teamName },
            roster: Array.from(athleteSet.values())
        };
    });
};

const extractLineupsFromSummary = (summaryJson, homeTeamId, awayTeamId, keyEvents = []) => {
    const formArray = Array.isArray(summaryJson?.boxscore?.form) ? summaryJson.boxscore.form : [];
    const substitutionEvents = parseSubstitutionEvents(keyEvents);

    // ── Source 1: summaryJson.rosters (primary, most complete) ──
    let rosters = Array.isArray(summaryJson?.rosters) ? summaryJson.rosters : [];

    // ── Source 2: boxscore.players fallback ──
    if (rosters.length === 0) {
        rosters = buildRosterFromBoxscorePlayers(summaryJson, homeTeamId, awayTeamId);
    }

    if (rosters.length === 0) return null;

    const findRoster = (targetId, fallbackIdx) =>
        rosters.find((r) => String(r?.team?.id || '') === String(targetId)) || rosters[fallbackIdx] || null;

    const homeRoster = findRoster(homeTeamId, 0);
    const awayRoster = findRoster(awayTeamId, 1);

    const homeFormIdx = homeRoster === rosters[0] ? 0 : 1;
    const awayFormIdx = awayRoster === rosters[1] ? 1 : 0;

    const home = homeRoster
        ? parseTeamRosterEntry(homeRoster, String(homeTeamId), formArray[homeFormIdx] || null, substitutionEvents)
        : null;
    const away = awayRoster
        ? parseTeamRosterEntry(awayRoster, String(awayTeamId), formArray[awayFormIdx] || null, substitutionEvents)
        : null;

    if (!home && !away) return null;

    return { home, away };
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

    const lineups = extractLineupsFromSummary(
        summaryJson,
        homeTeamId,
        awayTeamId,
        summaryJson?.keyEvents || []
    );

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
        lineups: lineups || null,
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

module.exports = {
    normalizeEventFlags,
    normalizeSummaryEvents,
    pickOrderedSummaryStats,
    buildSummaryPayloadFromLiveData,
    buildSummaryPayloadFromEspnSummary,
    extractLineupsFromSummary,
    parseSummaryKeyEvent,
    fetchEspnSummaryForMatch
};
