// server.js
// Add at top of server.js
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Abhi@1103'; // Default password: admin123

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
    // Returns a session token upon correct password
    return res.json({ success: true, token: 'admin-session-active-token' });
  }

  return res.status(401).json({ success: false, message: 'Incorrect Admin Password!' });
});
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// 1. FIRST: Initialize Express App & HTTP Server
const app = express();
const server = http.createServer(app);

// 2. Middleware & Config
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Abhi@1103';
app.use(cors());
app.use(express.json());

// 3. In-Memory Data Stores
const quizzes = [];
const activeSessions = [];
const results = [];

// 4. Socket.io Setup
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

// ==========================================
// 5. API ENDPOINTS (Defined AFTER app)
// ==========================================

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
    return res.json({ success: true, token: 'admin-session-active-token' });
  }

  return res.status(401).json({ success: false, message: 'Incorrect Admin Password!' });
});

// Create Quiz
app.post('/api/quizzes', (req, res) => {
  const { title, subdomain, timeLimitMinutes, passcode, questions } = req.body;

  if (!title || !subdomain) {
    return res.status(400).json({ message: 'Title and subdomain are required.' });
  }

  const newQuiz = {
    id: Date.now().toString(),
    title,
    subdomain,
    timeLimitMinutes: Number(timeLimitMinutes) || 15,
    passcode: passcode ? passcode.trim() : '',
    status: 'draft',
    questions: questions || []
  };

  quizzes.push(newQuiz);
  res.status(201).json({ message: 'Quiz published successfully!', quiz: newQuiz });
});

// Fetch All Quizzes (Admin Dashboard)
app.get('/api/admin/quizzes', (req, res) => {
  res.json(quizzes);
});

// Fetch Single Quiz (Participant View)
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
    status: quiz.status || 'draft',
    questions: quiz.questions
  });
});

// Update Quiz Status (Start / End Test)
app.post('/api/admin/quizzes/:subdomain/status', (req, res) => {
  const { subdomain } = req.params;
  const { status } = req.body;

  const quiz = quizzes.find((q) => q.subdomain === subdomain);
  if (!quiz) {
    return res.status(404).json({ message: 'Quiz not found' });
  }

  quiz.status = status;
  io.emit('quiz_status_changed', { subdomain, status });

  res.json({ message: `Quiz status updated to ${status}`, quiz });
});

// Edit Quiz (PUT)
app.put('/api/admin/quizzes/:subdomain', (req, res) => {
  const { subdomain } = req.params;
  const { title, timeLimitMinutes, passcode, questions } = req.body;

  const quizIdx = quizzes.findIndex((q) => q.subdomain === subdomain);
  if (quizIdx === -1) {
    return res.status(404).json({ message: 'Quiz not found' });
  }

  quizzes[quizIdx] = {
    ...quizzes[quizIdx],
    title: title || quizzes[quizIdx].title,
    timeLimitMinutes: Number(timeLimitMinutes) || quizzes[quizIdx].timeLimitMinutes,
    passcode: passcode !== undefined ? passcode.trim() : quizzes[quizIdx].passcode,
    questions: questions || quizzes[quizIdx].questions
  };

  res.json({ message: 'Quiz updated successfully!', quiz: quizzes[quizIdx] });
});

// Restart Test
app.post('/api/admin/quizzes/:subdomain/restart', (req, res) => {
  const { subdomain } = req.params;
  const quiz = quizzes.find((q) => q.subdomain === subdomain);

  if (!quiz) {
    return res.status(404).json({ message: 'Quiz not found' });
  }

  quiz.status = 'active';
  io.emit('quiz_status_changed', { subdomain, status: 'active' });

  res.json({ message: 'Test restarted successfully!', quiz });
});

// Delete Quiz
app.delete('/api/admin/quizzes/:subdomain', (req, res) => {
  const { subdomain } = req.params;
  const quizIdx = quizzes.findIndex((q) => q.subdomain === subdomain);

  if (quizIdx === -1) {
    return res.status(404).json({ message: 'Quiz not found' });
  }

  quizzes.splice(quizIdx, 1);
  res.json({ message: 'Quiz deleted successfully!' });
});

// Delete Single Result
app.delete('/api/admin/results/:id', (req, res) => {
  const { id } = req.params;
  const resultIdx = results.findIndex((r) => r.id === id);

  if (resultIdx === -1) {
    return res.status(404).json({ message: 'Result record not found' });
  }

  results.splice(resultIdx, 1);
  res.json({ message: 'Result deleted successfully!' });
});

// Submit Quiz Answers
app.post('/api/quizzes/:subdomain/submit', (req, res) => {
  const { subdomain } = req.params;
  const { respondentName, answers, focusLossCount } = req.body;

  const quiz = quizzes.find((q) => q.subdomain === subdomain);
  if (!quiz) {
    return res.status(404).json({ message: 'Quiz not found' });
  }

  if (quiz.status === 'ended') {
    return res.status(403).json({ message: 'This assessment has ended.' });
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

// Fetch Results (Admin)
app.get('/api/admin/results', (req, res) => {
  res.json(results);
});

// 6. Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});