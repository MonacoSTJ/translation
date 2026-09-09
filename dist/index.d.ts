import { ReactNode } from 'react';
import { TextByLanguage } from './text';
export * from './languages';
export * from './text';
type Value = {
    language: string;
    setLanguage: (code: string) => void;
    translate: (key: string) => string;
};
export declare function TranslationProvider({ languages, text, defaultLanguage, announceLanguage, children, }: {
    languages: string[];
    text: TextByLanguage;
    defaultLanguage?: string;
    announceLanguage?: boolean;
    children: ReactNode;
}): import("react").FunctionComponentElement<import("react").ProviderProps<Value | null>>;
export declare function useTranslation(): Value;
