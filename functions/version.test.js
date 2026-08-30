import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const rootPackage = require('../package.json');
const functionsPackage = require('./package.json');

describe('release version metadata', () => {
    it('keeps frontend and Cloud Functions versions synchronized', () => {
        expect(rootPackage.version).toBe('2.18.0');
        expect(functionsPackage.version).toBe(rootPackage.version);
    });
});
