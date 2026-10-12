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
let isLiveActive = false;
let liveCheckTimer = null;

// DOM Elements
const voterProgressTag = document.getElementById('voterProgressTag');
const surveyLoadingView = document.getElementById('surveyLoadingView');
const surveyInactiveView = document.getElementById('surveyInactiveView');
const activeQuestionView = document.getElementById('activeQuestionView');
const votedFeedbackView = document.getElementById('votedFeedbackView');
const lockedView = document.getElementById('lockedView');
const voterQTitle = document.getElementById('voterQTitle');
const voterInputArea = document.getElementById('voterInputArea');
const voterSubmitBtn = document.getElementById('voterSubmitBtn');
const voterLiveResults = document.getElementById('voterLiveResults');
const retryConnectionBtn = document.getElementById('retryConnectionBtn');
const inactiveRoomCode = document.getElementById('inactiveRoomCode');

if (inactiveRoomCode) {
  inactiveRoomCode.textContent = roomId;
}

// Show Inactive State Screen
function showInactiveScreen() {
  isLiveActive = false;
  if (surveyLoadingView) surveyLoadingView.style.display = 'none';
  if (activeQuestionView) activeQuestionView.style.display = 'none';
  if (votedFeedbackView) votedFeedbackView.style.display = 'none';
  if (lockedView) lockedView.style.display = 'none';
  if (surveyInactiveView) surveyInactiveView.style.display = 'block';

  voterProgressTag.textContent = 'Oturum Aktif Değil';
  voterProgressTag.style.color = 'var(--status-amber)';
}

// Start Liveness Timeout
function startLiveDetectionTimer(ms = 4000) {
  if (liveCheckTimer) clearTimeout(liveCheckTimer);
  liveCheckTimer = setTimeout(() => {
    if (!isLiveActive) {
      showInactiveScreen();
    }
  }, ms);
}

// Reset client state when survey host resets
function performClientReset(newEpoch) {
  if (newEpoch) {
    localStorage.setItem(`bodtum_reset_epoch_${roomId}`, newEpoch.toString());
  }
  localStorage.removeItem(`bodtum_votes_${roomId}`);
  hasVotedCurrent = false;
  selectedAnswer = null;
  currentQuestionId = null;
  voterSubmitBtn.disabled = true;
  voterSubmitBtn.textContent = 'Cevabı Gönder';
}

// Render Question Form
function renderQuestion(state) {
  currentSurvey = state;
  isLiveActive = true;

  if (surveyLoadingView) surveyLoadingView.style.display = 'none';
  if (surveyInactiveView) surveyInactiveView.style.display = 'none';
  voterProgressTag.style.color = '';

  const activeQ = state.activeQuestion;
  if (!activeQ) {
    showInactiveScreen();
    return;
  }

  // Handle Host Reset (detect change in resetEpoch)
  const incomingEpoch = state.resetEpoch ? state.resetEpoch.toString() : null;
  const storedEpoch = localStorage.getItem(`bodtum_reset_epoch_${roomId}`);
  if (incomingEpoch && storedEpoch && incomingEpoch !== storedEpoch) {
    performClientReset(incomingEpoch);
  } else if (incomingEpoch && !storedEpoch) {
    localStorage.setItem(`bodtum_reset_epoch_${roomId}`, incomingEpoch);
  }

  // Locked state
  if (!state.acceptingVotes) {
    activeQuestionView.style.display = 'none';
    votedFeedbackView.style.display = 'none';
    lockedView.style.display = 'block';
    voterProgressTag.textContent = `Soru ${state.activeQuestionIndex + 1} / ${state.totalQuestions} (Kilitli)`;
    return;
  } else {
    lockedView.style.display = 'none';
  }

  // Question changed or reset
  if (currentQuestionId !== activeQ.id) {
    currentQuestionId = activeQ.id;
    selectedAnswer = activeQ.type === 'multi' ? [] : null;
    voterSubmitBtn.disabled = true;
    voterSubmitBtn.textContent = 'Cevabı Gönder';

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
  voterQTitle.textContent = activeQ.title;
  const subEl = document.getElementById('voterQSubtitle');
  if (subEl) {
    subEl.textContent = activeQ.subtitle || '';
    subEl.style.display = activeQ.subtitle ? 'block' : 'none';
  }

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
  let html = '';
  options.forEach(opt => {
    const isSelected = selectedAnswer === opt.id;
    html += `
      <button type="button" class="voter-opt-btn ${isSelected ? 'selected' : ''}" data-id="${opt.id}">
        <span>${escapeHtml(opt.text)}</span>
        <div class="opt-circle">${isSelected ? '✓' : ''}</div>
      </button>
    `;
  });
  voterInputArea.innerHTML = html;

  const buttons = voterInputArea.querySelectorAll('.voter-opt-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedAnswer = btn.getAttribute('data-id');
      buttons.forEach(b => {
        b.classList.remove('selected');
        b.querySelector('.opt-circle').textContent = '';
      });
      btn.classList.add('selected');
      btn.querySelector('.opt-circle').textContent = '✓';
      voterSubmitBtn.disabled = false;
    });
  });
}

