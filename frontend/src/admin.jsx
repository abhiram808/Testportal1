// frontend/src/Admin.jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import mammoth from 'mammoth';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const socket = io(BACKEND_URL);

export default function Admin() {
  const [tab, setTab] = useState('create');
  const [activeSessions, setActiveSessions] = useState([]);
  const [results, setResults] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const [title, setTitle] = useState('');
  const [subdomainInput, setSubdomainInput] = useState('');
  const [timeLimit, setTimeLimit] = useState(15);
  const [passcode, setPasscode] = useState(''); // Added Passcode State
  const [questions, setQuestions] = useState([
    { id: 1, text: '', options: ['', '', '', ''], correct: 0 }
  ]);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/admin/results`)
      .then((res) => res.json())
      .then((data) => setResults(data))
      .catch((err) => console.error('Error loading results:', err));

    socket.on('active_sessions_update', (sessions) => setActiveSessions(sessions));
    socket.on('proctor_alert', (alert) => setAlerts((prev) => [alert, ...prev]));
    socket.on('admin_result_update', (newResult) => setResults((prev) => [newResult, ...prev]));

    return () => {
      socket.off('active_sessions_update');
      socket.off('proctor_alert');
      socket.off('admin_result_update');
    };
  }, []);

  const handleDocxUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const result = await mammoth.extractRawText({ arrayBuffer });
        const rawText = result.value;

        const parsedQuestions = parseQuizText(rawText);
        if (parsedQuestions.length > 0) {
          setQuestions(parsedQuestions);
          alert(`Successfully imported ${parsedQuestions.length} questions from Word document!`);
        } else {
          alert('Could not detect any questions. Please check Word document format.');
        }
      } catch (error) {
        console.error('Docx Parse Error:', error);
        alert('Error reading Word document file.');
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
        if (letter === 'A' || letter === '1') correctIdx = 0;
        else if (letter === 'B' || letter === '2') correctIdx = 1;
        else if (letter === 'C' || letter === '3') correctIdx = 2;
        else if (letter === 'D' || letter === '4') correctIdx = 3;

        currentQ.correct = correctIdx;
        parsed.push(currentQ);
        currentQ = null;
      } else if (optMatch && currentQ) {
        currentQ.options.push(optMatch[1]);
      } else if (qMatch) {
        if (currentQ) parsed.push(currentQ);
        currentQ = {
          id: parsed.length + 1,
          text: qMatch[1],
          options: [],
          correct: 0
        };
      }
    });

    if (currentQ) parsed.push(currentQ);

    return parsed.map((q) => {
      while (q.options.length < 4) {
        q.options.push(`Option ${q.options.length + 1}`);
      }
      return q;
    });
  };

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      { id: questions.length + 1, text: '', options: ['', '', '', ''], correct: 0 }
    ]);
  };

  const handleSaveQuiz = async () => {
    if (!title || !subdomainInput) {
      alert('Please fill in both Title and Subdomain/Slug.');
      return;
    }

    const res = await fetch(`${BACKEND_URL}/api/quizzes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        subdomain: subdomainInput,
        timeLimitMinutes: Number(timeLimit),
        passcode, // Sending passcode to backend
        questions
      })
    });

    if (res.ok) {
      alert(`Quiz Published! Test Link: ${window.location.origin}/?quiz=${subdomainInput}`);
      setTitle('');
      setSubdomainInput('');
      setPasscode('');
      setQuestions([{ id: 1, text: '', options: ['', '', '', ''], correct: 0 }]);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-slate-200 my-6">
      {/* Tabs Header */}
      <div className="flex space-x-8 border-b border-slate-200 mb-6">
        {['create', 'live', 'results'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 px-1 capitalize font-medium text-sm border-b-2 transition ${
              tab === t
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'create'
              ? 'Create Quiz'
              : t === 'live'
              ? 'Live Respondent Monitor'
              : 'Test Results'}
          </button>
        ))}
      </div>

      {/* Tab 1: Create Quiz */}
      {tab === 'create' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Prepare New Assessment</h2>

            <label className="cursor-pointer bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-md text-sm font-semibold border border-indigo-200 transition flex items-center space-x-2">
              <span>📄 Import from Word (.docx)</span>
              <input
                type="file"
                accept=".docx"
                onChange={handleDocxUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Quiz Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Physics 101 Final Exam"
                className="mt-1 w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Subdomain / Slug</label>
              <input
                type="text"
                value={subdomainInput}
                onChange={(e) =>
                  setSubdomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                }
                placeholder="e.g. physics-final"
                className="mt-1 w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Time Limit (Minutes)</label>
              <input
                type="number"
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
                className="mt-1 w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Group Passcode (Optional)</label>
              <input
                type="text"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="e.g. SECRET123"
                className="mt-1 w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <hr className="border-slate-200 my-6" />

          {/* Questions Builder */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-800">Questions Builder</h3>

            {questions.map((q, idx) => (
              <div key={q.id || idx} className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700 text-sm">Question {idx + 1}</span>
                </div>

                <input
                  type="text"
                  value={q.text}
                  onChange={(e) => {
                    const newQs = [...questions];
                    newQs[idx].text = e.target.value;
                    setQuestions(newQs);
                  }}
                  placeholder="Enter question prompt..."
                  className="w-full border border-slate-300 rounded p-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
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
                        className="text-indigo-600 focus:ring-indigo-500"
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
                        className="w-full border border-slate-300 rounded p-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddQuestion}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm font-medium border border-slate-300 transition"
            >
              + Add Question
            </button>
          </div>

          <div className="pt-4">
            <button
              type="button"
              onClick={handleSaveQuiz}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow transition"
            >
              Publish Assessment
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Live Monitor */}
      {tab === 'live' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Active Respondents Monitor</h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Respondent</th>
                    <th className="p-3">Quiz ID</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Tab Switches</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeSessions.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="p-4 text-center text-slate-500">
                        No respondents currently active.
                      </td>
                    </tr>
                  ) : (
                    activeSessions.map((s, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-800">{s.respondentName}</td>
                        <td className="p-3 text-slate-600">{s.quizId}</td>
                        <td className="p-3">
                          <span className="px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-800 font-medium">
                            {s.status || 'Active'}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-slate-700">{s.focusLossCount || 0}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Proctoring Alerts</h3>
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 min-h-[250px] space-y-3">
              {alerts.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No violations detected yet.</p>
              ) : (
                alerts.map((a, i) => (
                  <div key={i} className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                    <div className="font-semibold">{a.respondentName} switched tabs!</div>
                    <div className="text-xs text-red-600">Violations count: {a.focusLossCount}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Completed Results */}
      {tab === 'results' && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-800">Completed Submissions</h3>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Respondent</th>
                  <th className="p-3">Quiz</th>
                  <th className="p-3">Score</th>
                  <th className="p-3">Percentage</th>
                  <th className="p-3">Violations</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {results.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-4 text-center text-slate-500">
                      No submissions recorded yet.
                    </td>
                  </tr>
                ) : (
                  results.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-800">{r.respondentName}</td>
                      <td className="p-3 text-slate-600">{r.quizTitle}</td>
                      <td className="p-3">
                        {r.score} / {r.totalQuestions}
                      </td>
                      <td className="p-3 font-semibold text-indigo-600">{r.percentage}%</td>
                      <td className="p-3 text-slate-700">{r.focusLossCount || 0}</td>
                      <td className="p-3 text-slate-500">
                        {r.submittedAt ? new Date(r.submittedAt).toLocaleTimeString() : 'N/A'}
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