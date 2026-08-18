const ESPN_COMPETITIONS = Object.freeze([
    { slug: 'tur.1', group: 'superlig', label: 'Süper Lig' },
    { slug: 'uefa.champions_qual', group: 'europe', label: 'UEFA Şampiyonlar Ligi Elemeleri' },
    { slug: 'uefa.champions', group: 'europe', label: 'UEFA Şampiyonlar Ligi' },
    { slug: 'uefa.europa_qual', group: 'europe', label: 'UEFA Avrupa Ligi Elemeleri' },
    { slug: 'uefa.europa', group: 'europe', label: 'UEFA Avrupa Ligi' },
    { slug: 'uefa.europa.conf_qual', group: 'europe', label: 'UEFA Konferans Ligi Elemeleri' },
    { slug: 'uefa.europa.conf', group: 'europe', label: 'UEFA Konferans Ligi' }
]);

const ESPN_LEAGUES = Object.freeze(ESPN_COMPETITIONS.map(({ slug }) => slug));

const getEspnLeaguesForMatch = (match) => {
    const tournamentName = String(
        match?.tournament?.uniqueTournament?.name
        || match?.tournament?.name
        || ''
    ).toLowerCase();

    if (/champions|şampiyonlar/.test(tournamentName)) {
        return ['uefa.champions_qual', 'uefa.champions'];
    }
    if (/conference|konferans/.test(tournamentName)) {
        return ['uefa.europa.conf_qual', 'uefa.europa.conf'];
    }
    if (/europa|avrupa/.test(tournamentName)) {
        return ['uefa.europa_qual', 'uefa.europa'];
    }
    if (/super lig|süper lig/.test(tournamentName)) {
        return ['tur.1'];
    }

    return ESPN_LEAGUES;
};

module.exports = { ESPN_COMPETITIONS, ESPN_LEAGUES, getEspnLeaguesForMatch };