// Multi Choice Options (Birden fazla seçilebilir)
function renderMultiOptions(options) {
  if (!Array.isArray(selectedAnswer)) selectedAnswer = [];

  let html = '';
  options.forEach(opt => {
    const isSelected = selectedAnswer.includes(opt.id);
    html += `
      <button type="button" class="voter-opt-btn ${isSelected ? 'selected' : ''}" data-id="${opt.id}">
        <span>${escapeHtml(opt.text)}</span>
        <div class="opt-circle">${isSelected ? '✓' : ''}</div>
      </button>
    `;
  });
  voterInputArea.innerHTML = html;

  const buttons = voterInputArea.querySelectorAll('.voter-opt-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const optId = btn.getAttribute('data-id');
      const idx = selectedAnswer.indexOf(optId);
      if (idx > -1) {
        selectedAnswer.splice(idx, 1);
        btn.classList.remove('selected');
        btn.querySelector('.opt-circle').textContent = '';
      } else {
        selectedAnswer.push(optId);
        btn.classList.add('selected');
        btn.querySelector('.opt-circle').textContent = '✓';
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
        <div style="background: var(--surface-raised); padding: 12px 14px; border-radius: var(--radius-md); margin-bottom: 8px; border: 1px solid ${isMyChoice ? 'var(--accent-blue)' : 'var(--border)'};">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; font-weight: 500; margin-bottom: 8px;">
            <span style="color: ${isMyChoice ? '#fff' : 'var(--text-secondary)'};">${escapeHtml(item.text)} ${isMyChoice ? '<span style="color: var(--accent-blue); font-size: 0.75rem; margin-left: 4px;">● Seçiminiz</span>' : ''}</span>
            <span style="font-weight: 600; color: #fff; font-feature-settings: 'tnum';">${item.percentage}%</span>
          </div>
          <div style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 999px; overflow: hidden;">
            <div style="width: ${item.percentage}%; height: 100%; background: var(--accent-blue); border-radius: 999px; transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);"></div>
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
const TOPIC_RESET = `bodtum/survey/${roomId}/reset`;
const TOPIC_PING = `bodtum/survey/${roomId}/ping`;

function publishPing() {
  if (mqttClient && mqttClient.connected) {
    mqttClient.publish(TOPIC_PING, JSON.stringify({ voterId, t: Date.now() }));
  }
}

function connectRealtime(brokerIndex = 0) {
  if (brokerIndex >= BROKERS.length) {
    showInactiveScreen();
    return;
  }
  const url = BROKERS[brokerIndex];

  mqttClient = mqtt.connect(url, {
    clientId: 'voter_' + Math.random().toString(36).substring(2, 9),
    keepalive: 30,
    reconnectPeriod: 2000
  });

  mqttClient.on('connect', () => {
    if (!isLiveActive) {
      voterProgressTag.textContent = 'Bağlandı, aranıyor...';
    }
    mqttClient.subscribe(TOPIC_STATE);
    mqttClient.subscribe(TOPIC_RESET);
    mqttClient.publish(TOPIC_JOIN, JSON.stringify({ voterId, t: Date.now() }));
    publishPing();
    startLiveDetectionTimer(4200);
  });

  mqttClient.on('message', (topic, message) => {
    try {
      if (topic === TOPIC_STATE) {
        const state = JSON.parse(message.toString());

        // 1. Explicitly inactive / session closed
        if (state.isLive === false) {
          showInactiveScreen();
          return;
        }

        // 2. Check for stale retained messages from hours or days ago
        const now = Date.now();
        const isStale = state.timestamp && (now - state.timestamp > 45000);

        if (isStale) {
          console.warn('Received stale retained survey state from past session. Pinging presenter...');
          publishPing();
          if (!isLiveActive && !liveCheckTimer) {
            startLiveDetectionTimer(2500);
          }
          return;
        }

        // 3. Verified live and active!
        if (liveCheckTimer) {
          clearTimeout(liveCheckTimer);
          liveCheckTimer = null;
        }
        renderQuestion(state);
      } else if (topic === TOPIC_RESET) {
        const resetData = JSON.parse(message.toString());
        performClientReset(resetData.resetEpoch);
        if (currentSurvey) {
          renderQuestion(currentSurvey);
        }
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

function publishVote(questionId, answer) {
  if (mqttClient && mqttClient.connected) {
    const payload = JSON.stringify({ questionId, answer, voterId });
    mqttClient.publish(TOPIC_VOTE, payload, { qos: 1 });
  }
}

// Retry Connection Button
if (retryConnectionBtn) {
  retryConnectionBtn.addEventListener('click', () => {
    retryConnectionBtn.classList.add('checking');
    voterProgressTag.textContent = 'Kontrol ediliyor...';
    voterProgressTag.style.color = '';

    publishPing();
    if (mqttClient && mqttClient.connected) {
      mqttClient.publish(TOPIC_JOIN, JSON.stringify({ voterId, t: Date.now() }));
    }

    startLiveDetectionTimer(3000);

    setTimeout(() => {
      retryConnectionBtn.classList.remove('checking');
      if (!isLiveActive) {
        voterProgressTag.textContent = 'Oturum Aktif Değil';
        voterProgressTag.style.color = 'var(--status-amber)';
      }
    }, 2000);
  });
}

// Boot
startLiveDetectionTimer(5000);
connectRealtime();

