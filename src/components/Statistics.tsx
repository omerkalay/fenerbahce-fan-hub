import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { fetchPlayerStats, fetchFormResults, fetchPlayerStatus } from '../services/api';
import type { PlayerStat, FormResult, PlayerStatusEntry } from '../types';

// ─── Skeleton (reuses FixtureSchedule pattern) ──────────

const SkeletonCard: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
    <div className="glass-panel rounded-2xl p-4 animate-pulse">
        <div className="h-5 w-40 bg-white/10 rounded mb-4" />
        {Array.from({ length: lines }).map((_, i) => (
            <div key={i} className="h-8 w-full bg-white/5 rounded-lg mb-2 last:mb-0" />
        ))}
    </div>
);

// ─── Helpers ────────────────────────────────────────────

// ─── Form Chart ─────────────────────────────────────────

const SVG_W = 320;
const SVG_H = 96;
const SVG_L = 28;
const SVG_R = 12;
const SVG_T = 14;
const SVG_B = 14;

const RESULT_Y: Record<FormResult['result'], number> = { W: SVG_T, D: SVG_H / 2, L: SVG_H - SVG_B };
const DOT_FILL: Record<FormResult['result'], string> = { W: '#34d399', D: '#94a3b8', L: '#fb7185' };
const GLOW_FILL: Record<FormResult['result'], string> = { W: '#34d39950', D: '#94a3b838', L: '#fb718550' };
const LABEL_FILL: Record<FormResult['result'], string> = { W: '#34d399b0', D: '#94a3b890', L: '#fb7185b0' };

interface ChartPoint {
    x: number;
    y: number;
    result: FormResult['result'];
}

// ─── Possession Trend Chart ──────────────────────────────

const POSS_SVG_H = 72;
const POSS_T = 10;
const POSS_B = 10;
const POSS_MIN = 20;
const POSS_MAX = 80;
const POSS_GUIDE_VALS = [20, 50, 80];
const POSS_COLOR = '#60a5fa';
const POSS_GLOW = '#60a5fa40';

const possY = (val: number): number => {
    const clamped = Math.max(POSS_MIN, Math.min(POSS_MAX, val));
    const ratio = (clamped - POSS_MIN) / (POSS_MAX - POSS_MIN);
    return POSS_SVG_H - POSS_B - ratio * (POSS_SVG_H - POSS_T - POSS_B);
};

// ─── Form Chart ─────────────────────────────────────────

