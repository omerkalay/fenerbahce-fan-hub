export const formatMatchClock = (clockValue = '') => {
    const raw = String(clockValue || '').trim();
    if (!raw) return '';

    const normalized = raw
        .replace(/[’′]/g, "'")
        .replace(/\s+/g, '');

    const stoppage = normalized.match(/^(\d+)'?\+(\d+)'?$/);
    if (stoppage) {
        return `${stoppage[1]}+${stoppage[2]}'`;
    }

    const regular = normalized.match(/^(\d+)'?$/);
    if (regular) {
        return `${regular[1]}'`;
    }

    return normalized;
};
