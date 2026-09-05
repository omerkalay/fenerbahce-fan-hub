import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import DashboardMatchHero from './DashboardMatchHero';
import DashboardStandingsPanel from './DashboardStandingsPanel';
import LiveMatchModal from './LiveMatchModal';
import NextMatchesPanel from './NextMatchesPanel';
import Poll from './Poll';
import StandingsModal from './StandingsModal';
import StartingXIModal from './StartingXIModal';
import TeamLogo from './TeamLogo';
import { database } from '../firebase';
import useBodyScrollLock from '../hooks/useBodyScrollLock';
import { useTheme } from '../contexts/themeContextDef';
import { resolveTeamCrest } from '../theme/teamCrest';
import { getCurrentSeasonStartYear } from '../utils/seasons';
import type { LiveMatchData, LiveMatchState, MatchData, PublishedMatchLineups, SeasonMeta, SeasonState } from '../types';
import { normalizePublishedLineups } from '../utils/lineupData';

interface DashboardProps {
    matchData: MatchData | null;
    next3Matches: MatchData[];
    loading: boolean;
    onRetry: (() => void) | undefined;
    errorMessage: string | null;
    liveMatchError?: string | null;
    seasonState: SeasonState;
    season: SeasonMeta | null;
    liveMatchState: LiveMatchState;
    liveMatchData: LiveMatchData | null;
    onCountdownEnd: () => void;
    safeMode?: boolean;
    startingXIOverride?: PublishedMatchLineups | null;
}

