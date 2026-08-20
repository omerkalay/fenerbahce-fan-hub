import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchUefaJourney, fetchUefaJourneySummary } from './uefa-journey';

const buildResponse = (payload: unknown, ok = true): Response => ({
    ok,
    status: ok ? 200 : 500,
    json: vi.fn().mockResolvedValue(payload)
} as unknown as Response);

describe('UEFA journey API', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('requests the lightweight dashboard summary', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildResponse({
            source: 'ESPN',
            seasonStartYear: 2026,
            title: 'Avrupa Yolculuğu',
            state: 'qualifying'
        }));

        const result = await fetchUefaJourneySummary(2026);

        expect(result?.title).toBe('Avrupa Yolculuğu');
        expect(String(fetchMock.mock.calls[0][0])).toContain('seasonStartYear=2026&summary=true');
    });

    it('guards malformed arrays in the full payload', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildResponse({
            source: 'ESPN',
            seasonStartYear: 2026,
            stale: 0,
            participation: { state: 'qualifying', competition: null, qualifier: null, phaseLabel: null },
            standings: { rows: {} },
            fenerPath: {},
            bracket: { stages: {} }
        }));

        const result = await fetchUefaJourney(2026);

        expect(result).toMatchObject({ stale: false, standings: null, fenerPath: [], bracket: null });
    });

    it('restores nested empty arrays omitted by Firebase RTDB', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildResponse({
            source: 'ESPN',
            seasonStartYear: 2026,
            participation: { state: 'qualifying', competition: null, qualifier: null, phaseLabel: null },
            fenerPath: [{ key: 'league-phase', label: 'Lig Aşaması', status: 'awaiting' }],
            bracket: {
                competition: { key: 'champions' },
                stages: [{ key: 'round-of-16', label: 'Son 16', ties: [{ id: 'tie-1' }] }]
            }
        }));

        const result = await fetchUefaJourney(2026);

        expect(result?.fenerPath[0].matches).toEqual([]);
        expect(result?.bracket?.stages[0].ties[0]).toMatchObject({ teams: [], legs: [], aggregate: null });
    });
});
