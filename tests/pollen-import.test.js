'use strict';
// Run with: npm test
const assert = require('assert');
const Pollen = require('../public/pollen-core.js');
const I = require('../public/pollen-import.js');

let passed = 0;
let pending = Promise.resolve();
function test(name, fn) {
  // run sequentially so async tests keep their order in the output
  pending = pending.then(async () => {
    try {
      await fn();
      passed++;
      console.log('  ok  ' + name);
    } catch (err) {
      console.error('FAIL  ' + name + '\n      ' + err.message);
      process.exitCode = 1;
    }
  });
}

const bodtum = () => Pollen.toDefinition(Pollen.templates.bodtum);
const titles = r => r.definition.questions.map(q => q.title);

console.log('pollen-import');

// ------------------------------------------------------------------ CSV

test('CSV export -> import round-trips the whole BODTUM template exactly', () => {
  const r = I.fromCsv(I.toCsv(Pollen.templates.bodtum));
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.warnings, []);
  assert.deepStrictEqual(r.definition, bodtum());
});

test('CSV and JSON samples are valid and cover every question type', () => {
  const csv = I.fromCsv(I.csvTemplate());
  const json = I.fromJson(I.jsonTemplate());
  assert.deepStrictEqual(csv.errors, []);
  assert.deepStrictEqual(json.errors, []);
  assert.deepStrictEqual(csv.definition.questions.map(q => q.type), ['single', 'multi', 'scale', 'rating', 'wordcloud']);
  assert.deepStrictEqual(csv.definition, json.definition);
});

test('comma, semicolon and tab delimited files give the same survey', () => {
  const rows = [
    ['tip', 'soru', 'seçenekler'],
    ['tek', 'Renk?', 'Kırmızı|Mavi'],
    ['çoklu', 'Meyve?', 'Elma|Armut|Muz']
  ];
  const make = d => rows.map(r => r.join(d)).join('\n');
  const a = I.fromCsv(make(','), { fallbackTitle: 'X' });
  const b = I.fromCsv(make(';'), { fallbackTitle: 'X' });
  const c = I.fromCsv(make('\t'), { fallbackTitle: 'X' });
  assert.deepStrictEqual(a.errors, []);
  assert.deepStrictEqual(a.definition, b.definition);
  assert.deepStrictEqual(a.definition, c.definition);
});

test('quotes, delimiters and newlines inside cells survive', () => {
  const csv = 'tip,soru,seçenekler\n' +
    'tek,"Soru, virgüllü ""tırnaklı"" mı?","A, B\nC|D"\n';
  const r = I.fromCsv(csv, { fallbackTitle: 'T' });
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(r.definition.questions[0].title, 'Soru, virgüllü "tırnaklı" mı?');
  assert.deepStrictEqual(r.definition.questions[0].options.map(o => o.text), ['A, B', 'C', 'D']);
});

test('UTF-8 BOM and Windows line endings are handled', () => {
  const r = I.fromCsv('\uFEFFtip;soru;seçenekler\r\ntek;Merhaba?;Evet|Hayır\r\n', { fallbackTitle: 'T' });
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(r.definition.questions.length, 1);
});

test('English or Turkish headers and type names are both understood', () => {
  const r = I.fromCsv('Type,Question,Options,Max\nMultiple,Pick,a|b|c,2\nStars,Rate it,,\nText,Say,,\n', { fallbackTitle: 'T' });
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.definition.questions.map(q => q.type), ['multi', 'rating', 'wordcloud']);
  assert.strictEqual(r.definition.questions[0].maxSelect, 2);
});

test('survey-level rows set title, short title, badge, description', () => {
  const csv = 'tip;soru;seçenekler\nanket adı;Büyük Anket\nkısa başlık;Kısa\nkurum;ACME\nyönerge;Dokunun.\ntek;S?;a|b\n';
  const d = I.fromCsv(csv).definition;
  assert.strictEqual(d.title, 'Büyük Anket');
  assert.strictEqual(d.shortTitle, 'Kısa');
  assert.strictEqual(d.badge, 'ACME');
  assert.strictEqual(d.description, 'Dokunun.');
  assert.strictEqual(d.questions.length, 1);
});

test('missing survey title falls back to the file name and warns', () => {
  const r = I.fromCsv('tip,soru,seçenekler\ntek,S?,a|b\n', { fallbackTitle: 'çalışan anketi' });
  assert.strictEqual(r.definition.title, 'çalışan anketi');
  assert.ok(r.warnings.some(w => w.includes('Anket adı')));
});

