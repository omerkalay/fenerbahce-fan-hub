// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SubstitutionList from './SubstitutionList';

describe('SubstitutionList', () => {
    it('shows explicit incoming and outgoing player labels', () => {
        render(
            <SubstitutionList
                substitutions={[{
                    minute: '63',
                    playerIn: 'Youssef En-Nesyri',
                    playerOut: 'Jhon Durán',
                }]}
            />
        );

        expect(screen.getByText('Giren')).toBeInTheDocument();
        expect(screen.getByText('Çıkan')).toBeInTheDocument();
        expect(screen.getByText('Youssef En-Nesyri')).toBeInTheDocument();
        expect(screen.getByText('Jhon Durán')).toBeInTheDocument();
    });
});
