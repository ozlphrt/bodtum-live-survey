/*!
 * Pollen import / export: turns JSON or CSV (file, pasted text, Google Sheets, any public URL)
 * into a survey definition and back. Dependency-free UMD module on top of pollen-core.js.
 *
 * CSV layout (one row per question; the header row decides the columns, Turkish or English names):
 *
 *   tip ; soru ; alt başlık ; seçenekler ; en çok ; sol ; orta ; sağ ; seviyeler ; yazı kutusu ; etiket
 *
 *   tip        tek | çoklu | ölçek | yıldız | açık      (single | multi | scale | rating | text)
 *   seçenekler options separated by "|" (or one per line inside the cell)
 *   en çok     choice limit for "çoklu"
 *   sol/orta/sağ  anchors of a "ölçek" question, seviyeler = five labels separated by "|"
 *
 * Survey-level values are rows whose "tip" cell is a keyword and whose value sits in the "soru" column:
 *   anket adı | kısa başlık | kurum | yönerge | logo
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./pollen-core.js'));
  } else {
    root.PollenImport = factory(root.Pollen);
  }
})(typeof self !== 'undefined' ? self : this, function (Pollen) {
  'use strict';

  var MAX_CHARS = 1000000;
  var DEFAULT_TITLE = 'İçe aktarılan anket';

  // ------------------------------------------------------------------ helpers

  var TR_MAP = { 'ı': 'i', 'İ': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g', 'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c' };

  /** "Çoklu Seçim" -> "cokluSecim" style key: ascii, lower case, letters and digits only. */
  function fold(s) {
    return String(s == null ? '' : s)
      .replace(/[ıİşŞğĞüÜöÖçÇ]/g, function (c) { return TR_MAP[c]; })
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  function aliasMap(table) {
    var map = {};
    Object.keys(table).forEach(function (canonical) {
      table[canonical].forEach(function (alias) { map[fold(alias)] = canonical; });
    });
    return map;
  }

  var COLUMN_ALIASES = aliasMap({
    type: ['tip', 'tür', 'soru tipi', 'type', 'question type'],
    title: ['soru', 'soru metni', 'question', 'title', 'başlık'],
    subtitle: ['alt başlık', 'ipucu', 'subtitle', 'hint', 'açıklama'],
    options: ['seçenekler', 'seçenek', 'options', 'choices', 'yanıtlar', 'cevaplar'],
    maxSelect: ['en çok', 'en fazla', 'max', 'maxselect', 'seçim sınırı', 'limit'],
    left: ['sol', 'sol uç', 'left', 'left label'],
    center: ['orta', 'merkez', 'center', 'center label'],
    right: ['sağ', 'sağ uç', 'right', 'right label'],
    levels: ['seviyeler', 'seviye etiketleri', 'levels', 'scale labels'],
    placeholder: ['yazı kutusu', 'yer tutucu', 'placeholder'],
    tag: ['etiket', 'tag', 'boyut', 'dashboard etiketi']
  });

  var TYPE_ALIASES = aliasMap({
    single: ['tek', 'tek seçim', 'tekli', 'single', 'radio', 'choice'],
    multi: ['çoklu', 'çoklu seçim', 'multi', 'multiple', 'checkbox'],
    scale: ['ölçek', 'scale', 'likert', '1-5'],
    rating: ['yıldız', 'puan', 'rating', 'star', 'stars'],
    wordcloud: ['açık', 'açık uçlu', 'metin', 'text', 'wordcloud', 'kelime', 'open']
  });

  var META_ALIASES = aliasMap({
    title: ['anket adı', 'anket', 'survey', 'survey title', 'survey name'],
    shortTitle: ['kısa başlık', 'short title', 'shorttitle'],
    badge: ['kurum', 'organizasyon', 'badge', 'organization', 'etiket / kurum'],
    description: ['yönerge', 'yönergeler', 'description', 'instructions'],
    logo: ['logo']
  });

  var TYPE_TR = { single: 'tek', multi: 'çoklu', scale: 'ölçek', rating: 'yıldız', wordcloud: 'açık' };
  var HEADER = ['tip', 'soru', 'alt başlık', 'seçenekler', 'en çok', 'sol', 'orta', 'sağ', 'seviyeler', 'yazı kutusu', 'etiket'];
  var HEADER_KEYS = ['type', 'title', 'subtitle', 'options', 'maxSelect', 'left', 'center', 'right', 'levels', 'placeholder', 'tag'];

  function splitList(cell) {
    return String(cell || '').split(/\r?\n|\|/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  // ------------------------------------------------------------------ CSV

  /** Counts a delimiter outside of quotes on the first non-empty line. */
  function detectDelimiter(text) {
    var counts = { ',': 0, ';': 0, '\t': 0 };
    var inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (c === '"') inQuotes = !inQuotes;
      else if (!inQuotes && (c === '\n' || c === '\r')) {
        if (counts[','] + counts[';'] + counts['\t'] > 0) break;
      } else if (!inQuotes && counts[c] !== undefined) counts[c]++;
    }
    var best = ',';
    [';', '\t'].forEach(function (d) { if (counts[d] > counts[best]) best = d; });
    return best;
  }

  /** RFC 4180 style parser (quotes, doubled quotes, newlines inside cells). Returns rows of cells. */
  function parseCsv(text, delimiter) {
    text = String(text || '').replace(/^\uFEFF/, '');
    delimiter = delimiter || detectDelimiter(text);
    var rows = [];
    var row = [];
    var cell = '';
    var inQuotes = false;
    var line = 1;
    var lines = [];
    var rowLine = 1;

    function endCell() { row.push(cell); cell = ''; }
    function endRow() {
      endCell();
      rows.push(row);
      lines.push(rowLine);
      row = [];
      rowLine = line;
    }

    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
        } else {
          if (c === '\n') line++;
          cell += c;
        }
      } else if (c === '"' && cell === '') {
        inQuotes = true;
      } else if (c === delimiter) {
        endCell();
      } else if (c === '\r') {
        if (text[i + 1] === '\n') i++;
        line++;
        endRow();
      } else if (c === '\n') {
        line++;
        endRow();
      } else {
        cell += c;
      }
    }
    if (cell !== '' || row.length) endRow();
    return { rows: rows, lines: lines, delimiter: delimiter };
  }

  function csvCell(value, delimiter) {
    var s = value == null ? '' : String(value);
    return /["\r\n]/.test(s) || s.indexOf(delimiter) !== -1 ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /** Definition -> CSV text (";" delimited, which Turkish Excel opens correctly). */
  function toCsv(definition) {
    var def = Pollen.toDefinition(definition);
    var d = ';';
    var out = [];
    function push(cells) { out.push(cells.map(function (c) { return csvCell(c, d); }).join(d)); }

    push(HEADER);
    push(['anket adı', def.title]);
    if (def.shortTitle) push(['kısa başlık', def.shortTitle]);
    if (def.badge) push(['kurum', def.badge]);
    if (def.description) push(['yönerge', def.description]);
    if (def.logo) push(['logo', def.logo]);

    def.questions.forEach(function (q) {
      var options = (q.options || []).map(function (o) { return o.text.replace(/\|/g, '/'); }).join('|');
      var levels = '';
      if (q.type === 'scale' && q.scaleLabels) {
        var derived = Pollen.defaultScaleLabels(q);
        var custom = q.scaleLabels.some(function (l, i) { return l !== derived[i]; });
        if (custom) levels = q.scaleLabels.join('|');
      }
      push([
        TYPE_TR[q.type], q.title, q.subtitle || '', options, q.maxSelect || '',
        q.leftLabel || '', q.centerLabel || '', q.rightLabel || '', levels, q.placeholder || '', q.tag || ''
      ]);
    });
    return out.join('\r\n') + '\r\n';
  }

  /** CSV text -> { definition, warnings, errors }. */
  function fromCsv(text, opts) {
    opts = opts || {};
    var warnings = [];
    var errors = [];
    var parsed = parseCsv(text);
    var rows = parsed.rows;

    // Header row = the first row that has a recognisable question column.
    var headerIndex = -1;
    var columns = null;
    for (var r = 0; r < rows.length && headerIndex === -1; r++) {
      var mapped = rows[r].map(function (h) { return COLUMN_ALIASES[fold(h)] || null; });
      if (mapped.indexOf('title') !== -1) { headerIndex = r; columns = mapped; }
    }
    if (headerIndex === -1) {
      return { definition: null, warnings: warnings, errors: ['İlk satırda "tip" ve "soru" gibi sütun başlıkları bulunamadı. Şablonu indirip örnek düzene bakın.'] };
    }
    var col = {};
    columns.forEach(function (key, i) { if (key && col[key] === undefined) col[key] = i; });

    function cellOf(row, key) { return col[key] === undefined ? '' : String(row[col[key]] == null ? '' : row[col[key]]).trim(); }

    var meta = {};
    var questions = [];

    for (var i = headerIndex + 1; i < rows.length; i++) {
      var row = rows[i];
      if (row.every(function (c) { return !String(c || '').trim(); })) continue;
      var where = 'Satır ' + parsed.lines[i] + ': ';
      var typeCell = cellOf(row, 'type');
      var typeKey = fold(typeCell);

      // survey-level row
      if (META_ALIASES[typeKey] && !TYPE_ALIASES[typeKey]) {
        var value = cellOf(row, 'title') || row.map(function (c) { return String(c || '').trim(); }).filter(Boolean).slice(1)[0] || '';
        meta[META_ALIASES[typeKey]] = value;
        continue;
      }

      var type = TYPE_ALIASES[typeKey];
      var options = splitList(cellOf(row, 'options'));
      var left = cellOf(row, 'left');
      var right = cellOf(row, 'right');

      if (!type) {
        if (typeCell) {
          errors.push(where + 'bilinmeyen soru tipi "' + typeCell + '" (tek, çoklu, ölçek, yıldız, açık).');
          continue;
        }
        if (options.length >= 2) {
          type = 'single';
          warnings.push(where + 'tip boş; seçenekler olduğu için "tek seçim" varsayıldı.');
        } else if (left || right) {
          type = 'scale';
          warnings.push(where + 'tip boş; uç etiketleri olduğu için "ölçek" varsayıldı.');
        } else {
          errors.push(where + 'soru tipi belirtilmemiş.');
          continue;
        }
      }

      var q = { type: type, title: cellOf(row, 'title') };
      if (!q.title) { errors.push(where + 'soru metni boş.'); continue; }
      var subtitle = cellOf(row, 'subtitle');
      if (subtitle) q.subtitle = subtitle;
      var tag = cellOf(row, 'tag');
      if (tag) q.tag = tag;

      if (type === 'single' || type === 'multi') {
        q.options = options;
        var max = cellOf(row, 'maxSelect');
        if (max) {
          if (type !== 'multi') warnings.push(where + '"en çok" yalnızca çoklu seçimde kullanılır, yok sayıldı.');
          else if (!/^\d+$/.test(max) || Number(max) < 1) warnings.push(where + '"en çok" geçerli bir sayı değil ("' + max + '"), yok sayıldı.');
          else q.maxSelect = Number(max);
        }
      } else {
        if (options.length) warnings.push(where + 'bu soru tipinde seçenek kullanılmaz, yok sayıldı.');
        if (type === 'scale') {
          q.leftLabel = left;
          q.centerLabel = cellOf(row, 'center');
          q.rightLabel = right;
          var levels = splitList(cellOf(row, 'levels'));
          if (levels.length === 5) q.scaleLabels = levels;
          else if (levels.length) warnings.push(where + '"seviyeler" tam 5 etiket içermeli (' + levels.length + ' bulundu), uç etiketlerinden türetildi.');
        } else if (type === 'wordcloud') {
          q.placeholder = cellOf(row, 'placeholder');
        }
      }
      questions.push(q);
    }

    if (!questions.length && !errors.length) errors.push('Dosyada hiç soru satırı bulunamadı.');

    var title = meta.title;
    if (!title) {
      title = opts.fallbackTitle || DEFAULT_TITLE;
      warnings.push('Anket adı bulunamadı; "' + title + '" kullanıldı. "anket adı" satırı ekleyebilirsiniz.');
    }
    var raw = { title: title, shortTitle: meta.shortTitle, badge: meta.badge, description: meta.description, logo: meta.logo, questions: questions };
    return finish(raw, warnings, errors);
  }

  // ------------------------------------------------------------------ JSON

  function fromJson(text, opts) {
    opts = opts || {};
    var warnings = [];
    var errors = [];
    var raw;
    try {
      raw = JSON.parse(String(text).replace(/^\uFEFF/, ''));
    } catch (e) {
      return { definition: null, warnings: warnings, errors: ['Geçerli bir JSON değil: ' + e.message] };
    }
    if (Array.isArray(raw)) {
      raw = { questions: raw };
      warnings.push('Dosya yalnızca bir soru listesi içeriyordu; anket bilgileri boş bırakıldı.');
    }
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.questions)) {
      return { definition: null, warnings: warnings, errors: ['"questions" listesi bulunamadı. Pollen JSON şablonuna bakın.'] };
    }
    if (raw.schema && raw.schema !== Pollen.SCHEMA_VERSION) {
      warnings.push('Farklı şema sürümü ("' + raw.schema + '"); okunabilen alanlar alındı.');
    }
    if (!raw.title || !String(raw.title).trim()) {
      raw.title = opts.fallbackTitle || DEFAULT_TITLE;
      warnings.push('Anket adı bulunamadı; "' + raw.title + '" kullanıldı.');
    }
    var hadVotes = raw.questions.some(function (q) { return q && q.votes && Object.keys(q.votes).length; });
    if (hadVotes) warnings.push('Dosyadaki oylar içe aktarılmaz; yalnızca anket yapısı alınır.');
    return finish(raw, warnings, errors);
  }

  // ------------------------------------------------------------------ shared

  function finish(raw, warnings, errors) {
    if (errors.length) return { definition: null, warnings: warnings, errors: errors };
    var problems = Pollen.validateSurvey(raw);
    if (problems.length) return { definition: null, warnings: warnings, errors: problems };
    return { definition: Pollen.toDefinition(raw), warnings: warnings, errors: [] };
  }

  /** Auto-detects JSON vs CSV. */
  function parse(text, opts) {
    opts = opts || {};
    var s = String(text == null ? '' : text).replace(/^\uFEFF/, '');
    if (!s.trim()) return { definition: null, warnings: [], errors: ['İçerik boş.'], format: null };
    if (s.length > MAX_CHARS) return { definition: null, warnings: [], errors: ['İçerik çok büyük (en fazla 1 MB).'], format: null };
    var head = s.trim().charAt(0);
    var json = head === '{' || head === '[';
    var result = json ? fromJson(s, opts) : fromCsv(s, opts);
    result.format = json ? 'json' : 'csv';
    return result;
  }

  // ------------------------------------------------------------------ links

  /** Candidate CSV download URLs for a Google Sheets link, or null for any other URL. */
  function sheetsCandidates(input) {
    var url = String(input || '').trim();
    var m = /docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)/.exec(url);
    if (!m || /\/spreadsheets\/d\/e\//.test(url)) return null;
    var g = /[#&?]gid=(\d+)/.exec(url);
    var gid = g ? g[1] : '0';
    var base = 'https://docs.google.com/spreadsheets/d/' + m[1];
    return [base + '/export?format=csv&gid=' + gid, base + '/gviz/tq?tqx=out:csv&gid=' + gid];
  }

  function isHttpUrl(s) {
    try { var u = new URL(s); return u.protocol === 'https:' || u.protocol === 'http:'; } catch (e) { return false; }
  }

  /**
   * Downloads a survey file from a public URL (Google Sheets share link, raw GitHub, any CORS-enabled host).
   * Throws an Error with a user-facing Turkish message.
   */
  async function fetchText(input, options) {
    options = options || {};
    var fetchImpl = options.fetch || (typeof fetch !== 'undefined' ? fetch : null);
    var url = String(input || '').trim();
    if (!isHttpUrl(url)) throw new Error('Geçerli bir bağlantı girin (https://… ile başlamalı).');
    if (!fetchImpl) throw new Error('Bu tarayıcı bağlantıdan veri almayı desteklemiyor.');

    var candidates = sheetsCandidates(url) || [url];
    var lastError = null;
    for (var i = 0; i < candidates.length; i++) {
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = controller ? setTimeout(function () { controller.abort(); }, options.timeoutMs || 15000) : null;
      try {
        var res = await fetchImpl(candidates[i], controller ? { signal: controller.signal } : undefined);
        if (!res.ok) { lastError = new Error('Bağlantı yanıt vermedi (HTTP ' + res.status + '). Adresi ve paylaşım ayarını kontrol edin.'); continue; }
        var body = await res.text();
        if (/^\s*<(!doctype|html)/i.test(body)) {
          lastError = new Error('Bağlantı bir veri dosyası yerine web sayfası döndürdü. Google Sheets için paylaşımı "Bağlantıya sahip olan herkes görüntüleyebilir" yapın.');
          continue;
        }
        if (body.length > MAX_CHARS) throw new Error('Dosya çok büyük (en fazla 1 MB).');
        return body;
      } catch (e) {
        if (e && /çok büyük/.test(e.message)) throw e;
        lastError = new Error(e && e.name === 'AbortError'
          ? 'Bağlantı zaman aşımına uğradı.'
          : 'Bağlantıya erişilemedi. Adres yanlış olabilir ya da sunucu tarayıcıdan okumaya izin vermiyor; dosyayı indirip yüklemeyi deneyin.');
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    throw lastError || new Error('Bağlantıdan veri alınamadı.');
  }

  // ------------------------------------------------------------------ samples

  var SAMPLE = {
    title: 'Çalışan Memnuniyeti Anketi',
    shortTitle: 'Memnuniyet',
    badge: 'ŞİRKET ADI',
    description: 'Her soruya dokunarak yanıt verin. Yanıtlar anonimdir.',
    questions: [
      { type: 'single', title: 'En çok hangi gün ofiste çalışmayı seversiniz?', options: ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'] },
      { type: 'multi', title: 'Hangi araçları düzenli kullanıyorsunuz?', subtitle: '(En çok 2 seçenek belirleyin)', options: ['E-posta', 'Sohbet', 'Takvim', 'Doküman'], maxSelect: 2 },
      { type: 'scale', title: 'Genel memnuniyetinizi nasıl değerlendirirsiniz?', leftLabel: 'Hiç memnun değilim', centerLabel: 'Kararsızım', rightLabel: 'Çok memnunum', tag: 'memnuniyet' },
      { type: 'rating', title: 'Yemekhaneyi puanlayın' },
      { type: 'wordcloud', title: 'Ofisimizi tek kelimeyle anlatın', placeholder: 'Tek kelime yazın…' }
    ]
  };

  function csvTemplate() { return toCsv(SAMPLE); }
  function jsonTemplate() { return JSON.stringify(Pollen.toDefinition(SAMPLE), null, 2); }

  return {
    parse: parse,
    fromCsv: fromCsv,
    fromJson: fromJson,
    parseCsv: parseCsv,
    toCsv: toCsv,
    fetchText: fetchText,
    sheetsCandidates: sheetsCandidates,
    csvTemplate: csvTemplate,
    jsonTemplate: jsonTemplate,
    MAX_CHARS: MAX_CHARS
  };
});

