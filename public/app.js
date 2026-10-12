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

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880.00, this.ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    } catch (e) {}
  }
}

const notifier = new AudioNotifier();

// Exactly the 3 Turkish AI Survey Questions requested by the user
const DEFAULT_SURVEY = {
  title: "BODTUM Yapay Zeka Canlı Anketi",
  activeQuestionIndex: 0,
  acceptingVotes: true,
  questions: [
    {
      id: "q1",
      type: "single",
      title: "Yapay zekayı ne sıklıkla kullanıyorsunuz?",
      options: [
        { id: "opt1_1", text: "Hiç kullanmadım" },
        { id: "opt1_2", text: "Birkaç kez denedim" },
        { id: "opt1_3", text: "Ara sıra kullanıyorum" },
        { id: "opt1_4", text: "Hemen hemen her gün" }
      ],
      votes: {}
    },
    {
      id: "q2",
      type: "multi",
      title: "Yapay zekayı hangi amaçlarla kullanıyorsunuz?",
      subtitle: "(Birden fazla seçenek seçilebilir)",
      options: [
        { id: "opt2_1", text: "🔍 Araştırma ve bilgi edinme" },
        { id: "opt2_2", text: "✍️ Yazı yazma, çeviri ve özetleme" },
        { id: "opt2_3", text: "🎨 Fotoğraf, görsel veya müzik üretimi" },
        { id: "opt2_4", text: "💻 Kod yazma veya uygulama geliştirme" },
        { id: "opt2_5", text: "📅 Planlama ve günlük işler" },
        { id: "opt2_6", text: "🚫 Henüz kullanmıyorum" }
      ],
      votes: {}
    },
    {
      id: "q3",
      type: "single",
      title: "Bugün en çok neyi merak ediyorsunuz?",
      options: [
        { id: "opt3_1", text: "💡 Yapay zekayı günlük hayatımda nasıl kullanabilirim?" },
        { id: "opt3_2", text: "🚀 Yapay zeka ile neler üretebilirim?" },
        { id: "opt3_3", text: "⚙️ Yapay zeka nasıl çalışıyor?" },
        { id: "opt3_4", text: "🛡️ Riskleri ve sınırları neler?" }
      ],
      votes: {}
    }
  ]
};

// Initialize or update state (ensure latest question structure)
let survey = DEFAULT_SURVEY;
try {
  const saved = localStorage.getItem(`survey_state_${roomId}`);
  if (saved) {
    const parsed = JSON.parse(saved);
    // If questions match the 3 Turkish questions, preserve votes, otherwise update to new questions
    if (parsed.questions && parsed.questions.length === 3 && parsed.questions[0].title.includes("Yapay zeka")) {
      survey = parsed;
    }
  }
} catch (e) {}

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
    activeQuestionIndex: survey.activeQuestionIndex,
    totalQuestions: survey.questions.length,
    acceptingVotes: survey.acceptingVotes,
    activeQuestion: activeQ ? {
      ...activeQ,
      votesCount: Object.keys(activeQ.votes || {}).length,
      results: calculateResults(activeQ)
    } : null,
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

