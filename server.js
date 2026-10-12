const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const os = require('os');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to get local IPv4 address
function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal and non-IPv4
      const family = typeof net.family === 'string' ? net.family : (net.family === 4 ? 'IPv4' : '');
      if (family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// In-Memory Survey State
let survey = {
  title: "BODTUM Live Usage & Experience Survey",
  description: "Scan the QR code on your mobile device to participate in real time!",
  activeQuestionIndex: 0,
  acceptingVotes: true,
  questions: [
    {
      id: "q1",
      type: "single", // single choice
      title: "How often do you engage with BODTUM platforms & services?",
      options: [
        { id: "opt1", text: "🚀 Daily - It's part of my routine" },
        { id: "opt2", text: "📅 Weekly - Several times a week" },
        { id: "opt3", text: "☕ Monthly - When specific needs arise" },
        { id: "opt4", text: "✨ First time / Just exploring today" }
      ],
      votes: {} // voterId -> optionId
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
      type: "rating", // 1 to 5 stars
      title: "How would you rate your overall experience so far?",
      min: 1,
      max: 5,
      labels: ["Poor", "Fair", "Good", "Very Good", "Exceptional 🌟"],
      votes: {} // voterId -> rating (number 1-5)
    },
    {
      id: "q4",
      type: "wordcloud", // open text / keywords
      title: "In 1 to 3 words, what feature or improvement would you like next?",
      placeholder: "e.g. mobile app, faster sync, dark theme...",
      votes: {} // voterId -> text
    }
  ]
};

// Connected clients tracking
let activeParticipants = new Set();

// Aggregation helper
function calculateResults(question) {
  if (!question) return null;
  const totalVotes = Object.keys(question.votes || {}).length;

  if (question.type === 'single') {
    const counts = {};
    question.options.forEach(opt => counts[opt.id] = 0);
    Object.values(question.votes).forEach(optId => {
      if (counts[optId] !== undefined) counts[optId]++;
    });

    const breakdown = question.options.map(opt => ({
      id: opt.id,
      text: opt.text,
      count: counts[opt.id] || 0,
      percentage: totalVotes > 0 ? Math.round(((counts[opt.id] || 0) / totalVotes) * 100) : 0
    }));

    return { totalVotes, breakdown };
  }

  if (question.type === 'rating') {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    Object.values(question.votes).forEach(val => {
      const num = parseInt(val, 10);
      if (counts[num] !== undefined) {
        counts[num]++;
        sum += num;
      }
    });

    const average = totalVotes > 0 ? (sum / totalVotes).toFixed(1) : "0.0";
    const breakdown = [1, 2, 3, 4, 5].map(star => ({
      rating: star,
      label: question.labels[star - 1],
      count: counts[star],
      percentage: totalVotes > 0 ? Math.round((counts[star] / totalVotes) * 100) : 0
    }));

    return { totalVotes, average, breakdown };
  }

  if (question.type === 'wordcloud') {
    const wordCounts = {};
    const recentEntries = [];

    Object.entries(question.votes).forEach(([voterId, text]) => {
      if (!text || typeof text !== 'string') return;
      const clean = text.trim();
      if (!clean) return;
      recentEntries.unshift({ voterId: voterId.slice(0, 6), text: clean });

      // Count words/phrases
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

// Full survey state payload
function getFullSurveyPayload() {
  const activeQ = survey.questions[survey.activeQuestionIndex];
  return {
    title: survey.title,
    description: survey.description,
    activeQuestionIndex: survey.activeQuestionIndex,
    totalQuestions: survey.questions.length,
    acceptingVotes: survey.acceptingVotes,
    activeQuestion: activeQ ? {
      ...activeQ,
      votesCount: Object.keys(activeQ.votes || {}).length,
      results: calculateResults(activeQ)
    } : null,
    questionsSummary: survey.questions.map((q, idx) => ({
      index: idx,
      id: q.id,
      title: q.title,
      type: q.type,
      totalVotes: Object.keys(q.votes || {}).length
    })),
    participantCount: activeParticipants.size
  };
}

// Routes for web views
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/vote', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'vote.html'));
});

app.get('/join', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'vote.html'));
});

