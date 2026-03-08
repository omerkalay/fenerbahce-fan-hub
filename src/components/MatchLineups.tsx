import { useState, useEffect } from 'react';
import { localizePlayerName } from '../utils/playerDisplay';
import { localizeTeamName } from '../utils/localize';
import type { MatchLineups as MatchLineupsType, TeamLineup, LineupPlayer } from '../types';

const FENERBAHCE_NAMES = ['fenerbahce', 'fenerbahçe'];

const isFenerbahce = (name: string): boolean =>
    FENERBAHCE_NAMES.some((fb) => name.toLowerCase().includes(fb));

const MINI_PITCH_SVG = `data:image/svg+xml,${encodeURIComponent(`<svg viewBox="0 0 68 105" xmlns="http://www.w3.org/2000/svg"><rect width="68" height="105" fill="#166534" rx="2"/><g stroke="rgba(255,255,255,0.3)" stroke-width="0.4" fill="none"><rect x="4" y="4" width="60" height="97"/><line x1="4" y1="52.5" x2="64" y2="52.5"/><circle cx="34" cy="52.5" r="9.15"/><circle cx="34" cy="52.5" r="0.5" fill="rgba(255,255,255,0.3)"/><rect x="13.84" y="4" width="40.32" height="16.5"/><rect x="24.84" y="4" width="18.32" height="5.5"/><rect x="13.84" y="84.5" width="40.32" height="16.5"/><rect x="24.84" y="95.5" width="18.32" height="5.5"/></g></svg>`)}`;

// ── Position classification ────────────────────────────

type PosGroup = 'GK' | 'DEF' | 'MID' | 'FWD';

const classifyPosition = (pos: string): PosGroup => {
    const p = pos.toLowerCase();
    if (p.includes('goalkeeper') || p.includes('kaleci') || p === 'gk') return 'GK';
    if (p.includes('defender') || p.includes('back') || p === 'def' || p === 'd') return 'DEF';
    if (p.includes('midfielder') || p.includes('midfield') || p === 'mid' || p === 'm') return 'MID';
    if (p.includes('forward') || p.includes('striker') || p.includes('wing') || p === 'fwd' || p === 'f') return 'FWD';
    return 'MID';
};

// ── Row building ────────────────────────────────────────

interface FormationRow {
    y: number;
    players: { name: string; jersey: string }[];
}

const GROUP_Y: Record<PosGroup, number> = { GK: 92, DEF: 72, MID: 48, FWD: 20 };

const buildPositionBasedRows = (starters: LineupPlayer[]): FormationRow[] => {
    const buckets: Record<PosGroup, LineupPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const p of starters) {
        const group = (p as LineupPlayer & { positionGroup?: string }).positionGroup as PosGroup | undefined
            || classifyPosition(p.position);
        buckets[group].push(p);
    }
    const order: PosGroup[] = ['GK', 'DEF', 'MID', 'FWD'];
    return order
        .filter((g) => buckets[g].length > 0)
        .map((g) => ({
            y: GROUP_Y[g],
            players: buckets[g].map((p) => ({ name: p.name, jersey: p.jersey }))
        }));
};

