import { useEffect, useMemo, useRef, useState } from 'react';
import type {
    UefaBracket,
    UefaBracketTie,
    UefaJourneyMatch,
    UefaPathStage,
    UefaPathStageStatus,
} from '../types';
import { localizeTeamName } from '../utils/localize';
import {
    buildBracketLayout,
    getBracketCanvasHeight,
    getBracketCanvasWidth,
    getBracketColumnLeft,
    getBracketSlotTop,
    UEFA_BRACKET_DENSITIES,
    UEFA_BRACKET_STAGE_SPECS,
    type UefaBracketDensity,
    type UefaBracketStageLayout,
} from '../utils/uefaBracketLayout';
import UefaTeamCrest from './UefaTeamCrest';

const FENERBAHCE_ESPN_ID = '436';

const STATUS_LABELS: Record<UefaPathStageStatus, string> = {
    completed: 'Tamamlandı',
    active: 'Devam ediyor',
    upcoming: 'Sıradaki aşama',
    awaiting: 'Fikstür bekleniyor',
    bypassed: 'Doğrudan geçti',
    transferred: 'Alt kulvara geçti',
    eliminated: 'Elendi',
    locked: 'Henüz belli değil',
};

const STATUS_STYLES: Record<UefaPathStageStatus, { dot: string; text: string }> = {
    completed: { dot: 'bg-emerald-400', text: 'text-emerald-300' },
    active: { dot: 'bg-yellow-400', text: 'text-yellow-300' },
    upcoming: { dot: 'bg-sky-400', text: 'text-sky-300' },
    awaiting: { dot: 'bg-slate-500', text: 'text-slate-400' },
    bypassed: { dot: 'bg-emerald-400', text: 'text-emerald-300' },
    transferred: { dot: 'bg-orange-400', text: 'text-orange-300' },
    eliminated: { dot: 'bg-red-400', text: 'text-red-300' },
    locked: { dot: 'bg-slate-700', text: 'text-slate-500' },
};

const formatMatchDate = (date: string | null): string => {
    if (!date) return 'Tarih bekleniyor';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return 'Tarih bekleniyor';
    return new Intl.DateTimeFormat('tr-TR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Istanbul',
    }).format(parsed);
};

const formatMatchStatus = (match: UefaJourneyMatch): string | null => {
    if (match.status.completed) return 'MS';
    if (match.status.state === 'in') return 'Canlı';
    return null;
};

const MatchRows = ({ match }: { match: UefaJourneyMatch }) => {
    const statusLabel = formatMatchStatus(match);
    return (
        <div className="border-t border-white/[0.07] py-2.5 first:border-t-0">
            <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px] text-slate-500">
                <span>{formatMatchDate(match.date)}</span>
                {statusLabel && <span className="truncate text-right">{statusLabel}</span>}
            </div>
            {[
                { ...match.homeTeam, homeAway: 'home' },
                { ...match.awayTeam, homeAway: 'away' },
            ].map((team) => {
                const isFener = String(team.id) === FENERBAHCE_ESPN_ID;
                return (
                    <div
                        key={`${match.id}-${team.homeAway}`}
                        className={`flex items-center justify-between gap-3 py-0.5 text-sm ${isFener ? 'font-bold text-white' : 'text-slate-300'}`}
                    >
                        <span className="flex min-w-0 items-center gap-2">
                            <UefaTeamCrest team={team} />
                            <span className="truncate">{localizeTeamName(team.name)}</span>
                        </span>
                        <span className="shrink-0 tabular-nums">{team.score ?? '–'}</span>
                    </div>
                );
            })}
        </div>
    );
};

const getStageSummary = (stage: UefaPathStage) => {
    if (stage.key === 'league-phase' && stage.position) {
        return `${stage.position}. sıra${stage.points != null ? ` · ${stage.points} puan` : ''}`;
    }

    if (!stage.aggregate) return null;
    const fenerScore = stage.aggregate[FENERBAHCE_ESPN_ID];
    const opponentScore = Object.entries(stage.aggregate)
        .find(([teamId]) => String(teamId) !== FENERBAHCE_ESPN_ID)?.[1];
    const scores = fenerScore != null && opponentScore != null
        ? [fenerScore, opponentScore]
        : Object.values(stage.aggregate);
    return scores.length === 2 ? `Toplam skor ${scores.join('–')}` : null;
};

