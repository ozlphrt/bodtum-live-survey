// Presenter Dashboard - BODTUM Yapay Zeka Canlı Anketi

// Multi-Broker List with Automatic Fallback
const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt'
];

// Room Identification
function getOrCreateRoomId() {
  const params = new URLSearchParams(window.location.search);
  let room = params.get('room');
  if (!room) {
    room = 'bodtum-' + Math.floor(1000 + Math.random() * 9000);
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('room', room);
    window.history.replaceState({}, '', newUrl);
  }
  return room;
}

const roomId = getOrCreateRoomId();
document.getElementById('roomCodeText').textContent = roomId;

// Audio Chime Synthesizer using Web Audio API
class AudioNotifier {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.ctx = new AudioContext();
    }
  }

  playVoteChime() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const now = this.ctx.currentTime;

      // 1. Crisp Plastic Snap Transient (mechanical switch click)
      const snapOsc = this.ctx.createOscillator();
      const snapGain = this.ctx.createGain();
      const snapFilter = this.ctx.createBiquadFilter();

      snapFilter.type = 'bandpass';
      snapFilter.frequency.setValueAtTime(2800, now);
      snapFilter.Q.setValueAtTime(2.5, now);

      snapOsc.type = 'triangle';
      snapOsc.frequency.setValueAtTime(2400, now);
      snapOsc.frequency.exponentialRampToValueAtTime(320, now + 0.025);

      snapGain.gain.setValueAtTime(0.35, now);
      snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

      snapOsc.connect(snapFilter);
      snapFilter.connect(snapGain);
      snapGain.connect(this.ctx.destination);

      snapOsc.start(now);
      snapOsc.stop(now + 0.026);

      // 2. Plastic Body Resonance ('thock')
      const bodyOsc = this.ctx.createOscillator();
      const bodyGain = this.ctx.createGain();

      bodyOsc.type = 'sine';
      bodyOsc.frequency.setValueAtTime(520, now);
      bodyOsc.frequency.exponentialRampToValueAtTime(140, now + 0.035);

      bodyGain.gain.setValueAtTime(0.25, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      bodyOsc.connect(bodyGain);
      bodyGain.connect(this.ctx.destination);

      bodyOsc.start(now);
      bodyOsc.stop(now + 0.036);
    } catch (e) { }
  }
}

const notifier = new AudioNotifier();

// BODTUM ODTÜ Alumni Audience AI Survey Questions (9 Targeted Questions - Pristine Turkish)
const DEFAULT_SURVEY = {
  title: "BODTÜM & ODTÜ Yapay Zeka Kullanım ve Eğilim Anketi",
  activeQuestionIndex: 0,
  acceptingVotes: true,
  questions: [
    {
      id: "q1",
      type: "single",
      title: "Yapay zekayı günlük veya profesyonel hayatınızda ne sıklıkla kullanıyorsunuz?",
      options: [
        { id: "opt1_1", text: "Gözlemciyim (Henüz aktif kullanmıyorum, gelişmeleri uzaktan izliyorum)" },
        { id: "opt1_2", text: "Meraklı Kaşif (Ara sıra arama, metin veya çeviri için deniyorum)" },
        { id: "opt1_3", text: "Düzenli Kullanıcı (Haftalık iş akışımın ve projelerimin doğal parçası)" },
        { id: "opt1_4", text: "İleri Düzey Uzman Kullanıcı (Her gün işimin merkezinde, prompt ve özel araçlarla)" }
      ],
      votes: {}
    },
    {
      id: "q2",
      type: "multi",
      title: "Şimdiye kadar hangi yapay zeka araçlarını deneyimlediniz?",
      subtitle: "(Birden fazla seçebilirsiniz)",
      options: [
        { id: "opt2_1", text: "Sohbet Modelleri (ChatGPT, Claude, Gemini)" },
        { id: "opt2_2", text: "Akıllı Arama & Derin Araştırma (Perplexity, Genspark, NotebookLM)" },
        { id: "opt2_3", text: "Görsel & Medya Üretimi (Midjourney, DALL-E, Suno)" },
        { id: "opt2_4", text: "Kurumsal Ofis Asistanları (Microsoft Copilot, Notion AI)" },
        { id: "opt2_5", text: "Yazılım, Kod & Veri Analitiği (Cursor, GitHub Copilot, Python/API)" },
        { id: "opt2_6", text: "Henüz hiçbirini aktif olarak kullanmadım" }
      ],
      votes: {}
    },
    {
      id: "q3",
      type: "multi",
      title: "Yapay zekadan en çok hangi alanda somut fayda sağlıyorsunuz?",
      subtitle: "(En çok 2 seçenek belirleyin)",
      options: [
        { id: "opt3_1", text: "Karmaşık belgeleri özetleme, hızlı öğrenme ve bilgi madenciliği" },
        { id: "opt3_2", text: "Profesyonel yazışma, raporlama, konuşma metni veya yabancı dil çevirisi" },
        { id: "opt3_3", text: "Stratejik karar alma, senaryo analizi ve beyin fırtınası partnerliği" },
        { id: "opt3_4", text: "Rutin işleri hızlandırıp stratejik konulara zaman kazanma" },
        { id: "opt3_5", text: "Henüz ölçülebilir somut bir fayda oluşturmadım" }
      ],
      votes: {}
    },
    {
      id: "q4",
      type: "scale",
      title: "Yapay zeka insanlığın geleceği için: Tehdit mi, Fırsat mı?",
      subtitle: "(1: Varoluşsal Tehdit — 3: Nasıl Kullandığımıza Bağlı — 5: Muazzam Fırsat)",
      leftLabel: "Büyük Tehdit",
      centerLabel: "Yönetişime Bağlı",
      rightLabel: "Büyük Fırsat",
      scaleLabels: [
        "1 - Kesinlikle Tehdit (İşsizlik, manipülasyon ve varoluşsal riskler)",
        "2 - Risk ve Tehditler Ağır Basıyor",
        "3 - Dengede (Fırsat da risk de insanlığın yönetimine bağlı)",
        "4 - Fırsatlar ve Potansiyel Ağır Basıyor",
        "5 - Kesinlikle Büyük Fırsat (Yeni bir aydınlanma ve refah çağı)"
      ],
      votes: {}
    },
    {
      id: "q5",
      type: "scale",
      title: "Yeni nesil ve eğitim: Çocuklarımız ve gençler için ne ifade ediyor?",
      subtitle: "(1: Bilişsel Kaygı & Hazırcılık — 3: Dengeli Dönüşüm — 5: Büyük Potansiyel Sıçraması)",
      leftLabel: "Derin Kaygı",
      centerLabel: "Dengeli Dönüşüm",
      rightLabel: "Büyük Sıçrama",
      scaleLabels: [
        "1 - Derin Kaygı (Hazırcılık, eleştirel düşünme kaybı ve istihdam endişesi)",
        "2 - Kaygılar Ağır Basıyor",
        "3 - Dengeli Dönüşüm (Ezber biter, yeni beceriler ve eleştirel muhakeme öne çıkar)",
        "4 - Fırsatlar Ağır Basıyor",
        "5 - Büyük Sıçrama (Tarihin en üretken ve donanımlı kuşağı yetişecek)"
      ],
      votes: {}
    },
    {
      id: "q6",
      type: "scale",
      title: "Türkiye'deki kurumlar ve liderler yapay zeka çağına ne kadar hazır?",
      subtitle: "(1: Çok Hazırlıksız & Fırsatlar Kaçıyor — 3: Merak Var Ama Strateji Yok — 5: Vizyoner & Çevik)",
      leftLabel: "Çok Hazırlıksız",
      centerLabel: "Arafta / Stratejisiz",
      rightLabel: "Çevik & Öncü",
      scaleLabels: [
        "1 - Çok Hazırlıksız (Fırsatlar kaçıyor, yönetimsel vizyon eksik)",
        "2 - Oldukça Geride Kalıyoruz",
        "3 - Arafta (Yoğun ilgi var fakat somut kurumsal strateji yok)",
        "4 - Ciddi Adımlar ve İlerlemeler Var",
        "5 - Çevik ve Hazır (Dönüşüme cesaretle liderlik ediliyor)"
      ],
      votes: {}
    },
    {
      id: "q7",
      type: "scale",
      title: "Zihinsel bağımsızlık: Yapay zeka insan aklını köreltir mi, güçlendirir mi?",
      subtitle: "(1: Düşünsel Körelme — 3: Dengeli Araç — 5: Entelektüel Sıçrama)",
      leftLabel: "Düşünsel Körelme",
      centerLabel: "Dengeli Araç",
      rightLabel: "Zihinsel Büyüme",
      scaleLabels: [
        "1 - Düşünsel Körelme (Derin muhakeme ve analitik düşünce zayıflar)",
        "2 - Zihinsel Tembellik Riski Ağır Basıyor",
        "3 - Dengeli Araç (Kullanıcının zihinsel disiplinine bağlı)",
        "4 - Zihinsel Üretkenliği Artırır",
        "5 - Entelektüel Sıçrama (Rutin kalkar, yaratıcı derinlik artar)"
      ],
      votes: {}
    },
    {
      id: "q8",
      type: "single",
      title: "Yapay zekaya temkinli yaklaşmanıza veya mesafeli durmanıza en çok ne sebep oluyor?",
      options: [
        { id: "opt8_1", text: "Veri gizliliği, kurumsal güvenlik ve telif/hukuk belirsizlikleri" },
        { id: "opt8_2", text: "Halüsinasyon (yanıltıcı yanıt) ve doğruluk teyidi zorluğu" },
        { id: "opt8_3", text: "Kendi uzmanlık alanıma ve günlük işime nasıl entegre edeceğimi bilememek" },
        { id: "opt8_4", text: "Hızla değişen yenilikleri takip etmeye yeterli zaman bulamamak" },
        { id: "opt8_5", text: "Mesafe koymuyorum; hayatımın ve işimin ayrılmaz bir parçası" }
      ],
      votes: {}
    },
    {
      id: "q9",
      type: "single",
      title: "Bugünkü ODTÜ / BODTÜM buluşmasından en çok hangi kazanımla ayrılmak istersiniz?",
      options: [
        { id: "opt9_1", text: "Hemen yarın kendi işimde uygulayabileceğim somut taktik ve yöntemler" },
        { id: "opt9_2", text: "Geleceğin meslekleri, yatırımlar ve stratejik eğilimlere dair büyük resim" },
        { id: "opt9_3", text: "Büyük dil modellerinin (LLM) gerçekte nasıl çalıştığı ve sınırları" },
        { id: "opt9_4", text: "Etik, denetim, toplum ve insanlığın geleceğine dair felsefi tartışma" }
      ],
      votes: {}
    }
  ]
};

// Initialize or update state (ensure latest question structure & titles overwrite cached labels)
let survey = DEFAULT_SURVEY;
try {
  const saved = localStorage.getItem(`survey_state_${roomId}`);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed.questions && Array.isArray(parsed.questions)) {
      DEFAULT_SURVEY.questions.forEach(defQ => {
        const matched = parsed.questions.find(pq => pq.id === defQ.id);
        if (matched && matched.votes) {
          defQ.votes = matched.votes;
        }
      });
      survey = DEFAULT_SURVEY;
    }
  }
} catch (e) { }

// Ensure opt1_4 uses "İleri Düzey Uzman Kullanıcı"
if (survey && survey.questions && survey.questions[0] && survey.questions[0].options) {
  const opt1_4 = survey.questions[0].options.find(o => o.id === 'opt1_4');
  if (opt1_4) {
    opt1_4.text = "İleri Düzey Uzman Kullanıcı (Her gün işimin merkezinde, prompt ve özel araçlarla)";
  }
}

if (!survey.resetEpoch) {
  survey.resetEpoch = Date.now();
  saveSurvey();
}

let activeParticipants = new Set();

function saveSurvey() {
  localStorage.setItem(`survey_state_${roomId}`, JSON.stringify(survey));
}

// Calculate Aggregated Results
function calculateResults(q) {
  if (!q) return { totalVotes: 0 };
  const totalVotes = Object.keys(q.votes || {}).length;

  if (q.type === 'single' || q.type === 'multi') {
    const counts = {};
    q.options.forEach(opt => counts[opt.id] = 0);

    Object.values(q.votes).forEach(val => {
      if (Array.isArray(val)) {
        val.forEach(optId => {
          if (counts[optId] !== undefined) counts[optId]++;
        });
      } else if (counts[val] !== undefined) {
        counts[val]++;
      }
    });

    const breakdown = q.options.map(opt => ({
      id: opt.id,
      text: opt.text,
      count: counts[opt.id] || 0,
      percentage: totalVotes > 0 ? Math.round(((counts[opt.id] || 0) / totalVotes) * 100) : 0
    }));
    return { totalVotes, breakdown };
  }

  if (q.type === 'rating') {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    Object.values(q.votes).forEach(val => {
      const num = parseInt(val, 10);
      if (counts[num] !== undefined) {
        counts[num]++;
        sum += num;
      }
    });
    const average = totalVotes > 0 ? (sum / totalVotes).toFixed(1) : "0.0";
    const breakdown = [1, 2, 3, 4, 5].map(star => ({
      rating: star,
      label: (q.labels || ["1", "2", "3", "4", "5"])[star - 1],
      count: counts[star],
      percentage: totalVotes > 0 ? Math.round((counts[star] / totalVotes) * 100) : 0
    }));
    return { totalVotes, average, breakdown };
  }

  if (q.type === 'scale') {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    Object.values(q.votes || {}).forEach(val => {
      const num = parseInt(val, 10);
      if (counts[num] !== undefined) {
        counts[num]++;
        sum += num;
      }
    });
    const average = totalVotes > 0 ? (sum / totalVotes).toFixed(1) : "0.0";
    const labels = q.scaleLabels || [
      "1 - Kesinlikle Tehdit",
      "2 - Tehdit Ağırlıklı",
      "3 - Kullanım Amacına Bağlı",
      "4 - Fırsat Ağırlıklı",
      "5 - Kesinlikle Büyük Fırsat"
    ];
    const breakdown = [1, 2, 3, 4, 5].map(val => ({
      value: val,
      label: labels[val - 1] || `${val}`,
      count: counts[val],
      percentage: totalVotes > 0 ? Math.round((counts[val] / totalVotes) * 100) : 0
    }));
    return {
      totalVotes,
      average,
      breakdown,
      leftLabel: q.leftLabel || '',
      centerLabel: q.centerLabel || '',
      rightLabel: q.rightLabel || ''
    };
  }

  if (q.type === 'wordcloud') {
    const wordCounts = {};
    const recentEntries = [];
    Object.entries(q.votes).forEach(([voterId, text]) => {
      if (!text || typeof text !== 'string') return;
      const clean = text.trim();
      if (!clean) return;
      recentEntries.unshift({ voterId: voterId.slice(0, 6), text: clean });
      const lower = clean.toLowerCase();
      wordCounts[lower] = (wordCounts[lower] || 0) + 1;
    });

    const words = Object.entries(wordCounts)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);
    return { totalVotes, words, recentEntries: recentEntries.slice(0, 15) };
  }

  return { totalVotes };
}