const buildFormationRows = (formation: string, starters: LineupPlayer[]): FormationRow[] => {
    const parts = formation.split('-').map(Number).filter((n) => n > 0);
    if (parts.length === 0) return buildPositionBasedRows(starters);

    // Use position data to sort starters into GK + formation bands
    const buckets: Record<PosGroup, LineupPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const p of starters) {
        const group = (p as LineupPlayer & { positionGroup?: string }).positionGroup as PosGroup | undefined
            || classifyPosition(p.position);
        buckets[group].push(p);
    }

    const rows: FormationRow[] = [];

    // GK row
    const gkPlayers = buckets.GK.length > 0
        ? buckets.GK
        : [starters[0]]; // absolute fallback
    rows.push({
        y: 92,
        players: gkPlayers.map((p) => ({ name: p.name, jersey: p.jersey }))
    });

    // Outfield: distribute position-grouped players into formation rows
    // Build a sorted pool respecting formation band counts
    const outfieldPool: LineupPlayer[] = [];
    const bandOrder: PosGroup[] = ['DEF', 'MID', 'FWD'];
    for (const band of bandOrder) {
        outfieldPool.push(...buckets[band]);
    }
    // Also include any GK overflow (rare, >1 GK in starters)
    if (buckets.GK.length > 1) {
        outfieldPool.unshift(...buckets.GK.slice(1));
    }

    const totalParts = parts.length;
    const yPositions = totalParts <= 3
        ? [72, 48, 20]
        : totalParts <= 4
            ? [72, 55, 35, 15]
            : [75, 60, 45, 30, 15];

    let idx = 0;
    parts.forEach((count, rowIdx) => {
        const rowPlayers = outfieldPool.slice(idx, idx + count);
        idx += count;
        if (rowPlayers.length > 0) {
            rows.push({
                y: yPositions[rowIdx] ?? (70 - rowIdx * 18),
                players: rowPlayers.map((p) => ({ name: p.name, jersey: p.jersey }))
            });
        }
    });

    // If there are leftover players not covered by formation count, append them
    if (idx < outfieldPool.length) {
        const remaining = outfieldPool.slice(idx);
        rows.push({
            y: 15,
            players: remaining.map((p) => ({ name: p.name, jersey: p.jersey }))
        });
    }

    return rows;
};

const parseFormationRows = (formation: string | null, starters: TeamLineup['starters']): FormationRow[] => {
    if (starters.length === 0) return [];

    // Has position data? Use position-aware logic
    const hasPositionData = starters.some((p) => p.position && p.position.length > 0);

    if (formation) {
        if (hasPositionData) {
            return buildFormationRows(formation, starters);
        }
        // Formation only, no position data: slice by count
        const parts = formation.split('-').map(Number).filter((n) => n > 0);
        if (parts.length > 0) {
            const rows: FormationRow[] = [{
                y: 92,
                players: [{ name: starters[0]?.name || '', jersey: starters[0]?.jersey || '' }]
            }];
            let pi = 1;
            const yPos = parts.length <= 3 ? [72, 48, 20] : parts.length <= 4 ? [72, 55, 35, 15] : [75, 60, 45, 30, 15];
            parts.forEach((count, ri) => {
                const slice = starters.slice(pi, pi + count);
                pi += count;
                if (slice.length > 0) {
                    rows.push({ y: yPos[ri] ?? (70 - ri * 18), players: slice.map((p) => ({ name: p.name, jersey: p.jersey })) });
                }
            });
            return rows;
        }
    }

    // No formation: fall back to position-based grouping
    if (hasPositionData) {
        return buildPositionBasedRows(starters);
    }

    // Last resort: single row
    return [{ y: 50, players: starters.map((p) => ({ name: p.name, jersey: p.jersey })) }];
};

// ── Pitch component ─────────────────────────────────────

interface MiniPitchProps {
    lineup: TeamLineup;
}

function MiniPitch({ lineup }: MiniPitchProps) {
    const rows = parseFormationRows(lineup.formation, lineup.starters);

    return (
        <div className="relative w-full aspect-[68/105] rounded-lg overflow-hidden border border-white/10">
            <img src={MINI_PITCH_SVG} alt="" className="absolute inset-0 w-full h-full" />
            <div className="absolute inset-0">
                {rows.map((row, rowIdx) => {
                    const count = row.players.length;
                    return row.players.map((player, pIdx) => {
                        const x = count === 1
                            ? 50
                            : 15 + (pIdx / (count - 1)) * 70;
                        return (
                            <div
                                key={`${rowIdx}-${pIdx}`}
                                className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
                                style={{ top: `${row.y}%`, left: `${x}%` }}
                            >
                                <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-yellow-400/90 text-black text-[10px] sm:text-xs font-bold flex items-center justify-center shadow-md">
                                    {player.jersey}
                                </span>
                                <span className="text-[8px] sm:text-[9px] text-white font-medium mt-0.5 max-w-[52px] sm:max-w-[60px] truncate text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                    {localizePlayerName(player.name).split(' ').pop() || player.name}
                                </span>
                            </div>
                        );
                    });
                })}
            </div>
        </div>
    );
}

