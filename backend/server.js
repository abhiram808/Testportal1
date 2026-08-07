// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// In-Memory Data Stores
const quizzes = [];
const activeSessions = [];
const results = [];

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('start_session', ({ subdomain, respondentName }) => {
    const existing = activeSessions.find(
      (s) => s.respondentName === respondentName && s.quizId === subdomain
    );
    if (!existing) {
      activeSessions.push({
        socketId: socket.id,
        respondentName,
        quizId: subdomain,
        status: 'Active',
        focusLossCount: 0
      });
    }
    io.emit('active_sessions_update', activeSessions);
  });

  socket.on('tab_switch_detected', ({ subdomain, respondentName, focusLossCount, timestamp }) => {
    const session = activeSessions.find(
      (s) => s.respondentName === respondentName && s.quizId === subdomain
    );
    if (session) {
      session.focusLossCount = focusLossCount;
      io.emit('active_sessions_update', activeSessions);
    }

    io.emit('proctor_alert', {
      respondentName,
      subdomain,
      focusLossCount,
      timestamp
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// --- API ENDPOINTS ---

// 1. Create & Save Quiz Questions
app.post('/api/quizzes', (req, res) => {
  const { title, subdomain, timeLimitMinutes, passcode, questions } = req.body;

  if (!title || !subdomain) {
    return res.status(400).json({ message: 'Title and subdomain are required.' });
  }

  const existingIdx = quizzes.findIndex((q) => q.subdomain === subdomain);

  const quizData = {
    id: Date.now().toString(),
    title,
    subdomain,
    timeLimitMinutes: Number(timeLimitMinutes) || 15,
    passcode: passcode ? passcode.trim() : '',
    status: 'draft', // Initial status: draft, active, or ended
    questions: questions || []
  };

  if (existingIdx !== -1) {
    quizzes[existingIdx] = { ...quizzes[existingIdx], ...quizData };
  } else {
    quizzes.push(quizData);
  }

  res.status(201).json({ message: 'Quiz saved successfully!', quiz: quizData });
});

// 2. Fetch All Quizzes for Admin Dashboard
app.get('/api/admin/quizzes', (req, res) => {
  res.json(quizzes);
});

// 3. Update Quiz Status (Start / End Test)
app.post('/api/admin/quizzes/:subdomain/status', (req, res) => {
  const { subdomain } = req.params;
  const { status } = req.body; // 'active' or 'ended'

  const quiz = quizzes.find((q) => q.subdomain === subdomain);
  if (!quiz) {
    return res.status(404).json({ message: 'Quiz not found' });
  }

  quiz.status = status;
  io.emit('quiz_status_changed', { subdomain, status });

  res.json({ message: `Quiz status updated to ${status}`, quiz });
});

// 4. Fetch Quiz Details for Participants
app.get('/api/quizzes/:subdomain', (req, res) => {
  const { subdomain } = req.params;
  const quiz = quizzes.find((q) => q.subdomain === subdomain);

  if (!quiz) {
    return res.status(404).json({ message: 'Quiz not found' });
  }

  res.json({
    id: quiz.id,
    title: quiz.title,
    subdomain: quiz.subdomain,
    timeLimitMinutes: quiz.timeLimitMinutes,
    passcode: quiz.passcode || '',
    status: quiz.status || 'active',
    questions: quiz.questions
  });
});

// 5. Submit Answers
app.post('/api/quizzes/:subdomain/submit', (req, res) => {
  const { subdomain } = req.params;
  const { respondentName, answers, focusLossCount } = req.body;

  const quiz = quizzes.find((q) => q.subdomain === subdomain);
  if (!quiz) {
    return res.status(404).json({ message: 'Quiz not found' });
  }

  if (quiz.status === 'ended') {
    return res.status(403).json({ message: 'This assessment has already ended.' });
  }

  let score = 0;
  if (quiz.questions && Array.isArray(quiz.questions)) {
    quiz.questions.forEach((q, idx) => {
      const questionKey = q.id !== undefined ? q.id : idx;
      if (answers && answers[questionKey] === q.correct) {
        score += 1;
      }
    });
  }

  const totalQuestions = quiz.questions ? quiz.questions.length : 0;
  const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

  const resultRecord = {
    id: Date.now().toString(),
    respondentName: respondentName || 'Anonymous',
    quizTitle: quiz.title,
    subdomain,
    score,
    totalQuestions,
    percentage,
    focusLossCount: focusLossCount || 0,
    submittedAt: new Date().toISOString()
  };

  results.push(resultRecord);
  io.emit('admin_result_update', resultRecord);

  res.json({
    score,
    totalQuestions,
    percentage,
    message: 'Submission received successfully'
  });
});

// 6. Fetch Admin Results
app.get('/api/admin/results', (req, res) => {
  res.json(results);
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});