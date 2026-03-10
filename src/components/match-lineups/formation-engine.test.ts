import { describe, it, expect } from 'vitest';
import type { LineupPlayer } from '../../types';
import {
    classifyPosition,
    formatSoccerMinute,
    getFormationParts,
    getPresetFormation,
    getEffectiveFormation,
    getDistributedX,
    getBaseLineFromPosition,
    getPositionalDepth,
    inferPresetFormation,
    buildRows,
    buildPresetRows,
    buildDetailedRows,
    buildNumericFormationRows,
    buildFormationFallbackRows,
} from './formation-engine';

// ─── Helper ─────────────────────────────────────────────
const makePlayer = (overrides: Partial<LineupPlayer> = {}): LineupPlayer => ({
    name: 'Test Player',
    jersey: '1',
    position: '',
    ...overrides,
});

const make11 = (groups: Array<{ positionGroup: string; count: number }>): LineupPlayer[] => {
    const players: LineupPlayer[] = [];
    let jersey = 1;
    for (const { positionGroup, count } of groups) {
        for (let i = 0; i < count; i++) {
            players.push(makePlayer({
                name: `${positionGroup} ${i + 1}`,
                jersey: String(jersey++),
                positionGroup: positionGroup as LineupPlayer['positionGroup'],
            }));
        }
    }
    return players;
};

// ─── classifyPosition ───────────────────────────────────
describe('classifyPosition', () => {
    it.each([
        ['Goalkeeper', 'GK'],
        ['kaleci', 'GK'],
        ['gk', 'GK'],
        ['Defender', 'DEF'],
        ['Left Back', 'DEF'],
        ['def', 'DEF'],
        ['Midfielder', 'MID'],
        ['midfield', 'MID'],
        ['mid', 'MID'],
        ['Forward', 'FWD'],
        ['Striker', 'FWD'],
        ['Right Wing', 'FWD'],
        ['fwd', 'FWD'],
        ['', 'MID'], // default
        ['unknown', 'MID'], // default
    ])('classifies "%s" as %s', (input, expected) => {
        expect(classifyPosition(input)).toBe(expected);
    });
});

// ─── formatSoccerMinute ─────────────────────────────────
describe('formatSoccerMinute', () => {
    it.each([
        ["45'", "45'"],
        ['45', "45'"],
        ["90'+3", "90+3'"],
        ["90+3'", "90+3'"],
        ['', ''],
    ])('formats "%s" to "%s"', (input, expected) => {
        expect(formatSoccerMinute(input)).toBe(expected);
    });

    it('strips non-numeric characters', () => {
        expect(formatSoccerMinute('abc45xyz')).toBe("45'");
    });
});

// ─── getFormationParts ──────────────────────────────────
describe('getFormationParts', () => {
    it('parses "4-3-3"', () => {
        expect(getFormationParts('4-3-3')).toEqual([4, 3, 3]);
    });

    it('parses "4-2-3-1"', () => {
        expect(getFormationParts('4-2-3-1')).toEqual([4, 2, 3, 1]);
    });

    it('returns empty array for null', () => {
        expect(getFormationParts(null)).toEqual([]);
    });

    it('filters out zero/negative values', () => {
        expect(getFormationParts('4-0-3')).toEqual([4, 3]);
    });
});

// ─── getPresetFormation ─────────────────────────────────
describe('getPresetFormation', () => {
    it('returns canonical formation name', () => {
        expect(getPresetFormation('4-3-3')).toBe('4-3-3');
    });

    it('resolves alias "4-1-2-1-2" to "4-1-2-1-2 Diamond"', () => {
        expect(getPresetFormation('4-1-2-1-2')).toBe('4-1-2-1-2 Diamond');
    });

    it('returns null for unknown formation', () => {
        expect(getPresetFormation('5-5-0')).toBeNull();
    });

    it('returns null for empty/null', () => {
        expect(getPresetFormation(null)).toBeNull();
        expect(getPresetFormation('')).toBeNull();
    });
});

// ─── getDistributedX ────────────────────────────────────
describe('getDistributedX', () => {
    it('single player centered at 50', () => {
        expect(getDistributedX(1, 0)).toBe(50);
    });

    it('two players distributed evenly', () => {
        expect(getDistributedX(2, 0)).toBe(36);
        expect(getDistributedX(2, 1)).toBe(64);
    });

    it('falls back to linear interpolation for unknown count', () => {
        const x = getDistributedX(6, 0);
        expect(x).toBe(10);
    });
});