// ── Main component ──────────────────────────────────────

interface MatchLineupsProps {
    lineups: MatchLineupsType;
    homeTeamName?: string;
    awayTeamName?: string;
    matchId?: string;
}

function MatchLineups({ lineups, homeTeamName, awayTeamName, matchId }: MatchLineupsProps) {
    const homeName = homeTeamName || lineups.home?.teamName || 'Ev Sahibi';
    const awayName = awayTeamName || lineups.away?.teamName || 'Deplasman';

    const homeIsFb = isFenerbahce(homeName);
    const defaultTab: 'home' | 'away' = homeIsFb ? 'home' : 'away';
    const [activeTab, setActiveTab] = useState<'home' | 'away'>(defaultTab);

    // Reset to Fenerbahçe tab when a different match is displayed
    useEffect(() => {
        setActiveTab(defaultTab);
    }, [matchId]);

    const tabs: { key: 'home' | 'away'; label: string }[] = homeIsFb
        ? [
            { key: 'home', label: 'Fenerbahce' },
            { key: 'away', label: localizeTeamName(awayName) }
        ]
        : [
            { key: 'away', label: 'Fenerbahce' },
            { key: 'home', label: localizeTeamName(homeName) }
        ];

    const activeLineup: TeamLineup | null = activeTab === 'home' ? lineups.home : lineups.away;

    if (!activeLineup) return null;

    // Defensive guard: formation must be a string, never an object
    const safeFormation: string | null =
        typeof activeLineup.formation === 'string' ? activeLineup.formation : null;

    return (
        <div className="glass-panel rounded-xl p-4">
            <h4 className="text-sm font-bold text-white mb-3">Kadro</h4>

            {/* Toggle Tabs */}
            <div className="flex rounded-lg bg-white/5 p-0.5 mb-4">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-all ${
                            activeTab === tab.key
                                ? 'bg-yellow-400 text-black shadow-sm'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Formation label */}
            {safeFormation && (
                <p className="text-xs text-yellow-300 font-semibold mb-3 text-center">
                    {safeFormation}
                </p>
            )}

            {/* Mini Pitch */}
            <MiniPitch lineup={{ ...activeLineup, formation: safeFormation }} />

            {/* Bench */}
            {activeLineup.bench.length > 0 && (
                <div className="mt-4">
                    <p className="text-xs font-bold text-slate-300 mb-2">Yedekler</p>
                    <div className="flex flex-wrap gap-1.5">
                        {activeLineup.bench.map((player, idx) => (
                            <span
                                key={idx}
                                className="inline-flex items-center gap-1 text-[11px] text-slate-300 bg-white/5 rounded-md px-2 py-1"
                            >
                                <span className="text-yellow-400/70 font-semibold">{player.jersey}</span>
                                {localizePlayerName(player.name)}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Substitutions */}
            {activeLineup.substitutions.length > 0 && (
                <div className="mt-4">
                    <p className="text-xs font-bold text-slate-300 mb-2">Oyuncu Degisiklikleri</p>
                    <div className="space-y-1.5">
                        {activeLineup.substitutions.map((sub, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-[11px]">
                                <span className="text-slate-500 w-10 text-right tabular-nums">{sub.minute}</span>
                                <span className="text-emerald-400">
                                    <svg viewBox="0 0 16 16" className="w-3 h-3 inline" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M2 11h9" /><path d="m8 8 3 3-3 3" />
                                    </svg>
                                </span>
                                <span className="text-emerald-300 font-medium">{localizePlayerName(sub.playerIn)}</span>
                                {sub.playerOut && (
                                    <>
                                        <span className="text-red-400">
                                            <svg viewBox="0 0 16 16" className="w-3 h-3 inline" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <path d="M14 5H5" /><path d="m8 2-3 3 3 3" />
                                            </svg>
                                        </span>
                                        <span className="text-red-300">{localizePlayerName(sub.playerOut)}</span>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default MatchLineups;
