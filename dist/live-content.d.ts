import Anthropic from '@anthropic-ai/sdk';
export type TranslateOptions = {
    apiKey?: string;
    client?: Anthropic;
    model?: string;
    glossary?: Record<string, string>;
    style?: string;
    defaultLanguage?: string;
};
export declare function buildSystemPrompt(intoLanguage: string, options: TranslateOptions): string;
export declare function translateText(text: string, intoLanguage: string, options?: TranslateOptions): Promise<string>;
export type RunQuery = <T = any>(sql: string, params: any[]) => Promise<T[]>;
type ContentRef = {
    contentType: string;
    contentId: string;
    field: string;
    intoLanguage: string;
};
export declare function getTranslation(run: RunQuery, ref: ContentRef): Promise<{
    sourceText: string;
    translatedText: string;
} | null>;
export declare function saveTranslation(run: RunQuery, ref: ContentRef, sourceText: string, translatedText: string, engine: string): Promise<void>;
export declare function translateAndStore(run: RunQuery, params: ContentRef & {
    text: string;
} & TranslateOptions): Promise<string>;
export {};