// API endpoint to get connection details & QR code
app.get('/api/info', async (req, res) => {
  const localIp = getLocalIp();
  const hostHeader = req.headers.host;
  
  // Custom URL query if specified
  const customHost = req.query.host;
  
  const bestUrl = customHost 
    ? `${customHost}/vote`
    : (localIp !== 'localhost' ? `http://${localIp}:${PORT}/vote` : `http://${hostHeader || 'localhost:' + PORT}/vote`);

  try {
    const qrDataUrl = await QRCode.toDataURL(bestUrl, {
      margin: 2,
      width: 400,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });

    res.json({
      localIp,
      port: PORT,
      joinUrl: bestUrl,
      qrDataUrl,
      alternativeUrls: [
        `http://${localIp}:${PORT}/vote`,
        `http://localhost:${PORT}/vote`
      ]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// QR Code image endpoint
app.get('/api/qr', async (req, res) => {
  const text = req.query.url || `http://${getLocalIp()}:${PORT}/vote`;
  try {
    const buffer = await QRCode.toBuffer(text, {
      margin: 1,
      width: 500,
      color: {
        dark: '#090d16',
        light: '#ffffff'
      }
    });
    res.type('png').send(buffer);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Survey state API
app.get('/api/survey', (req, res) => {
  res.json(getFullSurveyPayload());
});

// Export responses as JSON / CSV
app.get('/api/survey/export', (req, res) => {
  const exportData = survey.questions.map((q, idx) => ({
    questionIndex: idx + 1,
    question: q.title,
    type: q.type,
    totalVotes: Object.keys(q.votes || {}).length,
    results: calculateResults(q),
    allResponses: q.votes
  }));
  res.json({
    surveyTitle: survey.title,
    exportedAt: new Date().toISOString(),
    totalQuestions: survey.questions.length,
    data: exportData
  });
});

// Reset all responses
app.post('/api/survey/reset', (req, res) => {
  survey.questions.forEach(q => {
    q.votes = {};
  });
  io.emit('survey_updated', getFullSurveyPayload());
  res.json({ success: true, message: "All responses reset." });
});

// Socket.io Real-time communications
io.on('connection', (socket) => {
  const clientIp = socket.handshake.address;
  let voterId = socket.handshake.query.voterId || socket.id;

  activeParticipants.add(socket.id);
  io.emit('participants_count', activeParticipants.size);

  // Send current state on connect
  socket.emit('survey_state', getFullSurveyPayload());

  // Join role rooms
  socket.on('set_role', (role) => {
    socket.join(role); // e.g. 'presenter' or 'voter'
  });

  // Participant votes
  socket.on('submit_vote', (data) => {
    if (!survey.acceptingVotes) {
      socket.emit('vote_error', { message: "Voting is currently locked by the presenter." });
      return;
    }

    const { questionId, answer, voterId: clientVoterId } = data;
    const finalVoterId = clientVoterId || voterId;

    const question = survey.questions.find(q => q.id === questionId);
    if (!question) {
      socket.emit('vote_error', { message: "Question not found." });
      return;
    }

    // Record response
    question.votes[finalVoterId] = answer;

    // Send acknowledgement to voter
    socket.emit('vote_confirmed', {
      questionId,
      answer,
      results: calculateResults(question)
    });

    // Broadcast updated state to all connected screens immediately
    const updatedPayload = getFullSurveyPayload();
    io.emit('vote_recorded', {
      questionId,
      results: calculateResults(question),
      totalSurveyVotes: updatedPayload
    });
    io.emit('survey_updated', updatedPayload);
  });

  // Presenter navigation & controls
  socket.on('change_question', (index) => {
    if (index >= 0 && index < survey.questions.length) {
      survey.activeQuestionIndex = index;
      const payload = getFullSurveyPayload();
      io.emit('question_changed', payload);
      io.emit('survey_updated', payload);
    }
  });

  socket.on('toggle_voting', (accepting) => {
    survey.acceptingVotes = (typeof accepting === 'boolean') ? accepting : !survey.acceptingVotes;
    const payload = getFullSurveyPayload();
    io.emit('voting_toggled', { acceptingVotes: survey.acceptingVotes });
    io.emit('survey_updated', payload);
  });

  socket.on('reset_question_votes', (questionId) => {
    const q = survey.questions.find(item => item.id === questionId);
    if (q) {
      q.votes = {};
      const payload = getFullSurveyPayload();
      io.emit('survey_updated', payload);
    }
  });

  socket.on('add_question', (newQuestion) => {
    const id = 'q_' + Date.now();
    const formatted = {
      id,
      type: newQuestion.type || 'single',
      title: newQuestion.title || 'Untitled Question',
      options: (newQuestion.options || []).map((opt, i) => ({
        id: `opt_${Date.now()}_${i}`,
        text: opt
      })),
      labels: newQuestion.labels || ["Poor", "Fair", "Good", "Very Good", "Exceptional 🌟"],
      placeholder: newQuestion.placeholder || "Enter your response...",
      votes: {}
    };
    survey.questions.push(formatted);
    io.emit('survey_updated', getFullSurveyPayload());
  });

  socket.on('disconnect', () => {
    activeParticipants.delete(socket.id);
    io.emit('participants_count', activeParticipants.size);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`\n======================================================`);
  console.log(`🚀 Live Survey Server is running!`);
  console.log(`📊 Presenter Screen: http://localhost:${PORT}`);
  console.log(`📱 Mobile Vote URL:   http://${localIp}:${PORT}/vote`);
  console.log(`======================================================\n`);
});
