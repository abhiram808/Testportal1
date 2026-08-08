// frontend/src/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import mammoth from 'mammoth';
import AuthModal from './AuthModal';
import { auth, signOut } from './firebase';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const socket = io(BACKEND_URL);

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('manage');
  const [quizzesList, setQuizzesList] = useState([]);
  const [results, setResults] = useState([]);

  // Form State
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

  const fetchMyQuizzes = () => {
    if (!user) return;
    fetch(`${BACKEND_URL}/api/user/quizzes?userId=${user.uid}`)
      .then((res) => res.json())
      .then((data) => setQuizzesList(data))
      .catch((err) => console.error(err));
  };

  const fetchMyResults = () => {
    if (!user) return;
    fetch(`${BACKEND_URL}/api/user/results?userId=${user.uid}`)
      .then((res) => res.json())
      .then((data) => setResults(data))
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    if (user) {
      fetchMyQuizzes();
      fetchMyResults();
    }
  }, [user]);

  if (!user) {
    return <AuthModal onUserAuthenticated={(u) => setUser(u)} />;
  }

  const resetForm = () => {
    setEditingSubdomain(null);
    setTitle('');
    setSubdomainInput('');
    setTimeLimit(15);
    setPasscode('');
    setQuestions([{ id: 1, text: '', options: ['', '', '', ''], correct: 0 }]);
  };

  const handleSaveQuiz = async () => {
    if (!title || !subdomainInput) return alert('Title and Subdomain are required.');

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
      alert(editingSubdomain ? 'Quiz Updated!' : 'Quiz Created!');
      resetForm();
      fetchMyQuizzes();
      setTab('manage');
    } else {
      alert(data.message || 'Failed to save quiz.');
    }
  };

  const handleUpdateStatus = async (subdomain, newStatus) => {
    await fetch(`${BACKEND_URL}/api/user/quizzes/${subdomain}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    fetchMyQuizzes();
  };

  const handleDeleteQuiz = async (subdomain) => {
    if (!window.confirm('Delete this quiz?')) return;
    await fetch(`${BACKEND_URL}/api/user/quizzes/${subdomain}`, { method: 'DELETE' });
    fetchMyQuizzes();
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-slate-200 my-6">
      {/* Top Profile Header */}
      <div className="flex justify-between items-center border-b pb-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Creator Dashboard</h1>
          <p className="text-xs text-slate-500">Logged in as {user.email}</p>
        </div>
        <button
          onClick={() => signOut(auth)}
          className="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded hover:bg-red-50 transition"
        >
          Sign Out
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-6 border-b mb-6">
        {['manage', 'create', 'results'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 capitalize text-sm font-semibold border-b-2 transition ${
              tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'
            }`}
          >
            {t === 'manage' ? 'My Quizzes' : t === 'create' ? '+ Create New Quiz' : 'Submissions'}
          </button>
        ))}
      </div>

      {/* TAB 1: My Quizzes */}
      {tab === 'manage' && (
        <div className="space-y-4">
          <table className="w-full text-left text-sm border rounded-lg overflow-hidden">
            <thead className="bg-slate-100 font-semibold border-b">
              <tr>
                <th className="p-3">Title</th>
                <th className="p-3">Share Link</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {quizzesList.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-4 text-center text-slate-500">
                    You haven't created any quizzes yet.
                  </td>
                </tr>
              ) : (
                quizzesList.map((q) => (
                  <tr key={q.id}>
                    <td className="p-3 font-semibold">{q.title}</td>
                    <td className="p-3 text-indigo-600 font-mono text-xs">?quiz={q.subdomain}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase bg-indigo-50 text-indigo-700">
                        {q.status || 'draft'}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => handleUpdateStatus(q.subdomain, q.status === 'active' ? 'ended' : 'active')}
                        className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs"
                      >
                        {q.status === 'active' ? 'Stop Test' : 'Start Test'}
                      </button>
                      <button
                        onClick={() => handleDeleteQuiz(q.subdomain)}
                        className="px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: Create Quiz */}
      {tab === 'create' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700">Quiz Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Python Basics"
                className="w-full border rounded p-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Unique Link URL Slug</label>
              <input
                type="text"
                value={subdomainInput}
                onChange={(e) => setSubdomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="python-basics"
                className="w-full border rounded p-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Group Passcode (Optional)</label>
              <input
                type="text"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="PASS123"
                className="w-full border rounded p-2 text-sm mt-1"
              />
            </div>
          </div>

          <button
            onClick={handleSaveQuiz}
            className="w-full py-2.5 bg-indigo-600 text-white font-medium rounded text-sm shadow hover:bg-indigo-700"
          >
            Publish Quiz
          </button>
        </div>
      )}

      {/* TAB 3: Results */}
      {tab === 'results' && (
        <table className="w-full text-left text-sm border rounded-lg">
          <thead className="bg-slate-100 font-semibold border-b">
            <tr>
              <th className="p-3">Candidate</th>
              <th className="p-3">Quiz Title</th>
              <th className="p-3">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {results.map((r) => (
              <tr key={r.id}>
                <td className="p-3 font-medium">{r.respondentName}</td>
                <td className="p-3 text-slate-600">{r.quizTitle}</td>
                <td className="p-3 font-semibold text-indigo-600">{r.score}/{r.totalQuestions} ({r.percentage}%)</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}