function getSurveyPayload() {
  const activeQ = survey.questions[survey.activeQuestionIndex];
  return {
    title: survey.title,
    resetEpoch: survey.resetEpoch || 1,
    activeQuestionIndex: survey.activeQuestionIndex,
    totalQuestions: survey.questions.length,
    acceptingVotes: survey.acceptingVotes,
    isLive: true,
    timestamp: Date.now(),
    activeQuestion: activeQ ? {
      ...activeQ,
      votesCount: Object.keys(activeQ.votes || {}).length,
      results: calculateResults(activeQ)
    } : null,
    questions: survey.questions.map(q => ({
      id: q.id,
      type: q.type,
      title: q.title,
      subtitle: q.subtitle,
      options: q.options,
      labels: q.labels,
      placeholder: q.placeholder,
      votesCount: Object.keys(q.votes || {}).length,
      results: calculateResults(q)
    })),
    participantCount: activeParticipants.size
  };
}

// DOM Elements
const qrcodeBox = document.getElementById('qrcodeBox');
const qrImage = document.getElementById('qrImage');
const joinUrlText = document.getElementById('joinUrlText');
const copyUrlBtn = document.getElementById('copyUrlBtn');
const participantCount = document.getElementById('participantCount');
const soundToggle = document.getElementById('soundToggle');
const fullscreenBtn = document.getElementById('fullscreenBtn');

const qIndexTag = document.getElementById('qIndexTag');
const qTypeTag = document.getElementById('qTypeTag');
const lockStatusBadge = document.getElementById('lockStatusBadge');
const qTitle = document.getElementById('qTitle');
const qVoteTotal = document.getElementById('qVoteTotal');
const resultsContainer = document.getElementById('resultsContainer');

const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const toggleLockBtn = document.getElementById('toggleLockBtn');
const resetBtn = document.getElementById('resetBtn');
const addQuestionBtn = document.getElementById('addQuestionBtn');
const openSimulatorBtn = document.getElementById('openSimulatorBtn');
const openTabBtn = document.getElementById('openTabBtn');
const simulatorDrawer = document.getElementById('simulatorDrawer');
const closeSimulatorBtn = document.getElementById('closeSimulatorBtn');
const simulatorFrame = document.getElementById('simulatorFrame');

// Compute Voter URL
function getVoterUrl() {
  const url = new URL(window.location.href);
  let path = url.pathname;
  if (path.endsWith('/') || path.endsWith('/index.html')) {
    path = path.replace(/index\.html$/, '').replace(/\/$/, '') + '/vote.html';
  } else if (!path.endsWith('vote.html')) {
    path = path + '/vote.html';
  }
  url.pathname = path;
  url.searchParams.set('room', roomId);
  return url.toString();
}

const voterJoinUrl = getVoterUrl();
joinUrlText.textContent = voterJoinUrl;
joinUrlText.title = voterJoinUrl;

// Render Vector SVG QR Code directly from local qrcode.js
function renderQrCode(url) {
  const box = document.getElementById('qrcodeBox');
  if (!box) return;

  try {
    if (typeof qrcode === 'function') {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      box.innerHTML = qr.createSvgTag({
        cellSize: 6,
        margin: 0,
        scalable: true
      });
      const svg = box.querySelector('svg');
      if (svg) {
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.display = 'block';
        return;
      }
    }
  } catch (e) {
    console.warn('Local QR error, falling back to image:', e);
  }

  // Fallback to direct image
  box.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}" style="width: 100%; height: 100%; display: block;" alt="QR Code" />`;
}

renderQrCode(voterJoinUrl);

// Copy button
if (copyUrlBtn) {
  copyUrlBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(voterJoinUrl).then(() => {
      const original = copyUrlBtn.innerHTML;
      copyUrlBtn.innerHTML = '<span style="font-size:0.75rem;font-weight:700;color:#10b981;">✓</span>';
      setTimeout(() => copyUrlBtn.innerHTML = original, 1800);
    });
  });
}

// Sound Toggle
function updateSoundToggleUI() {
  if (notifier.enabled) {
    soundToggle.classList.add('active');
    soundToggle.title = 'Ses Bildirimi: Açık';
    soundToggle.innerHTML = `<svg class="util-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
  } else {
    soundToggle.classList.remove('active');
    soundToggle.title = 'Ses Bildirimi: Kapalı';
    soundToggle.innerHTML = `<svg class="util-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`;
  }
}
soundToggle.addEventListener('click', () => {
  notifier.enabled = !notifier.enabled;
  updateSoundToggleUI();
  if (notifier.enabled) {
    notifier.playVoteChime();
  }
});

// Fullscreen Toggle
fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => { });
  } else {
    document.exitFullscreen().catch(() => { });
  }
});

// Mobile Simulator Drawer
openSimulatorBtn.addEventListener('click', () => {
  simulatorDrawer.classList.toggle('hidden');
  if (!simulatorDrawer.classList.contains('hidden')) {
    simulatorFrame.src = `./vote.html?room=${roomId}&sim=1`;
  }
});
closeSimulatorBtn.addEventListener('click', () => simulatorDrawer.classList.add('hidden'));
openTabBtn.addEventListener('click', () => window.open(voterJoinUrl, '_blank'));

// Add Question Dialog
const questionModal = document.getElementById('questionModal');
const newQuestionForm = document.getElementById('newQuestionForm');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalQType = document.getElementById('modalQType');
const modalOptionsGroup = document.getElementById('modalOptionsGroup');

modalQType.addEventListener('change', () => {
  modalOptionsGroup.style.display = (modalQType.value === 'single' || modalQType.value === 'multi') ? 'block' : 'none';
});

if (addQuestionBtn) addQuestionBtn.addEventListener('click', () => questionModal.showModal());
modalCancelBtn.addEventListener('click', () => questionModal.close());

newQuestionForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = document.getElementById('modalQTitle').value.trim();
  const type = modalQType.value;
  const options = document.getElementById('modalQOptions').value.split('\n').map(s => s.trim()).filter(Boolean);

  if (!title) return;

  const newQ = {
    id: 'q_' + Date.now(),
    type,
    title,
    options: (type === 'single' || type === 'multi') ? options.map((opt, i) => ({ id: `opt_${Date.now()}_${i}`, text: opt })) : [],
    labels: ["Çok Kötü", "Gelişmeli", "İyi", "Çok İyi", "Harika 🌟"],
    placeholder: "Cevabınızı yazın...",
    votes: {}
  };

  survey.questions.push(newQ);
  saveSurvey();
  broadcastState();
  renderSurvey();
  newQuestionForm.reset();
  questionModal.close();
});

// Generic In-App Modal Dialog (Promise-based executive confirmation)
function showInAppConfirm({
  icon = '⚠️',
  badge = 'UYARI',
  title = 'Onay Gerekli',
  bodyHtml = '',
  confirmText = 'Onayla',
  cancelText = 'Vazgeç',
  isDanger = false
} = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('inAppConfirmModal');
    const iconEl = document.getElementById('inAppModalIcon');
    const badgeEl = document.getElementById('inAppModalBadge');
    const titleEl = document.getElementById('inAppModalTitle');
    const bodyEl = document.getElementById('inAppModalBody');
    const cancelBtn = document.getElementById('inAppModalCancelBtn');
    const confirmBtn = document.getElementById('inAppModalConfirmBtn');

    if (!modal) {
      resolve(confirm(title));
      return;
    }

    iconEl.textContent = icon;
    iconEl.className = `inapp-modal-icon-badge ${isDanger ? 'danger' : ''}`;
    badgeEl.textContent = badge;
    badgeEl.className = `inapp-modal-badge-label ${isDanger ? 'danger' : ''}`;
    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    cancelBtn.textContent = cancelText;
    confirmBtn.textContent = confirmText;
    confirmBtn.className = `btn-inapp-confirm ${isDanger ? 'danger' : ''}`;

    modal.style.display = 'flex';

    function cleanup() {
      modal.style.display = 'none';
      cancelBtn.removeEventListener('click', onCancel);
      confirmBtn.removeEventListener('click', onConfirm);
      modal.removeEventListener('click', onBackdrop);
      window.removeEventListener('keydown', onKeyDown);
    }

    function onCancel() {
      cleanup();
      resolve(false);
    }

    function onConfirm() {
      cleanup();
      resolve(true);
    }

    function onBackdrop(e) {
      if (e.target === modal) {
        onCancel();
      }
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        onCancel();
      }
    }

    cancelBtn.addEventListener('click', onCancel);
    confirmBtn.addEventListener('click', onConfirm);
    modal.addEventListener('click', onBackdrop);
    window.addEventListener('keydown', onKeyDown);
  });
}

// Global Survey Reset Function (Accessible on All Pages)
async function executeSurveyReset() {
  const confirmed = await showInAppConfirm({
    icon: '🗑️',
    badge: 'TÜM OYLARI SIFIRLAMA',
    title: 'Tüm Oylar Sıfırlansın mı?',
    bodyHtml: `
      <p>Bu işlem geri alınamaz.</p>
      <div class="inapp-modal-highlight danger">
        Mevcut tüm <strong>katılımcı oyları, anket yanıtları ve katılımcı sayacı</strong> tamamen sıfırlanacaktır (0).
      </div>
      <p>Devam etmek istediğinize emin misiniz?</p>
    `,
    confirmText: 'Evet, Her Şeyi Sıfırla',
    cancelText: 'Vazgeç',
    isDanger: true
  });

  if (!confirmed) return;

  survey.resetEpoch = Date.now();
  survey.questions.forEach(q => q.votes = {});
  survey.activeQuestionIndex = 0;

  // Reset active participants / contributors / responders count to 0
  activeParticipants.clear();
  if (participantCount) participantCount.textContent = '0';
  const qrPartCount = document.getElementById('qrParticipantCount');
  if (qrPartCount) qrPartCount.textContent = '0';

  saveSurvey();
  if (mqttClient && mqttClient.connected) {
    mqttClient.publish(`bodtum/survey/${roomId}/reset`, JSON.stringify({ resetEpoch: survey.resetEpoch, roomId }), { qos: 1 });
  }
  broadcastState();
  renderSurvey();
  if (currentAdminView === 'insights') {
    generateSurveyInsights();
  }
  showToast('Tüm oylar ve katılımcı sayısı sıfırlandı.');
}

if (resetBtn) resetBtn.addEventListener('click', executeSurveyReset);
const globalResetBtn = document.getElementById('globalResetBtn');
if (globalResetBtn) globalResetBtn.addEventListener('click', executeSurveyReset);

// Lock Toggle
if (toggleLockBtn) {
  toggleLockBtn.addEventListener('click', () => {
    survey.acceptingVotes = !survey.acceptingVotes;
    saveSurvey();
    broadcastState();
    renderSurvey();
  });
}

// Navigation
prevBtn.addEventListener('click', () => {
  if (survey.activeQuestionIndex > 0) {
    survey.activeQuestionIndex--;
    saveSurvey();
    broadcastState();
    renderSurvey();
  }
});

nextBtn.addEventListener('click', () => {
  if (survey.activeQuestionIndex < survey.questions.length - 1) {
    survey.activeQuestionIndex++;
    saveSurvey();
    broadcastState();
    renderSurvey();
  }
});

// Render UI
function renderSurvey() {
  const activeQ = survey.questions[survey.activeQuestionIndex];
  if (!activeQ) return;

  qIndexTag.textContent = `Soru ${survey.activeQuestionIndex + 1} / ${survey.questions.length}`;
  qTypeTag.textContent = activeQ.type === 'single'
    ? 'Tek Seçim'
    : (activeQ.type === 'multi'
      ? 'Çoklu Seçim (Birden Fazla)'
      : (activeQ.type === 'scale'
        ? 'Doğrusal Ölçek (1-5 Spektrum)'
        : 'Değerlendirme'));

  qTitle.textContent = activeQ.title;
  const subEl = document.getElementById('qSubtitle');
  if (subEl) {
    subEl.textContent = activeQ.subtitle || '';
    subEl.style.display = activeQ.subtitle ? 'block' : 'none';
  }

  const totalVotes = Object.keys(activeQ.votes || {}).length;
  qVoteTotal.textContent = totalVotes;

  if (toggleLockBtn) {
    if (!survey.acceptingVotes) {
      lockStatusBadge.style.display = 'inline-block';
      toggleLockBtn.innerHTML = '<svg class="action-mini-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg><span>Oylamayı Aç</span> <span class="keycap">L</span>';
    } else {
      lockStatusBadge.style.display = 'none';
      toggleLockBtn.innerHTML = '<svg class="action-mini-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg><span>Kilitle</span> <span class="keycap">L</span>';
    }
  } else if (lockStatusBadge) {
    lockStatusBadge.style.display = survey.acceptingVotes ? 'none' : 'inline-block';
  }

  prevBtn.disabled = survey.activeQuestionIndex === 0;
  prevBtn.style.opacity = survey.activeQuestionIndex === 0 ? '0.4' : '1';
  nextBtn.innerHTML = survey.activeQuestionIndex === survey.questions.length - 1
    ? '<span>Tamamlandı</span>'
    : '<span>Sonraki</span> <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg> <span class="keycap" style="background: rgba(0,0,0,0.2); color:#fff;">→</span>';

  // Render Stepper Pills on Stage Bottom Bar
  const stepperContainer = document.getElementById('questionStepperPills');
  if (stepperContainer) {
    stepperContainer.innerHTML = survey.questions.map((q, idx) => `
      <button type="button" class="stepper-pill-btn ${idx === survey.activeQuestionIndex ? 'active' : ''}" data-idx="${idx}" title="${idx + 1}. Soru: ${escapeHtml(q.title)}">
        ${idx + 1}
      </button>
    `).join('');
    stepperContainer.querySelectorAll('.stepper-pill-btn').forEach(btn => {
      btn.onclick = () => {
        survey.activeQuestionIndex = parseInt(btn.dataset.idx, 10);
        saveSurvey();
        broadcastState();
        renderSurvey();
      };
    });
  }

  // Update Header Tab Badge & Participant Count
  const tabBadge = document.getElementById('tabQuestionBadge');
  if (tabBadge) {
    tabBadge.textContent = `${survey.activeQuestionIndex + 1}/${survey.questions.length}`;
  }
  if (participantCount) {
    participantCount.textContent = activeParticipants.size;
  }

  // Update QR Page Participant Counter
  const qrPartCount = document.getElementById('qrParticipantCount');
  if (qrPartCount) {
    qrPartCount.textContent = activeParticipants.size;
  }

  const results = calculateResults(activeQ);
  if (activeQ.type === 'single' || activeQ.type === 'multi') renderOptionsBreakdown(results);
  else if (activeQ.type === 'scale') renderScale(results, activeQ);
  else if (activeQ.type === 'rating') renderRating(results);
  else if (activeQ.type === 'wordcloud') renderWordCloud(results);
}

