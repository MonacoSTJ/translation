export type Phrases = Record<string, string>;
export type TextByLanguage = Record<string, Phrases>;

export function translate(text: TextByLanguage, language: string, key: string): string {
  return text[language]?.[key] ?? text.en?.[key] ?? key;
}

export function translationProgress(
  text: TextByLanguage,
  languages: string[],
  defaultLanguage = 'en',
): { code: string; done: number; of: number }[] {
  const keys = Object.keys(text[defaultLanguage] ?? {});
  return languages.map((code) => {
    const have = text[code] ?? {};
    const done = keys.filter((k) => typeof have[k] === 'string' && have[k] !== '').length;
    return { code, done, of: keys.length };
  });
}
