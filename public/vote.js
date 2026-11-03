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
let userQuestionIndex = 0;
let viewingCompleted = false;
let editingAnswer = false;
let selectedAnswer = null; // String (single), Array (multi), Number (scale/rating), String (text)
let initialQuestionSet = false;
let isLiveActive = false;
let liveCheckTimer = null;
let justVoted = false;

// DOM Elements
const voterProgressTag = document.getElementById('voterProgressTag');
const voterStepperContainer = document.getElementById('voterStepperContainer');
const questionStepper = document.getElementById('questionStepper');

const surveyLoadingView = document.getElementById('surveyLoadingView');
const surveyInactiveView = document.getElementById('surveyInactiveView');
const inactiveRoomCode = document.getElementById('inactiveRoomCode');
const retryConnectionBtn = document.getElementById('retryConnectionBtn');

const activeQuestionView = document.getElementById('activeQuestionView');
const voterQIndexTag = document.getElementById('voterQIndexTag');
const onStageBadge = document.getElementById('onStageBadge');
const voterQTitle = document.getElementById('voterQTitle');
const voterQSubtitle = document.getElementById('voterQSubtitle');
const voterInputArea = document.getElementById('voterInputArea');
const voterSubmitBtn = document.getElementById('voterSubmitBtn');
const voterNavRow = document.getElementById('voterNavRow');
const voterPrevBtn = document.getElementById('voterPrevBtn');
const voterNextBtn = document.getElementById('voterNextBtn');

const votedFeedbackView = document.getElementById('votedFeedbackView');
const feedbackTitle = document.getElementById('feedbackTitle');
const feedbackSubtitle = document.getElementById('feedbackSubtitle');
const feedbackNextActionBtn = document.getElementById('feedbackNextActionBtn');
const feedbackChangeVoteBtn = document.getElementById('feedbackChangeVoteBtn');
const feedbackPrevBtn = document.getElementById('feedbackPrevBtn');
const voterLiveResults = document.getElementById('voterLiveResults');

const surveyCompletedView = document.getElementById('surveyCompletedView');
const completedSummaryList = document.getElementById('completedSummaryList');
const lockedView = document.getElementById('lockedView');

if (inactiveRoomCode) {
  inactiveRoomCode.textContent = roomId;
}

// Local Storage Helpers
function getStoredVotes() {
  try {
    return JSON.parse(localStorage.getItem(`bodtum_votes_${roomId}`) || '{}');
  } catch (e) {
    return {};
  }
}

function saveStoredVote(questionId, answer) {
  const stored = getStoredVotes();
  stored[questionId] = answer;
  localStorage.setItem(`bodtum_votes_${roomId}`, JSON.stringify(stored));
}

// Show Inactive State Screen
function showInactiveScreen() {
  isLiveActive = false;
  if (surveyLoadingView) surveyLoadingView.style.display = 'none';
  if (voterStepperContainer) voterStepperContainer.style.display = 'none';
  if (activeQuestionView) activeQuestionView.style.display = 'none';
  if (votedFeedbackView) votedFeedbackView.style.display = 'none';
  if (surveyCompletedView) surveyCompletedView.style.display = 'none';
  if (lockedView) lockedView.style.display = 'none';
  if (surveyInactiveView) surveyInactiveView.style.display = 'block';

  voterProgressTag.textContent = 'Oturum Aktif Değil';
  voterProgressTag.style.color = 'var(--status-amber)';
}

// Start Liveness Timeout
function startLiveDetectionTimer(ms = 4500) {
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
  userQuestionIndex = 0;
  viewingCompleted = false;
  editingAnswer = false;
  selectedAnswer = null;
  initialQuestionSet = false;
  justVoted = false;
  if (voterSubmitBtn) {
    voterSubmitBtn.disabled = true;
    voterSubmitBtn.textContent = 'Cevabı Gönder';
  }
}

// Validate selection based on question type
function hasValidSelection(type, val) {
  if (val === null || val === undefined) return false;
  if (type === 'single') return typeof val === 'string' && val.length > 0;
  if (type === 'multi') return Array.isArray(val) && val.length > 0;
  if (type === 'scale') return typeof val === 'number' && val >= 1 && val <= 5;
  if (type === 'rating') return typeof val === 'number' && val >= 1 && val <= 5;
  if (type === 'wordcloud') return typeof val === 'string' && val.trim().length > 0;
  return false;
}

