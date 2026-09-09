import { cookies, headers } from 'next/headers';
import { translate, TextByLanguage } from './text';

const COOKIE = 'language';

export async function getServerLanguage(
  languages: string[],
  options?: { useBrowserPreference?: boolean; defaultLanguage?: string },
): Promise<string> {
  const fallback = options?.defaultLanguage ?? 'en';

  try {
    const store = await cookies();
    const chosen = store.get(COOKIE)?.value;
    if (chosen && languages.includes(chosen)) return chosen;
  } catch {
    // cookies() throws outside a request context (e.g. a statically rendered
    // route). Fall through to the browser preference or the default.
  }

  if (options?.useBrowserPreference) {
    try {
      const header = (await headers()).get('accept-language');
      const primary = header?.split(',')[0]?.trim().slice(0, 2).toLowerCase();
      if (primary && languages.includes(primary)) return primary;
    } catch {
      // headers() throws outside a request context. Fall through to the default.
    }
  }

  return fallback;
}

export async function getServerTranslate(
  text: TextByLanguage,
  languages: string[],
  options?: { useBrowserPreference?: boolean; defaultLanguage?: string },
): Promise<(key: string) => string> {
  const language = await getServerLanguage(languages, options);
  return (key: string) => translate(text, language, key);
}
