"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.textDirection = void 0;
exports.urlForLanguage = urlForLanguage;
exports.htmlLangValue = htmlLangValue;
exports.languageUrls = languageUrls;
exports.translateFor = translateFor;
const text_1 = require("./text");
var languages_1 = require("./languages");
Object.defineProperty(exports, "textDirection", { enumerable: true, get: function () { return languages_1.textDirection; } });
function urlForLanguage(language, path, defaultLanguage = 'en') {
    const clean = path.startsWith('/') ? path : `/${path}`;
    if (language === defaultLanguage)
        return clean;
    return clean === '/' ? `/${language}` : `/${language}${clean}`;
}
function htmlLangValue(language, defaultLanguage = 'en') {
    return language === defaultLanguage ? 'en-GB' : language;
}
function languageUrls(path, languages, defaultLanguage = 'en') {
    const out = {};
    for (const code of languages) {
        out[htmlLangValue(code, defaultLanguage)] = urlForLanguage(code, path, defaultLanguage);
    }
    out['x-default'] = urlForLanguage(defaultLanguage, path, defaultLanguage);
    return out;
}
function translateFor(text, language) {
    return (key) => (0, text_1.translate)(text, language, key);
}