test('scale rows: anchors, five level labels and a warning for the wrong count', () => {
  const ok = I.fromCsv('tip,soru,sol,orta,sağ,seviyeler\nölçek,Nasıl?,Kötü,Orta,İyi,a|b|c|d|e\n', { fallbackTitle: 'T' });
  assert.deepStrictEqual(ok.definition.questions[0].scaleLabels, ['a', 'b', 'c', 'd', 'e']);
  const bad = I.fromCsv('tip,soru,sol,sağ,seviyeler\nölçek,Nasıl?,Kötü,İyi,a|b\n', { fallbackTitle: 'T' });
  assert.deepStrictEqual(bad.definition.questions[0].scaleLabels, ['1 - Kötü', '2', '3 - Orta', '4', '5 - İyi']);
  assert.ok(bad.warnings.some(w => w.includes('5 etiket')));
});

test('errors name the offending line', () => {
  const r = I.fromCsv('tip,soru,seçenekler\ntek,Tamam?,a|b\nbilinmeyen,Neden?,a|b\n,,\n,Tipsiz?,\n', { fallbackTitle: 'T' });
  assert.strictEqual(r.definition, null);
  assert.ok(r.errors.some(e => e.startsWith('Satır 3:') && e.includes('bilinmeyen')));
  assert.ok(r.errors.some(e => e.startsWith('Satır 5:') && e.includes('belirtilmemiş')));
});

test('a choice question with a single option is rejected by validation', () => {
  const r = I.fromCsv('tip,soru,seçenekler\ntek,Tek şık?,sadece biri\n', { fallbackTitle: 'T' });
  assert.strictEqual(r.definition, null);
  assert.ok(r.errors.some(e => e.includes('en az 2 seçenek')));
});

test('missing type is inferred from the options, with a warning', () => {
  const r = I.fromCsv('tip,soru,seçenekler\n,Hangisi?,a|b|c\n', { fallbackTitle: 'T' });
  assert.strictEqual(r.definition.questions[0].type, 'single');
  assert.ok(r.warnings.some(w => w.includes('varsayıldı')));
});

test('a bad choice limit only warns', () => {
  const r = I.fromCsv('tip,soru,seçenekler,en çok\nçoklu,Hangi?,a|b|c,abc\ntek,Hangisi?,a|b,2\n', { fallbackTitle: 'T' });
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(r.warnings.filter(w => w.includes('en çok')).length, 2);
  assert.ok(!('maxSelect' in r.definition.questions[0]));
});

test('files without a recognisable header explain what is expected', () => {
  const r = I.fromCsv('a,b,c\n1,2,3\n');
  assert.strictEqual(r.definition, null);
  assert.ok(r.errors[0].includes('sütun başlıkları'));
});

test('CSV with only a header has no questions', () => {
  const r = I.fromCsv('tip,soru,seçenekler\n');
  assert.ok(r.errors.some(e => e.includes('hiç soru')));
});

// ------------------------------------------------------------------ JSON

test('Pollen JSON imports; unknown fields are ignored and votes are dropped with a warning', () => {
  const def = bodtum();
  def.extra = 'ignored';
  def.questions[0].votes = { v1: 'opt1_1' };
  const r = I.fromJson(JSON.stringify(def));
  assert.deepStrictEqual(r.errors, []);
  assert.ok(r.warnings.some(w => w.includes('oylar')));
  assert.ok(!JSON.stringify(r.definition).includes('votes'));
  assert.ok(!('extra' in r.definition));
});

test('JSON: invalid text, missing questions and a bare question array', () => {
  assert.ok(I.fromJson('{ nope').errors[0].includes('JSON'));
  assert.ok(I.fromJson('{"title":"x"}').errors[0].includes('questions'));
  const arr = I.fromJson('[{"type":"single","title":"S","options":["a","b"]}]', { fallbackTitle: 'Liste' });
  assert.deepStrictEqual(arr.errors, []);
  assert.strictEqual(arr.definition.title, 'Liste');
  assert.ok(arr.warnings.length >= 1);
});

