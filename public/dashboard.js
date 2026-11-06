/*
 * Generic survey dashboard (presenter side): works for any survey definition.
 *   - segment filter (everything below is computed for the chosen group)
 *   - KPIs, tag scores, auto-generated insights
 *   - cross-analysis heat map with significance test
 *   - per-question results
 * All numbers come from PollenAnalytics; this file only draws them.
 * pdfSummaryHtml() produces the same findings in a light theme for the PDF report.
 */
(function () {
  'use strict';

  var A = window.PollenAnalytics;
  var state = { key: '', segQ: '', segId: '', rowQ: '', colQ: '' };

  var KINDS = {
    consensus: ['Çoğunluk', '#34d399'], split: ['Bölünme', '#fbbf24'], high: ['Yüksek', '#34d399'], low: ['Düşük', '#f87171'],
    polarized: ['Kutuplaşma', '#f87171'], gap: ['Fark', '#fbbf24'], link: ['İlişki', '#60a5fa'], segment: ['Grup farkı', '#a78bfa'],
    association: ['İstatistik', '#60a5fa'], word: ['Kelime', '#94a3b8'], caution: ['Uyarı', '#fbbf24']
  };
  var TYPE_NAMES = { single: 'Tek seçim', multi: 'Çoklu seçim', scale: '1-5 ölçek', rating: 'Yıldız puanı', wordcloud: 'Açık uçlu' };
  var TEST_NOTES = {
    multi: 'Çoklu seçimde bir kişi birden fazla hücrede yer alabildiği için anlamlılık testi hesaplanmaz.',
    flat: 'Karşılaştırma için en az iki farklı yanıt grubu gerekir.',
    sparse: 'Hücrelerde yeterli gözlem yok; test güvenilir olmaz.'
  };

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function trunc(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  function eligible(survey) {
    return survey.questions.filter(function (q) { return A.ELIGIBLE.indexOf(q.type) !== -1; });
  }
  function qLabel(survey, q) { return 'Soru ' + (survey.questions.indexOf(q) + 1) + ': ' + trunc(q.title, 70); }

  function testSummary(ct) {
    var t = ct.test;
    if (t.valid) {
      return 'χ² = ' + A.fmt2(t.chi2) + ' (sd = ' + t.df + '), ' + A.fmtP(t.p) + ', Cramér V = ' + A.fmt2(t.v) + '. ' +
        (t.p < 0.05 ? 'İlişki istatistiksel olarak anlamlı.' : 'Anlamlı bir ilişki saptanmadı.');
    }
    if (t.reason === 'small') return 'Anlamlılık testi için en az 20 ortak yanıt gerekir (şu an ' + ct.nBoth + ').';
    return TEST_NOTES[t.reason] || '';
  }

  /** Keeps selections valid; picks the strongest question pair for the cross-analysis by default. */
  function syncState(survey, all) {
    var key = survey.questions.map(function (q) { return q.id + ':' + q.type; }).join('|');
    if (state.key !== key) { state.key = key; state.segQ = ''; state.segId = ''; state.rowQ = ''; state.colQ = ''; }
    if (state.segQ && !A.questionById(survey, state.segQ)) { state.segQ = ''; state.segId = ''; }
    var okPair = state.rowQ && state.colQ && A.questionById(survey, state.rowQ) && A.questionById(survey, state.colQ);
    if (!okPair) {
      var p = A.strongestPair(survey, all);
      state.rowQ = p ? p.rowId : '';
      state.colQ = p ? p.colId : '';
    }
  }

  // ------------------------------------------------------------------ dark UI

  function barRow(label, pct, count, accent) {
    return '<div class="gd-bar"><div class="gd-bar-fill" style="width:' + Math.max(0, Math.min(100, pct)).toFixed(1) + '%;background:' + accent + '"></div>' +
      '<div class="gd-bar-row"><span class="gd-bar-label">' + esc(label) + '</span><span class="gd-bar-num">' + count + ' · <b>' + A.fmtPct(pct) + '</b></span></div></div>';
  }

  function questionCard(survey, q, rs) {
    var s = A.questionStats(q, rs);
    var body = '';
    if (q.type === 'single' || q.type === 'multi') {
      var maxPct = Math.max.apply(null, s.items.map(function (i) { return i.pct; }).concat([0]));
      body = s.items.map(function (i) { return barRow(i.label, i.pct, i.count, i.pct === maxPct && s.n > 1 ? 'rgba(200,16,46,0.35)' : 'rgba(59,130,246,0.30)'); }).join('');
    } else if (q.type === 'scale' || q.type === 'rating') {
      body = '<div class="gd-mean"><strong>' + (s.n ? A.fmt1(s.mean) : '—') + '</strong><span>/ 5 ortalama</span>' +
        (s.n > 1 ? '<span class="gd-dim">ss ' + A.fmt1(s.sd) + ' · medyan ' + A.fmt1(s.median) + '</span>' : '') + '</div>' +
        s.dist.map(function (d) {
          var label = (s.labels && s.labels[d.value - 1]) || String(d.value);
          return barRow(label, d.pct, d.count, 'rgba(16,185,129,0.30)');
        }).join('');
    } else {
      body = s.words.length
        ? '<div class="gd-words">' + s.words.map(function (w) { return '<span class="gd-word">' + esc(w.word) + ' <em>' + w.count + '</em></span>'; }).join('') + '</div>'
        : '<div class="gd-dim">Henüz yanıt yok.</div>';
      if (s.entries.length) {
        body += '<div class="gd-quotes">' + s.entries.slice(0, 4).map(function (t) { return '<div>“' + esc(t) + '”</div>'; }).join('') + '</div>';
      }
    }
    return '<div class="gd-card gd-qcard"><div class="gd-qhead"><span class="gd-chip red">Soru ' + (survey.questions.indexOf(q) + 1) + '</span>' +
      '<span class="gd-chip">' + TYPE_NAMES[q.type] + '</span>' + (q.tag ? '<span class="gd-chip tag">' + esc(q.tag) + '</span>' : '') +
      '<span class="gd-n">' + s.n + ' yanıt</span></div><div class="gd-qtitle">' + esc(q.title) + '</div>' + body + '</div>';
  }

  function crossSection(survey, rs) {
    var qs = eligible(survey);
    if (qs.length < 2) {
      return '<div class="gd-card"><div class="gd-dim">Çapraz analiz için en az iki seçim / ölçek sorusu gerekir.</div></div>';
    }
    var opts = function (selected) {
      return qs.map(function (q) { return '<option value="' + esc(q.id) + '"' + (q.id === selected ? ' selected' : '') + '>' + esc(qLabel(survey, q)) + '</option>'; }).join('');
    };
    var head = '<div class="gd-xt-pick"><label>Satırlar<select data-gd="rowQ">' + opts(state.rowQ) + '</select></label>' +
      '<label>Sütunlar<select data-gd="colQ">' + opts(state.colQ) + '</select></label></div>';

    var qa = A.questionById(survey, state.rowQ), qb = A.questionById(survey, state.colQ);
    if (!qa || !qb || qa === qb) {
      return '<div class="gd-card">' + head + '<div class="gd-dim">Satır ve sütun için farklı iki soru seçin.</div></div>';
    }
    var ct = A.crosstab(survey, rs, qa, qb);
    if (!ct.nBoth) return '<div class="gd-card">' + head + '<div class="gd-dim">Bu iki soruya birlikte yanıt veren katılımcı yok.</div></div>';

    var t = ct.test;
    var thead = '<tr><th class="gd-corner">' + esc(trunc(qa.title, 28)) + ' ↓ &nbsp; ' + esc(trunc(qb.title, 28)) + ' →</th>' +
      ct.colSegs.map(function (c, j) { return '<th>' + esc(trunc(c.label, 40)) + '<small>genel ' + A.fmtPct(ct.colShare[j]) + '</small></th>'; }).join('') + '</tr>';
    var tbody = ct.rowSegs.map(function (r, i) {
      var cells = ct.colSegs.map(function (c, j) {
        if (!ct.rowBase[i]) return '<td class="empty">—</td>';
        var pct = ct.rowPct[i][j];
        var res = t.valid ? t.residuals[i][j] : 0;
        var cls = res >= 2 ? ' up' : (res <= -2 ? ' down' : '');
        var mark = res >= 2 ? '<i>▲</i>' : (res <= -2 ? '<i>▼</i>' : '');
        return '<td class="' + cls.trim() + '" style="--a:' + (0.05 + 0.6 * pct / 100).toFixed(2) + '"><b>' + Math.round(pct) + '%</b>' + mark + '<small>' + ct.cells[i][j] + '</small></td>';
      }).join('');
      return '<tr><th>' + esc(trunc(r.label, 44)) + '<small>n = ' + ct.rowBase[i] + '</small></th>' + cells + '</tr>';
    }).join('');

    return '<div class="gd-card">' + head +
      '<div class="gd-xt-scroll"><table class="gd-xt"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table></div>' +
      '<div class="gd-xt-note"><strong>' + ct.nBoth + '</strong> ortak yanıt. Her satır, o gruptaki kişilerin yanıt dağılımını gösterir (yüzde ve kişi sayısı). ' +
      (t.valid ? '▲ ▼ beklenenden belirgin fazla / az olan hücreleri işaretler. ' : '') + '<br>' + esc(testSummary(ct)) + '</div></div>';
  }

  function insightSection(survey, rs) {
    var list = A.insights(survey, rs);
    if (!list.length) return '<div class="gd-card"><div class="gd-dim">Henüz belirgin bir bulgu yok. Daha fazla yanıt geldikçe burada otomatik içgörüler görünecek.</div></div>';
    return '<div class="gd-insights">' + list.map(function (it) {
      var k = KINDS[it.kind] || ['Bulgu', '#94a3b8'];
      var pair = it.questions.length === 2
        ? '<button type="button" class="gd-link" data-gd-pair="' + esc(it.questions.join('|')) + '">Çapraz analizde aç →</button>' : '';
      return '<div class="gd-insight" style="--k:' + k[1] + '"><div class="gd-insight-kind">' + k[0] + '</div>' +
        '<div class="gd-insight-body"><div class="gd-insight-title">' + esc(it.title) + '</div><div class="gd-insight-text">' + esc(it.text) + '</div>' + pair + '</div></div>';
    }).join('') + '</div>';
  }

  function filterBar(survey, all, rs) {
    var qs = eligible(survey);
    var opts = '<option value="">Tüm katılımcılar</option>' + qs.map(function (q) {
      return '<option value="' + esc(q.id) + '"' + (q.id === state.segQ ? ' selected' : '') + '>' + esc(qLabel(survey, q)) + '</option>';
    }).join('');
    var chips = '';
    if (state.segQ) {
      var q = A.questionById(survey, state.segQ);
      chips = '<div class="gd-chips">' + A.segmentCounts(survey, all, q).map(function (c) {
        return '<button type="button" class="gd-seg' + (c.id === state.segId ? ' active' : '') + '" data-gd-seg="' + esc(c.id) + '"' + (c.count ? '' : ' disabled') + '>' +
          esc(trunc(c.label, 40)) + ' <em>' + c.count + '</em></button>';
      }).join('') + '</div>';
    }
    var active = state.segQ && state.segId;
    return '<div class="gd-filter"><span class="gd-label">Grup filtresi</span><select data-gd="segQ">' + opts + '</select>' + chips +
      (active ? '<span class="gd-filtered">Gösterilen: <b>' + rs.length + '</b> / ' + all.length + ' katılımcı</span><button type="button" class="gd-link" data-gd="clear">Temizle ×</button>' : '') + '</div>';
  }

  function render(container, survey, hooks) {
    var scroll = container.scrollTop;
    var all = A.collectResponses(survey);

    if (!all.length) {
      container.innerHTML = '<div class="gd-empty"><h2>' + esc(survey.title) + '</h2><p>Henüz yanıt yok. Katılımcılar oy verdikçe burada otomatik analiz görünecek.</p>' +
        '<button type="button" class="btn-primary gd-demo" data-gd="demo">15 demo yanıt ile paneli dene</button></div>';
      bind(container, survey, hooks);
      return;
    }

    syncState(survey, all);
    var segment = state.segQ && state.segId ? { questionId: state.segQ, segmentId: state.segId } : null;
    var rs = A.filterResponses(survey, all, segment);

    var numeric = survey.questions.filter(function (q) { return q.type === 'scale' || q.type === 'rating'; });
    var means = numeric.map(function (q) { return A.questionStats(q, rs); }).filter(function (s) { return s.n; }).map(function (s) { return s.mean; });
    var avg = means.length ? means.reduce(function (a, b) { return a + b; }, 0) / means.length : null;
    var kpis = [
      ['Katılımcı', String(rs.length), segment ? 'tüm grup: ' + all.length : 'toplam yanıtlayan'],
      ['Tamamlama', A.fmtPct(A.completionRate(survey, rs)), 'tüm soruları yanıtlayan'],
      ['Soru', String(survey.questions.length), survey.questions.filter(function (q) { return q.tag; }).length + ' etiketli'],
      avg !== null ? ['Ortalama puan', A.fmt1(avg), 'ölçek / yıldız soruları'] : ['Açık uçlu yanıt', String(rs.length), 'katılımcı']
    ].map(function (k) { return '<div class="gd-kpi"><div class="gd-kpi-v">' + esc(k[1]) + '</div><div class="gd-kpi-l">' + k[0] + '</div><div class="gd-kpi-s">' + esc(k[2]) + '</div></div>'; }).join('');

    var tags = A.tagScores(survey, rs);
    var tagHtml = tags.length ? '<div class="gd-section-title">Boyut skorları</div><div class="gd-tags">' + tags.map(function (t) {
      return '<div class="gd-tag"><div class="gd-tag-top"><span>' + esc(t.tag) + '</span><b>' + A.fmt1(t.score) + ' <small>/ 5</small></b></div>' +
        '<div class="gd-tag-bar"><i style="width:' + (t.score / 5 * 100).toFixed(0) + '%"></i></div><div class="gd-kpi-s">' + t.questions + ' soru</div></div>';
    }).join('') + '</div>' : '';

    container.innerHTML = '<div class="gd">' +
      '<div class="gd-head"><div><div class="gd-eyebrow">ANALİZ PANELİ</div><h2>' + esc(survey.title) + '</h2></div></div>' +
      filterBar(survey, all, rs) +
      '<div class="gd-kpis">' + kpis + '</div>' + tagHtml +
      (rs.length < 30 ? '<div class="gd-note">Yanıt sayısı az (' + rs.length + '); sonuçlar yön göstericidir.</div>' : '') +
      '<div class="gd-section-title">Öne çıkan içgörüler</div>' + insightSection(survey, rs) +
      '<div class="gd-section-title" id="gdCross">Çapraz analiz</div>' + crossSection(survey, rs) +
      '<div class="gd-section-title">Soru bazlı sonuçlar</div><div class="gd-qgrid">' + survey.questions.map(function (q) { return questionCard(survey, q, rs); }).join('') + '</div>' +
      '</div>';
    container.scrollTop = scroll;
    bind(container, survey, hooks);
  }

  function bind(container, survey, hooks) {
    function redraw() { render(container, survey, hooks); }
    container.onchange = function (e) {
      var key = e.target.getAttribute && e.target.getAttribute('data-gd');
      if (key === 'segQ') { state.segQ = e.target.value; state.segId = ''; redraw(); }
      else if (key === 'rowQ') { state.rowQ = e.target.value; redraw(); }
      else if (key === 'colQ') { state.colQ = e.target.value; redraw(); }
    };
    container.onclick = function (e) {
      var seg = e.target.closest('[data-gd-seg]');
      if (seg) { var id = seg.getAttribute('data-gd-seg'); state.segId = state.segId === id ? '' : id; redraw(); return; }
      var pair = e.target.closest('[data-gd-pair]');
      if (pair) {
        var ids = pair.getAttribute('data-gd-pair').split('|');
        state.rowQ = ids[0]; state.colQ = ids[1];
        redraw();
        var target = document.getElementById('gdCross');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      var act = e.target.closest('[data-gd]');
      var key = act && act.getAttribute('data-gd');
      if (key === 'clear') { state.segQ = ''; state.segId = ''; redraw(); }
      else if (key === 'demo' && hooks && hooks.onDemo) hooks.onDemo();
    };
  }

  // ------------------------------------------------------------------ PDF (light theme)

  /** Summary, insights and cross-analysis of the whole data set as inline-styled HTML. */
  function pdfSummaryHtml(survey) {
    var all = A.collectResponses(survey);
    var h2 = 'font-size:10.5pt;font-weight:800;color:#0f172a;border-bottom:1.5px solid #e2e8f0;padding-bottom:4px;margin:14px 0 8px;';
    var out = '';

    var numeric = survey.questions.filter(function (q) { return q.type === 'scale' || q.type === 'rating'; });
    var means = numeric.map(function (q) { return A.questionStats(q, all); }).filter(function (s) { return s.n; }).map(function (s) { return s.mean; });
    var kpis = [
      [String(all.length), 'Katılımcı'],
      [A.fmtPct(A.completionRate(survey, all)), 'Tamamlama oranı'],
      [String(survey.questions.length), 'Soru'],
      [means.length ? A.fmt1(means.reduce(function (a, b) { return a + b; }, 0) / means.length) + ' / 5' : '—', 'Ortalama puan']
    ];
    out += '<div style="display:flex;gap:10px;margin-bottom:12px;">' + kpis.map(function (k) {
      return '<div style="flex:1;border:1px solid #e2e8f0;border-top:4px solid #c8102e;border-radius:6px;padding:8px 10px;">' +
        '<div style="font-size:16pt;font-weight:900;color:#0f172a;line-height:1.1;">' + esc(k[0]) + '</div><div style="font-size:8pt;font-weight:700;color:#475569;margin-top:3px;">' + k[1] + '</div></div>';
    }).join('') + '</div>';

    if (all.length < 30 && all.length) {
      out += '<div style="font-size:8pt;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:6px 10px;margin-bottom:10px;">Yanıt sayısı az (' + all.length + '); sonuçlar yön göstericidir.</div>';
    }

    var tags = A.tagScores(survey, all);
    if (tags.length) {
      out += '<div style="' + h2 + '">Boyut skorları</div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:6px;">' + tags.map(function (t) {
        return '<div style="border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px;min-width:110px;"><div style="font-size:8pt;color:#475569;font-weight:700;">' + esc(t.tag) + '</div>' +
          '<div style="font-size:13pt;font-weight:900;color:#0f172a;">' + A.fmt1(t.score) + ' <span style="font-size:8pt;color:#64748b;">/ 5</span></div></div>';
      }).join('') + '</div>';
    }

    var list = A.insights(survey, all);
    if (list.length) {
      out += '<div style="' + h2 + '">Öne çıkan içgörüler</div>' + list.map(function (it) {
        var k = KINDS[it.kind] || ['Bulgu', '#64748b'];
        return '<div class="avoid-break" style="break-inside:avoid;page-break-inside:avoid;border:1px solid #e2e8f0;border-left:4px solid ' + k[1] + ';border-radius:6px;padding:7px 10px;margin-bottom:6px;">' +
          '<div style="font-size:7pt;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#64748b;">' + k[0] + ' · ' + esc(it.title) + '</div>' +
          '<div style="font-size:8.8pt;color:#1e293b;line-height:1.45;margin-top:2px;">' + esc(it.text) + '</div></div>';
      }).join('');
    }

    var pair = A.strongestPair(survey, all);
    if (pair && state.rowQ && state.colQ && A.questionById(survey, state.rowQ) && A.questionById(survey, state.colQ)) {
      pair = { rowId: state.rowQ, colId: state.colQ };
    }
    if (pair) {
      var qa = A.questionById(survey, pair.rowId), qb = A.questionById(survey, pair.colId);
      var ct = A.crosstab(survey, all, qa, qb);
      if (ct.nBoth && qa !== qb) {
        var th = 'padding:5px 7px;font-size:7.5pt;font-weight:700;color:#334155;border:1px solid #e2e8f0;background:#f8fafc;text-align:left;';
        out += '<div style="' + h2 + '">Çapraz analiz</div>' +
          '<div style="font-size:8.5pt;color:#334155;margin-bottom:6px;"><b>' + esc(qa.title) + '</b> (satırlar) × <b>' + esc(qb.title) + '</b> (sütunlar)</div>' +
          '<table class="avoid-break" style="border-collapse:collapse;width:100%;margin-bottom:6px;"><thead><tr><th style="' + th + '"></th>' +
          ct.colSegs.map(function (c) { return '<th style="' + th + '">' + esc(trunc(c.label, 36)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          ct.rowSegs.map(function (r, i) {
            return '<tr><th style="' + th + '">' + esc(trunc(r.label, 40)) + ' <span style="font-weight:400;color:#64748b;">(n=' + ct.rowBase[i] + ')</span></th>' +
              ct.colSegs.map(function (c, j) {
                if (!ct.rowBase[i]) return '<td style="border:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:8pt;">—</td>';
                var pct = ct.rowPct[i][j];
                return '<td style="border:1px solid #e2e8f0;text-align:center;font-size:8.5pt;font-weight:700;color:#0f172a;background:rgba(37,99,235,' + (0.05 + 0.5 * pct / 100).toFixed(2) + ');padding:5px;">' +
                  Math.round(pct) + '%<span style="font-weight:400;color:#475569;font-size:7pt;"> (' + ct.cells[i][j] + ')</span></td>';
              }).join('') + '</tr>';
          }).join('') + '</tbody></table>' +
          '<div style="font-size:7.5pt;color:#64748b;margin-bottom:8px;">' + ct.nBoth + ' ortak yanıt. Her satır, o gruptaki kişilerin yanıt dağılımıdır. ' + esc(testSummary(ct)) + '</div>';
      }
    }
    return out;
  }

  window.PollenDashboard = { render: render, pdfSummaryHtml: pdfSummaryHtml };
})();
