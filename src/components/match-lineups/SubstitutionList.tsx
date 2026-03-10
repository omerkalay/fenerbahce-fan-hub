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
            <div className="space-y-1">
                {substitutions.map((sub, index) => (
                    <div
                        key={index}
                        className="flex items-center gap-2 rounded-md bg-white/[0.03] px-2 py-1.5"
                    >
                        <span className="min-w-[2.1rem] shrink-0 rounded bg-white/[0.06] px-1 py-[1px] text-center font-mono text-[10px] font-semibold text-slate-300 tabular-nums">{formatSoccerMinute(sub.minute)}</span>
                        <span className="flex h-4 w-4 items-center justify-center">
                            <MatchEventIcon event={{ isSubstitution: true }} className="h-4 w-3" />
                        </span>
                        <div className="min-w-0 flex-1 text-[12px] font-medium text-emerald-300/90">
                            <span>{localizePlayerName(sub.playerIn)}</span>
                            {sub.playerOut && (
                                <span className="ml-1 inline-flex items-center gap-0.5 text-slate-500">
                                    <svg
                                        viewBox="0 0 16 16"
                                        className="h-2.5 w-2.5"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.6"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        <path d="M2 5h9" />
                                        <path d="m8 2 3 3-3 3" />
                                        <path d="M14 11H5" />
                                        <path d="m8 8-3 3 3 3" />
                                    </svg>
                                    <span>{localizePlayerName(sub.playerOut)}</span>
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
