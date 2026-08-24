import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FormationBuilder from './FormationBuilder';
import MatchLineups from './MatchLineups';
import {
    fetchAdminLineup,
    fetchAdminOverview,
    fetchAdminSession,
    publishAdminLineup,
    releaseAdminLineup,
    saveAdminLineupDraft,
    sendAdminNotificationBroadcast,
    sendAdminNotificationTest,
    updateAdminSettings,
    type AdminLineupDetail,
    type AdminNotificationPayload,
    type AdminOverview
} from '../services/admin';
import type { AdminLineupSettings, FormationDraft, MatchData, PublishedMatchLineups } from '../types';

interface AdminPanelProps {
    visible: boolean;
    matches: MatchData[];
    onClose: () => void;
}

type AdminTab = 'overview' | 'lineups' | 'notifications';

const DEFAULT_NOTIFICATION: AdminNotificationPayload = {
    title: '',
    body: '',
    url: 'https://omerkalay.com/fenerbahce-fan-hub/'
};

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
    detail?.published || detail?.detection?.payload || null
);

const AdminPanel = ({ visible, matches, onClose }: AdminPanelProps) => {
    const [tab, setTab] = useState<AdminTab>('overview');
    const [overview, setOverview] = useState<AdminOverview | null>(null);
    const [selectedMatchId, setSelectedMatchId] = useState<string>('');
    const [lineupDetail, setLineupDetail] = useState<AdminLineupDetail | null>(null);
    const [draft, setDraft] = useState<FormationDraft | null>(null);
    const [notification, setNotification] = useState<AdminNotificationPayload>(DEFAULT_NOTIFICATION);
    const [testId, setTestId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const lineupRequestRef = useRef(0);

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
    }, []);

    const loadLineup = useCallback(async (matchId: string) => {
        if (!matchId) return;
        const requestId = ++lineupRequestRef.current;
        const data = await fetchAdminLineup(matchId);
        if (requestId !== lineupRequestRef.current) return;
        setLineupDetail(data);
        setDraft(data.draft);
    }, []);

    useEffect(() => {
        if (!visible) return;
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
        }, mode === 'detected' ? 'ESPN kadrosu yayınlandı.' : 'Manuel kadro yayınlandı ve kilitlendi.');
    };

    const release = async () => {
        if (!selectedMatchId) return;
        await runAction(async () => {
            await releaseAdminLineup(selectedMatchId);
            await loadLineup(selectedMatchId);
        }, 'Manuel kilit kaldırıldı; kadro yeniden ESPN otomasyonuna bırakıldı.');
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
                        <p className="text-xs text-slate-400">Yetkili işlemler sunucu tarafında doğrulanır</p>
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
                        ['notifications', 'Bildirim']
                    ] as const).map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTab(key)}
                            className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${tab === key ? 'bg-yellow-400 text-slate-950' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
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

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    {busy && <p className="mb-3 text-xs text-yellow-300">İşlem yapılıyor…</p>}

                    {tab === 'overview' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <StatusCard label="Canlı sürüm" value={overview?.version || '—'} />
                                <StatusCard label="Cache güncellemesi" value={formatDateTime(overview?.lastCacheUpdate)} />
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
                        </div>
                    )}

                    {tab === 'lineups' && (
                        <div className="space-y-5">
                            <select
                                value={selectedMatchId}
                                onChange={(event) => {
                                    setSelectedMatchId(event.target.value);
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
                                <p className="mt-1">Manuel kilit: {lineupDetail?.manualLocked ? 'Açık' : 'Kapalı'}</p>
                                <p className="mt-1">İlk 11 push: {lineupDetail?.notification?.status || 'henüz gönderilmedi'}</p>
                            </div>

                            {preview?.lineups && (
                                <MatchLineups
                                    lineups={preview.lineups}
                                    homeTeamName={preview.homeTeam.name}
                                    awayTeamName={preview.awayTeam.name}
                                    matchId={preview.matchId}
                                />
                            )}

                            <div className="flex flex-wrap gap-2">
                                <button type="button" disabled={busy || lineupDetail?.detection?.status !== 'ready'} onClick={() => publish('detected')} className="rounded-lg bg-blue-500/20 px-3 py-2 text-xs font-bold text-blue-200 disabled:opacity-40">ESPN kadrosunu yayınla</button>
                                {lineupDetail?.manualLocked && <button type="button" disabled={busy} onClick={release} className="rounded-lg bg-amber-500/20 px-3 py-2 text-xs font-bold text-amber-200">ESPN’e geri dön</button>}
                            </div>

                            <div className="border-t border-white/10 pt-4">
                                <FormationBuilder adminMode initialDraft={lineupDetail?.draft || null} onDraftChange={setDraft} />
                                <div className="mt-3 flex gap-2">
                                    <button type="button" disabled={busy || !draft} onClick={saveDraft} className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Taslağı kaydet</button>
                                    <button type="button" disabled={busy || draft?.players.length !== 11} onClick={() => publish('manual')} className="flex-1 rounded-lg bg-yellow-400 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-40">Manuel yayınla</button>
                                </div>
                            </div>
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
