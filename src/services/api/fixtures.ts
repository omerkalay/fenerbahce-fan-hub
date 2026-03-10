import { BACKEND_URL, ensureAbsolutePhoto } from './base';
import type { Player, MatchData, MatchSummaryData } from '../../types';

export const fetchNextMatch = async (): Promise<MatchData | null> => {
    try {
        const response = await fetch(`${BACKEND_URL}/next-match`);
        if (!response.ok) throw new Error('Backend fetch failed');
        return await response.json();
    } catch (error) {
        console.error("Error fetching next match from backend:", error);
        return null;
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

export const fetchNext3Matches = async (): Promise<MatchData[]> => {
    try {
        const response = await fetch(`${BACKEND_URL}/next-3-matches`);
        if (!response.ok) throw new Error('Backend fetch failed');
        return await response.json();
    } catch (error) {
        console.error("Error fetching next 3 matches from backend:", error);
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

export const fetchInjuries = async (): Promise<never[]> => {
    return [];
};