// Get array of all questions from state
function getSurveyQuestions(state) {
  if (!state) return [];
  if (Array.isArray(state.questions) && state.questions.length > 0) {
    return state.questions;
  }
  if (state.activeQuestion) {
    return [state.activeQuestion];
  }
  return [];
}

// Main handler for incoming survey state
function handleSurveyState(state) {
  currentSurvey = state;
  isLiveActive = true;

  if (surveyLoadingView) surveyLoadingView.style.display = 'none';
  if (surveyInactiveView) surveyInactiveView.style.display = 'none';
  voterProgressTag.style.color = '';

  // Handle Host Reset
  const incomingEpoch = state.resetEpoch ? state.resetEpoch.toString() : null;
  const storedEpoch = localStorage.getItem(`bodtum_reset_epoch_${roomId}`);
  if (incomingEpoch && storedEpoch && incomingEpoch !== storedEpoch) {
    performClientReset(incomingEpoch);
  } else if (incomingEpoch && !storedEpoch) {
    localStorage.setItem(`bodtum_reset_epoch_${roomId}`, incomingEpoch);
  }

  // Locked state
  if (!state.acceptingVotes) {
    if (voterStepperContainer) voterStepperContainer.style.display = 'none';
    if (activeQuestionView) activeQuestionView.style.display = 'none';
    if (votedFeedbackView) votedFeedbackView.style.display = 'none';
    if (surveyCompletedView) surveyCompletedView.style.display = 'none';
    if (lockedView) lockedView.style.display = 'block';
    voterProgressTag.textContent = 'Oylama Kilitli';
    return;
  } else {
    if (lockedView) lockedView.style.display = 'none';
  }

  const questions = getSurveyQuestions(state);
  if (questions.length === 0) {
    showInactiveScreen();
    return;
  }

  const storedVotes = getStoredVotes();

  // On first connection, advance to first unanswered question or completion
  if (!initialQuestionSet) {
    const firstUnanswered = questions.findIndex(q => storedVotes[q.id] === undefined);
    if (firstUnanswered === -1) {
      viewingCompleted = true;
      userQuestionIndex = 0;
    } else {
      userQuestionIndex = firstUnanswered;
      viewingCompleted = false;
    }
    initialQuestionSet = true;
  }

  // Keep index within bounds
  if (userQuestionIndex >= questions.length) {
    userQuestionIndex = Math.max(0, questions.length - 1);
  }

  renderCurrentView();
}

// Render Stepper Navigation
function renderStepper(questions, storedVotes) {
  if (!voterStepperContainer || !questionStepper) return;
  voterStepperContainer.style.display = 'block';

  const allAnswered = questions.every(q => storedVotes[q.id] !== undefined);

  let html = '';
  questions.forEach((q, idx) => {
    const isAnswered = storedVotes[q.id] !== undefined;
    const isActive = !viewingCompleted && userQuestionIndex === idx;
    const classes = ['step-chip'];
    if (isAnswered) classes.push('completed');
    if (isActive) classes.push('active');

    html += `
      <button type="button" class="${classes.join(' ')}" data-index="${idx}">
        ${isAnswered ? '<span class="step-check">✓</span>' : ''}
        <span>Soru ${idx + 1}</span>
      </button>
    `;
  });

  if (allAnswered) {
    const isSummaryActive = viewingCompleted;
    html += `
      <button type="button" class="step-chip ${isSummaryActive ? 'active' : ''}" id="summaryTabBtn" style="border-style: dashed;">
        <span>🎉 Özet</span>
      </button>
    `;
  }

  questionStepper.innerHTML = html;

  questionStepper.querySelectorAll('.step-chip[data-index]').forEach(chip => {
    chip.addEventListener('click', () => {
      const targetIndex = parseInt(chip.getAttribute('data-index'), 10);
      userQuestionIndex = targetIndex;
      viewingCompleted = false;
      editingAnswer = false;
      justVoted = false;
      renderCurrentView();
    });
  });

  const summaryBtn = questionStepper.querySelector('#summaryTabBtn');
  if (summaryBtn) {
    summaryBtn.addEventListener('click', () => {
      viewingCompleted = true;
      editingAnswer = false;
      justVoted = false;
      renderCurrentView();
    });
  }
}

