import type {
    EspnFixtureMatch,
    EspnFixtureData,
    EspnTeam,
    FixtureCompetitionGroup,
} from '../../types';
import { localizeCompetitionName } from '../../utils/localize';
import { getCurrentSeasonStartYear, isDateInSeason } from '../../utils/seasons';
import { fetchWithSingleRetry, runSessionRequest, settleWithConcurrency } from './request-policy';

const ESPN_FENERBAHCE_TEAM_ID = '436';
const ESPN_SITE_API_ROOT = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

interface EspnFixtureCompetition {
  slug: string;
  group: FixtureCompetitionGroup;
  label: string;
}

export const ESPN_FIXTURE_COMPETITIONS: EspnFixtureCompetition[] = [
    { slug: 'tur.1', group: 'superlig', label: 'Süper Lig' },
    { slug: 'uefa.champions_qual', group: 'europe', label: 'UEFA Şampiyonlar Ligi Elemeleri' },
    { slug: 'uefa.champions', group: 'europe', label: 'UEFA Şampiyonlar Ligi' },
    { slug: 'uefa.europa_qual', group: 'europe', label: 'UEFA Avrupa Ligi Elemeleri' },
    { slug: 'uefa.europa', group: 'europe', label: 'UEFA Avrupa Ligi' },
    { slug: 'uefa.europa.conf_qual', group: 'europe', label: 'UEFA Konferans Ligi Elemeleri' },
    { slug: 'uefa.europa.conf', group: 'europe', label: 'UEFA Konferans Ligi' }
];

const buildEspnTeamScheduleUrl = (leagueSlug: string, params: Record<string, string> = {}): string => {
    const searchParams = new URLSearchParams(params);
    return `${ESPN_SITE_API_ROOT}/${leagueSlug}/teams/${ESPN_FENERBAHCE_TEAM_ID}/schedule?${searchParams.toString()}`;
};

interface EspnScheduleRequest {
  competition: EspnFixtureCompetition;
  kind: 'results' | 'fixtures';
  url: string;
}

interface EspnCompetitorRaw {
  team?: {
    id?: string;
    displayName?: string;
    name?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    logos?: Array<{ href: string }>;
  };
  id?: string;
  homeAway?: string;
  score?: { displayValue?: string; value?: number };
  winner?: boolean;
}

const parseEspnTeam = (competitor: EspnCompetitorRaw | undefined): EspnTeam => ({
    id: competitor?.team?.id ?? competitor?.id ?? null,
    name: competitor?.team?.displayName ?? competitor?.team?.name ?? 'Takım',
    shortName: competitor?.team?.shortDisplayName ?? competitor?.team?.displayName ?? competitor?.team?.name ?? 'Takım',
    abbreviation: competitor?.team?.abbreviation ?? null,
    logo: competitor?.team?.logos?.[0]?.href ?? null,
    score: competitor?.score?.displayValue ?? null,
    winner: Boolean(competitor?.winner)
});

interface EspnEventRaw {
  id?: string;
  date?: string;
  season?: { displayName?: string };
  seasonType?: { name?: string };
  competitions?: Array<{
    id?: string;
    date?: string;
    timeValid?: boolean;
    competitors?: EspnCompetitorRaw[];
    status?: { type?: Record<string, unknown> };
    type?: { text?: string };
    venue?: {
      fullName?: string;
      address?: { city?: string };
    };
  }>;
}

const normalizeEspnMatch = (event: EspnEventRaw, sourceCompetition: EspnFixtureCompetition | null = null): EspnFixtureMatch | null => {
    const competition = event?.competitions?.[0];
    const competitors = competition?.competitors ?? [];
    const homeCompetitor = competitors.find((item) => item.homeAway === 'home');
    const awayCompetitor = competitors.find((item) => item.homeAway === 'away');

    if (!competition || !homeCompetitor || !awayCompetitor) {
        return null;
    }

    const homeTeam = parseEspnTeam(homeCompetitor);
    const awayTeam = parseEspnTeam(awayCompetitor);
    const isFbHome = homeTeam.id === ESPN_FENERBAHCE_TEAM_ID;
    const fbTeam = isFbHome ? homeTeam : awayTeam;
    const opponentTeam = isFbHome ? awayTeam : homeTeam;
    const statusType = (competition?.status?.type ?? {}) as Record<string, unknown>;
    const homeScoreValue = Number(homeCompetitor?.score?.value);
    const awayScoreValue = Number(awayCompetitor?.score?.value);
    const hasNumericScore = Number.isFinite(homeScoreValue) && Number.isFinite(awayScoreValue);

    let resultCode: 'G' | 'M' | 'B' | null = null;
    let resultLabel: string | null = null;
    if (statusType.completed && hasNumericScore) {
        const fbScore = isFbHome ? homeScoreValue : awayScoreValue;
        const opponentScore = isFbHome ? awayScoreValue : homeScoreValue;

        if (fbScore > opponentScore) {
            resultCode = 'G';
            resultLabel = 'Galibiyet';
        } else if (fbScore < opponentScore) {
            resultCode = 'M';
            resultLabel = 'Mağlubiyet';
        } else {
            resultCode = 'B';
            resultLabel = 'Beraberlik';
        }
    }

    return {
        id: String(event.id ?? competition.id ?? `${event.date}-${homeTeam.id}-${awayTeam.id}`),
        source: 'espn',
        summaryAvailable: true,
        date: (event.date ?? competition.date) as string,
        timeValid: competition?.timeValid !== false,
        competitionName: localizeCompetitionName((event?.season?.displayName ?? event?.seasonType?.name ?? 'Süper Lig') as string),
        competitionKey: sourceCompetition?.slug ?? null,
        competitionGroup: sourceCompetition?.group ?? null,
        competitionLabel: sourceCompetition?.label ? localizeCompetitionName(sourceCompetition.label) : null,
        roundLabel: competition?.type?.text ? localizeCompetitionName(competition.type.text as string) : null,
        venueName: (competition?.venue?.fullName as string) ?? null,
        venueCity: (competition?.venue?.address?.city as string) ?? null,
        status: {
            state: (statusType.state as string) ?? 'pre',
            completed: Boolean(statusType.completed),
            description: (statusType.description as string) ?? null,
            detail: (statusType.detail as string) ?? null,
            shortDetail: (statusType.shortDetail as string) ?? null
        },
        homeTeam,
        awayTeam,
        isFbHome,
        fbTeam,
        opponentTeam,
        resultCode,
        resultLabel
    };
};

