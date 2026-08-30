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

const getCardKind = (event = {}) => {
    if (event.isRedCard) return 'red';
    if (event.isYellowCard) return 'yellow';
    return '';
};

const getEspnEventClockValue = (event = {}) => {
    const rawClockValue = event.clockValue;
    const numericClock = Number(rawClockValue);
    if (rawClockValue !== null && rawClockValue !== undefined && rawClockValue !== '' && Number.isFinite(numericClock)) {
        return numericClock;
    }

    const displayClock = String(event.clock || '');
    const parsed = displayClock.match(/(\d+)(?:\D*\+\s*(\d+))?/);
    if (!parsed) return Number.POSITIVE_INFINITY;

    const minute = Number(parsed[1]);
    const addedTime = Number(parsed[2] || 0);
    return Number.isFinite(minute) && Number.isFinite(addedTime)
        ? (minute + addedTime) * 60
        : Number.POSITIVE_INFINITY;
};

const normalizePersonName = (value = '') => String(value || '').trim().toLocaleLowerCase('en-US');

const pickCardActorNameFromSummaryItem = (item = {}) => {
    const participants = Array.isArray(item?.participants) ? item.participants : [];
    const explicitName = participants.find((participant) => participant?.athlete?.displayName)
        ?.athlete?.displayName || item?.athlete?.displayName || '';
    if (explicitName) return String(explicitName).trim();

    const teamName = normalizePersonName(item?.team?.displayName || '');
    const cardSuffix = /\s+(?:(?:second\s+)?yellow|red)\s+card(?:\s+at.*)?$/i;
    const teamAndCardSuffix = /\s+\([^)]*\)\s+(?:(?:second\s+)?yellow|red)\s+card(?:\s+at.*)?$/i;

    for (const candidate of [item?.shortText, item?.text]) {
        const original = String(candidate || '').trim();
        if (!original) continue;

        const name = original.replace(teamAndCardSuffix, '').replace(cardSuffix, '').trim();
        if (name === original || !name || normalizePersonName(name) === teamName) continue;
        return name;
    }

    return '';
};

const mergeEspnCardEvents = (detailEvents = [], summaryEvents = [], maxMinuteDrift = 2) => {
    const merged = detailEvents
        .map((event) => normalizeEventFlags(event))
        .filter((event) => Boolean(getCardKind(event)));
    const detailEventCount = merged.length;
    const matchedDetailIndexes = new Set();

    summaryEvents
        .map((event) => normalizeEventFlags(event))
        .filter((event) => Boolean(getCardKind(event)))
        .forEach((summaryEvent) => {
            const summaryKind = getCardKind(summaryEvent);
            const summaryTeam = String(summaryEvent.team || '');
            const summaryName = normalizePersonName(summaryEvent.player);
            const summaryClock = getEspnEventClockValue(summaryEvent);

            const candidates = merged
                .map((detailEvent, index) => {
                    if (index >= detailEventCount) return null;
                    if (matchedDetailIndexes.has(index)) return null;
                    if (getCardKind(detailEvent) !== summaryKind) return null;
                    if (String(detailEvent.team || '') !== summaryTeam) return null;

                    const detailName = normalizePersonName(detailEvent.player);
                    if (detailName && summaryName && detailName !== summaryName) return null;

                    const detailClock = getEspnEventClockValue(detailEvent);
                    const distance = Math.abs(detailClock - summaryClock);
                    if (!Number.isFinite(distance) || distance > maxMinuteDrift * 60) return null;

                    return { index, distance, detailName };
                })
                .filter(Boolean);

            const exactNameCandidates = summaryName
                ? candidates.filter((candidate) => candidate.detailName === summaryName)
                : [];
            const matchPool = summaryName
                ? (exactNameCandidates.length > 0
                    ? exactNameCandidates
                    : candidates.filter((candidate) => !candidate.detailName))
                : candidates;

            matchPool.sort((a, b) => a.distance - b.distance);
            const closest = matchPool[0];
            const unambiguous = closest
                && (matchPool.length === 1 || closest.distance < matchPool[1].distance);

            if (!unambiguous) {
                merged.push(summaryEvent);
                return;
            }

            const detailEvent = merged[closest.index];
            merged[closest.index] = normalizeEventFlags({
                ...detailEvent,
                player: detailEvent.player || summaryEvent.player || '',
                type: detailEvent.type || summaryEvent.type || '',
                assist: detailEvent.assist || summaryEvent.assist || ''
            });
            matchedDetailIndexes.add(closest.index);
        });

    return merged;
};

const countAttributedCards = (events = [], teamId, cardKind) => events.filter((event) => {
    if (!String(event?.player || '').trim()) return false;
    if (String(event?.team || '') !== String(teamId || '')) return false;
    return cardKind === 'yellow' ? Boolean(event?.isYellowCard) : Boolean(event?.isRedCard);
}).length;

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
    const playerName = isYellowCard || isRedCard
        ? pickCardActorNameFromSummaryItem(item)
        : firstParticipant?.athlete?.displayName || item?.athlete?.displayName || item?.shortText || '';
    const participantTeamId = firstParticipant?.team?.id || '';
    const teamId = String(item?.team?.id || participantTeamId || '');
    const isOwnGoal = Boolean(item?.ownGoal) || /own goal/i.test(rawText);
    const assistName = isGoal && !isOwnGoal
        ? pickAssistNameFromSummaryItem(item, playerName)
        : '';

    return normalizeEventFlags({
        clock: item?.clock?.displayValue || item?.time?.displayValue || '',
        clockValue: Number.isFinite(Number(item?.clock?.value ?? item?.time?.value))
            ? Number(item?.clock?.value ?? item?.time?.value)
            : null,
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
    pickCardActorNameFromSummaryItem,
    normalizeEventFlags,
    normalizeSummaryEvents,
    getEspnEventClockValue,
    mergeEspnCardEvents,
    countAttributedCards,
    pickOrderedSummaryStats,
    parseSummaryKeyEvent
};
