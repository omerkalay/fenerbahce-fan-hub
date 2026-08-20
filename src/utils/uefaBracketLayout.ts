import type { UefaBracket, UefaBracketTie } from '../types';

export const UEFA_BRACKET_STAGE_SPECS = [
    { key: 'knockout-playoff', label: 'Eleme Play-off’u', slotCount: 8 },
    { key: 'round-of-16', label: 'Son 16', slotCount: 8 },
    { key: 'quarterfinals', label: 'Çeyrek Final', slotCount: 4 },
    { key: 'semifinals', label: 'Yarı Final', slotCount: 2 },
    { key: 'final', label: 'Final', slotCount: 1 },
] as const;

export const BRACKET_MAX_SLOTS = 8;

export interface UefaBracketDensity {
    cardHeight: number;
    slotPitch: number;
    columnWidth: number;
    columnGap: number;
    canvasPadding: number;
    headerHeight: number;
}

export const UEFA_BRACKET_DENSITIES = {
    mobile: {
        cardHeight: 60,
        slotPitch: 74,
        columnWidth: 142,
        columnGap: 36,
        canvasPadding: 6,
        headerHeight: 34,
    },
    desktop: {
        cardHeight: 86,
        slotPitch: 106,
        columnWidth: 184,
        columnGap: 64,
        canvasPadding: 14,
        headerHeight: 44,
    },
} as const satisfies Record<string, UefaBracketDensity>;

export interface UefaBracketStageLayout {
    key: typeof UEFA_BRACKET_STAGE_SPECS[number]['key'];
    label: string;
    slotCount: number;
    ties: Array<UefaBracketTie | null>;
}

const sortTiesForLayout = (ties: UefaBracketTie[]): UefaBracketTie[] => [...ties].sort((first, second) => {
    const firstDate = new Date(first.legs[0]?.date || 0).getTime();
    const secondDate = new Date(second.legs[0]?.date || 0).getTime();
    if (firstDate !== secondDate) return firstDate - secondDate;
    return first.id.localeCompare(second.id);
});

export const buildBracketLayout = (bracket: UefaBracket | null): UefaBracketStageLayout[] => {
    const publishedStages = new Map((bracket?.stages || []).map((stage) => [stage.key, stage]));
    const layouts = UEFA_BRACKET_STAGE_SPECS.map((spec) => ({
        ...spec,
        ties: Array<UefaBracketTie | null>(spec.slotCount).fill(null),
    }));

    for (let stageIndex = layouts.length - 1; stageIndex >= 0; stageIndex -= 1) {
        const layout = layouts[stageIndex];
        const publishedTies = sortTiesForLayout(publishedStages.get(layout.key)?.ties || []);
        const nextLayout = layouts[stageIndex + 1] || null;
        const unplaced: UefaBracketTie[] = [];

        for (const tie of publishedTies) {
            if (!nextLayout || !tie.nextTieId) {
                unplaced.push(tie);
                continue;
            }

            const targetSlotIndex = nextLayout.ties.findIndex((candidate) => candidate?.id === tie.nextTieId);
            if (targetSlotIndex < 0) {
                unplaced.push(tie);
                continue;
            }

            const firstLinkedSlot = Math.floor(targetSlotIndex * layout.slotCount / nextLayout.slotCount);
            const lastLinkedSlot = Math.max(
                firstLinkedSlot,
                Math.floor((targetSlotIndex + 1) * layout.slotCount / nextLayout.slotCount) - 1
            );
            const availableSlot = layout.ties.findIndex((candidate, index) => (
                candidate === null && index >= firstLinkedSlot && index <= lastLinkedSlot
            ));

            if (availableSlot >= 0) layout.ties[availableSlot] = tie;
            else unplaced.push(tie);
        }

        for (const tie of unplaced) {
            const availableSlot = layout.ties.findIndex((candidate) => candidate === null);
            if (availableSlot < 0) break;
            layout.ties[availableSlot] = tie;
        }
    }

    return layouts;
};

export const getBracketCanvasHeight = (density: UefaBracketDensity): number => (
    density.canvasPadding * 2
    + (BRACKET_MAX_SLOTS - 1) * density.slotPitch
    + density.cardHeight
);

export const getBracketCanvasWidth = (density: UefaBracketDensity): number => (
    UEFA_BRACKET_STAGE_SPECS.length * density.columnWidth
    + (UEFA_BRACKET_STAGE_SPECS.length - 1) * density.columnGap
);

export const getBracketColumnLeft = (stageIndex: number, density: UefaBracketDensity): number => (
    stageIndex * (density.columnWidth + density.columnGap)
);

export const getBracketSlotTop = (
    slotIndex: number,
    slotCount: number,
    density: UefaBracketDensity
): number => {
    const baseSlotIndex = ((slotIndex + 0.5) * BRACKET_MAX_SLOTS / slotCount) - 0.5;
    return density.canvasPadding + baseSlotIndex * density.slotPitch;
};
