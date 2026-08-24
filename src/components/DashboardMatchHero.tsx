import MatchCountdown from './MatchCountdown';
import TeamLogo from './TeamLogo';
import LiveMatchTimeline from './LiveMatchTimeline';
import { isHalftimeDisplay } from '../utils/dashboardHelpers';
import { localizeCompetitionName, localizeCompetitionStage, localizeTeamName } from '../utils/localize';
import type { LiveMatchData, LiveMatchState, MatchData } from '../types';

interface DashboardMatchHeroProps {
    matchData: MatchData;
    liveMatchState: LiveMatchState;
    liveMatchData: LiveMatchData | null;
    onCountdownEnd: () => void;
    onOpenDetails: () => void;
    useModernUpcomingLayout?: boolean;
}

const FENERBAHCE_ID = 3052;

const getTeamId = (liveId: string | number | undefined, fallbackId: number): number => {
    const value = Number(liveId);
    return Number.isFinite(value) ? value : fallbackId;
};

export default function DashboardMatchHero({
    matchData,
    liveMatchState,
    liveMatchData,
    onCountdownEnd,
    onOpenDetails,
    useModernUpcomingLayout = true,
}: DashboardMatchHeroProps) {
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
    const hasLiveScore = Boolean(liveMatchData && (liveMatchState === 'in' || liveMatchState === 'post'));
    const isHalftime = liveMatchState === 'in' && liveMatchData
        ? isHalftimeDisplay(liveMatchData.statusDetail, liveMatchData.displayClock)
        : false;
    const homeName = localizeTeamName(liveMatchData?.homeTeam?.name || matchData.homeTeam.name);
    const awayName = localizeTeamName(liveMatchData?.awayTeam?.name || matchData.awayTeam.name);
    const homeId = getTeamId(liveMatchData?.homeTeam?.id, matchData.homeTeam.id);
    const awayId = getTeamId(liveMatchData?.awayTeam?.id, matchData.awayTeam.id);
    const statusLabel = liveMatchState === 'post'
        ? 'Maç Bitti'
        : liveMatchState === 'in'
            ? 'Canlı'
            : null;
    const clockLabel = isHalftime
        ? 'Devre Arası'
        : liveMatchState === 'post'
            ? 'Maç Sonu'
            : liveMatchData?.displayClock || '';

    if (!hasLiveScore && !useModernUpcomingLayout) {
        return (
            <section className="glass-card group relative mb-6 overflow-hidden rounded-3xl p-6" aria-label={`${homeName} ${awayName} maç kartı`}>
                <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-50" aria-hidden="true" />

                <div className="relative z-10 mb-6 flex items-start justify-between gap-2">
                    <div className="inline-flex w-fit shrink-0 flex-col items-start rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 uppercase text-yellow-400">
                        <span className="whitespace-nowrap text-[10px] font-bold tracking-wider sm:text-xs">{competitionName}</span>
                        {competitionStage && (
                            <span className="whitespace-nowrap text-[9px] font-semibold tracking-wide text-yellow-300/90 sm:text-[10px]">{competitionStage}</span>
                        )}
                    </div>
                    <span className="shrink-0 whitespace-nowrap pt-1 text-[11px] font-medium text-slate-400 sm:text-xs">
                        {matchDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}
                    </span>
                </div>

                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex w-1/3 flex-col items-center gap-3">
                        <div className="h-16 w-16 rounded-full border border-white/10 bg-white/5 p-2 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                            <TeamLogo teamId={homeId} name={homeName} wrapperClassName="h-full w-full" imageClassName="object-contain" />
                        </div>
                        <span className="line-clamp-2 break-words text-center text-sm font-bold leading-tight">{homeName}</span>
                    </div>

                    <div className="-mt-4 flex w-1/3 flex-col items-center justify-center">
                        <span className="text-2xl font-black text-slate-700/50">VS</span>
                        <div className="mt-2 text-center">
                            <span className="text-glow text-3xl font-bold tracking-tighter text-white">
                                {matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>

                    <div className="flex w-1/3 flex-col items-center gap-3">
                        <div className="h-16 w-16 rounded-full border border-white/10 bg-white/5 p-2 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                            <TeamLogo teamId={awayId} name={awayName} wrapperClassName="h-full w-full" imageClassName="object-contain" />
                        </div>
                        <span className="line-clamp-2 break-words text-center text-sm font-bold leading-tight">{awayName}</span>
                    </div>
                </div>

                <div className="mt-8 border-t border-white/5 pt-6">
                    {liveMatchState === 'checking' && (
                        <div className="py-4 text-center">
                            <div className="mb-2 flex items-center justify-center gap-2">
                                <span className="relative flex h-3 w-3" aria-hidden="true">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-60" />
                                    <span className="relative inline-flex h-3 w-3 rounded-full bg-yellow-400" />
                                </span>
                                <span className="text-sm font-bold uppercase text-yellow-400">Maç Durumu Kontrol Ediliyor</span>
                            </div>
                            <p className="text-xs text-slate-400">Son durum senkronize ediliyor...</p>
                        </div>
                    )}

                    {liveMatchState === 'unsupported' && (
                        <div className="py-4 text-center">
                            <p className="text-sm font-bold text-yellow-300">Canlı Detay Sunulmuyor</p>
                            <p className="mt-1 text-xs text-slate-400">Bu kulvar için canlı skor ve maç istatistikleri henüz desteklenmiyor.</p>
                        </div>
                    )}

                    <MatchCountdown matchData={matchData} liveMatchState={liveMatchState} onCountdownEnd={onCountdownEnd} />

                    {liveMatchState === 'pre' && (
                        <div className="py-4 text-center">
                            <div className="mb-2 flex items-center justify-center gap-2">
                                <span className="relative flex h-3 w-3" aria-hidden="true">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                                    <span className="relative inline-flex h-3 w-3 rounded-full bg-yellow-400" />
                                </span>
                                <span className="text-sm font-bold uppercase text-yellow-400">Maç Birazdan Başlıyor!</span>
                            </div>
                            <p className="text-xs text-slate-400">Takımlar sahaya çıkıyor...</p>
                        </div>
                    )}
                </div>
            </section>
        );
    }

    return (
        <section className="live-match-hero glass-panel relative mb-6 overflow-hidden rounded-3xl" aria-label={`${homeName} ${awayName} maç kartı`}>
            <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-50" aria-hidden="true" />

            <div className="p-5 sm:p-6">
                <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">{competitionName}</p>
                        {competitionStage && <p className="mt-1 truncate text-[10px] font-semibold text-slate-500">{competitionStage}</p>}
                    </div>
                    {statusLabel ? (
                        <div className={`inline-flex shrink-0 items-center gap-2 py-1 text-[10px] font-black uppercase tracking-wider ${liveMatchState === 'in' ? 'text-yellow-300' : 'text-emerald-300'}`}>
                            {liveMatchState === 'in' && !isHalftime && <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 motion-safe:animate-pulse" aria-hidden="true" />}
                            {statusLabel}
                        </div>
                    ) : (
                        <span className="shrink-0 text-right text-[10px] font-semibold text-slate-500">
                            {matchDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 sm:gap-4" aria-live="polite">
                    <div className="min-w-0 text-center">
                        <div className="mx-auto mb-2 h-16 w-16 rounded-full border border-white/10 bg-white/[0.04] p-2 sm:h-[72px] sm:w-[72px]">
                            <TeamLogo
                                teamId={homeId}
                                name={homeName}
                                logoUrl={liveMatchData?.homeTeam?.logo}
                                wrapperClassName="h-full w-full"
                                imageClassName="object-contain"
                            />
                        </div>
                        <p className="mx-auto line-clamp-2 max-w-28 break-words text-xs font-extrabold leading-tight text-white sm:max-w-36 sm:text-sm">{homeName}</p>
                    </div>

                    <div className="min-w-[104px] px-1 pt-2 text-center sm:min-w-[132px]">
                        {hasLiveScore ? (
                            <>
                                <p className="whitespace-nowrap text-[42px] font-black leading-none tracking-[-0.08em] text-white sm:text-5xl">
                                    <span className="tabular-nums">{liveMatchData?.homeTeam?.score ?? '0'}</span>
                                    <span className="px-2 text-2xl text-slate-600">–</span>
                                    <span className="tabular-nums">{liveMatchData?.awayTeam?.score ?? '0'}</span>
                                </p>
                                <p className={`mt-2 min-h-5 text-sm font-black tabular-nums ${liveMatchState === 'in' ? 'text-yellow-300' : 'text-slate-400'}`}>{clockLabel}</p>
                            </>
                        ) : (
                            <>
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">VS</p>
                                <p className="mt-2 text-3xl font-black tracking-tight text-white">
                                    {matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </>
                        )}
                    </div>

                    <div className="min-w-0 text-center">
                        <div className="mx-auto mb-2 h-16 w-16 rounded-full border border-white/10 bg-white/[0.04] p-2 sm:h-[72px] sm:w-[72px]">
                            <TeamLogo
                                teamId={awayId}
                                name={awayName}
                                logoUrl={liveMatchData?.awayTeam?.logo}
                                wrapperClassName="h-full w-full"
                                imageClassName="object-contain"
                            />
                        </div>
                        <p className="mx-auto line-clamp-2 max-w-28 break-words text-xs font-extrabold leading-tight text-white sm:max-w-36 sm:text-sm">{awayName}</p>
                    </div>
                </div>

                <div className="mt-5 border-t border-white/[0.07] pt-4">
                    {liveMatchState === 'checking' && (
                        <div className="py-3 text-center">
                            <p className="text-sm font-bold text-slate-200">Maç durumu kontrol ediliyor</p>
                            <p className="mt-1 text-xs text-slate-500">Son durum senkronize ediliyor...</p>
                        </div>
                    )}

                    {liveMatchState === 'unsupported' && (
                        <div className="py-3 text-center">
                            <p className="text-sm font-bold text-slate-200">Canlı detay sunulmuyor</p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-500">Bu kulvar için canlı skor ve maç istatistikleri henüz desteklenmiyor.</p>
                        </div>
                    )}

                    <MatchCountdown matchData={matchData} liveMatchState={liveMatchState} onCountdownEnd={onCountdownEnd} />

                    {liveMatchState === 'pre' && (
                        <div className="py-3 text-center">
                            <p className="text-sm font-black text-yellow-300">Maç birazdan başlıyor</p>
                            <p className="mt-1 text-xs text-slate-500">Takımlar sahaya çıkıyor...</p>
                        </div>
                    )}

                    {hasLiveScore && liveMatchData && (
                        <div className="space-y-4">
                            <LiveMatchTimeline
                                events={liveMatchData.events}
                                homeTeamId={liveMatchData.homeTeam?.id}
                                awayTeamId={liveMatchData.awayTeam?.id}
                                homeTeamName={homeName}
                                awayTeamName={awayName}
                                compact
                            />
                            <button
                                type="button"
                                onClick={onOpenDetails}
                                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-xs font-black text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400"
                            >
                                Maç Merkezini Aç
                                <span aria-hidden="true">→</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
