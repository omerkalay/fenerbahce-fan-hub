import { type ImgHTMLAttributes, type ReactNode, useEffect, useState } from 'react';

interface PlayerImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
    src?: string | null;
    alt: string;
    fallback: ReactNode;
    retryCount?: number;
}

const appendRetryToken = (url: string, attempt: number): string => {
    const [path, hash = ''] = url.split('#', 2);
    const separator = path.includes('?') ? '&' : '?';
    const nextUrl = `${path}${separator}retry=${Date.now()}-${attempt}`;
    return hash ? `${nextUrl}#${hash}` : nextUrl;
};

const PlayerImage = ({
    src,
    alt,
    fallback,
    retryCount = 2,
    crossOrigin = 'anonymous',
    ...imgProps
}: PlayerImageProps) => {
    const [activeSrc, setActiveSrc] = useState<string | null>(src || null);
    const [attempt, setAttempt] = useState(0);
    const [failed, setFailed] = useState(!src);

    useEffect(() => {
        setActiveSrc(src || null);
        setAttempt(0);
        setFailed(!src);
    }, [src]);

    const handleError = () => {
        if (!src) {
            setFailed(true);
            return;
        }

        if (attempt >= retryCount) {
            setFailed(true);
            return;
        }

        const nextAttempt = attempt + 1;
        setAttempt(nextAttempt);
        setActiveSrc(appendRetryToken(src, nextAttempt));
        setFailed(false);
    };

    if (!activeSrc || failed) {
        return <>{fallback}</>;
    }

    return (
        <img
            {...imgProps}
            src={activeSrc}
            alt={alt}
            crossOrigin={crossOrigin}
            onError={handleError}
        />
    );
};

export default PlayerImage;
