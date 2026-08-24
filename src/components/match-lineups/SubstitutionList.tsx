import MatchEventIcon from '../MatchEventIcon';
import { localizePlayerName } from '../../utils/playerDisplay';
import { formatSoccerMinute } from './formation-engine';
import type { LineupSubstitution } from '../../types';

interface SubstitutionListProps {
    substitutions: LineupSubstitution[];
}

export default function SubstitutionList({ substitutions }: SubstitutionListProps) {
    if (substitutions.length === 0) return null;

    return (
        <div className="mt-4">
            <p className="mb-2 text-xs font-bold text-slate-300">{'De\u011fi\u015fiklikler'}</p>
            <div>
                {substitutions.map((sub, index) => (
                    <div
                        key={index}
                        className="grid grid-cols-[2.25rem_1px_minmax(0,1fr)] gap-3 border-b border-white/[0.06] py-3 last:border-b-0"
                    >
                        <span className="pt-0.5 text-right font-mono text-[11px] font-bold text-slate-400 tabular-nums">
                            {formatSoccerMinute(sub.minute)}
                        </span>
                        <span className="h-full min-h-8 bg-white/10" aria-hidden="true" />
                        <div className="min-w-0 space-y-1 text-[11px] font-semibold">
                            <div className="flex min-w-0 items-center gap-1.5 text-emerald-300">
                                <MatchEventIcon event={{ isSubstitution: true }} className="h-4 w-4 shrink-0" />
                                <span className="shrink-0 text-[9px] font-black uppercase tracking-wide text-emerald-400/80">Giren</span>
                                <span className="truncate">{localizePlayerName(sub.playerIn)}</span>
                            </div>
                            {sub.playerOut && (
                                <div className="flex min-w-0 items-center gap-1.5 pl-[22px] text-rose-300/85">
                                    <span className="shrink-0 text-[9px] font-black uppercase tracking-wide text-rose-400/70">Çıkan</span>
                                    <span className="truncate">{localizePlayerName(sub.playerOut)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
