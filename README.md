# @newreg/translation

One translation system, shared by every New Reg site. A site installs this
package, gives it the languages it wants and its own words, and gets: a language
picker, translated interface text on both the server and the browser, proper
per-language web addresses for search engines, and Claude-powered translation of
live content (listings, generated copy) that is written once and stored.

Every name in this package is plain English on purpose. There is no jargon to
decode.

## What a site provides

Two things, and nothing else:

1. **Its languages** — a list of codes chosen from the shared set (see
   `src/languages.ts`, which carries all 21 the group uses between its sites,
   with the English name, the native name, the flag and whether it reads right
   to left).
2. **Its words** — a `TEXT` object: for each language, a set of short keys
   mapped to the wording a visitor sees.

```ts
// a site's own text.ts
export const TEXT = {
  en: { 'nav.home': 'Home', 'nav.prices': "Today's prices" },
  fr: { 'nav.home': 'Accueil' },   // half-filled is fine, see fallback below
};
```

## The whole public vocabulary

**Languages** (`src/languages.ts`)
- `LANGUAGES` — the shared list, each with `code`, `name`, `nativeName`, `flag`,
  `rightToLeft`.
- `DEFAULT_LANGUAGE` (`'en'`), `LANGUAGE_CODES`, `OTHER_LANGUAGES`.
- `findLanguage(code)`, `isKnownLanguage(code)`, `isRightToLeft(code)`,
  `textDirection(code)`.

**In the browser** (`src/index.ts`)
- `<TranslationProvider>` — wraps the app once.
- `useTranslation()` — returns `{ language, setLanguage, translate }`.
  `translate('nav.home')` gives the current language's wording.
- Missing wording falls back per key: chosen language, then English, then the key
  itself. A half-translated language shows English where it has nothing, never a
  blank or a raw key.
- Switching writes the visitor's choice to a `language` cookie
  (`path=/; samesite=lax`, and `secure` on https) and to browser storage.

**On the server** (`src/server.ts`)
- `getServerLanguage()` — reads the `language` cookie (optionally falling back to
  the browser's `Accept-Language`).
- `getServerTranslate()` — server-side `translate(key)` for the chosen language,
  so the first paint is already in the right language.

**Web addresses for search engines** (`src/urls.ts`)
- `urlForLanguage(language, path)` — English stays unprefixed, other languages
  sit under `/<language>/...`.
- `languageUrls(path)` — the full set of alternates for a page, for search
  engines, including `x-default`.
- `translateFor(language)` — a `translate(key)` bound to a language from the web
  address rather than a cookie, so cached pages stay cached.

**Live content, translated by Claude** (`src/live-content.ts`)
- `translateText(text, intoLanguage, { glossary, style })` — translates one piece
  of live text with Claude, honouring a site glossary (protected wording that
  must never change) and the site's editorial rules.
- `saveTranslation(...)` / `getTranslation(...)` — store each translation once in
  the `translated_content` table and read it back, so nothing is paid for or
  computed twice, and the stored version is what the server renders.

**A whole catalogue, translated in one run** (`src/batch.ts`, added in 0.2.0)
- `translateCatalogue({ source, into, outDir, glossary, style })` — takes the
  site's English phrases and writes one JSON file per language into `outDir`
  (`pl.json`, `cy.json`, ...). Phrases go to Claude in chunks of about 30 as
  JSON, so a 23,000-word site is roughly 80 calls per language. Every returned
  value is checked with the same placeholder rule as `check-translations`; a
  value that fails is retried once on its own and otherwise written as an EMPTY
  string, so the deploy gate fails rather than the site shipping a broken phrase.
- **Resumable.** `<code>.progress.json` records a hash of the English for each
  key translated. A run that stops halfway continues from where it was; a
  changed English phrase re-translates only itself; a removed key is dropped
  from the output. Nothing is paid for twice. A value a person types into
  `<code>.json` by hand is adopted and never overwritten by a later run.
- **Two ways to fail** (`onFailure`, `--on-failure`): `empty` (default) writes
  `""` so the deploy gate fails; `english` writes the English phrase so the site
  ships and a person works through the list instead. Either way the failed keys
  are written to `<code>.failed.json`. The second is the Private Plates
  behaviour, folded in from its own translator.
- `--dry-run` prints how many keys and words each language would send, and
  costs nothing.
- Command line: `translate-catalogue <en.json | text-module> --into cy,pl,ro
  --out translations/ [--glossary glossary.json] [--style style.txt]
  [--model id] [--chunk 30] [--dry-run]`. `glossary.json` is `{ "private plate":
  "keep in English", ... }`; the rules are placed in the system prompt exactly as
  `translateText` places them.
- Proven without an API call: `npm test` runs `scripts/batch-selftest.mjs`
  against a fake client (chunking, the placeholder guard, resumption, changed and
  removed keys, dry run).

**Progress**
- `translationProgress()` — how complete each language is, ready for a small
  admin screen so you can see at a glance what still needs words.

## Two rules kept on purpose

- **The interface text can be translated without slowing the site down; the live
  content is translated once and stored, then served already translated** so
  search engines see real translated pages, not English swapped out afterwards.
- **A page says it is in a language only when its words actually are.** Reading
  direction follows the language immediately (so Arabic and Urdu lay out
  correctly), but the page keeps telling screen readers it is English until the
  words on it are genuinely translated.

## Adopting it

```ts
import { TranslationProvider, useTranslation } from '@newreg/translation';
import { TEXT } from './text';

// wrap once
<TranslationProvider languages={['en', 'pl', 'ro', 'ur']} text={TEXT}>...

// use anywhere
const { translate, language, setLanguage } = useTranslation();
translate('nav.home');
```

Distribution is by package version, not by copying files, so a site names the
version it wants and never names where the source is kept. Moving the source to a
different Git home later does not touch any site that uses it.
