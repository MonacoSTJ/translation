# Adopting @newreg/translation in a site

The package holds the machinery. A site supplies only its own languages and its
own words. This guide is the general recipe, followed by the specifics for
Private Plates.

## The general recipe

1. **Add the dependency.** Use a **pinned GitHub tarball** — it is fetched over
   HTTPS and uses the package's committed `dist`, so nothing needs `git` in the
   build image (a `file:` path is invisible to Docker, and a `github:` dep makes
   npm shell out to `git`, which most build images do not have):
   `"@newreg/translation": "https://github.com/MonacoSTJ/translation/archive/<sha>.tar.gz"`
   (use the current commit sha of the translation repo; bump it to take an
   update). A local `file:../../../translation` path also works for host-only dev
   on the same machine, but not inside Docker.
   - For a Next.js frontend, add `transpilePackages: ['@newreg/translation']` to
     `next.config`.

2. **Give it your languages and words.** Keep one catalogue module in the site,
   for example `lib/text.ts`, exporting `TEXT` (per-language key/value objects,
   English complete) and the list of language codes the site ships (a subset of
   the shared registry in `src/languages.ts`).

3. **Wrap the app once** with `TranslationProvider` (languages + text), and read
   text anywhere with `useTranslation()` returning `{ language, setLanguage,
   translate }`. Build your own language selector; the package ships no styled
   component, so it does not care whether the site uses Tailwind or hand-written
   CSS. Use `LANGUAGES` / `findLanguage(code)` for the flag and native name.

4. **Server-render the interface** where wanted with `getServerLanguage` /
   `getServerTranslate` from `@newreg/translation/server` (both async; read the
   `language` cookie). For per-language web addresses use `urlForLanguage` /
   `languageUrls` / `translateFor` from `@newreg/translation/urls`.

5. **Wire the quality gate.** A script that imports the site's `TEXT` +
   languages and calls `check-translations` (the bundled bin), run in CI, fails
   the build on a missing key, a broken placeholder, an em dash, or a stripped
   accent.

6. **Live content (optional, when the site has dynamic text to translate).**
   Apply `migrations/translated_content.sql` to the site's database, set
   `ANTHROPIC_API_KEY`, and in the route that serves the text call
   `translateAndStore` from `@newreg/translation/live`, passing the site's own
   glossary and editorial style so protected wording survives. Translation is
   written once, stored, and served from the store thereafter; it falls back to
   the English source on any failure. The model default is `claude-haiku-4-5`
   (override with `TRANSLATION_MODEL`).

## Two behaviours kept on purpose

- The provider sets the reading direction (`dir`) for right-to-left languages
  but does **not** change `<html lang>`. A page should keep announcing English
  until its words are actually translated, or a screen reader voices English
  text with the wrong engine. Turn `announceLanguage` on per page only once the
  copy on it is genuinely translated.
- Missing wording falls back per key: chosen language, then English, then the
  key. A half-filled language ships without breaking anything.

## Private Plates, specifically

Private Plates already carries a copy of this system that was ported from
ScrapMetal, so this is a swap to the shared package, not a rebuild. Its readiness
report is `docs/I18N_HANDOVER.md` in that repo; the reciprocal answers are in
`scrapmetal.co.uk/docs/I18N_HANDOVER_REPLY.md`.

- **Fit is clean.** Private Plates is Next 16 / React 19, where `cookies()` is
  async, so the package's async server helpers drop straight in (no sync adapter
  was needed there, unlike ScrapMetal on Next 14). It has no Tailwind; the
  package ships no styled components, so nothing to reconcile.
- **Add the dependency as a pinned tarball** (see step 1 above), since Private
  Plates is built on a separate machine, in Docker, and cannot use a local file
  path. Do not use the `github:` form: the build image has no `git`. ScrapMetal
  proved this exact path.
- **Only six call sites** use the old `useI18n()`, versus 41 on ScrapMetal, so do
  the direct rename to the plain names (`useTranslation`, `translate`,
  `language`, `setLanguage`) rather than keeping back-compat adapters. Keep the
  site's `messages.ts` catalogue as the words; pass its 16 codes as the
  languages.
- **The cookie fix comes for free.** The package writes a `language` cookie with
  `Secure` on https, which closes Private Plates' open item SEC-027 (its old
  `locale` cookie had no `Secure` flag).
- **Its deferred decisions are preserved.** It kept `lang` at `en-GB` and did not
  read the cookie server-side to protect search speed; the package's defaults
  match both, so nothing regresses until the site chooses to translate body copy.
- **Watch the regression gate.** Private Plates pins thousands of exact
  user-visible strings in `tests/test_regression.py`. Replacing a hard-coded
  string with `translate('key')` will break a pin until it is updated. Run the
  suite before and after and update the pins in the same change.
- **The protected terms are mandatory in the glossary.** If and when Private
  Plates translates dynamic content, the four house terms (**private plate**,
  **registration mark**, **number plate**, **reg**) must be passed as the
  glossary to `translateAndStore`, because the English-only regression check
  cannot catch the distinction being lost in another language. Do not translate
  the plate graphic; alt text and surrounding copy only.
- **Do not add a second i18n library.** This contract is the group's and it came
  from ScrapMetal; extend it, do not replace it.
