// Mobile Participant Voting Client - BODTUM Yapay Zeka Canlı Anketi

// Multi-Broker List with Automatic Fallback
const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt'
];

// Read Room from URL
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room') || 'bodtum-default';

// Persistent Voter ID
let voterId = localStorage.getItem('bodtum_voter_id');
if (!voterId) {
  voterId = 'v_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  localStorage.setItem('bodtum_voter_id', voterId);
}

// State
let currentSurvey = null;
let currentQuestionId = null;
let selectedAnswer = null; // String (for single) or Array (for multi)
let hasVotedCurrent = false;

// DOM Elements
const voterProgressTag = document.getElementById('voterProgressTag');
const activeQuestionView = document.getElementById('activeQuestionView');
const votedFeedbackView = document.getElementById('votedFeedbackView');
const lockedView = document.getElementById('lockedView');
const voterQTitle = document.getElementById('voterQTitle');
const voterInputArea = document.getElementById('voterInputArea');
const voterSubmitBtn = document.getElementById('voterSubmitBtn');
const voterLiveResults = document.getElementById('voterLiveResults');

// Render Question Form
function renderQuestion(state) {
  currentSurvey = state;
  const activeQ = state.activeQuestion;
  if (!activeQ) return;

  // Locked state
  if (!state.acceptingVotes) {
    activeQuestionView.style.display = 'none';
    votedFeedbackView.style.display = 'none';
    lockedView.style.display = 'block';
    return;
  } else {
    lockedView.style.display = 'none';
  }

  // Question changed
  if (currentQuestionId !== activeQ.id) {
    currentQuestionId = activeQ.id;
    selectedAnswer = activeQ.type === 'multi' ? [] : null;
    voterSubmitBtn.disabled = true;

    const storedVotes = JSON.parse(localStorage.getItem(`bodtum_votes_${roomId}`) || '{}');
    if (storedVotes[activeQ.id] !== undefined) {
      hasVotedCurrent = true;
      selectedAnswer = storedVotes[activeQ.id];
    } else {
      hasVotedCurrent = false;
    }
  }

  voterProgressTag.textContent = `Soru ${state.activeQuestionIndex + 1} / ${state.totalQuestions}`;

  if (hasVotedCurrent) {
    showVotedScreen(activeQ);
    return;
  }

  activeQuestionView.style.display = 'block';
  votedFeedbackView.style.display = 'none';
  voterQTitle.innerHTML = activeQ.title + (activeQ.subtitle ? `<div class="voter-q-subtitle">${activeQ.subtitle}</div>` : '');

  if (activeQ.type === 'single') {
    renderSingleOptions(activeQ.options);
  } else if (activeQ.type === 'multi') {
    renderMultiOptions(activeQ.options);
  } else if (activeQ.type === 'rating') {
    renderRatingOptions(activeQ);
  } else if (activeQ.type === 'wordcloud') {
    renderTextInput(activeQ);
  }
}

// Single Choice Options
function renderSingleOptions(options) {
  let html = '<div class="options-grid">';
  options.forEach(opt => {
    const isSelected = selectedAnswer === opt.id;
    html += `
      <button type="button" class="option-btn ${isSelected ? 'selected' : ''}" data-id="${opt.id}">
        <span>${escapeHtml(opt.text)}</span>
        <div class="option-check">${isSelected ? '✓' : ''}</div>
      </button>
    `;
  });
  html += '</div>';
  voterInputArea.innerHTML = html;

  const buttons = voterInputArea.querySelectorAll('.option-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedAnswer = btn.getAttribute('data-id');
      buttons.forEach(b => {
        b.classList.remove('selected');
        b.querySelector('.option-check').textContent = '';
      });
      btn.classList.add('selected');
      btn.querySelector('.option-check').textContent = '✓';
      voterSubmitBtn.disabled = false;
    });
  });
}

