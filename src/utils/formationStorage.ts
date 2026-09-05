import { formations } from '../data/formations';
import type { FormationDraft, FormationDraftPlayer, FormationName, PitchPlayers } from '../types';

export const FORMATION_STORAGE_KEY = 'fenerbahce-fan-hub.formation.v1';

export const readFormationDraft = (): FormationDraft | null => {
    try {
        const value = JSON.parse(localStorage.getItem(FORMATION_STORAGE_KEY) || 'null');
        if (!value || !Object.prototype.hasOwnProperty.call(formations, value.formation) || !Array.isArray(value.players)) return null;
        const formation = value.formation as FormationName;
        const ids = new Set<number>();
        const slots = new Set<string>();
        const players = value.players.filter((player: FormationDraftPlayer) => {
            if (!player || !Object.prototype.hasOwnProperty.call(formations[formation], player.slot)
                || !Number.isSafeInteger(player.id) || player.id <= 0
                || typeof player.name !== 'string' || typeof player.position !== 'string'
                || !Number.isFinite(player.number) || ids.has(player.id) || slots.has(player.slot)) return false;
            ids.add(player.id);
            slots.add(player.slot);
            return true;
        });
        return { formation, players };
    } catch {
        return null;
    }
};

export const saveFormationDraft = (formation: FormationName, pitchPlayers: PitchPlayers): void => {
    try {
        const players = Object.entries(pitchPlayers)
            .filter(([slot]) => Object.prototype.hasOwnProperty.call(formations[formation], slot))
            .map(([slot, player]) => ({
                slot, id: player.id, name: player.name, position: player.position,
                number: Number(player.number) || 0,
            }));
        localStorage.setItem(FORMATION_STORAGE_KEY, JSON.stringify({ formation, players }));
    } catch {
        // Editing remains available when browser storage is unavailable or full.
    }
};
