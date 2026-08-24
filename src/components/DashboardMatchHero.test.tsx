// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MatchData } from '../types';
import DashboardMatchHero from './DashboardMatchHero';

vi.mock('./TeamLogo', () => ({ default: ({ name }: { name?: string }) => <span>{name} logo</span> }));
vi.mock('./MatchCountdown', () => ({ default: () => <div>Countdown</div> }));
vi.mock('./LiveMatchTimeline', () => ({ default: () => <div>Timeline</div> }));

const matchData = {
    id: 1,
    startTimestamp: Math.floor(Date.now() / 1000) + 86_400,
    homeTeam: { id: 3052, name: 'Fenerbahçe', shortName: 'Fenerbahçe' },
    awayTeam: { id: 167, name: 'Olympique Lyonnais', shortName: 'Lyon' },
    tournament: { name: 'UEFA Champions League' },
    roundInfo: { name: 'Playoffs' },
    status: { description: 'Not started', type: 'notstarted' },
} as MatchData;

const renderHero = (useModernUpcomingLayout?: boolean) => render(
    <DashboardMatchHero
        matchData={matchData}
        liveMatchState="countdown"
        liveMatchData={null}
        onCountdownEnd={vi.fn()}
        onOpenDetails={vi.fn()}
        {...(useModernUpcomingLayout === undefined ? {} : { useModernUpcomingLayout })}
    />
);

describe('DashboardMatchHero upcoming layout', () => {
    it('uses the modern countdown layout by default', () => {
        renderHero();

        expect(screen.getByRole('region')).toHaveClass('live-match-hero');
        expect(screen.getByRole('region')).toHaveClass('glass-panel');
        expect(screen.getByText('Countdown')).toBeInTheDocument();
    });

    it('keeps the legacy countdown layout available only when explicitly disabled', () => {
        renderHero(false);

        expect(screen.getByRole('region')).toHaveClass('glass-card');
        expect(screen.getByRole('region')).not.toHaveClass('live-match-hero');
    });
});