// Multi Choice Options (Birden fazla seçilebilir)
function renderMultiOptions(options) {
  if (!Array.isArray(selectedAnswer)) selectedAnswer = [];

  let html = '<div class="options-grid">';
  options.forEach(opt => {
    const isSelected = selectedAnswer.includes(opt.id);
    html += `
      <button type="button" class="option-btn ${isSelected ? 'selected' : ''}" data-id="${opt.id}">
        <span>${escapeHtml(opt.text)}</span>
        <div class="option-check">${isSelected ? '✓' : ''}</div>
      </button>
    `;
  });
  html += '</div>';
  voterInputArea.innerHTML = html;

  const buttons = voterInputArea.querySelectorAll('.option-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const optId = btn.getAttribute('data-id');
      const idx = selectedAnswer.indexOf(optId);
      if (idx > -1) {
        selectedAnswer.splice(idx, 1);
        btn.classList.remove('selected');
        btn.querySelector('.option-check').textContent = '';
      } else {
        selectedAnswer.push(optId);
        btn.classList.add('selected');
        btn.querySelector('.option-check').textContent = '✓';
      }
      voterSubmitBtn.disabled = selectedAnswer.length === 0;
    });
  });
}

// Rating Options
function renderRatingOptions(q) {
  const labels = q.labels || ["Çok Kötü", "Gelişmeli", "İyi", "Çok İyi", "Harika 🌟"];
  let html = '<div class="rating-row-interactive">';
  for (let i = 1; i <= 5; i++) {
    html += `
      <button type="button" class="star-btn ${selectedAnswer === i ? 'active' : ''}" data-val="${i}">
        <span class="star-icon">★</span>
        <span class="star-num">${i}</span>
      </button>
    `;
  }
  html += '</div><div class="rating-label-hint" id="ratingHint">Puanlamak için bir yıldıza dokunun</div>';
  voterInputArea.innerHTML = html;

  const starButtons = voterInputArea.querySelectorAll('.star-btn');
  const ratingHint = document.getElementById('ratingHint');

  starButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.getAttribute('data-val'), 10);
      selectedAnswer = val;
      starButtons.forEach(b => {
        const bVal = parseInt(b.getAttribute('data-val'), 10);
        if (bVal <= val) b.classList.add('active');
        else b.classList.remove('active');
      });
      ratingHint.textContent = `${val} Yıldız - ${labels[val - 1]}`;
      voterSubmitBtn.disabled = false;
    });
  });
}

// Text Input Options
function renderTextInput(q) {
  voterInputArea.innerHTML = `
    <div class="word-input-container">
      <input type="text" id="voterTextInput" class="text-input-field" 
        placeholder="${escapeHtml(q.placeholder || 'Cevabınızı buraya yazın...')}" 
        maxlength="100" autocomplete="off" />
      <div style="font-size: 0.8rem; color: var(--text-dim); text-align: right;" id="charCount">0/100</div>
    </div>
  `;

  const input = document.getElementById('voterTextInput');
  const charCount = document.getElementById('charCount');

  input.addEventListener('input', () => {
    const val = input.value.trim();
    charCount.textContent = `${input.value.length}/100`;
    selectedAnswer = val;
    voterSubmitBtn.disabled = val.length === 0;
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !voterSubmitBtn.disabled) submitVote();
  });

  setTimeout(() => input.focus(), 150);
}

// Submit Vote
function submitVote() {
  if (!selectedAnswer || !currentQuestionId) return;
  if (Array.isArray(selectedAnswer) && selectedAnswer.length === 0) return;

  voterSubmitBtn.disabled = true;
  voterSubmitBtn.textContent = 'Gönderiliyor...';

  // Save vote locally
  const storedVotes = JSON.parse(localStorage.getItem(`bodtum_votes_${roomId}`) || '{}');
  storedVotes[currentQuestionId] = selectedAnswer;
  localStorage.setItem(`bodtum_votes_${roomId}`, JSON.stringify(storedVotes));

  // Publish to real-time relay
  publishVote(currentQuestionId, selectedAnswer);

  hasVotedCurrent = true;
  voterSubmitBtn.textContent = 'Cevabı Gönder 🚀';

  if (currentSurvey && currentSurvey.activeQuestion) {
    showVotedScreen(currentSurvey.activeQuestion);
  }
}

