export type Language = {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  rightToLeft: boolean;
};

export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', rightToLeft: false },
  { code: 'cy', name: 'Welsh', nativeName: 'Cymraeg', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', rightToLeft: false },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', rightToLeft: false },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', rightToLeft: false },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', rightToLeft: false },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', rightToLeft: false },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', rightToLeft: false },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', rightToLeft: false },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', rightToLeft: false },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', flag: '🇷🇴', rightToLeft: false },
  { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių', flag: '🇱🇹', rightToLeft: false },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български', flag: '🇧🇬', rightToLeft: false },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', rightToLeft: false },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦', rightToLeft: false },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', rightToLeft: false },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', rightToLeft: false },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', rightToLeft: false },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', flag: '🇮🇳', rightToLeft: false },
  { code: 'mo', name: 'Monégasque', nativeName: 'Munegascu', flag: '🇲🇨', rightToLeft: false },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', rightToLeft: true },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰', rightToLeft: true },
];

export const DEFAULT_LANGUAGE = 'en';

export const LANGUAGE_CODES: string[] = LANGUAGES.map((l) => l.code);

export const OTHER_LANGUAGES: string[] = LANGUAGE_CODES.filter((c) => c !== DEFAULT_LANGUAGE);

export function findLanguage(code: string): Language | undefined {
  return LANGUAGES.find((l) => l.code === code);
}

export function isKnownLanguage(code: string | null | undefined): boolean {
  return !!code && LANGUAGE_CODES.includes(code);
}

export function isRightToLeft(code: string): boolean {
  return findLanguage(code)?.rightToLeft ?? false;
}

export function textDirection(code: string): 'rtl' | 'ltr' {
  return isRightToLeft(code) ? 'rtl' : 'ltr';
}
