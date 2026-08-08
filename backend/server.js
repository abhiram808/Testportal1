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
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

io.on('connection', (socket) => {
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
    io.emit('proctor_alert', { respondentName, subdomain, focusLossCount, timestamp });
  });
});

// --- API ENDPOINTS ---

// 1. Create Quiz (Linked to User ID)
app.post('/api/quizzes', (req, res) => {
  const { title, subdomain, timeLimitMinutes, passcode, questions, userId, userEmail } = req.body;

  if (!title || !subdomain || !userId) {
    return res.status(400).json({ message: 'Title, subdomain, and User ID are required.' });
  }

  const existing = quizzes.find((q) => q.subdomain === subdomain);
  if (existing) {
    return res.status(400).json({ message: 'Subdomain/URL link already taken. Choose another.' });
  }

  const newQuiz = {
    id: Date.now().toString(),
    userId,
    userEmail,
    title,
    subdomain,
    timeLimitMinutes: Number(timeLimitMinutes) || 15,
    passcode: passcode ? passcode.trim() : '',
    status: 'draft',
    questions: questions || []
  };

  quizzes.push(newQuiz);
  res.status(201).json({ message: 'Quiz created successfully!', quiz: newQuiz });
});

// 2. Fetch Quizzes Owned by Specific User
app.get('/api/user/quizzes', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ message: 'userId query required' });

  const myQuizzes = quizzes.filter((q) => q.userId === userId);
  res.json(myQuizzes);
});

// 3. Fetch Single Quiz (Public View for Participants)
app.get('/api/quizzes/:subdomain', (req, res) => {
  const { subdomain } = req.params;
  const quiz = quizzes.find((q) => q.subdomain === subdomain);

  if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

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

// 4. Update Quiz Status (Start / End Test)
app.post('/api/user/quizzes/:subdomain/status', (req, res) => {
  const { subdomain } = req.params;
  const { status } = req.body;

  const quiz = quizzes.find((q) => q.subdomain === subdomain);
  if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

  quiz.status = status;
  io.emit('quiz_status_changed', { subdomain, status });

  res.json({ message: `Quiz status updated to ${status}`, quiz });
});

// 5. Edit Quiz
app.put('/api/user/quizzes/:subdomain', (req, res) => {
  const { subdomain } = req.params;
  const { title, timeLimitMinutes, passcode, questions } = req.body;

  const quizIdx = quizzes.findIndex((q) => q.subdomain === subdomain);
  if (quizIdx === -1) return res.status(404).json({ message: 'Quiz not found' });

  quizzes[quizIdx] = {
    ...quizzes[quizIdx],
    title: title || quizzes[quizIdx].title,
    timeLimitMinutes: Number(timeLimitMinutes) || quizzes[quizIdx].timeLimitMinutes,
    passcode: passcode !== undefined ? passcode.trim() : quizzes[quizIdx].passcode,
    questions: questions || quizzes[quizIdx].questions
  };

  res.json({ message: 'Quiz updated successfully!', quiz: quizzes[quizIdx] });
});

// 6. Delete Quiz
app.delete('/api/user/quizzes/:subdomain', (req, res) => {
  const { subdomain } = req.params;
  const quizIdx = quizzes.findIndex((q) => q.subdomain === subdomain);

  if (quizIdx === -1) return res.status(404).json({ message: 'Quiz not found' });

  quizzes.splice(quizIdx, 1);
  res.json({ message: 'Quiz deleted successfully!' });
});

// 7. Submit Quiz Answers
app.post('/api/quizzes/:subdomain/submit', (req, res) => {
  const { subdomain } = req.params;
  const { respondentName, answers, focusLossCount } = req.body;

  const quiz = quizzes.find((q) => q.subdomain === subdomain);
  if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

  if (quiz.status === 'ended') {
    return res.status(403).json({ message: 'This assessment has ended.' });
  }

  let score = 0;
  if (quiz.questions && Array.isArray(quiz.questions)) {
    quiz.questions.forEach((q, idx) => {
      const questionKey = q.id !== undefined ? q.id : idx;
      if (answers && answers[questionKey] === q.correct) score += 1;
    });
  }

  const totalQuestions = quiz.questions ? quiz.questions.length : 0;
  const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

  const resultRecord = {
    id: Date.now().toString(),
    quizOwnerId: quiz.userId, // 👈 Links result to creator's user account
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

  res.json({ score, totalQuestions, percentage, message: 'Submission received' });
});

// 8. Fetch Results for Creator's Dashboard
app.get('/api/user/results', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ message: 'userId query required' });

  const myResults = results.filter((r) => r.quizOwnerId === userId);
  res.json(myResults);
});

// 9. Delete Result
app.delete('/api/user/results/:id', (req, res) => {
  const { id } = req.params;
  const resultIdx = results.findIndex((r) => r.id === id);

  if (resultIdx === -1) return res.status(404).json({ message: 'Result not found' });

  results.splice(resultIdx, 1);
  res.json({ message: 'Result deleted' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
// Restart Test Endpoint
app.post('/api/user/quizzes/:subdomain/restart', (req, res) => {
  const { subdomain } = req.params;
  const quiz = quizzes.find((q) => q.subdomain === subdomain);

  if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

  quiz.status = 'active';
  io.emit('quiz_status_changed', { subdomain, status: 'active' });

  res.json({ message: 'Test restarted successfully!', quiz });
});