test('JSON: validation problems are reported per question', () => {
  const r = I.fromJson(JSON.stringify({ title: 'x', questions: [{ type: 'single', title: 'S', options: ['a'] }, { type: 'nope', title: 'T' }] }));
  assert.strictEqual(r.definition, null);
  assert.ok(r.errors.some(e => e.includes('Soru 1')));
  assert.ok(r.errors.some(e => e.includes('Soru 2') && e.includes('bilinmeyen')));
});

test('JSON: another schema version warns but still imports', () => {
  const def = bodtum();
  def.schema = 'pollen.survey.v9';
  const r = I.fromJson(JSON.stringify(def));
  assert.ok(r.definition);
  assert.ok(r.warnings.some(w => w.includes('şema')));
});

// ------------------------------------------------------------------ auto detection

test('parse() detects JSON vs CSV and rejects empty or oversized input', () => {
  assert.strictEqual(I.parse(I.jsonTemplate()).format, 'json');
  assert.strictEqual(I.parse(I.csvTemplate()).format, 'csv');
  assert.ok(I.parse('   \n ').errors[0].includes('boş'));
  assert.ok(I.parse('x'.repeat(I.MAX_CHARS + 1)).errors[0].includes('büyük'));
  assert.deepStrictEqual(titles(I.parse(I.csvTemplate())), titles(I.parse(I.jsonTemplate())));
});

// ------------------------------------------------------------------ links

test('Google Sheets links map to CSV export URLs (gid respected, published links left alone)', () => {
  const c = I.sheetsCandidates('https://docs.google.com/spreadsheets/d/ABC_def-123/edit#gid=77');
  assert.strictEqual(c[0], 'https://docs.google.com/spreadsheets/d/ABC_def-123/export?format=csv&gid=77');
  assert.strictEqual(c[1], 'https://docs.google.com/spreadsheets/d/ABC_def-123/gviz/tq?tqx=out:csv&gid=77');
  assert.ok(I.sheetsCandidates('https://docs.google.com/spreadsheets/d/ABC/edit')[0].endsWith('gid=0'));
  assert.strictEqual(I.sheetsCandidates('https://docs.google.com/spreadsheets/d/e/2PACX-1/pub?output=csv'), null);
  assert.strictEqual(I.sheetsCandidates('https://example.com/a.json'), null);
});

const res = (body, ok = true, status = 200) => ({ ok, status, text: async () => body });

test('fetchText: Sheets link tries the export URL first and returns the CSV', async () => {
  const calls = [];
  const text = await I.fetchText('https://docs.google.com/spreadsheets/d/ID1/edit#gid=3', {
    fetch: async u => { calls.push(u); return res('tip,soru\ntek,x'); }
  });
  assert.strictEqual(text, 'tip,soru\ntek,x');
  assert.strictEqual(calls.length, 1);
  assert.ok(calls[0].includes('/export?format=csv&gid=3'));
});

test('fetchText: falls back to the second Sheets URL when the first fails', async () => {
  let n = 0;
  const text = await I.fetchText('https://docs.google.com/spreadsheets/d/ID1/edit', {
    fetch: async () => { n++; if (n === 1) throw new TypeError('Failed to fetch'); return res('ok,csv'); }
  });
  assert.strictEqual(text, 'ok,csv');
  assert.strictEqual(n, 2);
});

test('fetchText: a login/HTML page is explained as a sharing problem', async () => {
  await assert.rejects(
    I.fetchText('https://docs.google.com/spreadsheets/d/ID1/edit', { fetch: async () => res('<!DOCTYPE html><html>login</html>') }),
    /herkes/
  );
});

test('fetchText: HTTP errors, network errors and bad URLs give readable messages', async () => {
  await assert.rejects(I.fetchText('https://example.com/a.json', { fetch: async () => res('', false, 404) }), /404/);
  await assert.rejects(I.fetchText('https://example.com/a.json', { fetch: async () => { throw new TypeError('x'); } }), /erişilemedi/);
  await assert.rejects(I.fetchText('not a url', { fetch: async () => res('') }), /Geçerli bir bağlantı/);
  await assert.rejects(I.fetchText('ftp://example.com/a', { fetch: async () => res('') }), /Geçerli bir bağlantı/);
});

test('fetchText: oversized responses are refused', async () => {
  await assert.rejects(
    I.fetchText('https://example.com/big.csv', { fetch: async () => res('x'.repeat(I.MAX_CHARS + 1)) }),
    /çok büyük/
  );
});

pending.then(() => {
  console.log('\n' + passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
});

