// Proves translateCatalogue without an API call: a fake client that answers in
// JSON, one deliberately broken placeholder, and a second run that must reuse.
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { translateCatalogue } from '../dist/batch.js';

let calls = 0;
const fake = {
  messages: {
    create: async ({ messages }) => {
      calls += 1;
      const content = messages[0].content;
      if (!content.trim().startsWith('{')) {
        // The single-string retry path: keep the broken key broken so the guard is exercised.
        const text = content.includes('Order') ? content.replace('{name}', 'name') + ' [pl]' : `${content} [pl]`;
        return { stop_reason: 'end_turn', content: [{ type: 'text', text }] };
      }
      const input = JSON.parse(content);
      const out = {};
      for (const [key, value] of Object.entries(input)) {
        // Break the placeholder on one key on purpose; the guard must catch it.
        out[key] = key === 'bad' ? value.replace('{name}', 'name') + ' [pl]' : `${value} [pl]`;
      }
      return { stop_reason: 'end_turn', content: [{ type: 'text', text: '```json\n' + JSON.stringify(out) + '\n```' }] };
    },
  },
};

const dir = mkdtempSync(join(tmpdir(), 'catalogue-'));
const source = {
  'nav.home': 'Home',
  'greeting': 'Hello {name}',
  'bad': 'Order {name} is ready',
  'faq.q1': 'How do I sell scrap metal near me?',
};
const quiet = () => {};

const first = await translateCatalogue({ source, into: ['pl'], outDir: dir, client: fake, chunkSize: 2, log: quiet });
const dict = JSON.parse(readFileSync(join(dir, 'pl.json'), 'utf8'));
const progress = JSON.parse(readFileSync(join(dir, 'pl.progress.json'), 'utf8'));

const checks = [
  ['two chunks of two, plus one single retry for the broken key', first[0].calls === 3],
  ['three translated, one empty', first[0].translated === 3 && first[0].empty === 1],
  ['good placeholder kept', dict['greeting'] === 'Hello {name} [pl]'],
  ['broken placeholder left empty', dict['bad'] === ''],
  ['empty key has no progress hash, so it is retried next run', !('bad' in progress)],
  ['keys written in source order', Object.keys(dict).join(',') === Object.keys(source).join(',')],
];

const before = calls;
const second = await translateCatalogue({ source, into: ['pl'], outDir: dir, client: fake, chunkSize: 2, log: quiet });
checks.push(['second run reuses the three good keys', second[0].reused === 3 && second[0].keys === 1]);
checks.push(['second run spends calls only on the empty key', calls - before === 2]);

const changed = { ...source, 'nav.home': 'Home page' };
delete changed['faq.q1'];
const third = await translateCatalogue({ source: changed, into: ['pl'], outDir: dir, client: fake, chunkSize: 5, log: quiet });
const dict3 = JSON.parse(readFileSync(join(dir, 'pl.json'), 'utf8'));
checks.push(['a changed English string is re-translated', dict3['nav.home'] === 'Home page [pl]']);
checks.push(['a removed key is dropped from the output', !('faq.q1' in dict3)]);
checks.push(['dry run makes no calls', (await (async () => { const c = calls; await translateCatalogue({ source, into: ['ro'], outDir: dir, dryRun: true, log: quiet }); return calls === c; })())]);

const failedList = JSON.parse(readFileSync(join(dir, 'pl.failed.json'), 'utf8'));
checks.push(['failed keys are listed in pl.failed.json', Array.isArray(failedList) && failedList.length === 1 && failedList[0] === 'bad']);

// onFailure: 'english' keeps the gate green and leaves the English in place.
const dir2 = mkdtempSync(join(tmpdir(), 'catalogue-en-'));
const eng = await translateCatalogue({ source, into: ['pl'], outDir: dir2, client: fake, chunkSize: 5, onFailure: 'english', log: quiet });
const dictEng = JSON.parse(readFileSync(join(dir2, 'pl.json'), 'utf8'));
checks.push(["onFailure 'english' writes the English phrase for a failed key", dictEng['bad'] === source['bad'] && eng[0].empty === 1]);
checks.push(["onFailure 'english' still lists the key as failed", JSON.parse(readFileSync(join(dir2, 'pl.failed.json'), 'utf8'))[0] === 'bad']);

// A hand-typed value with no progress hash is adopted, never overwritten.
const handDir = mkdtempSync(join(tmpdir(), 'catalogue-hand-'));
const { writeFileSync } = await import('fs');
writeFileSync(join(handDir, 'pl.json'), JSON.stringify({ greeting: 'Witaj {name}' }));
const beforeHand = calls;
const hand = await translateCatalogue({ source, into: ['pl'], outDir: handDir, client: fake, chunkSize: 5, log: quiet });
const handDict = JSON.parse(readFileSync(join(handDir, 'pl.json'), 'utf8'));
checks.push(['a hand-filled value survives the run', handDict['greeting'] === 'Witaj {name}' && hand[0].reused === 1]);
checks.push(['and its hash is recorded so it counts as done', JSON.parse(readFileSync(join(handDir, 'pl.progress.json'), 'utf8'))['greeting'] !== undefined]);
rmSync(dir2, { recursive: true, force: true });
rmSync(handDir, { recursive: true, force: true });

const { placeholders, checkTranslations } = await import('../dist/check.js');
checks.push(['comparator sees {v1} value slots', placeholders('Pay {v1} today') === '{v1}']);
checks.push(['comparator sees <tN> tag pairs', placeholders('Read the <t1>terms</t1> first') === '</t1>,<t1>']);
checks.push(['a lost closing tag fails the check', checkTranslations({ en: { k: 'Read the <t1>terms</t1> first' }, cy: { k: 'Darllenwch y <t1>telerau yn gyntaf' } }, ['en', 'cy']).errors.some((e) => e.includes('placeholder mismatch'))]);
checks.push(['tags moved but intact pass the check', checkTranslations({ en: { k: 'Read the <t1>terms</t1> first' }, cy: { k: '<t1>Telerau</t1>: darllenwch yn gyntaf' } }, ['en', 'cy']).errors.length === 0]);
checks.push(['Romanian ordinal "a doua" is not a stripped accent', checkTranslations({ en: { k: 'the second most common initial' }, ro: { k: 'a doua cea mai comună inițială' } }, ['en', 'ro']).errors.length === 0]);
checks.push(['Romanian numeral "doua" standing alone still is', checkTranslations({ en: { k: 'two cars' }, ro: { k: 'doua mașini' } }, ['en', 'ro']).errors.some((e) => e.includes('stripped accent'))]);

rmSync(dir, { recursive: true, force: true });
let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failed += 1;
}
process.exit(failed ? 1 : 0);