// Render Active View
function renderCurrentView(fromVoteSubmit = false) {
  if (!currentSurvey) return;

  const questions = getSurveyQuestions(currentSurvey);
  const storedVotes = getStoredVotes();
  const allAnswered = questions.length > 0 && questions.every(q => storedVotes[q.id] !== undefined);
  const answeredCount = questions.filter(q => storedVotes[q.id] !== undefined).length;

  // Header progress pill
  if (viewingCompleted || allAnswered) {
    voterProgressTag.textContent = `${answeredCount} / ${questions.length} Tamamlandı ✓`;
  } else {
    voterProgressTag.textContent = `Soru ${userQuestionIndex + 1} / ${questions.length} (${answeredCount} Yanıtlandı)`;
  }

  renderStepper(questions, storedVotes);

  // VIEW 1: All Questions Completed Screen
  if (viewingCompleted) {
    if (activeQuestionView) activeQuestionView.style.display = 'none';
    if (votedFeedbackView) votedFeedbackView.style.display = 'none';
    if (surveyCompletedView) surveyCompletedView.style.display = 'block';
    renderCompletedSummary(questions, storedVotes);
    return;
  }

  if (surveyCompletedView) surveyCompletedView.style.display = 'none';
  if (votedFeedbackView) votedFeedbackView.style.display = 'none';

  const q = questions[userQuestionIndex];
  if (!q) return;

  const hasAnswer = storedVotes[q.id] !== undefined;

  // Active Question View (Direct question view for both fresh & review states)
  if (activeQuestionView) activeQuestionView.style.display = 'block';

  if (voterQIndexTag) voterQIndexTag.textContent = `Soru ${userQuestionIndex + 1} / ${questions.length}`;

  // Stage sync indicator
  if (onStageBadge) {
    if (currentSurvey.activeQuestionIndex === userQuestionIndex) {
      onStageBadge.style.display = 'inline-flex';
    } else {
      onStageBadge.style.display = 'none';
    }
  }

  if (voterQTitle) voterQTitle.textContent = q.title;
  if (voterQSubtitle) {
    voterQSubtitle.textContent = q.subtitle || '';
    voterQSubtitle.style.display = q.subtitle ? 'block' : 'none';
  }

  // Set initial selected answer if question already answered or fresh
  if (hasAnswer) {
    selectedAnswer = Array.isArray(storedVotes[q.id]) 
      ? [...storedVotes[q.id]] 
      : storedVotes[q.id];
    voterSubmitBtn.textContent = 'Yanıtı Güncelle ✓';
    voterSubmitBtn.disabled = false;
  } else {
    selectedAnswer = q.type === 'multi' ? [] : null;
    voterSubmitBtn.textContent = 'Cevabı Gönder';
    voterSubmitBtn.disabled = true;
  }

  // Render question inputs
  if (q.type === 'single') {
    renderSingleOptions(q.options || []);
  } else if (q.type === 'multi') {
    renderMultiOptions(q.options || []);
  } else if (q.type === 'scale') {
    renderScaleOptions(q);
  } else if (q.type === 'rating') {
    renderRatingOptions(q);
  } else if (q.type === 'wordcloud') {
    renderTextInput(q);
  }

  // Nav buttons (Previous question only, if needed to go back)
  if (voterPrevBtn) {
    if (userQuestionIndex > 0) {
      voterPrevBtn.style.display = 'inline-flex';
      voterPrevBtn.onclick = () => {
        userQuestionIndex--;
        editingAnswer = false;
        justVoted = false;
        renderCurrentView();
      };
    } else {
      voterPrevBtn.style.display = 'none';
    }
  }

  if (voterNextBtn) {
    voterNextBtn.style.display = 'none';
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

// Multi Choice Options
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

// Linear Scale Options (1 to 5 Spectrum)
function renderScaleOptions(q) {
  const labels = q.scaleLabels || [
    "1 - Kesinlikle Tehdit",
    "2 - Tehdit Ağırlıklı",
    "3 - Kullanım Amacına Bağlı",
    "4 - Fırsat Ağırlıklı",
    "5 - Kesinlikle Büyük Fırsat"
  ];
  const currentVal = typeof selectedAnswer === 'number' ? selectedAnswer : null;

  let html = `
    <div class="scale-voter-wrapper">
      <div class="scale-btn-grid">
  `;

  for (let i = 1; i <= 5; i++) {
    const isSel = currentVal === i;
    html += `
      <button type="button" class="scale-choice-btn ${isSel ? 'selected' : ''}" data-val="${i}">
        <span class="scale-num">${i}</span>
      </button>
    `;
  }

  html += `
      </div>
      <div class="scale-voter-anchors">
        <span class="anchor-tag left">← ${escapeHtml(q.leftLabel || 'Düşük')}</span>
        <span class="anchor-tag center">${escapeHtml(q.centerLabel || 'Dengeli')}</span>
        <span class="anchor-tag right">${escapeHtml(q.rightLabel || 'Yüksek')} →</span>
      </div>
      <div class="scale-hint-box ${currentVal ? 'active' : ''}" id="scaleHintText">
        ${currentVal ? labels[currentVal - 1] : 'Değerlendirmek için 1-5 arasında bir puan seçin'}
      </div>
    </div>
  `;

  voterInputArea.innerHTML = html;

  const buttons = voterInputArea.querySelectorAll('.scale-choice-btn');
  const hintEl = document.getElementById('scaleHintText');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.getAttribute('data-val'), 10);
      selectedAnswer = val;
      buttons.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      if (hintEl) {
        hintEl.textContent = labels[val - 1] || `${val} Puan`;
        hintEl.classList.add('active');
      }
      voterSubmitBtn.disabled = false;
    });
  });
}

