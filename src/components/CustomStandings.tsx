import { useState, useEffect } from 'react';
import { fetchEspnStandings } from '../services/api';
import { localizeTeamName } from '../utils/localize';
import type { StandingsRow } from '../types';

interface CustomStandingsProps {
    league: string;
}

/* ── Zone configs ───────────────────────────────────────── */

interface Zone {
    ranks: number[];
    color: string;
    label: string;
}

const SUPERLIG_ZONES: Zone[] = [
    { ranks: [1], color: 'bg-blue-500', label: 'Şampiyonlar Ligi' },
    { ranks: [2], color: 'bg-blue-400', label: 'ŞL Eleme' },
    { ranks: [3], color: 'bg-orange-400', label: 'Avrupa Ligi Eleme' },
    { ranks: [4], color: 'bg-emerald-400', label: 'Konferans Ligi Eleme' },
    { ranks: [16, 17, 18], color: 'bg-red-500', label: 'Küme Düşme' },
];

const EUROPA_ZONES: Zone[] = [
    { ranks: [1, 2, 3, 4, 5, 6, 7, 8], color: 'bg-green-500', label: 'Son 16' },
    { ranks: [9, 10, 11, 12, 13, 14, 15, 16], color: 'bg-blue-400', label: 'Playoff (Seribaşı)' },
    { ranks: [17, 18, 19, 20, 21, 22, 23, 24], color: 'bg-orange-400', label: 'Playoff (Seribaşı Değil)' },
    { ranks: [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36], color: 'bg-red-500', label: 'Elendi' },
];

const getZones = (league: string): Zone[] =>
    league === 'superlig' ? SUPERLIG_ZONES : EUROPA_ZONES;

const getZoneColor = (rank: number, league: string): string | null => {
    const zones = getZones(league);
    const zone = zones.find(z => z.ranks.includes(rank));
    return zone?.color ?? null;
};

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

    const zones = getZones(league);

    return (
        <div className="w-full">
            {/* Zone legend */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 py-2.5 border-b border-white/5">
                {zones.map(z => (
                    <div key={z.label} className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${z.color}`} />
                        <span className="text-[10px] text-slate-500">{z.label}</span>
                    </div>
                ))}
            </div>

            <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10" style={{ background: 'rgba(15,23,42,0.97)' }}>
                    <tr className="text-[10px] sm:text-[11px] text-slate-400 bg-slate-700/20">
                        <th className="py-2.5 pl-3 pr-1 font-medium w-8 text-center">#</th>
                        <th className="py-2.5 px-1 font-medium">Takım</th>
                        <th className="py-2.5 px-1 font-medium w-8 text-center">O</th>
                        <th className="py-2.5 px-1 font-medium w-8 text-center">G</th>
                        <th className="py-2.5 px-1 font-medium w-8 text-center">B</th>
                        <th className="py-2.5 px-1 font-medium w-8 text-center">M</th>
                        <th className="py-2.5 px-1 font-medium w-9 text-center">AV</th>
                        <th className="py-2.5 pr-3 pl-1 font-medium w-8 text-center">P</th>
                    </tr>
                    <tr>
                        <th colSpan={8} className="p-0"><div className="border-b border-white/10" /></th>
                    </tr>
                </thead>
                <tbody className="text-xs sm:text-sm">
                    {standings.map((row) => {
                        const isFener = row.team.name.toLowerCase().includes('fenerbahce') ||
                            row.team.name.toLowerCase().includes('fener');
                        const zoneColor = getZoneColor(row.rank, league);

                        return (
                            <tr
                                key={row.team.id}
                                className={`border-b border-white/5 last:border-0 transition-colors duration-200 ${isFener
                                    ? 'bg-yellow-400/[0.08] text-yellow-50 shadow-[inset_0_0_20px_rgba(234,179,8,0.08)]'
                                    : 'hover:bg-white/[0.03] text-slate-300'
                                    }`}
                            >
                                <td className="py-2 pl-3 pr-1 text-center">
                                    <div className="flex items-center gap-1">
                                        {zoneColor ? (
                                            <span className={`w-[3px] h-4 rounded-full ${zoneColor} flex-shrink-0`} />
                                        ) : (
                                            <span className="w-[3px] flex-shrink-0" />
                                        )}
                                        <span className={`inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 text-[10px] sm:text-[11px] font-bold ${
                                            isFener ? 'text-yellow-400' : 'text-slate-400'
                                        }`}>
                                            {row.rank}
                                        </span>
                                    </div>
                                </td>
                                <td className="py-2 px-1">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0">
                                            {row.team.logo ? (
                                                <img
                                                    src={row.team.logo}
                                                    alt={localizeTeamName(row.team.name)}
                                                    className="w-full h-full object-contain"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                    }}
                                                />
                                            ) : null}
                                        </div>
                                        <span className={`truncate text-xs sm:text-sm ${isFener ? 'font-semibold' : ''}`}>
                                            {localizeTeamName(row.team.name)}
                                        </span>
                                    </div>
                                </td>
                                <td className="py-2 px-1 text-center text-slate-400">{row.matches || 0}</td>
                                <td className="py-2 px-1 text-center text-slate-300">{row.wins || 0}</td>
                                <td className="py-2 px-1 text-center text-slate-500">{row.draws || 0}</td>
                                <td className="py-2 px-1 text-center text-slate-300">{row.losses || 0}</td>
                                <td className="py-2 px-1 text-center text-slate-400">
                                    {row.goalDiff > 0 ? '+' : ''}
                                    {row.goalDiff || 0}
                                </td>
                                <td className={`py-2 pr-3 pl-1 text-center font-bold ${isFener ? 'text-yellow-400' : 'text-white'}`}>
                                    {row.points || 0}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default CustomStandings;
