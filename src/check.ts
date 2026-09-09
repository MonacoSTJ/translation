import { TextByLanguage } from './text';

const STRIPPED_ACCENT_WORDS: Record<string, string[]> = {
  fr: ['negociant', 'negociants', 'societe', 'verifie', 'donnees', 'reseau', 'numero', 'estime', 'prefere'],
  es: ['dias', 'britanic', 'britanicos', 'ultimos', 'ultima', 'informacion', 'numero', 'compania', 'garantia', 'categoria', 'guia', 'tambien'],
  pt: ['preco', 'precos', 'britanic', 'ultimos', 'numero', 'informacao', 'licenca', 'servico', 'servicos', 'negocio'],
  it: ['piu', 'qualita', 'identita', 'societa', 'perche', 'anziche', 'citta', 'cosi', 'attivita', 'verra'],
  ro: ['pretul', 'pretului', 'preturi', 'piata', 'intre', 'inregistrat', 'inregistra', 'gasit', 'numarul', 'pana', 'doua', 'comerciantul'],
  de: ['veroffentlich', 'geschatzt', 'gultig', 'prufung', 'zuruck', 'handler', 'grosse', 'schaftsfuhrer'],
};

const placeholders = (value: string): string =>
  (value.match(/\{[a-zA-Z]+\}/g) || []).slice().sort().join(',');

export type CheckResult = { errors: string[]; warnings: string[] };

export function checkTranslations(
  text: TextByLanguage,
  languages: string[],
  options: { defaultLanguage?: string } = {},
): CheckResult {
  const defaultLanguage = options.defaultLanguage ?? 'en';
  const errors: string[] = [];
  const warnings: string[] = [];

  const base = text[defaultLanguage];
  if (!base) {
    errors.push(`default language "${defaultLanguage}" has no text`);
    return { errors, warnings };
  }
  const baseKeys = Object.keys(base);
  const others = languages.filter((code) => code !== defaultLanguage);

  for (const code of others) {
    const dict = text[code];
    if (!dict) {
      warnings.push(`${code}: no text yet (falls back to ${defaultLanguage})`);
      continue;
    }
    const keys = new Set(Object.keys(dict));
    const missing = baseKeys.filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => !(k in base));
    if (missing.length) {
      errors.push(`${code}: ${missing.length} missing key(s): ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ' …' : ''}`);
    }
    if (extra.length) {
      errors.push(`${code}: ${extra.length} extra key(s): ${extra.slice(0, 6).join(', ')}`);
    }

    for (const key of baseKeys) {
      const value = dict[key];
      if (value === undefined) continue;
      if (placeholders(value) !== placeholders(base[key])) {
        errors.push(`${code}: placeholder mismatch in "${key}" (expected ${placeholders(base[key]) || '(none)'})`);
      }
    }
  }

  for (const code of languages) {
    const dict = text[code];
    if (!dict) continue;
    for (const key of Object.keys(dict)) {
      if (dict[key].includes('—')) errors.push(`${code}: em dash in "${key}"`);
    }
  }

  for (const [code, words] of Object.entries(STRIPPED_ACCENT_WORDS)) {
    const dict = text[code];
    if (!dict) continue;
    const pattern = new RegExp('\\b(' + words.join('|') + ')\\b', 'i');
    for (const key of baseKeys) {
      const value = dict[key];
      if (value && pattern.test(value)) {
        errors.push(`${code}: stripped accent in "${key}" (matched "${value.match(pattern)![0]}")`);
      }
    }
  }

  const spanish = text.es;
  if (spanish) {
    for (const key of baseKeys) {
      const value = spanish[key];
      if (value && value.trim().endsWith('?') && !value.includes('¿')) {
        errors.push(`es: question without opening ¿ in "${key}"`);
      }
    }
  }

  return { errors, warnings };
}
