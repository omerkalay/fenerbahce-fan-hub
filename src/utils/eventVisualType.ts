import type { MatchEvent, EventVisualType } from '../types';

export const getEventVisualType = (event: Partial<MatchEvent> = {}): EventVisualType => {
    if (event.isGoal) return 'goal';
    if (event.isSubstitution) return 'substitution';
    if (event.isRedCard) return 'red-card';
    if (event.isYellowCard) return 'yellow-card';
    return 'neutral';
};
