#!/usr/bin/env node
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { translateCatalogue } from '../dist/batch.js';

const args = process.argv.slice(2);
const VALUE_FLAGS = new Set(['into', 'out', 'glossary', 'style', 'model', 'chunk', 'on-failure']);
const flags = {};
const positional = [];
for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (!a.startsWith('--')) {
    positional.push(a);
  } else if (VALUE_FLAGS.has(a.slice(2))) {
    flags[a.slice(2)] = args[i + 1];
    i += 1;
  } else {
    flags[a.slice(2)] = true;
  }
}
const flag = (name) => flags[name];
const has = (name) => flags[name] === true;
const target = positional[0];

if (!target || !flag('into') || !flag('out')) {
  console.error('Usage: translate-catalogue <english-catalogue.json | site-text-module> --into cy,pl,ro --out <dir> [--glossary glossary.json] [--style style.txt] [--model id] [--chunk 30] [--on-failure empty|english] [--dry-run]');
  console.error('A JSON file is a flat {key: "English phrase"} object. A module must export TEXT (with .en), MESSAGES (with .en) or a flat default object.');
  process.exit(2);
}

let source;
if (target.endsWith('.json')) {
  source = JSON.parse(readFileSync(resolve(target), 'utf8'));
} else {
  const mod = await import(pathToFileURL(resolve(target)).href);
  source = mod.TEXT?.en ?? mod.MESSAGES?.en ?? mod.default?.en ?? mod.default;
}
if (!source || typeof source !== 'object') {
  console.error(`FATAL: could not find an English catalogue in ${target}`);
  process.exit(2);
}

const glossary = flag('glossary') ? JSON.parse(readFileSync(resolve(flag('glossary')), 'utf8')) : undefined;
const style = flag('style') ? readFileSync(resolve(flag('style')), 'utf8').trim() : undefined;

const reports = await translateCatalogue({
  source,
  into: flag('into').split(',').map((s) => s.trim()).filter(Boolean),
  outDir: resolve(flag('out')),
  glossary,
  style,
  model: flag('model'),
  chunkSize: flag('chunk') ? Number(flag('chunk')) : undefined,
  onFailure: flag('on-failure') === 'english' ? 'english' : 'empty',
  dryRun: has('dry-run'),
});

const failed = reports.reduce((n, r) => n + r.empty, 0);
console.log(`\n${has('dry-run') ? 'DRY RUN' : 'DONE'}: ${reports.map((r) => `${r.language} ${r.translated}+${r.reused}${r.empty ? ` (${r.empty} failed)` : ''}`).join(', ')}`);
if (failed) {
  console.log(flag('on-failure') === 'english'
    ? `${failed} value(s) left in English; see <lang>.failed.json for a person to work through.`
    : `${failed} value(s) left empty; check-translations will fail until they are filled (see <lang>.failed.json).`);
  process.exit(flag('on-failure') === 'english' ? 0 : 1);
}