// ─── getBaseLineFromPosition ────────────────────────────
describe('getBaseLineFromPosition', () => {
    it('classifies GK', () => {
        expect(getBaseLineFromPosition(makePlayer({ positionCode: 'GK' }))).toBe('GK');
    });

    it('classifies defenders', () => {
        expect(getBaseLineFromPosition(makePlayer({ positionCode: 'LB' }))).toBe('DEF');
        expect(getBaseLineFromPosition(makePlayer({ positionCode: 'CD' }))).toBe('DEF');
        expect(getBaseLineFromPosition(makePlayer({ positionCode: 'RWB' }))).toBe('DEF');
        expect(getBaseLineFromPosition(makePlayer({ position: 'Center Back' }))).toBe('DEF');
    });

    it('classifies defensive midfielder as HOLD', () => {
        expect(getBaseLineFromPosition(makePlayer({ positionCode: 'CDM' }))).toBe('HOLD');
        expect(getBaseLineFromPosition(makePlayer({ positionCode: 'DM' }))).toBe('HOLD');
    });

    it('classifies midfielders', () => {
        expect(getBaseLineFromPosition(makePlayer({ positionCode: 'CM' }))).toBe('MID');
        expect(getBaseLineFromPosition(makePlayer({ positionCode: 'LM' }))).toBe('MID');
    });

    it('classifies attacking midfielder as AM', () => {
        expect(getBaseLineFromPosition(makePlayer({ positionCode: 'AM' }))).toBe('AM');
    });

    it('classifies forwards', () => {
        expect(getBaseLineFromPosition(makePlayer({ positionCode: 'ST' }))).toBe('FWD');
        expect(getBaseLineFromPosition(makePlayer({ positionCode: 'CF' }))).toBe('FWD');
    });

    it('falls back based on positionGroup', () => {
        expect(getBaseLineFromPosition(makePlayer({ positionGroup: 'DEF' }))).toBe('DEF');
        expect(getBaseLineFromPosition(makePlayer({ positionGroup: 'FWD' }))).toBe('FWD');
    });
});

// ─── getPositionalDepth ─────────────────────────────────
describe('getPositionalDepth', () => {
    it('returns 0 for GK', () => {
        expect(getPositionalDepth(makePlayer({ positionCode: 'GK' }))).toBe(0);
    });

    it('returns 1 for defenders', () => {
        expect(getPositionalDepth(makePlayer({ positionCode: 'CB' }))).toBe(1);
        expect(getPositionalDepth(makePlayer({ positionCode: 'LB' }))).toBe(1);
    });

    it('returns 2 for holding midfielders', () => {
        expect(getPositionalDepth(makePlayer({ positionCode: 'CDM' }))).toBe(2);
    });

    it('returns 3 for central midfielders', () => {
        expect(getPositionalDepth(makePlayer({ positionCode: 'CM' }))).toBe(3);
    });

    it('returns 4 for attacking midfielders', () => {
        expect(getPositionalDepth(makePlayer({ positionCode: 'CAM' }))).toBe(4);
    });

    it('returns 5 for forwards', () => {
        expect(getPositionalDepth(makePlayer({ positionCode: 'ST' }))).toBe(5);
        expect(getPositionalDepth(makePlayer({ positionCode: 'LW' }))).toBe(5);
    });
});

// ─── inferPresetFormation ───────────────────────────────
describe('inferPresetFormation', () => {
    it('infers 4-3-3', () => {
        const starters = make11([
            { positionGroup: 'GK', count: 1 },
            { positionGroup: 'DEF', count: 4 },
            { positionGroup: 'MID', count: 3 },
            { positionGroup: 'FWD', count: 3 },
        ]);
        expect(inferPresetFormation(starters)).toBe('4-3-3');
    });

    it('infers 4-4-2', () => {
        const starters = make11([
            { positionGroup: 'GK', count: 1 },
            { positionGroup: 'DEF', count: 4 },
            { positionGroup: 'MID', count: 4 },
            { positionGroup: 'FWD', count: 2 },
        ]);
        expect(inferPresetFormation(starters)).toBe('4-4-2');
    });

    it('returns null when unable to infer', () => {
        const starters = make11([
            { positionGroup: 'GK', count: 1 },
            { positionGroup: 'MID', count: 10 },
        ]);
        expect(inferPresetFormation(starters)).toBeNull();
    });
});

// ─── getEffectiveFormation ──────────────────────────────
describe('getEffectiveFormation', () => {
    it('respects explicit formation', () => {
        expect(getEffectiveFormation('4-3-3', [])).toBe('4-3-3');
    });

    it('resolves alias', () => {
        expect(getEffectiveFormation('4-1-2-1-2', [])).toBe('4-1-2-1-2 Diamond');
    });

    it('falls back to inference when no explicit formation', () => {
        const starters = make11([
            { positionGroup: 'GK', count: 1 },
            { positionGroup: 'DEF', count: 4 },
            { positionGroup: 'MID', count: 3 },
            { positionGroup: 'FWD', count: 3 },
        ]);
        expect(getEffectiveFormation(null, starters)).toBe('4-3-3');
    });
});

