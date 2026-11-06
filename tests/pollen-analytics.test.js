'use strict';
const assert = require('assert');
const A = require('../public/pollen-analytics.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (err) { console.error('FAIL  ' + name + '\n      ' + err.message); process.exitCode = 1; }
}
const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, (msg || '') + ' expected ' + b + ' ± ' + eps + ', got ' + a);

// 40 respondents: group a (20) and group b (20). Built so every figure below can be computed by hand.
//   q1 single  a|b                         20 / 20
//   q2 single  x|y                         a: 15x 5y   b: 5x 15y        -> chi2 = 10, df 1, V = 0.5
//   q3 scale   a: 4,5 alternating   b: 1,2 alternating                -> mean 3.0, 50% low / 50% high
//   q4 scale   a: 4   b: 2                                             -> perfectly correlated with q3's groups
//   q5 multi   everybody picks m1, group a also m2
//   q6 text
function dataset() {
  const q = [
    { id: 'q1', type: 'single', title: 'Grup', options: [{ id: 'a', text: 'A grubu' }, { id: 'b', text: 'B grubu' }], votes: {} },
    { id: 'q2', type: 'single', title: 'Tercih', options: [{ id: 'x', text: 'X' }, { id: 'y', text: 'Y' }], votes: {} },
    { id: 'q3', type: 'scale', title: 'Memnuniyet', leftLabel: 'Kötü', rightLabel: 'İyi', votes: {} },
    { id: 'q4', type: 'scale', title: 'Tavsiye', votes: {} },
    { id: 'q5', type: 'multi', title: 'Araçlar', options: [{ id: 'm1', text: 'M1' }, { id: 'm2', text: 'M2' }], votes: {} },
    { id: 'q6', type: 'wordcloud', title: 'Tek kelime', votes: {} }
  ];
  for (let i = 0; i < 40; i++) {
    const v = 'v' + i;
    const a = i < 20;
    const k = a ? i : i - 20;
    q[0].votes[v] = a ? 'a' : 'b';
    q[1].votes[v] = a ? (k < 15 ? 'x' : 'y') : (k < 5 ? 'x' : 'y');
    q[2].votes[v] = a ? (k % 2 ? 5 : 4) : (k % 2 ? 2 : 1);
    q[3].votes[v] = a ? 4 : 2;
    q[4].votes[v] = a ? ['m1', 'm2'] : ['m1'];
    q[5].votes[v] = a ? 'Hızlı VE güvenilir' : 'Karmaşık';
  }
  return { title: 'Test', questions: q };
}
const get = (s, id) => A.questionById(s, id);

console.log('pollen-analytics');

test('p-values match the standard chi-square critical values', () => {
  close(A.chiSquareP(3.841, 1), 0.05, 0.001);
  close(A.chiSquareP(5.991, 2), 0.05, 0.001);
  close(A.chiSquareP(9.488, 4), 0.05, 0.001);
  close(A.chiSquareP(6.635, 1), 0.01, 0.0005);
  assert.strictEqual(A.chiSquareP(0, 3), 1);
});

test('pearson: perfect, inverse, flat and too-short input', () => {
  close(A.pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1, 1e-9);
  close(A.pearson([1, 2, 3, 4], [8, 6, 4, 2]), -1, 1e-9);
  assert.strictEqual(A.pearson([1, 1, 1], [1, 2, 3]), null);
  assert.strictEqual(A.pearson([1], [1]), null);
});

test('formatting uses the Turkish decimal comma', () => {
  assert.strictEqual(A.fmt1(4.25), '4,3');
  assert.strictEqual(A.fmt2(0.5), '0,50');
  assert.strictEqual(A.fmtPct(61.4), '%61');
  assert.strictEqual(A.fmtP(0.0004), 'p < 0,001');
  assert.strictEqual(A.fmtP(0.0123), 'p = 0,012');
});

test('collectResponses merges voters across questions; completion counts only full answers', () => {
  const s = dataset();
  delete s.questions[5].votes.v0; // v0 skipped the last question
  s.questions[0].votes.late = 'a'; // a respondent who only answered the first question
  const r = A.collectResponses(s);
  assert.strictEqual(r.length, 41);
  assert.strictEqual(r.find(x => x.id === 'late').answers.q2, undefined);
  close(A.completionRate(s, r), 39 / 41 * 100, 1e-9);
  assert.strictEqual(A.completionRate(s, []), 0);
});

test('choice statistics: counts and percentages of respondents', () => {
  const s = dataset();
  const st = A.questionStats(get(s, 'q2'), A.collectResponses(s));
  assert.strictEqual(st.n, 40);
  assert.deepStrictEqual(st.items.map(i => i.count), [20, 20]);
  const multi = A.questionStats(get(s, 'q5'), A.collectResponses(s));
  assert.deepStrictEqual(multi.items.map(i => i.count), [40, 20]);
  close(multi.items[1].pct, 50, 1e-9);
});

