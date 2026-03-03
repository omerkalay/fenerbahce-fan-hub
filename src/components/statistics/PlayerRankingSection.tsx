import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { PlayerStat } from '../../types';
import SkeletonCard from './SkeletonCard';

type CompetitionTab = 'total' | 'league' | 'europa';
type RankingMetric = 'goals' | 'assists';

interface PlayerRankingSectionProps {
    title: string;
    players: PlayerStat[];
    loading: boolean;
    error: string | null;
    metric: RankingMetric;
    emptyMessage: string;
    emptyTabMessage: string;
}

const getPlayerValue = (player: PlayerStat, metric: RankingMetric, tab: CompetitionTab): number => {
    if (metric === 'goals') {
        if (tab === 'league') return player.leagueGoals;
        if (tab === 'europa') return player.europaGoals;
        return player.goals;
    }

    if (tab === 'league') return player.leagueAssists;
    if (tab === 'europa') return player.europaAssists;
    return player.assists;
};

const TAB_OPTIONS: Array<{ key: CompetitionTab; label: string }> = [
    { key: 'total', label: 'Toplam' },
    { key: 'league', label: 'Süper Lig' },
    { key: 'europa', label: 'Avrupa' },
];

const PlayerRankingSection: React.FC<PlayerRankingSectionProps> = ({
    title,
    players,
    loading,
    error,
    metric,
    emptyMessage,
    emptyTabMessage,
}) => {
    const [activeTab, setActiveTab] = useState<CompetitionTab>('total');
    const [expanded, setExpanded] = useState(false);

    const hasTotalData = players.some((player) => getPlayerValue(player, metric, 'total') > 0);
    const sorted = [...players]
        .sort((a, b) => getPlayerValue(b, metric, activeTab) - getPlayerValue(a, metric, activeTab))
        .filter((player) => getPlayerValue(player, metric, activeTab) > 0);

    if (loading) {
        return <SkeletonCard lines={5} />;
    }

    return (
        <section className="glass-panel rounded-2xl p-4">
            <h3 className="text-sm font-bold text-white mb-3">{title}</h3>
            {error ? (
                <p className="text-xs text-rose-300">{error}</p>
            ) : !hasTotalData ? (
                <p className="text-xs text-slate-400">{emptyMessage}</p>
            ) : (
                <>
                    <div className="flex gap-5 mb-3 border-b border-white/5">
                        {TAB_OPTIONS.map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => {
                                    setActiveTab(key);
                                    setExpanded(false);
                                }}
                                className={`relative text-xs font-medium pb-2 transition-all duration-200 tracking-wide ${activeTab === key
                                    ? 'text-yellow-300'
                                    : 'text-slate-500 hover:text-slate-400'}`}
                            >
                                {label}
                                {activeTab === key && (
                                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-yellow-400 rounded-full" />
                                )}
                            </button>
                        ))}
                    </div>

                    {sorted.length === 0 ? (
                        <p className="text-xs text-slate-400">{emptyTabMessage}</p>
                    ) : (
                        <>
                            <div className="space-y-1">
                                {sorted.slice(0, expanded ? 10 : 5).map((player, index) => (
                                    <div key={player.playerId} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                                        <span className="text-xs text-slate-500 w-5 text-right font-medium">{index + 1}</span>
                                        <span className="text-sm text-white truncate flex-1 max-w-[200px]">{player.name}</span>
                                        <span className="text-sm font-bold text-yellow-400">
                                            {getPlayerValue(player, metric, activeTab)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {sorted.length > 5 && (
                                <button
                                    onClick={() => setExpanded((value) => !value)}
                                    className="w-full flex items-center justify-center gap-1.5 mt-2 pt-2 border-t border-white/5 text-[11px] text-slate-400 hover:text-slate-300 transition-colors"
                                >
                                    <span>{expanded ? 'Daha Az' : 'Daha Fazla'}</span>
                                    <ChevronDown size={13} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                                </button>
                            )}
                        </>
                    )}
                </>
            )}
        </section>
    );
};

export default PlayerRankingSection;
