import MatchEventIcon from './MatchEventIcon';
import { getEventVisualType } from '../utils/eventVisualType';
import MatchLineups from './MatchLineups';
import { formatMatchClock } from '../utils/matchClock';
import { localizePlayerName } from '../utils/playerDisplay';
import { localizeTeamName } from '../utils/localize';
import type { EspnFixtureMatch, MatchSummaryData } from '../types';

// ─── Helpers ─────────────────────────────────────────────


const localizeSummaryStatus = (value: string = ''): string => {
    const normalized = String(value || '').trim().toLowerCase();

    if (!normalized) return 'Maç Sonucu';
    if (normalized === 'ft' || normalized === 'full time' || normalized.includes('full time')) return 'Maç Sonu';
    if (normalized === 'ht' || normalized === 'halftime' || normalized.includes('half time')) return 'Devre Arası';
    if (normalized === 'aet' || normalized.includes('after extra time')) return 'Uzatma Sonu';
    if (normalized.includes('penalties')) return 'Penaltılar Sonu';

    return value;
};

const formatIncidentLabel = (event: NonNullable<MatchSummaryData['events']>[number]): string => {
    const playerName = localizePlayerName(event?.player || event?.type || 'Olay');
    const suffixes: string[] = [];

    if (event?.isGoal && event?.isPenalty) suffixes.push('(P)');
    if (event?.isGoal && event?.isOwnGoal) suffixes.push('(K.K)');

    return [playerName, ...suffixes].join(' ');
};

// ─── Props ───────────────────────────────────────────────

interface MatchSummaryModalProps {
    activeSummaryMatch: EspnFixtureMatch | null;
    activeSummaryData: MatchSummaryData | null;
    summaryLoading: boolean;
    summaryError: string | null;
    summaryHomeLogo: string | null;
    summaryAwayLogo: string | null;
    onClose: () => void;
}

// ─── Component ───────────────────────────────────────────

