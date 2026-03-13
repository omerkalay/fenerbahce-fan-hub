import { useEffect } from 'react';

const useBodyScrollLock = (locked: boolean): void => {
    useEffect(() => {
        if (locked) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [locked]);
};

export default useBodyScrollLock;
