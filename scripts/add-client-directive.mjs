import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const file = join(dir, '..', 'dist', 'index.js');
const source = readFileSync(file, 'utf8');
if (!source.startsWith("'use client';")) {
  writeFileSync(file, `'use client';\n${source}`);
}
