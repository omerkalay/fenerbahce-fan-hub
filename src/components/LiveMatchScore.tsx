import { useState, useEffect } from 'react';
import { BACKEND_URL } from '../services/api';
import MatchEventIcon, { getEventVisualType } from './MatchEventIcon';
import { formatMatchClock } from '../utils/matchClock';
import type { LiveMatchData, MatchStat } from '../types';

interface StatGroup {
    label: string;
    keys: string[];
}

const STAT_GROUPS: StatGroup[] = [
    { label: 'Toplam Şut', keys: ['totalShots'] },
    { label: 'İsabetli Şut', keys: ['shotsOnTarget'] },
    { label: 'Topla Oynama %', keys: ['possessionPct', 'possession'] },
    { label: 'Korner', keys: ['wonCorners', 'corners'] },
    { label: 'Faul', keys: ['foulsCommitted', 'fouls'] },
    { label: 'Sarı Kart', keys: ['yellowCards', 'yellowCard'] },
    { label: 'Kırmızı Kart', keys: ['redCards', 'redCard'] }
];

const isHalftimeDisplay = (statusDetail: string = '', displayClock: string = ''): boolean => {
    const status = String(statusDetail || '').trim().toLowerCase();
    const clock = String(displayClock || '').trim().toLowerCase();

    return (
        status === 'ht' ||
        status === 'halftime' ||
        status.includes('half time') ||
        status.includes('devre') ||
        clock === 'ht'
    );
};

const localizeStatusDetail = (statusDetail: string = ''): string => {
    const status = String(statusDetail || '').trim();
    const normalized = status.toLowerCase();

    if (normalized === 'ft' || normalized === 'full time' || normalized.includes('full time')) {
        return 'Maç Sonu';
    }

    if (normalized === 'ht' || normalized === 'halftime' || normalized.includes('half time')) {
        return 'Devre Arası';
    }

    return status;
};

