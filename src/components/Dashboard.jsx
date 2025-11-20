import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../services/api';

const getTeamLogo = (teamId) => `${BACKEND_URL}/api/team-image/${teamId}`;

const Dashboard = ({ matchData, next3Matches = [], loading }) => {
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

    useEffect(() => {
        if (!matchData) return;

        const timer = setInterval(() => {
            const matchDate = new Date(matchData.startTimestamp * 1000);
            const now = new Date();
            const difference = matchDate - now;

            if (difference > 0) {
                const days = Math.floor(difference / (1000 * 60 * 60 * 24));
                const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
                const minutes = Math.floor((difference / 1000 / 60) % 60);
                const seconds = Math.floor((difference / 1000) % 60);
                setTimeLeft({ days, hours, minutes, seconds });
            } else {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [matchData]);

    if (loading) return <div className="flex items-center justify-center h-64 text-yellow-400 animate-pulse">Yükleniyor...</div>;
    if (!matchData) return <div className="text-center text-slate-400 mt-10">Maç bilgisi bulunamadı.</div>;

    const matchDate = new Date(matchData.startTimestamp * 1000);
    const isHome = matchData.homeTeam.id === 3052; // 3052 is FB ID
    const opponent = isHome ? matchData.awayTeam : matchData.homeTeam;

    const fbLogo = getTeamLogo(3052);
    const opponentLogo = getTeamLogo(opponent.id);

    return (
        <div className="space-y-6 pb-20">
            {/* Hero Section: Next Match Card */}
            <div className="glass-card rounded-3xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-50"></div>

                <div className="flex justify-between items-center mb-6 relative z-10">
                    <span className="text-xs font-bold tracking-wider text-yellow-400 uppercase bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/20">
                        {matchData.tournament.name}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                        {matchDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                    </span>
                </div>

                <div className="flex items-center justify-between relative z-10">
                    <div className="flex flex-col items-center gap-3 w-1/3">
                        <div className="w-16 h-16 rounded-full bg-white/5 p-2 border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                            <img src={isHome ? fbLogo : opponentLogo} alt="Home" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-sm font-bold text-center leading-tight">
                            {isHome ? "Fenerbahçe" : opponent.name}
                        </span>
                    </div>

                    <div className="flex flex-col items-center justify-center w-1/3 -mt-4">
                        <span className="text-2xl font-black text-slate-700/50">VS</span>
                        <div className="mt-2 text-center">
                            <span className="text-3xl font-bold text-white tracking-tighter text-glow">
                                {matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-3 w-1/3">
                        <div className="w-16 h-16 rounded-full bg-white/5 p-2 border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                            <img src={!isHome ? fbLogo : opponentLogo} alt="Away" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-sm font-bold text-center leading-tight">
                            {!isHome ? "Fenerbahçe" : opponent.name}
                        </span>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5">
                    <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="glass-panel rounded-lg p-2">
                            <span className="block text-xl font-bold text-yellow-400">{timeLeft.days}</span>
                            <span className="text-[10px] text-slate-400 uppercase">Gün</span>
                        </div>
                        <div className="glass-panel rounded-lg p-2">
                            <span className="block text-xl font-bold text-yellow-400">{timeLeft.hours}</span>
                            <span className="text-[10px] text-slate-400 uppercase">Saat</span>
                        </div>
                        <div className="glass-panel rounded-lg p-2">
                            <span className="block text-xl font-bold text-yellow-400">{timeLeft.minutes}</span>
                            <span className="text-[10px] text-slate-400 uppercase">Dk</span>
                        </div>
                        <div className="glass-panel rounded-lg p-2">
                            <span className="block text-xl font-bold text-yellow-400">{timeLeft.seconds}</span>
                            <span className="text-[10px] text-slate-400 uppercase">Sn</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Next 3 Matches */}
            <div className="glass-panel rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm font-bold">Sonraki Maçlar</span>
                </div>
                <div className="space-y-3">
                    {next3Matches.length > 0 ? next3Matches.map((match, idx) => {
                        const date = new Date(match.startTimestamp * 1000);
                        const homeTeam = match.homeTeam;
                        const awayTeam = match.awayTeam;
                        const isFbHome = homeTeam.id === 3052;

                        return (
                            <div key={idx} className="glass-panel rounded-xl p-3 flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                    <div className="w-8 h-8 rounded-full bg-white/5 p-1 flex-shrink-0">
                                        <img
                                            src={isFbHome ? fbLogo : getTeamLogo(homeTeam.id)}
                                            alt={homeTeam.name}
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                    <span className="text-xs font-medium truncate">{homeTeam.name}</span>
                                </div>
                                <div className="flex flex-col items-center px-3">
                                    <span className="text-[10px] text-slate-400">{date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
                                    <span className="text-xs font-bold">{date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-1 justify-end">
                                    <span className="text-xs font-medium truncate text-right">{awayTeam.name}</span>
                                    <div className="w-8 h-8 rounded-full bg-white/5 p-1 flex-shrink-0">
                                        <img
                                            src={!isFbHome ? fbLogo : getTeamLogo(awayTeam.id)}
                                            alt={awayTeam.name}
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="text-center text-slate-500 text-xs py-4">Maç bilgisi yükleniyor...</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
