import { useCallback, useRef, useState } from 'react';

/**
 * Wraps an async action with a cooldown period to prevent rapid-fire calls.
 */
export function useCooldown<T extends (...args: never[]) => Promise<void>>(
    action: T,
    cooldownMs = 5_000,
) {
    const [isCoolingDown, setCoolingDown] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const execute = useCallback(
        async (...args: Parameters<T>) => {
            if (isCoolingDown) return;

            try {
                await action(...args);
            } finally {
                setCoolingDown(true);
                if (timerRef.current) clearTimeout(timerRef.current);
                timerRef.current = setTimeout(() => {
                    setCoolingDown(false);
                    timerRef.current = null;
                }, cooldownMs);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [action, cooldownMs, isCoolingDown],
    );

    return { execute, isCoolingDown } as const;
}
