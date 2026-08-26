import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Firebase Messaging service worker template', () => {
    it('registers the custom click handler before Firebase Messaging imports', () => {
        const template = readFileSync(new URL('../public/firebase-messaging-sw-template.js', import.meta.url), 'utf8');
        expect(template.indexOf("self.addEventListener('notificationclick'"))
            .toBeGreaterThan(-1);
        expect(template.indexOf("self.addEventListener('notificationclick'"))
            .toBeLessThan(template.indexOf("importScripts('https://www.gstatic.com/firebasejs/12.6.0/firebase-app-compat.js')"));
        expect(template).toContain("new Set(['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'])");
        expect(template).toContain("new Set(['instagram.com', 'www.instagram.com'])");
    });
});
