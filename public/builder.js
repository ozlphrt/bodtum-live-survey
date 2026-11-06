/*
 * Pollen survey builder (presenter side).
 *
 * Edits a draft survey, shows it live on a phone preview (the real vote.html in preview mode),
 * exports it as JSON and publishes it to the running session via loadSurveyDefinition() in app.js.
 * Everything is stored in the browser (no backend).
 */
(function () {
  'use strict';

  var DRAFT_KEY = 'pollen_draft_v1';
  var TYPES = [
    ['single', 'Tek seçim'],
    ['multi', 'Çoklu seçim'],
    ['scale', '1-5 ölçek'],
    ['rating', 'Yıldız puanı'],
    ['wordcloud', 'Açık uçlu metin']
  ];

  var draft = null;
  var focusIndex = 0;
  var showIssues = false;
  var initialized = false;
  var uid = 0;
  var saveTimer = null;
  var previewTimer = null;
  var resetPreviewNext = false;

  var el = {};

  function $(id) { return document.getElementById(id); }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ------------------------------------------------------------------ model

  function emptyQuestion(type) {
    type = type || 'single';
    return {
      _k: ++uid, type: type, title: '', subtitle: '',
      options: (type === 'single' || type === 'multi') ? ['', ''] : [],
      maxSelect: '', leftLabel: '', centerLabel: '', rightLabel: '',
      scaleLabels: ['', '', '', '', ''], placeholder: '', tag: ''
    };
  }

  function blankDraft() {
    return { title: '', shortTitle: '', badge: '', description: '', logo: '', questions: [emptyQuestion('single')] };
  }

  /** Definition (as produced by pollen-core) -> editor model. */
  function fromDefinition(def) {
    return {
      title: def.title || '',
      shortTitle: def.shortTitle || '',
      badge: def.badge || '',
      description: def.description || '',
      logo: def.logo || '',
      questions: (def.questions || []).map(function (q) {
        var e = emptyQuestion(q.type);
        e.title = q.title || '';
        e.subtitle = q.subtitle || '';
        e.options = (q.options || []).map(function (o) { return typeof o === 'string' ? o : o.text; });
        e.maxSelect = q.maxSelect ? String(q.maxSelect) : '';
        e.leftLabel = q.leftLabel || '';
        e.centerLabel = q.centerLabel || '';
        e.rightLabel = q.rightLabel || '';
        e.scaleLabels = Array.isArray(q.scaleLabels) && q.scaleLabels.length === 5 ? q.scaleLabels.slice() : ['', '', '', '', ''];
        e.placeholder = q.placeholder || '';
        e.tag = q.tag || '';
        return e;
      })
    };
  }

  /** Editor model -> raw definition for pollen-core (validated / normalized there). */
  function buildDefinition() {
    return {
      schema: Pollen.SCHEMA_VERSION,
      title: draft.title,
      shortTitle: draft.shortTitle,
      badge: draft.badge,
      description: draft.description,
      logo: draft.logo,
      questions: draft.questions.map(function (q) {
        var o = { type: q.type, title: q.title, subtitle: q.subtitle, tag: q.tag };
        if (q.type === 'single' || q.type === 'multi') {
          o.options = q.options.slice();
          if (q.type === 'multi' && q.maxSelect) o.maxSelect = Number(q.maxSelect);
        } else if (q.type === 'scale') {
          o.leftLabel = q.leftLabel;
          o.centerLabel = q.centerLabel;
          o.rightLabel = q.rightLabel;
          var any = q.scaleLabels.some(function (l) { return l && l.trim(); });
          if (any) {
            var fallback = Pollen.defaultScaleLabels(q);
            o.scaleLabels = q.scaleLabels.map(function (l, i) { return (l && l.trim()) || fallback[i]; });
          }
        } else if (q.type === 'wordcloud') {
          o.placeholder = q.placeholder;
        }
        return o;
      })
    };
  }

  function hasContent() {
    return !!(draft.title.trim() || draft.questions.some(function (q) {
      return q.title.trim() || q.options.some(function (o) { return o.trim(); });
    }));
  }

  // ------------------------------------------------------------------ persistence

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (e) { /* storage full / disabled */ }
    }, 300);
  }

  function loadStoredDraft() {
    try {
      var raw = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (raw && Array.isArray(raw.questions) && raw.questions.length) {
        raw.questions.forEach(function (q) {
          q._k = ++uid;
          q.options = Array.isArray(q.options) ? q.options : [];
          q.scaleLabels = Array.isArray(q.scaleLabels) && q.scaleLabels.length === 5 ? q.scaleLabels : ['', '', '', '', ''];
        });
        return raw;
      }
    } catch (e) { /* ignore corrupt draft */ }
    return null;
  }

  // ------------------------------------------------------------------ rendering

  function renderMeta() {
    document.querySelectorAll('#view-builder [data-meta]').forEach(function (input) {
      input.value = draft[input.getAttribute('data-meta')] || '';
    });
    var logo = $('builderLogoToggle');
    if (logo) logo.checked = draft.logo === 'bodtum';
    var logoRow = $('builderLogoRow');
    if (logoRow) logoRow.style.display = draft.logo ? '' : 'none';
  }

  function optionRows(q, qi) {
    var rows = q.options.map(function (text, j) {
      return '<div class="builder-opt-row">' +
        '<span class="builder-opt-dot ' + (q.type === 'multi' ? 'square' : '') + '"></span>' +
        '<input type="text" data-opt="' + j + '" value="' + esc(text) + '" placeholder="Seçenek ' + (j + 1) + '" maxlength="140">' +
        '<button type="button" class="builder-icon-btn" data-action="opt-del" data-opt="' + j + '" title="Seçeneği sil"' +
        (q.options.length <= 2 ? ' disabled' : '') + '>×</button>' +
        '</div>';
    }).join('');

    var limit = '';
    if (q.type === 'multi') {
      var opts = '<option value="">Sınırsız</option>';
      for (var k = 1; k < q.options.length; k++) {
        opts += '<option value="' + k + '"' + (String(q.maxSelect) === String(k) ? ' selected' : '') + '>En çok ' + k + '</option>';
      }
      limit = '<label class="builder-inline">Seçim sınırı <select data-field="maxSelect" class="builder-select">' + opts + '</select></label>';
    }
    return '<div class="builder-options">' + rows +
      '<div class="builder-options-foot"><button type="button" class="builder-link-btn" data-action="opt-add">+ Seçenek ekle</button>' + limit + '</div></div>';
  }

  function scaleFields(q) {
    var fallback = Pollen.defaultScaleLabels(q);
    var levels = q.scaleLabels.map(function (l, i) {
      return '<label class="builder-level"><b>' + (i + 1) + '</b><input type="text" data-scale="' + i + '" value="' + esc(l) +
        '" placeholder="' + esc(fallback[i]) + '" maxlength="80"></label>';
    }).join('');
    return '<div class="builder-grid builder-grid-3">' +
      '<label class="builder-field"><span>Sol uç</span><input type="text" data-field="leftLabel" value="' + esc(q.leftLabel) + '" placeholder="Örn. Hiç katılmıyorum" maxlength="40"></label>' +
      '<label class="builder-field"><span>Orta</span><input type="text" data-field="centerLabel" value="' + esc(q.centerLabel) + '" placeholder="Örn. Kararsızım" maxlength="40"></label>' +
      '<label class="builder-field"><span>Sağ uç</span><input type="text" data-field="rightLabel" value="' + esc(q.rightLabel) + '" placeholder="Örn. Tamamen katılıyorum" maxlength="40"></label>' +
      '</div>' +
      '<details class="builder-adv"><summary>Seviye etiketleri (1-5)</summary><div class="builder-levels">' + levels + '</div>' +
      '<div class="builder-note">Boş bırakılan seviyeler uç etiketlerinden türetilir. Sahne ve PDF sonuçlarında kullanılır.</div></details>';
  }

  function questionCard(q, qi) {
    var typeOptions = TYPES.map(function (t) {
      return '<option value="' + t[0] + '"' + (q.type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>';
    }).join('');

    var body = '';
    if (q.type === 'single' || q.type === 'multi') body = optionRows(q, qi);
    else if (q.type === 'scale') body = scaleFields(q);
    else if (q.type === 'rating') body = '<div class="builder-note">Katılımcı 1 ile 5 arasında yıldız verir; ortalama puan sahnede gösterilir.</div>';
    else if (q.type === 'wordcloud') {
      body = '<label class="builder-field"><span>Yazı kutusu ipucu <small>isteğe bağlı</small></span>' +
        '<input type="text" data-field="placeholder" value="' + esc(q.placeholder) + '" placeholder="Örn. Tek kelime ile yazın…" maxlength="80"></label>' +
        '<div class="builder-note">Yanıtlar kelime bulutu olarak gösterilir.</div>';
    }

    var last = draft.questions.length - 1;
    return '<div class="builder-card builder-q' + (qi === focusIndex ? ' is-focus' : '') + '" data-q="' + qi + '" data-k="' + q._k + '">' +
      '<div class="builder-q-head">' +
        '<span class="builder-q-num">' + (qi + 1) + '</span>' +
        '<select class="builder-select" data-field="type" aria-label="Soru tipi">' + typeOptions + '</select>' +
        '<div class="builder-q-actions">' +
          '<button type="button" class="builder-icon-btn" data-action="up" title="Yukarı taşı"' + (qi === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button type="button" class="builder-icon-btn" data-action="down" title="Aşağı taşı"' + (qi === last ? ' disabled' : '') + '>↓</button>' +
          '<button type="button" class="builder-icon-btn" data-action="dup" title="Soruyu çoğalt">⧉</button>' +
          '<button type="button" class="builder-icon-btn danger" data-action="del" title="Soruyu sil"' + (last === 0 ? ' disabled' : '') + '>🗑</button>' +
        '</div>' +
      '</div>' +
      '<input type="text" class="builder-q-title" data-field="title" value="' + esc(q.title) + '" placeholder="Soru metni" maxlength="200">' +
      '<input type="text" data-field="subtitle" value="' + esc(q.subtitle) + '" placeholder="Alt başlık veya ipucu (isteğe bağlı)" maxlength="160">' +
      body +
      '<details class="builder-adv"><summary>Gelişmiş</summary>' +
        '<label class="builder-field"><span>Dashboard etiketi <small>Aynı etiketli sorular birlikte analiz edilir</small></span>' +
        '<input type="text" data-field="tag" value="' + esc(q.tag) + '" placeholder="Örn. memnuniyet" maxlength="40"></label>' +
      '</details>' +
    '</div>';
  }

  function renderQuestions() {
    el.questions.innerHTML = draft.questions.map(questionCard).join('');
  }

  function renderIssues() {
    var errors = showIssues ? Pollen.validateSurvey(buildDefinition()) : [];
    if (!errors.length) {
      el.issues.style.display = 'none';
      el.issues.innerHTML = '';
      return errors;
    }
    el.issues.style.display = 'block';
    el.issues.innerHTML = '<strong>Yayınlamadan önce düzeltin:</strong><ul>' +
      errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>';
    return errors;
  }

  function markFocus() {
    el.questions.querySelectorAll('.builder-q').forEach(function (card) {
      card.classList.toggle('is-focus', Number(card.getAttribute('data-q')) === focusIndex);
    });
  }

  // ------------------------------------------------------------------ preview

  function previewState() {
    var norm = Pollen.normalizeSurvey(buildDefinition());
    return {
      title: norm.title || 'Adsız anket',
      shortTitle: norm.shortTitle,
      badge: norm.badge,
      description: norm.description,
      logo: norm.logo,
      acceptingVotes: true,
      isLive: true,
      resetEpoch: 1,
      activeQuestionIndex: -1,
      totalQuestions: norm.questions.length,
      timestamp: Date.now(),
      questions: norm.questions.map(function (q) {
        var pub = Pollen.publicQuestion(q);
        if (!pub.title) pub.title = '(Soru metni boş)';
        pub.votesCount = 0;
        pub.results = { totalVotes: 0 };
        return pub;
      })
    };
  }

  function sendPreview() {
    if (!el.frame || !el.frame.contentWindow) return;
    var msg = { type: 'pollen-preview', state: previewState(), focusIndex: focusIndex, reset: resetPreviewNext };
    resetPreviewNext = false;
    try { el.frame.contentWindow.postMessage(msg, window.location.origin); } catch (e) { /* frame not ready */ }
  }

  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(sendPreview, 150);
  }

  // ------------------------------------------------------------------ actions

  function changed(structural) {
    if (structural) renderQuestions();
    if (showIssues) renderIssues();
    scheduleSave();
    schedulePreview();
  }

  function swap(i, j) {
    var t = draft.questions[i];
    draft.questions[i] = draft.questions[j];
    draft.questions[j] = t;
  }

  function onClick(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    var card = btn.closest('.builder-q');
    var qi = card ? Number(card.getAttribute('data-q')) : -1;
    var q = qi >= 0 ? draft.questions[qi] : null;
    var action = btn.getAttribute('data-action');

    if (action === 'up' && qi > 0) { swap(qi, qi - 1); focusIndex = qi - 1; changed(true); }
    else if (action === 'down' && qi < draft.questions.length - 1) { swap(qi, qi + 1); focusIndex = qi + 1; changed(true); }
    else if (action === 'dup') {
      var copy = JSON.parse(JSON.stringify(q));
      copy._k = ++uid;
      draft.questions.splice(qi + 1, 0, copy);
      focusIndex = qi + 1;
      changed(true);
    }
    else if (action === 'del' && draft.questions.length > 1) {
      draft.questions.splice(qi, 1);
      focusIndex = Math.min(focusIndex, draft.questions.length - 1);
      changed(true);
    }
    else if (action === 'opt-add') { q.options.push(''); focusIndex = qi; changed(true); focusOption(qi, q.options.length - 1); }
    else if (action === 'opt-del' && q.options.length > 2) {
      q.options.splice(Number(btn.getAttribute('data-opt')), 1);
      if (q.maxSelect && Number(q.maxSelect) >= q.options.length) q.maxSelect = '';
      changed(true);
    }
  }

  function focusOption(qi, j) {
    var input = el.questions.querySelector('.builder-q[data-q="' + qi + '"] input[data-opt="' + j + '"]');
    if (input) input.focus();
  }

  function onInput(e) {
    var t = e.target;
    var meta = t.getAttribute('data-meta');
    if (meta) {
      draft[meta] = t.value;
      changed(false);
      return;
    }
    if (t.id === 'builderLogoToggle') {
      draft.logo = t.checked ? 'bodtum' : '';
      changed(false);
      return;
    }
    var card = t.closest('.builder-q');
    if (!card) return;
    var qi = Number(card.getAttribute('data-q'));
    var q = draft.questions[qi];
    focusIndex = qi;

    if (t.hasAttribute('data-opt')) {
      q.options[Number(t.getAttribute('data-opt'))] = t.value;
      changed(false);
    } else if (t.hasAttribute('data-scale')) {
      q.scaleLabels[Number(t.getAttribute('data-scale'))] = t.value;
      changed(false);
    } else if (t.getAttribute('data-field') === 'type') {
      changeType(q, t.value);
      changed(true);
    } else if (t.hasAttribute('data-field')) {
      q[t.getAttribute('data-field')] = t.value;
      // scale anchors feed the placeholders of the level labels
      changed(false);
    }
  }

  function changeType(q, type) {
    q.type = type;
    if ((type === 'single' || type === 'multi') && q.options.length < 2) {
      while (q.options.length < 2) q.options.push('');
    }
    if (type !== 'multi') q.maxSelect = '';
  }

  function onFocusIn(e) {
    var card = e.target.closest('.builder-q');
    if (!card) return;
    var qi = Number(card.getAttribute('data-q'));
    if (qi !== focusIndex) {
      focusIndex = qi;
      markFocus();
      schedulePreview();
    }
  }

  function addQuestion() {
    draft.questions.push(emptyQuestion('single'));
    focusIndex = draft.questions.length - 1;
    changed(true);
    var card = el.questions.querySelector('.builder-q[data-q="' + focusIndex + '"]');
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var title = card.querySelector('[data-field="title"]');
      if (title) title.focus({ preventScroll: true });
    }
  }

  async function applyTemplate(kind) {
    if (!kind) return;
    var next;
    if (kind === 'blank') next = blankDraft();
    else if (kind === 'bodtum') next = fromDefinition(Pollen.templates.bodtum);
    else if (kind === 'current') next = fromDefinition(Pollen.toDefinition(survey));
    else return;

    if (hasContent()) {
      var ok = await showInAppConfirm({
        icon: '📝', badge: 'TASLAK', title: 'Taslak değiştirilsin mi?',
        bodyHtml: '<p>Üzerinde çalıştığınız mevcut taslağın yerine seçtiğiniz başlangıç geçecek. Bu işlem geri alınamaz.</p>',
        confirmText: 'Evet, değiştir', cancelText: 'Vazgeç', isDanger: true
      });
      if (!ok) return;
    }
    draft = next;
    focusIndex = 0;
    showIssues = false;
    resetPreviewNext = true;
    renderMeta();
    changed(true);
    renderIssues();
  }

  function slug(text) {
    var map = { 'ı': 'i', 'İ': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g', 'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c' };
    return String(text || '').replace(/[ıİşŞğĞüÜöÖçÇ]/g, function (c) { return map[c]; })
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function validOrShow() {
    showIssues = true;
    var errors = renderIssues();
    if (errors.length) {
      el.issues.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('Anketteki eksikleri tamamlayın.');
      return false;
    }
    return true;
  }

  function downloadJson() {
    if (!validOrShow()) return;
    var def = Pollen.toDefinition(buildDefinition());
    var blob = new Blob([JSON.stringify(def, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (slug(def.title) || 'anket') + '.pollen.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    showToast('Anket JSON olarak indirildi.');
  }

  function runningParticipants() {
    var voters = {};
    survey.questions.forEach(function (q) {
      Object.keys(q.votes || {}).forEach(function (v) { voters[v] = true; });
    });
    return Object.keys(voters).length;
  }

  async function publish() {
    if (!validOrShow()) return;
    var def = buildDefinition();
    var count = runningParticipants();
    var warn = count > 0;
    var ok = await showInAppConfirm({
      icon: warn ? '⚠️' : '🚀',
      badge: 'ANKETİ YAYINLA',
      title: 'Anket yayınlansın mı?',
      bodyHtml: '<p><strong>' + esc(def.title) + '</strong> · ' + def.questions.length + ' soru</p>' +
        (warn
          ? '<div class="inapp-modal-highlight danger">Şu an çalışan ankette <strong>' + count + ' katılımcının yanıtı</strong> var. Yeni anket yayınlanınca bu yanıtlar <strong>silinir</strong>.</div>'
          : '<p>Yeni anket bu oturumda hemen başlar ve bağlı telefonlara gönderilir.</p>'),
      confirmText: 'Yayınla',
      cancelText: 'Vazgeç',
      isDanger: warn
    });
    if (!ok) return;

    try {
      loadSurveyDefinition(def);
    } catch (err) {
      showToast('Anket yayınlanamadı: ' + err.message);
      return;
    }
    switchAdminView('qr');
    showToast('Anket yayınlandı. QR kodu paylaşabilirsiniz.');
  }

  // ------------------------------------------------------------------ lifecycle

  function init() {
    el.main = $('builderMain');
    el.questions = $('builderQuestions');
    el.issues = $('builderIssues');
    el.frame = $('builderPreviewFrame');
    if (!el.main || !el.questions) return;

    el.main.addEventListener('click', onClick);
    el.main.addEventListener('input', onInput);
    el.main.addEventListener('change', onInput);
    el.main.addEventListener('focusin', onFocusIn);

    $('builderAddQuestionBtn').addEventListener('click', addQuestion);
    $('builderDownloadBtn').addEventListener('click', downloadJson);
    $('builderPublishBtn').addEventListener('click', publish);
    $('builderTemplateSelect').addEventListener('change', function (e) {
      var v = e.target.value;
      e.target.value = '';
      applyTemplate(v);
    });

    el.frame.addEventListener('load', sendPreview);
    window.addEventListener('message', function (e) {
      if (e.origin !== window.location.origin) return;
      if (e.data && e.data.type === 'pollen-preview-ready' && draft) sendPreview();
    });
  }

  function onShow() {
    if (!initialized) {
      init();
      initialized = true;
    }
    if (!draft) {
      // Continue the stored draft, or start from the survey that is running right now.
      draft = loadStoredDraft() || fromDefinition(Pollen.toDefinition(survey));
      renderMeta();
      renderQuestions();
      sendPreview();
    }
  }

  window.PollenBuilder = { onShow: onShow };
})();