// Fail-safe Instant QR Code Generation
const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=0&color=09-0d-16&bgcolor=ffffff&data=${encodeURIComponent(voterJoinUrl)}`;

if (qrImage) {
  qrImage.src = qrApiUrl;
}

if (window.QRCode && qrcodeBox) {
  try {
    qrcodeBox.innerHTML = '';
    new QRCode(qrcodeBox, {
      text: voterJoinUrl,
      width: 210,
      height: 210,
      colorDark: '#090d16',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } catch (err) {
    if (qrcodeBox) {
      qrcodeBox.innerHTML = `<img src="${qrApiUrl}" style="width: 210px; height: 210px; display: block; border-radius: 8px;" alt="QR Code" />`;
    }
  }
}

// Copy button
copyUrlBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(voterJoinUrl).then(() => {
    const original = copyUrlBtn.textContent;
    copyUrlBtn.textContent = 'Kopyalandı!';
    setTimeout(() => copyUrlBtn.textContent = original, 2000);
  });
});

// Sound Toggle
soundToggle.addEventListener('click', () => {
  notifier.enabled = !notifier.enabled;
  if (notifier.enabled) {
    soundToggle.classList.add('active');
    soundToggle.textContent = '🔔 Ses Açık';
    notifier.playVoteChime();
  } else {
    soundToggle.classList.remove('active');
    soundToggle.textContent = '🔕 Ses Kapalı';
  }
});

// Fullscreen Toggle
fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
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

addQuestionBtn.addEventListener('click', () => questionModal.showModal());
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

// Reset Survey
resetBtn.addEventListener('click', () => {
  if (confirm('Tüm katılımcı oylarını sıfırlamak istediğinize emin misiniz?')) {
    survey.questions.forEach(q => q.votes = {});
    saveSurvey();
    broadcastState();
    renderSurvey();
  }
});

// Lock Toggle
toggleLockBtn.addEventListener('click', () => {
  survey.acceptingVotes = !survey.acceptingVotes;
  saveSurvey();
  broadcastState();
  renderSurvey();
});

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
  qTypeTag.textContent = activeQ.type === 'single' ? 'Tek Seçim' : (activeQ.type === 'multi' ? 'Çoklu Seçim (Birden Fazla)' : 'Yıldız');
  qTitle.innerHTML = activeQ.title + (activeQ.subtitle ? `<br><span style="font-size: 1.05rem; font-weight: 500; color: var(--secondary);">${activeQ.subtitle}</span>` : '');

  const totalVotes = Object.keys(activeQ.votes || {}).length;
  qVoteTotal.textContent = totalVotes;

  if (!survey.acceptingVotes) {
    lockStatusBadge.style.display = 'inline-flex';
    toggleLockBtn.textContent = '🔓 Oylamayı Aç';
  } else {
    lockStatusBadge.style.display = 'none';
    toggleLockBtn.textContent = '🔒 Oylamayı Kilitle';
  }

  prevBtn.disabled = survey.activeQuestionIndex === 0;
  prevBtn.style.opacity = survey.activeQuestionIndex === 0 ? '0.4' : '1';
  nextBtn.textContent = survey.activeQuestionIndex === survey.questions.length - 1 ? 'Anket Tamamlandı' : 'Sonraki Soru ▶';

  const results = calculateResults(activeQ);
  if (activeQ.type === 'single' || activeQ.type === 'multi') renderOptionsBreakdown(results);
  else if (activeQ.type === 'rating') renderRating(results);
  else if (activeQ.type === 'wordcloud') renderWordCloud(results);
}

function renderOptionsBreakdown(results) {
  const breakdown = results.breakdown || [];
  let maxCount = 0;
  breakdown.forEach(b => { if (b.count > maxCount) maxCount = b.count; });

  resultsContainer.innerHTML = breakdown.map(item => `
    <div class="option-result-row ${item.count > 0 ? 'has-votes' : ''}">
      <div class="result-bar-fill ${maxCount > 0 && item.count === maxCount ? 'lead-option' : ''}" style="width: ${item.percentage}%;"></div>
      <div class="result-content">
        <div class="option-label-text">${escapeHtml(item.text)}</div>
        <div class="option-stats">
          <span class="option-count-badge">${item.count} ${item.count === 1 ? 'oy' : 'oy'}</span>
          <span class="option-percentage">${item.percentage}%</span>
        </div>
      </div>
    </div>
  `).join('');
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

function connectRealtime(brokerIndex = 0) {
  if (brokerIndex >= BROKERS.length) return;
  const url = BROKERS[brokerIndex];
  
  mqttClient = mqtt.connect(url, {
    clientId: 'presenter_' + Math.random().toString(36).substring(2, 9),
    keepalive: 30,
    reconnectPeriod: 2000
  });

  mqttClient.on('connect', () => {
    console.log('Connected to real-time relay:', url);
    mqttClient.subscribe(TOPIC_VOTE);
    mqttClient.subscribe(TOPIC_JOIN);
    broadcastState();
  });

  mqttClient.on('message', (topic, message) => {
    try {
      const data = JSON.parse(message.toString());
      if (topic === TOPIC_VOTE) {
        handleIncomingVote(data);
      } else if (topic === TOPIC_JOIN) {
        activeParticipants.add(data.voterId || Math.random());
        participantCount.textContent = activeParticipants.size;
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

  q.votes[voterId] = answer;
  saveSurvey();
  notifier.playVoteChime();
  renderSurvey();
  broadcastState();
}

function broadcastState() {
  if (mqttClient && mqttClient.connected) {
    const payload = JSON.stringify(getSurveyPayload());
    mqttClient.publish(TOPIC_STATE, payload, { retain: true, qos: 1 });
  }
}

// Boot
renderSurvey();
connectRealtime();
