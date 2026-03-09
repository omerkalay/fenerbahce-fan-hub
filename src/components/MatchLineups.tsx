import { useEffect, useState } from 'react';
import MatchEventIcon from './MatchEventIcon';
import { PITCH_SVG, MATCH_PRESET_LAYOUTS } from '../data/formations';
import { fetchSquad } from '../services/api';
import { localizePlayerName } from '../utils/playerDisplay';
import { localizeTeamName } from '../utils/localize';
import type { MatchLineups as MatchLineupsType, TeamLineup, LineupPlayer } from '../types';

const FENERBAHCE_NAMES = ['fenerbahce', 'fenerbahce sk'];

type PosGroup = 'GK' | 'DEF' | 'MID' | 'FWD';
type TacticalLine = 'GK' | 'DEF' | 'HOLD' | 'MID' | 'AM' | 'FWD';
type SlotKey =
    | 'GK'
    | 'LB' | 'RB' | 'CB1' | 'CB2' | 'CB3'
    | 'LWB' | 'RWB'
    | 'CDM' | 'CDM1' | 'CDM2'
    | 'LM' | 'RM'
    | 'CM1' | 'CM2' | 'CM3'
    | 'LAM' | 'RAM' | 'CAM'
    | 'LW' | 'RW'
    | 'ST' | 'ST1' | 'ST2';

interface FormationSlot {
    player: LineupPlayer;
    x: number;
}

interface FormationRow {
    y: number;
    slots: FormationSlot[];
}

type BuildStrategy = 'preset' | 'numeric' | 'detailed' | 'fallback';

interface BuildRowsResult {
    rows: FormationRow[];
    strategy: BuildStrategy;
    renderedFormation: string | null;
    confident: boolean;
}

interface MiniPitchProps {
    lineup: TeamLineup;
    isFenerbahceTeam: boolean;
    photoByJersey: Record<string, string>;
    photoByName: Record<string, string>;
    photoByAlias: Record<string, string>;
    subOutByPlayer: Map<string, string>;
}

const LINE_Y: Record<TacticalLine, number> = {
    GK: 92,
    DEF: 75,
    HOLD: 61,
    MID: 49,
    AM: 34,
    FWD: 17
};

const DISTRIBUTED_X: Record<number, number[]> = {
    1: [50],
    2: [36, 64],
    3: [22, 50, 78],
    4: [10, 36, 64, 90],
    5: [8, 29, 50, 71, 92]
};

const LANE_X: Record<number, number> = {
    [-3]: 10,
    [-2]: 24,
    [-1]: 38,
    [0]: 50,
    [1]: 62,
    [2]: 76,
    [3]: 90
};
const SLOT_ASSIGNMENT_PRIORITY: SlotKey[] = [
    'GK',
    'ST', 'ST1', 'ST2',
    'CAM',
    'CDM', 'CDM1', 'CDM2',
    'CB2', 'CB1', 'CB3',
    'CM2', 'CM1', 'CM3',
    'LAM', 'RAM',
    'LM', 'RM',
    'LW', 'RW',
    'LB', 'RB', 'LWB', 'RWB'
];

const FORMATION_ALIASES: Record<string, string> = {
    '4-3-3': '4-3-3',
    '4-4-2': '4-4-2',
    '4-4-1-1': '4-4-1-1',
    '4-2-3-1': '4-2-3-1',
    '4-3-1-2': '4-3-1-2',
    '4-1-4-1': '4-1-4-1',
    '3-5-2': '3-5-2',
    '4-1-2-1-2': '4-1-2-1-2 Diamond',
    '4-1-2-1-2 diamond': '4-1-2-1-2 Diamond',
    '3-4-1-2': '3-4-1-2'
};

const FORMATION_PLACE_SLOT_MAPS: Record<string, Record<number, SlotKey>> = {
    '4-2-3-1': { 1: 'GK', 2: 'RB', 3: 'LB', 4: 'CDM1', 5: 'CB2', 6: 'CB1', 7: 'RAM', 8: 'CDM2', 9: 'ST', 10: 'CAM', 11: 'LAM' },
    '4-3-1-2': { 1: 'GK', 2: 'RB', 3: 'LB', 4: 'CM2', 5: 'CB2', 6: 'CB1', 7: 'CM3', 8: 'CAM', 9: 'ST2', 10: 'ST1', 11: 'CM1' },
    '4-1-4-1': { 1: 'GK', 2: 'RB', 3: 'LB', 4: 'CDM', 5: 'CB2', 6: 'CB1', 7: 'RM', 8: 'CM2', 9: 'ST', 10: 'CM1', 11: 'LM' },
    '4-4-1-1': { 1: 'GK', 2: 'RB', 3: 'LB', 4: 'CM1', 5: 'CB2', 6: 'CB1', 7: 'RM', 8: 'CM2', 9: 'ST', 10: 'CAM', 11: 'LM' },
    '4-4-2': { 1: 'GK', 2: 'RB', 3: 'LB', 4: 'CM1', 5: 'CB2', 6: 'CB1', 7: 'RM', 8: 'CM2', 9: 'ST2', 10: 'ST1', 11: 'LM' },
    '4-3-3': { 1: 'GK', 2: 'RB', 3: 'LB', 4: 'CM2', 5: 'CB2', 6: 'CB1', 7: 'CM3', 8: 'CM1', 9: 'ST', 10: 'RW', 11: 'LW' },
    '3-5-2': { 1: 'GK', 2: 'RWB', 3: 'LWB', 4: 'CB1', 5: 'CB2', 6: 'CB3', 7: 'CM2', 8: 'CM1', 9: 'ST1', 10: 'ST2', 11: 'CM3' },
    '3-4-1-2': { 1: 'GK', 2: 'RM', 3: 'LM', 4: 'CB1', 5: 'CB2', 6: 'CB3', 7: 'CM2', 8: 'CM1', 9: 'CAM', 10: 'ST2', 11: 'ST1' },
    '4-1-2-1-2 Diamond': { 1: 'GK', 2: 'RB', 3: 'LB', 4: 'CDM', 5: 'CB2', 6: 'CB1', 7: 'CM2', 8: 'CM1', 9: 'ST2', 10: 'CAM', 11: 'ST1' }
};

