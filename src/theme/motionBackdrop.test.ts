import { describe, expect, it } from 'vitest';
import {
    DEFAULT_MOTION_BACKDROP,
    loadMotionBackdrop,
    MOTION_BACKDROP_STORAGE_KEY,
    persistMotionBackdrop,
} from './motionBackdrop';

const fakeStorage = (initial?: string) => {
    const store = new Map<string, string>();
    if (initial !== undefined) store.set(MOTION_BACKDROP_STORAGE_KEY, initial);
    return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => { store.set(key, value); },
        read: () => store.get(MOTION_BACKDROP_STORAGE_KEY),
    };
};

const throwingStorage = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
};

describe('motion backdrop preference', () => {
    it('defaults to on when nothing has been saved', () => {
        expect(loadMotionBackdrop(fakeStorage())).toBe(DEFAULT_MOTION_BACKDROP);
        expect(DEFAULT_MOTION_BACKDROP).toBe(true);
    });

    it('reads both saved values', () => {
        expect(loadMotionBackdrop(fakeStorage('off'))).toBe(false);
        expect(loadMotionBackdrop(fakeStorage('on'))).toBe(true);
    });

    it('falls back to the default for anything unrecognised', () => {
        expect(loadMotionBackdrop(fakeStorage('maybe'))).toBe(true);
    });

    it('stays on the default without storage, or when storage throws', () => {
        expect(loadMotionBackdrop()).toBe(true);
        expect(loadMotionBackdrop(throwingStorage)).toBe(true);
    });

    it('writes the preference and reports whether it stuck', () => {
        const storage = fakeStorage();
        expect(persistMotionBackdrop(false, storage)).toBe(true);
        expect(storage.read()).toBe('off');
        expect(persistMotionBackdrop(true, storage)).toBe(true);
        expect(storage.read()).toBe('on');
        expect(persistMotionBackdrop(false)).toBe(false);
        expect(persistMotionBackdrop(false, throwingStorage)).toBe(false);
    });
});
