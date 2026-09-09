export type Language = {
    code: string;
    name: string;
    nativeName: string;
    flag: string;
    rightToLeft: boolean;
};
export declare const LANGUAGES: Language[];
export declare const DEFAULT_LANGUAGE = "en";
export declare const LANGUAGE_CODES: string[];
export declare const OTHER_LANGUAGES: string[];
export declare function findLanguage(code: string): Language | undefined;
export declare function isKnownLanguage(code: string | null | undefined): boolean;
export declare function isRightToLeft(code: string): boolean;
export declare function textDirection(code: string): 'rtl' | 'ltr';