export const UefaPathView = ({ stages }: { stages: UefaPathStage[] }) => {
    if (stages.length === 0) {
        return <EmptyState text="Avrupa yolu henüz açıklanmadı." />;
    }

    const eliminatedStageIndex = stages.findIndex((stage) => stage.status === 'eliminated');

    return (
        <div className="px-4 py-5 sm:px-6">
            <div className="relative ml-1 border-l border-white/10">
                {stages.map((stage, index) => {
                    const style = STATUS_STYLES[stage.status];
                    const summary = getStageSummary(stage);
                    const statusLabel = eliminatedStageIndex >= 0
                        && index > eliminatedStageIndex
                        && stage.status === 'locked'
                        ? '-'
                        : STATUS_LABELS[stage.status];
                    const showCompetition = Boolean(
                        stage.competitionName
                        && stage.competitionName !== stages[index - 1]?.competitionName
                    );
                    return (
                        <section key={`${stage.competitionKey || 'uefa'}-${stage.key}`} className="relative pb-7 pl-6 last:pb-1">
                            <span className={`absolute -left-[5px] top-1.5 h-[9px] w-[9px] rounded-full ring-4 ring-slate-950 ${style.dot}`} />
                            <div className="flex min-w-0 items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h3 className="text-sm font-bold text-white">{stage.label}</h3>
                                    {showCompetition && (
                                        <p className="mt-0.5 truncate text-[11px] text-slate-500">
                                            {stage.competitionName}
                                        </p>
                                    )}
                                </div>
                                <span className={`shrink-0 pt-0.5 text-[10px] font-semibold ${style.text}`}>
                                    {statusLabel}
                                </span>
                            </div>
                            {summary && <p className="mt-1 text-xs font-semibold text-slate-300">{summary}</p>}
                            {(stage.matches?.length ?? 0) > 0 && (
                                <div className="mt-2.5">
                                    {stage.matches?.map((match) => <MatchRows key={match.id} match={match} />)}
                                </div>
                            )}
                        </section>
                    );
                })}
            </div>
        </div>
    );
};

const BracketTieCard = ({ tie, compact }: { tie: UefaBracketTie; compact: boolean }) => {
    const hasFener = tie.teams.some((team) => String(team.id) === FENERBAHCE_ESPN_ID);
    const footer = tie.status === 'completed'
        ? 'Tamamlandı'
        : tie.status === 'live'
            ? 'Canlı'
            : formatMatchDate(
                tie.legs.find((leg) => !leg.status.completed)?.date
                ?? tie.legs[0]?.date
                ?? null
            );

    return (
        <article
            className={`h-full border bg-white/[0.035] shadow-[0_10px_24px_rgba(0,0,0,0.16)] ${compact
                ? 'rounded-lg px-1.5 py-1'
                : 'rounded-xl px-2.5 py-2'
            } ${hasFener
                ? 'border-yellow-400/35'
                : 'border-white/10'
            }`}
            aria-label={`${tie.stageLabel} eşleşmesi`}
        >
            {tie.teams.slice(0, 2).map((team) => {
                const isWinner = String(tie.winnerTeamId) === String(team.id);
                const isFener = String(team.id) === FENERBAHCE_ESPN_ID;
                const aggregateScore = tie.aggregate?.[team.id];
                return (
                    <div
                        key={`${tie.id}-${team.id}`}
                        className={`flex min-w-0 items-center py-0.5 ${compact ? 'gap-1.5 text-[10px] leading-none' : 'gap-2 text-xs'} ${isWinner || isFener
                            ? 'font-bold text-white'
                            : 'text-slate-400'
                        }`}
                    >
                        <UefaTeamCrest team={team} className={compact ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]'} />
                        <span className="min-w-0 flex-1 truncate">
                            {localizeTeamName(team.shortName || team.name)}
                        </span>
                        <span className="shrink-0 tabular-nums">{aggregateScore ?? '–'}</span>
                    </div>
                );
            })}
            <p className={`truncate ${compact ? 'mt-0.5 text-[8px] leading-none' : 'mt-1 text-[9px]'} ${tie.status === 'live' ? 'text-red-300' : 'text-slate-500'}`}>
                {footer}
            </p>
        </article>
    );
};

const BracketPlaceholder = ({ compact }: { compact: boolean }) => (
    <div className={`flex h-full items-center justify-center border border-dashed border-white/10 bg-white/[0.015] text-center font-medium text-slate-600 ${compact
        ? 'rounded-lg px-1.5 text-[9px]'
        : 'rounded-xl px-3 text-[10px]'
    }`}>
        Kura bekleniyor
    </div>
);

interface BracketConnector {
    id: string;
    path: string;
    fenerProgression: boolean;
}

const buildBracketConnectors = (
    layout: UefaBracketStageLayout[],
    density: UefaBracketDensity
): BracketConnector[] => {
    const connectors: BracketConnector[] = [];

    layout.forEach((stage, stageIndex) => {
        const nextStage = layout[stageIndex + 1];
        if (!nextStage) return;

        stage.ties.forEach((tie, slotIndex) => {
            if (!tie?.nextTieId) return;
            const targetSlotIndex = nextStage.ties.findIndex((candidate) => candidate?.id === tie.nextTieId);
            if (targetSlotIndex < 0) return;

            const startX = getBracketColumnLeft(stageIndex, density) + density.columnWidth;
            const endX = getBracketColumnLeft(stageIndex + 1, density);
            const midpointX = startX + (endX - startX) / 2;
            const startY = getBracketSlotTop(slotIndex, stage.slotCount, density) + density.cardHeight / 2;
            const endY = getBracketSlotTop(targetSlotIndex, nextStage.slotCount, density) + density.cardHeight / 2;
            connectors.push({
                id: `${tie.id}-${tie.nextTieId}`,
                path: `M ${startX} ${startY} H ${midpointX} V ${endY} H ${endX}`,
                fenerProgression: String(tie.winnerTeamId) === FENERBAHCE_ESPN_ID,
            });
        });
    });

    return connectors;
};

