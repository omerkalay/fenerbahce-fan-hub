import type { FixtureData, FixtureMatch } from '../../types';
import { getCurrentSeasonStartYear } from '../../utils/seasons';
import { fetchCupFixtures } from './cup-fixtures';
import { fetchEspnFenerbahceFixtures } from './espn-fixtures';

export const fetchFenerbahceFixtures = async (
    seasonStartYear = getCurrentSeasonStartYear()
): Promise<FixtureData> => {
    const [espnData, cupData] = await Promise.all([
        fetchEspnFenerbahceFixtures(seasonStartYear),
        fetchCupFixtures(seasonStartYear)
    ]);

    const uniqueMatches = Array.from(
        new Map<string, FixtureMatch>(
            [...espnData.matches, ...cupData.matches].map((match) => [
                `${match.source}:${match.id}`,
                match
            ])
        ).values()
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const espnFailed = Boolean(espnData.error);
    const cupFailed = Boolean(cupData.error);
    const hasUsableData = !espnFailed || (!cupFailed && cupData.matches.length > 0);

    let warning: string | null = null;
    if (cupFailed && !espnFailed) {
        warning = 'Türkiye Kupası verisi şu anda yenilenemedi; lig ve Avrupa maçları gösteriliyor.';
    } else if (espnFailed && cupData.matches.length > 0) {
        warning = 'Lig ve Avrupa verisi şu anda yenilenemedi; Türkiye Kupası maçları gösteriliyor.';
    }

    return {
        source: 'ESPN + SofaScore',
        seasonStartYear,
        season: espnData.season,
        team: espnData.team,
        matches: uniqueMatches,
        error: !hasUsableData,
        warning
    };
};
