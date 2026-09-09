import { TextByLanguage } from './text';
export declare function getServerLanguage(languages: string[], options?: {
    useBrowserPreference?: boolean;
    defaultLanguage?: string;
}): Promise<string>;
export declare function getServerTranslate(text: TextByLanguage, languages: string[], options?: {
    useBrowserPreference?: boolean;
    defaultLanguage?: string;
}): Promise<(key: string) => string>;
