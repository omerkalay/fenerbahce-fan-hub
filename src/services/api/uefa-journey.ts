import type { UefaJourneyPayload, UefaJourneySummary } from '../../types';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { BACKEND_URL } from './base';

const UEFA_REQUEST_TIMEOUT_MS = 30_000;

const fetchUefaEndpoint = async <T>(url: string): Promise<T | null> => {
    try {
        const response = await fetchWithTimeout(url, undefined, UEFA_REQUEST_TIMEOUT_MS);
        if (!response.ok) throw new Error(`UEFA journey fetch failed: ${response.status}`);
        return await response.json() as T;
    } catch (error) {
        console.error('Error fetching UEFA journey:', error);
        return null;
    }
};

export const fetchUefaJourneySummary = async (
    seasonStartYear: number
): Promise<UefaJourneySummary | null> => (
    fetchUefaEndpoint<UefaJourneySummary>(
        `${BACKEND_URL}/uefa-journey?seasonStartYear=${seasonStartYear}&summary=true`
    )
);

export const fetchUefaJourney = async (
    seasonStartYear: number
): Promise<UefaJourneyPayload | null> => {
    const payload = await fetchUefaEndpoint<UefaJourneyPayload>(
        `${BACKEND_URL}/uefa-journey?seasonStartYear=${seasonStartYear}`
    );
    if (!payload?.participation || typeof payload.participation.state !== 'string') return null;

    const fenerPath = Array.isArray(payload.fenerPath)
        ? payload.fenerPath.map((stage) => ({
            ...stage,
            matches: Array.isArray(stage?.matches) ? stage.matches : [],
            aggregate: stage?.aggregate && typeof stage.aggregate === 'object'
                ? stage.aggregate
                : null
        }))
        : [];
    const bracket = payload.bracket && Array.isArray(payload.bracket.stages)
        ? {
            ...payload.bracket,
            stages: payload.bracket.stages.map((stage) => ({
                ...stage,
                ties: Array.isArray(stage?.ties)
                    ? stage.ties.map((tie) => ({
                        ...tie,
                        teams: Array.isArray(tie?.teams) ? tie.teams : [],
                        legs: Array.isArray(tie?.legs) ? tie.legs : [],
                        aggregate: tie?.aggregate && typeof tie.aggregate === 'object'
                            ? tie.aggregate
                            : null
                    }))
                    : []
            }))
        }
        : null;

    return {
        ...payload,
        stale: Boolean(payload.stale),
        standings: payload.standings && Array.isArray(payload.standings.rows)
            ? payload.standings
            : null,
        fenerPath,
        bracket
    };
};
