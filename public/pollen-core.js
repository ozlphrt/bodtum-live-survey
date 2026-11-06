/*!
 * Pollen core: survey schema, validation and shared helpers.
 *
 * Dependency-free UMD module. It is loaded by the presenter (index.html), the
 * voter (vote.html) and by Node (tests), so every part of the app agrees on
 * what a survey looks like.
 *
 * Survey definition (JSON, version "pollen.survey.v1"):
 * {
 *   "schema": "pollen.survey.v1",
 *   "title": "Full survey title",            // required
 *   "shortTitle": "Shown on the QR screen",  // optional
 *   "badge": "Organisation / event label",   // optional
 *   "description": "Short instructions shown to participants above the first question", // optional
 *   "logo": "bodtum",                        // optional: built-in logo set for the phone header
 *   "questions": [
 *     {
 *       "id": "q1",                          // optional, generated when missing
 *       "type": "single|multi|scale|rating|wordcloud",
 *       "title": "Question text",            // required
 *       "subtitle": "Hint under the title",  // optional
 *       "options": [{ "id": "opt1_1", "text": "..." }],  // single / multi (min 2); plain strings are accepted too
 *       "maxSelect": 2,                      // multi only: 1..options.length
 *       "leftLabel": "", "centerLabel": "", "rightLabel": "",  // scale anchors
 *       "scaleLabels": ["1 - ...", "...", "...", "...", "5 - ..."], // scale, exactly 5
 *       "labels": [],                        // rating, exactly 5
 *       "placeholder": "",                   // wordcloud
 *       "tag": "adoption"                    // optional dimension used by the dashboard
 *     }
 *   ]
 * }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Pollen = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SCHEMA_VERSION = 'pollen.survey.v1';
  var QUESTION_TYPES = ['single', 'multi', 'scale', 'rating', 'wordcloud'];
  var CHOICE_TYPES = ['single', 'multi'];
  var LOGOS = ['bodtum'];

  // Fields of a question that are safe to send to participants' phones.
  // Votes of other people and the dashboard-only tag are deliberately absent.
  var PUBLIC_QUESTION_FIELDS = [
    'id', 'type', 'title', 'subtitle', 'options', 'maxSelect',
    'leftLabel', 'centerLabel', 'rightLabel', 'scaleLabels', 'labels', 'placeholder'
  ];

  function text(v) {
    return typeof v === 'string' ? v.trim() : '';
  }

  function optionText(o) {
    return text(typeof o === 'string' ? o : o && o.text);
  }

  function fiveStrings(arr) {
    if (!Array.isArray(arr) || arr.length !== 5) return null;
    var out = arr.map(text);
    return out.every(Boolean) ? out : null;
  }

  /** Five level labels for a scale question, derived from its anchors when not given explicitly. */
  function defaultScaleLabels(q) {
    q = q || {};
    return [
      '1 - ' + (text(q.leftLabel) || 'Çok düşük'),
      '2',
      '3 - ' + (text(q.centerLabel) || 'Orta'),
      '4',
      '5 - ' + (text(q.rightLabel) || 'Çok yüksek')
    ];
  }

  /** Returns a list of human readable (Turkish) problems; empty when the definition is valid. */
  function validateSurvey(raw) {
    var errors = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return ['Anket tanımı geçerli bir nesne olmalı.'];
    }
    if (!text(raw.title)) errors.push('Anket başlığı boş olamaz.');

    var questions = raw.questions;
    if (!Array.isArray(questions) || questions.length === 0) {
      errors.push('En az bir soru gerekli.');
      return errors;
    }

    var seen = {};
    questions.forEach(function (q, i) {
      var where = 'Soru ' + (i + 1) + ': ';
      if (!q || typeof q !== 'object') {
        errors.push(where + 'geçersiz tanım.');
        return;
      }
      if (QUESTION_TYPES.indexOf(q.type) === -1) {
        errors.push(where + 'bilinmeyen soru tipi "' + q.type + '".');
      }
      if (!text(q.title)) errors.push(where + 'soru metni boş.');

      if (q.id !== undefined && q.id !== null && q.id !== '') {
        var id = String(q.id);
        if (seen[id]) errors.push(where + 'yinelenen id "' + id + '".');
        seen[id] = true;
      }

      if (CHOICE_TYPES.indexOf(q.type) !== -1) {
        var opts = Array.isArray(q.options) ? q.options.filter(optionText) : [];
        if (opts.length < 2) errors.push(where + 'en az 2 seçenek gerekli.');
        if (q.type === 'multi' && q.maxSelect !== undefined && q.maxSelect !== null) {
          var m = Number(q.maxSelect);
          if (!Number.isInteger(m) || m < 1 || m > opts.length) {
            errors.push(where + 'maxSelect 1 ile seçenek sayısı arasında olmalı.');
          }
        }
      }
    });
    return errors;
  }

  /**
   * Cleans a definition: trims text, fills missing ids, drops unknown fields.
   * Never throws; call validateSurvey() first when the input is untrusted.
   * Votes are dropped unless options.keepVotes is true.
   */
  function normalizeSurvey(raw, options) {
    var keepVotes = !!(options && options.keepVotes);
    raw = raw || {};
    var usedIds = {};

    var questions = (Array.isArray(raw.questions) ? raw.questions : []).map(function (q, i) {
      q = q || {};
      var num = i + 1;
      var id = q.id !== undefined && q.id !== null && String(q.id).trim() ? String(q.id).trim() : 'q' + num;
      var base = id;
      var bump = 2;
      while (usedIds[id]) id = base + '_' + bump++;
      usedIds[id] = true;

      var type = QUESTION_TYPES.indexOf(q.type) !== -1 ? q.type : 'single';
      var out = { id: id, type: type, title: text(q.title) };
      if (text(q.subtitle)) out.subtitle = text(q.subtitle);

      if (CHOICE_TYPES.indexOf(type) !== -1) {
        var j = 0;
        var usedOptionIds = {};
        out.options = (Array.isArray(q.options) ? q.options : [])
          .filter(optionText)
          .map(function (o) {
            j++;
            var oid = o && typeof o === 'object' && text(o.id) ? text(o.id) : 'opt' + num + '_' + j;
            var obase = oid;
            var obump = 2;
            while (usedOptionIds[oid]) oid = obase + '_' + obump++;
            usedOptionIds[oid] = true;
            return { id: oid, text: optionText(o) };
          });
        if (type === 'multi') {
          var m = Number(q.maxSelect);
          if (Number.isInteger(m) && m >= 1 && m <= out.options.length) out.maxSelect = m;
        }
      } else if (type === 'scale') {
        if (text(q.leftLabel)) out.leftLabel = text(q.leftLabel);
        if (text(q.centerLabel)) out.centerLabel = text(q.centerLabel);
        if (text(q.rightLabel)) out.rightLabel = text(q.rightLabel);
        out.scaleLabels = fiveStrings(q.scaleLabels) || defaultScaleLabels(out);
      } else if (type === 'rating') {
        var rl = fiveStrings(q.labels);
        if (rl) out.labels = rl;
      } else if (type === 'wordcloud') {
        if (text(q.placeholder)) out.placeholder = text(q.placeholder);
      }

      if (text(q.tag)) out.tag = text(q.tag);
      out.votes = keepVotes && q.votes && typeof q.votes === 'object' ? q.votes : {};
      return out;
    });

    var survey = { title: text(raw.title) };
    if (text(raw.shortTitle)) survey.shortTitle = text(raw.shortTitle);
    if (text(raw.badge)) survey.badge = text(raw.badge);
    if (text(raw.description)) survey.description = text(raw.description);
    if (LOGOS.indexOf(raw.logo) !== -1) survey.logo = raw.logo;
    survey.questions = questions;
    return survey;
  }

  /** Builds a runnable survey (definition + live state). Throws when the definition is invalid. */
  function createSurvey(definition) {
    var errors = validateSurvey(definition);
    if (errors.length) throw new Error('Geçersiz anket: ' + errors.join(' '));
    var survey = normalizeSurvey(definition);
    survey.activeQuestionIndex = 0;
    survey.acceptingVotes = true;
    return survey;
  }

  /** The shareable, vote-free definition of a (running) survey, ready for JSON export. */
  function toDefinition(survey) {
    var def = normalizeSurvey(survey);
    def.questions.forEach(function (q) { delete q.votes; });
    var out = { schema: SCHEMA_VERSION };
    Object.keys(def).forEach(function (k) { out[k] = def[k]; });
    return out;
  }

  /** What a participant's phone is allowed to know about a question. */
  function publicQuestion(q) {
    var out = {};
    PUBLIC_QUESTION_FIELDS.forEach(function (k) {
      if (q[k] !== undefined) out[k] = q[k];
    });
    return out;
  }

  /** Short random room code, e.g. "pollen-k3x9ab". */
  function newRoomId() {
    var alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
    var code = '';
    for (var i = 0; i < 6; i++) code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    return 'pollen-' + code;
  }

  var templates = {
    bodtum: {
      "schema": "pollen.survey.v1",
      "title": "BODTÜM & ODTÜ Yapay Zeka Kullanım ve Eğilim Anketi",
      "shortTitle": "Yapay Zeka Anketi",
      "badge": "BODTÜM & ODTÜ MEZUNLARI DERNEĞİ",
      "logo": "bodtum",
      "questions": [
        {
          "id": "q1",
          "type": "single",
          "title": "Yapay zekayı ne sıklıkla kullanıyorsunuz?",
          "options": [
            {
              "id": "opt1_1",
              "text": "Gözlemciyim (Henüz kullanmıyorum)"
            },
            {
              "id": "opt1_2",
              "text": "Ara sıra (Merak ettikçe / nadiren)"
            },
            {
              "id": "opt1_3",
              "text": "Düzenli kullanıcı (Haftalık iş akışımda)"
            },
            {
              "id": "opt1_4",
              "text": "İleri düzey uzman (Her gün işimin merkezinde)"
            }
          ],
          "tag": "benimseme"
        },
        {
          "id": "q2",
          "type": "multi",
          "title": "Hangi yapay zeka araçlarını deneyimlediniz?",
          "subtitle": "(Birden fazla seçebilirsiniz)",
          "options": [
            {
              "id": "opt2_1",
              "text": "Sohbet Modelleri (ChatGPT, Claude, Gemini)"
            },
            {
              "id": "opt2_2",
              "text": "Arama & Araştırma (Perplexity, NotebookLM)"
            },
            {
              "id": "opt2_3",
              "text": "Görsel & Medya (Midjourney, Suno, DALL-E)"
            },
            {
              "id": "opt2_4",
              "text": "Ofis Asistanları (Copilot, Notion AI)"
            },
            {
              "id": "opt2_5",
              "text": "Kod & Veri Analizi (Cursor, GitHub Copilot, Python)"
            },
            {
              "id": "opt2_6",
              "text": "Henüz hiçbirini kullanmadım"
            }
          ],
          "tag": "araçlar"
        },
        {
          "id": "q3",
          "type": "multi",
          "title": "En çok hangi alanda fayda sağlıyorsunuz?",
          "subtitle": "(En çok 2 seçenek belirleyin)",
          "options": [
            {
              "id": "opt3_1",
              "text": "Belge özetleme, araştırma ve bilgi edinme"
            },
            {
              "id": "opt3_2",
              "text": "Metin yazımı, raporlama ve çeviri"
            },
            {
              "id": "opt3_3",
              "text": "Stratejik karar alma ve fikir ortaklığı"
            },
            {
              "id": "opt3_4",
              "text": "Rutin işleri hızlandırıp zaman kazanma"
            },
            {
              "id": "opt3_5",
              "text": "Henüz somut bir fayda sağlamadım"
            }
          ],
          "maxSelect": 2,
          "tag": "fayda"
        },
        {
          "id": "q4",
          "type": "scale",
          "title": "İnsanlığın geleceği için: Tehdit mi, Fırsat mı?",
          "subtitle": "(1: Büyük Tehdit — 3: Dengede — 5: Büyük Fırsat)",
          "leftLabel": "Büyük Tehdit",
          "centerLabel": "Dengede",
          "rightLabel": "Büyük Fırsat",
          "scaleLabels": [
            "1 - Büyük Tehdit (İş kaybı ve varoluşsal risk)",
            "2 - Tehdit Ağırlıklı",
            "3 - Dengede (Nasıl kullandığımıza bağlı)",
            "4 - Fırsat Ağırlıklı",
            "5 - Büyük Fırsat (Yeni bir refah çağı)"
          ],
          "tag": "duygu"
        },
        {
          "id": "q5",
          "type": "scale",
          "title": "Yeni nesil ve eğitim: Çocuklarımız için ne ifade ediyor?",
          "subtitle": "(1: Derin Kaygı — 3: Dengeli — 5: Büyük Sıçrama)",
          "leftLabel": "Derin Kaygı",
          "centerLabel": "Dengeli",
          "rightLabel": "Büyük Sıçrama",
          "scaleLabels": [
            "1 - Derin Kaygı (Hazırcılık / düşünme kaybı)",
            "2 - Kaygılar Ağır Basıyor",
            "3 - Dengeli Dönüşüm (Yeni beceriler öne çıkar)",
            "4 - Fırsatlar Ağır Basıyor",
            "5 - Büyük Sıçrama (Daha üretken kuşak)"
          ],
          "tag": "duygu"
        },
        {
          "id": "q6",
          "type": "scale",
          "title": "Türkiye'deki kurumlar yapay zekaya ne kadar hazır?",
          "subtitle": "(1: Çok Hazırlıksız — 3: Strateji Yok — 5: Çevik & Hazır)",
          "leftLabel": "Çok Hazırlıksız",
          "centerLabel": "Stratejisiz",
          "rightLabel": "Çevik & Hazır",
          "scaleLabels": [
            "1 - Çok Hazırlıksız (Vizyon eksik)",
            "2 - Geride Kalıyoruz",
            "3 - Merak Var, Strateji Yok",
            "4 - Ciddi İlerlemeler Var",
            "5 - Çevik ve Hazır (Öncü liderlik)"
          ],
          "tag": "hazırlık"
        },
        {
          "id": "q7",
          "type": "scale",
          "title": "Yapay zeka insan aklını köreltir mi, güçlendirir mi?",
          "subtitle": "(1: Köreltir — 3: Kullanıma Bağlı — 5: Güçlendirir)",
          "leftLabel": "Köreltir",
          "centerLabel": "Kullanıma Bağlı",
          "rightLabel": "Güçlendirir",
          "scaleLabels": [
            "1 - Köreltir (Zihinsel tembellik)",
            "2 - Körelme Riski Ağır Basıyor",
            "3 - Dengeli Araç (Kullanıma bağlı)",
            "4 - Üretkenliği Artırır",
            "5 - Güçlendirir (Zihinsel sıçrama)"
          ],
          "tag": "duygu"
        },
        {
          "id": "q8",
          "type": "single",
          "title": "Temkinli yaklaşmanıza en çok ne sebep oluyor?",
          "options": [
            {
              "id": "opt8_1",
              "text": "Veri gizliliği, güvenlik ve telif kaygısı"
            },
            {
              "id": "opt8_2",
              "text": "Yanıltıcı yanıtlar (halüsinasyon) ve teyit zorluğu"
            },
            {
              "id": "opt8_3",
              "text": "Kendi işime nasıl entegre edeceğimi bilememek"
            },
            {
              "id": "opt8_4",
              "text": "Yenilikleri takip etmeye zaman bulamamak"
            },
            {
              "id": "opt8_5",
              "text": "Mesafe koymuyorum, aktif kullanıyorum"
            }
          ],
          "tag": "engeller"
        },
        {
          "id": "q9",
          "type": "single",
          "title": "Bugünkü buluşmadan en çok hangi kazanımla ayrılmak istersiniz?",
          "options": [
            {
              "id": "opt9_1",
              "text": "İşimde hemen uygulayabileceğim somut taktikler"
            },
            {
              "id": "opt9_2",
              "text": "Geleceğin meslekleri ve stratejik büyük resim"
            },
            {
              "id": "opt9_3",
              "text": "Yapay zekanın nasıl çalıştığı ve sınırları"
            },
            {
              "id": "opt9_4",
              "text": "Etik, toplum ve insanlığın geleceği"
            }
          ],
          "tag": "beklenti"
        }
      ]
    }
  };

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    QUESTION_TYPES: QUESTION_TYPES,
    templates: templates,
    validateSurvey: validateSurvey,
    normalizeSurvey: normalizeSurvey,
    createSurvey: createSurvey,
    toDefinition: toDefinition,
    publicQuestion: publicQuestion,
    defaultScaleLabels: defaultScaleLabels,
    newRoomId: newRoomId
  };
});
