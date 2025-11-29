import React, { useState, useEffect } from 'react';
import TeamLogo from './TeamLogo';
import { fetchStandings } from '../services/api';

const Standings = () => {
    const [standings, setStandings] = useState([]);
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadStandings = async () => {
            try {
                const data = await fetchStandings();
                setStandings(data);
            } catch (err) {
                console.error('Standings error:', err);
                setError('Puan durumu yüklenemedi.');
            } finally {
                setLoading(false);
            }
        };

        loadStandings();
    }, []);

    if (loading) return <div className="text-center text-slate-500 py-4 animate-pulse">Puan durumu yükleniyor...</div>;
    if (error) return <div className="text-center text-red-400 py-4 text-sm">{error}</div>;
    if (!standings || standings.length === 0) return null;

    const activeLeague = standings[activeTab];

    return (
        <div className="glass-panel rounded-2xl p-4 mt-6">
            {/* Header & Tabs */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white">Puan Durumu</h3>

                {standings.length > 1 && (
                    <div className="flex bg-slate-950/50 rounded-lg p-1 gap-1">
                        {standings.map((league, idx) => (
                            <button
                                key={league.id}
                                onClick={() => setActiveTab(idx)}
                                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${activeTab === idx
                                        ? 'bg-yellow-400 text-black shadow-lg'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                {league.name.replace('Trendyol ', '')}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-[10px] text-slate-400 border-b border-white/5">
                            <th className="p-2 font-medium w-6 text-center">#</th>
                            <th className="p-2 font-medium">Takım</th>
                            <th className="p-2 font-medium w-8 text-center">O</th>
                            <th className="p-2 font-medium w-8 text-center">AV</th>
                            <th className="p-2 font-medium w-8 text-center text-yellow-400">P</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs">
                        {activeLeague.rows.map((row) => {
                            const isFener = row.team.id === 3052;
                            return (
                                <tr
                                    key={row.id}
                                    className={`border-b border-white/5 last:border-0 transition-colors ${isFener
                                            ? 'bg-yellow-400/10 text-yellow-100 font-semibold'
                                            : 'hover:bg-white/5 text-slate-300'
                                        }`}
                                >
                                    <td className="p-2 text-center">
                                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] ${row.position <= 3 ? 'bg-green-500/20 text-green-400' :
                                                row.position >= 17 ? 'bg-red-500/20 text-red-400' : 'text-slate-500'
                                            }`}>
                                            {row.position}
                                        </span>
                                    </td>
                                    <td className="p-2 flex items-center gap-2">
                                        <TeamLogo
                                            teamId={row.team.id}
                                            name={row.team.name}
                                            wrapperClassName="w-6 h-6 flex-shrink-0"
                                            imageClassName="object-contain"
                                        />
                                        <span className="truncate max-w-[120px]">{row.team.name}</span>
                                    </td>
                                    <td className="p-2 text-center font-medium">{row.matches}</td>
                                    <td className="p-2 text-center text-slate-400">{row.scoresFor - row.scoresAgainst}</td>
                                    <td className={`p-2 text-center font-bold ${isFener ? 'text-yellow-400' : 'text-white'}`}>
                                        {row.points}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Standings;
