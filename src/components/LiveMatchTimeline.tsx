import { Fragment } from 'react';
import MatchEventIcon from './MatchEventIcon';
import { formatMatchClock } from '../utils/matchClock';
import { localizePlayerName } from '../utils/playerDisplay';
import type { MatchEvent } from '../types';

interface LiveMatchTimelineProps {
    events?: MatchEvent[];
    homeTeamId?: string | number;
    awayTeamId?: string | number;
    homeTeamName?: string;
    awayTeamName?: string;
    compact?: boolean;
}

type MatchPhase = 'İlk Yarı' | 'İkinci Yarı';

const parseMinute = (clock: string): number => {
    const value = Number.parseInt(String(clock || '').match(/\d+/)?.[0] || '0', 10);
    return Number.isFinite(value) ? value : 0;
};

const getPhase = (clock: string): MatchPhase => parseMinute(clock) <= 45 ? 'İlk Yarı' : 'İkinci Yarı';

const isVarEvent = (event: MatchEvent): boolean => /\bvar\b|video assistant/i.test(String(event.type || ''));

const localizeVarDecision = (event: MatchEvent): string => {
    const value = `${event.type || ''} ${event.player || ''}`.toLocaleLowerCase('tr-TR');
    if (/disallow|cancel|iptal|no goal/.test(value)) return 'Gol kararı iptal edildi';
    if (/confirm|awarded|onay/.test(value)) return 'Gol kararı onaylandı';
    if (/penalty|penalt/.test(value)) return 'Penaltı kararı incelendi';
    return 'Pozisyon incelendi';
};

const getEventTitle = (event: MatchEvent, fallbackTeamName = ''): string => {
    if (isVarEvent(event)) return event.player || 'VAR incelemesi';
    const playerName = localizePlayerName(event.player || '');
    if (playerName) return playerName;
    if (event.isYellowCard || event.isRedCard) return fallbackTeamName;
    return event.type || 'Maç olayı';
};

const getEventDetail = (event: MatchEvent): string => {
    if (isVarEvent(event)) return localizeVarDecision(event);
    if (event.isGoal) {
        const suffixes: string[] = [];
        if (event.isPenalty) suffixes.push('Penaltı');
        if (event.isOwnGoal) suffixes.push('Kendi kalesine');
        if (event.assist) suffixes.push(`Asist: ${localizePlayerName(event.assist)}`);
        return suffixes.length > 0 ? suffixes.join(' · ') : 'Gol';
    }
    if (event.isSubstitution) {
        return event.playerOut ? localizePlayerName(event.playerOut) : 'Oyuncu değişikliği';
    }
    if (event.isRedCard || event.isYellowCard) return '';
    return event.type || 'Maç olayı';
};

const getAccessibleEventDetail = (event: MatchEvent): string => {
    if (event.isRedCard) return 'Kırmızı kart';
    if (event.isYellowCard) return 'Sarı kart';
    return getEventDetail(event);
};

const getEventTone = (event: MatchEvent): string => {
    if (event.isRedCard) return 'text-red-300';
    if (event.isSubstitution) return 'text-emerald-300';
    if (isVarEvent(event)) return 'text-sky-300';
    return 'text-slate-100';
};

const getEventDetailTone = (event: MatchEvent): string => (
    event.isSubstitution && event.playerOut ? 'text-rose-300/85' : 'text-slate-400'
);

const EventVisual = ({ event }: { event: MatchEvent }) => {
    if (isVarEvent(event)) {
        return (
            <span className="inline-flex h-5 min-w-7 items-center justify-center rounded bg-sky-400/15 px-1 text-[8px] font-black tracking-wide text-sky-300" aria-hidden="true">
                VAR
            </span>
        );
    }

    return (
        <span className="flex h-5 w-5 items-center justify-center" aria-hidden="true">
            <MatchEventIcon event={event} className={event.isGoal ? 'h-4 w-4' : 'h-4 w-3.5'} />
        </span>
    );
};