const Dashboard: React.FC<DashboardProps> = ({
    matchData,
    next3Matches = [],
    loading,
    onRetry,
    errorMessage,
    liveMatchError = null,
    seasonState,
    season,
    liveMatchState = 'countdown',
    liveMatchData = null,
    onCountdownEnd,
    safeMode = false,
    startingXIOverride = null,
}) => {
    const { theme } = useTheme();
    const [showLiveMatchModal, setShowLiveMatchModal] = useState(false);
    const [showStandingsModal, setShowStandingsModal] = useState(false);
    const [standingsLeague, setStandingsLeague] = useState('');
    const [standingsSeasonStartYear, setStandingsSeasonStartYear] = useState(() => getCurrentSeasonStartYear());
    const [showStartingXIModal, setShowStartingXIModal] = useState(false);
    const [startingXI, setStartingXI] = useState<PublishedMatchLineups | null>(null);
    const resolvedStartingXI = safeMode ? startingXIOverride : startingXI;
    const offseasonCrest = resolveTeamCrest({
        theme,
        defaultSrc: 'https://media.api-sports.io/football/teams/611.png',
        isFenerbahce: true,
    });

    useEffect(() => {
        if (safeMode || !matchData?.id) {
            setStartingXI(null);
            return;
        }

        const startingXIRef = ref(database, `cache/matchLineups/${matchData.id}`);
        const unsubscribe = onValue(
            startingXIRef,
            (snapshot) => {
                const value = normalizePublishedLineups(snapshot.val() as PublishedMatchLineups | null);
                setStartingXI(value && String(value.matchId) === String(matchData.id) ? value : null);
            },
            (loadError) => {
                console.error('Starting XI could not be loaded from RTDB:', loadError);
                setStartingXI(null);
            }
        );

        return unsubscribe;
    }, [matchData?.id, safeMode]);

    useBodyScrollLock(showLiveMatchModal || showStandingsModal || showStartingXIModal);

    const openStandingsModal = (league: 'superlig' | 'uefa', seasonStartYear?: number) => {
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

    if (loading) {
        return <div className="flex h-64 items-center justify-center text-yellow-400 motion-safe:animate-pulse">Yükleniyor...</div>;
    }

    if (!matchData) {
        if (seasonState === 'offseason' && !errorMessage) {
            return (
                <div className="min-h-screen space-y-4 pb-20">
                    <div className="glass-panel w-full rounded-2xl border border-yellow-400/15 p-6 text-center">
                        <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 p-0.5 shadow-lg shadow-yellow-500/20">
                            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-slate-950">
                                <img src={offseasonCrest || undefined} alt="Fenerbahçe" className="h-11 w-11 object-contain" />
                            </div>
                        </div>
                        <p className="text-lg font-black text-white">
                            {season?.label ? `${season.label} sezonu tamamlandı` : 'Sezon tamamlandı'}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-slate-300">Yeni sezon fikstürü açıklandığında pano otomatik güncellenecek.</p>
                    </div>
                    <DashboardStandingsPanel
                        onOpen={openStandingsModal}
                        seasonStartYear={season?.startYear ?? getCurrentSeasonStartYear()}
                        className="mb-0"
                    />
                    {standingsModal}
                </div>
            );
        }

        return (
            <div className="mt-10 space-y-4 text-center text-slate-400">
                <p>Maç bilgisi bulunamadı.</p>
                {errorMessage && <p className="text-sm text-slate-300">{errorMessage}</p>}
                {onRetry && (
                    <button onClick={onRetry} className="rounded-full border border-yellow-400/30 bg-yellow-400/20 px-4 py-2 text-yellow-300 transition-colors hover:bg-yellow-400 hover:text-black">
                        Tekrar Dene
                    </button>
                )}
            </div>
        );
    }

    const isFenerbahceHome = matchData.homeTeam.id === 3052;
    const opponent = isFenerbahceHome ? matchData.awayTeam : matchData.homeTeam;
    const lineupSides = resolvedStartingXI
        ? (['home', 'away'] as const)
            .filter((side) => Boolean(resolvedStartingXI.lineups[side]))
            .map((side) => ({
                side,
                lineup: resolvedStartingXI.lineups[side]!,
                team: side === 'home' ? resolvedStartingXI.homeTeam : resolvedStartingXI.awayTeam,
                matchTeam: side === 'home' ? matchData.homeTeam : matchData.awayTeam,
                source: resolvedStartingXI.sources?.[side] || null,
            }))
        : [];
    const singleManualFenerLineup = lineupSides.length === 1
        && lineupSides[0].source === 'manual'
        && Number(lineupSides[0].matchTeam.id) === 3052;

    return (
        <div className="min-h-screen pb-20">
            <DashboardMatchHero
                matchData={matchData}
                liveMatchState={liveMatchState}
                liveMatchData={liveMatchData}
                onCountdownEnd={onCountdownEnd}
                onOpenDetails={() => setShowLiveMatchModal(true)}
            />

            {(liveMatchError || errorMessage) && (
                <p role="status" className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                    {liveMatchError || errorMessage}
                </p>
            )}

            {resolvedStartingXI && (
                <button
                    type="button"
                    onClick={() => setShowStartingXIModal(true)}
                    className="glass-panel mb-6 flex min-h-12 w-full items-center justify-between rounded-2xl p-4 text-left transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400"
                >
                    <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center gap-2.5">
                            <span className="text-base font-bold text-white">
                                {safeMode ? 'Simülasyon İlk 11’i' : singleManualFenerLineup ? 'Fenerbahçe İlk 11’i' : 'İlk 11’ler Açıklandı'}
                            </span>
                            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-300">
                                {safeMode ? 'Yerel' : 'Yeni'}
                            </span>
                        </div>
                        <div className={`grid gap-2 text-[11px] ${lineupSides.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            {lineupSides.map(({ side, lineup, team, matchTeam }) => (
                                <div key={side} className="min-w-0 rounded-lg bg-white/5 px-2.5 py-2">
                                    <div className="flex items-center gap-2">
                                        <TeamLogo teamId={matchTeam.id} name={team.name} logoUrl={team.logo} wrapperClassName="h-7 w-7 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold text-slate-200">{team.name}</p>
                                            <p className="mt-0.5 font-black text-slate-400">{lineup.formation || 'Diziliş hazır'}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <span className="ml-2 text-slate-500" aria-hidden="true">→</span>
                </button>
            )}

            <NextMatchesPanel next3Matches={next3Matches} />
            <DashboardStandingsPanel
                onOpen={openStandingsModal}
                seasonStartYear={season?.startYear ?? getCurrentSeasonStartYear()}
            />

            <div className="mb-6">
                <Poll opponentName={opponent.name} matchId={matchData.id} previewOnly={safeMode} />
            </div>

            {resolvedStartingXI && (
                <StartingXIModal
                    visible={showStartingXIModal}
                    data={resolvedStartingXI}
                    onClose={() => setShowStartingXIModal(false)}
                    isSimulation={safeMode}
                    useSquadPhotos={!safeMode}
                />
            )}

            <LiveMatchModal
                visible={showLiveMatchModal}
                errorMessage={liveMatchError}
                onClose={() => setShowLiveMatchModal(false)}
                liveMatchData={liveMatchData}
                useSquadPhotos={!safeMode}
            />
            {standingsModal}
        </div>
    );
};

export default Dashboard;
