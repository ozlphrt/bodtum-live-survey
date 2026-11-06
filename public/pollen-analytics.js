/*!
 * Pollen analytics: statistics, cross-tabulation, significance tests and rule-based insights
 * for any survey definition. Pure functions, no DOM, dependency-free UMD (runs in the browser and in Node tests).
 *
 * A "survey" here is the running survey object: { title, questions: [{ id, type, title, options, votes: { voterId: answer } }] }.
 * A "response" is one respondent: { id, answers: { questionId: answer } }.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PollenAnalytics = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ELIGIBLE = ['single', 'multi', 'scale', 'rating'];
  var STOPWORDS = {};
  ('ve bir bu da de ile için çok daha en gibi ama ya veya ki mi mı mu mü ne her o şu ben biz siz onlar var yok olarak olan oldu olur değil kadar sonra önce çünkü fakat ancak hem hiç bile the and of to a is')
    .split(' ').forEach(function (w) { STOPWORDS[w] = true; });

  // ------------------------------------------------------------------ formatting (Turkish decimal comma)

  function fmt1(x) { return (Math.round(x * 10) / 10).toFixed(1).replace('.', ','); }
  function fmt2(x) { return (Math.round(x * 100) / 100).toFixed(2).replace('.', ','); }
  function fmtPct(x) { return '%' + Math.round(x); }
  function fmtP(p) { return p < 0.001 ? 'p < 0,001' : 'p = ' + (Math.round(p * 1000) / 1000).toFixed(3).replace('.', ','); }

  // ------------------------------------------------------------------ responses

  function isAnswered(q, v) {
    if (v === undefined || v === null) return false;
    if (q.type === 'single') return typeof v === 'string' && v.length > 0;
    if (q.type === 'multi') return Array.isArray(v) && v.length > 0;
    if (q.type === 'scale' || q.type === 'rating') { var n = Number(v); return n >= 1 && n <= 5; }
    if (q.type === 'wordcloud') return typeof v === 'string' && v.trim().length > 0;
    return false;
  }

  /** Union of everyone who answered anything, with their answers per question. */
  function collectResponses(survey) {
    var map = {};
    var order = [];
    survey.questions.forEach(function (q) {
      Object.keys(q.votes || {}).forEach(function (vid) {
        if (!map[vid]) { map[vid] = { id: vid, answers: {} }; order.push(vid); }
        map[vid].answers[q.id] = q.votes[vid];
      });
    });
    return order.map(function (id) { return map[id]; });
  }

  function completionRate(survey, responses) {
    if (!responses.length) return 0;
    var done = responses.filter(function (r) {
      return survey.questions.every(function (q) { return isAnswered(q, r.answers[q.id]); });
    }).length;
    return done / responses.length * 100;
  }

  function questionById(survey, id) {
    for (var i = 0; i < survey.questions.length; i++) if (survey.questions[i].id === id) return survey.questions[i];
    return null;
  }

  // ------------------------------------------------------------------ segments

  /** The groups a question splits respondents into (options, or low/mid/high for numeric questions). */
  function segmentsFor(q) {
    if (q.type === 'single') {
      return (q.options || []).map(function (o) { return { id: o.id, label: o.text, test: function (v) { return v === o.id; } }; });
    }
    if (q.type === 'multi') {
      return (q.options || []).map(function (o) { return { id: o.id, label: o.text, test: function (v) { return Array.isArray(v) && v.indexOf(o.id) !== -1; } }; });
    }
    if (q.type === 'scale' || q.type === 'rating') {
      return [
        { id: 'low', label: 'Düşük (1-2)', test: function (v) { return Number(v) <= 2; } },
        { id: 'mid', label: 'Orta (3)', test: function (v) { return Number(v) === 3; } },
        { id: 'high', label: 'Yüksek (4-5)', test: function (v) { return Number(v) >= 4; } }
      ];
    }
    return [];
  }

  /** Keeps only the respondents inside one segment: segment = { questionId, segmentId }. */
  function filterResponses(survey, responses, segment) {
    if (!segment || !segment.questionId) return responses;
    var q = questionById(survey, segment.questionId);
    if (!q) return responses;
    var seg = segmentsFor(q).filter(function (s) { return s.id === segment.segmentId; })[0];
    if (!seg) return responses;
    return responses.filter(function (r) {
      var v = r.answers[q.id];
      return isAnswered(q, v) && seg.test(v);
    });
  }

  function segmentCounts(survey, responses, q) {
    return segmentsFor(q).map(function (s) {
      var n = 0;
      responses.forEach(function (r) { var v = r.answers[q.id]; if (isAnswered(q, v) && s.test(v)) n++; });
      return { id: s.id, label: s.label, count: n };
    });
  }

  // ------------------------------------------------------------------ per-question statistics

  function mean(xs) { var s = 0; for (var i = 0; i < xs.length; i++) s += xs[i]; return xs.length ? s / xs.length : 0; }
  function sd(xs) {
    if (xs.length < 2) return 0;
    var m = mean(xs), s = 0;
    xs.forEach(function (x) { s += (x - m) * (x - m); });
    return Math.sqrt(s / (xs.length - 1));
  }
  function median(xs) {
    if (!xs.length) return 0;
    var a = xs.slice().sort(function (p, q) { return p - q; });
    var mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }

  function tokens(text) {
    return String(text).toLocaleLowerCase('tr-TR').split(/[^a-zçğıöşü0-9]+/i).filter(function (w) { return w.length >= 3 && !STOPWORDS[w]; });
  }

  function questionStats(q, responses) {
    var values = [];
    responses.forEach(function (r) { var v = r.answers[q.id]; if (isAnswered(q, v)) values.push(v); });
    var n = values.length;

    if (q.type === 'single' || q.type === 'multi') {
      var counts = {};
      (q.options || []).forEach(function (o) { counts[o.id] = 0; });
      values.forEach(function (v) {
        (Array.isArray(v) ? v : [v]).forEach(function (id) { if (counts[id] !== undefined) counts[id]++; });
      });
      return {
        type: q.type, n: n,
        items: (q.options || []).map(function (o) { return { id: o.id, label: o.text, count: counts[o.id], pct: n ? counts[o.id] / n * 100 : 0 }; })
      };
    }

    if (q.type === 'scale' || q.type === 'rating') {
      var nums = values.map(Number);
      var dist = [1, 2, 3, 4, 5].map(function (k) {
        var c = nums.filter(function (x) { return x === k; }).length;
        return { value: k, count: c, pct: n ? c / n * 100 : 0 };
      });
      var labels = q.type === 'scale' ? q.scaleLabels : q.labels;
      return {
        type: q.type, n: n, mean: mean(nums), median: median(nums), sd: sd(nums), dist: dist,
        labels: labels || null,
        lowPct: n ? (dist[0].count + dist[1].count) / n * 100 : 0,
        highPct: n ? (dist[3].count + dist[4].count) / n * 100 : 0
      };
    }

    // open text
    var freq = {};
    values.forEach(function (v) { tokens(v).forEach(function (w) { freq[w] = (freq[w] || 0) + 1; }); });
    var words = Object.keys(freq).map(function (w) { return { word: w, count: freq[w] }; })
      .sort(function (a, b) { return b.count - a.count || (a.word < b.word ? -1 : 1); }).slice(0, 20);
    return { type: 'wordcloud', n: n, words: words, entries: values.slice(-8).reverse() };
  }

  // ------------------------------------------------------------------ significance

  function lgamma(x) {
    var c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    var y = x, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    var ser = 1.000000000190015;
    for (var j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }

  /** Regularised upper incomplete gamma Q(a, x). */
  function gammaQ(a, x) {
    if (x <= 0) return 1;
    var gln = lgamma(a);
    if (x < a + 1) {
      var ap = a, sum = 1 / a, del = sum;
      for (var n = 0; n < 500; n++) {
        ap++; del *= x / ap; sum += del;
        if (Math.abs(del) < Math.abs(sum) * 1e-13) break;
      }
      return 1 - sum * Math.exp(-x + a * Math.log(x) - gln);
    }
    var b = x + 1 - a, c = 1 / 1e-30, d = 1 / b, h = d;
    for (var i = 1; i < 500; i++) {
      var an = -i * (i - a);
      b += 2;
      d = an * d + b; if (Math.abs(d) < 1e-30) d = 1e-30;
      c = b + an / c; if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      var delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < 1e-13) break;
    }
    return Math.exp(-x + a * Math.log(x) - gln) * h;
  }

  /** p-value of a chi-square statistic. */
  function chiSquareP(chi2, df) { return df > 0 ? Math.min(1, Math.max(0, gammaQ(df / 2, chi2 / 2))) : 1; }

  function pearson(xs, ys) {
    var n = xs.length;
    if (n < 2) return null;
    var mx = mean(xs), my = mean(ys), sxy = 0, sxx = 0, syy = 0;
    for (var i = 0; i < n; i++) {
      var dx = xs[i] - mx, dy = ys[i] - my;
      sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    }
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
  }

  // ------------------------------------------------------------------ cross-tabulation

  function memberships(segs, v) {
    var out = [];
    segs.forEach(function (s, i) { if (s.test(v)) out.push(i); });
    return out;
  }

  /**
   * Rows = groups of question A, columns = groups of question B.
   * cells[i][j]   respondents in row i and column j
   * rowPct[i][j]  share of row i's respondents (who answered B) that fall in column j
   * test          chi-square independence test, only for mutually exclusive categories with enough data
   */
  function crosstab(survey, responses, qA, qB) {
    var rows = segmentsFor(qA), cols = segmentsFor(qB);
    var cells = rows.map(function () { return cols.map(function () { return 0; }); });
    var rowBase = rows.map(function () { return 0; });
    var colBase = cols.map(function () { return 0; });
    var nBoth = 0;

    responses.forEach(function (r) {
      var a = r.answers[qA.id], b = r.answers[qB.id];
      if (!isAnswered(qA, a) || !isAnswered(qB, b)) return;
      nBoth++;
      var ri = memberships(rows, a), ci = memberships(cols, b);
      ri.forEach(function (i) { rowBase[i]++; ci.forEach(function (j) { cells[i][j]++; }); });
      ci.forEach(function (j) { colBase[j]++; });
    });

    var rowPct = cells.map(function (row, i) {
      return row.map(function (c) { return rowBase[i] ? c / rowBase[i] * 100 : 0; });
    });
    var colShare = colBase.map(function (c) { return nBoth ? c / nBoth * 100 : 0; });
    var exclusive = qA.type !== 'multi' && qB.type !== 'multi';

    return {
      rowQuestion: qA, colQuestion: qB,
      rowSegs: rows.map(function (s) { return { id: s.id, label: s.label }; }),
      colSegs: cols.map(function (s) { return { id: s.id, label: s.label }; }),
      cells: cells, rowBase: rowBase, colBase: colBase, rowPct: rowPct, colShare: colShare,
      nBoth: nBoth, exclusive: exclusive,
      test: exclusive ? independenceTest(cells, nBoth) : { valid: false, reason: 'multi' }
    };
  }

  function independenceTest(cells, n) {
    if (n < 20) return { valid: false, reason: 'small' };
    var rowIdx = [], colIdx = [];
    cells.forEach(function (row, i) { if (row.some(function (c) { return c > 0; })) rowIdx.push(i); });
    if (!cells.length) return { valid: false, reason: 'small' };
    cells[0].forEach(function (_, j) { if (cells.some(function (row) { return row[j] > 0; })) colIdx.push(j); });
    if (rowIdx.length < 2 || colIdx.length < 2) return { valid: false, reason: 'flat' };

    var rt = rowIdx.map(function (i) { return colIdx.reduce(function (s, j) { return s + cells[i][j]; }, 0); });
    var ct = colIdx.map(function (j) { return rowIdx.reduce(function (s, i) { return s + cells[i][j]; }, 0); });
    var chi2 = 0, lowExpected = 0, minExpected = Infinity;
    var residuals = cells.map(function (row) { return row.map(function () { return 0; }); });

    rowIdx.forEach(function (i, a) {
      colIdx.forEach(function (j, b) {
        var e = rt[a] * ct[b] / n;
        minExpected = Math.min(minExpected, e);
        if (e < 5) lowExpected++;
        chi2 += (cells[i][j] - e) * (cells[i][j] - e) / e;
        var denom = Math.sqrt(e * (1 - rt[a] / n) * (1 - ct[b] / n));
        residuals[i][j] = denom ? (cells[i][j] - e) / denom : 0;
      });
    });

    var total = rowIdx.length * colIdx.length;
    if (minExpected < 1 || lowExpected / total > 0.2) return { valid: false, reason: 'sparse' };
    var df = (rowIdx.length - 1) * (colIdx.length - 1);
    var v = Math.sqrt(chi2 / (n * Math.min(rowIdx.length - 1, colIdx.length - 1)));
    return { valid: true, chi2: chi2, df: df, p: chiSquareP(chi2, df), v: v, residuals: residuals };
  }

  // ------------------------------------------------------------------ insights

  function q_(q) { return '“' + q.title + '”'; }

  /** Rule-based findings, strongest first. Each: { kind, score, title, text, questions: [ids] }. */
  function insights(survey, responses, options) {
    options = options || {};
    var limit = options.limit || 8;
    var out = [];
    var n = responses.length;
    if (!n) return out;

    var qs = survey.questions;
    var stats = {};
    qs.forEach(function (q) { stats[q.id] = questionStats(q, responses); });

    if (n < 10) {
      out.push({ kind: 'caution', score: 2, title: 'Az sayıda yanıt', text: 'Şu ana kadar yalnızca ' + n + ' katılımcı var; aşağıdaki bulgular yön göstericidir, kesin sonuç sayılmamalıdır.', questions: [] });
    }

    // single-question findings
    qs.forEach(function (q) {
      var s = stats[q.id];
      if (!s.n || s.n < 5) return;

      if (q.type === 'single' || q.type === 'multi') {
        var items = s.items.slice().sort(function (a, b) { return b.count - a.count; });
        var a = items[0], b = items[1];
        if (q.type === 'single' && a.pct >= 55) {
          out.push({ kind: 'consensus', score: 0.35 + a.pct / 200, title: 'Net bir çoğunluk', questions: [q.id],
            text: q_(q) + ' sorusunda katılımcıların çoğu “' + a.label + '” yanıtını seçti (' + fmtPct(a.pct) + ').' });
        } else if (q.type === 'multi' && a.pct >= 60) {
          out.push({ kind: 'consensus', score: 0.3 + a.pct / 250, title: 'En çok işaretlenen', questions: [q.id],
            text: q_(q) + ' sorusunda “' + a.label + '” seçeneği en çok işaretlenen yanıt (' + fmtPct(a.pct) + ').' });
        }
        if (q.type === 'single' && b && a.pct >= 25 && a.pct - b.pct <= 8) {
          out.push({ kind: 'split', score: 0.45, title: 'Bölünmüş görüş', questions: [q.id],
            text: q_(q) + ' sorusunda “' + a.label + '” (' + fmtPct(a.pct) + ') ile “' + b.label + '” (' + fmtPct(b.pct) + ') neredeyse eşit; görüşler bölünmüş.' });
        }
      } else if (q.type === 'scale' || q.type === 'rating') {
        if (s.mean >= 4) {
          out.push({ kind: 'high', score: 0.35 + (s.mean - 3) / 5, title: 'Yüksek puan', questions: [q.id],
            text: q_(q) + ' sorusunun ortalaması ' + fmt1(s.mean) + ' / 5 (4-5 puan verenlerin oranı ' + fmtPct(s.highPct) + ').' });
        } else if (s.mean <= 2) {
          out.push({ kind: 'low', score: 0.35 + (3 - s.mean) / 5, title: 'Düşük puan', questions: [q.id],
            text: q_(q) + ' sorusunun ortalaması ' + fmt1(s.mean) + ' / 5 (1-2 puan verenlerin oranı ' + fmtPct(s.lowPct) + ').' });
        }
        if (s.lowPct >= 30 && s.highPct >= 30) {
          out.push({ kind: 'polarized', score: 0.4 + Math.min(s.lowPct, s.highPct) / 100, title: 'Görüşler iki uca ayrıldı', questions: [q.id],
            text: q_(q) + ' sorusunda yanıtlar iki uca ayrıldı: ' + fmtPct(s.lowPct) + ' düşük (1-2), ' + fmtPct(s.highPct) + ' yüksek (4-5).' });
        }
      } else if (q.type === 'wordcloud' && s.words.length) {
        out.push({ kind: 'word', score: 0.2, title: 'Öne çıkan kelime', questions: [q.id],
          text: q_(q) + ' sorusunda en sık geçen kelime “' + s.words[0].word + '” (' + s.words[0].count + ' kez).' });
      }
    });

    // numeric pairs: gaps and correlations
    var numeric = qs.filter(function (q) { return q.type === 'scale' || q.type === 'rating'; });
    for (var i = 0; i < numeric.length; i++) {
      for (var j = i + 1; j < numeric.length; j++) {
        var A = numeric[i], B = numeric[j], xs = [], ys = [];
        responses.forEach(function (r) {
          if (isAnswered(A, r.answers[A.id]) && isAnswered(B, r.answers[B.id])) { xs.push(Number(r.answers[A.id])); ys.push(Number(r.answers[B.id])); }
        });
        if (xs.length < 8) continue;
        var diff = mean(xs) - mean(ys);
        if (Math.abs(diff) >= 0.8) {
          var hi = diff > 0 ? A : B, lo = diff > 0 ? B : A;
          out.push({ kind: 'gap', score: 0.3 + Math.abs(diff) / 4 * 1.2, title: 'Belirgin puan farkı', questions: [A.id, B.id],
            text: q_(hi) + ' ortalaması ' + fmt1(Math.max(mean(xs), mean(ys))) + ' iken ' + q_(lo) + ' ortalaması ' + fmt1(Math.min(mean(xs), mean(ys))) + ' (fark ' + fmt1(Math.abs(diff)) + ' puan).' });
        }
        if (xs.length >= 10) {
          var rr = pearson(xs, ys);
          if (rr !== null && Math.abs(rr) >= 0.5) {
            out.push({ kind: 'link', score: 0.3 + Math.abs(rr), title: rr > 0 ? 'Birlikte yükseliyor' : 'Ters yönde ilişki', questions: [A.id, B.id],
              text: q_(A) + ' ile ' + q_(B) + ' arasında güçlü ilişki var (r = ' + fmt2(rr) + '): ' +
                (rr > 0 ? 'biri yükseldikçe diğeri de yükseliyor.' : 'biri yükseldikçe diğeri düşüyor.') });
          }
        }
      }
    }

    // do segments of a single-choice question rate a numeric question differently?
    if (n >= 20) {
      qs.filter(function (q) { return q.type === 'single'; }).forEach(function (S) {
        numeric.forEach(function (N) {
          var groups = segmentsFor(S).map(function (seg) {
            var vals = [];
            responses.forEach(function (r) {
              if (isAnswered(S, r.answers[S.id]) && seg.test(r.answers[S.id]) && isAnswered(N, r.answers[N.id])) vals.push(Number(r.answers[N.id]));
            });
            return { label: seg.label, n: vals.length, mean: mean(vals) };
          }).filter(function (g) { return g.n >= 5; });
          if (groups.length < 2) return;
          groups.sort(function (a, b) { return b.mean - a.mean; });
          var top = groups[0], bottom = groups[groups.length - 1];
          var d = top.mean - bottom.mean;
          if (d >= 0.7) {
            out.push({ kind: 'segment', score: 0.3 + d / 4 * 1.1, title: 'Gruplar arasında fark', questions: [S.id, N.id],
              text: q_(S) + ' sorusunda “' + top.label + '” diyenlerin ' + q_(N) + ' ortalaması ' + fmt1(top.mean) + ' (n=' + top.n + '), “' + bottom.label + '” diyenlerde ' + fmt1(bottom.mean) + ' (n=' + bottom.n + ').' });
          }
        });
      });
    }

    // associations between categorical questions (at least one single-choice)
    if (n >= 20) {
      var eligible = qs.filter(function (q) { return ELIGIBLE.indexOf(q.type) !== -1 && q.type !== 'multi'; });
      for (var a = 0; a < eligible.length; a++) {
        for (var b = a + 1; b < eligible.length; b++) {
          var QA = eligible[a], QB = eligible[b];
          if (QA.type !== 'single' && QB.type !== 'single') continue;
          var ct = crosstab(survey, responses, QA, QB);
          var t = ct.test;
          if (!t.valid || t.p >= 0.05 || t.v < 0.3) continue;
          var best = null;
          ct.cells.forEach(function (row, ri) {
            row.forEach(function (_, cj) {
              var res = t.residuals[ri][cj];
              if (!best || res > best.res) best = { res: res, ri: ri, cj: cj };
            });
          });
          var extra = best && best.res >= 2
            ? ' En belirgin: “' + ct.rowSegs[best.ri].label + '” diyenlerde “' + ct.colSegs[best.cj].label + '” oranı ' + fmtPct(ct.rowPct[best.ri][best.cj]) + ' (genel ' + fmtPct(ct.colShare[best.cj]) + ').'
            : '';
          out.push({ kind: 'association', score: 0.3 + t.v * 1.2, title: 'Anlamlı ilişki', questions: [QA.id, QB.id],
            text: q_(QA) + ' ile ' + q_(QB) + ' yanıtları birbiriyle ilişkili (Cramér V = ' + fmt2(t.v) + ', ' + fmtP(t.p) + ').' + extra });
        }
      }
    }

    // strongest first, at most 3 of the same kind
    out.sort(function (x, y) { return y.score - x.score; });
    var perKind = {};
    var picked = out.filter(function (item) {
      perKind[item.kind] = (perKind[item.kind] || 0) + 1;
      return item.kind === 'caution' || perKind[item.kind] <= 3;
    });
    return picked.slice(0, limit);
  }

  /** The question pair with the most significant association (or the first two eligible questions). */
  function strongestPair(survey, responses) {
    var eligible = survey.questions.filter(function (q) { return ELIGIBLE.indexOf(q.type) !== -1; });
    var best = null;
    for (var i = 0; i < eligible.length; i++) {
      for (var j = i + 1; j < eligible.length; j++) {
        var t = crosstab(survey, responses, eligible[i], eligible[j]).test;
        if (t && t.valid && (!best || t.p < best.p)) best = { a: eligible[i].id, b: eligible[j].id, p: t.p };
      }
    }
    if (best) return { rowId: best.a, colId: best.b };
    if (eligible.length >= 2) return { rowId: eligible[0].id, colId: eligible[1].id };
    return null;
  }

  /** Composite score per dashboard tag: mean of the means of its scale / rating questions. */
  function tagScores(survey, responses) {
    var groups = {};
    survey.questions.forEach(function (q) {
      if (!q.tag || (q.type !== 'scale' && q.type !== 'rating')) return;
      var s = questionStats(q, responses);
      if (!s.n) return;
      (groups[q.tag] = groups[q.tag] || []).push(s.mean);
    });
    return Object.keys(groups).map(function (tag) {
      return { tag: tag, score: mean(groups[tag]), questions: groups[tag].length };
    }).sort(function (a, b) { return b.score - a.score; });
  }

  return {
    ELIGIBLE: ELIGIBLE,
    collectResponses: collectResponses,
    completionRate: completionRate,
    isAnswered: isAnswered,
    questionById: questionById,
    segmentsFor: segmentsFor,
    segmentCounts: segmentCounts,
    filterResponses: filterResponses,
    questionStats: questionStats,
    crosstab: crosstab,
    chiSquareP: chiSquareP,
    pearson: pearson,
    insights: insights,
    strongestPair: strongestPair,
    tagScores: tagScores,
    fmt1: fmt1, fmt2: fmt2, fmtPct: fmtPct, fmtP: fmtP
  };
});
