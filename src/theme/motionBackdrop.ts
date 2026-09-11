/**
 * Whether the dashboard plays its moving backdrop.
 *
 * A per-device preference like the theme, stored in the same way and defaulting
 * to on. Turning it off leaves the still frame in place — the same result
 * `prefers-reduced-motion` already produces, but chosen deliberately rather
 * than inherited from the operating system.
 */

export const MOTION_BACKDROP_STORAGE_KEY = 'fenerbahce-fan-hub.motion-backdrop.v1';

/** Fired on `window` so every reader updates when the preference changes. */
export const MOTION_BACKDROP_EVENT = 'fb-hub:motion-backdrop';

export const DEFAULT_MOTION_BACKDROP = true;

export const loadMotionBackdrop = (storage?: Pick<Storage, 'getItem'>): boolean => {
  if (!storage) return DEFAULT_MOTION_BACKDROP;

  try {
    const saved = storage.getItem(MOTION_BACKDROP_STORAGE_KEY);
    if (saved === 'on') return true;
    if (saved === 'off') return false;
    return DEFAULT_MOTION_BACKDROP;
  } catch {
    return DEFAULT_MOTION_BACKDROP;
  }
};

export const persistMotionBackdrop = (
  enabled: boolean,
  storage?: Pick<Storage, 'setItem'>,
): boolean => {
  if (!storage) return false;

  try {
    storage.setItem(MOTION_BACKDROP_STORAGE_KEY, enabled ? 'on' : 'off');
    return true;
  } catch {
    return false;
  }
};
