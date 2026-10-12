// Presenter Dashboard Client Script
const serverParam = new URLSearchParams(window.location.search).get('server');
const socket = io(serverParam || window.location.origin);

// Audio Chime Synthesizer using Web Audio API
class AudioNotifier {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
  }

  playVoteChime() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      // Pleasant bright marimba chime: 659.25Hz (E5) gliding to 880Hz (A5)
      osc.frequency.setValueAtTime(659.25, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880.00, this.ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }
}

const notifier = new AudioNotifier();

// State
let currentSurvey = null;

// DOM Elements
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

// Modal Elements
const questionModal = document.getElementById('questionModal');
const newQuestionForm = document.getElementById('newQuestionForm');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalQType = document.getElementById('modalQType');
const modalOptionsGroup = document.getElementById('modalOptionsGroup');

// Initialize Connection Info & QR Code
async function loadConnectionInfo() {
  try {
    const res = await fetch('/api/info');
    const data = await res.json();
    if (data.qrDataUrl) {
      qrImage.src = data.qrDataUrl;
    }
    if (data.joinUrl) {
      joinUrlText.textContent = data.joinUrl;
      joinUrlText.title = data.joinUrl;
    }
  } catch (err) {
    console.error('Failed to load connection info:', err);
    joinUrlText.textContent = `${window.location.origin}/vote`;
    qrImage.src = `/api/qr?url=${encodeURIComponent(window.location.origin + '/vote')}`;
  }
}

// Copy URL handler
copyUrlBtn.addEventListener('click', () => {
  const url = joinUrlText.textContent;
  navigator.clipboard.writeText(url).then(() => {
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

// Open Simulator Drawer
openSimulatorBtn.addEventListener('click', () => {
  simulatorDrawer.classList.toggle('hidden');
  if (!simulatorDrawer.classList.contains('hidden')) {
    simulatorFrame.src = './vote.html?sim=' + Date.now();
  }
});

closeSimulatorBtn.addEventListener('click', () => {
  simulatorDrawer.classList.add('hidden');
});

openTabBtn.addEventListener('click', () => {
  window.open('./vote.html', '_blank');
});

// Add Question Modal Type Toggle
modalQType.addEventListener('change', () => {
  if (modalQType.value === 'single') {
    modalOptionsGroup.style.display = 'block';
  } else {
    modalOptionsGroup.style.display = 'none';
  }
});

addQuestionBtn.addEventListener('click', () => {
  questionModal.showModal();
});

modalCancelBtn.addEventListener('click', () => {
  questionModal.close();
});

newQuestionForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = document.getElementById('modalQTitle').value.trim();
  const type = modalQType.value;
  const optionsText = document.getElementById('modalQOptions').value;
  const options = optionsText
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  if (!title) return;

  socket.emit('add_question', {
    title,
    type,
    options: type === 'single' ? (options.length ? options : ['Option 1', 'Option 2']) : []
  });

  newQuestionForm.reset();
  questionModal.close();
});

// Reset Survey
resetBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all responses for all questions?')) {
    fetch('/api/survey/reset', { method: 'POST' });
  }
});

// Lock Voting
toggleLockBtn.addEventListener('click', () => {
  if (!currentSurvey) return;
  socket.emit('toggle_voting', !currentSurvey.acceptingVotes);
});

// Navigation
prevBtn.addEventListener('click', () => {
  if (!currentSurvey) return;
  if (currentSurvey.activeQuestionIndex > 0) {
    socket.emit('change_question', currentSurvey.activeQuestionIndex - 1);
  }
});

nextBtn.addEventListener('click', () => {
  if (!currentSurvey) return;
  if (currentSurvey.activeQuestionIndex < currentSurvey.totalQuestions - 1) {
    socket.emit('change_question', currentSurvey.activeQuestionIndex + 1);
  }
});

// Render Dynamic Question & Results
function renderSurvey(state) {
  currentSurvey = state;
  const activeQ = state.activeQuestion;
  if (!activeQ) return;

  // Header tags
  qIndexTag.textContent = `Question ${state.activeQuestionIndex + 1} of ${state.totalQuestions}`;
  qTypeTag.textContent = activeQ.type === 'single' ? 'Multiple Choice' : (activeQ.type === 'rating' ? 'Star Rating' : 'Live Word Stream');
  qTitle.textContent = activeQ.title;
  qVoteTotal.textContent = activeQ.votesCount || 0;

  // Lock status
  if (!state.acceptingVotes) {
    lockStatusBadge.style.display = 'inline-flex';
    toggleLockBtn.textContent = '🔓 Unlock Voting';
  } else {
    lockStatusBadge.style.display = 'none';
    toggleLockBtn.textContent = '🔒 Lock Voting';
  }

  // Navigation button states
  prevBtn.disabled = state.activeQuestionIndex === 0;
  prevBtn.style.opacity = state.activeQuestionIndex === 0 ? '0.4' : '1';
  
  if (state.activeQuestionIndex === state.totalQuestions - 1) {
    nextBtn.textContent = 'Completed (Add More)';
  } else {
    nextBtn.textContent = 'Next Question ▶';
  }

  // Render question visualization based on type
  const results = activeQ.results || {};

  if (activeQ.type === 'single') {
    renderSingleChoiceResults(results);
  } else if (activeQ.type === 'rating') {
    renderRatingResults(results);
  } else if (activeQ.type === 'wordcloud') {
    renderWordCloudResults(results);
  }
}

