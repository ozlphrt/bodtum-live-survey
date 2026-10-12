// Presenter Dashboard - 100% Serverless GitHub Pages Real-Time Engine

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

// Default Survey Structure
const DEFAULT_SURVEY = {
  title: "BODTUM Live Usage & Experience Survey",
  activeQuestionIndex: 0,
  acceptingVotes: true,
  questions: [
    {
      id: "q1",
      type: "single",
      title: "How often do you engage with BODTUM platforms & services?",
      options: [
        { id: "opt1", text: "🚀 Daily - It's part of my routine" },
        { id: "opt2", text: "📅 Weekly - Several times a week" },
        { id: "opt3", text: "☕ Monthly - When specific needs arise" },
        { id: "opt4", text: "✨ First time / Just exploring today" }
      ],
      votes: {}
    },
    {
      id: "q2",
      type: "single",
      title: "Which core service or capability do you find most valuable?",
      options: [
        { id: "opt1", text: "🤝 Community Network & Peer Collaboration" },
        { id: "opt2", text: "💡 Knowledge Base, Guides & Docs" },
        { id: "opt3", text: "⚡ Rapid Response Tools & Automations" },
        { id: "opt4", text: "🎓 Workshops, Events & Mentorship" }
      ],
      votes: {}
    },
    {
      id: "q3",
      type: "rating",
      title: "How would you rate your overall experience so far?",
      labels: ["Poor", "Fair", "Good", "Very Good", "Exceptional 🌟"],
      votes: {}
    },
    {
      id: "q4",
      type: "wordcloud",
      title: "In 1 to 3 words, what feature or improvement would you like next?",
      placeholder: "e.g. mobile app, faster sync, dark theme...",
      votes: {}
    }
  ]
};

// Load or Initialize State
let survey = JSON.parse(localStorage.getItem(`survey_state_${roomId}`)) || DEFAULT_SURVEY;
let activeParticipants = new Set();

function saveSurvey() {
  localStorage.setItem(`survey_state_${roomId}`, JSON.stringify(survey));
}

// Calculate Aggregated Results
function calculateResults(q) {
  if (!q) return { totalVotes: 0 };
  const totalVotes = Object.keys(q.votes || {}).length;

  if (q.type === 'single') {
    const counts = {};
    q.options.forEach(opt => counts[opt.id] = 0);
    Object.values(q.votes).forEach(optId => {
      if (counts[optId] !== undefined) counts[optId]++;
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
      label: q.labels[star - 1],
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
const qrCanvas = document.getElementById('qrCanvas');
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
  // Replace index.html or root with vote.html
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

// Render QR Code immediately in-browser
if (window.QRCode && qrCanvas) {
  QRCode.toCanvas(qrCanvas, voterJoinUrl, {
    width: 210,
    margin: 1,
    color: { dark: '#090d16', light: '#ffffff' }
  });
}

// Copy button
copyUrlBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(voterJoinUrl).then(() => {
    const original = copyUrlBtn.textContent;
    copyUrlBtn.textContent = 'Copied!';
    setTimeout(() => copyUrlBtn.textContent = original, 2000);
  });
});

// Sound Toggle
soundToggle.addEventListener('click', () => {
  notifier.enabled = !notifier.enabled;
  if (notifier.enabled) {
    soundToggle.classList.add('active');
    soundToggle.textContent = '🔔 Sound On';
    notifier.playVoteChime();
  } else {
    soundToggle.classList.remove('active');
    soundToggle.textContent = '🔕 Sound Off';
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
  modalOptionsGroup.style.display = modalQType.value === 'single' ? 'block' : 'none';
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
    options: type === 'single' ? options.map((opt, i) => ({ id: `opt_${Date.now()}_${i}`, text: opt })) : [],
    labels: ["Poor", "Fair", "Good", "Very Good", "Exceptional 🌟"],
    placeholder: "Type your response...",
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
  if (confirm('Are you sure you want to reset all responses for all questions?')) {
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

  qIndexTag.textContent = `Question ${survey.activeQuestionIndex + 1} of ${survey.questions.length}`;
  qTypeTag.textContent = activeQ.type === 'single' ? 'Multiple Choice' : (activeQ.type === 'rating' ? 'Star Rating' : 'Live Word Stream');
  qTitle.textContent = activeQ.title;

  const totalVotes = Object.keys(activeQ.votes || {}).length;
  qVoteTotal.textContent = totalVotes;

  if (!survey.acceptingVotes) {
    lockStatusBadge.style.display = 'inline-flex';
    toggleLockBtn.textContent = '🔓 Unlock Voting';
  } else {
    lockStatusBadge.style.display = 'none';
    toggleLockBtn.textContent = '🔒 Lock Voting';
  }

  prevBtn.disabled = survey.activeQuestionIndex === 0;
  prevBtn.style.opacity = survey.activeQuestionIndex === 0 ? '0.4' : '1';
  nextBtn.textContent = survey.activeQuestionIndex === survey.questions.length - 1 ? 'Survey Completed' : 'Next Question ▶';

  const results = calculateResults(activeQ);
  if (activeQ.type === 'single') renderSingle(results);
  else if (activeQ.type === 'rating') renderRating(results);
  else if (activeQ.type === 'wordcloud') renderWordCloud(results);
}

function renderSingle(results) {
  const breakdown = results.breakdown || [];
  let maxCount = 0;
  breakdown.forEach(b => { if (b.count > maxCount) maxCount = b.count; });

  resultsContainer.innerHTML = breakdown.map(item => `
    <div class="option-result-row ${item.count > 0 ? 'has-votes' : ''}">
      <div class="result-bar-fill ${maxCount > 0 && item.count === maxCount ? 'lead-option' : ''}" style="width: ${item.percentage}%;"></div>
      <div class="result-content">
        <div class="option-label-text">${escapeHtml(item.text)}</div>
        <div class="option-stats">
          <span class="option-count-badge">${item.count} ${item.count === 1 ? 'vote' : 'votes'}</span>
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
        <div style="font-size: 0.85rem; color: var(--text-muted);">${results.totalVotes} total ratings</div>
      </div>
      <div class="rating-bars-list">
        ${breakdown.slice().reverse().map(item => `
          <div class="rating-bar-item">
            <div class="rating-bar-label">${item.rating} Stars (${item.label})</div>
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
    resultsContainer.innerHTML = `<div class="empty-state"><p>Waiting for participants to submit ideas and feedback...</p></div>`;
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
      <div class="words-cloud-pills">${wordsHtml || '<span>No words yet</span>'}</div>
      <div>
        <div class="live-feed-header">Recent Live Submissions</div>
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
    // Retain message so new participants receive current state immediately
    mqttClient.publish(TOPIC_STATE, payload, { retain: true, qos: 1 });
  }
}

// Boot
renderSurvey();
connectRealtime();