const loadEspnFenerbahceFixtures = async (seasonStartYear: number): Promise<EspnFixtureData> => {
    try {
        const requests: EspnScheduleRequest[] = ESPN_FIXTURE_COMPETITIONS.flatMap((competition) => [
            {
                competition,
                kind: 'results',
                url: buildEspnTeamScheduleUrl(competition.slug, { season: String(seasonStartYear) })
            },
            {
                competition,
                kind: 'fixtures',
                url: buildEspnTeamScheduleUrl(competition.slug, { season: String(seasonStartYear), fixture: 'true' })
            }
        ]);
        const settled = await settleWithConcurrency(requests, 4, async (request) => {
            const response = await fetchWithSingleRetry(request.url);
            if (!response.ok) throw new Error(`ESPN schedule failed: ${response.status}`);
            return response.json();
        });
        const byCompetition = new Map<string, {
          competition: EspnFixtureCompetition;
          resultsJson: Record<string, unknown>;
          fixturesJson: Record<string, unknown>;
        }>();
        let failedRequestCount = 0;

        settled.forEach((result, index) => {
            const request = requests[index];
            const current = byCompetition.get(request.competition.slug) || {
                competition: request.competition,
                resultsJson: {},
                fixturesJson: {}
            };
            if (result.status === 'fulfilled') {
                if (request.kind === 'results') current.resultsJson = result.value;
                else current.fixturesJson = result.value;
            } else {
                failedRequestCount += 1;
                console.warn(`ESPN ${request.kind} request failed for ${request.competition.slug}:`, result.reason);
            }
            byCompetition.set(request.competition.slug, current);
        });

        const perCompetitionResults = Array.from(byCompetition.values());

        const mergedEvents = perCompetitionResults.flatMap(({ competition, resultsJson, fixturesJson }) => {
            const resultEvents = Array.isArray(resultsJson?.events) ? resultsJson.events : [];
            const fixtureEvents = Array.isArray(fixturesJson?.events) ? fixturesJson.events : [];

            return [...resultEvents, ...fixtureEvents].map((event: EspnEventRaw) => ({
                event,
                sourceCompetition: competition
            }));
        });

        if (mergedEvents.length === 0) {
            throw new Error('ESPN fixture fetch failed');
        }

        const uniqueEvents = Array.from(
            new Map(
                mergedEvents.map(({ event, sourceCompetition }) => [
                    String(event?.id ?? `${sourceCompetition?.slug}-${event?.date}`),
                    { event, sourceCompetition }
                ])
            ).values()
        );

        const matches = uniqueEvents
            .map(({ event, sourceCompetition }) => normalizeEspnMatch(event, sourceCompetition))
            .filter((m): m is EspnFixtureMatch => m !== null)
            .filter((match) => isDateInSeason(match.date, seasonStartYear))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const firstAvailable = perCompetitionResults.find(
            ({ resultsJson, fixturesJson }) =>
                (Array.isArray(resultsJson?.events) && resultsJson.events.length > 0) ||
                (Array.isArray(fixturesJson?.events) && fixturesJson.events.length > 0)
        );

        return {
            source: 'ESPN',
            seasonStartYear,
            season: firstAvailable?.fixturesJson?.season ?? firstAvailable?.resultsJson?.season ?? null,
            team: firstAvailable?.fixturesJson?.team ?? firstAvailable?.resultsJson?.team ?? null,
            matches,
            warning: failedRequestCount > 0
                ? 'Bazı ESPN kulvarları geçici olarak alınamadı; erişilebilen maçlar gösteriliyor.'
                : null
        };
    } catch (error) {
        console.error('Error fetching ESPN Fenerbahce fixtures:', error);
        return {
            source: 'ESPN',
            seasonStartYear,
            season: null,
            team: null,
            matches: [],
            error: true
        };
    }
};

export const fetchEspnFenerbahceFixtures = (
    seasonStartYear = getCurrentSeasonStartYear(),
    options: { force?: boolean } = {}
): Promise<EspnFixtureData> => runSessionRequest(
    `espn-fixtures:${seasonStartYear}`,
    () => loadEspnFenerbahceFixtures(seasonStartYear),
    options.force === true,
    (data) => data.error !== true
);
