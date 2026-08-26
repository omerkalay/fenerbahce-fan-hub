// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PlayerPool from './PlayerPool';

describe('PlayerPool scrolling', () => {
    it('uses the parent page scroll without trapping touch or wheel input', () => {
        render(
            <PlayerPool
                squad={[]}
                loading={false}
                isTouchDevice={false}
                onDragStart={vi.fn()}
            />
        );

        const scrollRegion = screen.getByRole('heading', { name: 'Oyuncular' }).nextElementSibling;
        expect(scrollRegion).toHaveClass('touch-pan-y', 'pb-[calc(7rem+env(safe-area-inset-bottom))]');
        expect(scrollRegion).not.toHaveClass('overflow-y-auto', 'overscroll-contain', 'sm:overscroll-auto');
        expect(scrollRegion?.parentElement).not.toHaveClass('overflow-hidden');
    });
});
