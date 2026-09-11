import { useCallback, useEffect, useState } from 'react';
import {
    loadMotionBackdrop,
    MOTION_BACKDROP_EVENT,
    persistMotionBackdrop,
} from '../theme/motionBackdrop';

const storage = (): Storage | undefined =>
    typeof window === 'undefined' ? undefined : window.localStorage;

/**
 * Reads the moving-backdrop preference and keeps every caller in step: the
 * settings switch and the backdrop itself both use this, and a change in one
 * reaches the other through `MOTION_BACKDROP_EVENT`.
 */
export const useMotionBackdrop = (): [boolean, (enabled: boolean) => void] => {
    const [enabled, setEnabled] = useState(() => loadMotionBackdrop(storage()));

    useEffect(() => {
        const sync = () => setEnabled(loadMotionBackdrop(storage()));
        window.addEventListener(MOTION_BACKDROP_EVENT, sync);
        /* Another tab writing the same key. */
        window.addEventListener('storage', sync);

        return () => {
            window.removeEventListener(MOTION_BACKDROP_EVENT, sync);
            window.removeEventListener('storage', sync);
        };
    }, []);

    const update = useCallback((next: boolean) => {
        persistMotionBackdrop(next, storage());
        setEnabled(next);
        window.dispatchEvent(new Event(MOTION_BACKDROP_EVENT));
    }, []);

    return [enabled, update];
};

export default useMotionBackdrop;
