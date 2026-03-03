import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { FormResult } from '../../types';

const SVG_W = 320;
const SVG_H = 100;
const SVG_L = 36;
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

interface PossPoint {
    x: number;
    y: number;
    val: number;
}

const POSS_SVG_H = 76;
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

const formatShortDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
};

const FormChart: React.FC<{ matches: FormResult[] }> = ({ matches }) => {
    const [expanded, setExpanded] = useState(false);
    const data = useMemo(() => [...matches].reverse(), [matches]);
    const count = data.length;

    if (count === 0) return null;

    const area = SVG_W - SVG_L - SVG_R;
    const step = count > 1 ? area / (count - 1) : 0;

    const pts: ChartPoint[] = data.map((m, i) => ({
        x: SVG_L + (count === 1 ? area / 2 : i * step),
        y: RESULT_Y[m.result],
        result: m.result,
    }));

    const goals = data.map((m) => {
        const parts = m.score.split('-');
        const h = Number(parts[0]) || 0;
        const a = Number(parts[1]) || 0;
        return { scored: m.isHome ? h : a, conceded: m.isHome ? a : h };
    });

    const maxGoal = Math.max(...goals.flatMap((g) => [g.scored, g.conceded]), 1);
    const BAR_H = 44;

    const possPts: PossPoint[] = data.flatMap((m, i) => {
        if (m.possession == null || Number.isNaN(m.possession)) return [];
        const x = SVG_L + (count === 1 ? area / 2 : i * step);
        return [{ x, y: possY(m.possession), val: m.possession }];
    });
    const hasPossession = possPts.length > 0;
    const hasMissingPossession = hasPossession && possPts.length < data.length;

    return (
        <div>
            <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
                <text x="6" y={RESULT_Y.W + 4} fill={LABEL_FILL.W} fontSize="11" fontWeight="700" fontFamily="inherit">G</text>
                <text x="6" y={RESULT_Y.D + 4} fill={LABEL_FILL.D} fontSize="11" fontWeight="700" fontFamily="inherit">B</text>
                <text x="6" y={RESULT_Y.L + 4} fill={LABEL_FILL.L} fontSize="11" fontWeight="700" fontFamily="inherit">M</text>

                {(['W', 'D', 'L'] as const).map((key) => (
                    <line
                        key={key}
                        x1={SVG_L - 4}
                        y1={RESULT_Y[key]}
                        x2={SVG_W - SVG_R + 4}
                        y2={RESULT_Y[key]}
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth="1"
                    />
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
                            <line x1={p.x} y1={p.y} x2={next.x} y2={next.y} stroke={`url(#${gid})`} strokeWidth="2" strokeLinecap="round" />
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

            <div className="relative mt-1 h-[30px]">
                {data.map((m, i) => {
                    const xPct = (pts[i].x / SVG_W) * 100;
                    return (
                        <div
                            key={m.matchId}
                            className="absolute flex flex-col items-center -translate-x-1/2"
                            style={{ left: `${xPct}%` }}
                        >
                            <span className="text-[11px] text-slate-400 truncate max-w-[54px] text-center">{m.opponent}</span>
                            <span className="text-[10px] text-slate-500">{formatShortDate(m.date)}</span>
                        </div>
                    );
                })}
            </div>

            <button
                onClick={() => setExpanded((value) => !value)}
                className="w-full flex items-center justify-center gap-1.5 mt-3 pt-2.5 pb-1 border-t border-white/5 text-[11px] text-slate-400 hover:text-slate-300 transition-colors"
            >
                <span>{expanded ? 'Detaylari Gizle' : 'Detaylari Gor'}</span>
                <ChevronDown size={13} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </button>

            {expanded && (
                <>
                    <div className="pt-2">
                        <p className="text-[13px] font-semibold text-slate-300 mb-2">Gol Performansi</p>
                        <div className="relative" style={{ height: `${BAR_H + 20}px` }}>
                            {goals.map((g, i) => {
                                const xPct = (pts[i].x / SVG_W) * 100;
                                return (
                                    <div
                                        key={i}
                                        className="absolute flex flex-col items-center -translate-x-1/2"
                                        style={{ left: `${xPct}%`, bottom: 0 }}
                                    >
                                        <div className="flex gap-0.5 items-end" style={{ height: `${BAR_H}px` }}>
                                            <div
                                                className="w-[9px] rounded-t-sm bg-emerald-400/70"
                                                style={{ height: g.scored > 0 ? `${Math.max((g.scored / maxGoal) * BAR_H, 4)}px` : '0px' }}
                                            />
                                            <div
                                                className="w-[9px] rounded-t-sm bg-rose-400/50"
                                                style={{ height: g.conceded > 0 ? `${Math.max((g.conceded / maxGoal) * BAR_H, 4)}px` : '0px' }}
                                            />
                                        </div>
                                        <div className="flex gap-0.5 mt-0.5">
                                            <span className="w-[9px] text-[11px] text-slate-500 text-center">{g.scored}</span>
                                            <span className="w-[9px] text-[11px] text-slate-500 text-center">{g.conceded}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex items-center gap-4 mt-2 justify-center">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-sm bg-emerald-400/70" />
                                <span className="text-xs text-slate-500">Atilan</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-sm bg-rose-400/50" />
                                <span className="text-xs text-slate-500">Yenilen</span>
                            </span>
                        </div>
                    </div>

                    {hasPossession && (
                        <div className="border-t border-white/5 mt-3 pt-3">
                            <p className="text-[13px] font-semibold text-slate-300 mb-2">Topla Oynama %</p>
                            <svg viewBox={`0 0 ${SVG_W} ${POSS_SVG_H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
                                {POSS_GUIDE_VALS.map((v) => {
                                    const gy = possY(v);
                                    return (
                                        <g key={`pg-${v}`}>
                                            <text x="6" y={gy + 3} fill="rgba(148,163,184,0.5)" fontSize="11" fontFamily="inherit">%{v}</text>
                                            <line
                                                x1={SVG_L - 4}
                                                y1={gy}
                                                x2={SVG_W - SVG_R + 4}
                                                y2={gy}
                                                stroke="rgba(255,255,255,0.06)"
                                                strokeWidth="1"
                                            />
                                        </g>
                                    );
                                })}

                                <line
                                    x1={SVG_L - 4}
                                    y1={possY(50)}
                                    x2={SVG_W - SVG_R + 4}
                                    y2={possY(50)}
                                    stroke="rgba(96,165,250,0.12)"
                                    strokeWidth="1"
                                />

                                {possPts.length > 1 && possPts.slice(0, -1).map((p, i) => {
                                    const next = possPts[i + 1];
                                    return (
                                        <line
                                            key={`ps-${i}`}
                                            x1={p.x}
                                            y1={p.y}
                                            x2={next.x}
                                            y2={next.y}
                                            stroke={POSS_COLOR}
                                            strokeOpacity="0.4"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                        />
                                    );
                                })}

                                {possPts.map((p, i) => (
                                    <g key={`pd-${i}`}>
                                        <circle cx={p.x} cy={p.y} r="8" fill={POSS_GLOW} />
                                        <circle cx={p.x} cy={p.y} r="4" fill={POSS_COLOR} />
                                        <text x={p.x} y={p.y - 9} textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="10" fontFamily="inherit">
                                            {Math.round(p.val)}
                                        </text>
                                    </g>
                                ))}
                            </svg>
                            {hasMissingPossession && (
                                <p className="text-[11px] text-slate-500 mt-2 text-right">
                                    Bazi maclarda topla oynama verisi yok.
                                </p>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default FormChart;
