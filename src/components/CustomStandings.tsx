import { useState, useEffect } from 'react';
import TeamLogo from './TeamLogo';
import { fetchEspnStandings } from '../services/api';
import type { StandingsRow } from '../types';

interface CustomStandingsProps {
    league: string;
}

const CustomStandings = ({ league }: CustomStandingsProps) => {
    const [standings, setStandings] = useState<StandingsRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError(null);

            const leagueId = league === 'superlig' ? 'super-lig' : 'europa-league';
            const data = await fetchEspnStandings(leagueId);

            if (cancelled) return;

            if (data && data.rows) {
                setStandings(data.rows);
            } else {
                setError('Puan durumu yüklenemedi');
            }
            setLoading(false);
        };

        load();
        return () => { cancelled = true; };
    }, [league]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center text-red-400 py-8">
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-[#0f172a] z-10">
                        <tr className="text-[11px] text-slate-400 border-b border-yellow-400/20">
                            <th className="p-3 font-medium w-12 text-center">#</th>
                            <th className="p-3 font-medium">Takım</th>
                            <th className="p-3 font-medium w-12 text-center">O</th>
                            <th className="p-3 font-medium w-12 text-center">G</th>
                            <th className="p-3 font-medium w-12 text-center">B</th>
                            <th className="p-3 font-medium w-12 text-center">M</th>
                            <th className="p-3 font-medium w-16 text-center">AV</th>
                            <th className="p-3 font-medium w-12 text-center text-yellow-400">P</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {standings.map((row) => {
                            const isFener = row.team.name.toLowerCase().includes('fenerbahce') ||
                                row.team.name.toLowerCase().includes('fener');
                            const isTopThree = row.rank <= 3;
                            const isBottomThree = row.rank >= standings.length - 2;

                            return (
                                <tr
                                    key={row.team.id}
                                    className={`border-b border-white/5 last:border-0 transition-all duration-200 ${isFener
                                        ? 'bg-yellow-400/10 text-yellow-100 font-semibold shadow-[0_0_10px_rgba(234,179,8,0.3)]'
                                        : 'hover:bg-white/5 text-slate-300'
                                        }`}
                                >
                                    <td className="p-3 text-center">
                                        <span
                                            className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold ${isTopThree
                                                ? 'bg-green-500/20 text-green-400'
                                                : isBottomThree
                                                    ? 'bg-red-500/20 text-red-400'
                                                    : 'text-slate-500'
                                                }`}
                                        >
                                            {row.rank}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 flex-shrink-0">
                                                {row.team.logo ? (
                                                    <img
                                                        src={row.team.logo}
                                                        alt={row.team.name}
                                                        className="w-full h-full object-contain"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                        }}
                                                    />
                                                ) : null}
                                            </div>
                                            <span className="truncate max-w-[200px]">{row.team.name}</span>
                                        </div>
                                    </td>
                                    <td className="p-3 text-center font-medium">{row.matches || 0}</td>
                                    <td className="p-3 text-center text-green-400">{row.wins || 0}</td>
                                    <td className="p-3 text-center text-slate-400">{row.draws || 0}</td>
                                    <td className="p-3 text-center text-red-400">{row.losses || 0}</td>
                                    <td className="p-3 text-center text-slate-400">
                                        {row.goalDiff > 0 ? '+' : ''}
                                        {row.goalDiff || 0}
                                    </td>
                                    <td className={`p-3 text-center font-bold ${isFener ? 'text-yellow-400' : 'text-white'}`}>
                                        {row.points || 0}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(250, 204, 21, 0.3);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(250, 204, 21, 0.5);
                }
            `}</style>
        </div>
    );
};

export default CustomStandings;
