'use client';
"use strict";
'use client';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationProvider = TranslationProvider;
exports.useTranslation = useTranslation;
const react_1 = require("react");
const languages_1 = require("./languages");
const text_1 = require("./text");
__exportStar(require("./languages"), exports);
__exportStar(require("./text"), exports);
const COOKIE = 'language';
const Context = (0, react_1.createContext)(null);
function writeLanguageCookie(code) {
    if (typeof document === 'undefined')
        return;
    const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; secure' : '';
    document.cookie = `${COOKIE}=${code}; path=/; max-age=31536000; samesite=lax${secure}`;
}
function TranslationProvider({ languages, text, defaultLanguage = 'en', announceLanguage = false, children, }) {
    const [language, setLanguageState] = (0, react_1.useState)(defaultLanguage);
    (0, react_1.useEffect)(() => {
        let saved = null;
        try {
            saved = localStorage.getItem(COOKIE);
        }
        catch {
            // Private mode or storage disabled: keep the default language.
        }
        if (saved && languages.includes(saved))
            apply(saved);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    function apply(code) {
        setLanguageState(code);
        if (typeof document !== 'undefined') {
            document.documentElement.dir = (0, languages_1.isRightToLeft)(code) ? 'rtl' : 'ltr';
            if (announceLanguage)
                document.documentElement.lang = code;
        }
    }
    function setLanguage(code) {
        if (!languages.includes(code))
            return;
        try {
            localStorage.setItem(COOKIE, code);
        }
        catch {
            // Private mode or storage disabled: the cookie below still carries the choice.
        }
        writeLanguageCookie(code);
        apply(code);
    }
    const translate = (key) => (0, text_1.translate)(text, language, key);
    return (0, react_1.createElement)(Context.Provider, { value: { language, setLanguage, translate } }, children);
}
function useTranslation() {
    const ctx = (0, react_1.useContext)(Context);
    if (!ctx)
        return { language: 'en', setLanguage: () => { }, translate: (key) => key };
    return ctx;
}
