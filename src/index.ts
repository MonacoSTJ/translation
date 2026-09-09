'use client';

import { createContext, createElement, useContext, useEffect, useState, ReactNode } from 'react';
import { isRightToLeft } from './languages';
import { translate as lookup, TextByLanguage } from './text';

export * from './languages';
export * from './text';

const COOKIE = 'language';

type Value = {
  language: string;
  setLanguage: (code: string) => void;
  translate: (key: string) => string;
};

const Context = createContext<Value | null>(null);

function writeLanguageCookie(code: string) {
  if (typeof document === 'undefined') return;
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${COOKIE}=${code}; path=/; max-age=31536000; samesite=lax${secure}`;
}

export function TranslationProvider({
  languages,
  text,
  defaultLanguage = 'en',
  announceLanguage = false,
  children,
}: {
  languages: string[];
  text: TextByLanguage;
  defaultLanguage?: string;
  announceLanguage?: boolean;
  children: ReactNode;
}) {
  const [language, setLanguageState] = useState(defaultLanguage);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(COOKIE);
    } catch {
      // Private mode or storage disabled: keep the default language.
    }
    if (saved && languages.includes(saved)) apply(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function apply(code: string) {
    setLanguageState(code);
    if (typeof document !== 'undefined') {
      document.documentElement.dir = isRightToLeft(code) ? 'rtl' : 'ltr';
      if (announceLanguage) document.documentElement.lang = code;
    }
  }

  function setLanguage(code: string) {
    if (!languages.includes(code)) return;
    try {
      localStorage.setItem(COOKIE, code);
    } catch {
      // Private mode or storage disabled: the cookie below still carries the choice.
    }
    writeLanguageCookie(code);
    apply(code);
  }

  const translate = (key: string) => lookup(text, language, key);

  return createElement(Context.Provider, { value: { language, setLanguage, translate } }, children);
}

export function useTranslation(): Value {
  const ctx = useContext(Context);
  if (!ctx) return { language: 'en', setLanguage: () => {}, translate: (key) => key };
  return ctx;
}
