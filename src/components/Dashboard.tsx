import { useState, useEffect } from 'react';
import TeamLogo from './TeamLogo';
import Poll from './Poll';
import MatchCountdown from './MatchCountdown';
import NextMatchesPanel from './NextMatchesPanel';
import StandingsModal from './StandingsModal';
import LiveMatchModal from './LiveMatchModal';
import MatchEventIcon, { getEventVisualType } from './MatchEventIcon';
import { formatMatchClock } from '../utils/matchClock';
import type { MatchData, LiveMatchState, LiveMatchData, MatchEvent } from '../types';

const isHalftimeDisplay = (statusDetail = '', displayClock = ''): boolean => {
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

interface DashboardProps {
    matchData: MatchData | null;
    next3Matches: MatchData[];
    loading: boolean;
    onRetry: (() => void) | undefined;
    errorMessage: string | null;
    lastUpdated: number | null;
    isRefreshing: boolean;
    liveMatchState: LiveMatchState;
    liveMatchData: LiveMatchData | null;
    onCountdownEnd: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({
    matchData,
    next3Matches = [],
    loading,
    onRetry,
    errorMessage,
    lastUpdated,
    isRefreshing,
    liveMatchState = 'countdown',
    liveMatchData = null,
    onCountdownEnd
}) => {
    const [showLiveMatchModal, setShowLiveMatchModal] = useState<boolean>(false);
    const [showStandingsModal, setShowStandingsModal] = useState<boolean>(false);
    const [standingsLeague, setStandingsLeague] = useState<string>('');

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
    const FENERBAHCE_ID: number = 3052;
    const isHome = matchData.homeTeam.id === 3052; // 3052 is FB ID
    const opponent = isHome ? matchData.awayTeam : matchData.homeTeam;
    const isLiveHalftime = liveMatchState === 'in' && liveMatchData
        ? isHalftimeDisplay(liveMatchData.statusDetail, liveMatchData.displayClock)
        : false;

    // Live state is now managed by App.jsx via liveMatchState prop

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

                {/* Dynamic Section: Countdown / Pre / Live / Post */}
                <div className="mt-8 pt-6 border-t border-white/5">
                    {/* STATE: CHECKING (prevent stale cached flicker on first paint) */}
                    {liveMatchState === 'checking' && (
                        <div className="text-center py-4">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-60"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-400"></span>
                                </span>
                                <span className="text-sm font-bold text-yellow-400 uppercase">Maç Durumu Kontrol Ediliyor</span>
                            </div>
                            <p className="text-xs text-slate-400">Son durum senkronize ediliyor...</p>
                        </div>
                    )}

                    {/* STATE: COUNTDOWN */}
                    <MatchCountdown
                        matchData={matchData}
                        liveMatchState={liveMatchState}
                        onCountdownEnd={onCountdownEnd}
                    />

                    {/* STATE: PRE (match about to start) */}
                    {liveMatchState === 'pre' && (
                        <div className="text-center py-4">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-400"></span>
                                </span>
                                <span className="text-sm font-bold text-yellow-400 uppercase">Maç Birazdan Başlıyor!</span>
                            </div>
                            <p className="text-xs text-slate-400">Takımlar sahaya çıkıyor...</p>
                        </div>
                    )}

                    {/* STATE: IN (live match) */}
                    {liveMatchState === 'in' && liveMatchData && (
                        <div>
                            {/* Live Badge */}
                            <div className="flex items-center justify-center gap-2 mb-4">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                                <span className="text-sm font-bold text-red-400 uppercase">
                                    {isLiveHalftime ? 'Devre Arası' : 'Canlı'}
                                </span>
                                {!isLiveHalftime && liveMatchData.displayClock && (
                                    <span className="text-xs text-slate-400 ml-1">{liveMatchData.displayClock}</span>
                                )}
                            </div>

                            {/* Score */}
                            <div className="flex items-center justify-center gap-6 mb-4">
                                <span className="text-4xl font-black text-white">{liveMatchData.homeTeam?.score || '0'}</span>
                                <span className="text-lg text-slate-500">—</span>
                                <span className="text-4xl font-black text-white">{liveMatchData.awayTeam?.score || '0'}</span>
                            </div>

                            {/* Events */}
                            {liveMatchData.events && liveMatchData.events.length > 0 && (
                                <div className="space-y-1 mb-4 max-h-32 overflow-y-auto">
                                    {liveMatchData.events
                                        .filter((event: MatchEvent) => !event.isSubstitution)
                                        .map((event: MatchEvent, idx: number) => {
                                            const eventType = getEventVisualType(event);
                                            const textClass = eventType === 'goal'
                                                ? 'text-yellow-400 font-bold'
                                                : eventType === 'red-card'
                                                    ? 'text-red-400'
                                                    : 'text-slate-300';

                                            return (
                                                <div key={idx} className="flex items-center gap-2 text-xs">
                                                    <span className="text-slate-500 w-10 text-right">{formatMatchClock(event.clock)}</span>
                                                    <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                                                        <MatchEventIcon
                                                            event={event}
                                                            className={eventType === 'goal' ? 'w-4 h-4' : 'w-3 h-4'}
                                                        />
                                                    </span>
                                                    <span className={textClass}>
                                                        {event.player}
                                                        {event.isGoal && event.isPenalty && (
                                                            <span className="text-yellow-300/90 font-semibold ml-1">(P)</span>
                                                        )}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}

                            {/* Detail Button */}
                            <button
                                onClick={() => setShowLiveMatchModal(true)}
                                className="w-full px-4 py-2 bg-yellow-400/10 hover:bg-yellow-400 text-yellow-400 hover:text-black border border-yellow-400/30 rounded-lg text-xs font-bold transition-all duration-300"
                            >
                                Detaylı İstatistikler
                            </button>
                        </div>
                    )}

                    {/* STATE: POST (match finished) */}
                    {liveMatchState === 'post' && liveMatchData && (
                        <div>
                            {/* Finished Badge */}
                            <div className="flex items-center justify-center gap-2 mb-4">
                                <span className="text-sm font-bold text-green-400 uppercase">Maç Bitti</span>
                            </div>

                            {/* Final Score */}
                            <div className="flex items-center justify-center gap-6 mb-4">
                                <span className="text-4xl font-black text-white">{liveMatchData.homeTeam?.score || '0'}</span>
                                <span className="text-lg text-slate-500">—</span>
                                <span className="text-4xl font-black text-white">{liveMatchData.awayTeam?.score || '0'}</span>
                            </div>

                            {/* Goals Summary */}
                            {liveMatchData.events && liveMatchData.events.filter((e: MatchEvent) => e.isGoal).length > 0 && (
                                <div className="flex flex-wrap justify-center gap-2 mb-4">
                                    {liveMatchData.events.filter((e: MatchEvent) => e.isGoal).map((event: MatchEvent, idx: number) => (
                                        <span key={idx} className="text-xs text-slate-300 bg-white/5 px-2 py-1 rounded-full flex items-center gap-1">
                                            <MatchEventIcon event={{ isGoal: true }} className="w-3 h-3 inline" />
                                            {formatMatchClock(event.clock)} {event.player}
                                            {event.isPenalty && ' (P)'}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Detail Button */}
                            <button
                                onClick={() => setShowLiveMatchModal(true)}
                                className="w-full px-4 py-2 bg-yellow-400/10 hover:bg-yellow-400 text-yellow-400 hover:text-black border border-yellow-400/30 rounded-lg text-xs font-bold transition-all duration-300"
                            >
                                Detaylı İstatistikler
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Next 3 Matches */}
            <NextMatchesPanel next3Matches={next3Matches} />

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
            <LiveMatchModal
                visible={showLiveMatchModal}
                onClose={() => setShowLiveMatchModal(false)}
            />

            {/* Standings Modal */}
            <StandingsModal
                visible={showStandingsModal}
                league={standingsLeague}
                onClose={() => setShowStandingsModal(false)}
            />
        </div>
    );
};

export default Dashboard;
