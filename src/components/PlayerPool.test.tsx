// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PlayerPool from './PlayerPool';

describe('PlayerPool scrolling', () => {
    it('keeps contained mobile scrolling but releases desktop wheel scrolling', () => {
        render(
            <PlayerPool
                squad={[]}
                loading={false}
                isTouchDevice={false}
                onDragStart={vi.fn()}
            />
        );

        const scrollRegion = screen.getByRole('heading', { name: 'Oyuncular' }).nextElementSibling;
        expect(scrollRegion).toHaveClass('overscroll-contain', 'sm:overscroll-auto');
    });
});
