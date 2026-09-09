export type Phrases = Record<string, string>;
export type TextByLanguage = Record<string, Phrases>;
export declare function translate(text: TextByLanguage, language: string, key: string): string;
export declare function translationProgress(text: TextByLanguage, languages: string[], defaultLanguage?: string): {
    code: string;
    done: number;
    of: number;
}[];
