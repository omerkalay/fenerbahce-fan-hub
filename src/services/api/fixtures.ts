import { BACKEND_URL, ensureAbsolutePhoto } from './base';
import type { Player, MatchSummaryData, MatchStatusPayload } from '../../types';

const normalizeMatchStatusPayload = (value: Partial<MatchStatusPayload> = {}): MatchStatusPayload => ({
    nextMatch: value.nextMatch ?? null,
    next3Matches: Array.isArray(value.next3Matches) ? value.next3Matches : [],
    seasonState: value.seasonState ?? (value.nextMatch ? 'active' : 'unknown'),
    season: value.season ?? null,
    matchFetchStatus: value.matchFetchStatus ?? null,
    lastUpdate: value.lastUpdate ?? null
});

export const fetchMatchStatus = async (): Promise<MatchStatusPayload> => {
    try {
        const response = await fetch(`${BACKEND_URL}/match-status`);
        if (!response.ok) throw new Error('Backend fetch failed');
        const payload = await response.json();
        return normalizeMatchStatusPayload(payload);
    } catch (error) {
        console.error('Error fetching match status from backend:', error);
        return normalizeMatchStatusPayload();
    }
};

export const fetchSquad = async (): Promise<Player[]> => {
    try {
        const response = await fetch(`${BACKEND_URL}/squad`);
        if (!response.ok) throw new Error('Backend fetch failed');
        const squad: Player[] = await response.json();
        return squad.map(player => ({
            ...player,
            photo: ensureAbsolutePhoto(player)
        }));
    } catch (error) {
        console.error("Error fetching squad from backend:", error);
        return [];
    }
};

export const fetchMatchSummary = async (matchId: string): Promise<MatchSummaryData | null> => {
    if (!matchId) return null;

    try {
        const response = await fetch(`${BACKEND_URL}/match-summary/${matchId}`);
        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error('Match summary fetch failed');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching match summary from backend:', error);
        return null;
    }
};
