#!/usr/bin/env node
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { checkTranslations } from '../src/check.ts';

const target = process.argv[2];
const strict = process.argv.includes('--strict');
if (!target) {
  console.error('Usage: check-translations <path-to-site-text-module> [--strict]');
  console.error('The module must export TEXT and LANGUAGES (an array of codes, or of { code }).');
  process.exit(2);
}

const mod = await import(pathToFileURL(resolve(target)).href);
const text = mod.TEXT ?? mod.default?.TEXT;
const rawLanguages = mod.LANGUAGES ?? mod.default?.LANGUAGES;
if (!text || !rawLanguages) {
  console.error(`FATAL: ${target} must export TEXT and LANGUAGES`);
  process.exit(2);
}
const languages = rawLanguages.map((l) => (typeof l === 'string' ? l : l.code));

const { errors, warnings } = checkTranslations(text, languages);
const keyCount = Object.keys(text.en ?? {}).length;
console.log(`translation check: ${keyCount} keys x ${languages.length} languages`);
if (warnings.length) {
  console.log(`\nWARNINGS (${warnings.length}):`);
  warnings.forEach((w) => console.log('  ! ' + w));
}
if (errors.length) {
  console.log(`\nERRORS (${errors.length}):`);
  errors.forEach((e) => console.log('  x ' + e));
}
if (errors.length || (strict && warnings.length)) {
  console.log('\nFAILED');
  process.exit(1);
}
console.log(errors.length + warnings.length === 0 ? '\nOK' : '\nOK (warnings only)');
