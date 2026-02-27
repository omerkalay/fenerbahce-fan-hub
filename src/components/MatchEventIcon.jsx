import React from 'react';

export const getEventVisualType = (event = {}) => {
    if (event.isGoal) return 'goal';
    if (event.isSubstitution) return 'substitution';
    if (event.isRedCard) return 'red-card';
    if (event.isYellowCard) return 'yellow-card';
    return 'neutral';
};

const GoalBallIcon = ({ className = 'w-4 h-4' }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="#eab308" strokeWidth="1.6" />
        <path d="M12 8l2.8 2-1.1 3.1h-3.4L9.2 10 12 8Z" stroke="#eab308" strokeWidth="1.3" fill="#eab308" fillOpacity="0.14" />
        <path d="M12 8V6.2M9.2 10 7.4 9.1M14.8 10 16.6 9.1M10.3 13.1 8.9 14.9M13.7 13.1 15.1 14.9" stroke="#eab308" strokeWidth="1.2" />
    </svg>
);

const MatchEventIcon = ({ event, className = 'w-4 h-4' }) => {
    const eventType = getEventVisualType(event);

    if (eventType === 'goal') {
        return <GoalBallIcon className={className} />;
    }

    if (eventType === 'substitution') {
        return (
            <svg viewBox="0 0 16 16" className={className} fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 5h9" />
                <path d="m8 2 3 3-3 3" />
                <path d="M14 11H5" />
                <path d="m8 8-3 3 3 3" />
            </svg>
        );
    }

    if (eventType === 'yellow-card') {
        return (
            <svg viewBox="0 0 12 16" className={className} aria-hidden="true">
                <rect x="1" y="1" width="10" height="14" rx="1.5" fill="#eab308" />
            </svg>
        );
    }

    if (eventType === 'red-card') {
        return (
            <svg viewBox="0 0 12 16" className={className} aria-hidden="true">
                <rect x="1" y="1" width="10" height="14" rx="1.5" fill="#ef4444" />
            </svg>
        );
    }

    return null;
};

export default MatchEventIcon;
