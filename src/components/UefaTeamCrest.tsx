import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useTheme } from '../contexts/themeContextDef';
import { resolveTeamCrest } from '../theme/teamCrest';
import type { UefaJourneyTeam } from '../types';
import { buildEspnTeamLogoUrl } from '../utils/uefaTeamCrest';

type CrestTeam = Pick<UefaJourneyTeam, 'id' | 'name' | 'shortName' | 'logo'>;

interface UefaTeamCrestProps {
    team: CrestTeam;
    className?: string;
}

const getInitials = (name: string): string => name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '??';

const UefaTeamCrest = ({ team, className = 'h-5 w-5' }: UefaTeamCrestProps) => {
    const { theme } = useTheme();
    const sources = useMemo(() => {
        const espnFallback = buildEspnTeamLogoUrl(team.id);
        const themeAwarePrimary = resolveTeamCrest({
            theme,
            defaultSrc: team.logo || espnFallback,
            teamName: team.name,
        });

        return Array.from(new Set(
            [themeAwarePrimary, team.logo, espnFallback].filter((source): source is string => Boolean(source))
        ));
    }, [team.id, team.logo, team.name, theme]);
    const [sourceIndex, setSourceIndex] = useState(0);

    useEffect(() => {
        setSourceIndex(0);
    }, [sources]);

    const activeSource = sources[sourceIndex] || null;
    const displayName = team.shortName || team.name;

    return (
        <span
            className={clsx(
                'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.06]',
                className
            )}
        >
            {activeSource ? (
                <img
                    src={activeSource}
                    alt={`${displayName} logosu`}
                    className="h-full w-full object-contain p-px"
                    loading="lazy"
                    onError={() => setSourceIndex((current) => current + 1)}
                />
            ) : (
                <span className="text-[8px] font-bold uppercase text-slate-400">
                    {getInitials(displayName)}
                </span>
            )}
        </span>
    );
};

export default UefaTeamCrest;