function MatchSummaryModal({
    activeSummaryMatch,
    activeSummaryData,
    summaryLoading,
    summaryError,
    summaryHomeLogo,
    summaryAwayLogo,
    onClose,
}: MatchSummaryModalProps) {
    if (!activeSummaryMatch) return null;
    const homeIncidentTeamId = String(activeSummaryMatch.homeTeam?.id || activeSummaryData?.homeTeam?.id || '');
    const awayIncidentTeamId = String(activeSummaryMatch.awayTeam?.id || activeSummaryData?.awayTeam?.id || '');
    const summaryIncidentEvents = (activeSummaryData?.events || []).filter((event) => event.isGoal || event.isRedCard);
    const homeSummaryIncidents = summaryIncidentEvents.filter((event) => String(event.team || '') === homeIncidentTeamId);
    const awaySummaryIncidents = summaryIncidentEvents.filter((event) => String(event.team || '') === awayIncidentTeamId);
    const neutralSummaryIncidents = summaryIncidentEvents.filter((event) => {
        const teamId = String(event.team || '');
        return teamId !== homeIncidentTeamId && teamId !== awayIncidentTeamId;
    });

    return (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4">
            <button
                onClick={onClose}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                aria-label="Kapat"
            />

            <div className="relative w-full max-w-2xl max-h-[88vh] overflow-hidden glass-card rounded-2xl border border-yellow-400/20">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-yellow-300">Maç İstatistikleri</p>
                        <p className="text-[11px] text-slate-400">
                            {localizeTeamName(activeSummaryMatch.homeTeam?.name)} vs {localizeTeamName(activeSummaryMatch.awayTeam?.name)}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-white hover:rotate-90 transition-all duration-300"
                        aria-label="Kapat"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-4 overflow-y-auto max-h-[calc(88vh-72px)] space-y-4">
                    {summaryLoading && (
                        <div className="space-y-3 animate-pulse">
                            <div className="h-20 rounded-xl bg-white/5" />
                            <div className="h-28 rounded-xl bg-white/5" />
                            <div className="h-28 rounded-xl bg-white/5" />
                        </div>
                    )}

                    {!summaryLoading && summaryError && (
                        <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">
                            {summaryError}
                        </div>
                    )}

                    {!summaryLoading && !summaryError && activeSummaryData && (
                        <>
                            <div className="glass-panel rounded-xl p-4">
                                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-11 h-11 rounded-full overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                                            {summaryHomeLogo ? (
                                                <img src={summaryHomeLogo} alt={localizeTeamName(activeSummaryData.homeTeam?.name || '')} className="w-full h-full object-contain p-1" loading="lazy" />
                                            ) : (
                                                <span className="text-[10px] text-slate-300 font-bold">
                                                    {localizeTeamName(activeSummaryData.homeTeam?.name || '').slice(0, 2).toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <p className="hidden sm:block text-base font-bold text-white text-left truncate">{localizeTeamName(activeSummaryData.homeTeam?.name || '')}</p>
                                    </div>
                                    <p className="text-3xl font-black text-white px-4">
                                        {activeSummaryData.homeTeam?.score ?? '0'} <span className="text-slate-500">-</span> {activeSummaryData.awayTeam?.score ?? '0'}
                                    </p>
                                    <div className="flex items-center justify-end gap-2.5 min-w-0">
                                        <p className="hidden sm:block text-base font-bold text-white text-right truncate">{localizeTeamName(activeSummaryData.awayTeam?.name || '')}</p>
                                        <div className="w-11 h-11 rounded-full overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                                            {summaryAwayLogo ? (
                                                <img src={summaryAwayLogo} alt={localizeTeamName(activeSummaryData.awayTeam?.name || '')} className="w-full h-full object-contain p-1" loading="lazy" />
                                            ) : (
                                                <span className="text-[10px] text-slate-300 font-bold">
                                                    {localizeTeamName(activeSummaryData.awayTeam?.name || '').slice(0, 2).toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-2 text-center">
                                    {localizeSummaryStatus(activeSummaryData.statusDetail)}
                                </p>
                                {summaryIncidentEvents.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                                        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
                                            <div className="space-y-1 min-w-0">
                                                {homeSummaryIncidents.map((event, index) => (
                                                    <div key={`summary-home-incident-${index}`} className="flex items-center gap-1 text-[11px] min-w-0">
                                                        <span className="text-slate-400 shrink-0 w-10 text-right tabular-nums">{formatMatchClock(event.clock)}</span>
                                                        <MatchEventIcon event={event} className={event.isGoal ? 'w-3.5 h-3.5 shrink-0' : 'w-3 h-4 shrink-0'} />
                                                        <span className={event.isGoal ? 'text-yellow-300 font-semibold truncate' : 'text-red-300 font-medium truncate'}>
                                                            {formatIncidentLabel(event)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="text-slate-500 text-xs pt-1">•</div>
                                            <div className="space-y-1 min-w-0">
                                                {awaySummaryIncidents.map((event, index) => (
                                                    <div key={`summary-away-incident-${index}`} className="flex items-center justify-end gap-1 text-[11px] min-w-0">
                                                        <span className={event.isGoal ? 'text-yellow-300 font-semibold truncate text-right' : 'text-red-300 font-medium truncate text-right'}>
                                                            {formatIncidentLabel(event)}
                                                        </span>
                                                        <MatchEventIcon event={event} className={event.isGoal ? 'w-3.5 h-3.5 shrink-0' : 'w-3 h-4 shrink-0'} />
                                                        <span className="text-slate-400 shrink-0 w-10 tabular-nums">{formatMatchClock(event.clock)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {neutralSummaryIncidents.length > 0 && (
                                            <div className="space-y-1">
                                                {neutralSummaryIncidents.map((event, index) => (
                                                    <div key={`summary-neutral-incident-${index}`} className="flex items-center justify-center gap-1 text-[11px] min-w-0">
                                                        <span className="text-slate-400 shrink-0 w-10 text-right tabular-nums">{formatMatchClock(event.clock)}</span>
                                                        <MatchEventIcon event={event} className={event.isGoal ? 'w-3.5 h-3.5 shrink-0' : 'w-3 h-4 shrink-0'} />
                                                        <span className={event.isGoal ? 'text-yellow-300 font-semibold truncate' : 'text-red-300 font-medium truncate'}>
                                                            {formatIncidentLabel(event)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {Array.isArray(activeSummaryData.stats) && activeSummaryData.stats.length > 0 && (
                                <div className="glass-panel rounded-xl p-4">
                                    <h4 className="text-sm font-bold text-white mb-3">Özet İstatistikler</h4>
                                    <div className="space-y-3">
                                        {activeSummaryData.stats.map((stat, index) => {
                                            const homeVal = Number.parseFloat(String(stat.homeValue).replace(',', '.')) || 0;
                                            const awayVal = Number.parseFloat(String(stat.awayValue).replace(',', '.')) || 0;
                                            const total = homeVal + awayVal || 1;

                                            return (
                                                <div key={`${stat.key}-${index}`} className="space-y-1">
                                                    <div className="flex justify-between text-xs text-slate-300">
                                                        <span className="font-semibold text-white">{stat.homeValue}</span>
                                                        <span>{stat.label}</span>
                                                        <span className="font-semibold text-white">{stat.awayValue}</span>
                                                    </div>
                                                    <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden flex">
                                                        <div className="h-full bg-yellow-400" style={{ width: `${(homeVal / total) * 100}%` }} />
                                                        <div className="h-full flex-1 bg-slate-600" />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {activeSummaryData.lineups && (
                                <MatchLineups
                                    lineups={activeSummaryData.lineups}
                                    homeTeamName={activeSummaryData.homeTeam?.name}
                                    awayTeamName={activeSummaryData.awayTeam?.name}
                                    matchId={activeSummaryMatch?.id}
                                />
                            )}

                            {Array.isArray(activeSummaryData.events) && activeSummaryData.events.length > 0 && (
                                <div className="glass-panel rounded-xl p-4">
                                    <h4 className="text-sm font-bold text-white mb-3">Maç Olayları</h4>
                                    <div className="space-y-2">
                                        {activeSummaryData.events.map((event, index) => {
                                            const eventType = getEventVisualType(event);
                                            const rowClass = eventType === 'goal'
                                                ? 'bg-yellow-400/10'
                                                : eventType === 'red-card'
                                                    ? 'bg-red-500/10'
                                                    : 'bg-white/5';
                                            const textClass = eventType === 'goal'
                                                ? 'text-yellow-300 font-semibold'
                                                : eventType === 'red-card'
                                                    ? 'text-red-300'
                                                    : 'text-slate-200';

                                            return (
                                                <div key={`${event.clock}-${index}`} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${rowClass}`}>
                                                    <span className="text-[11px] text-yellow-300 w-12">{formatMatchClock(event.clock)}</span>
                                                    <span className="w-4 h-4 flex items-center justify-center">
                                                        <MatchEventIcon event={event} className={eventType === 'goal' ? 'w-4 h-4' : 'w-3 h-4'} />
                                                    </span>
                                                    <span className={`text-sm ${textClass}`}>
                                                        {localizePlayerName(event.player || '') || event.type || 'Olay'}
                                                        {event.isGoal && event.isPenalty && (
                                                            <span className="ml-1 text-yellow-200 font-semibold">(P)</span>
                                                        )}
                                                        {event.isGoal && event.isOwnGoal && (
                                                            <span className="ml-1 text-yellow-200 font-semibold">(K.K)</span>
                                                        )}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default MatchSummaryModal;


