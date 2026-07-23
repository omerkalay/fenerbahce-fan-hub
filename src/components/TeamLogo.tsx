import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { BACKEND_URL } from '../services/api';
import { useTheme } from '../contexts/themeContextDef';
import {
    FENERBAHCE_ANNIVERSARY_CREST_URL,
    resolveTeamCrest
} from '../theme/teamCrest';

const buildLogoUrl = (teamId: number): string => `${BACKEND_URL}/team-image/${teamId}`;

interface TeamLogoProps {
    teamId: number | null | undefined;
    name?: string;
    wrapperClassName?: string;
    imageClassName?: string;
}

const TeamLogo = ({
    teamId,
    name = 'Takım',
    wrapperClassName = '',
    imageClassName = ''
}: TeamLogoProps) => {
    const { theme } = useTheme();
    const [src, setSrc] = useState<string | null>(() => (teamId ? buildLogoUrl(teamId) : null));
    const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'idle'>(teamId ? 'loading' : 'idle');
    const displaySrc = resolveTeamCrest({ theme, defaultSrc: src, teamName: name });
    const usesAnniversaryCrest = displaySrc === FENERBAHCE_ANNIVERSARY_CREST_URL;

    useEffect(() => {
        if (!teamId) {
            setSrc(null);
            setStatus('idle');
            return;
        }
        setSrc(buildLogoUrl(teamId));
        setStatus('loading');
    }, [teamId]);

    const handleError = () => {
        setStatus('error');
    };

    const initials = name
        ?.split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || '??';

    return (
        <div className={clsx('relative overflow-hidden', wrapperClassName)}>
            {displaySrc && (usesAnniversaryCrest || status !== 'error') ? (
                <img
                    src={displaySrc}
                    alt={`${name} logosu`}
                    crossOrigin={usesAnniversaryCrest ? undefined : 'anonymous'}
                    className={clsx(
                        'w-full h-full object-contain transition-opacity duration-300',
                        imageClassName
                    )}
                    onLoad={() => {
                        if (!usesAnniversaryCrest) setStatus('ready');
                    }}
                    onError={usesAnniversaryCrest ? undefined : handleError}
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 uppercase font-bold bg-white/5 rounded-full">
                    {initials}
                </div>
            )}
            {!usesAnniversaryCrest && status === 'loading' && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer rounded-full"
                    style={{ backgroundSize: '200% 100%' }} />
            )}
        </div>
    );
};

export default TeamLogo;
