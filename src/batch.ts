import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { buildSystemPrompt, translateText, TranslateOptions } from './live-content';
import { placeholders } from './check';
import { Phrases } from './text';

const DEFAULT_MODEL = 'claude-haiku-4-5';
const DEFAULT_CHUNK = 30;

export type CatalogueOptions = TranslateOptions & {
  source: Phrases;
  into: string[];
  outDir: string;
  chunkSize?: number;
  dryRun?: boolean;
  log?: (line: string) => void;
};

export type LanguageReport = {
  language: string;
  keys: number;
  words: number;
  reused: number;
  translated: number;
  empty: number;
  calls: number;
};

type Progress = Record<string, string>;

const hash = (text: string): string => createHash('sha256').update(text).digest('hex').slice(0, 16);

const words = (text: string): number => (text.trim() ? text.trim().split(/\s+/).length : 0);

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const stripped = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function acceptable(source: string, candidate: unknown): candidate is string {
  if (typeof candidate !== 'string') return false;
  const value = candidate.trim();
  if (!value) return false;
  if (value.includes('—')) return false;
  return placeholders(value) === placeholders(source);
}

async function translateChunk(
  client: Anthropic,
  chunk: Phrases,
  intoLanguage: string,
  options: TranslateOptions,
): Promise<Record<string, unknown> | null> {
  const system = [
    buildSystemPrompt(intoLanguage, options),
    'The user message is a JSON object whose values are English phrases from a website. Translate every value. Reply with ONLY a JSON object: the same keys, in the same order, each value the translation. Do not translate or alter the keys. Keep every {placeholder} token exactly as written, in braces, untranslated. Do not add keys, comments or code fences.',
  ].join('\n\n');
  try {
    const response = await client.messages.create({
      model: options.model ?? DEFAULT_MODEL,
      max_tokens: 8192,
      system,
      messages: [{ role: 'user', content: JSON.stringify(chunk, null, 2) }],
    });
    if ((response.stop_reason as string) === 'refusal') return null;
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
    return parseJsonObject(text);
  } catch (err: any) {
    console.error(`[translation] catalogue chunk into ${intoLanguage} failed:`, err?.message ?? err);
    return null;
  }
}

/**
 * Translate a whole catalogue (the site's English phrases) into each language,
 * one JSON file per language in outDir, resumable. A key is sent again only when
 * its English text has changed since it was last translated (tracked by hash in
 * <code>.progress.json). A value that fails the placeholder check after one
 * retry is written as an empty string, so check-translations fails the deploy
 * instead of the site shipping a broken phrase.
 */
export async function translateCatalogue(options: CatalogueOptions): Promise<LanguageReport[]> {
  const log = options.log ?? ((line: string) => console.log(line));
  const defaultLanguage = options.defaultLanguage ?? 'en';
  const chunkSize = Math.max(1, options.chunkSize ?? DEFAULT_CHUNK);
  const sourceKeys = Object.keys(options.source);
  mkdirSync(options.outDir, { recursive: true });

  const client = options.client ?? (options.dryRun ? undefined : new Anthropic(options.apiKey ? { apiKey: options.apiKey } : {}));
  const reports: LanguageReport[] = [];

  for (const language of options.into) {
    if (language === defaultLanguage) continue;
    const dictPath = join(options.outDir, `${language}.json`);
    const progressPath = join(options.outDir, `${language}.progress.json`);
    const dict = readJson<Phrases>(dictPath, {});
    const progress = readJson<Progress>(progressPath, {});

    for (const key of Object.keys(dict)) {
      if (!(key in options.source)) {
        delete dict[key];
        delete progress[key];
      }
    }

    const pending = sourceKeys.filter((key) => {
      const current = hash(options.source[key]);
      return progress[key] !== current || !dict[key];
    });
    const report: LanguageReport = {
      language,
      keys: pending.length,
      words: pending.reduce((n, key) => n + words(options.source[key]), 0),
      reused: sourceKeys.length - pending.length,
      translated: 0,
      empty: 0,
      calls: 0,
    };

    if (options.dryRun || !client) {
      log(`${language}: ${report.keys} of ${sourceKeys.length} keys to translate (${report.words} words), ${report.reused} reused`);
      reports.push(report);
      continue;
    }

    for (let i = 0; i < pending.length; i += chunkSize) {
      const keys = pending.slice(i, i + chunkSize);
      const chunk: Phrases = Object.fromEntries(keys.map((key) => [key, options.source[key]]));
      report.calls += 1;
      const result = await translateChunk(client, chunk, language, options);

      for (const key of keys) {
        const source = options.source[key];
        let value: string | null = result && acceptable(source, result[key]) ? (result[key] as string).trim() : null;
        if (value === null) {
          report.calls += 1;
          const single = await translateText(source, language, { ...options, client });
          value = single !== source && acceptable(source, single) ? single.trim() : null;
        }
        if (value === null) {
          dict[key] = '';
          delete progress[key];
          report.empty += 1;
          log(`${language}: "${key}" left empty (placeholder or engine failure); fix by hand or re-run`);
        } else {
          dict[key] = value;
          progress[key] = hash(source);
          report.translated += 1;
        }
      }

      const ordered: Phrases = {};
      for (const key of sourceKeys) if (key in dict) ordered[key] = dict[key];
      writeJson(dictPath, ordered);
      writeJson(progressPath, progress);
      log(`${language}: ${Math.min(i + chunkSize, pending.length)}/${pending.length} keys, ${report.calls} calls`);
    }

    if (!pending.length) {
      const ordered: Phrases = {};
      for (const key of sourceKeys) if (key in dict) ordered[key] = dict[key];
      writeJson(dictPath, ordered);
      writeJson(progressPath, progress);
    }
    log(`${language}: done. ${report.translated} translated, ${report.reused} reused, ${report.empty} empty, ${report.calls} calls`);
    reports.push(report);
  }

  return reports;
}
