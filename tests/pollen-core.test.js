'use strict';
// Run with: npm test
const assert = require('assert');
const Pollen = require('../public/pollen-core.js');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok  ' + name);
  } catch (err) {
    console.error('FAIL  ' + name + '\n      ' + err.message);
    process.exitCode = 1;
  }
}

const minimal = () => ({
  title: 'Demo',
  questions: [
    { type: 'single', title: 'Q1', options: ['A', 'B'] },
    { type: 'multi', title: 'Q2', options: ['A', 'B', 'C'], maxSelect: 2 },
    { type: 'scale', title: 'Q3', leftLabel: 'Low', rightLabel: 'High' },
    { type: 'wordcloud', title: 'Q4' }
  ]
});

console.log('pollen-core');

test('built-in BODTUM template is valid and has 9 questions', () => {
  assert.deepStrictEqual(Pollen.validateSurvey(Pollen.templates.bodtum), []);
  assert.strictEqual(Pollen.createSurvey(Pollen.templates.bodtum).questions.length, 9);
});

test('template keeps the multi-choice limit of question 3', () => {
  const q3 = Pollen.createSurvey(Pollen.templates.bodtum).questions[2];
  assert.strictEqual(q3.type, 'multi');
  assert.strictEqual(q3.maxSelect, 2);
});

test('createSurvey adds runtime state and empty votes', () => {
  const s = Pollen.createSurvey(minimal());
  assert.strictEqual(s.activeQuestionIndex, 0);
  assert.strictEqual(s.acceptingVotes, true);
  s.questions.forEach(q => assert.deepStrictEqual(q.votes, {}));
});

test('missing ids are generated and plain-string options accepted', () => {
  const s = Pollen.createSurvey(minimal());
  assert.deepStrictEqual(s.questions.map(q => q.id), ['q1', 'q2', 'q3', 'q4']);
  assert.deepStrictEqual(s.questions[0].options, [
    { id: 'opt1_1', text: 'A' },
    { id: 'opt1_2', text: 'B' }
  ]);
});