const FormChart: React.FC<{ matches: FormResult[] }> = ({ matches }) => {
    const [expanded, setExpanded] = useState(false);
    const data = [...matches].reverse();
    const count = data.length;
    if (count === 0) return null;

    const area = SVG_W - SVG_L - SVG_R;
    const step = count > 1 ? area / (count - 1) : 0;

    const pts: ChartPoint[] = data.map((m, i) => ({
        x: SVG_L + (count === 1 ? area / 2 : i * step),
        y: RESULT_Y[m.result],
        result: m.result,
    }));

    const goals = data.map(m => {
        const parts = m.score.split('-');
        const h = Number(parts[0]) || 0;
        const a = Number(parts[1]) || 0;
        return { scored: m.isHome ? h : a, conceded: m.isHome ? a : h };
    });
    const maxGoal = Math.max(...goals.flatMap(g => [g.scored, g.conceded]), 1);
    const BAR_H = 44;

    const padL = `${(SVG_L / SVG_W) * 100}%`;
    const padR = `${(SVG_R / SVG_W) * 100}%`;

    const hasPossession = data.some(m => m.possession != null);
    const possPts = hasPossession
        ? data.map((m, i) => ({
            x: SVG_L + (count === 1 ? area / 2 : i * step),
            y: possY(m.possession ?? 50),
            val: m.possession ?? 50,
        }))
        : [];

    return (
        <div>
            <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
                <text x="6" y={RESULT_Y.W + 4} fill={LABEL_FILL.W} fontSize="10" fontWeight="700" fontFamily="inherit">G</text>
                <text x="6" y={RESULT_Y.D + 4} fill={LABEL_FILL.D} fontSize="10" fontWeight="700" fontFamily="inherit">B</text>
                <text x="6" y={RESULT_Y.L + 4} fill={LABEL_FILL.L} fontSize="10" fontWeight="700" fontFamily="inherit">M</text>

                {(['W', 'D', 'L'] as const).map(key => (
                    <line key={key} x1={SVG_L - 4} y1={RESULT_Y[key]} x2={SVG_W - SVG_R + 4} y2={RESULT_Y[key]}
                        stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="3 5" />
                ))}

                {pts.length > 1 && pts.slice(0, -1).map((p, i) => {
                    const next = pts[i + 1];
                    const gid = `fg${i}`;
                    return (
                        <g key={`seg-${i}`}>
                            <defs>
                                <linearGradient id={gid} x1={p.x} y1={p.y} x2={next.x} y2={next.y} gradientUnits="userSpaceOnUse">
                                    <stop offset="0%" stopColor={DOT_FILL[p.result]} stopOpacity="0.35" />
                                    <stop offset="100%" stopColor={DOT_FILL[next.result]} stopOpacity="0.35" />
                                </linearGradient>
                            </defs>
                            <line x1={p.x} y1={p.y} x2={next.x} y2={next.y}
                                stroke={`url(#${gid})`} strokeWidth="2" strokeLinecap="round" />
                        </g>
                    );
                })}

                {pts.map((p, i) => (
                    <g key={`dot-${i}`}>
                        <circle cx={p.x} cy={p.y} r="8" fill={GLOW_FILL[p.result]} />
                        <circle cx={p.x} cy={p.y} r="4" fill={DOT_FILL[p.result]} />
                    </g>
                ))}
            </svg>

            <div className="flex justify-between mt-1" style={{ paddingLeft: padL, paddingRight: padR }}>
                {data.map(m => (
                    <div key={m.matchId} className="flex flex-col items-center min-w-0">
                        <span className="text-[9px] text-slate-400 truncate max-w-[44px] text-center">{m.opponent}</span>
                        <span className="text-[8px] text-slate-500">{formatShortDate(m.date)}</span>
                    </div>
                ))}
            </div>

            {/* Expand/Collapse Button */}
            <button
                onClick={() => setExpanded(e => !e)}
                className="w-full flex items-center justify-center gap-1.5 mt-3 pt-2.5 pb-1 border-t border-white/5 text-[11px] text-slate-400 hover:text-slate-300 transition-colors"
            >
                <span>{expanded ? 'Detaylari Gizle' : 'Detaylari Gor'}</span>
                <ChevronDown size={13} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </button>

            {expanded && (
                <>
                    {/* Goal Performance */}
                    <div className="pt-2">
                        <p className="text-[11px] font-semibold text-slate-300 mb-2">Gol Performansi</p>
                        <div className="flex justify-between" style={{ paddingLeft: padL, paddingRight: padR }}>
                            {goals.map((g, i) => (
                                <div key={i} className="flex flex-col items-center">
                                    <div className="flex gap-[3px] items-end" style={{ height: `${BAR_H}px` }}>
                                        <div className="w-[7px] rounded-t-sm bg-emerald-400/70"
                                            style={{ height: g.scored > 0 ? `${Math.max((g.scored / maxGoal) * BAR_H, 4)}px` : '0px' }} />
                                        <div className="w-[7px] rounded-t-sm bg-rose-400/50"
                                            style={{ height: g.conceded > 0 ? `${Math.max((g.conceded / maxGoal) * BAR_H, 4)}px` : '0px' }} />
                                    </div>
                                    <div className="flex gap-[3px] mt-0.5">
                                        <span className="w-[7px] text-[8px] text-slate-500 text-center">{g.scored}</span>
                                        <span className="w-[7px] text-[8px] text-slate-500 text-center">{g.conceded}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center gap-4 mt-2 justify-center">
                            <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-sm bg-emerald-400/70" />
                                <span className="text-[9px] text-slate-500">Atilan</span>
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-sm bg-rose-400/50" />
                                <span className="text-[9px] text-slate-500">Yenilen</span>
                            </span>
                        </div>
                    </div>

                    {/* Possession Trend */}
                    {hasPossession && (
                        <div className="border-t border-white/5 mt-3 pt-3">
                            <p className="text-[11px] font-semibold text-slate-300 mb-2">Topla Oynama %</p>
                            <svg viewBox={`0 0 ${SVG_W} ${POSS_SVG_H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
                                {POSS_GUIDE_VALS.map(v => {
                                    const gy = possY(v);
                                    return (
                                        <g key={`pg-${v}`}>
                                            <text x="6" y={gy + 3} fill="rgba(148,163,184,0.5)" fontSize="8" fontFamily="inherit">%{v}</text>
                                            <line x1={SVG_L - 4} y1={gy} x2={SVG_W - SVG_R + 4} y2={gy}
                                                stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="3 5" />
                                        </g>
                                    );
                                })}

                                {/* 50% baseline */}
                                <line x1={SVG_L - 4} y1={possY(50)} x2={SVG_W - SVG_R + 4} y2={possY(50)}
                                    stroke="rgba(96,165,250,0.12)" strokeWidth="1" />

                                {possPts.length > 1 && possPts.slice(0, -1).map((p, i) => {
                                    const next = possPts[i + 1];
                                    return (
                                        <line key={`ps-${i}`} x1={p.x} y1={p.y} x2={next.x} y2={next.y}
                                            stroke={POSS_COLOR} strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round" />
                                    );
                                })}

                                {possPts.map((p, i) => (
                                    <g key={`pd-${i}`}>
                                        <circle cx={p.x} cy={p.y} r="7" fill={POSS_GLOW} />
                                        <circle cx={p.x} cy={p.y} r="3.5" fill={POSS_COLOR} />
                                        <text x={p.x} y={p.y - 8} textAnchor="middle" fill="rgba(148,163,184,0.7)" fontSize="7" fontFamily="inherit">
                                            {Math.round(p.val)}
                                        </text>
                                    </g>
                                ))}
                            </svg>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

// ─── Helpers (continued) ────────────────────────────────

const getStatusBadge = (status: PlayerStatusEntry['status']): { label: string; dot: string; text: string } => {
    switch (status) {
        case 'injured':
            return { label: 'Sakat', dot: 'bg-red-500', text: 'text-red-400' };
        case 'suspended':
            return { label: 'Cezali', dot: 'bg-yellow-500', text: 'text-yellow-400' };
        case 'doubtful':
            return { label: 'Belirsiz', dot: 'bg-orange-500', text: 'text-orange-400' };
        default:
            return { label: status, dot: 'bg-slate-500', text: 'text-slate-400' };
    }
};

const formatShortDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
};

const formatRelativeTime = (timestamp: number): string => {
    const hoursAgo = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60));
    if (hoursAgo < 1) return 'Az once';
    if (hoursAgo < 24) return `${hoursAgo} saat once`;
    const daysAgo = Math.floor(hoursAgo / 24);
    return `${daysAgo} gun once`;
};

// ─── Component ──────────────────────────────────────────

const Statistics: React.FC = () => {
    // Section 1: Top Scorers
    const [scorers, setScorers] = useState<PlayerStat[]>([]);
    const [scorersLoading, setScorersLoading] = useState(true);
    const [scorersError, setScorersError] = useState<string | null>(null);

    // Section 2: Top Assisters
    const [assisters, setAssisters] = useState<PlayerStat[]>([]);
    const [assistersLoading, setAssistersLoading] = useState(true);
    const [assistersError, setAssistersError] = useState<string | null>(null);

    // Section 3: Team Form
    const [form, setForm] = useState<FormResult[]>([]);
    const [formLoading, setFormLoading] = useState(true);
    const [formError, setFormError] = useState<string | null>(null);

    // Section 4: Player Status
    const [playerStatus, setPlayerStatus] = useState<PlayerStatusEntry[]>([]);
    const [statusLoading, setStatusLoading] = useState(true);
    const [statusError, setStatusError] = useState<string | null>(null);

    // Fetch player stats (single call for both scorers & assisters)
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const stats = await fetchPlayerStats();
                if (cancelled) return;
                setScorers(stats);
                setAssisters(stats);
            } catch {
                if (!cancelled) {
                    setScorersError('Gol kralligi verileri yuklenemedi.');
                    setAssistersError('Asist kralligi verileri yuklenemedi.');
                }
            } finally {
                if (!cancelled) {
                    setScorersLoading(false);
                    setAssistersLoading(false);
                }
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    // Fetch form results
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const results = await fetchFormResults();
                if (cancelled) return;
                setForm(results);
            } catch {
                if (!cancelled) setFormError('Form verileri yuklenemedi.');
            } finally {
                if (!cancelled) setFormLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    // Fetch player status
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const entries = await fetchPlayerStatus();
                if (cancelled) return;
                setPlayerStatus(entries);
            } catch {
                if (!cancelled) setStatusError('Sakatlık verileri yuklenemedi.');
            } finally {
                if (!cancelled) setStatusLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    const [scorersExpanded, setScorersExpanded] = useState(false);
    const [assistersExpanded, setAssistersExpanded] = useState(false);
    const [goalTab, setGoalTab] = useState<'total' | 'league' | 'europa'>('total');
    const [assistTab, setAssistTab] = useState<'total' | 'league' | 'europa'>('total');

    const activeStatusEntries = playerStatus.filter(e => e.status !== 'fit');
    const latestUpdatedAt = playerStatus.reduce((max, e) => Math.max(max, e.updatedAt || 0), 0);

    return (
        <div className="min-h-screen pb-24 space-y-4">
            {/* Section 1: Top Scorers */}
            {scorersLoading ? (
                <SkeletonCard lines={5} />
            ) : (
                <section className="glass-panel rounded-2xl p-4">
                    <h3 className="text-sm font-bold text-white mb-3">Gol Kralligi</h3>
                    {scorersError ? (
                        <p className="text-xs text-rose-300">{scorersError}</p>
                    ) : scorers.length === 0 || scorers.every(s => s.goals === 0) ? (
                        <p className="text-xs text-slate-400">Gol istatistigi henuz mevcut degil.</p>
                    ) : (() => {
                        const goalKey = goalTab === 'league' ? 'leagueGoals' : goalTab === 'europa' ? 'europaGoals' : 'goals';
                        const sorted = [...scorers].sort((a, b) => b[goalKey] - a[goalKey]).filter(p => p[goalKey] > 0);
                        return (
                            <>
                                <div className="flex gap-5 mb-3 border-b border-white/5">
                                    {([['total', 'Toplam'], ['league', 'Süper Lig'], ['europa', 'Avrupa']] as const).map(([key, label]) => (
                                        <button key={key} onClick={() => { setGoalTab(key); setScorersExpanded(false); }}
                                            className={`relative text-xs font-medium pb-2 transition-all duration-200 tracking-wide ${goalTab === key
                                                ? 'text-yellow-300'
                                                : 'text-slate-500 hover:text-slate-400'}`}
                                        >
                                            {label}
                                            {goalTab === key && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-yellow-400 rounded-full" />}
                                        </button>
                                    ))}
                                </div>
                                {sorted.length === 0 ? (
                                    <p className="text-xs text-slate-400">Bu kategoride gol verisi bulunmuyor.</p>
                                ) : (
                                    <>
                                        <div className="space-y-1">
                                            {sorted.slice(0, scorersExpanded ? 10 : 5).map((player, index) => (
                                                <div key={player.playerId} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                                                    <span className="text-xs text-slate-500 w-5 text-right font-medium">{index + 1}</span>
                                                    <span className="text-sm text-white truncate flex-1 max-w-[200px]">{player.name}</span>
                                                    <span className="text-sm font-bold text-yellow-400">{player[goalKey]}</span>
                                                </div>
                                            ))}
                                        </div>
                                        {sorted.length > 5 && (
                                            <button
                                                onClick={() => setScorersExpanded(e => !e)}
                                                className="w-full flex items-center justify-center gap-1.5 mt-2 pt-2 border-t border-white/5 text-[11px] text-slate-400 hover:text-slate-300 transition-colors"
                                            >
                                                <span>{scorersExpanded ? 'Daha Az' : 'Daha Fazla'}</span>
                                                <ChevronDown size={13} className={`transition-transform duration-200 ${scorersExpanded ? 'rotate-180' : ''}`} />
                                            </button>
                                        )}
                                    </>
                                )}
                            </>
                        );
                    })()}
                </section>
            )}

            {/* Section 2: Top Assisters */}
            {assistersLoading ? (
                <SkeletonCard lines={5} />
            ) : (
                <section className="glass-panel rounded-2xl p-4">
                    <h3 className="text-sm font-bold text-white mb-3">Asist Kralligi</h3>
                    {assistersError ? (
                        <p className="text-xs text-rose-300">{assistersError}</p>
                    ) : assisters.length === 0 || assisters.every(s => s.assists === 0) ? (
                        <p className="text-xs text-slate-400">Asist istatistigi henuz mevcut degil.</p>
                    ) : (() => {
                        const assistKey = assistTab === 'league' ? 'leagueAssists' : assistTab === 'europa' ? 'europaAssists' : 'assists';
                        const sorted = [...assisters].sort((a, b) => b[assistKey] - a[assistKey]).filter(p => p[assistKey] > 0);
                        return (
                            <>
                                <div className="flex gap-5 mb-3 border-b border-white/5">
                                    {([['total', 'Toplam'], ['league', 'Süper Lig'], ['europa', 'Avrupa']] as const).map(([key, label]) => (
                                        <button key={key} onClick={() => { setAssistTab(key); setAssistersExpanded(false); }}
                                            className={`relative text-xs font-medium pb-2 transition-all duration-200 tracking-wide ${assistTab === key
                                                ? 'text-yellow-300'
                                                : 'text-slate-500 hover:text-slate-400'}`}
                                        >
                                            {label}
                                            {assistTab === key && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-yellow-400 rounded-full" />}
                                        </button>
                                    ))}
                                </div>
                                {sorted.length === 0 ? (
                                    <p className="text-xs text-slate-400">Bu kategoride asist verisi bulunmuyor.</p>
                                ) : (
                                    <>
                                        <div className="space-y-1">
                                            {sorted.slice(0, assistersExpanded ? 10 : 5).map((player, index) => (
                                                <div key={player.playerId} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                                                    <span className="text-xs text-slate-500 w-5 text-right font-medium">{index + 1}</span>
                                                    <span className="text-sm text-white truncate flex-1 max-w-[200px]">{player.name}</span>
                                                    <span className="text-sm font-bold text-yellow-400">{player[assistKey]}</span>
                                                </div>
                                            ))}
                                        </div>
                                        {sorted.length > 5 && (
                                            <button
                                                onClick={() => setAssistersExpanded(e => !e)}
                                                className="w-full flex items-center justify-center gap-1.5 mt-2 pt-2 border-t border-white/5 text-[11px] text-slate-400 hover:text-slate-300 transition-colors"
                                            >
                                                <span>{assistersExpanded ? 'Daha Az' : 'Daha Fazla'}</span>
                                                <ChevronDown size={13} className={`transition-transform duration-200 ${assistersExpanded ? 'rotate-180' : ''}`} />
                                            </button>
                                        )}
                                    </>
                                )}
                            </>
                        );
                    })()}
                </section>
            )}

            {/* Section 3: Team Form */}
            {formLoading ? (
                <SkeletonCard lines={2} />
            ) : (
                <section className="glass-panel rounded-2xl p-4">
                    <h3 className="text-sm font-bold text-white mb-3">Son Form</h3>
                    {formError ? (
                        <p className="text-xs text-rose-300">{formError}</p>
                    ) : form.length === 0 ? (
                        <p className="text-xs text-slate-400">Form verisi henuz mevcut degil.</p>
                    ) : (
                        <FormChart matches={form} />
                    )}
                </section>
            )}

            {/* Section 4: Injury & Suspension Status */}
            {statusLoading ? (
                <SkeletonCard lines={3} />
            ) : (
                <section className="glass-panel rounded-2xl p-4">
                    <h3 className="text-sm font-bold text-white mb-3">Sakatlık ve Ceza Durumu</h3>
                    {statusError ? (
                        <p className="text-xs text-rose-300">{statusError}</p>
                    ) : activeStatusEntries.length === 0 ? (
                        <p className="text-xs text-slate-400">Sakatlık veya ceza verisi bulunmuyor.</p>
                    ) : (
                        <>
                            <div className="space-y-0">
                                {activeStatusEntries.map((entry, index) => {
                                    const badge = getStatusBadge(entry.status);
                                    return (
                                        <div key={`${entry.name}-${index}`} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-[13px] text-white font-semibold truncate">{entry.name}</span>
                                                    {entry.detail && (
                                                        <span className="text-[11px] text-slate-400">{entry.detail}</span>
                                                    )}
                                                </div>
                                                {entry.returnDate && (
                                                    <span className="text-[10px] text-slate-500 block mt-0.5">
                                                        Tahmini donus: {entry.returnDate}
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`text-[10px] uppercase tracking-wider font-semibold shrink-0 ${badge.text} opacity-70 -ml-1`}>
                                                {badge.label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            {latestUpdatedAt > 0 && (
                                <p className="text-[10px] text-slate-500 mt-3 text-right">
                                    Son guncelleme: {formatRelativeTime(latestUpdatedAt)}
                                </p>
                            )}
                        </>
                    )}
                </section>
            )}
        </div>
    );
};

export default Statistics;
