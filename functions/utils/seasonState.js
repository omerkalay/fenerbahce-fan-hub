const getSeasonStartYear = (referenceDate = new Date()) => {
    const year = referenceDate.getUTCFullYear();
    const month = referenceDate.getUTCMonth();
    return month >= 6 ? year : year - 1;
};

const formatSeasonLabel = (seasonStartYear) =>
    `${seasonStartYear}/${String(seasonStartYear + 1).slice(-2)}`;

const isOffseasonWindow = (referenceDate = new Date()) => {
    const month = referenceDate.getUTCMonth();
    const day = referenceDate.getUTCDate();
    return (month === 4 && day >= 15) || month === 5 || month === 6;
};

const resolveSeasonState = ({
    nextMatches = [],
    matchFetchOk = false,
    referenceDate = new Date()
} = {}) => {
    if (Array.isArray(nextMatches) && nextMatches.length > 0) {
        return 'active';
    }

    if (!matchFetchOk) {
        return 'unknown';
    }

    return isOffseasonWindow(referenceDate) ? 'offseason' : 'unknown';
};

const resolveLegacySeasonState = ({
    nextMatch = null,
    nextMatches = [],
    referenceDate = new Date()
} = {}) => {
    if (nextMatch || (Array.isArray(nextMatches) && nextMatches.length > 0)) {
        return 'active';
    }

    return isOffseasonWindow(referenceDate) ? 'offseason' : 'unknown';
};

const buildSeasonMeta = (referenceDate = new Date()) => {
    const startYear = getSeasonStartYear(referenceDate);
    return {
        startYear,
        label: formatSeasonLabel(startYear)
    };
};

module.exports = {
    getSeasonStartYear,
    formatSeasonLabel,
    isOffseasonWindow,
    resolveSeasonState,
    resolveLegacySeasonState,
    buildSeasonMeta
};