// Rating Options (1 to 5 Stars)
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
  const currentHint = selectedAnswer ? `${selectedAnswer} Yıldız - ${labels[selectedAnswer - 1]}` : 'Puanlamak için bir yıldıza dokunun';
  html += `</div><div class="rating-label-hint" id="ratingHint">${currentHint}</div>`;
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
  const currentVal = selectedAnswer || '';
  voterInputArea.innerHTML = `
    <div class="word-input-container">
      <input type="text" id="voterTextInput" class="text-input-field" 
        value="${escapeHtml(currentVal)}"
        placeholder="${escapeHtml(q.placeholder || 'Cevabınızı buraya yazın...')}" 
        maxlength="100" autocomplete="off" />
      <div style="font-size: 0.8rem; color: var(--text-dim); text-align: right;" id="charCount">${currentVal.length}/100</div>
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
  const questions = getSurveyQuestions(currentSurvey);
  const q = questions[userQuestionIndex];
  if (!q || selectedAnswer === null || selectedAnswer === undefined) return;
  if (Array.isArray(selectedAnswer) && selectedAnswer.length === 0) return;

  // Immediate visual feedback on the button
  voterSubmitBtn.disabled = true;
  voterSubmitBtn.textContent = 'Kaydedildi ✓';
  voterSubmitBtn.style.background = '#10b981';
  voterSubmitBtn.style.borderColor = '#10b981';
  voterSubmitBtn.style.color = '#ffffff';

  // Haptic feedback for mobile phones
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(35); } catch (e) {}
  }

  // Save vote locally
  saveStoredVote(q.id, selectedAnswer);

  // Publish to real-time relay
  publishVote(q.id, selectedAnswer);

  editingAnswer = false;
  justVoted = false;

  // Automatically advance to the next question without requiring an extra tap
  setTimeout(() => {
    // Reset button custom styles
    voterSubmitBtn.style.background = '';
    voterSubmitBtn.style.borderColor = '';
    voterSubmitBtn.style.color = '';

    const storedVotes = getStoredVotes();

    // Look for next unanswered question sequentially
    let nextIndex = -1;
    for (let i = userQuestionIndex + 1; i < questions.length; i++) {
      if (storedVotes[questions[i].id] === undefined) {
        nextIndex = i;
        break;
      }
    }
    // If no unanswered question ahead, search from beginning
    if (nextIndex === -1) {
      for (let i = 0; i < userQuestionIndex; i++) {
        if (storedVotes[questions[i].id] === undefined) {
          nextIndex = i;
          break;
        }
      }
    }

    if (nextIndex !== -1) {
      userQuestionIndex = nextIndex;
      viewingCompleted = false;
      renderCurrentView();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // All questions have been answered -> view completed summary
      viewingCompleted = true;
      renderCurrentView();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, 220);
}

if (voterSubmitBtn) {
  voterSubmitBtn.addEventListener('click', submitVote);
}

// Render Results for a Single Question
function renderMobileResults(q, userAnswer) {
  const results = q.results || {};
  const currentAnswer = userAnswer !== undefined ? userAnswer : selectedAnswer;

  if (q.type === 'single' || q.type === 'multi') {
    const breakdown = results.breakdown || [];
    voterLiveResults.innerHTML = breakdown.map(item => {
      const isMyChoice = Array.isArray(currentAnswer) 
        ? currentAnswer.includes(item.id) 
        : currentAnswer === item.id;
      return `
        <div style="background: var(--surface-raised); padding: 12px 14px; border-radius: var(--radius-md); margin-bottom: 8px; border: 1px solid ${isMyChoice ? 'var(--accent-blue, #3b82f6)' : 'var(--border)'};">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; font-weight: 500; margin-bottom: 8px;">
            <span style="color: ${isMyChoice ? '#fff' : 'var(--text-secondary)'};">${escapeHtml(item.text)} ${isMyChoice ? '<span style="color: #3b82f6; font-size: 0.75rem; margin-left: 6px; font-weight: 600;">● Seçiminiz</span>' : ''}</span>
            <span style="font-weight: 600; color: #fff; font-feature-settings: 'tnum';">${item.percentage}%</span>
          </div>
          <div style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 999px; overflow: hidden;">
            <div style="width: ${item.percentage}%; height: 100%; background: ${isMyChoice ? '#3b82f6' : 'rgba(255,255,255,0.2)'}; border-radius: 999px; transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);"></div>
          </div>
        </div>
      `;
    }).join('');
  } else if (q.type === 'scale') {
    const avg = results.average || "0.0";
    const breakdown = results.breakdown || [];
    const avgNum = parseFloat(avg);
    const posPercent = results.totalVotes > 0 ? Math.min(100, Math.max(0, ((avgNum - 1) / 4) * 100)) : 50;

    voterLiveResults.innerHTML = `
      <div style="background: var(--surface-raised); border-radius: var(--radius-md); padding: 18px 14px; margin-bottom: 12px; border: 1px solid var(--border);">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px;">
          <div>
            <span style="font-size: 0.75rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600;">Kitle Ortalaması</span>
            <div style="font-size: 2.2rem; font-weight: 800; color: #fff; line-height: 1;">${avg} <span style="font-size: 0.95rem; color: var(--text-tertiary);">/ 5.0</span></div>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 0.8rem; color: #3b82f6; font-weight: 600;">Seçiminiz: ${currentAnswer} Puan</span>
          </div>
        </div>

        <div style="position: relative; height: 10px; border-radius: 999px; background: linear-gradient(90deg, #ef4444 0%, #f59e0b 35%, #3b82f6 70%, #10b981 100%); margin-bottom: 18px;">
          <div style="position: absolute; top: 50%; left: ${posPercent}%; transform: translate(-50%, -50%); width: 14px; height: 14px; background: #fff; border-radius: 50%; box-shadow: 0 0 8px rgba(0,0,0,0.6);"></div>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 14px;">
          <span>← ${escapeHtml(q.leftLabel || 'Düşük')}</span>
          <span>${escapeHtml(q.centerLabel || 'Dengeli')}</span>
          <span>${escapeHtml(q.rightLabel || 'Yüksek')} →</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${breakdown.map(b => {
            const isMine = currentAnswer === b.value;
            return `
              <div style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; padding: 4px 0;">
                <span style="font-weight: 700; color: ${isMine ? '#3b82f6' : 'var(--text-secondary)'}; min-width: 14px;">${b.value}</span>
                <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.06); border-radius: 999px; overflow: hidden;">
                  <div style="width: ${b.percentage}%; height: 100%; background: ${isMine ? '#3b82f6' : 'rgba(255,255,255,0.2)'}; border-radius: 999px;"></div>
                </div>
                <span style="font-size: 0.78rem; font-weight: 600; color: #fff; min-width: 32px; text-align: right;">${b.percentage}%</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } else if (q.type === 'rating') {
    const avg = results.average || "0.0";
    voterLiveResults.innerHTML = `
      <div style="text-align: center; padding: 16px;">
        <div style="font-size: 2.8rem; font-weight: 800; color: var(--accent-amber, #f59e0b);">${avg}</div>
        <div style="font-size: 0.9rem; color: var(--text-secondary);">Ortalama Değerlendirme</div>
        <div style="margin-top: 8px; font-size: 0.85rem; color: var(--text-tertiary);">Sizin Puanınız: ${currentAnswer} Yıldız</div>
      </div>
    `;
  } else if (q.type === 'wordcloud') {
    const words = results.words || [];
    voterLiveResults.innerHTML = words.length > 0
      ? `<div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; padding: 10px 0;">
          ${words.map(w => `<span class="word-pill scale-1">${escapeHtml(w.word)} <span class="word-freq">${w.count}</span></span>`).join('')}
         </div>`
      : '<div style="text-align: center; color: var(--text-secondary); padding: 12px;">Cevaplar ana ekrana canlı olarak akmaktadır!</div>';
  }
}

// Render All Questions Summary on Completion Screen
function renderCompletedSummary(questions, storedVotes) {
  if (!completedSummaryList) return;

  let html = '';
  questions.forEach((q, idx) => {
    const answer = storedVotes[q.id];
    let choiceText = 'Henüz yanıtlanmadı';

    if (answer !== undefined) {
      if (q.type === 'single') {
        const found = (q.options || []).find(o => o.id === answer);
        choiceText = found ? found.text : answer;
      } else if (q.type === 'multi') {
        const selectedTexts = (answer || []).map(id => {
          const found = (q.options || []).find(o => o.id === id);
          return found ? found.text : id;
        });
        choiceText = selectedTexts.join(', ');
      } else if (q.type === 'scale') {
        const labels = q.scaleLabels || [];
        choiceText = `${answer} / 5 (${labels[answer - 1] || 'Puan'})`;
      } else if (q.type === 'rating') {
        choiceText = `${answer} Yıldız ★`;
      } else if (q.type === 'wordcloud') {
        choiceText = `"${answer}"`;
      }
    }

    html += `
      <div class="summary-q-card">
        <div class="summary-q-header">
          <div class="summary-q-title">Soru ${idx + 1}: ${escapeHtml(q.title)}</div>
          <button type="button" class="btn-edit-sm" data-edit-idx="${idx}">Düzenle</button>
        </div>
        <div class="summary-q-choice">
          <strong>Yanıtınız:</strong> ${escapeHtml(choiceText)}
        </div>
      </div>
    `;
  });

  completedSummaryList.innerHTML = html;

  completedSummaryList.querySelectorAll('.btn-edit-sm').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetIndex = parseInt(btn.getAttribute('data-edit-idx'), 10);
      userQuestionIndex = targetIndex;
      viewingCompleted = false;
      editingAnswer = true;
      justVoted = false;
      renderCurrentView();
    });
  });
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
    startLiveDetectionTimer(4500);
  });

  mqttClient.on('message', (topic, message) => {
    try {
      if (topic === TOPIC_STATE) {
        if (!message || message.length === 0) {
          showInactiveScreen();
          return;
        }
        let state;
        try {
          state = JSON.parse(message.toString());
        } catch (err) {
          showInactiveScreen();
          return;
        }

        // Verify active liveness with fresh timestamp from online presenter
        const now = Date.now();
        const isFreshAndLive = (state && state.isLive === true && typeof state.timestamp === 'number' && (now - state.timestamp < 35000));

        if (!isFreshAndLive) {
          showInactiveScreen();
          publishPing();
          return;
        }

        // Live and active!
        if (liveCheckTimer) {
          clearTimeout(liveCheckTimer);
          liveCheckTimer = null;
        }
        handleSurveyState(state);
      } else if (topic === TOPIC_RESET) {
        const resetData = JSON.parse(message.toString());
        performClientReset(resetData.resetEpoch);
        if (currentSurvey && isLiveActive) {
          handleSurveyState(currentSurvey);
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