voterSubmitBtn.addEventListener('click', submitVote);

// Show Voted / Results Screen
function showVotedScreen(q) {
  activeQuestionView.style.display = 'none';
  votedFeedbackView.style.display = 'block';
  renderMobileResults(q);
}

function renderMobileResults(q) {
  const results = q.results || {};

  if (q.type === 'single' || q.type === 'multi') {
    const breakdown = results.breakdown || [];
    voterLiveResults.innerHTML = breakdown.map(item => {
      const isMyChoice = Array.isArray(selectedAnswer) ? selectedAnswer.includes(item.id) : selectedAnswer === item.id;
      return `
        <div style="background: rgba(15,23,42,0.6); padding: 12px 14px; border-radius: 10px; margin-bottom: 8px; border: 1px solid ${isMyChoice ? 'var(--secondary)' : 'var(--card-border)'};">
          <div style="display: flex; justify-content: space-between; font-size: 0.92rem; font-weight: 600; margin-bottom: 6px;">
            <span>${escapeHtml(item.text)} ${isMyChoice ? '⭐ (Seçiminiz)' : ''}</span>
            <span style="color: var(--secondary);">${item.percentage}%</span>
          </div>
          <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 999px; overflow: hidden;">
            <div style="width: ${item.percentage}%; height: 100%; background: linear-gradient(90deg, var(--primary), var(--secondary)); border-radius: 999px;"></div>
          </div>
        </div>
      `;
    }).join('');
  } else if (q.type === 'rating') {
    const avg = results.average || "0.0";
    voterLiveResults.innerHTML = `
      <div style="text-align: center; padding: 16px;">
        <div style="font-size: 2.8rem; font-weight: 800; color: var(--accent-amber);">${avg}</div>
        <div style="font-size: 0.9rem; color: var(--text-muted);">Ortalama Değerlendirme</div>
        <div style="margin-top: 8px; font-size: 0.85rem; color: var(--text-dim);">Sizin Puanınız: ${selectedAnswer} Yıldız</div>
      </div>
    `;
  } else if (q.type === 'wordcloud') {
    const words = results.words || [];
    voterLiveResults.innerHTML = words.length > 0
      ? `<div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; padding: 10px 0;">
          ${words.map(w => `<span class="word-pill scale-1">${escapeHtml(w.word)} <span class="word-freq">${w.count}</span></span>`).join('')}
         </div>`
      : '<div style="text-align: center; color: var(--text-dim); padding: 12px;">Cevaplar ana ekrana canlı olarak akmaktadır!</div>';
  }
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
    clientId: 'voter_' + Math.random().toString(36).substring(2, 9),
    keepalive: 30,
    reconnectPeriod: 2000
  });

  mqttClient.on('connect', () => {
    voterProgressTag.textContent = '🟢 Canlı Bağlandı';
    mqttClient.subscribe(TOPIC_STATE);
    mqttClient.publish(TOPIC_JOIN, JSON.stringify({ voterId }));
  });

  mqttClient.on('message', (topic, message) => {
    try {
      if (topic === TOPIC_STATE) {
        const state = JSON.parse(message.toString());
        renderQuestion(state);
      }
    } catch (e) {
      console.error('Error handling state message:', e);
    }
  });

  mqttClient.on('error', () => {
    mqttClient.end(true);
    connectRealtime(brokerIndex + 1);
  });
}

function publishVote(questionId, answer) {
  if (mqttClient && mqttClient.connected) {
    const payload = JSON.stringify({ questionId, answer, voterId });
    mqttClient.publish(TOPIC_VOTE, payload, { qos: 1 });
  }
}

// Boot
connectRealtime();
