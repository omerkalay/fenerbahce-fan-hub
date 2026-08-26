import { describe, expect, it } from 'vitest';
import { resolveNotificationTarget } from './notificationLinks';

const ORIGIN = 'https://omerkalay.com';

describe('notification link policy', () => {
    it.each([
        'https://omerkalay.com/fenerbahce-fan-hub/',
        'https://x.com/Fenerbahce',
        'https://x.com/Fenerbahce/status/123456',
        'https://www.instagram.com/fenerbahce/',
        'https://www.instagram.com/p/ABC_123/',
        'https://instagram.com/reel/ABC-123/'
    ])('accepts a trusted notification link: %s', (url) => {
        expect(resolveNotificationTarget(url, ORIGIN).url).toBe(url);
    });

    it.each([
        'http://x.com/Fenerbahce/status/123',
        'https://x.com/another/status/123',
        'https://x.com.evil.example/Fenerbahce/status/123',
        'https://instagram.com.evil.example/p/ABC/',
        'https://instagram.com/fenerbahce/untrusted',
        'https://instagram.com/p/ABC/untrusted',
        'https://user:pass@x.com/Fenerbahce/status/123',
        'javascript:alert(1)'
    ])('falls back for an untrusted notification link: %s', (url) => {
        expect(resolveNotificationTarget(url, ORIGIN)).toEqual({
            url: 'https://omerkalay.com/fenerbahce-fan-hub/',
            external: false
        });
    });

    it('marks trusted social links as external', () => {
        expect(resolveNotificationTarget('https://x.com/Fenerbahce/status/123', ORIGIN).external).toBe(true);
        expect(resolveNotificationTarget('https://instagram.com/p/ABC/', ORIGIN).external).toBe(true);
    });
});