const stripDiacritics = (value: string): string =>
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normalizeLookupKey = (value: string): string =>
    stripDiacritics(localizePlayerName(String(value || '')).trim().toLocaleLowerCase('tr-TR'))
        .replace(/[^\p{L}\p{N} ]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const normalizeRawLookupKey = (value: string): string =>
    stripDiacritics(String(value || '').trim().toLocaleLowerCase('tr-TR'))
        .replace(/[^\p{L}\p{N} ]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const getLookupTokens = (value: string): string[] =>
    normalizeLookupKey(value)
        .split(' ')
        .map((part) => part.trim())
        .filter((part) => part.length >= 3);

const getRawLookupTokens = (value: string): string[] =>
    normalizeRawLookupKey(value)
        .split(' ')
        .map((part) => part.trim())
        .filter((part) => part.length >= 3);

const normalizeTeamKey = (value: string): string =>
    stripDiacritics(localizeTeamName(String(value || '')).trim().toLocaleLowerCase('tr-TR'));

const isFenerbahce = (name: string): boolean => {
    const normalized = normalizeTeamKey(name);
    return FENERBAHCE_NAMES.some((fb) => normalized.includes(fb));
};

const classifyPosition = (pos: string): PosGroup => {
    const normalized = pos.toLowerCase();
    if (normalized.includes('goalkeeper') || normalized.includes('kaleci') || normalized === 'gk') return 'GK';
    if (normalized.includes('defender') || normalized.includes('back') || normalized === 'def' || normalized === 'd') return 'DEF';
    if (normalized.includes('midfielder') || normalized.includes('midfield') || normalized === 'mid' || normalized === 'm') return 'MID';
    if (normalized.includes('forward') || normalized.includes('striker') || normalized.includes('wing') || normalized === 'fwd' || normalized === 'f') return 'FWD';
    return 'MID';
};

const formatSoccerMinute = (value: string): string => {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const normalized = raw
        .normalize('NFKD')
        .replace(/[\u2019`\u00B4]/g, "'")
        .replace(/[^\d+' ]/g, '')
        .replace(/\s+/g, '');

    const addedTimeMatch = normalized.match(/^(\d+)'?\+(\d+)'?$/);
    if (addedTimeMatch) {
        return `${addedTimeMatch[1]}+${addedTimeMatch[2]}'`;
    }

    const simpleMinuteMatch = normalized.match(/^(\d+)'?$/);
    if (simpleMinuteMatch) {
        return `${simpleMinuteMatch[1]}'`;
    }

    return normalized.replace(/'{2,}/g, "'");
};

const getDistributedX = (count: number, index: number): number => {
    const preset = DISTRIBUTED_X[count];
    if (preset?.[index] != null) return preset[index];
    if (count <= 1) return 50;
    return 10 + (index / (count - 1)) * 80;
};

const getPhotoUrl = (
    player: LineupPlayer,
    isFenerbahceTeam: boolean,
    photoByJersey: Record<string, string>,
    photoByName: Record<string, string>,
    photoByAlias: Record<string, string>
): string | null => {
    if (!isFenerbahceTeam) return null;

    if (player.jersey && photoByJersey[player.jersey]) {
        return photoByJersey[player.jersey];
    }

    const exactKey = normalizeLookupKey(player.name);
    if (exactKey && photoByName[exactKey]) {
        return photoByName[exactKey];
    }

    const rawExactKey = normalizeRawLookupKey(player.name);
    if (rawExactKey && photoByName[rawExactKey]) {
        return photoByName[rawExactKey];
    }

    const tokens = getLookupTokens(player.name).sort((a, b) => b.length - a.length);
    for (const token of tokens) {
        if (photoByAlias[token]) return photoByAlias[token];
    }

    const rawTokens = getRawLookupTokens(player.name).sort((a, b) => b.length - a.length);
    for (const token of rawTokens) {
        if (photoByAlias[token]) return photoByAlias[token];
    }

    return null;
};

const getFormationParts = (formation: string | null): number[] =>
    typeof formation === 'string'
        ? formation.split('-').map((part) => Number(part)).filter((part) => part > 0)
        : [];

const getPresetFormation = (formation: string | null): string | null => {
    const trimmed = String(formation || '').trim();
    if (!trimmed) return null;
    const alias = FORMATION_ALIASES[trimmed.toLowerCase()];
    if (alias) return alias;
    if (trimmed in MATCH_PRESET_LAYOUTS) return trimmed;
    return null;
};

const getBaseLineFromPosition = (player: LineupPlayer): TacticalLine => {
    const code = String(player.positionCode || '').toUpperCase();
    const position = String(player.position || '').toLowerCase();

    if (code === 'G' || code === 'GK' || position.includes('goalkeeper')) return 'GK';
    if (
        code.includes('DEF') || code === 'LB' || code === 'RB' || code === 'LWB' || code === 'RWB'
        || code === 'CD' || code.startsWith('CD-') || position.includes('defender') || position.includes(' back')
    ) {
        return 'DEF';
    }
    if (code.startsWith('DM') || code === 'CDM' || position.includes('defensive midfielder')) return 'HOLD';
    if (code === 'AM' || code.startsWith('AM-') || position.includes('attacking midfielder')) return 'AM';
    if (code === 'LM' || code === 'RM' || code === 'CM' || code.startsWith('CM-') || code === 'M' || position.includes('midfielder')) {
        return 'MID';
    }
    if (code === 'LF' || code === 'RF' || code === 'F' || code === 'CF' || code === 'ST' || code.startsWith('CF-') || position.includes('forward') || position.includes('striker')) {
        return 'FWD';
    }

    const fallbackGroup = (player.positionGroup as PosGroup | undefined) || classifyPosition(player.position);
    if (fallbackGroup === 'GK') return 'GK';
    if (fallbackGroup === 'DEF') return 'DEF';
    if (fallbackGroup === 'FWD') return 'FWD';
    return 'MID';
};

const inferPresetFormation = (starters: LineupPlayer[]): string | null => {
    const counts = { DEF: 0, HOLD: 0, MID: 0, AM: 0, FWD: 0 };
    let centralStrikerCount = 0;
    let wideAttackCount = 0;
    let playmakerCount = 0;
    let pivotCount = 0;

    starters.forEach((player) => {
        const line = getBaseLineFromPosition(player);
        if (line !== 'GK') counts[line] += 1;

        const code = String(player.positionCode || '').toUpperCase();
        const position = String(player.position || '').toLowerCase();

        if (line === 'HOLD' || code === 'CM' || code === 'CM-L' || code === 'CM-R' || code === 'M') {
            pivotCount += 1;
        }

        if (code === 'ST' || code === 'CF' || code === 'F' || position.includes('striker')) {
            centralStrikerCount += 1;
        }

        if (
            code === 'LM' || code === 'RM'
            || code === 'AM-L' || code === 'AM-R'
            || code === 'LF' || code === 'RF'
            || code === 'LW' || code === 'RW'
            || code === 'CF-L' || code === 'CF-R'
            || position.includes('left')
            || position.includes('right')
        ) {
            wideAttackCount += 1;
        }

        if (code === 'AM' || code === 'CAM' || position.includes('attacking midfielder')) {
            playmakerCount += 1;
        }
    });

    if (counts.DEF === 3 && counts.MID + counts.HOLD === 4 && counts.AM === 1 && counts.FWD === 2) return '3-4-1-2';
    if (counts.DEF === 3 && counts.MID + counts.HOLD === 5 && counts.FWD === 2) return '3-5-2';
    if (counts.DEF === 4 && counts.MID === 4 && counts.AM === 1 && counts.FWD === 1) return '4-4-1-1';
    if (counts.DEF === 4 && centralStrikerCount === 1 && wideAttackCount >= 2 && playmakerCount >= 1 && pivotCount >= 2) return '4-2-3-1';
    if (counts.DEF === 4 && counts.HOLD === 2 && counts.AM + counts.MID === 3 && counts.FWD === 1) return '4-2-3-1';
    if (counts.DEF === 4 && counts.HOLD === 1 && counts.MID === 4 && counts.FWD === 1) return '4-1-4-1';
    if (counts.DEF === 4 && counts.HOLD === 1 && counts.MID === 2 && counts.AM === 1 && counts.FWD === 2) return '4-1-2-1-2 Diamond';
    if (counts.DEF === 4 && counts.MID === 4 && counts.FWD === 2) return '4-4-2';
    if (counts.DEF === 4 && counts.MID === 3 && counts.FWD === 3) return '4-3-3';

    return null;
};

const scorePresetFormationByPlaces = (
    presetFormation: string,
    starters: LineupPlayer[]
): number | null => {
    const slotMap = FORMATION_PLACE_SLOT_MAPS[presetFormation];
    let mappedPlayers = 0;
    let score = 0;

    starters.forEach((player) => {
        const formationPlace = Number(player.formationPlace);
        if (!Number.isFinite(formationPlace)) return;

        const expectedSlot = slotMap?.[formationPlace];
        if (!expectedSlot) return;

        mappedPlayers += 1;

        const candidates = getCandidateSlotKeys(player, presetFormation);
        const candidateIndex = candidates.indexOf(expectedSlot);
        if (candidateIndex !== -1) {
            score += 100 - candidateIndex * 10;
        } else {
            score += Math.max(0, getSlotFitScore(player, expectedSlot, presetFormation));
        }
    });

    if (mappedPlayers < 7) return null;
    return score / mappedPlayers;
};

const inferPresetFormationFromPlaces = (starters: LineupPlayer[]): string | null => {
    let bestFormation: string | null = null;
    let bestScore = -Infinity;

    (Object.keys(FORMATION_PLACE_SLOT_MAPS) as string[]).forEach((presetFormation) => {
        const score = scorePresetFormationByPlaces(presetFormation, starters);
        if (score == null) return;
        if (score > bestScore) {
            bestScore = score;
            bestFormation = presetFormation;
        }
    });

    if (!bestFormation || bestScore < 55) return null;
    return bestFormation;
};

const getEffectiveFormation = (formation: string | null, starters: LineupPlayer[]): string | null => {
    const cleaned = typeof formation === 'string' && formation.trim() ? formation.trim() : null;

    // Explicit formation from backend — respect it as-is
    if (cleaned) {
        // Resolve known aliases (e.g. "4-1-2-1-2" → "4-1-2-1-2 Diamond")
        const preset = getPresetFormation(cleaned);
        return preset || cleaned;
    }

    // No explicit formation — try inference
    const inferredFromPlaces = inferPresetFormationFromPlaces(starters);
    if (inferredFromPlaces) return inferredFromPlaces;

    return inferPresetFormation(starters);
};

const getLaneFromPosition = (positionCode: string, positionName: string): number => {
    const code = positionCode.toUpperCase();
    const position = positionName.toLowerCase();

    if (code === 'LB' || code === 'LWB' || position.includes('left back')) return -3;
    if (code === 'RB' || code === 'RWB' || position.includes('right back')) return 3;
    if (code === 'LM' || position.includes('left midfielder')) return -3;
    if (code === 'RM' || position.includes('right midfielder')) return 3;
    if (code === 'LF' || position.includes('left forward')) return -3;
    if (code === 'RF' || position.includes('right forward')) return 3;
    if (code === 'CD-L' || code === 'LCB' || position.includes('center left defender')) return -1;
    if (code === 'CD-R' || code === 'RCB' || position.includes('center right defender')) return 1;
    if (code === 'CM-L' || code === 'DM-L' || code === 'AM-L' || code === 'CF-L' || position.includes('center left')) return -1;
    if (code === 'CM-R' || code === 'DM-R' || code === 'AM-R' || code === 'CF-R' || position.includes('center right')) return 1;
    if (position.includes('left')) return -2;
    if (position.includes('right')) return 2;
    return 0;
};
const getLineFromPosition = (
    player: LineupPlayer,
    formationParts: number[]
): TacticalLine => {
    const baseLine = getBaseLineFromPosition(player);
    const code = String(player.positionCode || '').toUpperCase();
    const position = String(player.position || '').toLowerCase();
    const isHoldShape = formationParts.length === 4 && formationParts[1] === 2 && formationParts[2] >= 3 && formationParts[3] === 1;

    if (baseLine === 'MID' && (code === 'LM' || code === 'RM' || position.includes('left midfielder') || position.includes('right midfielder'))) {
        return isHoldShape ? 'HOLD' : 'MID';
    }

    return baseLine;
};

const getCandidateSlotKeys = (player: LineupPlayer, formation: string | null): SlotKey[] => {
    const code = String(player.positionCode || '').toUpperCase();
    const position = String(player.position || '').toLowerCase();
    const presetFormation = getPresetFormation(formation);

    if (code === 'G' || code === 'GK' || position.includes('goalkeeper')) return ['GK'];
    if (code === 'LB' || code === 'LWB' || position.includes('left back')) return ['LWB', 'LB', 'LM', 'LAM', 'LW'];
    if (code === 'RB' || code === 'RWB' || position.includes('right back')) return ['RWB', 'RB', 'RM', 'RAM', 'RW'];
    if (code === 'CD-L' || code === 'LCB' || position.includes('center left defender')) return ['CB1', 'LB', 'LWB', 'CB2'];
    if (code === 'CD-R' || code === 'RCB' || position.includes('center right defender')) return ['CB3', 'RB', 'RWB', 'CB2'];
    if (code === 'CD' || code === 'CB' || position.includes('center defender') || position.includes('defender')) return ['CB2', 'CB1', 'CB3'];
    if (code === 'DM-L' || code === 'CDM-L') return ['CDM1', 'CDM', 'CM1', 'CM2'];
    if (code === 'DM-R' || code === 'CDM-R') return ['CDM2', 'CDM', 'CM3', 'CM2'];
    if (code === 'DM' || code === 'CDM' || position.includes('defensive midfielder')) return ['CDM', 'CDM1', 'CDM2', 'CM2'];
    if (code === 'CM-L' || position.includes('center left')) return ['CM1', 'CDM1', 'CM2', 'LM'];
    if (code === 'CM-R' || position.includes('center right')) return ['CM2', 'CM3', 'CDM2', 'RM'];
    if (code === 'CM' || code === 'M' || position.includes('center midfielder')) return ['CM2', 'CM1', 'CM3', 'CDM'];
    if (code === 'LM' || position.includes('left midfielder')) {
        return presetFormation === '4-2-3-1' ? ['CDM1', 'CDM', 'LM', 'CM1', 'LAM'] : ['LM', 'LWB', 'LAM', 'LW', 'CM1'];
    }
    if (code === 'RM' || position.includes('right midfielder')) {
        return presetFormation === '4-2-3-1' ? ['CDM2', 'CDM', 'RM', 'CM3', 'RAM'] : ['RM', 'RWB', 'RAM', 'RW', 'CM3'];
    }
    if (code === 'AM-L' || position.includes('left attacking')) return ['LAM', 'CAM', 'LM', 'LW'];
    if (code === 'AM-R' || position.includes('right attacking')) return ['RAM', 'CAM', 'RM', 'RW'];
    if (code === 'AM' || position.includes('attacking midfielder')) return ['CAM', 'LAM', 'RAM', 'CM2'];
    if (code === 'LF' || position.includes('left forward')) {
        return presetFormation === '4-2-3-1' ? ['LAM', 'LW', 'ST1'] : ['LW', 'ST1', 'LAM'];
    }
    if (code === 'RF' || position.includes('right forward')) {
        return presetFormation === '4-2-3-1' ? ['RAM', 'RW', 'ST2'] : ['RW', 'ST2', 'RAM'];
    }
    if (code === 'CF-L') {
        return presetFormation === '4-2-3-1' ? ['LAM', 'LW', 'ST1'] : ['ST1', 'LW', 'LAM'];
    }
    if (code === 'CF-R') {
        return presetFormation === '4-2-3-1' ? ['RAM', 'RW', 'ST2', 'ST'] : ['ST2', 'ST', 'RW', 'RAM'];
    }
    if (code === 'CF' || code === 'ST' || code === 'F' || position.includes('forward') || position.includes('striker')) return ['ST', 'ST1', 'ST2', 'LW', 'RW'];

    const fallbackGroup = (player.positionGroup as PosGroup | undefined) || classifyPosition(player.position);
    if (fallbackGroup === 'DEF') return ['CB2', 'CB1', 'CB3', 'LB', 'RB'];
    if (fallbackGroup === 'MID') return ['CM2', 'CM1', 'CM3', 'LM', 'RM', 'CAM'];
    if (fallbackGroup === 'FWD') return ['ST', 'ST1', 'ST2', 'LW', 'RW'];
    return ['GK'];
};

const getFormationPlaceSlotKey = (formation: string | null, player: LineupPlayer): SlotKey | null => {
    const presetFormation = getPresetFormation(formation);
    const formationPlace = Number(player.formationPlace);
    if (!presetFormation || !Number.isFinite(formationPlace)) return null;
    return FORMATION_PLACE_SLOT_MAPS[presetFormation]?.[formationPlace] || null;
};

const getSlotAssignmentRank = (slotKey: string): number => {
    const index = (SLOT_ASSIGNMENT_PRIORITY as string[]).indexOf(slotKey);
    return index === -1 ? SLOT_ASSIGNMENT_PRIORITY.length : index;
};

const getSlotFitScore = (player: LineupPlayer, slotKey: string, formation: string | null): number => {
    const candidates: string[] = getCandidateSlotKeys(player, formation);
    const candidateIndex = candidates.indexOf(slotKey);
    if (candidateIndex !== -1) {
        return 100 - candidateIndex * 10;
    }

    const fallbackGroup = (player.positionGroup as PosGroup | undefined) || classifyPosition(player.position);
    if (slotKey === 'GK') return fallbackGroup === 'GK' ? 40 : -100;
    if (['CB1', 'CB2', 'CB3', 'LB', 'RB', 'LWB', 'RWB'].includes(slotKey)) return fallbackGroup === 'DEF' ? 30 : 0;
    if (['CDM', 'CDM1', 'CDM2', 'CM1', 'CM2', 'CM3', 'LM', 'RM', 'LAM', 'RAM', 'CAM'].includes(slotKey)) return fallbackGroup === 'MID' ? 20 : 0;
    if (['ST', 'ST1', 'ST2', 'LW', 'RW'].includes(slotKey)) return fallbackGroup === 'FWD' ? 20 : 0;
    return 0;
};

const buildPresetRows = (formation: string | null, starters: LineupPlayer[]): FormationRow[] | null => {
    const presetFormation = getPresetFormation(formation);
    if (!presetFormation) return null;

    const presetSlots = MATCH_PRESET_LAYOUTS[presetFormation];
    if (!presetSlots) return null;

    const assigned = new Map<string, LineupPlayer>();
    const placeMappedPlayers = new Set<LineupPlayer>();
    const remainingPlayers = [...starters];

    remainingPlayers.forEach((player) => {
        const slotKey = getFormationPlaceSlotKey(formation, player);
        if (!slotKey || assigned.has(slotKey)) return;
        const fitScore = getSlotFitScore(player, slotKey, formation);
        if (fitScore < 0) return;
        assigned.set(slotKey, player);
        placeMappedPlayers.add(player);
    });

    for (let i = remainingPlayers.length - 1; i >= 0; i -= 1) {
        if (placeMappedPlayers.has(remainingPlayers[i])) {
            remainingPlayers.splice(i, 1);
        }
    }

    const orderedSlots = [...presetSlots]
        .map((slot) => slot.key)
        .sort((a, b) => getSlotAssignmentRank(a) - getSlotAssignmentRank(b));

    orderedSlots.forEach((slotKey) => {
        if (remainingPlayers.length === 0) return;

        let bestIndex = -1;
        let bestScore = -Infinity;

        remainingPlayers.forEach((player, index) => {
            const score = getSlotFitScore(player, slotKey, formation);
            if (score > bestScore) {
                bestScore = score;
                bestIndex = index;
            } else if (score === bestScore && bestIndex !== -1) {
                const currentOrder = remainingPlayers[bestIndex]?.formationPlace ?? remainingPlayers[bestIndex]?.order ?? Number.MAX_SAFE_INTEGER;
                const nextOrder = player.formationPlace ?? player.order ?? Number.MAX_SAFE_INTEGER;
                if (nextOrder < currentOrder) {
                    bestIndex = index;
                }
            }
        });

        if (bestIndex === -1) return;
        const [player] = remainingPlayers.splice(bestIndex, 1);
        assigned.set(slotKey, player);
    });

    const rowsByY = new Map<number, FormationSlot[]>();
    presetSlots.forEach((slot) => {
        const player = assigned.get(slot.key);
        if (!player) return;
        const row = rowsByY.get(slot.y) || [];
        row.push({ player, x: slot.x });
        rowsByY.set(slot.y, row);
    });

    return Array.from(rowsByY.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([y, slots]) => ({ y, slots }));
};
const buildDetailedRows = (formation: string | null, starters: LineupPlayer[]): FormationRow[] => {
    const formationParts = getFormationParts(formation);
    const buckets = new Map<TacticalLine, Array<{ player: LineupPlayer; lane: number }>>();

    starters.forEach((player) => {
        const line = getLineFromPosition(player, formationParts);
        const lane = getLaneFromPosition(String(player.positionCode || ''), String(player.position || ''));
        const existing = buckets.get(line) || [];
        existing.push({ player, lane });
        buckets.set(line, existing);
    });

    const lineOrder: TacticalLine[] = ['GK', 'DEF', 'HOLD', 'MID', 'AM', 'FWD'];

    return lineOrder
        .filter((line) => buckets.has(line))
        .map((line) => {
            const players = (buckets.get(line) || []).sort((a, b) => {
                if (a.lane !== b.lane) return a.lane - b.lane;
                if ((a.player.order ?? 0) !== (b.player.order ?? 0)) return (a.player.order ?? 0) - (b.player.order ?? 0);
                return a.player.name.localeCompare(b.player.name);
            });

            const lanes = players.map((entry) => entry.lane);
            const uniqueLaneCount = new Set(lanes).size;
            const useExplicitLanes = uniqueLaneCount === lanes.length && players.length > 1;

            const slots = players.map((entry, index) => ({
                player: entry.player,
                x: players.length === 1
                    ? 50
                    : useExplicitLanes
                        ? (LANE_X[entry.lane] ?? getDistributedX(players.length, index))
                        : getDistributedX(players.length, index)
            }));

            return {
                y: LINE_Y[line],
                slots
            };
        });
};

const getPositionalDepth = (player: LineupPlayer): number => {
    const code = String(player.positionCode || '').toUpperCase();
    const pos = String(player.position || '').toLowerCase();

    if (code === 'G' || code === 'GK' || pos.includes('goalkeeper')) return 0;
    if (code === 'CB' || code === 'CD' || code.startsWith('CD-') || code === 'LB' || code === 'RB' || code === 'LWB' || code === 'RWB' || pos.includes('defender') || pos.includes('back')) return 1;
    if (code.startsWith('DM') || code === 'CDM' || pos.includes('defensive mid')) return 2;
    if (code === 'CM' || code.startsWith('CM-') || code === 'M' || code === 'LM' || code === 'RM' || pos.includes('midfielder')) return 3;
    if (code === 'AM' || code.startsWith('AM-') || code === 'CAM' || pos.includes('attacking mid')) return 4;
    if (code === 'LF' || code === 'RF' || code.startsWith('CF') || code === 'F' || code === 'ST' || code === 'LW' || code === 'RW' || pos.includes('forward') || pos.includes('striker')) return 5;

    const group = classifyPosition(player.position);
    if (group === 'GK') return 0;
    if (group === 'DEF') return 1;
    if (group === 'FWD') return 5;
    return 3;
};

const getRowYPositions = (rowCount: number): number[] => {
    if (rowCount <= 2) return [72, 22];
    if (rowCount === 3) return [75, 48, 18];
    if (rowCount === 4) return [76, 57, 36, 18];
    return [78, 62, 48, 34, 18];
};

const buildNumericFormationRows = (formation: string, starters: LineupPlayer[]): { rows: FormationRow[]; confident: boolean } | null => {
    const parts = getFormationParts(formation);
    if (parts.length < 2 || parts.length > 5) return null;

    const totalOutfield = parts.reduce((sum, n) => sum + n, 0);

    // Separate GK from outfield
    const gkPlayer = starters.find((p) => getPositionalDepth(p) === 0) || starters[0];
    const outfield = starters.filter((p) => p !== gkPlayer);

    if (Math.abs(outfield.length - totalOutfield) > 2) return null;

    // --- Role-aware global scoring ---
    // Expected positional depth per row: 1=DEF .. 5=FWD, linearly interpolated
    const numRows = parts.length;
    const expectedDepths = parts.map((_, i) =>
        numRows === 1 ? 3 : 1 + (i / (numRows - 1)) * 4
    );

    // Score each player-row pair
    const candidates: Array<{ player: LineupPlayer; row: number; score: number }> = [];

    outfield.forEach((player) => {
        const depth = getPositionalDepth(player);
        for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
            const depthDist = Math.abs(depth - expectedDepths[rowIdx]);
            let score = 100 - depthDist * 25;

            // formationPlace: small tie-break bonus if it maps to this row
            const fp = Number(player.formationPlace);
            if (Number.isFinite(fp) && fp >= 2) {
                let offset = 2;
                for (let r = 0; r < rowIdx; r++) offset += parts[r];
                if (fp >= offset && fp < offset + parts[rowIdx]) {
                    score += 5;
                }
            }

            candidates.push({ player, row: rowIdx, score });
        }
    });

    // Sort by score descending; tie-break by formationPlace/order
    candidates.sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        return (a.player.formationPlace ?? a.player.order ?? 99) - (b.player.formationPlace ?? b.player.order ?? 99);
    });

    // Greedy assignment: best-scoring pairs first
    const rowBuckets: LineupPlayer[][] = parts.map(() => []);
    const assigned = new Set<LineupPlayer>();

    candidates.forEach(({ player, row }) => {
        if (assigned.has(player)) return;
        if (rowBuckets[row].length >= parts[row]) return;
        rowBuckets[row].push(player);
        assigned.add(player);
    });

    // Catch-all for any unassigned (data edge cases)
    outfield.forEach((player) => {
        if (assigned.has(player)) return;
        for (let i = 0; i < parts.length; i++) {
            if (rowBuckets[i].length < parts[i]) {
                rowBuckets[i].push(player);
                assigned.add(player);
                break;
            }
        }
        if (!assigned.has(player)) {
            rowBuckets[parts.length - 1].push(player);
        }
    });

    // Confidence: row counts match AND no egregious role mismatches
    // Threshold >= 2: catches CM(3) in FWD(5) row, DEF(1) in MID(3) row, etc.
    const countsMatch = rowBuckets.every((b, i) => b.length === parts[i]);
    let rolesMismatched = false;
    rowBuckets.forEach((bucket, rowIdx) => {
        bucket.forEach((player) => {
            const dist = Math.abs(getPositionalDepth(player) - expectedDepths[rowIdx]);
            if (dist >= 2) rolesMismatched = true;
        });
    });

    const yPositions = getRowYPositions(parts.length);
    const rows: FormationRow[] = [];
    rows.push({ y: LINE_Y.GK, slots: [{ player: gkPlayer, x: 50 }] });

    rowBuckets.forEach((bucket, rowIdx) => {
        if (bucket.length === 0) return;
        const withLanes = bucket
            .map((p) => ({
                player: p,
                lane: getLaneFromPosition(String(p.positionCode || ''), String(p.position || ''))
            }))
            .sort((a, b) => a.lane - b.lane);

        rows.push({
            y: yPositions[rowIdx],
            slots: withLanes.map((entry, i) => ({
                player: entry.player,
                x: getDistributedX(withLanes.length, i)
            }))
        });
    });

    return { rows, confident: countsMatch && !rolesMismatched };
};

const buildFormationFallbackRows = (formation: string | null, starters: LineupPlayer[]): FormationRow[] => {
    if (starters.length === 0) return [];

    const parts = getFormationParts(formation);
    if (parts.length === 0) {
        return [{
            y: 50,
            slots: starters.map((player, index) => ({ player, x: getDistributedX(starters.length, index) }))
        }];
    }

    const rows: FormationRow[] = [];
    if (starters[0]) {
        rows.push({ y: LINE_Y.GK, slots: [{ player: starters[0], x: 50 }] });
    }

    let pointer = 1;
    const yPositions = parts.length <= 3
        ? [74, 48, 18]
        : parts.length <= 4
            ? [74, 55, 35, 18]
            : [76, 62, 48, 34, 18];

    parts.forEach((count, rowIndex) => {
        const rowPlayers = starters.slice(pointer, pointer + count);
        pointer += count;
        if (rowPlayers.length > 0) {
            rows.push({
                y: yPositions[rowIndex] ?? (70 - rowIndex * 14),
                slots: rowPlayers.map((player, index) => ({
                    player,
                    x: getDistributedX(rowPlayers.length, index)
                }))
            });
        }
    });

    if (pointer < starters.length) {
        const remaining = starters.slice(pointer);
        rows.push({
            y: 18,
            slots: remaining.map((player, index) => ({
                player,
                x: getDistributedX(remaining.length, index)
            }))
        });
    }

    return rows;
};

const buildRows = (formation: string | null, starters: TeamLineup['starters']): BuildRowsResult => {
    const effectiveFormation = getEffectiveFormation(formation, starters);

    // 1. Try preset layout (coordinates from formations.ts)
    const presetRows = buildPresetRows(effectiveFormation, starters);
    if (presetRows) {
        return { rows: presetRows, strategy: 'preset', renderedFormation: effectiveFormation, confident: true };
    }

    // 2. Try numeric formation-based layout (role-aware scoring)
    if (effectiveFormation) {
        const numericResult = buildNumericFormationRows(effectiveFormation, starters);
        if (numericResult) {
            return {
                rows: numericResult.rows,
                strategy: 'numeric',
                renderedFormation: effectiveFormation,
                confident: numericResult.confident
            };
        }
    }

    // 3. Fallback to position-based detailed rows — not confident about formation label
    const hasDetailedPositionData = starters.some((player) => (player.positionCode && player.positionCode.length > 0) || (player.position && player.position.length > 0));
    if (hasDetailedPositionData) {
        return { rows: buildDetailedRows(effectiveFormation, starters), strategy: 'detailed', renderedFormation: effectiveFormation, confident: false };
    }

    return { rows: buildFormationFallbackRows(effectiveFormation, starters), strategy: 'fallback', renderedFormation: effectiveFormation, confident: false };
};

function MiniPitch({
    lineup,
    isFenerbahceTeam,
    photoByJersey,
    photoByName,
    photoByAlias,
    subOutByPlayer
}: MiniPitchProps) {
    const { rows, confident, renderedFormation } = buildRows(lineup.formation, lineup.starters);

    return (
        <div className="relative w-full aspect-[68/105] rounded-xl overflow-hidden border border-white/10 bg-[#14532d] shadow-inner shadow-black/25">
            <img src={PITCH_SVG} alt="" className="absolute inset-0 h-full w-full object-cover opacity-95" />
            {confident && renderedFormation && (
                <span className="absolute top-2 left-1/2 -translate-x-1/2 z-10 rounded-md border border-white/15 bg-slate-950/70 px-2.5 py-0.5 text-[10px] font-bold text-yellow-300 backdrop-blur-sm shadow-sm">
                    {renderedFormation}
                </span>
            )}
            <div className="absolute inset-0">
                {rows.map((row, rowIndex) => (
                    row.slots.map((slot, slotIndex) => {
                        const { player, x } = slot;
                        const photoUrl = getPhotoUrl(player, isFenerbahceTeam, photoByJersey, photoByName, photoByAlias);
                        const subOutMinute = subOutByPlayer.get(normalizeLookupKey(player.name));
                        const displayName = localizePlayerName(player.name);
                        const shortName = displayName.split(' ').pop() || displayName;
                        return (
                            <div
                                key={`${rowIndex}-${slotIndex}`}
                                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                                style={{ top: `${row.y}%`, left: `${x}%` }}
                            >
                                <div className="relative">
                                    <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-yellow-400 bg-slate-950 text-[10px] font-bold text-white shadow-[0_8px_18px_rgba(0,0,0,0.35)] sm:h-10 sm:w-10 sm:text-xs">
                                        {photoUrl ? (
                                            <img
                                                src={photoUrl}
                                                alt={displayName}
                                                className="h-full w-full object-cover"
                                                loading="lazy"
                                            />
                                        ) : (
                                            player.jersey || displayName.slice(0, 1).toUpperCase()
                                        )}
                                    </span>
                                    {subOutMinute && (
                                        <span className="absolute -right-3 -top-2 inline-flex items-center gap-0.5 rounded-full border border-white/15 bg-slate-950/95 px-1 py-[2px] text-[8px] font-semibold text-rose-300 shadow-lg">
                                            <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <path d="M14 5H5" />
                                                <path d="m8 2-3 3 3 3" />
                                            </svg>
                                            <span>{subOutMinute}</span>
                                        </span>
                                    )}
                                </div>
                                <span className="mt-1 max-w-[74px] truncate rounded-md border border-white/10 bg-slate-950/70 px-1.5 py-0.5 text-center text-[8px] font-medium text-white shadow-sm backdrop-blur-sm sm:max-w-[82px] sm:text-[9px]">
                                    {shortName}
                                </span>
                            </div>
                        );
                    })
                ))}
            </div>
        </div>
    );
}
interface MatchLineupsProps {
    lineups: MatchLineupsType;
    homeTeamName?: string;
    awayTeamName?: string;
    matchId?: string;
}

function MatchLineups({ lineups, homeTeamName, awayTeamName, matchId }: MatchLineupsProps) {
    const homeName = homeTeamName || lineups.home?.teamName || 'Ev Sahibi';
    const awayName = awayTeamName || lineups.away?.teamName || 'Deplasman';
    const localizedHomeName = localizeTeamName(homeName);
    const localizedAwayName = localizeTeamName(awayName);
    const homeIsFb = isFenerbahce(homeName);
    const awayIsFb = isFenerbahce(awayName);
    const defaultTab: 'home' | 'away' = homeIsFb ? 'home' : 'away';
    const [activeTab, setActiveTab] = useState<'home' | 'away'>(defaultTab);
    const [photoByJersey, setPhotoByJersey] = useState<Record<string, string>>({});
    const [photoByName, setPhotoByName] = useState<Record<string, string>>({});
    const [photoByAlias, setPhotoByAlias] = useState<Record<string, string>>({});
    const hasPhotoMaps = Object.keys(photoByJersey).length > 0 || Object.keys(photoByName).length > 0 || Object.keys(photoByAlias).length > 0;

    useEffect(() => {
        setActiveTab(defaultTab);
    }, [matchId, defaultTab]);

    useEffect(() => {
        if ((!homeIsFb && !awayIsFb) || hasPhotoMaps) return;

        let mounted = true;
        fetchSquad()
            .then((squad) => {
                if (!mounted) return;

                const nextJerseyMap = squad.reduce<Record<string, string>>((acc, player) => {
                    if (player.number != null && player.photo) {
                        acc[String(player.number)] = player.photo;
                    }
                    return acc;
                }, {});

                const nextNameMap = squad.reduce<Record<string, string>>((acc, player) => {
                    if (player.name && player.photo) {
                        acc[normalizeLookupKey(player.name)] = player.photo;
                    }
                    return acc;
                }, {});

                const aliasCounts = squad.reduce<Record<string, number>>((acc, player) => {
                    if (!player.name || !player.photo) return acc;
                    const seen = new Set<string>();
                    getLookupTokens(player.name).forEach((token) => {
                        if (seen.has(token)) return;
                        seen.add(token);
                        acc[token] = (acc[token] || 0) + 1;
                    });
                    return acc;
                }, {});

                const nextAliasMap = squad.reduce<Record<string, string>>((acc, player) => {
                    if (!player.name || !player.photo) return acc;
                    const seen = new Set<string>();
                    getLookupTokens(player.name).forEach((token) => {
                        if (seen.has(token) || aliasCounts[token] !== 1) return;
                        seen.add(token);
                        acc[token] = player.photo!;
                    });
                    return acc;
                }, {});

                setPhotoByJersey(nextJerseyMap);
                setPhotoByName(nextNameMap);
                setPhotoByAlias(nextAliasMap);
            })
            .catch((error) => {
                console.error('Lineup squad photo load error:', error);
            });

        return () => {
            mounted = false;
        };
    }, [awayIsFb, hasPhotoMaps, homeIsFb]);

    const tabs: { key: 'home' | 'away'; label: string }[] = homeIsFb
        ? [
            { key: 'home', label: localizedHomeName },
            { key: 'away', label: localizedAwayName }
        ]
        : awayIsFb
            ? [
                { key: 'away', label: localizedAwayName },
                { key: 'home', label: localizedHomeName }
            ]
            : [
                { key: 'home', label: localizedHomeName },
                { key: 'away', label: localizedAwayName }
            ];

    const activeLineup = activeTab === 'home' ? lineups.home : lineups.away;
    if (!activeLineup) return null;

    const activeTeamName = activeTab === 'home' ? homeName : awayName;
    const activeTeamIsFb = isFenerbahce(activeTeamName);
    const subOutByPlayer = new Map<string, string>();
    const subInByPlayer = new Map<string, string>();

    activeLineup.substitutions.forEach((sub) => {
        const formattedMinute = formatSoccerMinute(sub.minute);
        if (sub.playerOut) subOutByPlayer.set(normalizeLookupKey(sub.playerOut), formattedMinute);
        if (sub.playerIn) subInByPlayer.set(normalizeLookupKey(sub.playerIn), formattedMinute);
    });

    return (
        <div className="glass-panel rounded-xl p-4">
            <h4 className="mb-3 text-sm font-bold text-white">Kadro</h4>

            <div className="mb-4 flex rounded-lg bg-white/5 p-0.5">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
                            activeTab === tab.key
                                ? 'bg-yellow-400 text-black shadow-sm'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <MiniPitch
                lineup={activeLineup}
                isFenerbahceTeam={activeTeamIsFb}
                photoByJersey={photoByJersey}
                photoByName={photoByName}
                photoByAlias={photoByAlias}
                subOutByPlayer={subOutByPlayer}
            />

            {activeLineup.bench.length > 0 && (
                <div className="mt-4">
                    <p className="mb-2 text-xs font-bold text-slate-300">Yedekler</p>
                    <div className="space-y-1">
                        {activeLineup.bench.map((player, index) => {
                            const subInMinute = subInByPlayer.get(normalizeLookupKey(player.name));
                            return (
                                <div
                                    key={index}
                                    className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/5 py-1.5 text-[12px] last:border-b-0"
                                >
                                    <span className="w-7 text-center font-semibold text-yellow-300/80">
                                        {player.jersey || '-'}
                                    </span>
                                    <span className="text-slate-200">
                                        {localizePlayerName(player.name)}
                                    </span>
                                    {subInMinute && (
                                        <span className="inline-flex items-center gap-0.5 rounded-full border border-white/15 bg-slate-950/90 px-1.5 py-[2px] text-[9px] font-semibold text-emerald-300 shadow-sm">
                                            <svg viewBox="0 0 16 16" className="h-2 w-2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <path d="M2 11h9" />
                                                <path d="m8 8 3 3-3 3" />
                                            </svg>
                                            {subInMinute}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {activeLineup.substitutions.length > 0 && (
                <div className="mt-4">
                    <p className="mb-2 text-xs font-bold text-slate-300">{'De\u011fi\u015fiklikler'}</p>
                    <div className="space-y-1">
                        {activeLineup.substitutions.map((sub, index) => (
                            <div
                                key={index}
                                className="flex items-center gap-2 rounded-md bg-white/[0.03] px-2 py-1.5"
                            >
                                <span className="min-w-[2.1rem] shrink-0 rounded bg-white/[0.06] px-1 py-[1px] text-center font-mono text-[10px] font-semibold text-slate-300 tabular-nums">{formatSoccerMinute(sub.minute)}</span>
                                <span className="flex h-4 w-4 items-center justify-center">
                                    <MatchEventIcon event={{ isSubstitution: true }} className="h-4 w-3" />
                                </span>
                                <div className="min-w-0 flex-1 text-[12px] font-medium text-emerald-300/90">
                                    <span>{localizePlayerName(sub.playerIn)}</span>
                                    {sub.playerOut && (
                                        <span className="ml-1 inline-flex items-center gap-0.5 text-slate-500">
                                            <svg
                                                viewBox="0 0 16 16"
                                                className="h-2.5 w-2.5"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="1.6"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                aria-hidden="true"
                                            >
                                                <path d="M2 5h9" />
                                                <path d="m8 2 3 3-3 3" />
                                                <path d="M14 11H5" />
                                                <path d="m8 8-3 3 3 3" />
                                            </svg>
                                            <span>{localizePlayerName(sub.playerOut)}</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default MatchLineups;


