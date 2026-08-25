import { auth } from '../firebase';
import { BACKEND_URL } from './api/base';
import type {
    AdminLineupSettings,
    CachedSnapshot,
    DataSourceMode,
    DataSourceModes,
    DataSourceResource,
    FormationDraft,
    MatchData,
    PublishedMatchLineups
} from '../types';

export interface AdminOverview {
    version: string;
    lastCacheUpdate: number | null;
    nextMatch: MatchData | null;
    uefaJourney: {
        seasonStartYear: number;
        lastUpdate: number;
        stale: boolean;
        participationState: string;
    } | null;
    health: Record<string, Record<string, unknown>>;
    settings: AdminLineupSettings;
    dataSources: {
        modes: DataSourceModes;
        seasonStartYear: number | null;
        snapshots: Record<string, Partial<Record<DataSourceResource, CachedSnapshot<unknown>>>>;
    };
    topicSync: { pending: number; cleanupPending: number };
    startingLineupPush: {
        status: string | null;
        acceptedAt: number | null;
        failedAt: number | null;
        errorCode: string | null;
    } | null;
}

export interface AdminLineupDetail {
    match: MatchData;
    detection: {
        status: 'observing' | 'ready' | 'idle';
        consecutiveSeen: number;
        firstSeenAt: number | null;
        lastSeenAt: number | null;
        payload: PublishedMatchLineups | null;
    } | null;
    published: PublishedMatchLineups | null;
    draft: FormationDraft | null;
    settings: AdminLineupSettings;
    manualLocked: boolean;
    notification: {
        status: string | null;
        acceptedAt: number | null;
        failedAt: number | null;
        errorCode: string | null;
    } | null;
}

export interface AdminNotificationPayload {
    title: string;
    body: string;
    url: string;
}

export type AdminPlayerStatus = 'injured' | 'suspended' | 'doubtful' | 'card-risk';

export interface AdminPlayerStatusEntry {
    playerId: string;
    source: 'squad' | 'manual';
    name: string;
    status: AdminPlayerStatus;
    detail: string;
    returnDate: string;
    updatedAt?: number;
}

export interface AdminPlayerStatusDraft {
    baseRevision: number;
    entries: AdminPlayerStatusEntry[];
    updatedAt?: number;
}

export interface AdminPlayerStatusState {
    published: AdminPlayerStatusEntry[];
    draft: AdminPlayerStatusDraft | null;
    revision: number;
    lastPublishedAt: number | null;
}

const ADMIN_ERROR_MESSAGES: Record<number, string> = {
    400: 'Gönderilen bilgiler geçersiz.',
    401: 'Yönetici oturumu doğrulanamadı. Tekrar giriş yap.',
    403: 'Bu hesapta yönetici yetkisi yok.',
    404: 'İstenen yönetim kaydı bulunamadı.',
    405: 'Bu işlem desteklenmiyor.',
    409: 'İşlem mevcut durumla çakıştı. Paneli yenileyip tekrar dene.',
    429: 'Çok fazla istek gönderildi. Biraz bekleyip tekrar dene.',
    502: 'Firebase bildirimi kabul etmedi.'
};

const adminRequest = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Yönetici hesabıyla giriş yapmalısın.');
    const idToken = await user.getIdToken();
    const response = await fetch(`${BACKEND_URL}/admin/${path.replace(/^\/+/, '')}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${idToken}`,
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            ...(init.headers || {})
        }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(ADMIN_ERROR_MESSAGES[response.status] || 'Yönetim işlemi tamamlanamadı.');
    }
    return data as T;
};

export const fetchAdminSession = () => adminRequest<{ authenticated: true; admin: true; uid: string }>('session');
export const fetchAdminOverview = () => adminRequest<AdminOverview>('overview');
export const fetchAdminLineup = (matchId: number | string) => adminRequest<AdminLineupDetail>(`lineups/${matchId}`);
export const fetchAdminPlayerStatus = () => adminRequest<AdminPlayerStatusState>('player-status');

export const saveAdminPlayerStatusDraft = (baseRevision: number, entries: AdminPlayerStatusEntry[]) => (
    adminRequest<{ success: true; draft: AdminPlayerStatusDraft }>('player-status/draft', {
        method: 'PUT',
        body: JSON.stringify({
            baseRevision,
            entries: entries.map(({ updatedAt: _updatedAt, ...entry }) => entry)
        })
    })
);

export const publishAdminPlayerStatus = (baseRevision: number) => (
    adminRequest<{ success: true; published: AdminPlayerStatusEntry[]; revision: number; lastPublishedAt: number }>('player-status/publish', {
        method: 'POST',
        body: JSON.stringify({ baseRevision })
    })
);

export const saveAdminLineupDraft = (matchId: number | string, draft: FormationDraft) => (
    adminRequest<{ success: true; draft: FormationDraft }>(`lineups/${matchId}/draft`, {
        method: 'PUT',
        body: JSON.stringify({ formation: draft.formation, players: draft.players })
    })
);

export const publishAdminLineup = (matchId: number | string, mode: 'detected' | 'manual') => (
    adminRequest<{ success: true; published: PublishedMatchLineups }>(`lineups/${matchId}/publish`, {
        method: 'POST',
        body: JSON.stringify({ mode })
    })
);

export const releaseAdminLineup = (matchId: number | string) => (
    adminRequest<{ success: true; manualLocked: false }>(`lineups/${matchId}/release`, {
        method: 'POST',
        body: JSON.stringify({})
    })
);

export const unpublishAdminLineup = (matchId: number | string) => (
    adminRequest<{ success: true; published: null; manualLocked: true }>(`lineups/${matchId}/unpublish`, {
        method: 'POST',
        body: JSON.stringify({})
    })
);

export const updateAdminSettings = (settings: AdminLineupSettings) => (
    adminRequest<{ success: true; settings: AdminLineupSettings }>('settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
    })
);

export const updateAdminDataSource = (resource: DataSourceResource, mode: DataSourceMode) => (
    adminRequest<{ success: true; modes: DataSourceModes }>('data-source', {
        method: 'PUT',
        body: JSON.stringify({ resource, mode })
    })
);

export const refreshAdminDataCache = (
    resource: DataSourceResource | 'all',
    seasonStartYear: number
) => (
    adminRequest<{ success: true; results: Array<Record<string, unknown>> }>('data-refresh', {
        method: 'POST',
        body: JSON.stringify({ resource, seasonStartYear })
    })
);

export const sendAdminNotificationTest = (payload: AdminNotificationPayload) => (
    adminRequest<{ success: true; status: 'accepted'; testId: string; expiresAt: number }>('notifications/test', {
        method: 'POST',
        body: JSON.stringify(payload)
    })
);

export const sendAdminNotificationBroadcast = (payload: AdminNotificationPayload, testId: string) => (
    adminRequest<{ success: true; status: 'accepted' }>('notifications/send', {
        method: 'POST',
        body: JSON.stringify({ ...payload, testId })
    })
);
