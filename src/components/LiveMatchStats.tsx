import type { MatchStat } from '../types';

interface StatDefinition {
    label: string;
    keys: string[];
    kind: 'possession' | 'comparison';
}

const STAT_DEFINITIONS: StatDefinition[] = [
    { label: 'Topla Oynama', keys: ['possessionPct', 'possession'], kind: 'possession' },
    { label: 'Toplam Şut', keys: ['totalShots'], kind: 'comparison' },
    { label: 'İsabetli Şut', keys: ['shotsOnTarget'], kind: 'comparison' },
    { label: 'Korner', keys: ['wonCorners', 'corners'], kind: 'comparison' },
    { label: 'Faul', keys: ['foulsCommitted', 'fouls'], kind: 'comparison' },
    { label: 'Sarı Kart', keys: ['yellowCards', 'yellowCard'], kind: 'comparison' },
    { label: 'Kırmızı Kart', keys: ['redCards', 'redCard'], kind: 'comparison' },
];

const toNumber = (value: string): number => Number.parseFloat(String(value || '').replace(',', '.')) || 0;

interface LiveMatchStatsProps {
    stats?: MatchStat[];
}

export default function LiveMatchStats({ stats = [] }: LiveMatchStatsProps) {
    const orderedStats = STAT_DEFINITIONS
        .map((definition) => {
            const stat = stats.find((item) => definition.keys.includes(item.name));
            return stat ? { ...stat, displayLabel: definition.label, kind: definition.kind } : null;
        })
        .filter((stat): stat is MatchStat & { displayLabel: string; kind: StatDefinition['kind'] } => stat !== null);

    if (orderedStats.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-slate-600/70 bg-slate-950/25 px-4 py-5 text-center text-xs leading-relaxed text-slate-400">
                İstatistikler sağlayıcıdan henüz gelmedi. Skor ve maç olayları gösterilmeye devam ediyor.
            </div>
        );
    }

    const possessionStat = orderedStats.find((stat) => stat.kind === 'possession');
    const comparisonStats = orderedStats.filter((stat) => stat.kind === 'comparison');

    return (
        <div className="space-y-4">
            {orderedStats.length < 3 && (
                <p className="live-data-notice rounded-lg bg-sky-400/10 px-3 py-2 text-[10px] leading-relaxed text-sky-200">
                    Bazı istatistikler henüz eksik. Gelen veriler aşağıda gösteriliyor.
                </p>
            )}

            {possessionStat && (() => {
                const homeValue = toNumber(possessionStat.homeValue);
                const awayValue = toNumber(possessionStat.awayValue);
                const total = homeValue + awayValue;
                const homeWidth = total > 0 ? (homeValue / total) * 100 : 50;

                return (
                    <div
                        className="space-y-2"
                        data-stat-kind="possession"
                        aria-label={`${possessionStat.displayLabel}: ${possessionStat.homeValue} - ${possessionStat.awayValue}`}
                    >
                        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 text-xs">
                            <span className="font-black tabular-nums text-white">{possessionStat.homeValue}</span>
                            <span className="truncate text-center text-[11px] font-semibold text-slate-400">{possessionStat.displayLabel}</span>
                            <span className="text-right font-black tabular-nums text-white">{possessionStat.awayValue}</span>
                        </div>
                        <div className="live-stat-track flex h-2 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
                            <span className="live-stat-home-bar h-full bg-blue-500" style={{ width: `${homeWidth}%` }} />
                            <span className="live-stat-away-bar h-full flex-1 bg-slate-500" />
                        </div>
                    </div>
                );
            })()}

            <div className="space-y-3">
                {comparisonStats.map((stat) => {
                    const homeValue = toNumber(stat.homeValue);
                    const awayValue = toNumber(stat.awayValue);
                    const maximum = Math.max(homeValue, awayValue, 1);
                    const homeWidth = (homeValue / maximum) * 100;
                    const awayWidth = (awayValue / maximum) * 100;

                    return (
                        <div
                            key={stat.name}
                            className="space-y-1.5"
                            data-stat-kind="comparison"
                            aria-label={`${stat.displayLabel}: ${stat.homeValue} - ${stat.awayValue}`}
                        >
                            <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 text-xs">
                                <span className="font-black tabular-nums text-white">{stat.homeValue}</span>
                                <span className="truncate text-center text-[11px] font-medium text-slate-400">{stat.displayLabel}</span>
                                <span className="text-right font-black tabular-nums text-white">{stat.awayValue}</span>
                            </div>
                            <div className="live-stat-track relative grid h-1.5 grid-cols-2 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
                                <div className="flex justify-end">
                                    <span className="live-stat-home-bar h-full bg-blue-500" style={{ width: `${homeWidth}%` }} />
                                </div>
                                <div>
                                    <span className="live-stat-away-bar block h-full bg-slate-500" style={{ width: `${awayWidth}%` }} />
                                </div>
                                <span className="live-stat-center-divider absolute inset-y-0 left-1/2 w-px bg-[#09182d]" />
                            </div>
                        </div>
                    );
                })}
            </div>

        </div>
    );
}
