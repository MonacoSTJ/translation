"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateCatalogue = translateCatalogue;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const live_content_1 = require("./live-content");
const check_1 = require("./check");
const DEFAULT_MODEL = 'claude-haiku-4-5';
const DEFAULT_CHUNK = 30;
const hash = (text) => (0, crypto_1.createHash)('sha256').update(text).digest('hex').slice(0, 16);
const words = (text) => (text.trim() ? text.trim().split(/\s+/).length : 0);
function readJson(path, fallback) {
    if (!(0, fs_1.existsSync)(path))
        return fallback;
    try {
        return JSON.parse((0, fs_1.readFileSync)(path, 'utf8'));
    }
    catch {
        return fallback;
    }
}
function writeJson(path, value) {
    (0, fs_1.writeFileSync)(path, JSON.stringify(value, null, 2) + '\n');
}
function parseJsonObject(raw) {
    const stripped = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start)
        return null;
    try {
        const parsed = JSON.parse(stripped.slice(start, end + 1));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    }
    catch {
        return null;
    }
}
function acceptable(source, candidate) {
    if (typeof candidate !== 'string')
        return false;
    const value = candidate.trim();
    if (!value)
        return false;
    if (value.includes('—'))
        return false;
    return (0, check_1.placeholders)(value) === (0, check_1.placeholders)(source);
}
async function translateChunk(client, chunk, intoLanguage, options) {
    const system = [
        (0, live_content_1.buildSystemPrompt)(intoLanguage, options),
        'The user message is a JSON object whose values are English phrases from a website. Translate every value. Reply with ONLY a JSON object: the same keys, in the same order, each value the translation. Do not translate or alter the keys. Keep every {placeholder} token exactly as written, in braces, untranslated. Do not add keys, comments or code fences.',
    ].join('\n\n');
    try {
        const response = await client.messages.create({
            model: options.model ?? DEFAULT_MODEL,
            max_tokens: 8192,
            system,
            messages: [{ role: 'user', content: JSON.stringify(chunk, null, 2) }],
        });
        if (response.stop_reason === 'refusal')
            return null;
        const text = response.content
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
            .join('');
        return parseJsonObject(text);
    }
    catch (err) {
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
async function translateCatalogue(options) {
    const log = options.log ?? ((line) => console.log(line));
    const defaultLanguage = options.defaultLanguage ?? 'en';
    const chunkSize = Math.max(1, options.chunkSize ?? DEFAULT_CHUNK);
    const sourceKeys = Object.keys(options.source);
    (0, fs_1.mkdirSync)(options.outDir, { recursive: true });
    const client = options.client ?? (options.dryRun ? undefined : new sdk_1.default(options.apiKey ? { apiKey: options.apiKey } : {}));
    const reports = [];
    for (const language of options.into) {
        if (language === defaultLanguage)
            continue;
        const dictPath = (0, path_1.join)(options.outDir, `${language}.json`);
        const progressPath = (0, path_1.join)(options.outDir, `${language}.progress.json`);
        const failedPath = (0, path_1.join)(options.outDir, `${language}.failed.json`);
        const dict = readJson(dictPath, {});
        const progress = readJson(progressPath, {});
        const failed = [];
        for (const key of Object.keys(dict)) {
            if (!(key in options.source)) {
                delete dict[key];
                delete progress[key];
            }
        }
        // A value a person typed into <code>.json (no progress hash yet) is adopted,
        // not overwritten: a hand correction survives every later run.
        for (const key of sourceKeys) {
            if (dict[key] && progress[key] === undefined)
                progress[key] = hash(options.source[key]);
        }
        const pending = sourceKeys.filter((key) => {
            const current = hash(options.source[key]);
            return progress[key] !== current || !dict[key];
        });
        const report = {
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
            const chunk = Object.fromEntries(keys.map((key) => [key, options.source[key]]));
            report.calls += 1;
            const result = await translateChunk(client, chunk, language, options);
            for (const key of keys) {
                const source = options.source[key];
                let value = result && acceptable(source, result[key]) ? result[key].trim() : null;
                if (value === null) {
                    report.calls += 1;
                    const single = await (0, live_content_1.translateText)(source, language, { ...options, client });
                    value = single !== source && acceptable(source, single) ? single.trim() : null;
                }
                if (value === null) {
                    dict[key] = options.onFailure === 'english' ? source : '';
                    delete progress[key];
                    failed.push(key);
                    report.empty += 1;
                    log(`${language}: "${key}" ${options.onFailure === 'english' ? 'left in English' : 'left empty'} (placeholder or engine failure); listed in ${language}.failed.json`);
                }
                else {
                    dict[key] = value;
                    progress[key] = hash(source);
                    report.translated += 1;
                }
            }
            const ordered = {};
            for (const key of sourceKeys)
                if (key in dict)
                    ordered[key] = dict[key];
            writeJson(dictPath, ordered);
            writeJson(progressPath, progress);
            writeJson(failedPath, failed);
            log(`${language}: ${Math.min(i + chunkSize, pending.length)}/${pending.length} keys, ${report.calls} calls`);
        }
        if (!pending.length) {
            const ordered = {};
            for (const key of sourceKeys)
                if (key in dict)
                    ordered[key] = dict[key];
            writeJson(dictPath, ordered);
            writeJson(progressPath, progress);
            writeJson(failedPath, failed);
        }
        log(`${language}: done. ${report.translated} translated, ${report.reused} reused, ${report.empty} failed (${options.onFailure === 'english' ? 'in English' : 'empty'}), ${report.calls} calls`);
        reports.push(report);
    }
    return reports;
}
