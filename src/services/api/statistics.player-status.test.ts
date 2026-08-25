import { describe, expect, it, vi } from 'vitest';
import type { DataSnapshot } from 'firebase/database';

vi.mock('../../firebase', () => ({ database: {} }));
vi.mock('firebase/database', () => ({ ref: vi.fn(), get: vi.fn(), onValue: vi.fn() }));

import { onValue } from 'firebase/database';
import { parsePlayerStatus, subscribePlayerStatus } from './statistics';

describe('parsePlayerStatus', () => {
    it('supports legacy arrays, modern object values and empty data', () => {
        expect(parsePlayerStatus(null)).toEqual([]);
        expect(parsePlayerStatus([{ name: 'Legacy', status: 'injured', updatedAt: 12 }])).toEqual([
            expect.objectContaining({ name: 'Legacy', status: 'injured', updatedAt: 12 })
        ]);
        expect(parsePlayerStatus({
            one: { playerId: '12', source: 'squad', name: 'Modern', status: 'card-risk', detail: 'Three cards', returnDate: '', updatedAt: 24 }
        })).toEqual([
            expect.objectContaining({ playerId: '12', source: 'squad', name: 'Modern', status: 'card-risk' })
        ]);
    });

    it('drops unnamed records and safely maps unknown statuses to fit', () => {
        expect(parsePlayerStatus([{ name: '', status: 'injured' }, { name: 'Unknown', status: 'hacked' }])).toEqual([
            expect.objectContaining({ name: 'Unknown', status: 'fit' })
        ]);
    });

    it('forwards every realtime snapshot and returns the Firebase unsubscribe callback', () => {
        const unsubscribe = vi.fn();
        let snapshotHandler: ((snapshot: DataSnapshot) => unknown) | undefined;
        vi.mocked(onValue).mockImplementation(((_reference, onData) => {
            snapshotHandler = onData;
            return unsubscribe;
        }) as typeof onValue);
        const onData = vi.fn();
        const stop = subscribePlayerStatus(onData, vi.fn());

        snapshotHandler?.({ val: () => [{ name: 'Realtime Player', status: 'suspended', updatedAt: 50 }] } as DataSnapshot);
        expect(onData).toHaveBeenCalledWith([expect.objectContaining({ name: 'Realtime Player', status: 'suspended' })]);
        stop();
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
});
