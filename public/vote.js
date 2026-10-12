// Mobile Participant Voting Client Script
const serverParam = new URLSearchParams(window.location.search).get('server');
const socket = io(serverParam || window.location.origin);

// Persistent Voter ID
let voterId = localStorage.getItem('bodtum_voter_id');
if (!voterId) {
  voterId = 'voter_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  localStorage.setItem('bodtum_voter_id', voterId);
}

// State
let currentSurvey = null;
let currentQuestionId = null;
let selectedAnswer = null;
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

  // Check if locked
  if (!state.acceptingVotes) {
    activeQuestionView.style.display = 'none';
    votedFeedbackView.style.display = 'none';
    lockedView.style.display = 'block';
    return;
  } else {
    lockedView.style.display = 'none';
  }

  // Check if question changed
  if (currentQuestionId !== activeQ.id) {
    currentQuestionId = activeQ.id;
    selectedAnswer = null;
    voterSubmitBtn.disabled = true;

    // Check if voter already submitted for this question
    const storedVotes = JSON.parse(localStorage.getItem('bodtum_submitted_votes') || '{}');
    if (storedVotes[activeQ.id] !== undefined) {
      hasVotedCurrent = true;
      selectedAnswer = storedVotes[activeQ.id];
    } else {
      hasVotedCurrent = false;
    }
  }

  voterProgressTag.textContent = `Question ${state.activeQuestionIndex + 1} of ${state.totalQuestions}`;

  if (hasVotedCurrent) {
    showVotedScreen(activeQ);
    return;
  }

  // Show active question form
  activeQuestionView.style.display = 'block';
  votedFeedbackView.style.display = 'none';
  voterQTitle.textContent = activeQ.title;

  if (activeQ.type === 'single') {
    renderSingleOptions(activeQ.options);
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
        <div class="option-check">
          ${isSelected ? '✓' : ''}
        </div>
      </button>
    `;
  });
  html += '</div>';

  voterInputArea.innerHTML = html;

  // Click listeners
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

// Rating Options
function renderRatingOptions(q) {
  const labels = q.labels || ["Poor", "Fair", "Good", "Very Good", "Exceptional 🌟"];
  let html = `
    <div class="rating-row-interactive">
  `;
  for (let i = 1; i <= 5; i++) {
    const isActive = selectedAnswer === i;
    html += `
      <button type="button" class="star-btn ${isActive ? 'active' : ''}" data-val="${i}">
        <span class="star-icon">★</span>
        <span class="star-num">${i}</span>
      </button>
    `;
  }
  html += `
    </div>
    <div class="rating-label-hint" id="ratingHint">Tap a star to rate</div>
  `;

  voterInputArea.innerHTML = html;

  const starButtons = voterInputArea.querySelectorAll('.star-btn');
  const ratingHint = document.getElementById('ratingHint');

  starButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.getAttribute('data-val'), 10);
      selectedAnswer = val;
      starButtons.forEach(b => {
        const bVal = parseInt(b.getAttribute('data-val'), 10);
        if (bVal <= val) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });
      ratingHint.textContent = `${val} Star${val > 1 ? 's' : ''} - ${labels[val - 1]}`;
      voterSubmitBtn.disabled = false;
    });
  });
}

// Text Input Options
function renderTextInput(q) {
  voterInputArea.innerHTML = `
    <div class="word-input-container">
      <input type="text" id="voterTextInput" class="text-input-field" 
        placeholder="${escapeHtml(q.placeholder || 'Type your response here...')}" 
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
    if (e.key === 'Enter' && !voterSubmitBtn.disabled) {
      submitVote();
    }
  });

  setTimeout(() => input.focus(), 100);
}

// Submit Vote Handler
function submitVote() {
  if (!selectedAnswer || !currentQuestionId) return;

  voterSubmitBtn.disabled = true;
  voterSubmitBtn.textContent = 'Submitting...';

  // Save in local storage so refreshes don't lose status
  const storedVotes = JSON.parse(localStorage.getItem('bodtum_submitted_votes') || '{}');
  storedVotes[currentQuestionId] = selectedAnswer;
  localStorage.setItem('bodtum_submitted_votes', JSON.stringify(storedVotes));

  socket.emit('submit_vote', {
    questionId: currentQuestionId,
    answer: selectedAnswer,
    voterId: voterId
  });

  hasVotedCurrent = true;
  voterSubmitBtn.textContent = 'Submit Response 🚀';

  if (currentSurvey && currentSurvey.activeQuestion) {
    showVotedScreen(currentSurvey.activeQuestion);
  }
}

voterSubmitBtn.addEventListener('click', submitVote);

// Show Voted / Live Results Screen on Mobile
function showVotedScreen(q) {
  activeQuestionView.style.display = 'none';
  votedFeedbackView.style.display = 'block';

  renderMobileResults(q);
}

function renderMobileResults(q) {
  const results = q.results || {};

  if (q.type === 'single') {
    const breakdown = results.breakdown || [];
    let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
    breakdown.forEach(item => {
      const isMyChoice = selectedAnswer === item.id;
      html += `
        <div style="background: rgba(15,23,42,0.6); padding: 12px 14px; border-radius: 10px; border: 1px solid ${isMyChoice ? 'var(--secondary)' : 'var(--card-border)'};">
          <div style="display: flex; justify-content: space-between; font-size: 0.95rem; font-weight: 600; margin-bottom: 6px;">
            <span>${escapeHtml(item.text)} ${isMyChoice ? '⭐ (Your pick)' : ''}</span>
            <span style="color: var(--secondary);">${item.percentage}%</span>
          </div>
          <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 999px; overflow: hidden;">
            <div style="width: ${item.percentage}%; height: 100%; background: linear-gradient(90deg, var(--primary), var(--secondary)); border-radius: 999px;"></div>
          </div>
        </div>
      `;
    });
    html += '</div>';
    voterLiveResults.innerHTML = html;
  } else if (q.type === 'rating') {
    const avg = results.average || "0.0";
    voterLiveResults.innerHTML = `
      <div style="text-align: center; padding: 16px;">
        <div style="font-size: 2.8rem; font-weight: 800; color: var(--accent-amber);">${avg}</div>
        <div style="font-size: 0.9rem; color: var(--text-muted);">Current audience rating average</div>
        <div style="margin-top: 8px; font-size: 0.85rem; color: var(--text-dim);">Your rating: ${selectedAnswer} Stars</div>
      </div>
    `;
  } else if (q.type === 'wordcloud') {
    const words = results.words || [];
    let html = '<div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; padding: 10px 0;">';
    words.forEach(w => {
      html += `<span class="word-pill scale-1">${escapeHtml(w.word)} <span class="word-freq">${w.count}</span></span>`;
    });
    html += '</div>';
    voterLiveResults.innerHTML = html || '<div style="text-align: center; color: var(--text-dim); padding: 12px;">Responses are streaming in live on the main screen!</div>';
  }
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
  socket.emit('set_role', 'voter');
});

socket.on('survey_state', (state) => {
  renderQuestion(state);
});

socket.on('survey_updated', (state) => {
  renderQuestion(state);
  if (hasVotedCurrent && state.activeQuestion) {
    renderMobileResults(state.activeQuestion);
  }
});

socket.on('question_changed', (state) => {
  renderQuestion(state);
});

socket.on('voting_toggled', (data) => {
  if (currentSurvey) {
    currentSurvey.acceptingVotes = data.acceptingVotes;
    renderQuestion(currentSurvey);
  }
});
