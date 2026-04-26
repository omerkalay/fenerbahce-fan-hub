import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { BACKEND_URL } from '../services/api';

const SOFASCORE_TEAM_IMAGE_BASE = 'https://img.sofascore.com/api/v1/team';
const buildBackendLogoUrl = (teamId: number): string => `${BACKEND_URL}/team-image/${teamId}`;
const buildFallbackLogoUrl = (teamId: number): string => `${SOFASCORE_TEAM_IMAGE_BASE}/${teamId}/image`;

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
    const [source, setSource] = useState<'backend' | 'fallback'>('backend');
    const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'idle'>(teamId ? 'loading' : 'idle');

    useEffect(() => {
        if (!teamId) {
            setStatus('idle');
            return;
        }
        setSource('backend');
        setStatus('loading');
    }, [teamId]);

    const handleError = () => {
        if (source === 'backend') {
            setSource('fallback');
            setStatus('loading');
            return;
        }

        setStatus('error');
    };

    const src = teamId
        ? source === 'backend'
            ? buildBackendLogoUrl(teamId)
            : buildFallbackLogoUrl(teamId)
        : null;

    const initials = name
        ?.split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || '??';

    return (
        <div className={clsx('relative overflow-hidden', wrapperClassName)}>
            {src && status !== 'error' ? (
                <img
                    src={src}
                    alt={`${name} logosu`}
                    crossOrigin={source === 'backend' ? 'anonymous' : undefined}
                    className={clsx(
                        'w-full h-full object-contain transition-opacity duration-300',
                        imageClassName
                    )}
                    onLoad={() => setStatus('ready')}
                    onError={handleError}
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 uppercase font-bold bg-white/5 rounded-full">
                    {initials}
                </div>
            )}
            {status === 'loading' && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer rounded-full"
                    style={{ backgroundSize: '200% 100%' }} />
            )}
        </div>
    );
};

export default TeamLogo;
