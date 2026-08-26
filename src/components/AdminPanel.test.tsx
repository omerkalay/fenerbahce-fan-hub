// @vitest-environment happy-dom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPanel from './AdminPanel';
import type { FormationDraft, MatchData, PublishedMatchLineups } from '../types';

const mocks = vi.hoisted(() => ({
    fetchAdminSession: vi.fn(),
    fetchAdminOverview: vi.fn(),
    fetchAdminLineup: vi.fn(),
    fetchAdminPlayerStatus: vi.fn(),
    updateAdminSettings: vi.fn(),
    updateAdminDataSource: vi.fn(),
    refreshAdminDataCache: vi.fn(),
    saveAdminPlayerStatusDraft: vi.fn(),
    publishAdminPlayerStatus: vi.fn(),
    saveAdminLineupDraft: vi.fn(),
    publishAdminLineup: vi.fn(),
    releaseAdminLineup: vi.fn(),
    unpublishAdminLineup: vi.fn(),
    sendAdminNotificationTest: vi.fn(),
    sendAdminNotificationBroadcast: vi.fn()
}));

vi.mock('../services/admin', () => mocks);
vi.mock('../services/api', () => ({ fetchSquad: vi.fn().mockResolvedValue([]), fetchPlayerStatus: vi.fn().mockResolvedValue([]) }));
vi.mock('./FormationBuilder', () => ({ default: () => <div>Formation builder</div> }));
vi.mock('./MatchLineups', () => ({ default: () => <div>Lineup preview</div> }));

const matches: MatchData[] = [{
    id: 12345,
    startTimestamp: 1_800_000_000,
    homeTeam: { id: 1, name: 'Fenerbahçe' },
    awayTeam: { id: 2, name: 'Opponent' },
    tournament: { name: 'Test League' }
}];

const publishedLineup: PublishedMatchLineups = {
    matchId: '12345',
    homeTeam: { id: 1, name: 'Fenerbahçe' },
    awayTeam: { id: 2, name: 'Opponent' },
    lineups: {
        home: {
            teamId: '1',
            teamName: 'Fenerbahçe',
            formation: '4-2-3-1',
            formationSource: 'manual',
            starters: [{ name: 'Goalkeeper', jersey: '1', position: 'Goalkeeper' }],
            bench: [],
            substitutions: []
        },
        away: null
    },
    sources: { home: 'manual', away: null },
    publishedAt: 1_800_000_000_000,
    updatedAt: 1_800_000_000_000
};

const manualDraft: FormationDraft = {
    formation: '4-2-3-1',
    players: ['GK', 'LB', 'CB1', 'CB2', 'RB', 'CDM1', 'CDM2', 'LAM', 'CAM', 'RAM', 'ST']
        .map((slot, index) => ({
            slot,
            id: index + 1,
            name: `Player ${index + 1}`,
            position: index === 0 ? 'Goalkeeper' : 'Midfielder',
            number: index + 1
        }))
};

