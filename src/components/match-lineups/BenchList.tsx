import { localizePlayerName } from '../../utils/playerDisplay';
import { normalizeLookupKey } from '../../utils/squadPhotoLookup';
import type { LineupPlayer } from '../../types';

interface BenchListProps {
    bench: LineupPlayer[];
    subInByPlayer: Map<string, string>;
}

export default function BenchList({ bench, subInByPlayer }: BenchListProps) {
    if (bench.length === 0) return null;

    return (
        <div className="mt-4">
            <p className="mb-2 text-xs font-bold text-slate-300">Yedekler</p>
            <div className="space-y-1">
                {bench.map((player, index) => {
                    const subInMinute = subInByPlayer.get(normalizeLookupKey(player.name));
                    return (
                        <div
                            key={index}
                            className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/5 py-1.5 text-[12px] last:border-b-0"
                        >
                            <span className="w-7 text-center font-semibold text-yellow-300/80">
                                {player.jersey || '-'}
                            </span>
                            <span className="text-slate-200">
                                {localizePlayerName(player.name)}
                            </span>
                            {subInMinute && (
                                <span className="inline-flex items-center gap-0.5 rounded-full border border-white/15 bg-slate-950/90 px-1.5 py-[2px] text-[9px] font-semibold text-emerald-300 shadow-sm">
                                    <svg viewBox="0 0 16 16" className="h-2 w-2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M2 11h9" />
                                        <path d="m8 8 3 3-3 3" />
                                    </svg>
                                    {subInMinute}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
