import { TranslateOptions } from './live-content';
import { Phrases } from './text';
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
/**
 * Translate a whole catalogue (the site's English phrases) into each language,
 * one JSON file per language in outDir, resumable. A key is sent again only when
 * its English text has changed since it was last translated (tracked by hash in
 * <code>.progress.json). A value that fails the placeholder check after one
 * retry is written as an empty string, so check-translations fails the deploy
 * instead of the site shipping a broken phrase.
 */
export declare function translateCatalogue(options: CatalogueOptions): Promise<LanguageReport[]>;
