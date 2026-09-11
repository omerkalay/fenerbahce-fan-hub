/**
 * The dashboard's own backdrop, for the classic theme on any night that is not
 * a Champions League one.
 *
 * A looping clip of gold light drifting through the corners of a navy field,
 * with the middle left empty so the cards keep their contrast. The clip runs
 * forward and then backward, so the loop never jumps, and its first frame is
 * kept as a lossless still — switching between moving and still changes the
 * motion, never the image.
 *
 * There are three ways to end up on that still: the viewer turned the moving
 * backdrop off in Ayarlar, their device asks for reduced motion, or the video
 * would not play.
 *
 * Purely decorative, so the whole thing is hidden from assistive technology.
 */

import { useEffect, useState } from 'react';
import useMotionBackdrop from '../hooks/useMotionBackdrop';
import backdropMotion from '../assets/classic-backdrop.mp4';
import backdropStill from '../assets/classic-backdrop.png';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** Undefined outside a browser, and in test environments that omit it. */
const motionQuery = (): MediaQueryList | undefined =>
    typeof window === 'undefined' || typeof window.matchMedia !== 'function'
        ? undefined
        : window.matchMedia(REDUCED_MOTION);

const prefersReducedMotion = () => motionQuery()?.matches ?? false;

export default function ClassicBackdrop() {
    const [motionAllowed] = useMotionBackdrop();
    const [videoFailed, setVideoFailed] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);

    /* The system setting can change while the app is open. */
    useEffect(() => {
        const query = motionQuery();
        if (!query) return;

        const sync = () => setReducedMotion(query.matches);
        query.addEventListener('change', sync);
        return () => query.removeEventListener('change', sync);
    }, []);

    const still = videoFailed || reducedMotion || !motionAllowed;

    return (
        <div className="classic-backdrop" aria-hidden="true">
            {still ? (
                <div
                    className="classic-backdrop-still"
                    style={{ backgroundImage: `url(${backdropStill})` }}
                />
            ) : (
                <video
                    className="classic-backdrop-motion"
                    src={backdropMotion}
                    poster={backdropStill}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    disablePictureInPicture
                    tabIndex={-1}
                    onError={() => setVideoFailed(true)}
                />
            )}
            {/* Takes the edge off the clip so the cards keep their contrast. */}
            <div className="classic-backdrop-scrim" />
        </div>
    );
}
