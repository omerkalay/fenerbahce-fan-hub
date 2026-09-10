// @vitest-environment happy-dom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ModalViewport from './ModalViewport';

afterEach(() => vi.unstubAllGlobals());

describe('ModalViewport', () => {
    it('escapes clipped ancestors and keeps close controls working', () => {
        const close = vi.fn();
        const { container, unmount } = render(
            <div style={{ overflow: 'hidden', transform: 'translateY(-200px)' }}>
                <ModalViewport role="dialog" aria-label="Test paneli">
                    <div><button onClick={close} aria-label="Kapat">×</button></div>
                </ModalViewport>
            </div>,
        );
        const dialog = screen.getByRole('dialog');
        expect(dialog.parentElement).toBe(document.body);
        expect(container.contains(dialog)).toBe(false);
        fireEvent.click(screen.getByRole('button', { name: 'Kapat' }));
        expect(close).toHaveBeenCalledOnce();
        unmount();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('follows the visible viewport when the keyboard opens and removes listeners', () => {
        const viewport = Object.assign(new EventTarget(), { height: 852, offsetTop: 0 });
        const remove = vi.spyOn(viewport, 'removeEventListener');
        vi.stubGlobal('visualViewport', viewport);
        const { unmount } = render(<ModalViewport role="dialog"><div>İçerik</div></ModalViewport>);
        const backdrop = screen.getByRole('dialog');
        const dialog = backdrop.firstElementChild as HTMLElement;
        expect(backdrop.style.getPropertyValue('--modal-height')).toBe('');
        expect(dialog.style.getPropertyValue('--modal-height')).toBe('852px');
        act(() => {
            viewport.height = 420;
            viewport.offsetTop = 30;
            viewport.dispatchEvent(new Event('resize'));
        });
        expect(dialog.style.getPropertyValue('--modal-height')).toBe('420px');
        expect(dialog.style.getPropertyValue('--modal-top')).toBe('30px');
        expect(backdrop.style.getPropertyValue('--modal-top')).toBe('');
        unmount();
        expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
        expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
    });
});
