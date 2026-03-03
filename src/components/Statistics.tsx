import { useEffect, useState } from 'react';
import { fetchFormResults, fetchPlayerStats, fetchPlayerStatus } from '../services/api';
import type { FormResult, PlayerStat, PlayerStatusEntry } from '../types';
import FormChart from './statistics/FormChart';
import PlayerRankingSection from './statistics/PlayerRankingSection';
import SkeletonCard from './statistics/SkeletonCard';

const getStatusBadge = (status: PlayerStatusEntry['status']): { label: string; text: string } => {
    switch (status) {
        case 'injured':
            return { label: 'Sakat', text: 'text-red-400' };
        case 'suspended':
            return { label: 'Cezali', text: 'text-yellow-400' };
        case 'doubtful':
            return { label: 'Belirsiz', text: 'text-orange-400' };
        default:
            return { label: status, text: 'text-slate-400' };
    }
};

const formatRelativeTime = (timestamp: number): string => {
    const hoursAgo = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60));
    if (hoursAgo < 1) return 'Az once';
    if (hoursAgo < 24) return `${hoursAgo} saat once`;
    const daysAgo = Math.floor(hoursAgo / 24);
    return `${daysAgo} gun once`;
};

const Statistics: React.FC = () => {
    const [scorers, setScorers] = useState<PlayerStat[]>([]);
    const [scorersLoading, setScorersLoading] = useState(true);
    const [scorersError, setScorersError] = useState<string | null>(null);

    const [assisters, setAssisters] = useState<PlayerStat[]>([]);
    const [assistersLoading, setAssistersLoading] = useState(true);
    const [assistersError, setAssistersError] = useState<string | null>(null);

    const [form, setForm] = useState<FormResult[]>([]);
    const [formLoading, setFormLoading] = useState(true);
    const [formError, setFormError] = useState<string | null>(null);

    const [playerStatus, setPlayerStatus] = useState<PlayerStatusEntry[]>([]);
    const [statusLoading, setStatusLoading] = useState(true);
    const [statusError, setStatusError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const stats = await fetchPlayerStats();
                if (cancelled) return;
                setScorersError(null);
                setAssistersError(null);
                setScorers(stats);
                setAssisters(stats);
            } catch {
                if (!cancelled) {
                    setScorersError('Gol kralligi verileri yuklenemedi.');
                    setAssistersError('Asist kralligi verileri yuklenemedi.');
                }
            } finally {
                if (!cancelled) {
                    setScorersLoading(false);
                    setAssistersLoading(false);
                }
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const results = await fetchFormResults();
                if (cancelled) return;
                setFormError(null);
                setForm(results);
            } catch {
                if (!cancelled) setFormError('Form verileri yuklenemedi.');
            } finally {
                if (!cancelled) setFormLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const entries = await fetchPlayerStatus();
                if (cancelled) return;
                setStatusError(null);
                setPlayerStatus(entries);
            } catch {
                if (!cancelled) setStatusError('Sakatlık verileri yuklenemedi.');
            } finally {
                if (!cancelled) setStatusLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const activeStatusEntries = playerStatus.filter((entry) => entry.status !== 'fit');
    const latestUpdatedAt = playerStatus.reduce((max, entry) => Math.max(max, entry.updatedAt || 0), 0);

    return (
        <div className="min-h-screen pb-24 space-y-4">
            <PlayerRankingSection
                title="Gol Kralligi"
                players={scorers}
                loading={scorersLoading}
                error={scorersError}
                metric="goals"
                emptyMessage="Gol istatistigi henuz mevcut degil."
                emptyTabMessage="Bu kategoride gol verisi bulunmuyor."
            />

            <PlayerRankingSection
                title="Asist Kralligi"
                players={assisters}
                loading={assistersLoading}
                error={assistersError}
                metric="assists"
                emptyMessage="Asist istatistigi henuz mevcut degil."
                emptyTabMessage="Bu kategoride asist verisi bulunmuyor."
            />

            {formLoading ? (
                <SkeletonCard lines={2} />
            ) : (
                <section className="glass-panel rounded-2xl p-4">
                    <h3 className="text-sm font-bold text-white mb-3">Son Form</h3>
                    {formError ? (
                        <p className="text-xs text-rose-300">{formError}</p>
                    ) : form.length === 0 ? (
                        <p className="text-xs text-slate-400">Form verisi henuz mevcut degil.</p>
                    ) : (
                        <FormChart matches={form} />
                    )}
                </section>
            )}

            {statusLoading ? (
                <SkeletonCard lines={3} />
            ) : (
                <section className="glass-panel rounded-2xl p-4">
                    <h3 className="text-[15px] font-bold text-white mb-3">Sakatlık ve Ceza Durumu</h3>
                    {statusError ? (
                        <p className="text-xs text-rose-300">{statusError}</p>
                    ) : activeStatusEntries.length === 0 ? (
                        <p className="text-xs text-slate-400">Sakatlık veya ceza verisi bulunmuyor.</p>
                    ) : (
                        <>
                            <div className="space-y-0">
                                {activeStatusEntries.map((entry, index) => {
                                    const badge = getStatusBadge(entry.status);
                                    return (
                                        <div key={`${entry.name}-${index}`} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-sm text-white font-semibold truncate">{entry.name}</span>
                                                    {entry.detail && (
                                                        <span className="text-[13px] text-slate-400">{entry.detail}</span>
                                                    )}
                                                </div>
                                                {entry.returnDate && (
                                                    <span className="text-[13px] text-slate-500 block mt-0.5">
                                                        Tahmini donus: {entry.returnDate}
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`text-[13px] uppercase tracking-wider font-semibold shrink-0 ${badge.text} opacity-70 -ml-1`}>
                                                {badge.label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            {latestUpdatedAt > 0 && (
                                <p className="text-[13px] text-slate-500 mt-3 text-right">
                                    Son guncelleme: {formatRelativeTime(latestUpdatedAt)}
                                </p>
                            )}
                        </>
                    )}
                </section>
            )}
        </div>
    );
};

export default Statistics;
