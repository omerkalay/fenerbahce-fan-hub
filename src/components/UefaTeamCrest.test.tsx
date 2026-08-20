// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildEspnTeamLogoUrl } from '../utils/uefaTeamCrest';
import UefaTeamCrest from './UefaTeamCrest';

const team = {
    id: '393',
    name: 'Nottingham Forest',
    shortName: 'Nottm Forest',
    logo: 'https://example.com/forest.png',
};

describe('UefaTeamCrest', () => {
    it('builds the standard ESPN crest fallback from the team id', () => {
        expect(buildEspnTeamLogoUrl('8180')).toBe(
            'https://a.espncdn.com/i/teamlogos/soccer/500/8180.png'
        );
        expect(buildEspnTeamLogoUrl('')).toBeNull();
    });

    it('falls back from the supplied logo to ESPN CDN and then initials', () => {
        render(<UefaTeamCrest team={team} />);

        const suppliedLogo = screen.getByAltText('Nottm Forest logosu');
        expect(suppliedLogo).toHaveAttribute('src', team.logo);

        fireEvent.error(suppliedLogo);
        const espnFallback = screen.getByAltText('Nottm Forest logosu');
        expect(espnFallback).toHaveAttribute(
            'src',
            'https://a.espncdn.com/i/teamlogos/soccer/500/393.png'
        );

        fireEvent.error(espnFallback);
        expect(screen.getByText('NF')).toBeInTheDocument();
    });
});
