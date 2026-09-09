import { translate, TextByLanguage } from './text';

export { textDirection } from './languages';

export function urlForLanguage(language: string, path: string, defaultLanguage = 'en'): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (language === defaultLanguage) return clean;
  return clean === '/' ? `/${language}` : `/${language}${clean}`;
}

export function htmlLangValue(language: string, defaultLanguage = 'en'): string {
  return language === defaultLanguage ? 'en-GB' : language;
}

export function languageUrls(
  path: string,
  languages: string[],
  defaultLanguage = 'en',
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const code of languages) {
    out[htmlLangValue(code, defaultLanguage)] = urlForLanguage(code, path, defaultLanguage);
  }
  out['x-default'] = urlForLanguage(defaultLanguage, path, defaultLanguage);
  return out;
}

export function translateFor(text: TextByLanguage, language: string): (key: string) => string {
  return (key: string) => translate(text, language, key);
}