test('numeric statistics: mean, median, spread and the low/high shares', () => {
  const s = dataset();
  const st = A.questionStats(get(s, 'q3'), A.collectResponses(s));
  close(st.mean, 3, 1e-9);
  assert.strictEqual(st.median, 3);
  assert.deepStrictEqual(st.dist.map(d => d.count), [10, 10, 0, 10, 10]);
  close(st.lowPct, 50, 1e-9);
  close(st.highPct, 50, 1e-9);
  assert.ok(st.sd > 1.5 && st.sd < 1.7);
});

test('open text: stop words dropped, Turkish lower-casing, most frequent first', () => {
  const s = dataset();
  const st = A.questionStats(get(s, 'q6'), A.collectResponses(s));
  assert.deepStrictEqual(st.words.map(w => w.word).slice(0, 3).sort(), ['güvenilir', 'hızlı', 'karmaşık'].sort());
  assert.ok(!st.words.some(w => w.word === 've'));
  const r = [{ id: 'z', answers: { q6: 'IŞIK Işık' } }];
  assert.deepStrictEqual(A.questionStats(get(s, 'q6'), r).words, [{ word: 'ışık', count: 2 }]);
});

test('segments: options for choice questions, low/mid/high for numeric ones', () => {
  const s = dataset();
  assert.deepStrictEqual(A.segmentsFor(get(s, 'q1')).map(x => x.id), ['a', 'b']);
  assert.deepStrictEqual(A.segmentsFor(get(s, 'q3')).map(x => x.id), ['low', 'mid', 'high']);
  assert.deepStrictEqual(A.segmentsFor(get(s, 'q6')), []);
  const counts = A.segmentCounts(s, A.collectResponses(s), get(s, 'q3')).map(c => c.count);
  assert.deepStrictEqual(counts, [20, 0, 20]);
});

test('filtering by a segment keeps only matching respondents (also for multi-select)', () => {
  const s = dataset();
  const all = A.collectResponses(s);
  assert.strictEqual(A.filterResponses(s, all, { questionId: 'q1', segmentId: 'a' }).length, 20);
  assert.strictEqual(A.filterResponses(s, all, { questionId: 'q5', segmentId: 'm2' }).length, 20);
  assert.strictEqual(A.filterResponses(s, all, { questionId: 'q3', segmentId: 'high' }).length, 20);
  assert.strictEqual(A.filterResponses(s, all, null).length, 40);
  assert.strictEqual(A.filterResponses(s, all, { questionId: 'nope', segmentId: 'a' }).length, 40);
  const onlyA = A.filterResponses(s, all, { questionId: 'q1', segmentId: 'a' });
  close(A.questionStats(get(s, 'q3'), onlyA).mean, 4.5, 1e-9);
});

test('crosstab 2x2: counts, row percentages, and the chi-square test (chi2 = 10, V = 0.5)', () => {
  const s = dataset();
  const ct = A.crosstab(s, A.collectResponses(s), get(s, 'q1'), get(s, 'q2'));
  assert.deepStrictEqual(ct.cells, [[15, 5], [5, 15]]);
  assert.deepStrictEqual(ct.rowBase, [20, 20]);
  close(ct.rowPct[0][0], 75, 1e-9);
  close(ct.colShare[0], 50, 1e-9);
  assert.strictEqual(ct.nBoth, 40);
  assert.ok(ct.test.valid);
  close(ct.test.chi2, 10, 1e-9);
  assert.strictEqual(ct.test.df, 1);
  close(ct.test.p, 0.00157, 0.0001);
  close(ct.test.v, 0.5, 1e-9);
  assert.ok(ct.test.residuals[0][0] > 2 && ct.test.residuals[0][1] < -2);
});

test('crosstab with a numeric question buckets it; empty bucket columns are ignored by the test', () => {
  const s = dataset();
  const ct = A.crosstab(s, A.collectResponses(s), get(s, 'q1'), get(s, 'q3'));
  assert.deepStrictEqual(ct.colSegs.map(c => c.id), ['low', 'mid', 'high']);
  assert.deepStrictEqual(ct.cells, [[0, 0, 20], [20, 0, 0]]);
  assert.ok(ct.test.valid);
  assert.strictEqual(ct.test.df, 1);
});

test('multi-select crosstabs count people in several rows and skip the significance test', () => {
  const s = dataset();
  const ct = A.crosstab(s, A.collectResponses(s), get(s, 'q5'), get(s, 'q1'));
  assert.deepStrictEqual(ct.rowBase, [40, 20]);
  assert.deepStrictEqual(ct.cells, [[20, 20], [20, 0]]);
  assert.strictEqual(ct.exclusive, false);
  assert.deepStrictEqual(ct.test, { valid: false, reason: 'multi' });
});

test('the test is withheld for small, flat or sparse tables', () => {
  const s = dataset();
  const few = A.collectResponses(s).slice(0, 12);
  assert.strictEqual(A.crosstab(s, few, get(s, 'q1'), get(s, 'q2')).test.reason, 'small');

  const flat = A.collectResponses(s).filter(r => r.answers.q1 === 'a');
  assert.strictEqual(A.crosstab(s, flat, get(s, 'q1'), get(s, 'q2')).test.reason, 'flat');

  const sparse = dataset();
  sparse.questions[1].votes = {};
  for (let i = 0; i < 40; i++) sparse.questions[1].votes['v' + i] = i < 38 ? 'x' : 'y';
  assert.strictEqual(A.crosstab(sparse, A.collectResponses(sparse), get(sparse, 'q1'), get(sparse, 'q2')).test.reason, 'sparse');
});

