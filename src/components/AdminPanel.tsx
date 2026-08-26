import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FormationBuilder from './FormationBuilder';
import MatchLineups from './MatchLineups';
import AdminPlayerStatusManager from './admin/AdminPlayerStatusManager';
import {
    fetchAdminLineup,
    fetchAdminOverview,
    fetchAdminPlayerStatus,
    fetchAdminSession,
    publishAdminPlayerStatus,
    publishAdminLineup,
    releaseAdminLineup,
    unpublishAdminLineup,
    saveAdminPlayerStatusDraft,
    saveAdminLineupDraft,
    sendAdminNotificationBroadcast,
    sendAdminNotificationTest,
    updateAdminSettings,
    updateAdminDataSource,
    refreshAdminDataCache,
    type AdminLineupDetail,
    type AdminNotificationPayload,
    type AdminOverview,
    type AdminPlayerStatusEntry,
    type AdminPlayerStatusState
} from '../services/admin';
import { fetchPlayerStatus, fetchSquad } from '../services/api';
import type { AdminLineupSettings, DataSourceMode, DataSourceResource, FormationDraft, MatchData, Player, PublishedMatchLineups } from '../types';
import { ADMIN_STATUS_PREVIEW_MODE } from '../utils/adminStatusPreview';
import SeasonSelector from './SeasonSelector';
import { getCurrentSeasonStartYear, getRecentSeasonOptions } from '../utils/seasons';
import { normalizePublishedLineups } from '../utils/lineupData';

interface AdminPanelProps {
    visible: boolean;
    matches: MatchData[];
    onClose: () => void;
}

type AdminTab = 'overview' | 'lineups' | 'player-status' | 'notifications';

const DEFAULT_NOTIFICATION: AdminNotificationPayload = {
    title: '',
    body: '',
    url: 'https://omerkalay.com/fenerbahce-fan-hub/'
};

const DATA_RESOURCE_LABELS: Record<DataSourceResource, string> = {
    fixtures: 'Fikstür',
    standings: 'Puan durumu',
    statistics: 'Gol, asist ve form'
};

const LINEUP_ACTION_BUTTON_CLASS = 'min-h-12 w-full rounded-xl px-4 py-3 text-sm font-black transition-colors disabled:cursor-not-allowed disabled:opacity-40';

const formatDateTime = (value: unknown): string => {
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Henüz yok';
    return new Date(timestamp).toLocaleString('tr-TR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'Europe/Istanbul'
    });
};

const findLineupPreview = (detail: AdminLineupDetail | null): PublishedMatchLineups | null => (
    normalizePublishedLineups(detail?.published || detail?.detection?.payload || null)
);

