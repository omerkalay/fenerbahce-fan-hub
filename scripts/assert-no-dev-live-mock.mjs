import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIST_DIRECTORY = new URL('../dist/', import.meta.url);
const FORBIDDEN_MARKERS = [
  'mockLive',
  'data-dev-live-simulator',
  'Canlı Maç Simülatörü',
  'Yazmalar Kapalı',
  'partial-data',
  'adminStatusPreview',
  'Yerel önizleme — Firebase’e yazılmaz',
];

const collectFiles = async (directoryUrl) => {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryUrl = new URL(entry.name, directoryUrl);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(new URL(`${entry.name}/`, directoryUrl)));
    } else if (/\.(?:html|js|css|json|webmanifest)$/.test(entry.name)) {
      files.push(entryUrl);
    }
  }

  return files;
};

const files = await collectFiles(DIST_DIRECTORY);
const violations = [];

for (const fileUrl of files) {
  const contents = await readFile(fileUrl, 'utf8');
  for (const marker of FORBIDDEN_MARKERS) {
    if (contents.includes(marker)) {
      violations.push(`${join('dist', fileUrl.pathname.split('/dist/')[1])}: ${marker}`);
    }
  }
}

if (violations.length > 0) {
  throw new Error(`Production output contains development-only preview markers:\n${violations.join('\n')}`);
}

console.log('Production output excludes development-only preview tools.');
