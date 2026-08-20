const FENERBAHCE_ESPN_ID = '436';

const UEFA_COMPETITIONS = Object.freeze([
    {
        key: 'champions',
        name: 'UEFA Şampiyonlar Ligi',
        shortName: 'Şampiyonlar Ligi',
        mainSlug: 'uefa.champions',
        qualifierSlug: 'uefa.champions_qual',
        qualifierName: 'UEFA Şampiyonlar Ligi Elemeleri'
    },
    {
        key: 'europa',
        name: 'UEFA Avrupa Ligi',
        shortName: 'Avrupa Ligi',
        mainSlug: 'uefa.europa',
        qualifierSlug: 'uefa.europa_qual',
        qualifierName: 'UEFA Avrupa Ligi Elemeleri'
    },
    {
        key: 'conference',
        name: 'UEFA Konferans Ligi',
        shortName: 'Konferans Ligi',
        mainSlug: 'uefa.europa.conf',
        qualifierSlug: 'uefa.europa.conf_qual',
        qualifierName: 'UEFA Konferans Ligi Elemeleri'
    }
]);

const STAGES = Object.freeze([
    { key: 'qualifying-first-round', label: '1. Eleme Turu', order: 10 },
    { key: 'qualifying-second-round', label: '2. Eleme Turu', order: 20 },
    { key: 'qualifying-third-round', label: '3. Eleme Turu', order: 30 },
    { key: 'qualifying-playoff', label: 'Eleme Play-off Turu', order: 40 },
    { key: 'qualifying', label: 'Elemeler', order: 45 },
    { key: 'league-phase', label: 'Lig Aşaması', order: 50 },
    { key: 'knockout-playoff', label: 'Eleme Play-off’u', order: 60 },
    { key: 'round-of-16', label: 'Son 16', order: 70 },
    { key: 'quarterfinals', label: 'Çeyrek Final', order: 80 },
    { key: 'semifinals', label: 'Yarı Final', order: 90 },
    { key: 'final', label: 'Final', order: 100 }
]);

const MAIN_STAGE_KEYS = Object.freeze([
    'league-phase',
    'knockout-playoff',
    'round-of-16',
    'quarterfinals',
    'semifinals',
    'final'
]);

const KNOCKOUT_STAGE_KEYS = Object.freeze(MAIN_STAGE_KEYS.slice(1));

const normalizeText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .trim();

const getStageDefinition = (stageKey) => (
    STAGES.find((stage) => stage.key === stageKey)
    || { key: stageKey || 'unknown', label: 'Aşama', order: 999 }
);

const normalizeStageKey = (value, { qualifying = false } = {}) => {
    const normalized = normalizeText(value).replace(/[_\s]+/g, '-');

    if (/knockout.*playoff|knockout-round-playoffs?/.test(normalized)) return 'knockout-playoff';
    if (/league-phase|league-stage/.test(normalized)) return 'league-phase';
    if (/round-of-16|last-16|round-16/.test(normalized)) return 'round-of-16';
    if (/quarter/.test(normalized)) return 'quarterfinals';
    if (/semi/.test(normalized)) return 'semifinals';
    if (/final/.test(normalized) && !/semi|quarter/.test(normalized)) return 'final';

    if (qualifying) {
        if (/playoff|play-off/.test(normalized)) return 'qualifying-playoff';
        if (/third|3rd|3-round|round-3/.test(normalized)) return 'qualifying-third-round';
        if (/second|2nd|2-round|round-2/.test(normalized)) return 'qualifying-second-round';
        if (/first|1st|1-round|round-1/.test(normalized)) return 'qualifying-first-round';
        return 'qualifying';
    }

    return normalized || 'unknown';
};

const readScore = (competitor) => {
    const rawScore = competitor?.score;
    if (rawScore == null) return null;
    if (typeof rawScore === 'string' || typeof rawScore === 'number') return String(rawScore);
    if (rawScore.displayValue != null) return String(rawScore.displayValue);
    if (rawScore.value != null) return String(rawScore.value);
    return null;
};

