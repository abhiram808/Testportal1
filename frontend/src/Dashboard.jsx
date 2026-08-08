// frontend/src/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import mammoth from 'mammoth';
import AuthModal from './AuthModal';
import { auth, signOut } from './firebase';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const socket = io(BACKEND_URL);

export default function Dashboard() {
  // Authentication State
  const [user, setUser] = useState(null);

  // Dashboard Navigation
  const [tab, setTab] = useState('manage'); // 'manage', 'create', 'live', 'results'

  // Data Stores
  const [quizzesList, setQuizzesList] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [results, setResults] = useState([]);
  const [alerts, setAlerts] = useState([]);

  // Quiz Form State
  const [editingSubdomain, setEditingSubdomain] = useState(null);
  const [title, setTitle] = useState('');
  const [subdomainInput, setSubdomainInput] = useState('');
  const [timeLimit, setTimeLimit] = useState(15);
  const [passcode, setPasscode] = useState('');
  const [questions, setQuestions] = useState([
    { id: 1, text: '', options: ['', '', '', ''], correct: 0 }
  ]);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser({
          uid: currentUser.uid,
          email: currentUser.email,
          name: currentUser.displayName || currentUser.email.split('@')[0]
        });
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch User's Specific Quizzes
  const fetchMyQuizzes = () => {
    if (!user) return;
    fetch(`${BACKEND_URL}/api/user/quizzes?userId=${user.uid}`)
      .then((res) => res.json())
      .then((data) => setQuizzesList(data))
      .catch((err) => console.error('Error fetching quizzes:', err));
  };

  // Fetch User's Quiz Submissions
  const fetchMyResults = () => {
    if (!user) return;
    fetch(`${BACKEND_URL}/api/user/results?userId=${user.uid}`)
      .then((res) => res.json())
      .then((data) => setResults(data))
      .catch((err) => console.error('Error fetching results:', err));
  };

  // Socket Connections for Live Monitoring
  useEffect(() => {
    if (!user) return;

    fetchMyQuizzes();
    fetchMyResults();

    socket.on('active_sessions_update', (sessions) => setActiveSessions(sessions));
    socket.on('proctor_alert', (alert) => setAlerts((prev) => [alert, ...prev]));
    socket.on('admin_result_update', (newResult) => {
      if (newResult.quizOwnerId === user.uid) {
        setResults((prev) => [newResult, ...prev]);
      }
    });

    return () => {
      socket.off('active_sessions_update');
      socket.off('proctor_alert');
      socket.off('admin_result_update');
    };
  }, [user]);

  // Login Check Guardrail
  if (!user) {
    return <AuthModal onUserAuthenticated={(authenticatedUser) => setUser(authenticatedUser)} />;
  }

  // Reset Form
  const resetForm = () => {
    setEditingSubdomain(null);
    setTitle('');
    setSubdomainInput('');
    setTimeLimit(15);
    setPasscode('');
    setQuestions([{ id: 1, text: '', options: ['', '', '', ''], correct: 0 }]);
  };

  // Populate Form for Editing
  const handleEditQuiz = (quiz) => {
    setEditingSubdomain(quiz.subdomain);
    setTitle(quiz.title);
    setSubdomainInput(quiz.subdomain);
    setTimeLimit(quiz.timeLimitMinutes || 15);
    setPasscode(quiz.passcode || '');
    setQuestions(quiz.questions || [{ id: 1, text: '', options: ['', '', '', ''], correct: 0 }]);
    setTab('create');
  };

  // Save / Publish Quiz
  const handleSaveQuiz = async () => {
    if (!title || !subdomainInput) {
      alert('Please fill in both Quiz Title and Subdomain Slug.');
      return;
    }

    const endpoint = editingSubdomain
      ? `${BACKEND_URL}/api/user/quizzes/${editingSubdomain}`
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
        questions,
        userId: user.uid,
        userEmail: user.email
      })
    });

    const data = await res.json();

    if (res.ok) {
      alert(editingSubdomain ? 'Quiz Updated Successfully!' : 'Quiz Created Successfully!');
      resetForm();
      fetchMyQuizzes();
      setTab('manage');
    } else {
      alert(data.message || 'Failed to save quiz.');
    }
  };

  // Start / End Quiz
  const handleUpdateStatus = async (subdomain, newStatus) => {
    const res = await fetch(`${BACKEND_URL}/api/user/quizzes/${subdomain}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    if (res.ok) fetchMyQuizzes();
  };

  // Restart Quiz
  const handleRestartQuiz = async (subdomain) => {
    if (!window.confirm('Restart test? Candidates will be able to join and submit again.')) return;

    const res = await fetch(`${BACKEND_URL}/api/user/quizzes/${subdomain}/restart`, {
      method: 'POST'
    });

    if (res.ok) {
      alert('Test restarted successfully!');
      fetchMyQuizzes();
    }
  };

  // Delete Quiz
  const handleDeleteQuiz = async (subdomain) => {
    if (!window.confirm(`Delete quiz "?quiz=${subdomain}" permanently?`)) return;

    const res = await fetch(`${BACKEND_URL}/api/user/quizzes/${subdomain}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      alert('Quiz deleted!');
      fetchMyQuizzes();
    }
  };

  // Delete Result Record
  const handleDeleteResult = async (id) => {
    if (!window.confirm('Delete this candidate response record?')) return;

    const res = await fetch(`${BACKEND_URL}/api/user/results/${id}`, {
      method: 'DELETE'
    });

    if (res.ok) fetchMyResults();
  };

  // Import Questions from Word Document (.docx)
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
          alert(`Successfully imported ${parsedQuestions.length} questions from Word document!`);
        } else {
          alert('Could not detect any questions in the uploaded document.');
        }
      } catch (error) {
        alert('Error parsing Word document.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Word Document Text Parser
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

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-slate-200 my-6">
      {/* User Info Bar */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Quiz Creator Studio</h1>
          <p className="text-xs text-slate-500">Signed in as: <strong className="text-slate-700">{user.email}</strong></p>
        </div>

        <button
          onClick={() => signOut(auth)}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 border border-slate-300 rounded hover:border-red-300 transition flex items-center space-x-1"
        >
          <span>🚪 Sign Out</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-6 border-b border-slate-200 mb-6">
        {['manage', 'create', 'live', 'results'].map((t) => (
          <button
            key={t}
            onClick={() => {
              if (t === 'create' && !editingSubdomain) resetForm();
              setTab(t);
            }}
            className={`pb-3 capitalize font-semibold text-sm border-b-2 transition ${
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
              : 'Submissions'}
          </button>
        ))}
      </div>

      {/* TAB 1: Manage Tests */}
      {tab === 'manage' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800">Your Quizzes</h2>
            <button
              onClick={() => {
                resetForm();
                setTab('create');
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 shadow-sm"
            >
              + Create New Quiz
            </button>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Quiz Title</th>
                  <th className="p-3">Share Link Slug</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {quizzesList.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="p-4 text-center text-slate-500">
                      You haven't created any quizzes yet. Click "+ Create New Quiz" to start.
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

      {/* TAB 2: Create / Edit Form */}
      {tab === 'create' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800">
              {editingSubdomain ? `Edit Quiz (${editingSubdomain})` : 'Create New Assessment'}
            </h2>

            <label className="cursor-pointer bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-md text-xs font-semibold border border-indigo-200 transition flex items-center space-x-1">
              <span>📄 Import from Word (.docx)</span>
              <input type="file" accept=".docx" onChange={handleDocxUpload} className="hidden" />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700">Quiz Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Python Basics 101"
                className="mt-1 w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">Unique Link URL Slug</label>
              <input
                type="text"
                disabled={!!editingSubdomain}
                value={subdomainInput}
                onChange={(e) =>
                  setSubdomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                }
                placeholder="python-basics"
                className={`mt-1 w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none ${
                  editingSubdomain ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">Time Limit (Minutes)</label>
              <input
                type="number"
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
                className="mt-1 w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">Group Passcode (Optional)</label>
              <input
                type="text"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="PASS123"
                className="mt-1 w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Question Builder */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h3 className="text-base font-bold text-slate-800">Questions List</h3>

            {questions.map((q, idx) => (
              <div key={idx} className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-700 text-xs">Question {idx + 1}</span>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setQuestions(questions.filter((_, qIdx) => qIdx !== idx))}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>

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
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold border"
            >
              + Add Another Question
            </button>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={handleSaveQuiz}
              className="flex-1 py-3 bg-indigo-600 text-white font-semibold rounded-md shadow hover:bg-indigo-700 text-sm"
            >
              {editingSubdomain ? 'Update Quiz' : 'Publish Quiz'}
            </button>
            {editingSubdomain && (
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setTab('manage');
                }}
                className="px-6 py-3 bg-slate-100 text-slate-700 font-medium rounded-md border hover:bg-slate-200 text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Live Respondent Monitoring */}
      {tab === 'live' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-base font-bold text-slate-800">Active Test Takers</h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Candidate</th>
                    <th className="p-3">Quiz URL Slug</th>
                    <th className="p-3">Tab Switch Violations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeSessions.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="p-4 text-center text-slate-500">
                        No active participants right now.
                      </td>
                    </tr>
                  ) : (
                    activeSessions.map((s, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-800">{s.respondentName}</td>
                        <td className="p-3 text-slate-600">{s.quizId}</td>
                        <td className="p-3 font-semibold text-red-600">{s.focusLossCount || 0}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-800">Proctoring Alerts Log</h3>
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3 min-h-[220px] max-h-[400px] overflow-y-auto">
              {alerts.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No proctoring violations detected yet.</p>
              ) : (
                alerts.map((a, i) => (
                  <div key={i} className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                    <strong>{a.respondentName}</strong> left test window! ({a.focusLossCount} tab switches)
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Submissions / Results */}
      {tab === 'results' && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-800">Candidate Submissions</h3>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Candidate</th>
                  <th className="p-3">Quiz Title</th>
                  <th className="p-3">Score</th>
                  <th className="p-3">Percentage</th>
                  <th className="p-3">Proctoring Violations</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {results.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-4 text-center text-slate-500">
                      No candidate submissions recorded yet.
                    </td>
                  </tr>
                ) : (
                  results.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-800">{r.respondentName}</td>
                      <td className="p-3 text-slate-600">{r.quizTitle}</td>
                      <td className="p-3">{r.score} / {r.totalQuestions}</td>
                      <td className="p-3 font-semibold text-indigo-600">{r.percentage}%</td>
                      <td className="p-3 font-semibold text-slate-700">{r.focusLossCount || 0}</td>
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