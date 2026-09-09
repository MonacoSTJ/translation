"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServerLanguage = getServerLanguage;
exports.getServerTranslate = getServerTranslate;
const headers_1 = require("next/headers");
const text_1 = require("./text");
const COOKIE = 'language';
async function getServerLanguage(languages, options) {
    const fallback = options?.defaultLanguage ?? 'en';
    try {
        const store = await (0, headers_1.cookies)();
        const chosen = store.get(COOKIE)?.value;
        if (chosen && languages.includes(chosen))
            return chosen;
    }
    catch {
        // cookies() throws outside a request context (e.g. a statically rendered
        // route). Fall through to the browser preference or the default.
    }
    if (options?.useBrowserPreference) {
        try {
            const header = (await (0, headers_1.headers)()).get('accept-language');
            const primary = header?.split(',')[0]?.trim().slice(0, 2).toLowerCase();
            if (primary && languages.includes(primary))
                return primary;
        }
        catch {
            // headers() throws outside a request context. Fall through to the default.
        }
    }
    return fallback;
}
async function getServerTranslate(text, languages, options) {
    const language = await getServerLanguage(languages, options);
    return (key) => (0, text_1.translate)(text, language, key);
}
