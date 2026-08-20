import type {
    CupFixturePayload,
    FixtureData,
    FixtureMatch,
    FixtureTeam,
    MatchData,
    Team,
} from '../../types';
import { localizeCompetitionName, localizeTeamName } from '../../utils/localize';
import { isDateInSeason } from '../../utils/seasons';
import { BACKEND_URL } from './base';

export const TURKEY_CUP_COVERAGE_START_YEAR = 2026;
const FENERBAHCE_SOFASCORE_TEAM_ID = 3052;

const asScore = (score: MatchData['homeScore']): string | null => {
    const value = score?.display ?? score?.current;
    return value === undefined || value === null ? null : String(value);
};

const parseTeam = (team: Team | undefined, score: MatchData['homeScore'], winner: boolean): FixtureTeam => {
    const id = team?.id === undefined || team?.id === null ? null : String(team.id);
    const name = localizeTeamName(team?.name || 'Takım');

    return {
        id,
        name,
        shortName: localizeTeamName(team?.shortName || team?.name || 'Takım'),
        abbreviation: team?.nameCode || null,
        logo: id ? `${BACKEND_URL}/team-image/${id}` : null,
        score: asScore(score),
        winner
    };
};

const isCompletedStatus = (match: MatchData): boolean => {
    const type = String(match.status?.type || '').toLowerCase();
    const description = String(match.status?.description || '').toLowerCase();
    return match.status?.code === 100
        || type === 'finished'
        || type === 'post'
        || /finished|full time|after extra time|after penalties/.test(description);
};

const getStatusState = (match: MatchData, completed: boolean): string => {
    if (completed) return 'post';
    const type = String(match.status?.type || '').toLowerCase();
    if (/inprogress|in-progress|live/.test(type)) return 'in';
    return 'pre';
};

const getResult = (
    match: MatchData,
    isFbHome: boolean,
    completed: boolean
): Pick<FixtureMatch, 'resultCode' | 'resultLabel'> => {
    if (!completed) return { resultCode: null, resultLabel: null };

    const winnerCode = Number(match.winnerCode);
    if (winnerCode === 3) return { resultCode: 'B', resultLabel: 'Beraberlik' };
    if (winnerCode === 1 || winnerCode === 2) {
        const fbWon = (winnerCode === 1 && isFbHome) || (winnerCode === 2 && !isFbHome);
        return fbWon
            ? { resultCode: 'G', resultLabel: 'Galibiyet' }
            : { resultCode: 'M', resultLabel: 'Mağlubiyet' };
    }

    const homeScore = Number(match.homeScore?.current);
    const awayScore = Number(match.awayScore?.current);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
        return { resultCode: null, resultLabel: null };
    }
    const fbScore = isFbHome ? homeScore : awayScore;
    const opponentScore = isFbHome ? awayScore : homeScore;
    if (fbScore === opponentScore) return { resultCode: 'B', resultLabel: 'Beraberlik' };
    return fbScore > opponentScore
        ? { resultCode: 'G', resultLabel: 'Galibiyet' }
        : { resultCode: 'M', resultLabel: 'Mağlubiyet' };
};

export const normalizeCupFixtureMatch = (match: MatchData): FixtureMatch | null => {
    const startTimestamp = Number(match.startTimestamp);
    if (!match.id || !Number.isFinite(startTimestamp) || !match.homeTeam || !match.awayTeam) return null;

    const isFbHome = Number(match.homeTeam.id) === FENERBAHCE_SOFASCORE_TEAM_ID;
    const isFbAway = Number(match.awayTeam.id) === FENERBAHCE_SOFASCORE_TEAM_ID;
    if (!isFbHome && !isFbAway) return null;
    const homeWinner = Number(match.winnerCode) === 1;
    const awayWinner = Number(match.winnerCode) === 2;
    const homeTeam = parseTeam(match.homeTeam, match.homeScore, homeWinner);
    const awayTeam = parseTeam(match.awayTeam, match.awayScore, awayWinner);
    const fbTeam = isFbHome ? homeTeam : awayTeam;
    const opponentTeam = isFbHome ? awayTeam : homeTeam;
    const completed = isCompletedStatus(match);
    const roundLabel = match.roundInfo?.name
        ? localizeCompetitionName(match.roundInfo.name)
        : Number.isFinite(Number(match.roundInfo?.round))
            ? `${Number(match.roundInfo?.round)}. Tur`
            : null;

    return {
        id: String(match.id),
        source: 'sofascore',
        summaryAvailable: false,
        date: new Date(startTimestamp * 1000).toISOString(),
        timeValid: match.timeValid !== false,
        competitionName: 'Türkiye Kupası',
        competitionKey: 'turkiye-kupasi',
        competitionGroup: 'cup',
        competitionLabel: 'Türkiye Kupası',
        roundLabel,
        venueName: match.venue?.stadium?.name || match.venue?.name || null,
        venueCity: match.venue?.city?.name || null,
        status: {
            state: getStatusState(match, completed),
            completed,
            description: match.status?.description || null,
            detail: match.status?.description || null,
            shortDetail: match.status?.description || null
        },
        homeTeam,
        awayTeam,
        isFbHome,
        fbTeam,
        opponentTeam,
        ...getResult(match, isFbHome, completed)
    };
};

export const fetchCupFixtures = async (seasonStartYear: number): Promise<FixtureData> => {
    if (seasonStartYear < TURKEY_CUP_COVERAGE_START_YEAR) {
        return {
            source: 'SofaScore',
            seasonStartYear,
            season: null,
            team: null,
            matches: []
        };
    }

    try {
        const response = await fetch(`${BACKEND_URL}/cup-fixtures?seasonStartYear=${seasonStartYear}`);
        if (!response.ok) throw new Error('Cup fixture fetch failed');
        const payload: CupFixturePayload = await response.json();
        const matches = (Array.isArray(payload.matches) ? payload.matches : [])
            .map(normalizeCupFixtureMatch)
            .filter((match): match is FixtureMatch => match !== null)
            .filter((match) => isDateInSeason(match.date, seasonStartYear))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return {
            source: 'SofaScore',
            seasonStartYear,
            season: null,
            team: null,
            matches
        };
    } catch (error) {
        console.error('Error fetching Türkiye Kupası fixtures:', error);
        return {
            source: 'SofaScore',
            seasonStartYear,
            season: null,
            team: null,
            matches: [],
            error: true
        };
    }
};
