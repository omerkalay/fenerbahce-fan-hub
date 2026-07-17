import { describe, it, expect } from 'vitest';
import {
    localizeTeamName,
    localizeCompetitionName,
    localizeCompetitionStage,
} from './localize';

describe('localizeTeamName', () => {
    it('converts ASCII Fenerbahce to proper Turkish', () => {
        expect(localizeTeamName('Fenerbahce')).toBe('Fenerbahçe');
    });

    it('converts Besiktas with correct diacritics', () => {
        expect(localizeTeamName('Besiktas')).toBe('Beşiktaş');
    });

    it('converts Istanbul Basaksehir', () => {
        expect(localizeTeamName('Istanbul Basaksehir')).toBe('İstanbul Başakşehir');
    });

    it('converts Kasimpasa', () => {
        expect(localizeTeamName('Kasimpasa')).toBe('Kasımpaşa');
    });

    it('converts Ankaragucu', () => {
        expect(localizeTeamName('Ankaragucu')).toBe('Ankaragücü');
    });

    it('converts Eyupspor', () => {
        expect(localizeTeamName('Eyupspor')).toBe('Eyüpspor');
    });

    it('converts Caykur Rizespor', () => {
        expect(localizeTeamName('Caykur Rizespor')).toBe('Çaykur Rizespor');
    });

    it('is case insensitive', () => {
        expect(localizeTeamName('FENERBAHCE')).toBe('Fenerbahçe');
        expect(localizeTeamName('besiktas')).toBe('Beşiktaş');
    });

    it('leaves already-correct names unchanged', () => {
        expect(localizeTeamName('Trabzonspor')).toBe('Trabzonspor');
        expect(localizeTeamName('Galatasaray')).toBe('Galatasaray');
    });

    it('handles empty and undefined inputs', () => {
        expect(localizeTeamName('')).toBe('');
        expect(localizeTeamName()).toBe('');
    });

    it('localizes team name within a longer string', () => {
        expect(localizeTeamName('Fenerbahce vs Besiktas')).toBe('Fenerbahçe vs Beşiktaş');
    });
});

describe('localizeCompetitionName', () => {
    it('converts Turkish Super Lig', () => {
        expect(localizeCompetitionName('Turkish Super Lig')).toBe('Süper Lig');
    });

    it('converts Super Lig alone', () => {
        expect(localizeCompetitionName('Super Lig')).toBe('Süper Lig');
    });

    it('converts UEFA Europa League', () => {
        expect(localizeCompetitionName('UEFA Europa League')).toBe('UEFA Avrupa Ligi');
    });

    it('converts UEFA Champions League', () => {
        expect(localizeCompetitionName('UEFA Champions League')).toBe('UEFA Şampiyonlar Ligi');
    });

    it('converts Matchday to Hafta format', () => {
        expect(localizeCompetitionName('Matchday 15')).toBe('15. Hafta');
        expect(localizeCompetitionName('Matchday 1')).toBe('1. Hafta');
    });

    it('converts Group letters', () => {
        expect(localizeCompetitionName('Group A')).toBe('Grup A');
        expect(localizeCompetitionName('Group F')).toBe('Grup F');
    });

    it('converts League Phase', () => {
        expect(localizeCompetitionName('League Phase')).toBe('Lig Aşaması');
    });

    it('converts knockout rounds', () => {
        expect(localizeCompetitionName('Knockout Round Playoffs')).toBe('Eleme Turu Play-off');
        expect(localizeCompetitionName('Round of 16')).toBe('Son 16');
        expect(localizeCompetitionName('Quarter-finals')).toBe('Çeyrek Final');
        expect(localizeCompetitionName('Semi-finals')).toBe('Yarı Final');
    });

    it('converts qualification and preliminary round variants', () => {
        expect(localizeCompetitionName('Qualification Round 2')).toBe('2. Ön Eleme Turu');
        expect(localizeCompetitionName('3rd Qualifying Round')).toBe('3. Ön Eleme Turu');
        expect(localizeCompetitionName('Preliminary Round')).toBe('Ön Eleme Turu');
        expect(localizeCompetitionName('Qualification')).toBe('Ön Eleme');
    });

    it('normalizes playoff variants without translating the term', () => {
        expect(localizeCompetitionName('Playoff Round')).toBe('Play-off');
        expect(localizeCompetitionName('Play-offs')).toBe('Play-off');
    });

    it('converts Turkish Cup variants', () => {
        expect(localizeCompetitionName('Turkish Cup')).toBe('Türkiye Kupası');
        expect(localizeCompetitionName('Turkey Cup')).toBe('Türkiye Kupası');
    });

    it('converts club friendly variants', () => {
        expect(localizeCompetitionName('Club Friendly Games')).toBe('Hazırlık Maçı');
        expect(localizeCompetitionName('Club Friendly')).toBe('Hazırlık Maçı');
        expect(localizeCompetitionName('Club Friendlies')).toBe('Hazırlık Maçı');
    });

    it('handles empty and undefined inputs', () => {
        expect(localizeCompetitionName('')).toBe('');
        expect(localizeCompetitionName()).toBe('');
    });
});

describe('localizeCompetitionStage', () => {
    it('uses the structured SofaScore round number for qualification matches', () => {
        expect(localizeCompetitionStage({
            name: 'Qualification Round 2',
            slug: 'qualification-round-2',
            round: 2,
            qualificationOrPreliminary: true,
        })).toBe('2. Ön Eleme Turu');
    });

    it('supports future third qualifying round variants', () => {
        expect(localizeCompetitionStage({ name: '3rd Qualifying Round' })).toBe('3. Ön Eleme Turu');
        expect(localizeCompetitionStage({ name: 'Third Qualifying Round' })).toBe('3. Ön Eleme Turu');
    });

    it('keeps playoff as Play-off across source variants', () => {
        expect(localizeCompetitionStage({ name: 'Playoff Round', round: 4 })).toBe('Play-off');
        expect(localizeCompetitionStage({ slug: 'qualification-play-offs', round: 4 })).toBe('Play-off');
    });

    it('falls back to the structured round when the source omits a stage name', () => {
        expect(localizeCompetitionStage({
            round: 2,
            qualificationOrPreliminary: true,
        })).toBe('2. Ön Eleme Turu');
    });
});
