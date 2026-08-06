// backend/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allows connections from local or deployed frontends
    methods: ['GET', 'POST']
  }
});

const db = {
  quizzes: {
    'math-101': {
      id: 'math-101',
      subdomain: 'math-101',
      title: 'Algebra Fundamentals Midterm',
      timeLimitMinutes: 15,
      questions: [
        { id: 1, text: 'Solve for x: 2x + 5 = 15', options: ['x = 5', 'x = 10', 'x = 3', 'x = 0'], correct: 0 },
        { id: 2, text: 'What is the square root of 64?', options: ['6', '7', '8', '9'], correct: 2 }
      ]
    }
  },
  sessions: {},
  results: []
};

app.post('/api/quizzes', (req, res) => {
  const { title, subdomain, timeLimitMinutes, questions } = req.body;
  if (!title || !subdomain) {
    return res.status(400).json({ error: 'Title and Subdomain are required' });
  }

  const newQuiz = { 
    id: subdomain, 
    subdomain, 
    title, 
    timeLimitMinutes: Number(timeLimitMinutes) || 15, 
    questions 
  };
  
  db.quizzes[subdomain] = newQuiz;
  return res.status(201).json({ message: 'Quiz published successfully', quiz: newQuiz });
});

app.get('/api/quizzes/:subdomain', (req, res) => {
  const quiz = db.quizzes[req.params.subdomain];
  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found' });
  }

  const safeQuiz = {
    ...quiz,
    questions: quiz.questions.map(({ correct, ...q }) => q)
  };
  
  res.json(safeQuiz);
});

app.get('/api/admin/results', (req, res) => {
  res.json(db.results);
});

app.post('/api/quizzes/:subdomain/submit', (req, res) => {
  const quiz = db.quizzes[req.params.subdomain];
  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found' });
  }

  const { respondentName, answers, focusLossCount } = req.body;

  let score = 0;
  quiz.questions.forEach((q) => {
    if (answers && answers[q.id] === q.correct) {
      score += 1;
    }
  });

  const resultRecord = {
    id: Date.now().toString(),
    quizId: quiz.id,
    quizTitle: quiz.title,
    respondentName,
    score,
    totalQuestions: quiz.questions.length,
    percentage: ((score / quiz.questions.length) * 100).toFixed(1),
    focusLossCount: focusLossCount || 0,
    submittedAt: new Date().toISOString()
  };

  db.results.push(resultRecord);
  io.emit('admin_result_update', resultRecord);

  res.json({ message: 'Submission recorded', result: resultRecord });
});

io.on('connection', (socket) => {
  console.log(`[Socket Connected]: ${socket.id}`);

  socket.on('start_session', ({ quizId, respondentName }) => {
    db.sessions[socket.id] = {
      socketId: socket.id,
      quizId,
      respondentName,
      status: 'Active',
      focusLossCount: 0,
      startedAt: new Date()
    };

    socket.join(`quiz_${quizId}`);
    io.emit('active_sessions_update', Object.values(db.sessions));
  });

  socket.on('focus_lost', () => {
    if (db.sessions[socket.id]) {
      db.sessions[socket.id].focusLossCount += 1;
      db.sessions[socket.id].status = 'Warning: Tab Switched!';

      io.emit('proctor_alert', {
        respondentName: db.sessions[socket.id].respondentName,
        focusLossCount: db.sessions[socket.id].focusLossCount,
        socketId: socket.id,
        timestamp: new Date().toLocaleTimeString()
      });

      io.emit('active_sessions_update', Object.values(db.sessions));
    }
  });

  socket.on('focus_gained', () => {
    if (db.sessions[socket.id]) {
      db.sessions[socket.id].status = 'Active';
      io.emit('active_sessions_update', Object.values(db.sessions));
    }
  });

  socket.on('disconnect', () => {
    delete db.sessions[socket.id];
    io.emit('active_sessions_update', Object.values(db.sessions));
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});