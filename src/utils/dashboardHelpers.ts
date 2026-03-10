/**
 * Pure helper functions extracted from Dashboard.tsx.
 * All functions are side-effect free and unit-testable.
 */
import { localizePlayerName } from './playerDisplay';
import type { MatchEvent, StartingXIData, StartingXIPlayer } from '../types';

export const isHalftimeDisplay = (statusDetail = '', displayClock = ''): boolean => {
    const status = String(statusDetail || '').trim().toLowerCase();
    const clock = String(displayClock || '').trim().toLowerCase();

    return (
        status === 'ht' ||
        status === 'halftime' ||
        status.includes('half time') ||
        status.includes('devre') ||
        clock === 'ht'
    );
};

export const resolveGoalTeamId = (event: MatchEvent): string => String(event.team || '');

export const formatGoalSummaryText = (event: MatchEvent): string => {
    const parts: string[] = [localizePlayerName(event.player || '') || 'Gol'];

    if (event.isPenalty) parts.push('(P)');
    if (event.isOwnGoal) parts.push('(K.K)');

    return parts.join(' ');
};

export const STARTING_XI_GROUPS: StartingXIPlayer['group'][] = ['GK', 'DEF', 'MID', 'FWD'];

export const normalizeStartingXIPlayer = (value: unknown): StartingXIPlayer | null => {
    if (!value || typeof value !== 'object') return null;

    const entry = value as Record<string, unknown>;
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    const number = typeof entry.number === 'number' ? entry.number : Number(entry.number);
    const group = typeof entry.group === 'string' ? entry.group.trim().toUpperCase() : '';

    if (!name || !Number.isFinite(number) || !STARTING_XI_GROUPS.includes(group as StartingXIPlayer['group'])) {
        return null;
    }

    return {
        name,
        number,
        group: group as StartingXIPlayer['group']
    };
};

export const normalizeStartingXIArray = (value: unknown): StartingXIPlayer[] => {
    const entries = Array.isArray(value)
        ? value
        : value && typeof value === 'object'
            ? Object.values(value as Record<string, unknown>)
            : [];

    return entries
        .map(normalizeStartingXIPlayer)
        .filter((player): player is StartingXIPlayer => player !== null);
};

export const normalizeStartingXIData = (value: unknown): StartingXIData | null => {
    if (!value || typeof value !== 'object') return null;

    const entry = value as Record<string, unknown>;
    const starters = normalizeStartingXIArray(entry.starters);

    if (starters.length === 0) {
        return null;
    }

    const publishedAt = typeof entry.publishedAt === 'number'
        ? entry.publishedAt
        : Number(entry.publishedAt);

    return {
        publishedAt: Number.isFinite(publishedAt) ? publishedAt : Date.now(),
        starters,
        bench: normalizeStartingXIArray(entry.bench)
    };
};
