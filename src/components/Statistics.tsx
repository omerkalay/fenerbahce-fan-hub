import { useState, useEffect } from 'react';
import { fetchPlayerStats, fetchFormResults, fetchPlayerStatus } from '../services/api';
import type { PlayerStat, FormResult, PlayerStatusEntry } from '../types';

// ─── Skeleton (reuses FixtureSchedule pattern) ──────────

const SkeletonCard: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
    <div className="glass-panel rounded-2xl p-4 animate-pulse">
        <div className="h-5 w-40 bg-white/10 rounded mb-4" />
        {Array.from({ length: lines }).map((_, i) => (
            <div key={i} className="h-8 w-full bg-white/5 rounded-lg mb-2 last:mb-0" />
        ))}
    </div>
);

// ─── Helpers ────────────────────────────────────────────

const getFormColor = (result: FormResult['result']): string => {
    switch (result) {
        case 'W': return 'bg-green-500';
        case 'D': return 'bg-yellow-500';
        case 'L': return 'bg-red-500';
    }
};

const getStatusBadge = (status: PlayerStatusEntry['status']): { label: string; className: string } => {
    switch (status) {
        case 'injured':
            return { label: 'Sakatlanma', className: 'bg-red-500/20 text-red-300 border-red-500/30' };
        case 'suspended':
            return { label: 'Cezali', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' };
        case 'doubtful':
            return { label: 'Supheli', className: 'bg-orange-500/20 text-orange-300 border-orange-500/30' };
        default:
            return { label: status, className: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
    }
};

const formatShortDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
};

const formatRelativeTime = (timestamp: number): string => {
    const hoursAgo = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60));
    if (hoursAgo < 1) return 'Az once';
    if (hoursAgo < 24) return `${hoursAgo} saat once`;
    const daysAgo = Math.floor(hoursAgo / 24);
    return `${daysAgo} gun once`;
};

// ─── Component ──────────────────────────────────────────