// Single Choice Chart
function renderSingleChoiceResults(results) {
  const breakdown = results.breakdown || [];
  if (breakdown.length === 0) {
    resultsContainer.innerHTML = `
      <div class="empty-state">
        <p>No options available.</p>
      </div>`;
    return;
  }

  // Find max votes to mark leader
  let maxCount = 0;
  breakdown.forEach(b => {
    if (b.count > maxCount) maxCount = b.count;
  });

  const html = breakdown.map(item => {
    const isLead = maxCount > 0 && item.count === maxCount;
    return `
      <div class="option-result-row ${item.count > 0 ? 'has-votes' : ''}">
        <div class="result-bar-fill ${isLead ? 'lead-option' : ''}" style="width: ${item.percentage}%;"></div>
        <div class="result-content">
          <div class="option-label-text">${escapeHtml(item.text)}</div>
          <div class="option-stats">
            <span class="option-count-badge">${item.count} ${item.count === 1 ? 'vote' : 'votes'}</span>
            <span class="option-percentage">${item.percentage}%</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  resultsContainer.innerHTML = html;
}

// Rating Chart
function renderRatingResults(results) {
  const avg = results.average || "0.0";
  const total = results.totalVotes || 0;
  const breakdown = results.breakdown || [];

  const starCount = Math.round(parseFloat(avg));
  const starIcons = [1, 2, 3, 4, 5].map(i => i <= starCount ? '★' : '☆').join('');

  const barsHtml = breakdown.slice().reverse().map(item => `
    <div class="rating-bar-item">
      <div class="rating-bar-label">${item.rating} Stars (${item.label})</div>
      <div class="rating-track">
        <div class="rating-fill" style="width: ${item.percentage}%;"></div>
      </div>
      <span style="font-size: 0.85rem; font-weight: 700; min-width: 40px; text-align: right;">${item.percentage}%</span>
      <span style="font-size: 0.78rem; color: var(--text-dim); min-width: 35px;">(${item.count})</span>
    </div>
  `).join('');

  resultsContainer.innerHTML = `
    <div class="rating-summary-card">
      <div class="rating-score-box">
        <div class="rating-big-number">${avg}</div>
        <div class="rating-stars-row">${starIcons}</div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">${total} total ratings</div>
      </div>
      <div class="rating-bars-list">
        ${barsHtml}
      </div>
    </div>
  `;
}

// Word Cloud & Recent Comments
function renderWordCloudResults(results) {
  const words = results.words || [];
  const entries = results.recentEntries || [];

  if (words.length === 0 && entries.length === 0) {
    resultsContainer.innerHTML = `
      <div class="empty-state">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
        </svg>
        <p>Waiting for participants to submit their ideas and feedback...</p>
      </div>`;
    return;
  }

  // Word tags
  const maxCount = words[0] ? words[0].count : 1;
  const wordsHtml = words.map(w => {
    let scaleClass = 'scale-1';
    const ratio = w.count / maxCount;
    if (ratio >= 0.75) scaleClass = 'scale-4';
    else if (ratio >= 0.5) scaleClass = 'scale-3';
    else if (ratio >= 0.25) scaleClass = 'scale-2';

    return `
      <span class="word-pill ${scaleClass}">
        ${escapeHtml(w.word)}
        <span class="word-freq">${w.count}</span>
      </span>
    `;
  }).join('');

  // Recent cards
  const streamHtml = entries.map(e => `
    <div class="text-entry-card">
      “${escapeHtml(e.text)}”
    </div>
  `).join('');

  resultsContainer.innerHTML = `
    <div class="wordcloud-container">
      <div class="words-cloud-pills">
        ${wordsHtml || '<span style="color: var(--text-dim);">No keywords yet</span>'}
      </div>
      <div>
        <div class="live-feed-header">Recent Live Submissions</div>
        <div class="live-text-stream" style="margin-top: 10px;">
          ${streamHtml}
        </div>
      </div>
    </div>
  `;
}

// Utility
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Socket Events
socket.on('connect', () => {
  socket.emit('set_role', 'presenter');
});

socket.on('participants_count', (count) => {
  participantCount.textContent = count;
});

socket.on('survey_state', (state) => {
  renderSurvey(state);
});

socket.on('survey_updated', (state) => {
  renderSurvey(state);
});

socket.on('question_changed', (state) => {
  renderSurvey(state);
});

socket.on('vote_recorded', () => {
  notifier.playVoteChime();
});

// Initial boot
loadConnectionInfo();
