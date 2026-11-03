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
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

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

// In-Memory Survey State (9 Questions for BODTÜM Audience Profile)
let survey = {
  title: "BODTÜM & ODTÜ Yapay Zeka Kullanım ve Eğilim Anketi",
  description: "Telefonunuzla QR kodu tarayarak anında katılın!",
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

// Connected clients tracking
let activeParticipants = new Set();

// Aggregation helper
function calculateResults(question) {
  if (!question) return null;
  const totalVotes = Object.keys(question.votes || {}).length;

  if (question.type === 'single' || question.type === 'multi') {
    const counts = {};
    question.options.forEach(opt => counts[opt.id] = 0);
    Object.values(question.votes).forEach(val => {
      if (Array.isArray(val)) {
        val.forEach(optId => {
          if (counts[optId] !== undefined) counts[optId]++;
        });
      } else if (counts[val] !== undefined) {
        counts[val]++;
      }
    });

    const breakdown = question.options.map(opt => ({
      id: opt.id,
      text: opt.text,
      count: counts[opt.id] || 0,
      percentage: totalVotes > 0 ? Math.round(((counts[opt.id] || 0) / totalVotes) * 100) : 0
    }));

    return { totalVotes, breakdown };
  }

  if (question.type === 'scale') {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    Object.values(question.votes || {}).forEach(val => {
      const num = parseInt(val, 10);
      if (counts[num] !== undefined) {
        counts[num]++;
        sum += num;
      }
    });

    const average = totalVotes > 0 ? (sum / totalVotes).toFixed(1) : "0.0";
    const labels = question.scaleLabels || [
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
      leftLabel: question.leftLabel || '',
      centerLabel: question.centerLabel || '',
      rightLabel: question.rightLabel || ''
    };
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

// Helper to determine best public join URL (Codespaces, cloud proxy, or LAN Wi-Fi)
function determineJoinUrl(req) {
  if (req.query.host) {
    return `${req.query.host}/vote`;
  }

  // 1. If running inside GitHub Codespaces
  if (process.env.CODESPACE_NAME) {
    const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev';
    return `https://${process.env.CODESPACE_NAME}-${PORT}.${domain}/vote`;
  }

  // 2. If behind reverse proxy or public domain (Forwarded host header)
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    return `${proto}://${host}/vote`;
  }

  // 3. Fallback to LAN Wi-Fi IP for phone access
  const localIp = getLocalIp();
  if (localIp !== 'localhost') {
    return `http://${localIp}:${PORT}/vote`;
  }

  return `http://localhost:${PORT}/vote`;
}

// API endpoint to get connection details & QR code
app.get('/api/info', async (req, res) => {
  const localIp = getLocalIp();
  const bestUrl = determineJoinUrl(req);

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
        bestUrl,
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

// Reset all responses and participants
app.post('/api/survey/reset', (req, res) => {
  survey.questions.forEach(q => {
    q.votes = {};
  });
  activeParticipants.clear();
  io.emit('participants_count', 0);
  io.emit('survey_updated', getFullSurveyPayload());
  res.json({ success: true, message: "All responses and participants reset." });
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