test('duplicate ids are reported by validate and made unique by normalize', () => {
  const def = minimal();
  def.questions[1].id = 'q1';
  def.questions[0].id = 'q1';
  assert.ok(Pollen.validateSurvey(def).some(e => e.includes('yinelenen')));
  const ids = Pollen.normalizeSurvey(def).questions.map(q => q.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('validate flags the common mistakes', () => {
  assert.ok(Pollen.validateSurvey(null).length > 0);
  assert.ok(Pollen.validateSurvey({ title: '', questions: [] }).length >= 2);
  const def = minimal();
  def.questions[0].options = ['only one'];
  def.questions[1].maxSelect = 9;
  def.questions[2].type = 'bogus';
  def.questions[3].title = '  ';
  const errors = Pollen.validateSurvey(def);
  assert.ok(errors.some(e => e.includes('Soru 1') && e.includes('2 seçenek')));
  assert.ok(errors.some(e => e.includes('Soru 2') && e.includes('maxSelect')));
  assert.ok(errors.some(e => e.includes('Soru 3') && e.includes('bilinmeyen')));
  assert.ok(errors.some(e => e.includes('Soru 4') && e.includes('boş')));
});

test('createSurvey throws on an invalid definition', () => {
  assert.throws(() => Pollen.createSurvey({ title: 'x', questions: [] }), /Geçersiz anket/);
});

test('normalize drops votes unless asked to keep them', () => {
  const def = minimal();
  def.questions[0].votes = { voter1: 'opt1_1' };
  assert.deepStrictEqual(Pollen.normalizeSurvey(def).questions[0].votes, {});
  assert.deepStrictEqual(Pollen.normalizeSurvey(def, { keepVotes: true }).questions[0].votes, { voter1: 'opt1_1' });
});

test('normalize is idempotent', () => {
  const once = Pollen.normalizeSurvey(Pollen.templates.bodtum);
  assert.deepStrictEqual(Pollen.normalizeSurvey(once), once);
});

test('toDefinition is vote-free, versioned and round-trips', () => {
  const s = Pollen.createSurvey(Pollen.templates.bodtum);
  s.questions[0].votes = { v1: 'opt1_1' };
  const def = Pollen.toDefinition(s);
  assert.strictEqual(def.schema, Pollen.SCHEMA_VERSION);
  def.questions.forEach(q => assert.ok(!('votes' in q)));
  const roundTrip = Pollen.createSurvey(JSON.parse(JSON.stringify(def)));
  assert.deepStrictEqual(roundTrip.questions.map(q => q.title), s.questions.map(q => q.title));
});

test('publicQuestion keeps scale labels but never votes or the dashboard tag', () => {
  const q = Pollen.createSurvey(Pollen.templates.bodtum).questions[3];
  q.votes = { someVoter: 4 };
  const pub = Pollen.publicQuestion(q);
  assert.strictEqual(pub.leftLabel, 'Büyük Tehdit');
  assert.strictEqual(pub.rightLabel, 'Büyük Fırsat');
  assert.strictEqual(pub.scaleLabels.length, 5);
  assert.ok(!('votes' in pub));
  assert.ok(!('tag' in pub));
});

test('room ids look like pollen-xxxxxx and rarely collide', () => {
  const ids = new Set();
  for (let i = 0; i < 500; i++) {
    const id = Pollen.newRoomId();
    assert.match(id, /^pollen-[a-z2-9]{6}$/);
    ids.add(id);
  }
  assert.strictEqual(ids.size, 500);
});

test('description and the built-in logo flag are kept; unknown logos are dropped', () => {
  const def = minimal();
  def.description = '  Dokunarak yanıtlayın.  ';
  def.logo = 'bodtum';
  const s = Pollen.normalizeSurvey(def);
  assert.strictEqual(s.description, 'Dokunarak yanıtlayın.');
  assert.strictEqual(s.logo, 'bodtum');
  def.logo = 'evil.png';
  assert.ok(!('logo' in Pollen.normalizeSurvey(def)));
  assert.strictEqual(Pollen.toDefinition(Pollen.createSurvey(Object.assign(minimal(), { description: 'x' }))).description, 'x');
});

test('scale questions always get five level labels derived from their anchors', () => {
  const q = Pollen.createSurvey(minimal()).questions[2];
  assert.deepStrictEqual(q.scaleLabels, ['1 - Low', '2', '3 - Orta', '4', '5 - High']);
  assert.deepStrictEqual(Pollen.defaultScaleLabels({}), ['1 - Çok düşük', '2', '3 - Orta', '4', '5 - Çok yüksek']);
});

test('explicit scale labels are preserved, partial ones are ignored', () => {
  const def = minimal();
  def.questions[2].scaleLabels = ['a', 'b', 'c', 'd', 'e'];
  assert.deepStrictEqual(Pollen.normalizeSurvey(def).questions[2].scaleLabels, ['a', 'b', 'c', 'd', 'e']);
  def.questions[2].scaleLabels = ['a', 'b'];
  assert.strictEqual(Pollen.normalizeSurvey(def).questions[2].scaleLabels.length, 5);
});

test('option ids stay unique inside a question even after reordering', () => {
  const def = {
    title: 'x',
    questions: [{ type: 'single', title: 'q', options: [{ id: 'opt1_2', text: 'a' }, { id: 'opt1_2', text: 'b' }, 'c'] }]
  };
  const ids = Pollen.normalizeSurvey(def).questions[0].options.map(o => o.id);
  assert.strictEqual(new Set(ids).size, 3);
});

test('rating and wordcloud questions need no options', () => {
  const s = Pollen.createSurvey({
    title: 'x',
    questions: [{ type: 'rating', title: 'r' }, { type: 'wordcloud', title: 'w', placeholder: ' tek kelime ' }]
  });
  assert.ok(!('options' in s.questions[0]));
  assert.strictEqual(s.questions[1].placeholder, 'tek kelime');
});

test('re-creating the BODTUM template from a definition without ids keeps ids positional', () => {
  const stripped = JSON.parse(JSON.stringify(Pollen.templates.bodtum));
  stripped.questions.forEach(q => { delete q.id; (q.options || []).forEach(o => delete o.id); });
  const rebuilt = Pollen.createSurvey(stripped);
  const original = Pollen.createSurvey(Pollen.templates.bodtum);
  assert.deepStrictEqual(rebuilt.questions.map(q => q.id), original.questions.map(q => q.id));
  assert.deepStrictEqual(
    rebuilt.questions.map(q => (q.options || []).map(o => o.id)),
    original.questions.map(q => (q.options || []).map(o => o.id))
  );
});

console.log('\n' + passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));

