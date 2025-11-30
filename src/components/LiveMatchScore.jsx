import React, { useState, useEffect } from 'react';
import TeamLogo from './TeamLogo';
import { BACKEND_URL } from '../services/api';

const LiveMatchScore = () => {
    const [liveData, setLiveData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchLiveScore();
        // Refresh every 30 seconds during live match
        const interval = setInterval(fetchLiveScore, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchLiveScore = async () => {
        try {
            // Fetch from our backend
            const response = await fetch(`${BACKEND_URL}/api/live-match`);

            if (!response.ok) {
                if (response.status === 404) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Maç bulunamadı');
                }
                throw new Error('Failed to fetch live data');
            }

            const data = await response.json();
            setLiveData(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching live score:', err);
            setError(err.message || 'Canlı maç bilgisi yüklenemedi');
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

    const { header, competitions } = liveData;
    const competition = competitions?.[0];
    const homeTeam = competition?.competitors?.find(c => c.homeAway === 'home');
    const awayTeam = competition?.competitors?.find(c => c.homeAway === 'away');
    const status = header?.competitions?.[0]?.status;

    return (
        <div className="w-full space-y-6">
            {/* Score Board */}
            <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-yellow-400 uppercase">
                        {competition?.status?.type?.detail || 'Canlı'}
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                        <span className="text-sm font-bold text-red-400">CANLI</span>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4 items-center">
                    {/* Home Team */}
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-20 h-20 rounded-full bg-white/5 p-3 border border-white/10">
                            {homeTeam?.team?.logo ? (
                                <img
                                    src={homeTeam?.team?.logo}
                                    alt={homeTeam?.team?.displayName}
                                    className="w-full h-full object-contain"
                                />
                            ) : null}
                        </div>
                        <span className="text-sm font-bold text-center">{homeTeam?.team?.displayName}</span>
                    </div>

                    {/* Score */}
                    <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-4">
                            <span className="text-5xl font-black text-white">{homeTeam?.score || 0}</span>
                            <span className="text-3xl font-bold text-slate-600">-</span>
                            <span className="text-5xl font-black text-white">{awayTeam?.score || 0}</span>
                        </div>
                        <span className="text-xs text-slate-400">{status?.displayClock || ''}</span>
                    </div>

                    {/* Away Team */}
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-20 h-20 rounded-full bg-white/5 p-3 border border-white/10">
                            {awayTeam?.team?.logo ? (
                                <img
                                    src={awayTeam?.team?.logo}
                                    alt={awayTeam?.team?.displayName}
                                    className="w-full h-full object-contain"
                                />
                            ) : null}
                        </div>
                        <span className="text-sm font-bold text-center">{awayTeam?.team?.displayName}</span>
                    </div>
                </div>
            </div>

            {/* Match Events */}
            {competition?.details && competition.details.length > 0 && (
                <div className="glass-panel rounded-2xl p-4">
                    <h3 className="text-sm font-bold text-white mb-3">Maç Olayları</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                        {competition.details.map((event, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                            >
                                <span className="text-xs text-yellow-400 font-mono w-12">{event.clock?.displayValue || ''}</span>
                                <span className="text-sm flex-1">{event.type?.text || event.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Stats */}
            {competition?.statistics && (
                <div className="glass-panel rounded-2xl p-4">
                    <h3 className="text-sm font-bold text-white mb-3">İstatistikler</h3>
                    <div className="space-y-3">
                        {competition.statistics.slice(0, 5).map((stat, idx) => (
                            <div key={idx} className="space-y-1">
                                <div className="flex justify-between text-xs text-slate-400">
                                    <span>{stat.homeValue || 0}</span>
                                    <span>{stat.name}</span>
                                    <span>{stat.awayValue || 0}</span>
                                </div>
                                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden flex">
                                    <div
                                        className="bg-yellow-400 h-full transition-all"
                                        style={{
                                            width: `${(stat.homeValue / (stat.homeValue + stat.awayValue)) * 100}%`
                                        }}
                                    />
                                    <div className="bg-slate-600 h-full flex-1" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LiveMatchScore;
