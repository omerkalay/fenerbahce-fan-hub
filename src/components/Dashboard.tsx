import { useState, useEffect } from 'react';
import TeamLogo from './TeamLogo';
import Poll from './Poll';
import MatchCountdown from './MatchCountdown';
import NextMatchesPanel from './NextMatchesPanel';
import StandingsModal from './StandingsModal';
import DashboardStandingsPanel from './DashboardStandingsPanel';
import LiveMatchModal from './LiveMatchModal';
import StartingXIModal from './StartingXIModal';
import MatchEventIcon from './MatchEventIcon';
import { getEventVisualType } from '../utils/eventVisualType';
import { database } from '../firebase';
import { formatMatchClock } from '../utils/matchClock';
import { localizePlayerName } from '../utils/playerDisplay';
import { localizeTeamName, localizeCompetitionName, localizeCompetitionStage } from '../utils/localize';
import { getCurrentSeasonStartYear } from '../utils/seasons';
import { onValue, ref } from 'firebase/database';
import {
    isHalftimeDisplay,
    resolveGoalTeamId,
    formatGoalSummaryText,
    normalizeStartingXIData
} from '../utils/dashboardHelpers';
import useBodyScrollLock from '../hooks/useBodyScrollLock';
import { useTheme } from '../contexts/themeContextDef';
import { resolveTeamCrest } from '../theme/teamCrest';
import type { MatchData, LiveMatchState, LiveMatchData, MatchEvent, StartingXIData, SeasonMeta, SeasonState } from '../types';

