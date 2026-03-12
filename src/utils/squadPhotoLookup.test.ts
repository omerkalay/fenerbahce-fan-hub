import { describe, it, expect } from 'vitest';
import { normalizeLookupKey, buildSquadPhotoMaps, findPlayerPhoto } from './squadPhotoLookup';
import type { Player } from '../types';

describe('normalizeLookupKey', () => {
    it('lowercases and strips diacritics', () => {
        expect(normalizeLookupKey('Fenerbahçe')).toBe('fenerbahce');
    });

    it('trims and collapses whitespace', () => {
        expect(normalizeLookupKey('  Edin   Dzeko  ')).toBe('edin dzeko');
    });

    it('handles empty input', () => {
        expect(normalizeLookupKey('')).toBe('');
    });

    it('applies player name overrides before normalizing', () => {
        // "Munir Mercan" is overridden to "Levent Mercan" in playerDisplay
        const key = normalizeLookupKey('Munir Mercan');
        expect(key).toBe('levent mercan');
    });
});

describe('buildSquadPhotoMaps', () => {
    const squad: Player[] = [
        { name: 'Edin Dzeko', number: 17, photo: '/photos/dzeko.jpg', position: 'FW' },
        { name: 'Dominik Livakovic', number: 40, photo: '/photos/livakovic.jpg', position: 'GK' },
        { name: 'No Photo Player', number: 99, photo: '', position: 'MF' },
    ] as Player[];

    it('builds byJersey map from number to photo', () => {
        const maps = buildSquadPhotoMaps(squad);
        expect(maps.byJersey['17']).toBe('/photos/dzeko.jpg');
        expect(maps.byJersey['40']).toBe('/photos/livakovic.jpg');
    });

    it('excludes players without photo from byJersey', () => {
        const maps = buildSquadPhotoMaps(squad);
        expect(maps.byJersey['99']).toBeUndefined();
    });

    it('builds byName map with normalized keys', () => {
        const maps = buildSquadPhotoMaps(squad);
        expect(maps.byName['edin dzeko']).toBe('/photos/dzeko.jpg');
        expect(maps.byName['dominik livakovic']).toBe('/photos/livakovic.jpg');
    });

    it('builds byAlias map for unique name tokens', () => {
        const maps = buildSquadPhotoMaps(squad);
        // "dzeko" is unique across the squad
        expect(maps.byAlias['dzeko']).toBe('/photos/dzeko.jpg');
        // "livakovic" is unique
        expect(maps.byAlias['livakovic']).toBe('/photos/livakovic.jpg');
    });

    it('handles empty squad', () => {
        const maps = buildSquadPhotoMaps([]);
        expect(Object.keys(maps.byJersey)).toHaveLength(0);
        expect(Object.keys(maps.byName)).toHaveLength(0);
        expect(Object.keys(maps.byAlias)).toHaveLength(0);
    });
});

describe('findPlayerPhoto', () => {
    const squad: Player[] = [
        { name: 'Edin Dzeko', number: 17, photo: '/photos/dzeko.jpg', position: 'FW' },
        { name: 'Dominik Livakovic', number: 40, photo: '/photos/livakovic.jpg', position: 'GK' },
        { name: 'Mert Muldur', number: 16, photo: '/photos/muldur.jpg', position: 'DF' },
    ] as Player[];

    const maps = buildSquadPhotoMaps(squad);

    it('finds by jersey number (highest priority)', () => {
        expect(findPlayerPhoto('Wrong Name', 17, maps)).toBe('/photos/dzeko.jpg');
    });

    it('finds by exact name match', () => {
        expect(findPlayerPhoto('Edin Dzeko', null, maps)).toBe('/photos/dzeko.jpg');
    });

    it('finds by alias token (partial name)', () => {
        expect(findPlayerPhoto('Dzeko', null, maps)).toBe('/photos/dzeko.jpg');
    });

    it('returns null when no match found', () => {
        expect(findPlayerPhoto('Unknown Player', null, maps)).toBeNull();
    });

    it('prefers jersey over name', () => {
        // Jersey 17 = Dzeko, but name says Livakovic
        expect(findPlayerPhoto('Dominik Livakovic', 17, maps)).toBe('/photos/dzeko.jpg');
    });
});
