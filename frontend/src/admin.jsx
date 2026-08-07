// frontend/src/Admin.jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import mammoth from 'mammoth';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const socket = io(BACKEND_URL);

export default function Admin() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('admin_token') === 'admin-session-active-token';
  });
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Dashboard State
  const [tab, setTab] = useState('manage'); // 'manage', 'create', 'live', 'results'
  const [quizzesList, setQuizzesList] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [results, setResults] = useState([]);
  const [alerts, setAlerts] = useState([]);

  // Form State
  const [editingSubdomain, setEditingSubdomain] = useState(null);
  const [title, setTitle] = useState('');
  const [subdomainInput, setSubdomainInput] = useState('');
  const [timeLimit, setTimeLimit] = useState(15);
  const [passcode, setPasscode] = useState('');
  const [questions, setQuestions] = useState([
    { id: 1, text: '', options: ['', '', '', ''], correct: 0 }
  ]);

  // Handle Admin Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: loginPassword })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('admin_token', data.token);
        setIsAuthenticated(true);
      } else {
        setLoginError(data.message || 'Invalid Password');
      }
    } catch (err) {
      setLoginError('Error connecting to backend server.');
    }
  };

  // Handle Admin Logout
  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setIsAuthenticated(false);
  };

  const fetchQuizzes = () => {
    fetch(`${BACKEND_URL}/api/admin/quizzes`)
      .then((res) => res.json())
      .then((data) => setQuizzesList(data))
      .catch((err) => console.error('Error fetching quizzes:', err));
  };

  const fetchResults = () => {
    fetch(`${BACKEND_URL}/api/admin/results`)
      .then((res) => res.json())
      .then((data) => setResults(data))
      .catch((err) => console.error('Error loading results:', err));
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    fetchQuizzes();
    fetchResults();

    socket.on('active_sessions_update', (sessions) => setActiveSessions(sessions));
    socket.on('proctor_alert', (alert) => setAlerts((prev) => [alert, ...prev]));
    socket.on('admin_result_update', (newResult) => setResults((prev) => [newResult, ...prev]));

    return () => {
      socket.off('active_sessions_update');
      socket.off('proctor_alert');
      socket.off('admin_result_update');
    };
  }, [isAuthenticated]);

  const resetForm = () => {
    setEditingSubdomain(null);
    setTitle('');
    setSubdomainInput('');
    setTimeLimit(15);
    setPasscode('');
    setQuestions([{ id: 1, text: '', options: ['', '', '', ''], correct: 0 }]);
  };

  const handleEditQuiz = (quiz) => {
    setEditingSubdomain(quiz.subdomain);
    setTitle(quiz.title);
    setSubdomainInput(quiz.subdomain);
    setTimeLimit(quiz.timeLimitMinutes || 15);
    setPasscode(quiz.passcode || '');
    setQuestions(quiz.questions || [{ id: 1, text: '', options: ['', '', '', ''], correct: 0 }]);
    setTab('create');
  };

  const handleSaveQuiz = async () => {
    if (!title || !subdomainInput) {
      alert('Please fill in both Title and Subdomain.');
      return;
    }

    const endpoint = editingSubdomain
      ? `${BACKEND_URL}/api/admin/quizzes/${editingSubdomain}`
      : `${BACKEND_URL}/api/quizzes`;

    const method = editingSubdomain ? 'PUT' : 'POST';

    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        subdomain: subdomainInput,
        timeLimitMinutes: Number(timeLimit),
        passcode,
        questions
      })
    });

    if (res.ok) {
      alert(editingSubdomain ? 'Quiz Updated Successfully!' : 'Quiz Created Successfully!');
      resetForm();
      fetchQuizzes();
      setTab('manage');
    } else {
      alert('Failed to save quiz.');
    }
  };

  const handleRestartQuiz = async (subdomain) => {
    if (!window.confirm('Restart test? Participants will be able to submit responses again.')) return;

    const res = await fetch(`${BACKEND_URL}/api/admin/quizzes/${subdomain}/restart`, {
      method: 'POST'
    });

    if (res.ok) {
      alert('Test restarted!');
      fetchQuizzes();
    }
  };

  const handleUpdateStatus = async (subdomain, newStatus) => {
    const res = await fetch(`${BACKEND_URL}/api/admin/quizzes/${subdomain}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    if (res.ok) fetchQuizzes();
  };

  const handleDeleteQuiz = async (subdomain) => {
    if (!window.confirm(`Delete quiz "?quiz=${subdomain}" permanently?`)) return;

    const res = await fetch(`${BACKEND_URL}/api/admin/quizzes/${subdomain}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      alert('Quiz deleted!');
      fetchQuizzes();
    }
  };

  const handleDeleteResult = async (id) => {
    if (!window.confirm('Delete this candidate score record?')) return;

    const res = await fetch(`${BACKEND_URL}/api/admin/results/${id}`, {
      method: 'DELETE'
    });

    if (res.ok) fetchResults();
  };

  const handleDocxUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const result = await mammoth.extractRawText({ arrayBuffer });
        const parsedQuestions = parseQuizText(result.value);
        if (parsedQuestions.length > 0) {
          setQuestions(parsedQuestions);
          alert(`Imported ${parsedQuestions.length} questions from Word document!`);
        } else {
          alert('Could not detect any questions.');
        }
      } catch (error) {
        alert('Error parsing Word doc.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const parseQuizText = (text) => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsed = [];
    let currentQ = null;

    lines.forEach((line) => {
      const qMatch = line.match(/^(?:Q?\d+[\.\:]|\d+\.)\s*(.+)/i);
      const optMatch = line.match(/^(?:[A-D]\)|[A-D]\.|[1-4]\))\s*(.+)/i);
      const ansMatch = line.match(/^(?:Answer|Ans|Correct|Correct Answer)\s*:\s*([A-D]|[1-4])/i);

      if (ansMatch && currentQ) {
        const letter = ansMatch[1].toUpperCase();
        let correctIdx = 0;
        if (letter === 'B' || letter === '2') correctIdx = 1;
        else if (letter === 'C' || letter === '3') correctIdx = 2;
        else if (letter === 'D' || letter === '4') correctIdx = 3;

        currentQ.correct = correctIdx;
        parsed.push(currentQ);
        currentQ = null;
      } else if (optMatch && currentQ) {
        currentQ.options.push(optMatch[1]);
      } else if (qMatch) {
        if (currentQ) parsed.push(currentQ);
        currentQ = { id: parsed.length + 1, text: qMatch[1], options: [], correct: 0 };
      }
    });

    if (currentQ) parsed.push(currentQ);
    return parsed.map((q) => {
      while (q.options.length < 4) q.options.push(`Option ${q.options.length + 1}`);
      return q;
    });
  };

  // -------------------------------------------------------------
  // SCREEN 1: SECURE ADMIN LOGIN SCREEN
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-xl shadow-md border border-slate-200 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto text-2xl">
            🔒
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Admin Authentication</h1>
          <p className="text-xs text-slate-500">Enter administrator password to access host panel</p>
        </div>

        {loginError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs text-center font-medium">
            {loginError}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Admin Password
            </label>
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-slate-300 rounded-md p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              required
            />
            <p className="text-xs text-slate-400 mt-1">Default password: <code>admin123</code></p>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow transition text-sm"
          >
            Unlock Dashboard
          </button>
        </form>
      </div>
    );
  }

  // -------------------------------------------------------------
  // SCREEN 2: AUTHENTICATED ADMIN DASHBOARD
  // -------------------------------------------------------------
  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-slate-200 my-6">
      {/* Header Bar with Logout Button */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-6">
        <div className="flex space-x-6">
          {['manage', 'create', 'live', 'results'].map((t) => (
            <button
              key={t}
              onClick={() => {
                if (t === 'create' && !editingSubdomain) resetForm();
                setTab(t);
              }}
              className={`pb-1 capitalize font-semibold text-sm border-b-2 transition ${
                tab === t
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'manage'
                ? 'Manage Tests'
                : t === 'create'
                ? editingSubdomain
                  ? 'Edit Quiz'
                  : 'Create Quiz'
                : t === 'live'
                ? 'Live Monitor'
                : 'Results'}
            </button>
          ))}
        </div>

        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 border border-slate-300 rounded hover:border-red-300 transition flex items-center space-x-1"
        >
          <span>🚪 Logout</span>
        </button>
      </div>

      {/* Tab 1: Manage Tests */}
      {tab === 'manage' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Assessments List</h2>
            <button
              onClick={() => {
                resetForm();
                setTab('create');
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700"
            >
              + Create New Quiz
            </button>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Quiz Title</th>
                  <th className="p-3">Slug Link</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {quizzesList.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="p-4 text-center text-slate-500">
                      No quizzes created yet.
                    </td>
                  </tr>
                ) : (
                  quizzesList.map((q) => (
                    <tr key={q.id || q.subdomain} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">{q.title}</td>
                      <td className="p-3 text-indigo-600 font-mono text-xs">?quiz={q.subdomain}</td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase ${
                            q.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : q.status === 'ended'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {q.status || 'draft'}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1.5">
                        {q.status !== 'active' ? (
                          <button
                            onClick={() => handleUpdateStatus(q.subdomain, 'active')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium"
                          >
                            ▶ Start
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateStatus(q.subdomain, 'ended')}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium"
                          >
                            ⏹ End
                          </button>
                        )}

                        <button
                          onClick={() => handleRestartQuiz(q.subdomain)}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium"
                        >
                          🔄 Restart
                        </button>

                        <button
                          onClick={() => handleEditQuiz(q)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs font-medium"
                        >
                          ✏️ Edit
                        </button>

                        <button
                          onClick={() => handleDeleteQuiz(q.subdomain)}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-xs font-medium"
                        >
                          🗑️ Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Create / Edit Form */}
      {tab === 'create' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">
              {editingSubdomain ? `Edit Quiz (${editingSubdomain})` : 'Prepare New Assessment'}
            </h2>
            <label className="cursor-pointer bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-md text-sm font-semibold border border-indigo-200 transition">
              <span>📄 Import from Word (.docx)</span>
              <input type="file" accept=".docx" onChange={handleDocxUpload} className="hidden" />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Quiz Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Physics 101"
                className="mt-1 w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Subdomain / Slug</label>
              <input
                type="text"
                disabled={!!editingSubdomain}
                value={subdomainInput}
                onChange={(e) =>
                  setSubdomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                }
                placeholder="physics-101"
                className={`mt-1 w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none ${
                  editingSubdomain ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                }`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Time Limit (Mins)</label>
              <input
                type="number"
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
                className="mt-1 w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Passcode (Optional)</label>
              <input
                type="text"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="SECRET123"
                className="mt-1 w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Questions Builder */}
          <div className="space-y-4 pt-4">
            <h3 className="text-lg font-semibold text-slate-800">Questions</h3>

            {questions.map((q, idx) => (
              <div key={idx} className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-3">
                <span className="font-medium text-slate-700 text-sm">Question {idx + 1}</span>
                <input
                  type="text"
                  value={q.text}
                  onChange={(e) => {
                    const newQs = [...questions];
                    newQs[idx].text = e.target.value;
                    setQuestions(newQs);
                  }}
                  placeholder="Enter prompt..."
                  className="w-full border border-slate-300 rounded p-2 text-sm bg-white"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {q.options.map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name={`correct-${idx}`}
                        checked={q.correct === optIdx}
                        onChange={() => {
                          const newQs = [...questions];
                          newQs[idx].correct = optIdx;
                          setQuestions(newQs);
                        }}
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const newQs = [...questions];
                          newQs[idx].options[optIdx] = e.target.value;
                          setQuestions(newQs);
                        }}
                        placeholder={`Option ${optIdx + 1}`}
                        className="w-full border border-slate-300 rounded p-1.5 text-sm bg-white"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                setQuestions([
                  ...questions,
                  { id: questions.length + 1, text: '', options: ['', '', '', ''], correct: 0 }
                ])
              }
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-md text-sm border"
            >
              + Add Question
            </button>
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleSaveQuiz}
              className="flex-1 py-3 bg-indigo-600 text-white font-medium rounded-md shadow hover:bg-indigo-700"
            >
              {editingSubdomain ? 'Update Quiz' : 'Save Quiz'}
            </button>
            {editingSubdomain && (
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setTab('manage');
                }}
                className="px-6 py-3 bg-slate-100 text-slate-700 font-medium rounded-md border hover:bg-slate-200"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Live Monitor */}
      {tab === 'live' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Active Respondents</h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Respondent</th>
                    <th className="p-3">Quiz ID</th>
                    <th className="p-3">Tab Switches</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeSessions.map((s, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-800">{s.respondentName}</td>
                      <td className="p-3 text-slate-600">{s.quizId}</td>
                      <td className="p-3 font-medium text-slate-700">{s.focusLossCount || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Proctoring Alerts</h3>
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3 min-h-[200px]">
              {alerts.map((a, i) => (
                <div key={i} className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                  <strong>{a.respondentName}</strong> switched tabs! ({a.focusLossCount} violations)
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Submissions */}
      {tab === 'results' && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-800">Submissions History</h3>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Respondent</th>
                  <th className="p-3">Quiz</th>
                  <th className="p-3">Score</th>
                  <th className="p-3">Percentage</th>
                  <th className="p-3">Violations</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {results.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-4 text-center text-slate-500">
                      No results recorded yet.
                    </td>
                  </tr>
                ) : (
                  results.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-800">{r.respondentName}</td>
                      <td className="p-3 text-slate-600">{r.quizTitle}</td>
                      <td className="p-3">{r.score} / {r.totalQuestions}</td>
                      <td className="p-3 font-semibold text-indigo-600">{r.percentage}%</td>
                      <td className="p-3 text-slate-700">{r.focusLossCount || 0}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleDeleteResult(r.id)}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-xs font-medium"
                        >
                          🗑️ Delete Result
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}