/*
 * Import dialog of the survey builder: file / pasted text / public link -> PollenImport.parse()
 * -> preview with errors and warnings -> PollenBuilder.importDefinition().
 */
(function () {
  'use strict';

  var current = null;      // last parse result that can be imported
  var busy = false;
  var pasteTimer = null;

  function $(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var TYPE_NAMES = { single: 'Tek seçim', multi: 'Çoklu seçim', scale: '1-5 ölçek', rating: 'Yıldız puanı', wordcloud: 'Açık uçlu' };

  function fileBaseName(name) {
    return String(name || '').replace(/\.[^.]+$/, '').replace(/\.pollen$/i, '').replace(/[-_]+/g, ' ').trim();
  }

  // ------------------------------------------------------------------ rendering

  function setStatus(text, isError) {
    var el = $('impStatus');
    el.style.display = text ? 'block' : 'none';
    el.textContent = text || '';
    el.classList.toggle('error', !!isError);
  }

  function render(result) {
    var box = $('impResult');
    var confirm = $('impConfirmBtn');
    current = null;
    confirm.disabled = true;

    if (!result) {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }

    var html = '';
    if (result.errors.length) {
      html += '<div class="imp-block error"><strong>Aktarılamadı</strong><ul>' +
        result.errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>';
    }
    if (result.definition) {
      var def = result.definition;
      var counts = {};
      def.questions.forEach(function (q) { counts[q.type] = (counts[q.type] || 0) + 1; });
      var chips = Object.keys(counts).map(function (t) {
        return '<span class="imp-chip">' + esc(TYPE_NAMES[t] || t) + ' · ' + counts[t] + '</span>';
      }).join('');
      var list = def.questions.slice(0, 6).map(function (q, i) {
        return '<li><b>' + (i + 1) + '</b>' + esc(q.title) + '</li>';
      }).join('');
      var more = def.questions.length > 6 ? '<li class="more">… ve ' + (def.questions.length - 6) + ' soru daha</li>' : '';
      html += '<div class="imp-block ok"><div class="imp-summary-title">' + esc(def.title) + '</div>' +
        '<div class="imp-summary-meta">' + def.questions.length + ' soru ' + chips + '</div>' +
        '<ol class="imp-qlist">' + list + more + '</ol></div>';
      current = result;
      confirm.disabled = false;
    }
    if (result.warnings.length) {
      html += '<div class="imp-block warn"><strong>Dikkat</strong><ul>' +
        result.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>';
    }
    box.innerHTML = html;
    box.style.display = html ? 'block' : 'none';
  }

  function process(text, source) {
    setStatus('');
    if (!String(text || '').trim()) { render(null); return; }
    render(PollenImport.parse(text, { fallbackTitle: source ? fileBaseName(source) : '' }));
  }

  // ------------------------------------------------------------------ inputs

  async function readFile(file) {
    if (!file) return;
    if (file.size > PollenImport.MAX_CHARS) {
      render({ definition: null, warnings: [], errors: ['Dosya çok büyük (en fazla 1 MB).'] });
      return;
    }
    var text = await file.text();
    $('impText').value = '';
    process(text, file.name);
  }

  async function fetchLink() {
    if (busy) return;
    var url = $('impUrl').value.trim();
    if (!url) { setStatus('Önce bir bağlantı girin.', true); return; }
    busy = true;
    $('impFetchBtn').disabled = true;
    render(null);
    setStatus('Bağlantıdan alınıyor…');
    try {
      var text = await PollenImport.fetchText(url);
      var name = '';
      try { name = new URL(url).pathname.split('/').filter(Boolean).pop() || ''; } catch (e) { /* ignore */ }
      process(text, /spreadsheets/.test(url) ? '' : name);
    } catch (err) {
      setStatus(err.message, true);
    } finally {
      busy = false;
      $('impFetchBtn').disabled = false;
    }
  }

  function switchTab(name) {
    document.querySelectorAll('#importModal .imp-tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-imp-tab') === name);
    });
    document.querySelectorAll('#importModal .imp-pane').forEach(function (p) {
      p.style.display = p.getAttribute('data-imp-pane') === name ? '' : 'none';
    });
    setStatus('');
  }

  // ------------------------------------------------------------------ open / close

  function open() {
    $('impText').value = '';
    $('impUrl').value = '';
    $('impFile').value = '';
    render(null);
    setStatus('');
    switchTab('file');
    $('importModal').style.display = 'flex';
    window.addEventListener('keydown', onKey);
  }

  function close() {
    $('importModal').style.display = 'none';
    window.removeEventListener('keydown', onKey);
  }

  function onKey(e) {
    var confirmOpen = getComputedStyle($('inAppConfirmModal')).display !== 'none';
    if (e.key === 'Escape' && !confirmOpen) close();
  }

  async function confirmImport() {
    if (!current || !current.definition) return;
    var ok = await window.PollenBuilder.importDefinition(current.definition);
    if (ok) {
      close();
      showToast('Anket taslağa aktarıldı. Gözden geçirip yayınlayabilirsiniz.');
    }
  }

  // ------------------------------------------------------------------ wiring

  function init() {
    if (!$('importModal')) return;
    $('builderImportBtn').addEventListener('click', function () {
      window.PollenBuilder.onShow();
      open();
    });
    $('impCloseBtn').addEventListener('click', close);
    $('impCancelBtn').addEventListener('click', close);
    $('importModal').addEventListener('mousedown', function (e) { if (e.target === $('importModal')) close(); });
    $('impConfirmBtn').addEventListener('click', confirmImport);
    $('impFetchBtn').addEventListener('click', fetchLink);
    $('impUrl').addEventListener('keydown', function (e) { if (e.key === 'Enter') fetchLink(); });

    document.querySelectorAll('#importModal .imp-tab').forEach(function (t) {
      t.addEventListener('click', function () { switchTab(t.getAttribute('data-imp-tab')); });
    });

    $('impFile').addEventListener('change', function (e) { readFile(e.target.files[0]); });
    var drop = $('impDrop');
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
    });
    drop.addEventListener('drop', function (e) { readFile(e.dataTransfer.files[0]); });

    $('impText').addEventListener('input', function () {
      clearTimeout(pasteTimer);
      var text = $('impText').value;
      pasteTimer = setTimeout(function () { process(text, ''); }, 250);
    });

    $('impTplCsv').addEventListener('click', function () {
      window.PollenBuilder.saveBlob(new Blob(['\uFEFF' + PollenImport.csvTemplate()], { type: 'text/csv;charset=utf-8' }), 'pollen-anket-sablonu.csv');
    });
    $('impTplJson').addEventListener('click', function () {
      window.PollenBuilder.saveBlob(new Blob([PollenImport.jsonTemplate()], { type: 'application/json' }), 'pollen-anket-sablonu.json');
    });
  }

  init();
})();