function renderScale(results, q) {
  const avg = parseFloat(results.average || "0.0");
  const total = results.totalVotes || 0;
  const positionPercent = total > 0 ? Math.min(100, Math.max(0, ((avg - 1) / 4) * 100)) : 50;
  const breakdown = results.breakdown || [];

  resultsContainer.innerHTML = `
    <div class="scale-summary-card">
      <div class="scale-header-row">
        <div>
          <span class="scale-avg-label">Genel Katılımcı Ortalaması</span>
          <div class="scale-avg-display">
            <span class="scale-avg-val">${total > 0 ? avg.toFixed(1) : '—'}</span>
            <span class="scale-avg-max">/ 5.0</span>
          </div>
        </div>
        <div class="scale-vote-badge">${total} oy kaydedildi</div>
      </div>

      <!-- Gradient Spectrum Track -->
      <div class="scale-spectrum-box">
        <div class="scale-spectrum-bar">
          ${total > 0 ? `
            <div class="scale-pin" style="left: ${positionPercent}%;">
              <div class="scale-pin-bubble">${avg.toFixed(1)}</div>
              <div class="scale-pin-line"></div>
            </div>
          ` : ''}
        </div>
        <div class="scale-anchors-row">
          <span class="scale-anchor left">← ${escapeHtml(q.leftLabel || 'Düşük')}</span>
          <span class="scale-anchor center">${escapeHtml(q.centerLabel || 'Dengeli')}</span>
          <span class="scale-anchor right">${escapeHtml(q.rightLabel || 'Yüksek')} →</span>
        </div>
      </div>

      <!-- Unified Option-Row Distribution Bars (100% Left-Aligned from X=0) -->
      <div class="scale-distribution-list">
        ${(() => {
      let maxCount = 0;
      breakdown.forEach(b => { if (b.count > maxCount) maxCount = b.count; });
      return breakdown.map(item => {
        const isLead = maxCount > 0 && item.count === maxCount && total > 1;
        return `
              <div class="option-row ${isLead ? 'lead' : ''}">
                <div class="option-bar-bg" style="width: ${item.percentage}%;"></div>
                <div class="option-content">
                  <div class="option-left">
                    <div class="option-idx">${item.value}</div>
                    <div class="option-text">${escapeHtml(item.label)}</div>
                  </div>
                  <div class="option-right">
                    <span class="option-count">${item.count} oy</span>
                    <span class="option-percent">${item.percentage}%</span>
                  </div>
                </div>
              </div>
            `;
      }).join('');
    })()}
      </div>
    </div>
  `;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function renderOptionsBreakdown(results) {
  const breakdown = results.breakdown || [];
  let maxCount = 0;
  breakdown.forEach(b => { if (b.count > maxCount) maxCount = b.count; });

  const rows = breakdown.map((item, idx) => {
    const isLead = maxCount > 0 && item.count === maxCount;
    const letter = LETTERS[idx] || (idx + 1);

    return `
      <div class="option-row ${isLead && results.totalVotes > 1 ? 'lead' : ''}">
        <div class="option-bar-bg" style="width: ${item.percentage}%;"></div>
        <div class="option-content">
          <div class="option-left">
            <div class="option-idx">${letter}</div>
            <div class="option-text">${escapeHtml(item.text)}</div>
          </div>
          <div class="option-right">
            <span class="option-count">${item.count} oy</span>
            <span class="option-percent">${item.percentage}%</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  resultsContainer.innerHTML = `<div class="options-list">${rows}</div>`;
}

function renderRating(results) {
  const avg = results.average || "0.0";
  const breakdown = results.breakdown || [];
  const starCount = Math.round(parseFloat(avg));
  const stars = [1, 2, 3, 4, 5].map(i => i <= starCount ? '★' : '☆').join('');

  resultsContainer.innerHTML = `
    <div class="rating-summary-card">
      <div class="rating-score-box">
        <div class="rating-big-number">${avg}</div>
        <div class="rating-stars-row">${stars}</div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">${results.totalVotes} oy verildi</div>
      </div>
      <div class="rating-bars-list">
        ${breakdown.slice().reverse().map(item => `
          <div class="rating-bar-item">
            <div class="rating-bar-label">${item.rating} Yıldız</div>
            <div class="rating-track"><div class="rating-fill" style="width: ${item.percentage}%;"></div></div>
            <span style="font-size: 0.85rem; font-weight: 700; min-width: 40px; text-align: right;">${item.percentage}%</span>
            <span style="font-size: 0.78rem; color: var(--text-dim); min-width: 35px;">(${item.count})</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderWordCloud(results) {
  const words = results.words || [];
  const entries = results.recentEntries || [];

  if (words.length === 0 && entries.length === 0) {
    resultsContainer.innerHTML = `<div class="empty-state"><p>Katılımcıların cevap vermesi bekleniyor...</p></div>`;
    return;
  }

  const maxCount = words[0] ? words[0].count : 1;
  const wordsHtml = words.map(w => {
    let scale = 'scale-1';
    const r = w.count / maxCount;
    if (r >= 0.75) scale = 'scale-4';
    else if (r >= 0.5) scale = 'scale-3';
    else if (r >= 0.25) scale = 'scale-2';
    return `<span class="word-pill ${scale}">${escapeHtml(w.word)} <span class="word-freq">${w.count}</span></span>`;
  }).join('');

  resultsContainer.innerHTML = `
    <div class="wordcloud-container">
      <div class="words-cloud-pills">${wordsHtml || '<span>Henüz kelime yok</span>'}</div>
      <div>
        <div class="live-feed-header">Son Gelen Cevaplar</div>
        <div class="live-text-stream" style="margin-top: 10px;">
          ${entries.map(e => `<div class="text-entry-card">“${escapeHtml(e.text)}”</div>`).join('')}
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ----------------------------------------------------
// Real-time Cloud Broker Pub/Sub Connection (Serverless)
// ----------------------------------------------------
let mqttClient = null;
const TOPIC_VOTE = `bodtum/survey/${roomId}/vote`;
const TOPIC_JOIN = `bodtum/survey/${roomId}/join`;
const TOPIC_STATE = `bodtum/survey/${roomId}/state`;
const TOPIC_PING = `bodtum/survey/${roomId}/ping`;

function connectRealtime(brokerIndex = 0) {
  if (brokerIndex >= BROKERS.length) return;
  const url = BROKERS[brokerIndex];

  mqttClient = mqtt.connect(url, {
    clientId: 'presenter_' + Math.random().toString(36).substring(2, 9),
    keepalive: 30,
    reconnectPeriod: 2000,
    will: {
      topic: TOPIC_STATE,
      payload: JSON.stringify({ isLive: false, endedAt: Date.now(), roomId }),
      retain: true,
      qos: 1
    }
  });

  mqttClient.on('connect', () => {
    console.log('Connected to real-time relay:', url);
    mqttClient.subscribe(TOPIC_VOTE);
    mqttClient.subscribe(TOPIC_JOIN);
    mqttClient.subscribe(TOPIC_PING);
    broadcastState();
  });

  mqttClient.on('message', (topic, message) => {
    try {
      const data = JSON.parse(message.toString());
      if (topic === TOPIC_VOTE) {
        handleIncomingVote(data);
      } else if (topic === TOPIC_JOIN) {
        if (data.voterId) {
          activeParticipants.add(data.voterId);
          participantCount.textContent = activeParticipants.size;
        }
        broadcastState();
      } else if (topic === TOPIC_PING) {
        // Immediate response with fresh timestamp so voter knows presenter is live
        broadcastState();
      }
    } catch (e) {
      console.error('Error handling message:', e);
    }
  });

  mqttClient.on('error', () => {
    mqttClient.end(true);
    connectRealtime(brokerIndex + 1);
  });
}

function handleIncomingVote(data) {
  const { questionId, answer, voterId } = data;
  if (!survey.acceptingVotes) return;

  const q = survey.questions.find(item => item.id === questionId);
  if (!q) return;

  if (voterId) {
    activeParticipants.add(voterId);
    participantCount.textContent = activeParticipants.size;
  }

  q.votes[voterId] = answer;
  saveSurvey();
  notifier.playVoteChime();
  renderSurvey();
  broadcastState();
}

function broadcastState() {
  if (mqttClient && mqttClient.connected) {
    const payload = JSON.stringify(getSurveyPayload());
    mqttClient.publish(TOPIC_STATE, payload, { retain: false, qos: 1 });
  }
}

// Periodic heartbeat broadcast every 10s to keep liveness timestamp fresh
setInterval(() => {
  if (mqttClient && mqttClient.connected) {
    broadcastState();
  }
}, 10000);

// Notify participants when presenter leaves / closes window
window.addEventListener('beforeunload', () => {
  if (mqttClient && mqttClient.connected) {
    const offlinePayload = JSON.stringify({ isLive: false, endedAt: Date.now(), roomId });
    mqttClient.publish(TOPIC_STATE, offlinePayload, { retain: true, qos: 1 });
  }
});

// Keyboard Shortcuts for Presenter (Arrow keys, Space, L, F)
window.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
  if (questionModal && questionModal.open) return;

  if (e.key === 'ArrowRight' || e.key === ' ') {
    e.preventDefault();
    if (survey.activeQuestionIndex < survey.questions.length - 1) {
      survey.activeQuestionIndex++;
      saveSurvey();
      broadcastState();
      renderSurvey();
    }
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    if (survey.activeQuestionIndex > 0) {
      survey.activeQuestionIndex--;
      saveSurvey();
      broadcastState();
      renderSurvey();
    }
  } else if (e.key.toLowerCase() === 'l') {
    e.preventDefault();
    survey.acceptingVotes = !survey.acceptingVotes;
    saveSurvey();
    broadcastState();
    renderSurvey();
  } else if (e.key.toLowerCase() === 'f') {
    e.preventDefault();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
    } else {
      document.exitFullscreen().catch(() => { });
    }
  }
});

// ----------------------------------------------------
// Toast Notification Helper
// ----------------------------------------------------
function showToast(message) {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.className = 'toast-msg';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}

// ----------------------------------------------------
// Stochastic Diverse Alumni Response Generator
// Generates fresh, realistically distributed alumni profiles each time tapped
// ----------------------------------------------------
function generateDiverseAlumniBatch(count = 15) {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const pickMultiple = (arr, min, max) => {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    const n = Math.floor(Math.random() * (max - min + 1)) + min;
    return shuffled.slice(0, n);
  };

  const archetypes = [
    // 1. Pragmatic Trailblazer / Tech & Startup Founder (~30%)
    () => ({
      q1: "opt1_4", // İleri düzey uzman kullanıcı
      q2: ["opt2_1", pick(["opt2_2", "opt2_5"]), pick(["opt2_3", "opt2_4", "opt2_5"])],
      q3: pickMultiple(["opt3_1", "opt3_3", "opt3_4"], 1, 2),
      q4: pick([4, 5, 5]), // Büyük fırsat
      q5: pick([4, 5, 4]), // Büyük sıçrama
      q6: pick([1, 2, 2, 3]), // Kurumsal hantallık hissediyor
      q7: pick([4, 5, 5]), // Zihinsel büyüme
      q8: pick(["opt8_5", "opt8_2", "opt8_4"]),
      q9: pick(["opt9_1", "opt9_2"])
    }),
    // 2. Enterprise Leader & Senior Consultant (~35%)
    () => ({
      q1: "opt1_3", // Düzenli kullanıcı
      q2: ["opt2_1", pick(["opt2_2", "opt2_4", "opt2_3"])],
      q3: pickMultiple(["opt3_2", "opt3_4", "opt3_3"], 1, 2),
      q4: pick([4, 5, 4]),
      q5: pick([3, 4, 3]),
      q6: pick([1, 2, 2, 3]), // Şirketlerin hazırlıksızlığı
      q7: pick([3, 4, 4]),
      q8: pick(["opt8_1", "opt8_2", "opt8_4"]),
      q9: pick(["opt9_1", "opt9_2"])
    }),
    // 3. Skeptical Intellectual / Academic / Legal Thinker (~20%)
    () => ({
      q1: pick(["opt1_2", "opt1_3"]),
      q2: pick([["opt2_1"], ["opt2_1", "opt2_2"]]),
      q3: pickMultiple(["opt3_1", "opt3_3"], 1, 2),
      q4: pick([2, 3, 3]), // Temkinli
      q5: pick([1, 2, 2]), // Çocuklar için derin kaygı
      q6: pick([1, 1, 2]), // Çok hazırlıksız
      q7: pick([1, 2, 2]), // Düşünsel körelme riski
      q8: pick(["opt8_1", "opt8_2"]),
      q9: pick(["opt9_4", "opt9_3"])
    }),
    // 4. Guarded Observer / Traditional Industry Leader (~15%)
    () => ({
      q1: pick(["opt1_1", "opt1_2"]),
      q2: pick([["opt2_6"], ["opt2_1"]]),
      q3: pick([["opt3_5"], ["opt3_4"]]),
      q4: pick([2, 3, 3]),
      q5: pick([2, 3]),
      q6: pick([1, 2]),
      q7: pick([2, 3]),
      q8: pick(["opt8_3", "opt8_4"]),
      q9: pick(["opt9_1", "opt9_4"])
    })
  ];

  const batch = [];
  for (let i = 0; i < count; i++) {
    const rand = Math.random();
    let archetypeFn;
    if (rand < 0.30) archetypeFn = archetypes[0];
    else if (rand < 0.65) archetypeFn = archetypes[1];
    else if (rand < 0.85) archetypeFn = archetypes[2];
    else archetypeFn = archetypes[3];

    batch.push(archetypeFn());
  }
  return batch;
}

async function autoPopulateResponses(count = 15) {
  const confirmed = await showInAppConfirm({
    icon: '⚠️',
    badge: 'DEMO & TEST VERİSİ',
    title: 'Demo Yanıtlar Eklensin mi?',
    bodyHtml: `
      <p>Bu işlem yalnızca test ve demo amaçlıdır.</p>
      <div class="inapp-modal-highlight">
        Sisteme <strong>${count} adet rastgele yanıt</strong> eklenecektir. Bu işlem gerçek katılımcıların yanıtlarını simülasyon verileriyle karıştıracak ve <strong>gerçek anket sonuçlarını kirletecektir</strong>.
      </div>
      <p>Yine de demo verileri eklemek istiyor musunuz?</p>
    `,
    confirmText: `Evet, ${count} Demo Yanıt Ekle`,
    cancelText: 'Vazgeç',
    isDanger: false
  });

  if (!confirmed) return;

  const dynamicBatch = generateDiverseAlumniBatch(count);

  dynamicBatch.forEach((profile, idx) => {
    const voterId = `alumni_sim_${Date.now()}_${Math.random().toString(36).substr(2, 6)}_${idx + 1}`;
    activeParticipants.add(voterId);

    survey.questions.forEach(q => {
      if (profile[q.id] !== undefined) {
        q.votes[voterId] = profile[q.id];
      }
    });
  });

  participantCount.textContent = activeParticipants.size;
  saveSurvey();
  notifier.playVoteChime();
  renderSurvey();
  broadcastState();
  showToast(`🎉 ${count} yeni ve farklı mezun yanıtı eklendi! (Toplam: ${activeParticipants.size})`);
}

// ----------------------------------------------------
// Survey Comprehensive Insights Generator
// ----------------------------------------------------
// ----------------------------------------------------
// SVG Circular Gauge Helper
// ----------------------------------------------------
function buildGaugeSvg(val, max, color, isPercent = false) {
  const r = 54;
  const circ = 2 * Math.PI * r; // ~339.29
  const ratio = Math.min(1, Math.max(0, val / max));
  const offset = circ * (1 - ratio);

  return `
    <svg viewBox="0 0 140 140" style="width: 100%; max-width: 130px; height: auto; display: block; margin: 0 auto;">
      <circle cx="70" cy="70" r="${r}" fill="none" stroke="rgba(255, 255, 255, 0.08)" stroke-width="10" />
      <circle cx="70" cy="70" r="${r}" fill="none" stroke="${color}" stroke-width="10"
        stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"
        style="transition: stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1);" />
    </svg>
    <div class="gauge-center-content">
      <div class="gauge-big-num">${isPercent ? Math.round(val) + '%' : val.toFixed(1)}</div>
      <div class="gauge-sub-num">${isPercent ? 'Skor' : `/ ${max.toFixed(1)}`}</div>
    </div>
  `;
}

// ----------------------------------------------------
// 4-Axis Spider / Radar Polygon Chart Helper (SVG)
// ----------------------------------------------------
function buildRadarChartSvg(q4, q5, q6, q7) {
  const cx = 200, cy = 200, maxR = 120;

  // Scores 1-5 mapped to 0-120 px from center
  const r4 = Math.max(10, Math.min(maxR, (q4 / 5) * maxR)); // Top (Y-up)
  const r7 = Math.max(10, Math.min(maxR, (q7 / 5) * maxR)); // Right (X-right)
  const r6 = Math.max(10, Math.min(maxR, (q6 / 5) * maxR)); // Bottom (Y-down)
  const r5 = Math.max(10, Math.min(maxR, (q5 / 5) * maxR)); // Left (X-left)

  const pTop = `${cx},${cy - r4}`;
  const pRight = `${cx + r7},${cy}`;
  const pBottom = `${cx},${cy + r6}`;
  const pLeft = `${cx - r5},${cy}`;

  // Grid concentric rings
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0].map(s => {
    const d = maxR * s;
    return `<polygon points="${cx},${cy - d} ${cx + d},${cy} ${cx},${cy + d} ${cx - d},${cy}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1" />`;
  }).join('');

  return `
    <svg viewBox="0 0 400 400" style="width: 100%; max-width: 380px; height: auto; display: block; margin: 0 auto;">
      <!-- Concentric Web Rings -->
      ${rings}

      <!-- Cross Axes -->
      <line x1="${cx}" y1="${cy - maxR}" x2="${cx}" y2="${cy + maxR}" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" stroke-dasharray="3,3" />
      <line x1="${cx - maxR}" y1="${cy}" x2="${cx + maxR}" y2="${cy}" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" stroke-dasharray="3,3" />

      <!-- Architectural Polygon Area -->
      <polygon points="${pTop} ${pRight} ${pBottom} ${pLeft}" fill="rgba(29, 78, 216, 0.18)" stroke="#cbd5e1" stroke-width="2.5" />

      <!-- Vertex Dots -->
      <circle cx="${cx}" cy="${cy - r4}" r="5" fill="#1d4ed8" stroke="#fff" stroke-width="2" />
      <circle cx="${cx + r7}" cy="${cy}" r="5" fill="#d97706" stroke="#fff" stroke-width="2" />
      <circle cx="${cx}" cy="${cy + r6}" r="5" fill="#c8102e" stroke="#fff" stroke-width="2" />
      <circle cx="${cx - r5}" cy="${cy}" r="5" fill="#475569" stroke="#fff" stroke-width="2" />

      <!-- Axis Labels -->
      <text x="${cx}" y="${cy - maxR - 14}" text-anchor="middle" fill="#cbd5e1" font-size="12" font-weight="700">Fırsat Algısı (${q4.toFixed(1)})</text>
      <text x="${cx + maxR + 10}" y="${cy + 4}" text-anchor="start" fill="#cbd5e1" font-size="12" font-weight="700">Zihinsel Büyüme (${q7.toFixed(1)})</text>
      <text x="${cx}" y="${cy + maxR + 24}" text-anchor="middle" fill="#fca5a5" font-size="12" font-weight="700">Kurumsal Hazırlık (${q6.toFixed(1)})</text>
      <text x="${cx - maxR - 10}" y="${cy + 4}" text-anchor="end" fill="#cbd5e1" font-size="12" font-weight="700">Eğitim & Gençlik (${q5.toFixed(1)})</text>
    </svg>
  `;
}

// ----------------------------------------------------
// Full-Page Comprehensive Survey Insights Cockpit
// ----------------------------------------------------
let activeInsightsCohort = 'all';

function generateSurveyInsights(cohortFilter = activeInsightsCohort) {
  activeInsightsCohort = cohortFilter;
  const body = document.getElementById('insightsFullPageBody');
  if (!body) return;

  // Gather unique voter IDs across all survey questions
  const allVoterIds = new Set();
  survey.questions.forEach(q => {
    Object.keys(q.votes || {}).forEach(vid => allVoterIds.add(vid));
  });
  const totalAllVotes = allVoterIds.size;

  if (totalAllVotes === 0) {
    body.innerHTML = `
      <div style="text-align: center; padding: 70px 24px; background: var(--surface); border-radius: var(--radius-xl); border: 1px solid var(--border); max-width: 540px; margin: 60px auto; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
        <div style="width: 56px; height: 56px; border-radius: 14px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.25); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; color: #60a5fa;">
          <svg style="width: 28px; height: 28px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
        </div>
        <h2 style="font-size: 1.4rem; font-weight: 700; color: #fff; margin-bottom: 8px;">Henüz Oy Verisi Bulunmuyor</h2>
        <p style="color: var(--text-secondary); font-size: 0.90rem; line-height: 1.5; margin-bottom: 24px;">
          Kitle zekası kokpitini incelemek için katılımcıların oy kullanmasını bekleyebilir veya 15 mezun profili simülasyonunu başlatabilirsiniz.
        </p>
        <button type="button" class="btn-primary" id="emptyStatePopulateBtn" style="padding: 11px 24px; font-size: 0.88rem; font-weight: 600; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px;">
          <svg style="width: 16px; height: 16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"></path></svg>
          <span>15 Demo Yanıt ile Kokpiti Başlat</span>
        </button>
      </div>
    `;
    const btn = document.getElementById('emptyStatePopulateBtn');
    if (btn) {
      btn.onclick = () => {
        autoPopulateResponses(15);
        generateSurveyInsights();
      };
    }
    overlay.classList.remove('hidden');
    return;
  }

  // Helper to extract option text
  const getOptText = (qid, optId) => {
    const q = survey.questions.find(item => item.id === qid);
    return q?.options?.find(o => o.id === optId)?.text || optId;
  };

  // Build unified individual respondent dataset for multidimensional analysis
  const allRespondents = Array.from(allVoterIds).map(vid => {
    const getVal = (qid) => survey.questions.find(q => q.id === qid)?.votes[vid];
    const q1 = getVal('q1') || 'opt1_1';
    const q2Raw = getVal('q2');
    const q3Raw = getVal('q3');
    const q4 = Number(getVal('q4') || 3);
    const q5 = Number(getVal('q5') || 3);
    const q6 = Number(getVal('q6') || 3);
    const q7 = Number(getVal('q7') || 3);
    const q8 = getVal('q8') || 'opt8_1';
    const q9 = getVal('q9') || 'opt9_1';

    const tools = Array.isArray(q2Raw) ? q2Raw : (q2Raw ? [q2Raw] : []);
    const values = Array.isArray(q3Raw) ? q3Raw : (q3Raw ? [q3Raw] : []);
    const toolsCount = tools.filter(t => t !== 'opt2_6').length;

    // Multi-Dimensional Dynamic Archetype Classification
    let archetype = 'catalyst';
    if ((q1 === 'opt1_4' || q1 === 'opt1_3') && toolsCount >= 3 && q4 >= 4) {
      archetype = 'trailblazer'; // 🚀 Stratejik Öncüler
    } else if (q7 <= 2 || q8 === 'opt8_1' || q8 === 'opt8_2' || q9 === 'opt9_4') {
      archetype = 'thinker'; // 🧠 Eleştirel Düşünürler
    } else if (q1 === 'opt1_1' || (q1 === 'opt1_2' && q4 <= 3)) {
      archetype = 'observer'; // 👁️ Temkinli Gözlemciler
    } else {
      archetype = 'catalyst'; // 💼 Kurumsal Dönüştürücüler
    }

    return { id: vid, q1, q2: tools, q3: values, q4, q5, q6, q7, q8, q9, toolsCount, archetype };
  });

  // Apply Cohort Filtering
  let activeRespondents = allRespondents;
  if (cohortFilter === 'power') {
    activeRespondents = allRespondents.filter(r => r.q1 === 'opt1_4' || r.q1 === 'opt1_3');
  } else if (cohortFilter === 'explorer') {
    activeRespondents = allRespondents.filter(r => r.q1 === 'opt1_2' || r.q1 === 'opt1_1');
  } else if (cohortFilter === 'skeptics') {
    activeRespondents = allRespondents.filter(r => r.q7 <= 2 || r.q8 === 'opt8_1' || r.q8 === 'opt8_2' || r.q9 === 'opt9_4');
  }

  if (activeRespondents.length === 0) {
    activeRespondents = allRespondents;
    activeInsightsCohort = 'all';
  }

  const activeCount = activeRespondents.length;
  const powerGroupCount = allRespondents.filter(r => r.q1 === 'opt1_4' || r.q1 === 'opt1_3').length;
  const explorerGroupCount = allRespondents.filter(r => r.q1 === 'opt1_2' || r.q1 === 'opt1_1').length;
  const skepticsGroupCount = allRespondents.filter(r => r.q7 <= 2 || r.q8 === 'opt8_1' || r.q8 === 'opt8_2' || r.q9 === 'opt9_4').length;

  // Active Cohort Averages & Metrics
  const activePowerRegularPct = Math.round((activeRespondents.filter(r => r.q1 === 'opt1_4' || r.q1 === 'opt1_3').length / activeCount) * 100);
  const activeQ4Avg = Number((activeRespondents.reduce((sum, r) => sum + r.q4, 0) / activeCount).toFixed(1));
  const activeQ5Avg = Number((activeRespondents.reduce((sum, r) => sum + r.q5, 0) / activeCount).toFixed(1));
  const activeQ6Avg = Number((activeRespondents.reduce((sum, r) => sum + r.q6, 0) / activeCount).toFixed(1));
  const activeQ7Avg = Number((activeRespondents.reduce((sum, r) => sum + r.q7, 0) / activeCount).toFixed(1));

  // ----------------------------------------------------
  // Cross-Pollination Finding 1: The 3 Strategic Paradoxes (Veriye Dayalı 3 Büyük Paradoks)
  // ----------------------------------------------------
  // Paradox 1: Corporate Inertia Gap (Bireysel İyimserlik vs. Kurumsal Hazırlıksızlık)
  const allQ4Avg = Number((allRespondents.reduce((sum, r) => sum + r.q4, 0) / totalAllVotes).toFixed(1));
  const allQ6Avg = Number((allRespondents.reduce((sum, r) => sum + r.q6, 0) / totalAllVotes).toFixed(1));
  const pctHighOpportunity = Math.round((allRespondents.filter(r => r.q4 >= 4).length / totalAllVotes) * 100);
  const pctLowCorpReady = Math.round((allRespondents.filter(r => r.q6 <= 2).length / totalAllVotes) * 100);
  const corpGapScore = Number((allQ4Avg - allQ6Avg).toFixed(1));

  // Paradox 2: Cognitive Dilemma (Verimlilik Patlaması vs. Bilişsel Körelme Endişesi)
  const pctEfficiencyDrivers = Math.round((allRespondents.filter(r => r.q3.includes('opt3_4') || r.q3.includes('opt3_2')).length / totalAllVotes) * 100);
  const pctCognitiveConcerns = Math.round((allRespondents.filter(r => r.q7 <= 2 || r.q5 <= 2).length / totalAllVotes) * 100);

  // Paradox 3: Familiarity Breeds Optimism (Aşinalık İyimserliği)
  const powerUsersOnly = allRespondents.filter(r => r.q1 === 'opt1_4' || r.q1 === 'opt1_3');
  const nonUsersOnly = allRespondents.filter(r => r.q1 === 'opt1_1' || r.q1 === 'opt1_2');
  const powerUsersQ4Avg = powerUsersOnly.length > 0 ? (powerUsersOnly.reduce((s, r) => s + r.q4, 0) / powerUsersOnly.length).toFixed(1) : "4.8";
  const nonUsersQ4Avg = nonUsersOnly.length > 0 ? (nonUsersOnly.reduce((s, r) => s + r.q4, 0) / nonUsersOnly.length).toFixed(1) : "2.9";

  // ----------------------------------------------------
  // Cross-Pollination Finding 2: The Multimodal Dividend (Q2 Araç Çeşitliliği x Q3 Değer Üretimi)
  // ----------------------------------------------------
  const singleToolUsers = allRespondents.filter(r => r.toolsCount <= 1);
  const multiToolUsers = allRespondents.filter(r => r.toolsCount >= 3);

  const singleStratPct = singleToolUsers.length > 0
    ? Math.round((singleToolUsers.filter(r => r.q3.includes('opt3_3') || r.q3.includes('opt3_1')).length / singleToolUsers.length) * 100)
    : 35;
  const singleTextPct = singleToolUsers.length > 0
    ? Math.round((singleToolUsers.filter(r => r.q3.includes('opt3_2')).length / singleToolUsers.length) * 100)
    : 75;

  const multiStratPct = multiToolUsers.length > 0
    ? Math.round((multiToolUsers.filter(r => r.q3.includes('opt3_3') || r.q3.includes('opt3_1')).length / multiToolUsers.length) * 100)
    : 88;
  const multiTextPct = multiToolUsers.length > 0
    ? Math.round((multiToolUsers.filter(r => r.q3.includes('opt3_2')).length / multiToolUsers.length) * 100)
    : 50;

  // ----------------------------------------------------
  // Cross-Pollination Finding 3: Cross-Tabulation Heatmap Matrix (Q1 x Boyutlar)
  // ----------------------------------------------------
  const adoptionTiers = [
    { id: 'opt1_4', name: 'Uzman Kullanıcı', sub: 'Her Gün Aktif', color: '#a78bfa' },
    { id: 'opt1_3', name: 'Düzenli Profesyonel', sub: 'Haftada Birkaç', color: '#34d399' },
    { id: 'opt1_2', name: 'Meraklı Kaşif', sub: 'Ayda Birkaç Kez', color: '#60a5fa' },
    { id: 'opt1_1', name: 'Gözlemci', sub: 'Neredeyse Hiç', color: '#94a3b8' }
  ];

  const crossMatrixRows = adoptionTiers.map(tier => {
    const subset = allRespondents.filter(r => r.q1 === tier.id);
    const count = subset.length;
    const pct = totalAllVotes > 0 ? Math.round((count / totalAllVotes) * 100) : 0;

    if (count === 0) {
      return {
        ...tier, count: 0, pct: 0, q4Avg: "-", q6Avg: "-", q7Avg: "-",
        topTool: "Veri yok", topValue: "Veri yok", topBlocker: "Veri yok"
      };
    }

    const q4 = (subset.reduce((s, r) => s + r.q4, 0) / count).toFixed(1);
    const q6 = (subset.reduce((s, r) => s + r.q6, 0) / count).toFixed(1);
    const q7 = (subset.reduce((s, r) => s + r.q7, 0) / count).toFixed(1);

    // Most frequent tool in this tier
    const toolCounts = {};
    subset.forEach(r => r.q2.forEach(t => toolCounts[t] = (toolCounts[t] || 0) + 1));
    const sortedTierTools = Object.entries(toolCounts).filter(([k]) => k !== 'opt2_6').sort((a, b) => b[1] - a[1]);
    const topToolText = sortedTierTools[0] ? getOptText('q2', sortedTierTools[0][0]).split('(')[0].trim() : 'Henüz yok';

    // Most frequent value driver in this tier
    const valCounts = {};
    subset.forEach(r => r.q3.forEach(v => valCounts[v] = (valCounts[v] || 0) + 1));
    const sortedTierValues = Object.entries(valCounts).filter(([k]) => k !== 'opt3_5').sort((a, b) => b[1] - a[1]);
    const topValText = sortedTierValues[0] ? getOptText('q3', sortedTierValues[0][0]).substring(0, 32) + '...' : 'Fayda yok';

    // Most frequent blocker in this tier
    const blockerCounts = {};
    subset.forEach(r => blockerCounts[r.q8] = (blockerCounts[r.q8] || 0) + 1);
    const sortedTierBlockers = Object.entries(blockerCounts).sort((a, b) => b[1] - a[1]);
    const topBlockerText = sortedTierBlockers[0] ? getOptText('q8', sortedTierBlockers[0][0]).substring(0, 30) + '...' : 'Belirtilmedi';

    return {
      ...tier, count, pct, q4Avg: q4, q6Avg: q6, q7Avg: q7,
      topTool: topToolText, topValue: topValText, topBlocker: topBlockerText
    };
  });

  // Dynamic Archetypes Aggregation
  const trailblazerCount = allRespondents.filter(r => r.archetype === 'trailblazer').length;
  const thinkerCount = allRespondents.filter(r => r.archetype === 'thinker').length;
  const catalystCount = allRespondents.filter(r => r.archetype === 'catalyst').length;
  const observerCount = allRespondents.filter(r => r.archetype === 'observer').length;

  const trailblazerPct = Math.round((trailblazerCount / totalAllVotes) * 100);
  const thinkerPct = Math.round((thinkerCount / totalAllVotes) * 100);
  const catalystPct = Math.round((catalystCount / totalAllVotes) * 100);
  const observerPct = Math.round((observerCount / totalAllVotes) * 100);

  const pctReadyCorp = Math.round((allRespondents.filter(r => r.q6 >= 4).length / totalAllVotes) * 100);

  // ---- Dashboard view-model ----
  const dbNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const dbAvg = (arr, fn) => arr.length ? arr.reduce((s, r) => s + fn(r), 0) / arr.length : 0;
  const dbPc = (n) => activeCount ? Math.round((n / activeCount) * 100) : 0;
  const dbInsight = (what, so) => `<div class="db-insight"><i></i><div><p><em>Bulgu</em>${what}</p>${so ? `<p class="so"><em>Anlamı</em>${so}</p>` : ''}</div></div>`;
  const dbRing = (ratio, color) => {
    const c = 2 * Math.PI * 16;
    return `<svg viewBox="0 0 40 40" class="db-ring"><circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4"/><circle cx="20" cy="20" r="16" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${(c * Math.max(0, Math.min(1, ratio))).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 20 20)"/></svg>`;
  };
  const dbSmooth = (pts) => {
    if (pts.length < 2) return '';
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = Math.min(Math.max(p1[1] + (p2[1] - p0[1]) / 6, Math.min(p1[1], p2[1])), Math.max(p1[1], p2[1]));
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = Math.min(Math.max(p2[1] - (p3[1] - p1[1]) / 6, Math.min(p1[1], p2[1])), Math.max(p1[1], p2[1]));
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  };
  const dbHash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
  const dbRnd = (s, salt) => { const x = Math.sin(dbHash(s) * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); };

  // KPI strip
  const dbKpis = [
    { label: 'AI benimseme', value: `%${activePowerRegularPct}`, unit: '', sub: activePowerRegularPct >= 60 ? 'Çoğunluk aktif kullanıcı' : activePowerRegularPct >= 30 ? 'Yarı yarıya aktif' : 'Çoğunluk henüz başlangıçta', ratio: activePowerRegularPct / 100 },
    { label: 'Gelecek fırsat puanı', value: dbNum(activeQ4Avg).toFixed(1), unit: '/5', sub: dbNum(activeQ4Avg) >= 4 ? 'Güçlü iyimserlik' : dbNum(activeQ4Avg) >= 3 ? 'Temkinli iyimserlik' : 'Tehdit algısı baskın', ratio: dbNum(activeQ4Avg) / 5 },
    { label: 'Yeni kuşak & eğitim', value: dbNum(activeQ5Avg).toFixed(1), unit: '/5', sub: dbNum(activeQ5Avg) >= 3.5 ? 'Dönüşüm olumlu bekleniyor' : dbNum(activeQ5Avg) >= 2.5 ? 'Dengeli ama belirsiz' : 'Beceri kaybı kaygısı baskın', ratio: dbNum(activeQ5Avg) / 5 },
    { label: 'Kurumsal hazırlık', value: dbNum(activeQ6Avg).toFixed(1), unit: '/5', sub: dbNum(activeQ6Avg) >= 3.5 ? 'Şirketler hazır görülüyor' : dbNum(activeQ6Avg) >= 2.5 ? 'Kısmen hazır' : 'Şirketler geride görülüyor', ratio: dbNum(activeQ6Avg) / 5 }
  ];
  const dbWeakIdx = dbKpis.reduce((m, k, i, a) => (k.ratio < a[m].ratio ? i : m), 0);

  // ---- 1) Scatter + 2x2: bireysel fırsat (x) vs kurumsal hazırlık (y) ----
  const SC = { W: 520, H: 380, L: 52, R: 14, T: 14, B: 46 };
  const scPW = SC.W - SC.L - SC.R, scPH = SC.H - SC.T - SC.B;
  const scX = (v) => SC.L + ((v - 0.6) / 4.8) * scPW;
  const scY = (v) => SC.T + scPH - ((v - 0.6) / 4.8) * scPH;
  const quad = { tr: 0, br: 0, tl: 0, bl: 0 };
  const scDots = activeRespondents.map(r => {
    const hi4 = r.q4 >= 4, hi6 = r.q6 >= 4;
    const key = hi4 ? (hi6 ? 'tr' : 'br') : (hi6 ? 'tl' : 'bl');
    quad[key]++;
    const cx = scX(r.q4 + (dbRnd(String(r.id), 1) - 0.5) * 0.55);
    const cy = scY(r.q6 + (dbRnd(String(r.id), 2) - 0.5) * 0.55);
    const hot = key === 'br';
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="6" fill="${hot ? '#c8102e' : '#cbd5e1'}" fill-opacity="${hot ? 0.85 : 0.5}" stroke="${hot ? '#ff5a6e' : '#e2e8f0'}" stroke-opacity="0.6"/>`;
  }).join('');
  const scMX = scX(3.5), scMY = scY(3.5), scRight = SC.L + scPW, scBottom = SC.T + scPH;
  const scQuadLabel = (x, y, anchor, count, label, hot) =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" class="q-count ${hot ? 'hot' : ''}">${count}</text><text x="${x}" y="${y + 14}" text-anchor="${anchor}" class="q-label">${label}</text>`;
  const scatterSvg = `<svg class="db-svg" viewBox="0 0 ${SC.W} ${SC.H}">
    <rect x="${scMX}" y="${scMY}" width="${scRight - scMX}" height="${scBottom - scMY}" fill="#c8102e" fill-opacity="0.09"/>
    ${[1, 2, 3, 4, 5].map(v => `
      <line x1="${scX(v)}" y1="${SC.T}" x2="${scX(v)}" y2="${scBottom}" stroke="rgba(255,255,255,0.05)"/>
      <line x1="${SC.L}" y1="${scY(v)}" x2="${scRight}" y2="${scY(v)}" stroke="rgba(255,255,255,0.05)"/>
      <text x="${scX(v)}" y="${scBottom + 16}" text-anchor="middle">${v}</text>
      <text x="${SC.L - 10}" y="${scY(v) + 4}" text-anchor="end">${v}</text>`).join('')}
    <line x1="${scMX}" y1="${SC.T}" x2="${scMX}" y2="${scBottom}" stroke="rgba(255,255,255,0.3)" stroke-dasharray="4 4"/>
    <line x1="${SC.L}" y1="${scMY}" x2="${scRight}" y2="${scMY}" stroke="rgba(255,255,255,0.3)" stroke-dasharray="4 4"/>
    ${scQuadLabel(SC.L + 8, SC.T + 24, 'start', quad.tl, 'Temkinli · kurum hazır', false)}
    ${scQuadLabel(scRight - 8, SC.T + 24, 'end', quad.tr, 'Birlikte hazır', false)}
    ${scQuadLabel(SC.L + 8, scBottom - 28, 'start', quad.bl, 'Temkinli · kurum geride', false)}
    ${scQuadLabel(scRight - 8, scBottom - 28, 'end', quad.br, 'Öncü · kurum geride', true)}
    ${scDots}
    <text x="${SC.L + scPW / 2}" y="${SC.H - 6}" text-anchor="middle" class="ax">Bireysel fırsat algısı  (1 tehdit → 5 fırsat)</text>
    <text transform="rotate(-90 13 ${SC.T + scPH / 2})" x="13" y="${SC.T + scPH / 2}" text-anchor="middle" class="ax">Kurumsal hazırlık</text>
  </svg>`;
  const scBrShare = dbPc(quad.br), scTrShare = dbPc(quad.tr);
  const scInsight = dbInsight(
    `<b>%${scBrShare}</b> kendini öncü, şirketini geride görüyor; birey ve kurumun birlikte hazır olduğu grup yalnızca <b>%${scTrShare}</b>.`,
    scBrShare >= scTrShare
      ? 'Bireyler kurumlarının önünde. Sahnede araç ipuçlarından çok <b>kurumsal strateji ve yönetişim</b> anlatmak karşılık bulur.'
      : 'Birey ve kurum benzer hızda ilerliyor. Odak <b>ölçekleme ve iyi uygulama paylaşımı</b> olabilir.');

  // ---- 2) Radar: uzman vs seyrek kullanıcı ----
  const rdAxes = [
    { name: 'Fırsat algısı', fn: r => r.q4 },
    { name: 'Eğitim & dönüşüm', fn: r => r.q5 },
    { name: 'Kurumsal hazırlık', fn: r => r.q6 },
    { name: 'Zihinsel büyüme', fn: r => r.q7 },
    { name: 'Araç çeşitliliği', fn: r => Math.min(5, r.toolsCount) }
  ];
  const rdGroups = [
    { name: 'Düzenli & Uzman', color: '#c8102e', fill: 0.22, list: allRespondents.filter(r => r.q1 === 'opt1_4' || r.q1 === 'opt1_3') },
    { name: 'Gözlemci & seyrek', color: '#e2e8f0', fill: 0.12, list: allRespondents.filter(r => r.q1 === 'opt1_1' || r.q1 === 'opt1_2') }
  ].filter(g => g.list.length > 0);
  const rdCx = 235, rdCy = 165, rdR = 108;
  const rdPoint = (i, v) => {
    const a = (-90 + i * (360 / rdAxes.length)) * Math.PI / 180;
    return [rdCx + Math.cos(a) * rdR * (v / 5), rdCy + Math.sin(a) * rdR * (v / 5)];
  };
  rdGroups.forEach(g => { g.vals = rdAxes.map(ax => dbAvg(g.list, ax.fn)); });
  const radarSvg = `<svg class="db-svg" viewBox="0 0 470 330">
    ${[1, 2, 3, 4, 5].map(l => `<polygon points="${rdAxes.map((_, i) => rdPoint(i, l).map(n => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="rgba(255,255,255,${l === 5 ? 0.18 : 0.07})"/>`).join('')}
    ${rdAxes.map((ax, i) => {
    const [x, y] = rdPoint(i, 5), [lx, ly] = rdPoint(i, 6.0);
    const anchor = Math.abs(lx - rdCx) < 8 ? 'middle' : (lx > rdCx ? 'start' : 'end');
    return `<line x1="${rdCx}" y1="${rdCy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.08)"/><text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="${anchor}">${ax.name}</text>`;
  }).join('')}
    ${rdGroups.map(g => `<polygon points="${g.vals.map((v, i) => rdPoint(i, v).map(n => n.toFixed(1)).join(',')).join(' ')}" fill="${g.color}" fill-opacity="${g.fill}" stroke="${g.color}" stroke-width="2.2" stroke-linejoin="round"/>${g.vals.map((v, i) => { const [x, y] = rdPoint(i, v); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${g.color}"/>`; }).join('')}`).join('')}
  </svg>`;
  let rdInsightHtml = 'Karşılaştırma için hem uzman hem seyrek kullanıcı yanıtı gerekli.';
  if (rdGroups.length === 2) {
    let best = 0, bestDiff = -1;
    rdAxes.forEach((_, i) => { const d = Math.abs(rdGroups[0].vals[i] - rdGroups[1].vals[i]); if (d > bestDiff) { bestDiff = d; best = i; } });
    rdInsightHtml = `En büyük ayrışma <b>${rdAxes[best].name}</b> ekseninde: uzman kullanıcılar <b>${rdGroups[0].vals[best].toFixed(1)}</b>, seyrek kullanıcılar <b>${rdGroups[1].vals[best].toFixed(1)}</b>.`;
  }
  const rdSoHtml = rdGroups.length === 2
    ? 'Fark çoğunlukla <b>deneyim eksikliğinden</b> geliyor, görüşten değil. Seyrek kullanıcılara küçük ve somut ilk adımlar gösterin.'
    : '';
  const radarLegend = rdGroups.map(g => `<span><i style="background:${g.color}"></i>${g.name} <em>(${g.list.length})</em></span>`).join('');

  // ---- 3) Distribution: fırsat vs kurum hazırlığı puan dağılımı ----
  const DS = { W: 520, H: 270, L: 40, R: 16, T: 24, B: 40 };
  const dsPW = DS.W - DS.L - DS.R, dsPH = DS.H - DS.T - DS.B;
  const dist4 = [1, 2, 3, 4, 5].map(v => dbPc(activeRespondents.filter(r => r.q4 === v).length));
  const dist6 = [1, 2, 3, 4, 5].map(v => dbPc(activeRespondents.filter(r => r.q6 === v).length));
  const dsMax = Math.max(40, Math.ceil(Math.max(...dist4, ...dist6) / 10) * 10);
  const dsX = (i) => DS.L + (i / 4) * dsPW;
  const dsY = (p) => DS.T + dsPH - (p / dsMax) * dsPH;
  const dsSeries = (arr, color, fillOp) => {
    const pts = arr.map((p, i) => [dsX(i), dsY(p)]);
    const line = dbSmooth(pts);
    return `<path d="${line} L${dsX(4)},${DS.T + dsPH} L${dsX(0)},${DS.T + dsPH} Z" fill="${color}" fill-opacity="${fillOp}"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round"/>${pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="${color}"/>`).join('')}`;
  };
  const distSvg = `<svg class="db-svg" viewBox="0 0 ${DS.W} ${DS.H}">
    <defs><clipPath id="dsClip"><rect x="${DS.L - 4}" y="${DS.T - 8}" width="${dsPW + 8}" height="${dsPH + 8}"/></clipPath></defs>
    ${[0, 0.5, 1].map(f => `<line x1="${DS.L}" y1="${DS.T + dsPH * (1 - f)}" x2="${DS.L + dsPW}" y2="${DS.T + dsPH * (1 - f)}" stroke="rgba(255,255,255,0.06)"/><text x="${DS.L - 8}" y="${DS.T + dsPH * (1 - f) + 4}" text-anchor="end">%${Math.round(dsMax * f)}</text>`).join('')}
    <g clip-path="url(#dsClip)">${dsSeries(dist4, '#e2e8f0', 0.12)}${dsSeries(dist6, '#c8102e', 0.22)}</g>
    ${[1, 2, 3, 4, 5].map((v, i) => `<text x="${dsX(i)}" y="${DS.T + dsPH + 18}" text-anchor="middle">${v}</text>`).join('')}
    <text x="${DS.L}" y="${DS.H - 4}" text-anchor="start" class="ax">← düşük puan</text>
    <text x="${DS.L + dsPW}" y="${DS.H - 4}" text-anchor="end" class="ax">yüksek puan →</text>
  </svg>`;
  const hi4Pct = dbPc(activeRespondents.filter(r => r.q4 >= 4).length);
  const lo6Pct = dbPc(activeRespondents.filter(r => r.q6 <= 2).length);
  const distInsight = dbInsight(
    `Fırsat puanlarının <b>%${hi4Pct}</b>'i 4–5 aralığında; kurumsal hazırlık puanlarının <b>%${lo6Pct}</b>'i ise 1–2'de toplanıyor.`,
    hi4Pct > lo6Pct
      ? 'Salon bireysel olarak iyimser ama kurumsal olarak çekimser. İki eğrinin ayrışması <b>tartışmanın ana gerilimi</b>.'
      : 'Kurumsal hazırlık algısı, bireysel iyimserlikten daha yüksek. Konuşma <b>hızlandırma</b> üzerine kurulabilir.');

  // ---- 4) 2x2: kullanım sıklığı x zihinsel kaygı ----
  const mxCells = { tl: 0, tr: 0, bl: 0, br: 0 };
  activeRespondents.forEach(r => {
    const regular = r.q1 === 'opt1_3' || r.q1 === 'opt1_4';
    const worried = r.q7 <= 2 || r.q5 <= 2;
    mxCells[(worried ? 't' : 'b') + (regular ? 'r' : 'l')]++;
  });
  const mxDefs = [
    { k: 'tl', name: 'Uzak duran kaygılılar', sub: 'Seyrek · kaygılı' },
    { k: 'tr', name: 'Bilinçli kullanıcılar', sub: 'Düzenli · kaygılı' },
    { k: 'bl', name: 'İzleyen iyimserler', sub: 'Seyrek · rahat' },
    { k: 'br', name: 'Kendinden emin kullanıcılar', sub: 'Düzenli · rahat' }
  ];
  const mxMax = Math.max(...mxDefs.map(d => mxCells[d.k]));
  const mxLead = mxDefs.find(d => mxCells[d.k] === mxMax) || mxDefs[0];
  const matrixHtml = `
    <div class="db-mx">
      <div class="db-mx-y">Zihinsel kaygı ↑</div>
      <div class="db-mx-grid">
        ${mxDefs.map(d => {
    const share = activeCount ? mxCells[d.k] / activeCount : 0;
    const lead = mxCells[d.k] === mxMax && mxMax > 0;
    return `<div class="db-mx-cell ${lead ? 'lead' : ''}" style="background:${lead ? `rgba(200,16,46,${0.12 + share * 0.5})` : `rgba(255,255,255,${0.03 + share * 0.12})`}">
            <div class="db-mx-num">%${Math.round(share * 100)}</div>
            <div class="db-mx-name">${d.name}</div>
            <div class="db-mx-sub">${d.sub} · ${mxCells[d.k]} kişi</div>
          </div>`;
  }).join('')}
      </div>
      <div class="db-mx-x">Seyrek <span>← Kullanım sıklığı →</span> Düzenli</div>
    </div>`;
  const mxRegTotal = mxCells.tr + mxCells.br;
  const mxWorriedRegPct = mxRegTotal ? Math.round(mxCells.tr / mxRegTotal * 100) : 0;
  const mxInsight = dbInsight(
    `En kalabalık grup <b>${mxLead.name}</b> (<b>%${activeCount ? Math.round(mxCells[mxLead.k] / activeCount * 100) : 0}</b>). Düzenli kullananların <b>%${mxWorriedRegPct}</b>'i hâlâ kaygı taşıyor.`,
    mxWorriedRegPct >= 40
      ? 'Deneyim kaygıyı tek başına gidermiyor. <b>Güvence ve eleştirel düşünme çerçevesi</b> sunmak gerekiyor.'
      : 'Düzenli kullanım kaygıyı azaltıyor. Seyrek kullanıcıları <b>deneyime davet etmek</b> en etkili ikna yolu.');

  // ---- 5) Donut: kitle profili ----
  const dbArch = [
    { name: 'Pragmatik öncüler', count: trailblazerCount },
    { name: 'Eleştirel düşünürler', count: thinkerCount },
    { name: 'Dönüşüm arayanlar', count: catalystCount },
    { name: 'Temkinli gözlemciler', count: observerCount }
  ];
  const dbArchMax = Math.max(...dbArch.map(a => a.count));
  const dbShades = ['#e2e8f0', '#94a3b8', '#64748b', '#475569'];
  let dbSi = 0, leadAssigned = false;
  dbArch.forEach(a => {
    a.pct = totalAllVotes ? Math.round(a.count / totalAllVotes * 100) : 0;
    if (a.count === dbArchMax && !leadAssigned) { a.lead = true; leadAssigned = true; a.color = '#c8102e'; }
    else { a.color = dbShades[dbSi++ % dbShades.length]; }
  });
  const dnC = 2 * Math.PI * 44;
  let dnCum = 0;
  const donutSvg = `<svg class="db-donut" viewBox="0 0 120 120">
    <circle cx="60" cy="60" r="44" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="18"/>
    ${dbArch.map(a => {
    const len = totalAllVotes ? (a.count / totalAllVotes) * dnC : 0;
    const seg = `<circle cx="60" cy="60" r="44" fill="none" stroke="${a.color}" stroke-width="18" stroke-dasharray="${len.toFixed(1)} ${(dnC - len).toFixed(1)}" stroke-dashoffset="${(-dnCum).toFixed(1)}" transform="rotate(-90 60 60)"/>`;
    dnCum += len;
    return seg;
  }).join('')}
    <text x="60" y="58" text-anchor="middle" class="dn-n">${totalAllVotes}</text>
    <text x="60" y="73" text-anchor="middle" class="dn-l">katılımcı</text>
  </svg>`;
  const archLead = dbArch.find(a => a.lead) || dbArch[0];
  const archSo = {
    'Pragmatik öncüler': 'Salon uygulamaya hazır. <b>İleri kullanım örnekleri ve ölçekleme yolları</b> ilgi görür.',
    'Eleştirel düşünürler': 'Salon uzman ama sorgulayıcı. <b>Güven, doğruluk ve etik</b> tartışmasını öne çıkarın.',
    'Dönüşüm arayanlar': 'Salon somut kazanım arıyor. <b>Hızlı verim senaryoları</b> anlatın.',
    'Temkinli gözlemciler': 'Salon henüz uzakta. <b>Sade başlangıç adımlarıyla</b> güven kurun.'
  }[archLead.name];
  const donutInsight = dbInsight(
    `Salonun en büyük profili <b>${archLead.name}</b> (<b>%${archLead.pct}</b>); ikinci sırada <b>${([...dbArch].sort((a, b) => b.count - a.count)[1] || archLead).name}</b> var.`,
    archSo);

  // Render Dashboard
  body.innerHTML = `
    <div class="db-toolbar">
      <div class="db-toolbar-title">
        <span class="db-toolbar-main">Salon Analizi</span>
        <span class="db-toolbar-sub">${activeCount} / ${totalAllVotes} katılımcı</span>
      </div>
      <div class="db-filters cohort-filter-bar">
        <button class="cohort-pill ${activeInsightsCohort === 'all' ? 'active' : ''}" data-cohort="all">Tümü <b>${totalAllVotes}</b></button>
        <button class="cohort-pill ${activeInsightsCohort === 'power' ? 'active' : ''}" data-cohort="power">Düzenli & Uzman <b>${powerGroupCount}</b></button>
        <button class="cohort-pill ${activeInsightsCohort === 'explorer' ? 'active' : ''}" data-cohort="explorer">Gözlemci & seyrek <b>${explorerGroupCount}</b></button>
        <button class="cohort-pill ${activeInsightsCohort === 'skeptics' ? 'active' : ''}" data-cohort="skeptics">Temkinli <b>${skepticsGroupCount}</b></button>
      </div>
    </div>

    <div class="db-headline">
      <div class="db-headline-text">
        <b class="light">%${pctHighOpportunity}</b> fırsat görüyor <span>·</span> <b class="red">%${pctReadyCorp}</b> kurumunu hazır buluyor
      </div>
      <span class="db-gap-badge">${corpGapScore >= 0 ? '−' : '+'}${Math.abs(corpGapScore)} puan ${corpGapScore >= 0 ? 'uçurum' : 'avantaj'}</span>
    </div>
    <div class="db-headline-sub">${corpGapScore >= 1 ? 'Bireyler yapay zekada kurumlarının belirgin biçimde önünde. Gündem araç kullanımından <b>kurumsal strateji ve yönetişime</b> kayıyor.' : corpGapScore > 0 ? 'Bireyler kurumlarının biraz önünde; fark kapanabilir durumda.' : 'Kurumsal hazırlık bireysel iyimserliğe yetişmiş görünüyor.'}</div>

    <div class="db-kpi-row">
      ${dbKpis.map((k, i) => `
        <div class="db-kpi ${i === dbWeakIdx ? 'weak' : ''}">
          <div class="db-kpi-main">
            <div class="db-kpi-label">${k.label}</div>
            <div class="db-kpi-value">${k.value}<small>${k.unit}</small></div>
            <div class="db-kpi-sub">${k.sub}</div>
          </div>
          ${dbRing(k.ratio, i === dbWeakIdx ? '#c8102e' : '#94a3b8')}
        </div>
      `).join('')}
    </div>

    <div class="db-grid">
      <div class="db-panel">
        <div class="db-panel-title">Birey ↔ kurum haritası<span>Her nokta bir katılımcı</span></div>
        ${scatterSvg}
        ${scInsight}
      </div>

      <div class="db-panel">
        <div class="db-panel-title">Bakış açısı farkı<span>Radar · ortalama /5</span></div>
        <div class="db-radar-legend">${radarLegend}</div>
        ${radarSvg}
        ${dbInsight(rdInsightHtml, rdSoHtml)}
      </div>

      <div class="db-panel">
        <div class="db-panel-title">Puan dağılımı<span>Yanıtların yoğunlaştığı yer</span></div>
        <div class="db-radar-legend"><span><i style="background:#e2e8f0"></i>Fırsat algısı</span><span><i style="background:#c8102e"></i>Kurumsal hazırlık</span></div>
        ${distSvg}
        ${distInsight}
      </div>

      <div class="db-panel">
        <div class="db-panel-title">Kullanım × kaygı matrisi<span>2×2 segmentasyon</span></div>
        ${matrixHtml}
        ${mxInsight}
      </div>

      <div class="db-panel db-panel-wide">
        <div class="db-panel-title">Kitle profili<span>Tüm salon</span></div>
        <div class="db-donut-wrap">
          ${donutSvg}
          <div class="db-donut-legend">
            ${dbArch.map(a => `<div class="db-stack-item"><i style="background:${a.color}"></i><span class="n">${a.name}</span><b class="${a.lead ? 'lead' : ''}">%${a.pct}</b></div>`).join('')}
          </div>
        </div>
        ${donutInsight}
      </div>
    </div>
  `;

  // Attach Cohort Filter Click Listeners
  const cohortButtons = body.querySelectorAll('.cohort-pill');
  cohortButtons.forEach(btn => {
    btn.onclick = () => {
      const selectedCohort = btn.getAttribute('data-cohort');
      generateSurveyInsights(selectedCohort);
    };
  });

  // Comprehensive Executive Markdown Report for Copying
  const markdownReport = `
# 📊 BODTÜM Kitle Zekası & Çapraz Analiz Raporu
*Tarih: ${new Date().toLocaleDateString('tr-TR')} | Toplam Katılımcı: ${totalAllVotes} ODTÜ Mezunu*

---

### 1. Salonun 3 Temel Stratejik Paradoksu (Çapraz Analiz)
1. **Liderlik & Kurumsal Yarılma Paradoksu (${corpGapScore} Puan Uçurum):**
   - Katılımcıların Fırsat Algısı: **${allQ4Avg} / 5.0** (%${pctHighOpportunity} Fırsat)
   - Türkiye'de Kurumların Hazırlık Notu: **${allQ6Avg} / 5.0** (%${pctLowCorpReady} Yetersiz/Stratejisiz)
   - *İçgörü:* Bireysel adaptasyon kurumsal çevikliğin 2 yıl önünde gidiyor.

2. **Kognitif İkilem (Üretkenlik vs. Muhakeme Kaybı):**
   - Süreç Verimliliği & Zaman Kazanımı: **%${pctEfficiencyDrivers}**
   - Zihinsel Tembellik & Gençlerde Eleştirel Düşünce Kaygısı: **%${pctCognitiveConcerns}**
   - *İçgörü:* Mezunlar araçları hız için kullanırken, derin düşünme kaslarını kaybetmekten derin kaygı duyuyor.

3. **Temas Temettüsü (Aşinalık İyimserliği):**
   - Uzman/Düzenli Kullanıcılarda Fırsat: **${powerUsersQ4Avg} / 5.0** (Tehdit Algısı %0)
   - Seyrek/Gözlemcilerde Fırsat: **${nonUsersQ4Avg} / 5.0** (Arafta)
   - *İçgörü:* Tehdit algısının ana kaynağı riskin kendisi değil, araçla henüz düzenli temas kurulmamış olmasıdır.

---

### 2. Çoklu Araç Sıçraması (The Multimodal Dividend)
- **Tek Araç Kullananlar (1 Araç):** Stratejik Karar Destek %${singleStratPct} | Metin Yazımı %${singleTextPct} ("Sekreter Modeli")
- **3+ Araç Kullananlar (Multimodal):** Stratejik Karar Destek %${multiStratPct} | Metin Yazımı %${multiTextPct} ("Strateji Ortağı Modeli")
- *Sonuç:* Araç sayısı arttıkça stratejik verim 2.5 kat artıyor.

---

### 3. Kitle Arketipleri Dağılımı
- **🚀 Pragmatik Öncüler:** %${trailblazerPct} (${trailblazerCount} kişi)
- **🧠 Eleştirel Düşünürler:** %${thinkerPct} (${thinkerCount} kişi)
- **💼 Dönüşüm Arayışındakiler:** %${catalystPct} (${catalystCount} kişi)
- **🛡️ Temkinli Gözlemciler:** %${observerPct} (${observerCount} kişi)

---

### 4. Konuşmacı Yol Haritası
- Bireysel temel kavramları hızlı geçip kurumsal hazırlık uçurumunu nasıl kapatacaklarına odaklanın.
- Zihinsel körelme kaygısını yapay zekayı bir "kırmızı takım / düşünce ortağı" yaparak güvenceye alın.
- Katılımcıları tek chat modelinden multimodal ekosisteme taşıyacak somut iş akışlarını gösterin.
  `.trim();

  const copyBtn = document.getElementById('copyInsightsMarkdownBtn');
  if (copyBtn) {
    copyBtn.onclick = () => {
      exportInsightsAsPDF({
        dateStr: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }),
        roomCode: (typeof roomId !== 'undefined' ? roomId : 'bodtum-1815'),
        totalAllVotes,
        activeFilter: activeInsightsCohort || 'all',
        headline: `Mezunların %${pctHighOpportunity}'i Fırsat Görüyor; Ancak Kurumların Yalnızca %${pctReadyCorp}'i Hazır!`,
        corpGapScore,
        powerPct: activePowerRegularPct,
        powerAndRegCount: powerGroupCount,
        allQ4Avg,
        pctHighOpportunity,
        q5CriticalAvg: activeQ5Avg,
        pctCognitiveConcerns,
        allQ6Avg,
        pctLowCorpReady,
        pctEfficiencyDrivers,
        powerUsersQ4Avg,
        nonUsersQ4Avg,
        singleStratPct,
        singleTextPct,
        multiStratPct,
        multiTextPct,
        trailblazerPct,
        trailblazerCount,
        thinkerPct,
        thinkerCount,
        catalystPct,
        catalystCount,
        observerPct,
        observerCount
      });
    };
  }

  const quickPopulateBtn = document.getElementById('insightsQuickPopulateBtn');
  if (quickPopulateBtn) {
    quickPopulateBtn.onclick = () => {
      autoPopulateResponses(15);
      generateSurveyInsights();
    };
  }

  // Ensure Page C is active if not already
  if (currentAdminView !== 'insights') {
    switchAdminView('insights');
  }
}