const EventSide = ({ event, align, fallbackTeamName }: {
    event: MatchEvent;
    align: 'left' | 'right';
    fallbackTeamName?: string;
}) => {
    const title = getEventTitle(event, fallbackTeamName);
    const detail = getEventDetail(event);

    return (
        <div className={`min-w-0 ${align === 'right' ? 'text-right' : 'text-left'}`}>
            {title && (
                <p className={`line-clamp-2 break-words text-[11px] font-bold leading-tight ${getEventTone(event)}`}>
                    {title}
                </p>
            )}
            {detail && (
                <p className={`mt-1 line-clamp-2 break-words text-[9px] leading-tight ${getEventDetailTone(event)}`}>
                    {detail}
                </p>
            )}
        </div>
    );
};

export default function LiveMatchTimeline({
    events = [],
    homeTeamId,
    awayTeamId,
    homeTeamName = 'Ev sahibi',
    awayTeamName = 'Deplasman',
    compact = false,
}: LiveMatchTimelineProps) {
    const visibleEvents = compact ? events.slice(-4) : events;
    const normalizedHomeId = String(homeTeamId ?? '');
    const normalizedAwayId = String(awayTeamId ?? '');

    if (visibleEvents.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-slate-600/70 bg-slate-950/25 px-4 py-5 text-center text-xs leading-relaxed text-slate-400">
                Maç olayı henüz paylaşılmadı. Skor ve maç durumu güncellenmeye devam ediyor.
            </div>
        );
    }

    return (
        <div>
            {!compact && (
                <div className="mb-2 grid grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] gap-2 px-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                    <span className="truncate text-right">{homeTeamName}</span>
                    <span className="text-center">Dakika</span>
                    <span className="truncate">{awayTeamName}</span>
                </div>
            )}

            <ol className="relative">
                {visibleEvents.map((event, index) => {
                    const phase = getPhase(event.clock);
                    const previousPhase = index > 0 ? getPhase(visibleEvents[index - 1].clock) : null;
                    const showPhase = !compact && phase !== previousPhase;
                    const teamId = String(event.team ?? '');
                    const isHomeEvent = teamId !== '' && teamId === normalizedHomeId;
                    const isAwayEvent = teamId !== '' && teamId === normalizedAwayId;
                    const accessibleSide = isHomeEvent ? homeTeamName : isAwayEvent ? awayTeamName : 'Tarafsız';
                    const fallbackTeamName = isHomeEvent ? homeTeamName : isAwayEvent ? awayTeamName : '';
                    const visibleTitle = getEventTitle(event, fallbackTeamName);
                    const accessibleTitle = event.player || (!event.isYellowCard && !event.isRedCard)
                        ? visibleTitle
                        : '';

                    return (
                        <Fragment key={`${event.clock}-${event.type}-${event.player}-${index}`}>
                            {showPhase && (
                                <li className="flex items-center gap-2 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500" aria-hidden="true">
                                    <span className="h-px flex-1 bg-white/10" />
                                    <span>{phase}</span>
                                    <span className="h-px flex-1 bg-white/10" />
                                </li>
                            )}
                            <li
                                className="grid min-h-14 grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] items-center gap-2 border-b border-white/[0.06] py-2 last:border-b-0"
                                aria-label={[formatMatchClock(event.clock), accessibleSide, accessibleTitle, getAccessibleEventDetail(event)].filter(Boolean).join(', ')}
                            >
                                <div className="min-w-0 pr-1">
                                    {isHomeEvent && <EventSide event={event} align="right" fallbackTeamName={fallbackTeamName} />}
                                </div>
                                <div className="flex flex-col items-center justify-center gap-1">
                                    <span className="font-mono text-[10px] font-black tabular-nums text-slate-300">{formatMatchClock(event.clock)}</span>
                                    <EventVisual event={event} />
                                </div>
                                <div className="min-w-0 pl-1">
                                    {isAwayEvent && <EventSide event={event} align="left" fallbackTeamName={fallbackTeamName} />}
                                    {!isHomeEvent && !isAwayEvent && <EventSide event={event} align="left" />}
                                </div>
                            </li>
                        </Fragment>
                    );
                })}
            </ol>
        </div>
    );
}
