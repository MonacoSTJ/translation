"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.translate = translate;
exports.translationProgress = translationProgress;
function translate(text, language, key) {
    return text[language]?.[key] ?? text.en?.[key] ?? key;
}
function translationProgress(text, languages, defaultLanguage = 'en') {
    const keys = Object.keys(text[defaultLanguage] ?? {});
    return languages.map((code) => {
        const have = text[code] ?? {};
        const done = keys.filter((k) => typeof have[k] === 'string' && have[k] !== '').length;
        return { code, done, of: keys.length };
    });
}
