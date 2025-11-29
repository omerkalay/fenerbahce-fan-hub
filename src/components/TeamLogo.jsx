import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { BACKEND_URL } from '../services/api';

const buildLogoUrl = (teamId) => `${BACKEND_URL}/api/team-image/${teamId}`;

const TeamLogo = ({
    teamId,
    name = 'Takım',
    wrapperClassName = '',
    imageClassName = ''
}) => {
    const [src, setSrc] = useState(() => (teamId ? buildLogoUrl(teamId) : null));
    const [status, setStatus] = useState(teamId ? 'loading' : 'idle');
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (!teamId) {
            setSrc(null);
            setStatus('idle');
            return;
        }
        setSrc(buildLogoUrl(teamId));
        setAttempt(0);
        setStatus('loading');
    }, [teamId]);

    const handleError = () => {
        if (!teamId) return;

        if (attempt < 2) {
            const retryToken = `${Date.now()}-${attempt + 1}`;
            setAttempt((prev) => prev + 1);
            setSrc(`${buildLogoUrl(teamId)}?retry=${retryToken}`);
        } else {
            setStatus('error');
        }
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
            {src && status !== 'error' ? (
                <img
                    src={src}
                    alt={`${name} logosu`}
                    crossOrigin="anonymous"
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