test('insights find the planted patterns', () => {
  const s = dataset();
  const found = A.insights(s, A.collectResponses(s), { limit: 50 });
  const kinds = found.map(i => i.kind);
  assert.ok(kinds.includes('polarized'), 'polarization of q3');
  assert.ok(kinds.includes('segment'), 'group difference on q3');
  assert.ok(kinds.includes('association'), 'q1 x q2 association');
  assert.ok(kinds.includes('link'), 'q3 and q4 move together');
  assert.ok(kinds.includes('word'));
  const assoc = found.find(i => i.kind === 'association' && i.questions.join() === 'q1,q2');
  assert.ok(assoc.text.includes('Cramér V = 0,50') && assoc.text.includes('p = 0,002'), assoc.text);
  assert.ok(assoc.text.includes('En belirgin'), 'names the strongest cell');
  assert.ok(A.insights(s, A.collectResponses(s)).length <= 8, 'default limit');
  for (let i = 1; i < found.length; i++) assert.ok(found[i - 1].score >= found[i].score, 'sorted by strength');
});

test('insights: consensus, split vote, high score, and a gap between two questions', () => {
  const s = {
    title: 'T', questions: [
      { id: 'c', type: 'single', title: 'Çoğunluk', options: [{ id: '1', text: 'Evet' }, { id: '2', text: 'Hayır' }], votes: {} },
      { id: 'd', type: 'single', title: 'Bölünmüş', options: [{ id: '1', text: 'Sol' }, { id: '2', text: 'Sağ' }], votes: {} },
      { id: 'h', type: 'scale', title: 'Yüksek', votes: {} },
      { id: 'l', type: 'scale', title: 'Düşük', votes: {} }
    ]
  };
  for (let i = 0; i < 20; i++) {
    const v = 'v' + i;
    s.questions[0].votes[v] = i < 16 ? '1' : '2';       // 80 %
    s.questions[1].votes[v] = i < 10 ? '1' : '2';       // 50 / 50 -> within 8 points
    s.questions[2].votes[v] = i % 5 === 0 ? 4 : 5;      // mean 4.8
    s.questions[3].votes[v] = i % 5 === 0 ? 2 : 1;      // mean 1.2 (also > 0.8 gap vs q 'h')
  }
  const found = A.insights(s, A.collectResponses(s));
  const byKind = k => found.find(i => i.kind === k);
  assert.ok(byKind('consensus').text.includes('“Evet”') && byKind('consensus').text.includes('%80'));
  assert.ok(byKind('split').text.includes('“Sol” (%50)') && byKind('split').text.includes('“Sağ” (%50)'), byKind('split').text);
  assert.ok(byKind('high'));
  assert.ok(byKind('low'));
  const gap = byKind('gap');
  assert.ok(gap.text.includes('4,8') && gap.text.includes('1,2') && gap.text.includes('fark 3,6'), gap.text);
});

test('insights: few respondents produce a caution first; nothing at all for no data', () => {
  const s = dataset();
  Object.values(s.questions).forEach(q => {
    Object.keys(q.votes).forEach(v => { if (Number(v.slice(1)) >= 6) delete q.votes[v]; });
  });
  const found = A.insights(s, A.collectResponses(s));
  assert.strictEqual(found[0].kind, 'caution');
  assert.deepStrictEqual(A.insights(s, []), []);
});

test('no more than three insights of one kind', () => {
  const s = { title: 'T', questions: [] };
  for (let k = 0; k < 8; k++) {
    const q = { id: 'q' + k, type: 'scale', title: 'S' + k, votes: {} };
    for (let i = 0; i < 12; i++) q.votes['v' + i] = 5;
    s.questions.push(q);
  }
  const found = A.insights(s, A.collectResponses(s), { limit: 20 });
  assert.ok(found.filter(i => i.kind === 'high').length <= 3);
});

test('strongestPair picks the most significant pair, falls back to the first two questions', () => {
  const s = dataset();
  const pair = A.strongestPair(s, A.collectResponses(s));
  assert.deepStrictEqual(pair, { rowId: 'q1', colId: 'q3' });
  assert.deepStrictEqual(A.strongestPair(s, []), { rowId: 'q1', colId: 'q2' });
  assert.strictEqual(A.strongestPair({ title: 't', questions: [s.questions[5]] }, []), null);
});

test('tag scores average the means of the scale / rating questions that share a tag', () => {
  const s = dataset();
  s.questions[2].tag = 'duygu';
  s.questions[3].tag = 'duygu';
  s.questions[0].tag = 'grup'; // not numeric -> ignored
  const scores = A.tagScores(s, A.collectResponses(s));
  assert.strictEqual(scores.length, 1);
  assert.strictEqual(scores[0].tag, 'duygu');
  assert.strictEqual(scores[0].questions, 2);
  close(scores[0].score, 3, 1e-9);
});

console.log('\n' + passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
