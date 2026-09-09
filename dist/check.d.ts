import { TextByLanguage } from './text';
export type CheckResult = {
    errors: string[];
    warnings: string[];
};
export declare function checkTranslations(text: TextByLanguage, languages: string[], options?: {
    defaultLanguage?: string;
}): CheckResult;
