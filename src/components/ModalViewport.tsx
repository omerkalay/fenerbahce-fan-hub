import { useLayoutEffect, useRef, type HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';

/** Keep dialogs outside transformed/blurred ancestors and inside the visible safe area. */
export default function ModalViewport({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
    const ref = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const viewport = window.visualViewport;
        if (!viewport) return;
        const update = () => {
            ref.current?.style.setProperty('--modal-height', `${viewport.height}px`);
            ref.current?.style.setProperty('--modal-top', `${viewport.offsetTop}px`);
        };
        update();
        viewport.addEventListener('resize', update);
        viewport.addEventListener('scroll', update);
        return () => {
            viewport.removeEventListener('resize', update);
            viewport.removeEventListener('scroll', update);
        };
    }, []);

    return createPortal(
        <div {...props} ref={ref} className={`modal-viewport ${className}`}>{children}</div>,
        document.body,
    );
}