const Statistics: React.FC = () => {
    // Section 1: Top Scorers
    const [scorers, setScorers] = useState<PlayerStat[]>([]);
    const [scorersLoading, setScorersLoading] = useState(true);
    const [scorersError, setScorersError] = useState<string | null>(null);

    // Section 2: Top Assisters
    const [assisters, setAssisters] = useState<PlayerStat[]>([]);
    const [assistersLoading, setAssistersLoading] = useState(true);
    const [assistersError, setAssistersError] = useState<string | null>(null);

    // Section 3: Team Form
    const [form, setForm] = useState<FormResult[]>([]);
    const [formLoading, setFormLoading] = useState(true);
    const [formError, setFormError] = useState<string | null>(null);

    // Section 4: Player Status
    const [playerStatus, setPlayerStatus] = useState<PlayerStatusEntry[]>([]);
    const [statusLoading, setStatusLoading] = useState(true);
    const [statusError, setStatusError] = useState<string | null>(null);

    // Fetch top scorers
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const stats = await fetchPlayerStats();
                if (cancelled) return;
                const sorted = [...stats].sort((a, b) => b.goals - a.goals).slice(0, 10);
                setScorers(sorted);
            } catch {
                if (!cancelled) setScorersError('Gol kralligi verileri yuklenemedi.');
            } finally {
                if (!cancelled) setScorersLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    // Fetch top assisters
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const stats = await fetchPlayerStats();
                if (cancelled) return;
                const sorted = [...stats].sort((a, b) => b.assists - a.assists).slice(0, 10);
                setAssisters(sorted);
            } catch {
                if (!cancelled) setAssistersError('Asist kralligi verileri yuklenemedi.');
            } finally {
                if (!cancelled) setAssistersLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    // Fetch form results
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const results = await fetchFormResults();
                if (cancelled) return;
                setForm(results);
            } catch {
                if (!cancelled) setFormError('Form verileri yuklenemedi.');
            } finally {
                if (!cancelled) setFormLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    // Fetch player status
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const entries = await fetchPlayerStatus();
                if (cancelled) return;
                setPlayerStatus(entries);
            } catch {
                if (!cancelled) setStatusError('Sakatlık verileri yuklenemedi.');
            } finally {
                if (!cancelled) setStatusLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    const activeStatusEntries = playerStatus.filter(e => e.status !== 'fit');
    const latestUpdatedAt = playerStatus.reduce((max, e) => Math.max(max, e.updatedAt || 0), 0);

    return (
        <div className="min-h-screen pb-24 space-y-4">
            {/* Section 1: Top Scorers */}
            {scorersLoading ? (
                <SkeletonCard lines={5} />
            ) : (
                <section className="glass-panel rounded-2xl p-4">
                    <h3 className="text-sm font-bold text-white mb-3">Gol Kralligi</h3>
                    {scorersError ? (
                        <p className="text-xs text-rose-300">{scorersError}</p>
                    ) : scorers.length === 0 || scorers.every(s => s.goals === 0) ? (
                        <p className="text-xs text-slate-400">Gol istatistigi henuz mevcut degil.</p>
                    ) : (
                        <div className="space-y-1">
                            {scorers.map((player, index) => (
                                <div key={player.playerId} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                                    <span className="text-xs text-slate-500 w-5 text-right font-medium">{index + 1}</span>
                                    <span className="text-sm text-white truncate flex-1 max-w-[200px]">{player.name}</span>
                                    <span className="text-sm font-bold text-yellow-400">{player.goals}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* Section 2: Top Assisters */}
            {assistersLoading ? (
                <SkeletonCard lines={5} />
            ) : (
                <section className="glass-panel rounded-2xl p-4">
                    <h3 className="text-sm font-bold text-white mb-3">Asist Kralligi</h3>
                    {assistersError ? (
                        <p className="text-xs text-rose-300">{assistersError}</p>
                    ) : assisters.length === 0 || assisters.every(s => s.assists === 0) ? (
                        <p className="text-xs text-slate-400">Asist istatistigi henuz mevcut degil.</p>
                    ) : (
                        <div className="space-y-1">
                            {assisters.map((player, index) => (
                                <div key={player.playerId} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                                    <span className="text-xs text-slate-500 w-5 text-right font-medium">{index + 1}</span>
                                    <span className="text-sm text-white truncate flex-1 max-w-[200px]">{player.name}</span>
                                    <span className="text-sm font-bold text-yellow-400">{player.assists}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* Section 3: Team Form */}
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
                        <div className="flex flex-wrap gap-2 justify-center">
                            {form.map((match) => (
                                <div key={match.matchId} className="flex flex-col items-center gap-1">
                                    <div className={`w-9 h-9 rounded-lg ${getFormColor(match.result)} flex items-center justify-center`}>
                                        <span className="text-xs font-bold text-white">{match.result}</span>
                                    </div>
                                    <span className="text-[9px] text-slate-400 truncate max-w-[48px] text-center leading-tight">
                                        {match.opponent}
                                    </span>
                                    <span className="text-[8px] text-slate-500">{formatShortDate(match.date)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* Section 4: Injury & Suspension Status */}
            {statusLoading ? (
                <SkeletonCard lines={3} />
            ) : (
                <section className="glass-panel rounded-2xl p-4">
                    <h3 className="text-sm font-bold text-white mb-3">Sakatlık ve Ceza Durumu</h3>
                    {statusError ? (
                        <p className="text-xs text-rose-300">{statusError}</p>
                    ) : activeStatusEntries.length === 0 ? (
                        <p className="text-xs text-slate-400">Sakatlık veya ceza verisi bulunmuyor.</p>
                    ) : (
                        <>
                            <div className="space-y-2">
                                {activeStatusEntries.map((entry, index) => {
                                    const badge = getStatusBadge(entry.status);
                                    return (
                                        <div key={`${entry.name}-${index}`} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                                            <div className="flex-1 min-w-0">
                                                <span className="text-sm text-white font-medium truncate block max-w-[180px]">
                                                    {entry.name}
                                                </span>
                                                {entry.detail && (
                                                    <span className="text-[11px] text-slate-400 block mt-0.5">{entry.detail}</span>
                                                )}
                                                {entry.returnDate && (
                                                    <span className="text-[10px] text-slate-500 block">Tahmini donus: {entry.returnDate}</span>
                                                )}
                                            </div>
                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${badge.className}`}>
                                                {badge.label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            {latestUpdatedAt > 0 && (
                                <p className="text-[10px] text-slate-500 mt-3 text-right">
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
