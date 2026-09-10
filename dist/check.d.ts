import { TextByLanguage } from './text';
export declare const placeholders: (value: string) => string;
export type CheckResult = {
    errors: string[];
    warnings: string[];
};
export declare function checkTranslations(text: TextByLanguage, languages: string[], options?: {
    defaultLanguage?: string;
}): CheckResult;
