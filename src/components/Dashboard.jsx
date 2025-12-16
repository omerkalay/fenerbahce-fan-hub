import React, { useState, useEffect } from 'react';
import TeamLogo from './TeamLogo';
import Poll from './Poll';
import CustomStandings from './CustomStandings';
import LiveMatchScore from './LiveMatchScore';

const Dashboard = ({
    matchData,
    next3Matches = [],
    loading,
    onRetry,
    errorMessage,
    lastUpdated,
    isRefreshing
}) => {
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    const [showLiveMatchModal, setShowLiveMatchModal] = useState(false);
    const [showStandingsModal, setShowStandingsModal] = useState(false);
    const [standingsLeague, setStandingsLeague] = useState('');

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

    // Modal açıkken arka plan scroll'unu engelle
    useEffect(() => {
        if (showLiveMatchModal || showStandingsModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showLiveMatchModal, showStandingsModal]);

    if (loading) return <div className="flex items-center justify-center h-64 text-yellow-400 animate-pulse">Yükleniyor...</div>;
    if (!matchData) {
        return (
            <div className="text-center text-slate-400 mt-10 space-y-4">
                <p>Maç bilgisi bulunamadı.</p>
                {errorMessage && (
                    <p className="text-sm text-slate-300">{errorMessage}</p>
                )}
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="px-4 py-2 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 hover:bg-yellow-400 hover:text-black transition-colors"
                    >
                        Tekrar Dene
                    </button>
                )}
            </div>
        );
    }

    const matchDate = new Date(matchData.startTimestamp * 1000);
    const FENERBAHCE_ID = 3052;
    const isHome = matchData.homeTeam.id === 3052; // 3052 is FB ID
    const opponent = isHome ? matchData.awayTeam : matchData.homeTeam;

    // Check if match is currently live
    const now = new Date();
    const matchEndTime = new Date(matchDate.getTime() + (120 * 60 * 1000)); // 2 hours after start
    const isMatchLive = now >= matchDate && now <= matchEndTime && matchData.status?.type === 'inprogress';

    return (
        <div className="min-h-screen pb-20">
            {/* Hero Section: Next Match Card */}
            <div className="glass-card rounded-3xl p-6 relative overflow-hidden group mb-6">
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
                            <TeamLogo
                                teamId={isHome ? FENERBAHCE_ID : opponent.id}
                                name={isHome ? 'Fenerbahçe' : opponent.name}
                                wrapperClassName="w-full h-full"
                                imageClassName="object-contain"
                            />
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
                            <TeamLogo
                                teamId={!isHome ? FENERBAHCE_ID : opponent.id}
                                name={!isHome ? 'Fenerbahçe' : opponent.name}
                                wrapperClassName="w-full h-full"
                                imageClassName="object-contain"
                            />
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

                {/* Live Match Badge and Button */}
                {isMatchLive && (
                    <div className="mt-6 pt-6 border-t border-white/5">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                                <span className="text-sm font-bold text-red-400 uppercase">Canlı</span>
                            </div>
                            <button
                                onClick={() => setShowLiveMatchModal(true)}
                                className="px-4 py-2 bg-yellow-400/10 hover:bg-yellow-400 text-yellow-400 hover:text-black border border-yellow-400/30 hover:border-yellow-400 rounded-lg text-xs font-bold transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(234,179,8,0.5)]"
                            >
                                Canlı Detayları Göster
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Next 3 Matches */}
            {/* Next 3 Matches */}
            <div className="glass-panel rounded-2xl p-4 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm font-bold">Sonraki Maçlar</span>
                </div>
                <div className="space-y-3">
                    {next3Matches.length > 0 ? next3Matches.map((match, idx) => {
                        const date = new Date(match.startTimestamp * 1000);
                        const homeTeam = match.homeTeam;
                        const awayTeam = match.awayTeam;
                        const isFbHome = homeTeam.id === FENERBAHCE_ID;

                        return (
                            <div key={idx} className="glass-panel rounded-xl p-3 flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                    <TeamLogo
                                        teamId={isFbHome ? FENERBAHCE_ID : homeTeam.id}
                                        name={homeTeam.name}
                                        wrapperClassName="w-8 h-8 rounded-full bg-white/5 p-1 flex-shrink-0 border border-white/10"
                                        imageClassName="object-contain"
                                    />
                                    <span className="text-xs font-medium truncate">{homeTeam.name}</span>
                                </div>
                                <div className="flex flex-col items-center px-3">
                                    <span className="text-[10px] text-slate-400">{date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
                                    <span className="text-xs font-bold">{date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-1 justify-end">
                                    <span className="text-xs font-medium truncate text-right">{awayTeam.name}</span>
                                    <TeamLogo
                                        teamId={!isFbHome ? FENERBAHCE_ID : awayTeam.id}
                                        name={awayTeam.name}
                                        wrapperClassName="w-8 h-8 rounded-full bg-white/5 p-1 flex-shrink-0 border border-white/10"
                                        imageClassName="object-contain"
                                    />
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="text-center text-slate-500 text-xs py-4">Maç bilgisi yükleniyor...</div>
                    )}
                </div>
            </div>

            {/* Puan Durumu Buttons */}
            <div className="glass-panel rounded-2xl p-4 mb-6">
                <h3 className="text-sm font-bold text-white mb-4">Puan Durumu</h3>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => {
                            setStandingsLeague('superlig');
                            setShowStandingsModal(true);
                        }}
                        className="px-4 py-3 bg-yellow-400/5 hover:bg-yellow-400 text-yellow-400 hover:text-black border border-yellow-400/30 hover:border-yellow-400 rounded-xl text-sm font-bold transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                    >
                        Süper Lig
                    </button>
                    <button
                        onClick={() => {
                            setStandingsLeague('europa');
                            setShowStandingsModal(true);
                        }}
                        className="px-4 py-3 bg-yellow-400/5 hover:bg-yellow-400 text-yellow-400 hover:text-black border border-yellow-400/30 hover:border-yellow-400 rounded-xl text-sm font-bold transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                    >
                        Avrupa Ligi
                    </button>
                </div>
            </div>

            {/* Standings */}
            {/* Poll */}
            <div className="mb-6">
                <div className="mb-6">
                    <Poll opponentName={opponent.name} matchId={matchData.id} />
                </div>
            </div>



            {/* Live Match Modal */}
            {/* Live Match Modal */}
            {showLiveMatchModal && (
                <div
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fadeIn"
                    onClick={() => setShowLiveMatchModal(false)}
                >
                    <div
                        className="bg-[#0f172a] border-2 border-yellow-400/30 rounded-2xl p-6 max-w-4xl w-full max-h-[85vh] overflow-hidden animate-slideUp shadow-[0_0_40px_rgba(234,179,8,0.2)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center mb-4 pb-4 border-b border-yellow-400/20">
                            <div className="flex items-center gap-3">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                                <h2 className="text-xl font-bold text-yellow-400">Canlı Maç Detayları</h2>
                            </div>
                            <button
                                onClick={() => setShowLiveMatchModal(false)}
                                className="text-yellow-400 hover:text-white transition-all duration-300 hover:rotate-90"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Live Match Component */}
                        <div className="w-full">
                            <LiveMatchScore />
                        </div>
                    </div>
                </div>
            )}

            {/* Standings Modal */}
            {showStandingsModal && (
                <div
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fadeIn"
                    onClick={() => setShowStandingsModal(false)}
                >
                    <div
                        className="bg-[#0f172a] border-2 border-yellow-400/30 rounded-2xl p-6 max-w-4xl w-full max-h-[85vh] overflow-hidden animate-slideUp shadow-[0_0_40px_rgba(234,179,8,0.2)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center mb-4 pb-4 border-b border-yellow-400/20">
                            <h2 className="text-xl font-bold text-yellow-400">
                                {standingsLeague === 'superlig' ? 'Süper Lig Puan Durumu' : 'UEFA Avrupa Ligi Puan Durumu'}
                            </h2>
                            <button
                                onClick={() => setShowStandingsModal(false)}
                                className="text-yellow-400 hover:text-white hover:rotate-90 transition-all duration-300"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Custom Standings Component */}
                        <div className="w-full">
                            <CustomStandings league={standingsLeague} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