const readOptionalNumber = (value) => {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const normalizeCompetitor = (competitor = {}) => ({
    id: String(competitor?.team?.id || competitor?.id || ''),
    name: competitor?.team?.displayName || competitor?.team?.name || 'Takım',
    shortName: competitor?.team?.shortDisplayName
        || competitor?.team?.displayName
        || competitor?.team?.name
        || 'Takım',
    abbreviation: competitor?.team?.abbreviation || null,
    logo: competitor?.team?.logos?.[0]?.href || null,
    score: readScore(competitor),
    aggregateScore: readOptionalNumber(competitor?.score?.aggregateScore),
    shootoutScore: readOptionalNumber(
        competitor?.shootoutScore
        ?? competitor?.score?.shootoutScore
        ?? competitor?.score?.penaltyScore
    ),
    winner: Boolean(competitor?.winner || competitor?.score?.winner)
});

const normalizeEspnEvent = (event, competition) => {
    const rawCompetition = event?.competitions?.[0];
    const rawCompetitors = Array.isArray(rawCompetition?.competitors)
        ? rawCompetition.competitors
        : [];
    const homeRaw = rawCompetitors.find((item) => item?.homeAway === 'home') || rawCompetitors[0];
    const awayRaw = rawCompetitors.find((item) => item?.homeAway === 'away') || rawCompetitors[1];

    if (!rawCompetition || !homeRaw || !awayRaw) return null;

    const rawStage = event?.seasonType?.name
        || event?.season?.slug
        || event?.season?.type?.name
        || rawCompetition?.type?.text
        || '';
    const stageKey = normalizeStageKey(rawStage, { qualifying: Boolean(competition?.qualifying) });
    const statusType = rawCompetition?.status?.type || {};
    const notes = (Array.isArray(rawCompetition?.notes) ? rawCompetition.notes : [])
        .map((note) => note?.headline || note?.text || '')
        .filter(Boolean);

    return {
        id: String(event?.id || rawCompetition?.id || ''),
        date: event?.date || rawCompetition?.date || null,
        seasonYear: readOptionalNumber(event?.season?.year),
        competitionKey: competition?.key || null,
        competitionName: competition?.name || null,
        competitionSlug: competition?.slug || null,
        qualifying: Boolean(competition?.qualifying),
        stageKey,
        stageLabel: getStageDefinition(stageKey).label,
        status: {
            state: statusType?.state || 'pre',
            completed: Boolean(statusType?.completed),
            detail: statusType?.detail || statusType?.shortDetail || null
        },
        homeTeam: normalizeCompetitor(homeRaw),
        awayTeam: normalizeCompetitor(awayRaw),
        notes
    };
};

const parseStandings = (data, competition) => {
    const children = Array.isArray(data?.children) ? data.children : [];
    const group = children.find((child) => normalizeText(child?.name).includes('league phase'))
        || children[0];
    const entries = Array.isArray(group?.standings?.entries) ? group.standings.entries : [];

    const rows = entries.map((entry) => {
        const stats = Array.isArray(entry?.stats) ? entry.stats : [];
        const stat = (name) => stats.find((item) => item?.name === name)?.value || 0;
        return {
            team: {
                id: String(entry?.team?.id || ''),
                name: entry?.team?.displayName || entry?.team?.name || 'Takım',
                logo: entry?.team?.logos?.[0]?.href || ''
            },
            rank: stat('rank'),
            points: stat('points'),
            matches: stat('gamesPlayed'),
            wins: stat('wins'),
            draws: stat('ties'),
            losses: stat('losses'),
            goalsFor: stat('pointsFor'),
            goalsAgainst: stat('pointsAgainst'),
            goalDiff: stat('pointDifferential')
        };
    });

    return {
        id: competition?.key || null,
        name: competition?.name || group?.name || 'UEFA',
        rows
    };
};

const eventContainsTeam = (event, teamId = FENERBAHCE_ESPN_ID) => (
    String(event?.homeTeam?.id) === String(teamId)
    || String(event?.awayTeam?.id) === String(teamId)
);

const getPairKey = (event) => [event?.homeTeam?.id, event?.awayTeam?.id]
    .map((value) => String(value || ''))
    .sort()
    .join('-');

const getTeamFromEvent = (event, teamId) => {
    if (String(event?.homeTeam?.id) === String(teamId)) return event.homeTeam;
    if (String(event?.awayTeam?.id) === String(teamId)) return event.awayTeam;
    return null;
};

const resolveTieAggregate = (legs, teamIds) => {
    const lastAggregateLeg = [...legs].reverse().find((leg) => (
        teamIds.every((teamId) => getTeamFromEvent(leg, teamId)?.aggregateScore != null)
    ));

    if (lastAggregateLeg) {
        return Object.fromEntries(teamIds.map((teamId) => [
            teamId,
            getTeamFromEvent(lastAggregateLeg, teamId).aggregateScore
        ]));
    }

    const completedLegs = legs.filter((leg) => leg?.status?.completed);
    if (completedLegs.length === 0) return null;

    return Object.fromEntries(teamIds.map((teamId) => {
        const total = completedLegs.reduce((sum, leg) => {
            const score = Number(getTeamFromEvent(leg, teamId)?.score);
            return sum + (Number.isFinite(score) ? score : 0);
        }, 0);
        return [teamId, total];
    }));
};

const resolveTieWinner = (legs, teams, aggregate) => {
    if (!legs.every((leg) => leg?.status?.completed)) return null;

    const teamIds = teams.map((team) => String(team.id));
    if (aggregate) {
        const [firstId, secondId] = teamIds;
        if (aggregate[firstId] > aggregate[secondId]) return firstId;
        if (aggregate[secondId] > aggregate[firstId]) return secondId;
    }

    const lastLeg = legs[legs.length - 1];
    const shootoutWinner = teamIds.find((teamId) => {
        const current = getTeamFromEvent(lastLeg, teamId)?.shootoutScore;
        const opponentId = teamIds.find((id) => id !== teamId);
        const opponent = getTeamFromEvent(lastLeg, opponentId)?.shootoutScore;
        return current != null && opponent != null && current > opponent;
    });
    if (shootoutWinner) return shootoutWinner;

    const normalizedNotes = normalizeText(legs.flatMap((leg) => leg.notes || []).join(' '));
    const notedWinner = teams.find((team) => (
        normalizedNotes.includes(normalizeText(team.name))
        && /advance|advances|qualified|qualifies/.test(normalizedNotes)
    ));
    if (notedWinner) return String(notedWinner.id);

    if (legs.length === 1) {
        const matchWinner = teams.find((team) => getTeamFromEvent(lastLeg, team.id)?.winner);
        if (matchWinner) return String(matchWinner.id);
    }

    return null;
};

const buildTies = (events = []) => {
    const groups = new Map();

    for (const event of events) {
        if (!event || event.stageKey === 'league-phase') continue;
        const competitionIdentity = event.competitionSlug || event.competitionKey || 'uefa';
        const key = `${competitionIdentity}:${event.stageKey}:${getPairKey(event)}`;
        const current = groups.get(key) || [];
        current.push(event);
        groups.set(key, current);
    }

    return Array.from(groups.entries()).map(([id, rawLegs]) => {
        const legs = [...rawLegs].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
        const firstLeg = legs[0];
        const teams = [firstLeg.homeTeam, firstLeg.awayTeam].map((team) => ({
            id: String(team.id),
            name: team.name,
            shortName: team.shortName,
            abbreviation: team.abbreviation,
            logo: team.logo
        }));
        const teamIds = teams.map((team) => team.id);
        const aggregate = resolveTieAggregate(legs, teamIds);
        const winnerTeamId = resolveTieWinner(legs, teams, aggregate);
        const hasLiveLeg = legs.some((leg) => leg?.status?.state === 'in');
        const hasUpcomingLeg = legs.some((leg) => !leg?.status?.completed);

        return {
            id,
            stageKey: firstLeg.stageKey,
            stageLabel: firstLeg.stageLabel,
            teams,
            legs,
            aggregate,
            winnerTeamId,
            status: hasLiveLeg ? 'live' : hasUpcomingLeg ? 'upcoming' : 'completed',
            nextTieId: null
        };
    }).sort((a, b) => {
        const stageDiff = getStageDefinition(a.stageKey).order - getStageDefinition(b.stageKey).order;
        if (stageDiff !== 0) return stageDiff;
        return new Date(a.legs[0]?.date || 0) - new Date(b.legs[0]?.date || 0);
    });
};

const buildBracket = (events = [], competition = null) => {
    const ties = buildTies(events.filter((event) => KNOCKOUT_STAGE_KEYS.includes(event.stageKey)));

    for (const tie of ties) {
        if (!tie.winnerTeamId) continue;
        const currentOrder = getStageDefinition(tie.stageKey).order;
        const nextStage = STAGES.find((stage) => (
            KNOCKOUT_STAGE_KEYS.includes(stage.key) && stage.order > currentOrder
        ));
        if (!nextStage) continue;
        const nextTie = ties.find((candidate) => (
            candidate.stageKey === nextStage.key
            && candidate.teams.some((team) => String(team.id) === String(tie.winnerTeamId))
        ));
        tie.nextTieId = nextTie?.id || null;
    }

    const stages = KNOCKOUT_STAGE_KEYS
        .map((stageKey) => {
            const stageTies = ties.filter((tie) => tie.stageKey === stageKey);
            return stageTies.length > 0
                ? { key: stageKey, label: getStageDefinition(stageKey).label, ties: stageTies }
                : null;
        })
        .filter(Boolean);

    if (stages.length === 0) return null;
    return { competition, stages };
};

const resolveParticipation = ({ events = [], standingsByKey = {}, fetchSucceeded = true, now = Date.now() } = {}) => {
    const mainCandidates = UEFA_COMPETITIONS.filter((competition) => (
        events.some((event) => (
            event.competitionKey === competition.key
            && !event.qualifying
            && eventContainsTeam(event)
        ))
        || (standingsByKey[competition.key]?.rows || []).some((row) => String(row?.team?.id) === FENERBAHCE_ESPN_ID)
    ));
    const mainCompetition = mainCandidates[0] || null;
    const qualifierEvents = events.filter((event) => event.qualifying && eventContainsTeam(event));
    const upcomingQualifiers = qualifierEvents
        .filter((event) => !event?.status?.completed && new Date(event.date || 0).getTime() >= now - 6 * 60 * 60 * 1000)
        .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    const latestQualifiers = [...qualifierEvents].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const qualifierEvent = upcomingQualifiers[0] || latestQualifiers[0] || null;
    const qualifierCompetition = qualifierEvent
        ? UEFA_COMPETITIONS.find((competition) => competition.key === qualifierEvent.competitionKey) || null
        : null;

    if (mainCompetition) {
        const mainEvents = events.filter((event) => (
            event.competitionKey === mainCompetition.key && !event.qualifying && eventContainsTeam(event)
        ));
        const knockoutEvents = mainEvents.filter((event) => KNOCKOUT_STAGE_KEYS.includes(event.stageKey));
        const fenerKnockoutTies = buildTies(knockoutEvents);
        const eliminatedInKnockout = fenerKnockoutTies.some((tie) => (
            tie.status === 'completed'
            && tie.winnerTeamId
            && String(tie.winnerTeamId) !== FENERBAHCE_ESPN_ID
        ));
        const fenerRow = standingsByKey[mainCompetition.key]?.rows?.find((row) => (
            String(row?.team?.id) === FENERBAHCE_ESPN_ID
        ));
        const leagueEvents = mainEvents.filter((event) => event.stageKey === 'league-phase');
        const leagueComplete = leagueEvents.length > 0 && leagueEvents.every((event) => event?.status?.completed);
        const eliminatedInLeague = leagueComplete && Number(fenerRow?.rank) > 24;

        return {
            state: eliminatedInKnockout || eliminatedInLeague
                ? 'eliminated'
                : knockoutEvents.length > 0 ? 'knockout' : 'league_phase',
            competition: mainCompetition,
            qualifier: qualifierCompetition,
            phaseLabel: knockoutEvents.length > 0
                ? getStageDefinition(knockoutEvents[knockoutEvents.length - 1].stageKey).label
                : 'Lig Aşaması'
        };
    }

    if (qualifierEvent) {
        const hasUpcomingQualifier = qualifierEvents.some((event) => !event?.status?.completed);
        return {
            state: hasUpcomingQualifier ? 'qualifying' : 'awaiting_transition',
            competition: null,
            qualifier: qualifierCompetition,
            phaseLabel: qualifierEvent.stageLabel
        };
    }

    return {
        state: fetchSucceeded ? 'not_participating' : 'unknown',
        competition: null,
        qualifier: null,
        phaseLabel: null
    };
};

const getPathStageStatus = ({ stageKey, events, tie, standingsRow, participation }) => {
    if (stageKey === 'league-phase') {
        if (events.some((event) => !event?.status?.completed)) return 'active';
        if (events.length === 0) return participation?.competition ? 'upcoming' : 'awaiting';
        return Number(standingsRow?.rank) > 24 ? 'eliminated' : 'completed';
    }
    if (tie) {
        if (tie.status === 'live' || tie.status === 'upcoming') return 'active';
        if (tie.winnerTeamId && String(tie.winnerTeamId) !== FENERBAHCE_ESPN_ID) return 'eliminated';
        return 'completed';
    }
    return 'locked';
};

const buildFenerPath = ({ events = [], standings = null, participation } = {}) => {
    const fenerEvents = events.filter((event) => eventContainsTeam(event));
    const ties = buildTies(fenerEvents);
    const mainStageKeys = Array.from(new Set(
        fenerEvents
            .filter((event) => !event.qualifying && MAIN_STAGE_KEYS.includes(event.stageKey))
            .map((event) => event.stageKey)
    )).sort((a, b) => getStageDefinition(a).order - getStageDefinition(b).order);
    const standingsRow = standings?.rows?.find((row) => String(row?.team?.id) === FENERBAHCE_ESPN_ID) || null;
    const path = [];

    const qualifierGroups = new Map();
    for (const event of fenerEvents.filter((candidate) => candidate.qualifying)) {
        const groupKey = `${event.competitionKey || 'uefa'}:${event.stageKey}`;
        const group = qualifierGroups.get(groupKey) || [];
        group.push(event);
        qualifierGroups.set(groupKey, group);
    }
    const orderedQualifierGroups = Array.from(qualifierGroups.values()).sort((first, second) => {
        const firstDate = Math.min(...first.map((event) => new Date(event.date || 0).getTime()));
        const secondDate = Math.min(...second.map((event) => new Date(event.date || 0).getTime()));
        return firstDate - secondDate;
    });

    for (const stageEvents of orderedQualifierGroups) {
        const stageKey = stageEvents[0]?.stageKey || 'qualifying';
        const competitionKey = stageEvents[0]?.competitionKey || null;
        const tie = ties.find((candidate) => (
            candidate.stageKey === stageKey
            && candidate.legs[0]?.competitionKey === competitionKey
        )) || null;
        let status = getPathStageStatus({ stageKey, events: stageEvents, tie, standingsRow, participation });
        const activeCompetitionKey = participation?.competition?.key || participation?.qualifier?.key || null;
        if (
            status === 'eliminated'
            && activeCompetitionKey
            && competitionKey !== activeCompetitionKey
        ) {
            status = 'transferred';
        }
        path.push({
            key: stageKey,
            label: getStageDefinition(stageKey).label,
            competitionKey,
            competitionName: stageEvents[0]?.competitionName || null,
            status,
            matches: stageEvents,
            aggregate: tie?.aggregate || null,
            winnerTeamId: tie?.winnerTeamId || null,
            position: null,
            points: null
        });
    }

    let eliminated = false;
    const mainActualOrders = mainStageKeys.map((key) => getStageDefinition(key).order);
    const maxActualOrder = mainActualOrders.length > 0 ? Math.max(...mainActualOrders) : 0;
    const leagueEvents = fenerEvents.filter((event) => (
        !event.qualifying && event.stageKey === 'league-phase'
    ));
    const leagueComplete = leagueEvents.length > 0 && leagueEvents.every((event) => event?.status?.completed);
    const leagueRank = Number(standingsRow?.rank);
    const directToRoundOf16 = leagueComplete && leagueRank >= 1 && leagueRank <= 8;
    const entersKnockoutPlayoff = leagueComplete && leagueRank >= 9 && leagueRank <= 24;

    for (const stageKey of MAIN_STAGE_KEYS) {
        const stageEvents = fenerEvents.filter((event) => event.stageKey === stageKey && !event.qualifying);
        const tie = ties.find((candidate) => candidate.stageKey === stageKey) || null;
        let status = getPathStageStatus({ stageKey, events: stageEvents, tie, standingsRow, participation });

        if (stageEvents.length === 0) {
            if (eliminated || participation?.state === 'eliminated') {
                status = 'locked';
            } else if (stageKey === 'league-phase' && !participation?.competition) {
                status = participation?.state === 'not_participating' ? 'locked' : 'awaiting';
            } else if (stageKey === 'league-phase' && participation?.competition) {
                status = 'upcoming';
            } else if (
                stageKey === 'knockout-playoff'
                && (directToRoundOf16 || maxActualOrder >= getStageDefinition('round-of-16').order)
            ) {
                status = 'bypassed';
            } else if (stageKey === 'knockout-playoff' && entersKnockoutPlayoff) {
                status = 'upcoming';
            } else if (stageKey === 'round-of-16' && directToRoundOf16) {
                status = 'upcoming';
            } else {
                status = 'locked';
            }
        }

        const entry = {
            key: stageKey,
            label: getStageDefinition(stageKey).label,
            competitionKey: participation?.competition?.key || null,
            competitionName: participation?.competition?.name || null,
            status,
            matches: stageEvents,
            aggregate: tie?.aggregate || null,
            winnerTeamId: tie?.winnerTeamId || null,
            position: stageKey === 'league-phase' ? standingsRow?.rank || null : null,
            points: stageKey === 'league-phase' ? standingsRow?.points || null : null
        };
        path.push(entry);
        if (status === 'eliminated') eliminated = true;
    }

    return path;
};

const buildUefaSummary = (payload = {}) => {
    const participation = payload?.participation || {};
    const competition = participation?.competition || null;
    const qualifier = participation?.qualifier || null;

    return {
        source: payload?.source || 'ESPN',
        seasonStartYear: payload?.seasonStartYear || null,
        lastUpdate: payload?.lastUpdate || null,
        stale: Boolean(payload?.stale),
        state: participation?.state || 'unknown',
        title: competition?.shortName || 'Avrupa Yolculuğu',
        competitionKey: competition?.key || null,
        competitionName: competition?.name || null,
        qualifierName: qualifier?.qualifierName || null,
        phaseLabel: participation?.phaseLabel || null
    };
};

module.exports = {
    FENERBAHCE_ESPN_ID,
    UEFA_COMPETITIONS,
    STAGES,
    MAIN_STAGE_KEYS,
    KNOCKOUT_STAGE_KEYS,
    normalizeStageKey,
    getStageDefinition,
    normalizeEspnEvent,
    parseStandings,
    eventContainsTeam,
    buildTies,
    buildBracket,
    resolveParticipation,
    buildFenerPath,
    buildUefaSummary
};
