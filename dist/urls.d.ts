import { TextByLanguage } from './text';
export { textDirection } from './languages';
export declare function urlForLanguage(language: string, path: string, defaultLanguage?: string): string;
export declare function htmlLangValue(language: string, defaultLanguage?: string): string;
export declare function languageUrls(path: string, languages: string[], defaultLanguage?: string): Record<string, string>;
export declare function translateFor(text: TextByLanguage, language: string): (key: string) => string;