const AdminPanel = ({ visible, matches, onClose }: AdminPanelProps) => {
    const [tab, setTab] = useState<AdminTab>(() => ADMIN_STATUS_PREVIEW_MODE ? 'player-status' : 'overview');
    const [overview, setOverview] = useState<AdminOverview | null>(null);
    const [selectedMatchId, setSelectedMatchId] = useState<string>('');
    const [lineupDetail, setLineupDetail] = useState<AdminLineupDetail | null>(null);
    const [playerStatusState, setPlayerStatusState] = useState<AdminPlayerStatusState | null>(null);
    const [squad, setSquad] = useState<Player[]>([]);
    const [draft, setDraft] = useState<FormationDraft | null>(null);
    const [lineupEditorOpen, setLineupEditorOpen] = useState(false);
    const [notification, setNotification] = useState<AdminNotificationPayload>(DEFAULT_NOTIFICATION);
    const [testId, setTestId] = useState<string | null>(null);
    const [dataSeasonStartYear, setDataSeasonStartYear] = useState(() => getCurrentSeasonStartYear());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const lineupRequestRef = useRef(0);
    const playerStatusRequestRef = useRef(0);
    const dataSeasonOptions = useMemo(() => getRecentSeasonOptions(), []);

    const uniqueMatches = useMemo(() => {
        const seen = new Set<number>();
        return matches.filter((match) => {
            if (seen.has(match.id)) return false;
            seen.add(match.id);
            return true;
        });
    }, [matches]);

    const loadOverview = useCallback(async () => {
        const data = await fetchAdminOverview();
        setOverview(data);
        if (data.dataSources?.seasonStartYear) setDataSeasonStartYear(data.dataSources.seasonStartYear);
    }, []);

    const loadLineup = useCallback(async (matchId: string) => {
        if (!matchId) return;
        const requestId = ++lineupRequestRef.current;
        const data = await fetchAdminLineup(matchId);
        if (requestId !== lineupRequestRef.current) return;
        setLineupDetail(data);
        setDraft(data.draft);
        setLineupEditorOpen((current) => findLineupPreview(data) ? current : true);
    }, []);

    const loadPlayerStatuses = useCallback(async () => {
        const requestId = ++playerStatusRequestRef.current;
        const squadPromise = fetchSquad();
        let data: AdminPlayerStatusState;

        if (ADMIN_STATUS_PREVIEW_MODE) {
            const publicEntries = await fetchPlayerStatus();
            data = {
                published: publicEntries
                    .filter((entry): entry is typeof entry & { status: AdminPlayerStatusEntry['status'] } => entry.status !== 'fit')
                    .map((entry, index) => ({
                        playerId: entry.playerId || `legacy-${String(index + 1).padStart(16, '0')}`,
                        source: entry.source || 'manual',
                        name: entry.name,
                        status: entry.status,
                        detail: entry.detail,
                        returnDate: entry.returnDate,
                        updatedAt: entry.updatedAt
                    })),
                draft: null,
                revision: 0,
                lastPublishedAt: publicEntries.reduce((latest, entry) => Math.max(latest, entry.updatedAt || 0), 0) || null
            };
        } else {
            data = await fetchAdminPlayerStatus();
        }

        const loadedSquad = await squadPromise;
        if (requestId !== playerStatusRequestRef.current) return;
        setPlayerStatusState(data);
        setSquad(loadedSquad);
    }, []);

    useEffect(() => {
        if (!visible) return;
        if (ADMIN_STATUS_PREVIEW_MODE) {
            setTab('player-status');
            setBusy(false);
            setError(null);
            return;
        }
        let cancelled = false;
        setBusy(true);
        setError(null);
        void Promise.all([fetchAdminSession(), loadOverview()])
            .then(() => {
                if (cancelled) return;
                setSelectedMatchId((current) => (
                    current && uniqueMatches.some((match) => String(match.id) === current)
                        ? current
                        : String(uniqueMatches[0]?.id || '')
                ));
            })
            .catch((requestError) => {
                if (!cancelled) setError((requestError as Error).message);
            })
            .finally(() => {
                if (!cancelled) setBusy(false);
            });
        return () => { cancelled = true; };
    }, [loadOverview, uniqueMatches, visible]);

    useEffect(() => {
        if (!visible || !selectedMatchId) return;
        let cancelled = false;
        setBusy(true);
        setError(null);
        void loadLineup(selectedMatchId)
            .catch((requestError) => {
                if (!cancelled) setError((requestError as Error).message);
            })
            .finally(() => {
                if (!cancelled) setBusy(false);
            });
        return () => { cancelled = true; };
    }, [loadLineup, selectedMatchId, visible]);

    useEffect(() => {
        setLineupEditorOpen(false);
    }, [selectedMatchId]);

    useEffect(() => {
        if (!visible || tab !== 'player-status') return;
        let cancelled = false;
        setBusy(true);
        setError(null);
        void loadPlayerStatuses()
            .catch((requestError) => {
                if (!cancelled) setError((requestError as Error).message);
            })
            .finally(() => {
                if (!cancelled) setBusy(false);
            });
        return () => { cancelled = true; };
    }, [loadPlayerStatuses, tab, visible]);

    useEffect(() => {
        setTestId(null);
    }, [notification]);

    useEffect(() => {
        if (!notice) return;
        const timer = window.setTimeout(() => setNotice(null), 10_000);
        return () => window.clearTimeout(timer);
    }, [notice]);

    useEffect(() => {
        if (visible) return;
        setError(null);
        setNotice(null);
    }, [visible]);

    useEffect(() => {
        if (!visible) return;

        const root = document.documentElement;
        const body = document.body;
        const scrollY = window.scrollY;
        const previous = {
            rootOverflow: root.style.overflow,
            rootOverscrollBehavior: root.style.overscrollBehavior,
            bodyOverflow: body.style.overflow,
            bodyOverscrollBehavior: body.style.overscrollBehavior,
            bodyPosition: body.style.position,
            bodyTop: body.style.top,
            bodyLeft: body.style.left,
            bodyRight: body.style.right,
            bodyWidth: body.style.width
        };

        root.style.overflow = 'hidden';
        root.style.overscrollBehavior = 'none';
        body.style.overflow = 'hidden';
        body.style.overscrollBehavior = 'none';
        body.style.position = 'fixed';
        body.style.top = `-${scrollY}px`;
        body.style.left = '0';
        body.style.right = '0';
        body.style.width = '100%';

        return () => {
            root.style.overflow = previous.rootOverflow;
            root.style.overscrollBehavior = previous.rootOverscrollBehavior;
            body.style.overflow = previous.bodyOverflow;
            body.style.overscrollBehavior = previous.bodyOverscrollBehavior;
            body.style.position = previous.bodyPosition;
            body.style.top = previous.bodyTop;
            body.style.left = previous.bodyLeft;
            body.style.right = previous.bodyRight;
            body.style.width = previous.bodyWidth;
            if (scrollY > 0) window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
        };
    }, [visible]);

    const runAction = async (action: () => Promise<void>, successMessage: string) => {
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            await action();
            setNotice(successMessage);
        } catch (actionError) {
            setError((actionError as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const updateSettings = async (settings: AdminLineupSettings) => {
        await runAction(async () => {
            const result = await updateAdminSettings(settings);
            setOverview((current) => current ? { ...current, settings: result.settings } : current);
            setLineupDetail((current) => current ? { ...current, settings: result.settings } : current);
        }, 'Otomasyon ayarları güncellendi.');
    };

    const updateDataSource = async (resource: DataSourceResource, mode: DataSourceMode) => {
        const snapshot = overview?.dataSources?.snapshots?.[String(dataSeasonStartYear)]?.[resource];
        if (mode === 'cache' && !snapshot?.data) {
            setError(`${DATA_RESOURCE_LABELS[resource]} için ${dataSeasonStartYear}/${String(dataSeasonStartYear + 1).slice(-2)} cache’i henüz hazır değil.`);
            return;
        }
        await runAction(async () => {
            const result = await updateAdminDataSource(resource, mode);
            setOverview((current) => current?.dataSources ? {
                ...current,
                dataSources: { ...current.dataSources, modes: result.modes }
            } : current);
        }, `${DATA_RESOURCE_LABELS[resource]} kaynağı ${mode === 'espn' ? 'ESPN' : 'Cache'} olarak ayarlandı.`);
    };

    const refreshDataCache = async (resource: DataSourceResource | 'all') => {
        await runAction(async () => {
            await refreshAdminDataCache(resource, dataSeasonStartYear);
            await loadOverview();
        }, resource === 'all' ? 'Tüm veri cache’leri yenilendi.' : `${DATA_RESOURCE_LABELS[resource]} cache’i yenilendi.`);
    };

    const saveDraft = async () => {
        if (!selectedMatchId || !draft) return;
        await runAction(async () => {
            const result = await saveAdminLineupDraft(selectedMatchId, draft);
            setDraft(result.draft);
            await loadLineup(selectedMatchId);
        }, 'Taslak güvenli alana kaydedildi.');
    };

    const publish = async (mode: 'detected' | 'manual') => {
        if (!selectedMatchId) return;
        await runAction(async () => {
            await publishAdminLineup(selectedMatchId, mode);
            await loadLineup(selectedMatchId);
            setLineupEditorOpen(false);
        }, mode === 'detected' ? 'ESPN kadrosu yayınlandı.' : 'Manuel kadro yayınlandı ve kilitlendi.');
    };

    const release = async () => {
        if (!selectedMatchId) return;
        await runAction(async () => {
            await releaseAdminLineup(selectedMatchId);
            await loadLineup(selectedMatchId);
        }, 'Manuel kilit kaldırıldı; kadro yeniden ESPN otomasyonuna bırakıldı.');
    };

    const unpublish = async () => {
        if (!selectedMatchId) return;
        const confirmed = window.confirm('Yayınlanan İlk 11’i kaldırmak istediğine emin misin? Kadro taraftar ekranından hemen kaldırılır; taslağın silinmez ve bildirim gönderilmez.');
        if (!confirmed) return;
        await runAction(async () => {
            await unpublishAdminLineup(selectedMatchId);
            await loadLineup(selectedMatchId);
            setLineupEditorOpen(true);
        }, 'Yayınlanan İlk 11 kaldırıldı. ESPN otomasyonu bu maç için duraklatıldı; taslağın korundu.');
    };

    const savePlayerStatuses = async (entries: AdminPlayerStatusEntry[]) => {
        await runAction(async () => {
            const revision = playerStatusState?.revision || 0;
            if (ADMIN_STATUS_PREVIEW_MODE) {
                setPlayerStatusState((current) => current ? {
                    ...current,
                    draft: { baseRevision: current.revision, entries, updatedAt: Date.now() }
                } : current);
                return;
            }
            const result = await saveAdminPlayerStatusDraft(revision, entries);
            setPlayerStatusState((current) => current ? { ...current, draft: result.draft } : current);
        }, ADMIN_STATUS_PREVIEW_MODE ? 'Yerel taslak güncellendi; Firebase’e yazılmadı.' : 'Oyuncu durumu taslağı güvenli alana kaydedildi.');
    };

    const publishPlayerStatuses = async (entries: AdminPlayerStatusEntry[]) => {
        const confirmed = window.confirm('Canlı oyuncu durumu listesini bu önizlemeyle değiştirmek istediğine emin misin? Bu işlem bildirim göndermez.');
        if (!confirmed) return;
        await runAction(async () => {
            const revision = playerStatusState?.revision || 0;
            if (ADMIN_STATUS_PREVIEW_MODE) {
                const now = Date.now();
                setPlayerStatusState((current) => current ? {
                    published: entries.map((entry) => ({ ...entry, updatedAt: now })),
                    draft: null,
                    revision: current.revision + 1,
                    lastPublishedAt: now
                } : current);
                return;
            }
            await saveAdminPlayerStatusDraft(revision, entries);
            const result = await publishAdminPlayerStatus(revision);
            setPlayerStatusState({
                published: result.published,
                draft: null,
                revision: result.revision,
                lastPublishedAt: result.lastPublishedAt
            });
        }, ADMIN_STATUS_PREVIEW_MODE ? 'Yerel yayın önizlemesi güncellendi; Firebase’e yazılmadı.' : 'Oyuncu durumları yayınlandı. Bildirim gönderilmedi.');
    };

    const testNotification = async () => {
        await runAction(async () => {
            const result = await sendAdminNotificationTest(notification);
            setTestId(result.testId);
        }, 'Test bildirimi yalnızca kendi kayıtlı cihazına gönderildi.');
    };

    const broadcastNotification = async () => {
        if (!testId) return;
        const confirmed = window.confirm('Test ettiğin aynı bildirimi all_fans abonelerine göndermek istediğine emin misin?');
        if (!confirmed) return;
        await runAction(async () => {
            await sendAdminNotificationBroadcast(notification, testId);
            setTestId(null);
        }, 'Firebase toplu bildirimi kabul etti.');
    };

    if (!visible) return null;

    const preview = findLineupPreview(lineupDetail);
    const publishedPreview = normalizePublishedLineups(lineupDetail?.published || null);
    const settings = lineupDetail?.settings || overview?.settings || {
        autoPublishLineups: false,
        autoPushLineups: false
    };

    return (
        <div className="fixed inset-0 z-[120] bg-slate-950/95 backdrop-blur-md p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Yönetim paneli">
            <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
                <header className="flex items-center justify-between border-b border-white/10 p-4">
                    <div>
                        <p className="text-lg font-black text-white">Yönetim Paneli</p>
                        <p className="text-xs text-slate-400">
                            {ADMIN_STATUS_PREVIEW_MODE
                                ? 'Yerel arayüz incelemesi; yönetim API’si kullanılmaz'
                                : 'Yetkili işlemler sunucu tarafında doğrulanır'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-white/80 transition-all duration-300 hover:bg-white/5 hover:text-white hover:rotate-90"
                        aria-label="Kapat"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </header>

                <div className="flex gap-1 border-b border-white/10 p-2">
                    {([
                        ['overview', 'Sistem'],
                        ['lineups', 'İlk 11'],
                        ['player-status', 'Durumlar'],
                        ['notifications', 'Bildirim']
                    ] as const).map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTab(key)}
                            disabled={ADMIN_STATUS_PREVIEW_MODE && key !== 'player-status'}
                            className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-30 ${tab === key ? 'bg-yellow-400 text-slate-950' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {(error || notice) && (
                    <div className={`mx-4 mt-3 rounded-lg border px-3 py-2 text-xs ${error ? 'border-red-400/30 bg-red-500/10 text-red-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>
                        {error || notice}
                    </div>
                )}

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                    {busy && <p className="mb-3 text-xs text-yellow-300">İşlem yapılıyor…</p>}

                    {tab === 'overview' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <StatusCard label="Canlı sürüm" value={__APP_VERSION__} />
                                <StatusCard
                                    label="UEFA yolu"
                                    value={`${formatDateTime(overview?.uefaJourney?.lastUpdate)}${overview?.uefaJourney?.stale ? ' · eski' : ''}`}
                                />
                                <StatusCard label="Topic bekleyen" value={String(overview?.topicSync.pending ?? 0)} />
                                <StatusCard label="Token temizliği" value={String(overview?.topicSync.cleanupPending ?? 0)} />
                                <StatusCard
                                    label="İlk 11 push"
                                    value={overview?.startingLineupPush?.status
                                        ? `${overview.startingLineupPush.status} · ${formatDateTime(overview.startingLineupPush.acceptedAt || overview.startingLineupPush.failedAt)}`
                                        : 'Henüz gönderilmedi'}
                                />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <HealthCard title="Günlük cache görevi" data={overview?.health.dailyDataRefresh} />
                                <HealthCard title="Canlı maç görevi" data={overview?.health.liveMatchScheduler} />
                                <HealthCard title="Bildirim görevi" data={overview?.health.notificationScheduler} />
                                <HealthCard title="İlk 11 otomasyonu" data={overview?.health.lineupAutomation} />
                            </div>
                            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-black text-white">ESPN / Cache Kontrolü</p>
                                        <p className="mt-1 text-[11px] text-slate-400">Bölümler bağımsız çalışır; sürekli yenileme yapılmaz.</p>
                                    </div>
                                    <SeasonSelector
                                        value={dataSeasonStartYear}
                                        options={dataSeasonOptions}
                                        onChange={setDataSeasonStartYear}
                                        minimal
                                    />
                                </div>

                                <div className="mt-4 space-y-3">
                                    {(Object.keys(DATA_RESOURCE_LABELS) as DataSourceResource[]).map((resource) => {
                                        const mode = overview?.dataSources?.modes?.[resource] || 'espn';
                                        const snapshot = overview?.dataSources?.snapshots?.[String(dataSeasonStartYear)]?.[resource];
                                        const hasCache = Boolean(snapshot?.data);
                                        return (
                                            <div key={resource} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-white">{DATA_RESOURCE_LABELS[resource]}</p>
                                                        <p className={`mt-1 text-[10px] ${snapshot?.status === 'error' ? 'text-rose-300' : 'text-slate-500'}`}>
                                                            {hasCache
                                                                ? `Son cache: ${formatDateTime(snapshot?.fetchedAt)}${snapshot?.status === 'error' ? ' · son deneme hatalı' : ''}`
                                                                : 'Bu sezon için cache yok'}
                                                        </p>
                                                    </div>
                                                    <div className="flex rounded-lg bg-white/5 p-0.5">
                                                        {(['espn', 'cache'] as DataSourceMode[]).map((value) => (
                                                            <button
                                                                key={value}
                                                                type="button"
                                                                disabled={busy || (value === 'cache' && !hasCache)}
                                                                onClick={() => updateDataSource(resource, value)}
                                                                className={`rounded-md px-3 py-1.5 text-[10px] font-black disabled:cursor-not-allowed disabled:opacity-30 ${mode === value ? 'bg-yellow-400 text-slate-950' : 'text-slate-400'}`}
                                                            >
                                                                {value === 'espn' ? 'ESPN' : 'Cache'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={busy}
                                                    onClick={() => refreshDataCache(resource)}
                                                    className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold text-slate-200 disabled:opacity-40"
                                                >
                                                    Cache’i şimdi yenile
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => refreshDataCache('all')}
                                    className="mt-3 w-full rounded-lg bg-yellow-400 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-40"
                                >
                                    Tüm cache’leri yenile
                                </button>
                            </section>
                        </div>
                    )}

                    {tab === 'lineups' && (
                        <div className="space-y-5">
                            <select
                                value={selectedMatchId}
                                onChange={(event) => {
                                    setSelectedMatchId(event.target.value);
                                    setLineupEditorOpen(false);
                                }}
                                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                            >
                                {uniqueMatches.map((match) => (
                                    <option key={match.id} value={match.id}>{match.homeTeam.name} - {match.awayTeam.name}</option>
                                ))}
                            </select>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <SettingToggle
                                    label="ESPN kadrosunu otomatik yayınla"
                                    checked={settings.autoPublishLineups}
                                    disabled={busy}
                                    onChange={(checked) => updateSettings({
                                        autoPublishLineups: checked,
                                        autoPushLineups: checked ? settings.autoPushLineups : false
                                    })}
                                />
                                <SettingToggle
                                    label="Otomatik İlk 11 bildirimi"
                                    checked={settings.autoPushLineups}
                                    disabled={busy || !settings.autoPublishLineups}
                                    onChange={(checked) => updateSettings({ ...settings, autoPushLineups: checked })}
                                />
                            </div>

                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300">
                                <p>ESPN durumu: <strong className="text-white">{lineupDetail?.detection?.status || 'henüz veri yok'}</strong></p>
                                <p className="mt-1">İlk görülme: {formatDateTime(lineupDetail?.detection?.firstSeenAt)}</p>
                                <p className="mt-1">Yayın: <strong className={publishedPreview ? 'text-emerald-300' : 'text-slate-400'}>{publishedPreview ? 'Yayında' : 'Yayında değil'}</strong></p>
                                <p className="mt-1">ESPN otomasyonu: {lineupDetail?.manualLocked ? 'Bu maç için duraklatıldı' : 'Etkin'}</p>
                                <p className="mt-1">İlk 11 push: {lineupDetail?.notification?.status || 'henüz gönderilmedi'}</p>
                            </div>

                            {preview?.lineups && !lineupEditorOpen && (
                                <section className="space-y-3 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.04] p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-black text-white">{publishedPreview ? 'Yayınlanan İlk 11' : 'ESPN İlk 11 önizlemesi'}</p>
                                            <p className="mt-1 text-[11px] text-slate-400">{publishedPreview ? 'Taraftar ekranında görünen kadro' : 'Henüz taraftar ekranında yayınlanmadı'}</p>
                                        </div>
                                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${publishedPreview ? 'bg-emerald-400/15 text-emerald-300' : 'bg-blue-400/15 text-blue-200'}`}>
                                            {publishedPreview ? 'YAYINDA' : 'ÖNİZLEME'}
                                        </span>
                                    </div>
                                    <MatchLineups
                                        lineups={preview.lineups}
                                        homeTeamName={preview.homeTeam.name}
                                        awayTeamName={preview.awayTeam.name}
                                        matchId={preview.matchId}
                                    />
                                </section>
                            )}

                            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                <p className="text-xs font-black text-white">Kadro işlemleri</p>
                                <p className="mt-1 text-[11px] text-slate-400">Önizleme ve manuel düzenleme aynı anda açılmaz.</p>
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    {preview && !lineupEditorOpen && (
                                        <button type="button" disabled={busy} onClick={() => setLineupEditorOpen(true)} className={`${LINEUP_ACTION_BUTTON_CLASS} bg-slate-800 text-slate-100 hover:bg-slate-700`}>Manuel düzenle</button>
                                    )}
                                    {preview && lineupEditorOpen && (
                                        <button type="button" disabled={busy} onClick={() => setLineupEditorOpen(false)} className={`${LINEUP_ACTION_BUTTON_CLASS} bg-slate-800 text-slate-100 hover:bg-slate-700`}>{publishedPreview ? 'Yayınlanan kadroya dön' : 'ESPN önizlemesine dön'}</button>
                                    )}
                                    <button type="button" disabled={busy || lineupDetail?.detection?.status !== 'ready'} onClick={() => publish('detected')} className={`${LINEUP_ACTION_BUTTON_CLASS} bg-blue-500/20 text-blue-200 hover:bg-blue-500/30`}>ESPN kadrosunu yayınla</button>
                                    {lineupDetail?.manualLocked && <button type="button" disabled={busy} onClick={release} className={`${LINEUP_ACTION_BUTTON_CLASS} bg-amber-500/20 text-amber-200 hover:bg-amber-500/30`}>ESPN otomasyonuna dön</button>}
                                    {publishedPreview && <button type="button" disabled={busy} onClick={unpublish} className={`${LINEUP_ACTION_BUTTON_CLASS} bg-red-500/20 text-red-200 hover:bg-red-500/30`}>Yayınlanan İlk 11’i Kaldır</button>}
                                </div>
                            </section>

                            {lineupEditorOpen && (
                                <section className="rounded-xl border border-yellow-400/20 bg-yellow-400/[0.03] p-3">
                                    <div className="mb-3">
                                        <p className="text-sm font-black text-white">Manuel Fenerbahçe kadrosu</p>
                                        <p className="mt-1 text-[11px] text-slate-400">Oyuncuları yerleştir, taslağı kaydet ve hazır olduğunda yayınla.</p>
                                    </div>
                                    <FormationBuilder adminMode initialDraft={lineupDetail?.draft || null} onDraftChange={setDraft} />
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                        <button type="button" disabled={busy || !draft} onClick={saveDraft} className={`${LINEUP_ACTION_BUTTON_CLASS} bg-slate-800 text-slate-100 hover:bg-slate-700`}>Taslağı kaydet</button>
                                        <button type="button" disabled={busy || draft?.players.length !== 11} onClick={() => publish('manual')} className={`${LINEUP_ACTION_BUTTON_CLASS} bg-yellow-400 text-slate-950 hover:bg-yellow-300`}>Manuel yayınla</button>
                                    </div>
                                </section>
                            )}
                        </div>
                    )}

                    {tab === 'player-status' && (
                        <div className="space-y-3">
                            {ADMIN_STATUS_PREVIEW_MODE && (
                                <div className="sticky top-0 z-20 rounded-xl border border-sky-400/30 bg-sky-500/15 px-3 py-2 text-xs font-bold text-sky-100 shadow-lg backdrop-blur">
                                    Yerel önizleme — Firebase’e yazılmaz
                                </div>
                            )}
                            <AdminPlayerStatusManager
                                state={playerStatusState}
                                squad={squad}
                                busy={busy}
                                onSave={savePlayerStatuses}
                                onPublish={publishPlayerStatuses}
                            />
                        </div>
                    )}

                    {tab === 'notifications' && (
                        <div className="mx-auto max-w-xl space-y-4">
                            <label className="block text-xs font-semibold text-slate-300">Başlık
                                <input value={notification.title} maxLength={60} onChange={(event) => setNotification((value) => ({ ...value, title: event.target.value }))} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white" />
                            </label>
                            <label className="block text-xs font-semibold text-slate-300">Mesaj
                                <textarea value={notification.body} maxLength={180} rows={4} onChange={(event) => setNotification((value) => ({ ...value, body: event.target.value }))} className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white" />
                            </label>
                            <label className="block text-xs font-semibold text-slate-300">Uygulama bağlantısı
                                <input value={notification.url} onChange={(event) => setNotification((value) => ({ ...value, url: event.target.value }))} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white" />
                            </label>
                            <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4">
                                <p className="text-sm font-black text-white">{notification.title || 'Bildirim başlığı'}</p>
                                <p className="mt-1 text-xs text-slate-300">{notification.body || 'Bildirim mesajı burada görünür.'}</p>
                            </div>
                            <div className="flex gap-2">
                                <button type="button" disabled={busy || !notification.title.trim() || !notification.body.trim()} onClick={testNotification} className="flex-1 rounded-lg bg-blue-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Önce bana test gönder</button>
                                <button type="button" disabled={busy || !testId} onClick={broadcastNotification} className="flex-1 rounded-lg bg-red-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">all_fans gönder</button>
                            </div>
                            <p className="text-[11px] text-slate-500">İçerik değişirse test onayı otomatik olarak geçersiz olur. Topic gönderiminde yalnızca Firebase’in kabul sonucu gösterilir.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const StatusCard = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 break-words text-sm font-bold text-white">{value}</p>
    </div>
);

const HealthCard = ({ title, data }: { title: string; data?: Record<string, unknown> }) => (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="mt-2 text-xs text-slate-400">Durum: {String(data?.status || 'henüz veri yok')}</p>
        <p className="mt-1 text-xs text-slate-400">Son çalışma: {formatDateTime(data?.lastRunAt)}</p>
    </div>
);

const SettingToggle = ({ label, checked, disabled, onChange }: {
    label: string;
    checked: boolean;
    disabled: boolean;
    onChange: (checked: boolean) => void;
}) => (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs font-semibold text-slate-200">
        {label}
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-yellow-400" />
    </label>
);

export default AdminPanel;