const isMobileBracketViewport = (): boolean => {
    if (typeof window === 'undefined') return false;
    if (typeof window.matchMedia === 'function') return window.matchMedia('(max-width: 639px)').matches;
    return window.innerWidth < 640;
};

const useMobileBracketDensity = (): boolean => {
    const [mobile, setMobile] = useState(isMobileBracketViewport);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        if (typeof window.matchMedia !== 'function') {
            const handleResize = () => setMobile(window.innerWidth < 640);
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }

        const mediaQuery = window.matchMedia('(max-width: 639px)');
        const handleChange = (event: MediaQueryListEvent) => setMobile(event.matches);
        setMobile(mediaQuery.matches);
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    return mobile;
};

export const UefaBracketView = ({ bracket }: { bracket: UefaBracket | null }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const compact = useMobileBracketDensity();
    const density = compact ? UEFA_BRACKET_DENSITIES.mobile : UEFA_BRACKET_DENSITIES.desktop;
    const layout = useMemo(() => buildBracketLayout(bracket), [bracket]);
    const connectors = useMemo(() => buildBracketConnectors(layout, density), [density, layout]);
    const canvasHeight = getBracketCanvasHeight(density);
    const canvasWidth = getBracketCanvasWidth(density);

    useEffect(() => {
        const scroller = scrollRef.current;
        if (!scroller?.scrollTo) return;

        let targetStageIndex = -1;
        let targetSlotIndex = -1;
        layout.forEach((stage, stageIndex) => {
            stage.ties.forEach((tie, slotIndex) => {
                if (tie?.teams.some((team) => String(team.id) === FENERBAHCE_ESPN_ID)) {
                    targetStageIndex = stageIndex;
                    targetSlotIndex = slotIndex;
                }
            });
        });

        if (targetStageIndex < 0) {
            targetStageIndex = layout.findIndex((stage) => stage.ties.some(Boolean));
            targetSlotIndex = 0;
        }

        if (targetStageIndex < 0) targetStageIndex = 0;
        scroller.scrollTo({
            left: Math.max(0, getBracketColumnLeft(targetStageIndex, density) - (compact ? 8 : 16)),
            top: compact
                ? 0
                : Math.max(0, getBracketSlotTop(Math.max(0, targetSlotIndex), layout[targetStageIndex].slotCount, density) - 58),
            behavior: 'smooth',
        });
    }, [compact, density, layout]);

    return (
        <div
            ref={scrollRef}
            className="h-full min-h-0 snap-x snap-mandatory overflow-auto overscroll-contain scroll-smooth"
            aria-label="UEFA turnuva ağacı"
            data-density={compact ? 'compact' : 'comfortable'}
            tabIndex={0}
        >
            <div className="relative" style={{ width: canvasWidth }}>
                <div
                    className="sticky top-0 z-30 flex border-b border-white/10 bg-[var(--standings-dialog-bg)]/95 px-0 backdrop-blur-md"
                    style={{ height: density.headerHeight }}
                >
                    {layout.map((stage, stageIndex) => (
                        <div
                            key={stage.key}
                            className={`flex shrink-0 snap-start items-center font-bold text-slate-300 ${compact ? 'text-[10px]' : 'text-xs'}`}
                            style={{
                                width: density.columnWidth,
                                marginRight: stageIndex === layout.length - 1 ? 0 : density.columnGap,
                            }}
                        >
                            {stage.label}
                        </div>
                    ))}
                </div>

                <div data-testid="bracket-canvas" className="relative" style={{ height: canvasHeight }}>
                    <svg
                        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                        preserveAspectRatio="none"
                        aria-hidden="true"
                    >
                        {connectors.map((connector) => (
                            <path
                                key={connector.id}
                                data-testid="bracket-connector"
                                d={connector.path}
                                fill="none"
                                stroke={connector.fenerProgression ? '#facc15' : 'rgba(148, 163, 184, 0.34)'}
                                strokeWidth={connector.fenerProgression ? 2.5 : 1.5}
                                vectorEffect="non-scaling-stroke"
                            />
                        ))}
                    </svg>

                    {layout.flatMap((stage, stageIndex) => stage.ties.map((tie, slotIndex) => (
                        <div
                            key={tie?.id || `${stage.key}-placeholder-${slotIndex}`}
                            className="absolute"
                            style={{
                                left: getBracketColumnLeft(stageIndex, density),
                                top: getBracketSlotTop(slotIndex, stage.slotCount, density),
                                width: density.columnWidth,
                                height: density.cardHeight,
                            }}
                        >
                            {tie
                                ? <BracketTieCard tie={tie} compact={compact} />
                                : <BracketPlaceholder compact={compact} />}
                        </div>
                    )))}
                </div>
            </div>
        </div>
    );
};

export const EmptyState = ({ text }: { text: string }) => (
    <div className="px-5 py-16 text-center text-sm text-slate-400">{text}</div>
);
