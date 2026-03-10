/**
 * Pure helper functions extracted from espn.js.
 * Zero side effects, zero imports from ../config.
 * Safe to import in any environment (tests, CI) without Firebase.
 */

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

/**
 * @param {Map} homeStatMap
 * @param {Map} awayStatMap
 * @param {Array<{label: string, keys: string[]}>} statGroups - injected config
 */
const pickOrderedSummaryStats = (homeStatMap, awayStatMap, statGroups) => (
    statGroups
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

module.exports = {
    pickAssistNameFromSummaryItem,
    normalizeEventFlags,
    normalizeSummaryEvents,
    pickOrderedSummaryStats,
    parseSummaryKeyEvent
};
