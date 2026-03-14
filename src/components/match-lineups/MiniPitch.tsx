import { PITCH_SVG } from '../../data/formations';
import PlayerImage from '../PlayerImage';
import { localizePlayerName } from '../../utils/playerDisplay';
import { findPlayerPhoto, normalizeLookupKey } from '../../utils/squadPhotoLookup';
import type { SquadPhotoMaps } from '../../utils/squadPhotoLookup';
import type { TeamLineup } from '../../types';
import { buildRows } from './formation-engine';

export interface MiniPitchProps {
    lineup: TeamLineup;
    isFenerbahceTeam: boolean;
    photoMaps: SquadPhotoMaps;
    subOutByPlayer: Map<string, string>;
}

export default function MiniPitch({
    lineup,
    isFenerbahceTeam,
    photoMaps,
    subOutByPlayer
}: MiniPitchProps) {
    const { rows, confident, renderedFormation } = buildRows(lineup.formation, lineup.starters);

    return (
        <div className="relative w-full aspect-[68/105] rounded-xl overflow-hidden border border-white/10 bg-[#14532d] shadow-inner shadow-black/25">
            <img src={PITCH_SVG} alt="" className="absolute inset-0 h-full w-full object-cover opacity-95" />
            {confident && renderedFormation && (
                <span className="absolute top-2 left-1/2 -translate-x-1/2 z-10 rounded-md border border-white/15 bg-slate-950/70 px-2.5 py-0.5 text-[10px] font-bold text-yellow-300 backdrop-blur-sm shadow-sm">
                    {renderedFormation}
                </span>
            )}
            <div className="absolute inset-0">
                {rows.map((row, rowIndex) => (
                    row.slots.map((slot, slotIndex) => {
                        const { player, x } = slot;
                        const photoUrl = isFenerbahceTeam ? findPlayerPhoto(player.name, player.jersey, photoMaps) : null;
                        const subOutMinute = subOutByPlayer.get(normalizeLookupKey(player.name));
                        const displayName = localizePlayerName(player.name);
                        const shortName = displayName.split(' ').pop() || displayName;
                        return (
                            <div
                                key={`${rowIndex}-${slotIndex}`}
                                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                                style={{ top: `${row.y}%`, left: `${x}%` }}
                            >
                                <div className="relative">
                                    <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-yellow-400 bg-slate-950 text-[10px] font-bold text-white shadow-[0_8px_18px_rgba(0,0,0,0.35)] sm:h-10 sm:w-10 sm:text-xs">
                                        <PlayerImage
                                            src={photoUrl}
                                            alt={displayName}
                                            className="h-full w-full object-cover"
                                            loading="lazy"
                                            fallback={
                                            player.jersey || displayName.slice(0, 1).toUpperCase()
                                            }
                                        />
                                    </span>
                                    {subOutMinute && (
                                        <span className="absolute -right-3 -top-2 inline-flex items-center gap-0.5 rounded-full border border-white/15 bg-slate-950/95 px-1 py-[2px] text-[8px] font-semibold text-rose-300 shadow-lg">
                                            <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <path d="M14 5H5" />
                                                <path d="m8 2-3 3 3 3" />
                                            </svg>
                                            <span>{subOutMinute}</span>
                                        </span>
                                    )}
                                </div>
                                <span className="mt-1 max-w-[74px] truncate rounded-md border border-white/10 bg-slate-950/70 px-1.5 py-0.5 text-center text-[8px] font-medium text-white shadow-sm backdrop-blur-sm sm:max-w-[82px] sm:text-[9px]">
                                    {shortName}
                                </span>
                            </div>
                        );
                    })
                ))}
            </div>
        </div>
    );
}
