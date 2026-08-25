/**
 * Pure helper functions extracted from Dashboard.tsx.
 * All functions are side-effect free and unit-testable.
 */
import { localizePlayerName } from './playerDisplay';
import type { MatchEvent } from '../types';

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
