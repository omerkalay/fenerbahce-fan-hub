// @vitest-environment happy-dom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPanel from './AdminPanel';
import type { MatchData } from '../types';

const mocks = vi.hoisted(() => ({
    fetchAdminSession: vi.fn(),
    fetchAdminOverview: vi.fn(),
    fetchAdminLineup: vi.fn(),
    updateAdminSettings: vi.fn(),
    saveAdminLineupDraft: vi.fn(),
    publishAdminLineup: vi.fn(),
    releaseAdminLineup: vi.fn(),
    sendAdminNotificationTest: vi.fn(),
    sendAdminNotificationBroadcast: vi.fn()
}));

vi.mock('../services/admin', () => mocks);
vi.mock('./FormationBuilder', () => ({ default: () => <div>Formation builder</div> }));
vi.mock('./MatchLineups', () => ({ default: () => <div>Lineup preview</div> }));

const matches: MatchData[] = [{
    id: 12345,
    startTimestamp: 1_800_000_000,
    homeTeam: { id: 1, name: 'Fenerbahçe' },
    awayTeam: { id: 2, name: 'Opponent' },
    tournament: { name: 'Test League' }
}];

describe('AdminPanel notices', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.fetchAdminSession.mockResolvedValue({ success: true, uid: 'admin-user', admin: true });
        mocks.fetchAdminOverview.mockResolvedValue({
            version: '2.13.1',
            settings: { autoPublishLineups: false, autoPushLineups: false },
            topicSync: { pending: 0, cleanupPending: 0 },
            health: {}
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
    });

    afterEach(() => {
        vi.useRealTimers();
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
        act(() => { dismissNotice?.(); });
        expect(screen.queryByText('Otomasyon ayarları güncellendi.')).not.toBeInTheDocument();

        fireEvent.click(autoPublishCheckbox);
        expect(await screen.findByText('Otomasyon ayarları güncellendi.')).toBeInTheDocument();

        rerender(<AdminPanel visible={false} matches={matches} onClose={vi.fn()} />);
        rerender(<AdminPanel visible matches={matches} onClose={vi.fn()} />);
        expect(screen.queryByText('Otomasyon ayarları güncellendi.')).not.toBeInTheDocument();
        timeoutSpy.mockRestore();
    });
});
