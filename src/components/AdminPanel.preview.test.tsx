// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const adminMocks = vi.hoisted(() => ({
    fetchAdminSession: vi.fn(),
    fetchAdminOverview: vi.fn(),
    fetchAdminLineup: vi.fn(),
    fetchAdminPlayerStatus: vi.fn(),
    updateAdminSettings: vi.fn(),
    updateAdminDataSource: vi.fn(),
    refreshAdminDataCache: vi.fn(),
    saveAdminLineupDraft: vi.fn(),
    publishAdminLineup: vi.fn(),
    releaseAdminLineup: vi.fn(),
    unpublishAdminLineup: vi.fn(),
    saveAdminPlayerStatusDraft: vi.fn(),
    publishAdminPlayerStatus: vi.fn(),
    sendAdminNotificationTest: vi.fn(),
    sendAdminNotificationBroadcast: vi.fn()
}));
const apiMocks = vi.hoisted(() => ({
    fetchSquad: vi.fn(),
    fetchPlayerStatus: vi.fn()
}));

vi.mock('../services/admin', () => adminMocks);
vi.mock('../services/api', () => apiMocks);
vi.mock('./FormationBuilder', () => ({ default: () => <div>Formation builder</div> }));
vi.mock('./MatchLineups', () => ({ default: () => <div>Lineup preview</div> }));

describe('AdminPanel development player status preview', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/fenerbahce-fan-hub/?adminStatusPreview=1');
        adminMocks.fetchAdminSession.mockResolvedValue({ authenticated: true, admin: true, uid: 'admin-user' });
        adminMocks.fetchAdminOverview.mockResolvedValue({
            version: '2.15.0',
            settings: { autoPublishLineups: false, autoPushLineups: false },
            topicSync: { pending: 0, cleanupPending: 0 },
            health: {}
        });
        adminMocks.fetchAdminLineup.mockResolvedValue({
            detection: null,
            published: null,
            draft: null,
            settings: { autoPublishLineups: false, autoPushLineups: false },
            manualLocked: false,
            notification: null
        });
        apiMocks.fetchSquad.mockResolvedValue([{ id: 10, name: 'Preview Player', position: 'Forward' }]);
        apiMocks.fetchPlayerStatus.mockResolvedValue([{
            playerId: '10',
            source: 'squad',
            name: 'Preview Player',
            status: 'injured',
            detail: 'Old detail',
            returnDate: '',
            updatedAt: Date.now()
        }]);
    });

    afterEach(() => {
        vi.clearAllMocks();
        window.history.replaceState({}, '', '/');
    });

    it('reads live public data but keeps draft changes away from admin write endpoints', async () => {
        const { default: AdminPanel } = await import('./AdminPanel');
        render(<AdminPanel visible matches={[{
            id: 12345,
            startTimestamp: 1_800_000_000,
            homeTeam: { id: 1, name: 'Fenerbahçe' },
            awayTeam: { id: 2, name: 'Opponent' },
            tournament: { name: 'Test League' }
        }]} onClose={vi.fn()} />);

        expect(await screen.findByText('Yerel önizleme — Firebase’e yazılmaz')).toBeInTheDocument();
        expect(adminMocks.fetchAdminSession).not.toHaveBeenCalled();
        expect(adminMocks.fetchAdminOverview).not.toHaveBeenCalled();
        expect(apiMocks.fetchPlayerStatus).toHaveBeenCalledTimes(1);
        expect(apiMocks.fetchSquad).toHaveBeenCalledTimes(1);
        expect(adminMocks.fetchAdminPlayerStatus).not.toHaveBeenCalled();

        await screen.findAllByText('Preview Player');
        fireEvent.click(screen.getAllByText('Preview Player')[0].closest('button')!);
        fireEvent.change(screen.getByLabelText('Açıklama (istersen düzenle)'), { target: { value: 'Local edit' } });
        fireEvent.click(screen.getByRole('button', { name: 'Taslağa ekle' }));
        fireEvent.click(screen.getByRole('button', { name: 'Taslağı kaydet' }));
        await screen.findByText('Yerel taslak güncellendi; Firebase’e yazılmadı.');
        await waitFor(() => expect(adminMocks.saveAdminPlayerStatusDraft).not.toHaveBeenCalled());
        expect(adminMocks.publishAdminPlayerStatus).not.toHaveBeenCalled();
    });
});