interface DashboardProps {
    matchData: MatchData | null;
    next3Matches: MatchData[];
    loading: boolean;
    onRetry: (() => void) | undefined;
    errorMessage: string | null;
    seasonState: SeasonState;
    season: SeasonMeta | null;
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
    seasonState,
    season,
    liveMatchState = 'countdown',
    liveMatchData = null,
    onCountdownEnd
}) => {
    const { theme } = useTheme();
    const [showLiveMatchModal, setShowLiveMatchModal] = useState<boolean>(false);
    const [showStandingsModal, setShowStandingsModal] = useState<boolean>(false);
    const [standingsLeague, setStandingsLeague] = useState<string>('');
    const [standingsSeasonStartYear, setStandingsSeasonStartYear] = useState<number>(() => getCurrentSeasonStartYear());
    const [showStartingXIModal, setShowStartingXIModal] = useState<boolean>(false);
    const [startingXI, setStartingXI] = useState<StartingXIData | null>(null);
    const offseasonCrest = resolveTeamCrest({
        theme,
        defaultSrc: 'https://media.api-sports.io/football/teams/611.png',
        isFenerbahce: true,
    });

    useEffect(() => {
        const startingXIRef = ref(database, 'admin/startingXI');

        const unsubscribe = onValue(
            startingXIRef,
            (snapshot) => {
                setStartingXI(normalizeStartingXIData(snapshot.val()));
            },
            (error) => {
                console.error('Starting XI could not be loaded from RTDB:', error);
                setStartingXI(null);
            }
        );

        return () => {
            unsubscribe();
        };
    }, []);

    useBodyScrollLock(showLiveMatchModal || showStandingsModal || showStartingXIModal);

    const openStandingsModal = (league: 'superlig' | 'europa', seasonStartYear?: number) => {
        setStandingsLeague(league);
        setStandingsSeasonStartYear(seasonStartYear ?? season?.startYear ?? getCurrentSeasonStartYear());
        setShowStandingsModal(true);
    };

    const standingsModal = (
        <StandingsModal
            visible={showStandingsModal}
            league={standingsLeague}
            initialSeasonStartYear={standingsSeasonStartYear}
            onClose={() => setShowStandingsModal(false)}
        />
    );

    if (loading) return <div className="flex items-center justify-center h-64 text-yellow-400 animate-pulse">Yükleniyor...</div>;
    if (!matchData) {
        if (seasonState === 'offseason' && !errorMessage) {
            return (
                <div className="min-h-screen pb-20 space-y-4">
                    <div className="glass-panel rounded-2xl p-6 text-center border border-yellow-400/15 w-full">
                        <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 p-0.5 shadow-lg shadow-yellow-500/20">
                            <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center overflow-hidden">
                                <img src={offseasonCrest || undefined} alt="Fenerbahçe" className="w-11 h-11 object-contain" />
                            </div>
                        </div>
                        <p className="text-lg font-black text-white">
                            {season?.label ? `${season.label} sezonu tamamlandı` : 'Sezon tamamlandı'}
                        </p>
                        <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                            Yeni sezon fikstürü açıklandığında pano otomatik güncellenecek.
                        </p>
                    </div>

                    <DashboardStandingsPanel
                        onOpen={openStandingsModal}
                        className="mb-0"
                    />
                    {standingsModal}
                </div>
            );
        }

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
    const competitionName = localizeCompetitionName(
        matchData.tournament.uniqueTournament?.name ?? matchData.tournament.name
    );
    const competitionStage = localizeCompetitionStage({
        name: matchData.roundInfo?.name,
        slug: matchData.roundInfo?.slug,
        round: matchData.roundInfo?.round,
        qualificationOrPreliminary: matchData.tournament.qualificationOrPreliminary,
    });
    const FENERBAHCE_ID: number = 3052;
    const isHome = matchData.homeTeam.id === 3052;
    const opponent = isHome ? matchData.awayTeam : matchData.homeTeam;
    const isLiveHalftime = liveMatchState === 'in' && liveMatchData
        ? isHalftimeDisplay(liveMatchData.statusDetail, liveMatchData.displayClock)
        : false;
    const liveHomeTeamId = String(liveMatchData?.homeTeam?.id ?? '');
    const liveAwayTeamId = String(liveMatchData?.awayTeam?.id ?? '');
    const timelineEvents = (liveMatchData?.events || []).filter((event: MatchEvent) => !event.isSubstitution);
    const goalEvents = timelineEvents.filter((event: MatchEvent) => event.isGoal);
    const homeGoalEvents = goalEvents.filter((event: MatchEvent) => resolveGoalTeamId(event) === liveHomeTeamId);
    const awayGoalEvents = goalEvents.filter((event: MatchEvent) => resolveGoalTeamId(event) === liveAwayTeamId);
    const neutralGoalEvents = goalEvents.filter((event: MatchEvent) => {
        const scoringTeamId = resolveGoalTeamId(event);
        return scoringTeamId !== liveHomeTeamId && scoringTeamId !== liveAwayTeamId;
    });
    const nonGoalEvents = timelineEvents.filter((event: MatchEvent) => !event.isGoal);

    return (
        <div className="min-h-screen pb-20">
            {/* Hero Section: Next Match Card */}
            <div className="glass-card rounded-3xl p-6 relative overflow-hidden group mb-6">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-50"></div>

                <div className="flex items-start justify-between gap-2 mb-6 relative z-10">
                    <div className="inline-flex w-fit shrink-0 flex-col items-start rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-yellow-400 uppercase">
                        <span className="whitespace-nowrap text-[10px] sm:text-xs font-bold tracking-wider">
                            {competitionName}
                        </span>
                        {competitionStage && (
                            <span className="whitespace-nowrap text-[9px] sm:text-[10px] font-semibold tracking-wide text-yellow-300/90">
                                {competitionStage}
                            </span>
                        )}
                    </div>

                    <span className="shrink-0 whitespace-nowrap pt-1 text-[11px] sm:text-xs text-slate-400 font-medium">
                        {matchDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}
                    </span>
                </div>



                <div className="flex items-center justify-between relative z-10">
                    <div className="flex flex-col items-center gap-3 w-1/3">
                        <div className="w-16 h-16 rounded-full bg-white/5 p-2 border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                            <TeamLogo
                                teamId={isHome ? FENERBAHCE_ID : opponent.id}
                                name={isHome ? 'Fenerbahçe' : localizeTeamName(opponent.name)}
                                wrapperClassName="w-full h-full"
                                imageClassName="object-contain"
                            />
                        </div>
                        <span className="text-sm font-bold text-center leading-tight">
                            {isHome ? "Fenerbahçe" : localizeTeamName(opponent.name)}
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
                                name={!isHome ? 'Fenerbahçe' : localizeTeamName(opponent.name)}
                                wrapperClassName="w-full h-full"
                                imageClassName="object-contain"
                            />
                        </div>
                        <span className="text-sm font-bold text-center leading-tight">
                            {!isHome ? "Fenerbahçe" : localizeTeamName(opponent.name)}
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
                                <span className="text-sm font-bold text-red-400 uppercase">Canlı</span>
                                {isLiveHalftime ? (
                                    <span className="text-[11px] font-semibold text-yellow-300 uppercase px-2 py-0.5 rounded-full border border-yellow-400/30 bg-yellow-400/10">
                                        Devre Arası
                                    </span>
                                ) : liveMatchData.displayClock && (
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
                            {timelineEvents.length > 0 && (
                                <div className="mb-4 space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
                                    {goalEvents.length > 0 && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                {homeGoalEvents.map((event: MatchEvent, idx: number) => (
                                                    <div key={`home-goal-${idx}`} className="flex items-center gap-1 text-xs">
                                                        <span className="text-slate-500 w-10 text-right">{formatMatchClock(event.clock)}</span>
                                                        <MatchEventIcon event={{ isGoal: true }} className="w-3.5 h-3.5 shrink-0" />
                                                        <span className="text-yellow-300 font-semibold truncate">{formatGoalSummaryText(event)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="space-y-1">
                                                {awayGoalEvents.map((event: MatchEvent, idx: number) => (
                                                    <div key={`away-goal-${idx}`} className="flex items-center justify-end gap-1 text-xs">
                                                        <span className="text-yellow-300 font-semibold truncate text-right">{formatGoalSummaryText(event)}</span>
                                                        <MatchEventIcon event={{ isGoal: true }} className="w-3.5 h-3.5 shrink-0" />
                                                        <span className="text-slate-500 w-10">{formatMatchClock(event.clock)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {neutralGoalEvents.length > 0 && (
                                        <div className="space-y-1">
                                            {neutralGoalEvents.map((event: MatchEvent, idx: number) => (
                                                <div key={`neutral-goal-${idx}`} className="flex items-center justify-center gap-1 text-xs">
                                                    <span className="text-slate-500">{formatMatchClock(event.clock)}</span>
                                                    <MatchEventIcon event={{ isGoal: true }} className="w-3.5 h-3.5 shrink-0" />
                                                    <span className="text-yellow-300 font-semibold">{formatGoalSummaryText(event)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {nonGoalEvents.length > 0 && (
                                        <div className={`space-y-1 ${goalEvents.length > 0 ? 'pt-2 border-t border-white/5' : ''}`}>
                                            {nonGoalEvents.map((event: MatchEvent, idx: number) => {
                                                const eventType = getEventVisualType(event);
                                                const textClass = eventType === 'red-card'
                                                    ? 'text-red-400'
                                                    : 'text-slate-300';

                                                return (
                                                    <div key={`other-${idx}`} className="flex items-center gap-2 text-xs">
                                                        <span className="text-slate-500 w-10 text-right">{formatMatchClock(event.clock)}</span>
                                                        <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                                                            <MatchEventIcon
                                                                event={event}
                                                                className={eventType === 'red-card' ? 'w-3 h-4' : 'w-3.5 h-4'}
                                                            />
                                                        </span>
                                                        <span className={textClass}>{localizePlayerName(event.player)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
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
                            {goalEvents.length > 0 && (
                                <div className="mb-4 space-y-2">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            {homeGoalEvents.map((event: MatchEvent, idx: number) => (
                                                <div key={`post-home-${idx}`} className="flex items-center gap-1 text-xs">
                                                    <span className="text-slate-500 w-10 text-right">{formatMatchClock(event.clock)}</span>
                                                    <MatchEventIcon event={{ isGoal: true }} className="w-3.5 h-3.5 shrink-0" />
                                                    <span className="text-yellow-300 font-semibold truncate">{formatGoalSummaryText(event)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="space-y-1">
                                            {awayGoalEvents.map((event: MatchEvent, idx: number) => (
                                                <div key={`post-away-${idx}`} className="flex items-center justify-end gap-1 text-xs">
                                                    <span className="text-yellow-300 font-semibold truncate text-right">{formatGoalSummaryText(event)}</span>
                                                    <MatchEventIcon event={{ isGoal: true }} className="w-3.5 h-3.5 shrink-0" />
                                                    <span className="text-slate-500 w-10">{formatMatchClock(event.clock)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {neutralGoalEvents.length > 0 && (
                                        <div className="space-y-1">
                                            {neutralGoalEvents.map((event: MatchEvent, idx: number) => (
                                                <div key={`post-neutral-${idx}`} className="flex items-center justify-center gap-1 text-xs">
                                                    <span className="text-slate-500">{formatMatchClock(event.clock)}</span>
                                                    <MatchEventIcon event={{ isGoal: true }} className="w-3.5 h-3.5 shrink-0" />
                                                    <span className="text-yellow-300 font-semibold">{formatGoalSummaryText(event)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Lineup Teaser (post only) */}
                            {liveMatchData.lineups && (
                                <div className="mb-3 flex items-center justify-center gap-2 text-[11px] text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span>Kadro ve formasyon detaylarda mevcut</span>
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

            {/* Starting XI Banner */}
            {startingXI && (
                <button
                    onClick={() => setShowStartingXIModal(true)}
                    className="glass-panel rounded-2xl mb-6 w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-2.5">
                        <span className="text-base font-bold text-white">İlk 11 Açıklandı!</span>
                        <span className="text-xs bg-green-500/20 text-green-300 px-2.5 py-0.5 rounded-full font-bold uppercase">Yeni</span>
                    </div>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-4 h-4 text-slate-400"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}

            {/* Next 3 Matches */}
            <NextMatchesPanel next3Matches={next3Matches} />

            <DashboardStandingsPanel onOpen={openStandingsModal} />

            {/* Poll */}
            <div className="mb-6">
                <div className="mb-6">
                    <Poll opponentName={opponent.name} matchId={matchData.id} />
                </div>
            </div>

            {/* Starting XI Modal */}
            {startingXI && (
                <StartingXIModal
                    visible={showStartingXIModal}
                    data={startingXI}
                    onClose={() => setShowStartingXIModal(false)}
                />
            )}

            {/* Live Match Modal */}
            <LiveMatchModal
                visible={showLiveMatchModal}
                onClose={() => setShowLiveMatchModal(false)}
                liveMatchData={liveMatchData}
            />

            {standingsModal}
        </div>
    );
};

export default Dashboard;
