// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(express.json());

// -------------------------------------------------------------
// 1. CONNECT TO MONGO DB PERSISTENT DATABASE
// -------------------------------------------------------------
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://<username>:<password>@cluster0.xxx.mongodb.net/testportal?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully! Quizzes are now permanent.'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

// -------------------------------------------------------------
// 2. DEFINE DATABASE SCHEMAS
// -------------------------------------------------------------
const QuizSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userEmail: String,
  title: { type: String, required: true },
  subdomain: { type: String, required: true, unique: true },
  timeLimitMinutes: { type: Number, default: 15 },
  passcode: String,
  status: { type: String, default: 'draft' },
  questions: Array,
  createdAt: { type: Date, default: Date.now }
});

const ResultSchema = new mongoose.Schema({
  quizOwnerId: { type: String, required: true },
  respondentName: String,
  quizTitle: String,
  subdomain: String,
  score: Number,
  totalQuestions: Number,
  percentage: Number,
  focusLossCount: { type: Number, default: 0 },
  submittedAt: { type: Date, default: Date.now }
});

const Quiz = mongoose.model('Quiz', QuizSchema);
const Result = mongoose.model('Result', ResultSchema);

// In-memory sessions for live sockets only
const activeSessions = [];

// Socket.io Setup
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

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

  socket.on('disconnect', () => {
    const sessionIndex = activeSessions.findIndex((s) => s.socketId === socket.id);
    if (sessionIndex !== -1) {
      activeSessions.splice(sessionIndex, 1);
      io.emit('active_sessions_update', activeSessions);
    }
  });
});

// -------------------------------------------------------------
// 3. PERSISTENT API ENDPOINTS
// -------------------------------------------------------------

app.get('/', (req, res) => res.send('Quiz API Server running with MongoDB persistence.'));

// Create Quiz
app.post('/api/quizzes', async (req, res) => {
  try {
    const { title, subdomain, timeLimitMinutes, passcode, questions, userId, userEmail } = req.body;

    if (!title || !subdomain || !userId) {
      return res.status(400).json({ message: 'Title, subdomain slug, and User ID are required.' });
    }

    const existing = await Quiz.findOne({ subdomain });
    if (existing) {
      return res.status(400).json({ message: 'Subdomain URL link already taken. Choose another.' });
    }

    const newQuiz = await Quiz.create({
      userId,
      userEmail,
      title,
      subdomain,
      timeLimitMinutes: Number(timeLimitMinutes) || 15,
      passcode: passcode ? passcode.trim() : '',
      questions: questions || []
    });

    res.status(201).json({ message: 'Quiz created successfully!', quiz: newQuiz });
  } catch (err) {
    res.status(500).json({ message: 'Error saving quiz to database', error: err.message });
  }
});

// Fetch Quizzes Owned by User
app.get('/api/user/quizzes', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: 'userId query required' });

    const myQuizzes = await Quiz.find({ userId }).sort({ createdAt: -1 });
    res.json(myQuizzes);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching quizzes' });
  }
});

// Fetch Single Quiz for Test Takers
app.get('/api/quizzes/:subdomain', async (req, res) => {
  try {
    const { subdomain } = req.params;
    const quiz = await Quiz.findOne({ subdomain });

    if (!quiz) return res.status(404).json({ message: 'Quiz not found.' });
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ message: 'Error loading quiz' });
  }
});

// Update Status (Start / End)
app.post('/api/user/quizzes/:subdomain/status', async (req, res) => {
  try {
    const { subdomain } = req.params;
    const { status } = req.body;

    const quiz = await Quiz.findOneAndUpdate({ subdomain }, { status }, { new: true });
    if (!quiz) return res.status(404).json({ message: 'Quiz not found.' });

    io.emit('quiz_status_changed', { subdomain, status });
    res.json({ message: `Status updated to ${status}`, quiz });
  } catch (err) {
    res.status(500).json({ message: 'Error updating status' });
  }
});

// Restart Quiz
app.post('/api/user/quizzes/:subdomain/restart', async (req, res) => {
  try {
    const { subdomain } = req.params;
    const quiz = await Quiz.findOneAndUpdate({ subdomain }, { status: 'active' }, { new: true });

    if (!quiz) return res.status(404).json({ message: 'Quiz not found.' });

    io.emit('quiz_status_changed', { subdomain, status: 'active' });
    res.json({ message: 'Test restarted successfully!', quiz });
  } catch (err) {
    res.status(500).json({ message: 'Error restarting quiz' });
  }
});

// Edit Quiz
app.put('/api/user/quizzes/:subdomain', async (req, res) => {
  try {
    const { subdomain } = req.params;
    const { title, timeLimitMinutes, passcode, questions } = req.body;

    const quiz = await Quiz.findOneAndUpdate(
      { subdomain },
      {
        title,
        timeLimitMinutes: Number(timeLimitMinutes) || 15,
        passcode: passcode !== undefined ? passcode.trim() : '',
        questions
      },
      { new: true }
    );

    if (!quiz) return res.status(404).json({ message: 'Quiz not found.' });
    res.json({ message: 'Quiz updated successfully!', quiz });
  } catch (err) {
    res.status(500).json({ message: 'Error updating quiz' });
  }
});

// Delete Quiz
app.delete('/api/user/quizzes/:subdomain', async (req, res) => {
  try {
    const { subdomain } = req.params;
    await Quiz.deleteOne({ subdomain });
    res.json({ message: 'Quiz deleted permanently.' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting quiz' });
  }
});

// Submit Quiz Answers
app.post('/api/quizzes/:subdomain/submit', async (req, res) => {
  try {
    const { subdomain } = req.params;
    const { respondentName, answers, focusLossCount } = req.body;

    const quiz = await Quiz.findOne({ subdomain });
    if (!quiz) return res.status(404).json({ message: 'Quiz not found.' });

    if (quiz.status === 'ended') {
      return res.status(403).json({ message: 'This assessment is closed.' });
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

    const resultRecord = await Result.create({
      quizOwnerId: quiz.userId,
      respondentName: respondentName || 'Anonymous Candidate',
      quizTitle: quiz.title,
      subdomain,
      score,
      totalQuestions,
      percentage,
      focusLossCount: focusLossCount || 0
    });

    io.emit('admin_result_update', resultRecord);

    return res.json({
      success: true,
      score,
      totalQuestions,
      percentage,
      message: 'Assessment submitted successfully.'
    });
  } catch (err) {
    res.status(500).json({ message: 'Error submitting answers' });
  }
});

// Fetch Submissions for User Dashboard
app.get('/api/user/results', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: 'userId query required' });

    const myResults = await Result.find({ quizOwnerId: userId }).sort({ submittedAt: -1 });
    res.json(myResults);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching results' });
  }
});

// Delete Submission Result
app.delete('/api/user/results/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Result.findByIdAndDelete(id);
    res.json({ message: 'Result deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting result' });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));