// ─── buildRows ──────────────────────────────────────────
describe('buildRows', () => {
    it('uses preset strategy for known formation', () => {
        const starters = make11([
            { positionGroup: 'GK', count: 1 },
            { positionGroup: 'DEF', count: 4 },
            { positionGroup: 'MID', count: 3 },
            { positionGroup: 'FWD', count: 3 },
        ]);
        const result = buildRows('4-3-3', starters);
        expect(result.strategy).toBe('preset');
        expect(result.confident).toBe(true);
        expect(result.renderedFormation).toBe('4-3-3');
        expect(result.rows.length).toBeGreaterThan(0);
    });

    it('places all 11 players', () => {
        const starters = make11([
            { positionGroup: 'GK', count: 1 },
            { positionGroup: 'DEF', count: 4 },
            { positionGroup: 'MID', count: 3 },
            { positionGroup: 'FWD', count: 3 },
        ]);
        const result = buildRows('4-3-3', starters);
        const totalSlots = result.rows.reduce((sum, row) => sum + row.slots.length, 0);
        expect(totalSlots).toBe(11);
    });

    it('falls back to fallback strategy when no data', () => {
        const starters = [makePlayer()];
        const result = buildRows(null, starters);
        expect(result.rows.length).toBeGreaterThan(0);
    });

    it('returns empty rows for empty starters', () => {
        const result = buildRows(null, []);
        expect(result.rows).toHaveLength(0);
    });
});

// ─── buildPresetRows ────────────────────────────────────
describe('buildPresetRows', () => {
    it('returns null for unknown formation', () => {
        expect(buildPresetRows('5-5-0', [])).toBeNull();
    });

    it('returns rows for valid formation', () => {
        const starters = make11([
            { positionGroup: 'GK', count: 1 },
            { positionGroup: 'DEF', count: 4 },
            { positionGroup: 'MID', count: 4 },
            { positionGroup: 'FWD', count: 2 },
        ]);
        const rows = buildPresetRows('4-4-2', starters);
        expect(rows).not.toBeNull();
        expect(rows!.length).toBeGreaterThan(0);
    });
});

// ─── buildNumericFormationRows ───────────────────────────
describe('buildNumericFormationRows', () => {
    it('returns null for single-part formation', () => {
        expect(buildNumericFormationRows('10', [makePlayer()])).toBeNull();
    });

    it('distributes players into formation rows', () => {
        const starters: LineupPlayer[] = [
            makePlayer({ positionCode: 'GK', name: 'GK' }),
            ...Array.from({ length: 4 }, (_, i) =>
                makePlayer({ positionCode: 'CB', name: `DEF${i}` })
            ),
            ...Array.from({ length: 3 }, (_, i) =>
                makePlayer({ positionCode: 'CM', name: `MID${i}` })
            ),
            ...Array.from({ length: 3 }, (_, i) =>
                makePlayer({ positionCode: 'ST', name: `FWD${i}` })
            ),
        ];
        const result = buildNumericFormationRows('4-3-3', starters);
        expect(result).not.toBeNull();
        // GK row + 3 outfield rows = 4 rows
        expect(result!.rows.length).toBe(4);
    });
});

// ─── buildFormationFallbackRows ─────────────────────────
describe('buildFormationFallbackRows', () => {
    it('returns empty for no starters', () => {
        expect(buildFormationFallbackRows('4-3-3', [])).toHaveLength(0);
    });

    it('puts all in one row when no formation', () => {
        const starters = [makePlayer(), makePlayer()];
        const rows = buildFormationFallbackRows(null, starters);
        expect(rows).toHaveLength(1);
        expect(rows[0].slots).toHaveLength(2);
    });

    it('distributes by formation counts', () => {
        const starters = Array.from({ length: 11 }, (_, i) =>
            makePlayer({ name: `P${i}`, jersey: String(i + 1) })
        );
        const rows = buildFormationFallbackRows('4-3-3', starters);
        // GK + 3 rows (4, 3, 3)
        expect(rows).toHaveLength(4);
    });
});

// ─── buildDetailedRows ──────────────────────────────────
describe('buildDetailedRows', () => {
    it('groups players by tactical line', () => {
        const starters = [
            makePlayer({ positionCode: 'GK', name: 'Keeper' }),
            makePlayer({ positionCode: 'LB', name: 'Left Back' }),
            makePlayer({ positionCode: 'CB', name: 'Center Back' }),
            makePlayer({ positionCode: 'CM', name: 'Midfielder' }),
            makePlayer({ positionCode: 'ST', name: 'Striker' }),
        ];
        const rows = buildDetailedRows('4-3-3', starters);
        expect(rows.length).toBeGreaterThanOrEqual(4); // GK, DEF, MID, FWD
    });
});