describe('AdminPanel notices', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.fetchAdminSession.mockResolvedValue({ success: true, uid: 'admin-user', admin: true });
        mocks.fetchAdminOverview.mockResolvedValue({
            version: '2.15.0',
            settings: { autoPublishLineups: false, autoPushLineups: false },
            topicSync: { pending: 0, cleanupPending: 0 },
            health: {},
            dataSources: { modes: { fixtures: 'espn', standings: 'espn', statistics: 'espn' }, seasonStartYear: 2026, snapshots: {} }
        });
        mocks.fetchAdminLineup.mockResolvedValue({
            detection: null,
            published: null,
            draft: null,
            settings: { autoPublishLineups: false, autoPushLineups: false },
            manualLocked: false,
            notification: null
        });
        mocks.updateAdminSettings.mockImplementation(async (settings) => ({ success: true, settings }));
        mocks.updateAdminDataSource.mockResolvedValue({
            success: true,
            modes: { fixtures: 'cache', standings: 'espn', statistics: 'espn' }
        });
        mocks.refreshAdminDataCache.mockResolvedValue({ success: true, results: [] });
        mocks.saveAdminLineupDraft.mockResolvedValue({ success: true, draft: manualDraft });
        mocks.publishAdminLineup.mockResolvedValue({ success: true, published: publishedLineup });
        mocks.unpublishAdminLineup.mockResolvedValue({ success: true, published: null, manualLocked: true });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('dismisses a success notice after ten seconds and clears it when closed', async () => {
        const { rerender } = render(<AdminPanel visible matches={matches} onClose={vi.fn()} />);
        await screen.findByText('Canlı sürüm');
        fireEvent.click(screen.getByRole('button', { name: 'İlk 11' }));
        const autoPublishCheckbox = screen.getByRole('checkbox', { name: 'ESPN kadrosunu otomatik yayınla' });
        await waitFor(() => expect(autoPublishCheckbox).not.toBeDisabled());

        const nativeSetTimeout = window.setTimeout.bind(window);
        let dismissNotice: (() => void) | null = null;
        const timeoutSpy = vi.spyOn(window, 'setTimeout').mockImplementation((handler, timeout, ...args) => {
            if (timeout === 10_000 && typeof handler === 'function') {
                dismissNotice = () => handler();
            }
            return nativeSetTimeout(handler, timeout, ...args);
        });

        fireEvent.click(autoPublishCheckbox);
        expect(await screen.findByText('Otomasyon ayarları güncellendi.')).toBeInTheDocument();
        await waitFor(() => expect(dismissNotice).not.toBeNull());
        act(() => { dismissNotice?.(); });
        expect(screen.queryByText('Otomasyon ayarları güncellendi.')).not.toBeInTheDocument();

        fireEvent.click(autoPublishCheckbox);
        expect(await screen.findByText('Otomasyon ayarları güncellendi.')).toBeInTheDocument();

        rerender(<AdminPanel visible={false} matches={matches} onClose={vi.fn()} />);
        rerender(<AdminPanel visible matches={matches} onClose={vi.fn()} />);
        expect(screen.queryByText('Otomasyon ayarları güncellendi.')).not.toBeInTheDocument();
        timeoutSpy.mockRestore();
    });

    it('locks background scrolling while the panel is open and restores it on close', async () => {
        document.documentElement.style.overflow = 'auto';
        document.body.style.overflow = 'visible';
        const { rerender } = render(<AdminPanel visible matches={matches} onClose={vi.fn()} />);

        expect(document.documentElement.style.overflow).toBe('hidden');
        expect(document.body.style.overflow).toBe('hidden');
        expect(document.body.style.position).toBe('fixed');

        rerender(<AdminPanel visible={false} matches={matches} onClose={vi.fn()} />);
        expect(document.documentElement.style.overflow).toBe('auto');
        expect(document.body.style.overflow).toBe('visible');
        expect(document.body.style.position).toBe('');

        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
    });

    it('refreshes a selected cache from the system tab', async () => {
        render(<AdminPanel visible matches={matches} onClose={vi.fn()} />);

        expect(await screen.findByText('ESPN / Cache Kontrolü')).toBeInTheDocument();
        expect(screen.getByText('2.17.0')).toBeInTheDocument();
        fireEvent.click(screen.getAllByRole('button', { name: 'Cache’i şimdi yenile' })[0]);

        await waitFor(() => expect(mocks.refreshAdminDataCache).toHaveBeenCalledWith('fixtures', 2026));
        expect(await screen.findByText('Fikstür cache’i yenilendi.')).toBeInTheDocument();
    });

    it('shows either the published lineup or the manual editor, never both pitches', async () => {
        mocks.fetchAdminLineup.mockResolvedValue({
            detection: null,
            published: publishedLineup,
            draft: null,
            settings: { autoPublishLineups: false, autoPushLineups: false },
            manualLocked: true,
            notification: null
        });
        render(<AdminPanel visible matches={matches} onClose={vi.fn()} />);

        await screen.findByText('Canlı sürüm');
        fireEvent.click(screen.getByRole('button', { name: 'İlk 11' }));

        expect(await screen.findByText('Yayınlanan İlk 11')).toBeInTheDocument();
        expect(screen.getByText('Lineup preview')).toBeInTheDocument();
        expect(screen.queryByText('Formation builder')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Yayınlanan İlk 11’i Kaldır' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Manuel düzenle' }));
        expect(screen.getByText('Formation builder')).toBeInTheDocument();
        expect(screen.queryByText('Lineup preview')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Yayınlanan kadroya dön' }));
        expect(screen.getByText('Lineup preview')).toBeInTheDocument();
        expect(screen.queryByText('Formation builder')).not.toBeInTheDocument();
    });

    it('confirms and removes a published lineup while keeping the editor available', async () => {
        mocks.fetchAdminLineup
            .mockResolvedValueOnce({
                detection: null,
                published: publishedLineup,
                draft: null,
                settings: { autoPublishLineups: false, autoPushLineups: false },
                manualLocked: true,
                notification: null
            })
            .mockResolvedValue({
                detection: null,
                published: null,
                draft: null,
                settings: { autoPublishLineups: false, autoPushLineups: false },
                manualLocked: true,
                notification: null
            });
        const confirmSpy = vi.fn().mockReturnValue(true);
        vi.stubGlobal('confirm', confirmSpy);
        render(<AdminPanel visible matches={matches} onClose={vi.fn()} />);

        await screen.findByText('Canlı sürüm');
        fireEvent.click(screen.getByRole('button', { name: 'İlk 11' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Yayınlanan İlk 11’i Kaldır' }));

        await waitFor(() => expect(mocks.unpublishAdminLineup).toHaveBeenCalledWith('12345'));
        expect(await screen.findByText(/Yayınlanan İlk 11 kaldırıldı/)).toBeInTheDocument();
        expect(screen.getByText('Formation builder')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Yayınlanan İlk 11’i Kaldır' })).not.toBeInTheDocument();
        expect(confirmSpy).toHaveBeenCalledTimes(1);
    });

    it('saves the current editor draft before manually publishing it', async () => {
        mocks.fetchAdminLineup.mockResolvedValue({
            detection: null,
            published: null,
            draft: manualDraft,
            settings: { autoPublishLineups: false, autoPushLineups: false },
            manualLocked: true,
            notification: null
        });
        render(<AdminPanel visible matches={matches} onClose={vi.fn()} />);

        await screen.findByText('Canlı sürüm');
        fireEvent.click(screen.getByRole('button', { name: 'İlk 11' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Manuel yayınla' }));

        await waitFor(() => expect(mocks.publishAdminLineup).toHaveBeenCalledWith('12345', 'manual'));
        expect(mocks.saveAdminLineupDraft).toHaveBeenCalledWith('12345', manualDraft);
        expect(mocks.saveAdminLineupDraft.mock.invocationCallOrder[0])
            .toBeLessThan(mocks.publishAdminLineup.mock.invocationCallOrder[0]);
    });
});