const LiveMatchScore = () => {
    const [liveData, setLiveData] = useState<LiveMatchData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchLiveScore();
        const interval = setInterval(fetchLiveScore, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchLiveScore = async () => {
        try {
            const response = await fetch(`${BACKEND_URL}/live-match`);
            if (!response.ok) {
                throw new Error('Canlı maç verisi alınamadı');
            }
            const data: LiveMatchData = await response.json();
            if (data.matchState === 'no-match') {
                setError('Şu anda canlı maç yok');
                setLiveData(null);
            } else {
                setLiveData(data);
                setError(null);
            }
        } catch (err) {
            console.error('Error fetching live score:', err);
            setError(err instanceof Error ? err.message : 'Canlı maç bilgisi yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
            </div>
        );
    }

    if (error || !liveData) {
        return (
            <div className="text-center text-red-400 py-8">
                <p>{error || 'Veri bulunamadı'}</p>
            </div>
        );
    }

    const orderedStats: (MatchStat & { label: string })[] = STAT_GROUPS
        .map((group) => {
            const stat = liveData.stats?.find((item) => group.keys.includes(item.name));
            if (!stat) return null;
            return {
                ...stat,
                label: group.label
            };
        })
        .filter((s): s is MatchStat & { label: string } => s !== null);

    const isHalftime = isHalftimeDisplay(liveData.statusDetail, liveData.displayClock);
    const statusLabel = isHalftime
        ? 'Devre Arası'
        : (localizeStatusDetail(liveData.statusDetail) || (liveData.matchState === 'in' ? 'Canlı' : 'Maç Bitti'));
    const centerClockLabel = liveData.displayClock || '';

    return (
        <div className="w-full space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {/* Score Board */}
            <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-yellow-400 uppercase">
                        {statusLabel}
                    </span>
                    {liveData.matchState === 'in' && (
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                            <span className="text-sm font-bold text-red-400">
                                {isHalftime ? 'DEVRE ARASI' : 'CANLI'}
                            </span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-3 gap-4 items-center">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-20 h-20 rounded-full bg-white/5 p-3 border border-white/10">
                            {liveData.homeTeam?.logo && (
                                <img
                                    src={liveData.homeTeam.logo}
                                    alt={liveData.homeTeam.name}
                                    className="w-full h-full object-contain"
                                />
                            )}
                        </div>
                        <span className="text-sm font-bold text-center">{liveData.homeTeam?.name}</span>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-4">
                            <span className="text-5xl font-black text-white">{liveData.homeTeam?.score || '0'}</span>
                            <span className="text-3xl font-bold text-slate-600">-</span>
                            <span className="text-5xl font-black text-white">{liveData.awayTeam?.score || '0'}</span>
                        </div>
                        <span className="text-xs text-slate-400">{centerClockLabel}</span>
                    </div>

                    <div className="flex flex-col items-center gap-3">
                        <div className="w-20 h-20 rounded-full bg-white/5 p-3 border border-white/10">
                            {liveData.awayTeam?.logo && (
                                <img
                                    src={liveData.awayTeam.logo}
                                    alt={liveData.awayTeam.name}
                                    className="w-full h-full object-contain"
                                />
                            )}
                        </div>
                        <span className="text-sm font-bold text-center">{liveData.awayTeam?.name}</span>
                    </div>
                </div>
            </div>

            {/* Match Events */}
            {liveData.events && liveData.events.length > 0 && (
                <div className="glass-panel rounded-2xl p-4">
                    <h3 className="text-sm font-bold text-white mb-3">Maç Olayları</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                        {liveData.events.map((event, idx) => {
                            const eventType = getEventVisualType(event);
                            const rowClass = eventType === 'goal'
                                ? 'bg-yellow-400/10'
                                : eventType === 'red-card'
                                    ? 'bg-red-500/10'
                                    : eventType === 'substitution'
                                        ? 'bg-emerald-400/10'
                                        : 'bg-white/5';
                            const textClass = eventType === 'goal'
                                ? 'text-yellow-400 font-bold'
                                : eventType === 'red-card'
                                    ? 'text-red-400 font-semibold'
                                    : eventType === 'substitution'
                                        ? 'text-emerald-300 font-medium'
                                        : 'text-slate-300';

                            return (
                                <div
                                    key={idx}
                                    className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${rowClass}`}
                                >
                                    <span className="text-xs text-yellow-400 font-mono w-12">{formatMatchClock(event.clock)}</span>
                                    <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                                        <MatchEventIcon event={event} className={eventType === 'goal' ? 'w-4 h-4' : 'w-3.5 h-5'} />
                                    </span>
                                    <span className={`text-sm flex-1 ${textClass}`}>
                                        {event.player}
                                        {event.isSubstitution && event.playerOut && (
                                            <span className="text-slate-400 ml-1">↔ {event.playerOut}</span>
                                        )}
                                        {event.isGoal && event.isPenalty && (
                                            <span className="text-yellow-300/90 font-semibold ml-1">(P)</span>
                                        )}
                                        {event.isGoal && event.assist && (
                                            <span className="text-slate-300/80 font-medium ml-2">Asist: {event.assist}</span>
                                        )}
                                        {event.type && !event.isGoal && !event.isYellowCard && !event.isRedCard && !event.isSubstitution && (
                                            <span className="text-slate-500 ml-1">({event.type})</span>
                                        )}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Stats */}
            {orderedStats.length > 0 && (
                <div className="glass-panel rounded-2xl p-4">
                    <h3 className="text-sm font-bold text-white mb-3">İstatistikler</h3>
                    <div className="space-y-3">
                        {orderedStats.map((stat, idx) => {
                                const homeVal = parseFloat(stat.homeValue) || 0;
                                const awayVal = parseFloat(stat.awayValue) || 0;
                                const total = homeVal + awayVal || 1;
                                return (
                                    <div key={idx} className="space-y-1">
                                        <div className="flex justify-between text-xs text-slate-400">
                                            <span className="font-medium text-white">{stat.homeValue}</span>
                                            <span>{stat.label}</span>
                                            <span className="font-medium text-white">{stat.awayValue}</span>
                                        </div>
                                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden flex">
                                            <div
                                                className="bg-yellow-400 h-full transition-all duration-500"
                                                style={{ width: `${(homeVal / total) * 100}%` }}
                                            />
                                            <div className="bg-slate-600 h-full flex-1" />
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LiveMatchScore;