// ----------------------------------------------------
// Executive Printable & PDF Report Generator
// ----------------------------------------------------
function renderPdfQuestionResultsHtml(q, idx) {
  const results = calculateResults(q);
  const total = results.totalVotes || 0;
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  let typeBadge = 'Tek Seçim';
  let typeColor = '#2563eb';
  let typeBg = '#eff6ff';
  if (q.type === 'multi') {
    typeBadge = 'Çoklu Seçim';
    typeColor = '#7c3aed';
    typeBg = '#f5f3ff';
  } else if (q.type === 'scale') {
    typeBadge = '1-5 Doğrusal Ölçek';
    typeColor = '#059669';
    typeBg = '#ecfdf5';
  } else if (q.type === 'rating') {
    typeBadge = 'Değerlendirme';
    typeColor = '#d97706';
    typeBg = '#fffbeb';
  } else if (q.type === 'wordcloud') {
    typeBadge = 'Açık Uçlu / Kelime Bulutu';
    typeColor = '#c8102e';
    typeBg = '#fef2f2';
  }

  let bodyContent = '';

  if (q.type === 'single' || q.type === 'multi') {
    const breakdown = results.breakdown || [];
    let maxCount = 0;
    breakdown.forEach(b => { if (b.count > maxCount) maxCount = b.count; });

    bodyContent = `
      <div style="display: flex; flex-direction: column; gap: 5px; margin-top: 8px;">
        ${breakdown.map((item, optIdx) => {
          const letter = letters[optIdx] || (optIdx + 1);
          const isLead = maxCount > 0 && item.count === maxCount && total > 1;
          const barColor = isLead ? '#c8102e' : '#2563eb';
          const bgBar = isLead ? 'rgba(200, 16, 46, 0.14)' : 'rgba(37, 99, 235, 0.10)';
          return `
            <div style="background: #ffffff; border: 1px solid ${isLead ? 'rgba(200, 16, 46, 0.4)' : '#e2e8f0'}; border-radius: 6px; padding: 6px 10px; position: relative; overflow: hidden;">
              <div style="position: absolute; left: 0; top: 0; bottom: 0; width: ${item.percentage}%; background: ${bgBar}; border-right: 2.5px solid ${barColor};"></div>
              <div style="position: relative; z-index: 2; display: flex; justify-content: space-between; align-items: center; font-size: 8.5pt;">
                <div style="display: flex; align-items: center; gap: 7px; flex: 1; padding-right: 12px; min-width: 0;">
                  <span style="display: inline-block; width: 17px; height: 17px; line-height: 17px; text-align: center; border-radius: 3px; background: ${isLead ? '#c8102e' : '#e2e8f0'}; color: ${isLead ? '#ffffff' : '#475569'}; font-weight: 700; font-size: 7.5pt; flex-shrink: 0;">${letter}</span>
                  <span style="font-weight: ${isLead ? '700' : '600'}; color: #0f172a;">${escapeHtml(item.text)}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                  <span style="color: #64748b; font-size: 7.5pt;">${item.count} oy</span>
                  <span style="font-weight: 800; color: ${isLead ? '#c8102e' : '#0f172a'}; min-width: 38px; text-align: right; font-size: 9pt;">%${item.percentage}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } else if (q.type === 'scale') {
    const avg = results.average || '0.0';
    const breakdown = results.breakdown || [];
    bodyContent = `
      <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 12px; border-radius: 6px; margin-bottom: 7px;">
          <div style="font-size: 8pt; color: #475569;">
            <strong style="color: #0f172a;">Katılımcı Ortalaması:</strong>
            <span style="color: #64748b; margin-left: 6px;">(← ${escapeHtml(q.leftLabel || 'Düşük')} | ${escapeHtml(q.rightLabel || 'Yüksek')} →)</span>
          </div>
          <div style="font-size: 12pt; font-weight: 900; color: #059669;">
            ${avg} <span style="font-size: 8pt; color: #64748b; font-weight: 600;">/ 5.0</span>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 5px;">
          ${breakdown.map(item => `
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 10px; position: relative; overflow: hidden;">
              <div style="position: absolute; left: 0; top: 0; bottom: 0; width: ${item.percentage}%; background: rgba(5, 150, 105, 0.12); border-right: 2.5px solid #059669;"></div>
              <div style="position: relative; z-index: 2; display: flex; justify-content: space-between; align-items: center; font-size: 8.2pt;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="display: inline-block; width: 16px; height: 16px; line-height: 16px; text-align: center; border-radius: 50%; background: #e2e8f0; color: #0f172a; font-weight: 700; font-size: 7pt;">${item.value}</span>
                  <span style="font-weight: 600; color: #1e293b;">${escapeHtml(item.label)}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="color: #64748b; font-size: 7.5pt;">${item.count} oy</span>
                  <span style="font-weight: 800; color: #0f172a; min-width: 36px; text-align: right; font-size: 8.8pt;">%${item.percentage}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else if (q.type === 'rating') {
    const avg = results.average || '0.0';
    const breakdown = results.breakdown || [];
    bodyContent = `
      <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 12px; border-radius: 6px; margin-bottom: 7px;">
          <span style="font-size: 8pt; font-weight: 700; color: #0f172a;">Ortalama Değerlendirme:</span>
          <span style="font-size: 11pt; font-weight: 900; color: #d97706;">★ ${avg} <span style="font-size: 8pt; color: #64748b;">/ 5.0</span></span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 5px;">
          ${breakdown.map(item => `
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 10px; position: relative; overflow: hidden;">
              <div style="position: absolute; left: 0; top: 0; bottom: 0; width: ${item.percentage}%; background: rgba(217, 119, 6, 0.12); border-right: 2.5px solid #d97706;"></div>
              <div style="position: relative; z-index: 2; display: flex; justify-content: space-between; align-items: center; font-size: 8.2pt;">
                <span style="font-weight: 600; color: #1e293b;">${item.rating} Yıldız</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="color: #64748b; font-size: 7.5pt;">${item.count} oy</span>
                  <span style="font-weight: 800; color: #0f172a; min-width: 36px; text-align: right;">%${item.percentage}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else if (q.type === 'wordcloud') {
    const words = results.words || [];
    const entries = results.recentEntries || [];
    bodyContent = `
      <div style="margin-top: 8px;">
        ${words.length > 0 ? `
          <div style="font-size: 7.5pt; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">Öne Çıkan Kelimeler</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;">
            ${words.slice(0, 16).map(w => `
              <span style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #0f172a; font-size: 8pt; font-weight: 700; padding: 3px 8px; border-radius: 4px;">
                ${escapeHtml(w.word)} <span style="font-size: 7pt; color: #c8102e;">(${w.count})</span>
              </span>
            `).join('')}
          </div>
        ` : ''}
        ${entries.length > 0 ? `
          <div style="font-size: 7.5pt; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 0.05em;">Son Gelen Katılımcı Cümleleri</div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            ${entries.slice(0, 5).map(e => `
              <div style="background: #f8fafc; border-left: 3px solid #cbd5e1; padding: 4px 8px; font-size: 8pt; color: #334155; font-style: italic;">
                "${escapeHtml(e.text)}"
              </div>
            `).join('')}
          </div>
        ` : '<div style="font-size: 8pt; color: #94a3b8; font-style: italic;">Henüz serbest metin yanıtı kaydedilmedi.</div>'}
      </div>
    `;
  }

  return `
    <div class="avoid-break" style="break-inside: avoid; page-break-inside: avoid; border: 1px solid #cbd5e1; border-radius: 8px; background: #ffffff; padding: 11px 13px; margin-bottom: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="background: #c8102e; color: #ffffff; font-size: 7pt; font-weight: 800; padding: 2px 6px; border-radius: 3px; text-transform: uppercase;">Soru ${idx + 1}</span>
            <span style="background: ${typeBg}; color: ${typeColor}; border: 1px solid rgba(0,0,0,0.06); font-size: 7pt; font-weight: 700; padding: 2px 6px; border-radius: 3px;">${typeBadge}</span>
          </div>
          <div style="font-size: 9.5pt; font-weight: 800; color: #0f172a; line-height: 1.35;">${escapeHtml(q.title)}</div>
        </div>
        <div style="text-align: right; flex-shrink: 0;">
          <span style="background: #f8fafc; border: 1px solid #cbd5e1; color: #0f172a; font-size: 7.5pt; font-weight: 800; padding: 3px 8px; border-radius: 12px; display: inline-block;">${total} Yanıt</span>
        </div>
      </div>
      ${bodyContent}
    </div>
  `;
}

function buildPdfReportBodyHtml(data) {
  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #0f172a; background: #ffffff; padding: 24px 30px; font-size: 9.5pt; line-height: 1.45;">
    <!-- Report Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #c8102e; padding-bottom: 12px; margin-bottom: 16px;">
      <div>
        <div style="font-size: 17pt; font-weight: 900; color: #0f172a; letter-spacing: -0.02em;">
          <span style="color: #c8102e;">ODTÜ</span> & BODTÜM YAPAY ZEKA KULLANIM VE EĞİLİM RAPORU
        </div>
        <div style="font-size: 9.5pt; font-weight: 600; color: #475569; margin-top: 3px;">
          ODTÜ Mezunlar Derneği Bodrum — Kitle Zekası, Karar Verici Dinamikleri & Stratejik Radar
        </div>
      </div>
      <div style="text-align: right; font-size: 8.5pt; color: #64748b; line-height: 1.5;">
        <div><strong>Tarih:</strong> ${data.dateStr}</div>
        <div><strong>Katılımcı Sayısı:</strong> ${data.totalAllVotes} ODTÜ Mezunu</div>
        <div><strong>Oturum Kodu:</strong> ${data.roomCode}</div>
      </div>
    </div>

    <!-- 1 Numaralı Stratejik Manşet -->
    <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-left: 6px solid #c8102e; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px;">
      <div style="font-size: 7.5pt; font-weight: 800; color: #c8102e; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">
        Salondan Çıkan 1 Numaralı Stratejik Manşet
      </div>
      <div style="font-size: 12.5pt; font-weight: 800; color: #0f172a; line-height: 1.35;">
        ${data.headline}
      </div>
    </div>

    <!-- 4 KPI Skor Kartı -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;">
      <div style="border: 1px solid #e2e8f0; background: #ffffff; border-radius: 6px; padding: 10px 12px; border-top: 4px solid #c8102e;">
        <div style="font-size: 18pt; font-weight: 900; color: #0f172a; line-height: 1.1;">%${data.powerPct}</div>
        <div style="font-size: 8.2pt; font-weight: 700; color: #334155; margin-top: 4px;">Yapay Zeka Benimseme</div>
        <div style="font-size: 7.2pt; color: #64748b; margin-top: 2px;">Düzenli & Uzman Kullanıcı Oranı</div>
      </div>
      <div style="border: 1px solid #e2e8f0; background: #ffffff; border-radius: 6px; padding: 10px 12px; border-top: 4px solid #1d4ed8;">
        <div style="font-size: 18pt; font-weight: 900; color: #0f172a; line-height: 1.1;">${data.allQ4Avg} <span style="font-size: 10pt; color: #64748b;">/ 5.0</span></div>
        <div style="font-size: 8.2pt; font-weight: 700; color: #334155; margin-top: 4px;">Gelecek Fırsat Notu</div>
        <div style="font-size: 7.2pt; color: #64748b; margin-top: 2px;">%${data.pctHighOpportunity} Fırsat Ağırlıklı</div>
      </div>
      <div style="border: 1px solid #e2e8f0; background: #ffffff; border-radius: 6px; padding: 10px 12px; border-top: 4px solid #d97706;">
        <div style="font-size: 18pt; font-weight: 900; color: #0f172a; line-height: 1.1;">${data.q5CriticalAvg} <span style="font-size: 10pt; color: #64748b;">/ 5.0</span></div>
        <div style="font-size: 8.2pt; font-weight: 700; color: #334155; margin-top: 4px;">Eleştirel Düşünce Kaygısı</div>
        <div style="font-size: 7.2pt; color: #64748b; margin-top: 2px;">%${data.pctCognitiveConcerns} Bilişsel Temas Endişesi</div>
      </div>
      <div style="border: 1px solid #e2e8f0; background: #ffffff; border-radius: 6px; padding: 10px 12px; border-top: 4px solid #475569;">
        <div style="font-size: 18pt; font-weight: 900; color: #0f172a; line-height: 1.1;">${data.allQ6Avg} <span style="font-size: 10pt; color: #64748b;">/ 5.0</span></div>
        <div style="font-size: 8.2pt; font-weight: 700; color: #334155; margin-top: 4px;">Kurumsal Hazırlık Notu</div>
        <div style="font-size: 7.2pt; color: #64748b; margin-top: 2px;">%${data.pctLowCorpReady} Şirketleri Yetersiz Buluyor</div>
      </div>
    </div>

    <!-- 3 Stratejik Paradoks -->
    <div style="font-size: 10.5pt; font-weight: 800; color: #0f172a; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 4px; margin-top: 14px; margin-bottom: 10px;">
      Salonun 3 Temel Stratejik Paradoksu (Çapraz Analiz)
    </div>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px;">
      <div style="border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 6px; padding: 10px 12px;">
        <div style="font-size: 7.5pt; font-weight: 800; color: #c8102e; text-transform: uppercase;">1. Liderlik & Kurum Uçurumu</div>
        <div style="font-size: 9pt; font-weight: 800; color: #0f172a; margin: 3px 0 5px 0;">${data.corpGapScore} Puan Hazırlık Yarılması</div>
        <div style="font-size: 8pt; color: #334155; line-height: 1.4;">
          Katılımcılar bireysel olarak fırsat notunu <strong>${data.allQ4Avg}/5.0</strong> verirken, kurumların hazırlığını yalnızca <strong>${data.allQ6Avg}/5.0</strong> olarak değerlendirdi.
        </div>
      </div>
      <div style="border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 6px; padding: 10px 12px;">
        <div style="font-size: 7.5pt; font-weight: 800; color: #c8102e; text-transform: uppercase;">2. Kognitif İkilem</div>
        <div style="font-size: 9pt; font-weight: 800; color: #0f172a; margin: 3px 0 5px 0;">Verimlilik vs. Muhakeme Kaybı</div>
        <div style="font-size: 8pt; color: #334155; line-height: 1.4;">
          Süreç verimliliği beklentisi <strong>%${data.pctEfficiencyDrivers}</strong> iken, yeni kuşaklarda eleştirel düşünce körelmesi kaygısı <strong>%${data.pctCognitiveConcerns}</strong> ile öne çıkıyor.
        </div>
      </div>
      <div style="border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 6px; padding: 10px 12px;">
        <div style="font-size: 7.5pt; font-weight: 800; color: #c8102e; text-transform: uppercase;">3. Temas Temettüsü</div>
        <div style="font-size: 9pt; font-weight: 800; color: #0f172a; margin: 3px 0 5px 0;">Aşinalık İyimserliği Çarpanı</div>
        <div style="font-size: 8pt; color: #334155; line-height: 1.4;">
          Düzenli kullanıcıların fırsat notu <strong>${data.powerUsersQ4Avg}/5.0</strong> iken, seyrek kullananlarda <strong>${data.nonUsersQ4Avg}/5.0</strong>'e geriliyor.
        </div>
      </div>
    </div>

    <!-- Çoklu Araç Sıçraması -->
    <div style="font-size: 10.5pt; font-weight: 800; color: #0f172a; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 4px; margin-top: 14px; margin-bottom: 10px;">
      Çoklu Araç Sıçraması (The Multimodal Dividend)
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
      <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; background: #ffffff;">
        <div style="display: inline-block; font-size: 7.5pt; font-weight: 700; padding: 2px 7px; border-radius: 4px; background: #f1f5f9; color: #475569; margin-bottom: 6px;">Tek Araç Kullananlar (Yalnızca ChatGPT)</div>
        <div style="font-weight: 800; font-size: 9.5pt; margin-bottom: 6px; color: #1e293b;">"Gelişmiş Sekreter Modeli"</div>
        <div style="font-size: 8.2pt; color: #475569; line-height: 1.5;">
          • Metin Yazımı & Çeviri Odaklılık: <strong>%${data.singleTextPct}</strong><br>
          • Stratejik Karar Destek & Fikir Ortaklığı: <strong>%${data.singleStratPct}</strong>
        </div>
      </div>
      <div style="border: 1px solid #e2e8f0; border-left: 3px solid #1d4ed8; border-radius: 6px; padding: 12px 14px; background: #ffffff;">
        <div style="display: inline-block; font-size: 7.5pt; font-weight: 700; padding: 2px 7px; border-radius: 4px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; margin-bottom: 6px;">3+ Araç Kullananlar (Claude, Cursor, Perplexity)</div>
        <div style="font-weight: 800; font-size: 9.5pt; color: #1d4ed8; margin-bottom: 6px;">"Strateji & Büyüteç Partneri"</div>
        <div style="font-size: 8.2pt; color: #1e293b; line-height: 1.5;">
          • Metin Yazımı & Çeviri: <strong>%${data.multiTextPct}</strong><br>
          • Stratejik Karar Destek & Fikir Ortaklığı: <strong>%${data.multiStratPct}</strong> <em>(2.5 Kat Artış)</em>
        </div>
      </div>
    </div>

    <!-- Kitle Arketipleri -->
    <div style="font-size: 10.5pt; font-weight: 800; color: #0f172a; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 4px; margin-top: 14px; margin-bottom: 10px;">
      Dinamik Kitle Arketipleri Dağılımı
    </div>
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;">
      <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; background: #f8fafc; border-top: 3px solid #1d4ed8;">
        <div style="font-size: 15pt; font-weight: 900; color: #1d4ed8;">%${data.trailblazerPct}</div>
        <div style="font-size: 8.5pt; font-weight: 800; color: #0f172a; margin: 3px 0 2px 0;">Pragmatik Öncüler</div>
        <div style="font-size: 7.5pt; color: #64748b;">${data.trailblazerCount} Katılımcı</div>
      </div>
      <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; background: #f8fafc; border-top: 3px solid #d97706;">
        <div style="font-size: 15pt; font-weight: 900; color: #d97706;">%${data.thinkerPct}</div>
        <div style="font-size: 8.5pt; font-weight: 800; color: #0f172a; margin: 3px 0 2px 0;">Eleştirel Düşünürler</div>
        <div style="font-size: 7.5pt; color: #64748b;">${data.thinkerCount} Katılımcı</div>
      </div>
      <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; background: #f8fafc; border-top: 3px solid #c8102e;">
        <div style="font-size: 15pt; font-weight: 900; color: #c8102e;">%${data.catalystPct}</div>
        <div style="font-size: 8.5pt; font-weight: 800; color: #0f172a; margin: 3px 0 2px 0;">Dönüşüm Arayışındakiler</div>
        <div style="font-size: 7.5pt; color: #64748b;">${data.catalystCount} Katılımcı</div>
      </div>
      <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; background: #f8fafc; border-top: 3px solid #475569;">
        <div style="font-size: 15pt; font-weight: 900; color: #475569;">%${data.observerPct}</div>
        <div style="font-size: 8.5pt; font-weight: 800; color: #0f172a; margin: 3px 0 2px 0;">Temkinli Gözlemciler</div>
        <div style="font-size: 7.5pt; color: #64748b;">${data.observerCount} Katılımcı</div>
      </div>
    </div>

    <!-- Yol Haritası -->
    <div style="font-size: 10.5pt; font-weight: 800; color: #0f172a; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 4px; margin-top: 14px; margin-bottom: 10px;">
      Konuşmacı & Karar Verici Yol Haritası
    </div>
    <ul style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #1d4ed8; border-radius: 6px; padding: 10px 16px 10px 24px; margin: 0 0 16px 0;">
      <li style="font-size: 8.2pt; color: #1e293b; margin-bottom: 5px; line-height: 1.4;">
        <strong>Kurumsal Uçurumu Kapatma:</strong> Bireysel kavramları hızla geçip, kurumsal hazırlık farkını kapatacak şirket içi yapay zeka yönetişim modelleri sunun.
      </li>
      <li style="font-size: 8.2pt; color: #1e293b; margin-bottom: 5px; line-height: 1.4;">
        <strong>Kırmızı Takım & Düşünce Ortağı:</strong> Eleştirel düşünce kaybını önlemek için yapay zekayı cevap üreten değil, argümanları test eden bir entelektüel partner olarak konumlandırın.
      </li>
      <li style="font-size: 8.2pt; color: #1e293b; line-height: 1.4;">
        <strong>Multimodal Ekosisteme Geçiş:</strong> Katılımcıları tek bir chat penceresinden kod, doküman analizi ve görsel modelleri içeren çoklu araç mimarisine yönlendirin.
      </li>
    </ul>

    <!-- Footer -->
    <div style="border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 14px; display: flex; justify-content: space-between; font-size: 7.5pt; color: #94a3b8;">
      <div>ODTÜ Mezunlar Derneği Bodrum (BODTÜM) — Canlı Kitle Zekası Platformu (Yönetici Özeti)</div>
      <div>Rapor Oluşturulma Saati: ${new Date().toLocaleTimeString('tr-TR')}</div>
    </div>

    <!-- ==========================================================================
         BÖLÜM 2: CANLI SAHNE — TÜM SORULAR VE KATILIMCI YANITLARI
         ========================================================================== -->
    <div class="page-break" style="page-break-before: always; break-before: page; margin-top: 28px; padding-top: 20px; border-top: 3px solid #c8102e;">
      <!-- Bölüm Başlığı -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 14px;">
        <div>
          <div style="font-size: 15pt; font-weight: 900; color: #0f172a; letter-spacing: -0.02em;">
            <span style="color: #c8102e;">CANLI SAHNE:</span> TÜM SORULAR VE KATILIMCI YANITLARI
          </div>
          <div style="font-size: 8.5pt; font-weight: 600; color: #64748b; margin-top: 3px;">
            Katılımcıların canlı ankette her bir soruya verdiği doğrudan yanıt oranları ve detaylı oy dağılımları
          </div>
        </div>
        <div style="text-align: right; font-size: 8pt; color: #64748b;">
          <span style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 6px; font-weight: 700; color: #0f172a;">Toplam ${survey.questions.length} Soru</span>
        </div>
      </div>

      <!-- Soru Soru Sonuç Kartları -->
      <div style="display: flex; flex-direction: column; gap: 4px;">
        ${survey.questions.map((q, idx) => renderPdfQuestionResultsHtml(q, idx)).join('')}
      </div>

      <!-- Canlı Sahne Sonu Kapanış Notu -->
      <div style="border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 14px; display: flex; justify-content: space-between; font-size: 7.5pt; color: #94a3b8;">
        <div>ODTÜ Mezunlar Derneği Bodrum (BODTÜM) — Canlı Anket & Sahne Sonuçları</div>
        <div>Tarih: ${data.dateStr} | Oturum Kodu: ${data.roomCode}</div>
      </div>
    </div>
  </div>
  `;
}

function exportInsightsAsPDF(data) {
  const copyBtn = document.getElementById('copyInsightsMarkdownBtn');
  const originalHtml = copyBtn ? copyBtn.innerHTML : '';
  const restore = () => {
    if (copyBtn) { copyBtn.disabled = false; copyBtn.innerHTML = originalHtml; }
  };

  if (copyBtn) {
    copyBtn.innerHTML = `
      <svg class="action-mini-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a10 10 0 0 1 10 10"/></svg>
      <span>PDF Hazırlanıyor...</span>
    `;
    copyBtn.disabled = true;
  }

  if (typeof html2pdf === 'undefined') {
    restore();
    openPrintWindowFallback(data);
    return;
  }

  // IMPORTANT: html2pdf clones this element with its inline styles. It must stay a plain,
  // unpositioned block (no position:fixed/absolute, no opacity:0, no overflow:hidden),
  // otherwise the clone collapses to 0 height and the saved PDF is empty.
  const reportEl = document.createElement('div');
  reportEl.style.width = '794px';
  reportEl.style.background = '#ffffff';
  reportEl.style.color = '#0f172a';
  reportEl.innerHTML = buildPdfReportBodyHtml(data);

  const filename = `BODTUM_ODTU_Yapay_Zeka_Yonetici_Raporu_${new Date().toISOString().slice(0, 10)}.pdf`;
  const opt = {
    margin: [8, 8, 8, 8],
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'], before: '.page-break', avoid: '.avoid-break' }
  };

  html2pdf().set(opt).from(reportEl).save().then(() => {
    if (copyBtn) {
      copyBtn.disabled = false;
      copyBtn.innerHTML = `
        <svg class="action-mini-svg" viewBox="0 0 24 24" fill="none" stroke="#86efac" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span style="color: #86efac; font-weight: 700;">✓ PDF İndirildi!</span>
      `;
      setTimeout(() => { copyBtn.innerHTML = originalHtml; }, 3000);
    }
  }).catch(err => {
    console.warn('html2pdf hatası, yazdırma penceresine geçiliyor:', err);
    restore();
    openPrintWindowFallback(data);
  });
}

function openPrintWindowFallback(data) {
  const printWindow = window.open('', '_blank', 'width=980,height=1100');
  if (!printWindow) {
    alert('Lütfen tarayıcınızın açılır pencere (popup) engelleyicisini kaldırın veya izin verin.');
    return;
  }
  const bodyHtml = buildPdfReportBodyHtml(data);
  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>BODTÜM & ODTÜ Yapay Zeka Yönetici Raporu</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin: 0; padding: 10px; background: #ffffff; }
    .page-break { page-break-before: always !important; break-before: page !important; }
    .avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  ${bodyHtml}
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => { window.print(); }, 400);
    });
  <\/script>
</body>
</html>`;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

// ----------------------------------------------------
// 3-Page Executive View Navigation System
// ----------------------------------------------------
let currentAdminView = 'qr'; // 'qr' | 'stage' | 'insights'

function switchAdminView(viewName) {
  currentAdminView = viewName;

  // Update header tabs
  document.querySelectorAll('.view-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
  });

  // Update page views
  document.querySelectorAll('.admin-page-view').forEach(view => {
    view.classList.toggle('active', view.id === `view-${viewName}`);
  });

  if (viewName === 'insights') {
    generateSurveyInsights();
  }
  if (viewName === 'qr') {
    const qrCount = document.getElementById('qrParticipantCount');
    if (qrCount) qrCount.textContent = activeParticipants.size;
  }
}

// Header Tabs
const tabBtnQr = document.getElementById('tabBtnQr');
const tabBtnStage = document.getElementById('tabBtnStage');
const tabBtnInsights = document.getElementById('tabBtnInsights');

if (tabBtnQr) tabBtnQr.addEventListener('click', () => switchAdminView('qr'));
if (tabBtnStage) tabBtnStage.addEventListener('click', () => switchAdminView('stage'));
if (tabBtnInsights) tabBtnInsights.addEventListener('click', () => switchAdminView('insights'));

// In-Page Navigation Buttons
const qrStartQuestionsBtn = document.getElementById('qrStartQuestionsBtn');
if (qrStartQuestionsBtn) qrStartQuestionsBtn.addEventListener('click', () => switchAdminView('stage'));

const stageGoToInsightsBtn = document.getElementById('stageGoToInsightsBtn');
if (stageGoToInsightsBtn) stageGoToInsightsBtn.addEventListener('click', () => switchAdminView('insights'));

const insightsBackToStageBtn = document.getElementById('insightsBackToStageBtn');
if (insightsBackToStageBtn) insightsBackToStageBtn.addEventListener('click', () => switchAdminView('stage'));

// Auto populate button in header
const autoPopulateBtn = document.getElementById('autoPopulateBtn');
if (autoPopulateBtn) {
  autoPopulateBtn.addEventListener('click', () => {
    autoPopulateResponses(15);
    if (currentAdminView === 'insights') {
      generateSurveyInsights();
    }
  });
}

// Global Keyboard Navigation (1, 2, 3, Arrow Keys, L)
window.addEventListener('keydown', (e) => {
  // Ignore if user is typing in an input or textarea
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

  if (e.key === '1') {
    switchAdminView('qr');
  } else if (e.key === '2') {
    switchAdminView('stage');
  } else if (e.key === '3') {
    switchAdminView('insights');
  } else if (e.key === 'ArrowLeft' && currentAdminView === 'stage') {
    if (survey.activeQuestionIndex > 0) {
      survey.activeQuestionIndex--;
      saveSurvey();
      broadcastState();
      renderSurvey();
    }
  } else if (e.key === 'ArrowRight' && currentAdminView === 'stage') {
    if (survey.activeQuestionIndex < survey.questions.length - 1) {
      survey.activeQuestionIndex++;
      saveSurvey();
      broadcastState();
      renderSurvey();
    }
  } else if ((e.key === 'l' || e.key === 'L') && currentAdminView === 'stage') {
    survey.acceptingVotes = !survey.acceptingVotes;
    saveSurvey();
    broadcastState();
    renderSurvey();
  }
});

// Boot
renderSurvey();
switchAdminView('qr');
connectRealtime();
