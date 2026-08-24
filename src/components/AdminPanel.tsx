import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FormationBuilder from './FormationBuilder';
import MatchLineups from './MatchLineups';
import {
    fetchAdminLineup,
    fetchAdminSession,
    publishAdminLineup,
    releaseAdminLineup,
    saveAdminLineupDraft,
    updateAdminSettings,
    type AdminLineupDetail
} from '../services/admin';
import type { AdminLineupSettings, FormationDraft, MatchData, PublishedMatchLineups } from '../types';

interface AdminPanelProps {
    visible: boolean;
    matches: MatchData[];
    onClose: () => void;
}

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
    const [selectedMatchId, setSelectedMatchId] = useState('');
    const [lineupDetail, setLineupDetail] = useState<AdminLineupDetail | null>(null);
    const [draft, setDraft] = useState<FormationDraft | null>(null);
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
        void fetchAdminSession()
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
    }, [uniqueMatches, visible]);

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

    if (!visible) return null;

    const preview = findLineupPreview(lineupDetail);
    const settings = lineupDetail?.settings || {
        autoPublishLineups: false,
        autoPushLineups: false
    };

    return (
        <div className="fixed inset-0 z-[120] bg-slate-950/95 p-3 backdrop-blur-md sm:p-6" role="dialog" aria-modal="true" aria-label="Yönetim paneli">
            <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-yellow-400/20 bg-slate-950 shadow-2xl">
                <header className="flex items-center justify-between border-b border-white/10 p-4">
                    <div>
                        <p className="text-lg font-black text-white">Yönetim Paneli</p>
                        <p className="text-xs text-slate-400">Yetkili kadro işlemleri sunucu tarafında doğrulanır</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5 hover:text-white">Kapat</button>
                </header>

                {(error || notice) && (
                    <div className={`mx-4 mt-3 rounded-lg border px-3 py-2 text-xs ${error ? 'border-red-400/30 bg-red-500/10 text-red-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>
                        {error || notice}
                    </div>
                )}

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    {busy && <p className="mb-3 text-xs text-yellow-300">İşlem yapılıyor…</p>}
                    <div className="space-y-5">
                        <select
                            value={selectedMatchId}
                            onChange={(event) => setSelectedMatchId(event.target.value)}
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
                </div>
            </div>
        </div>
    );
};

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
