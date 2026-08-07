// frontend/src/Quiz.jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const socket = io(BACKEND_URL);

export default function Quiz({ subdomain }) {
  const [quiz, setQuiz] = useState(null);
  const [respondentName, setRespondentName] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [focusLossCount, setFocusLossCount] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (subdomain) {
      fetch(`${BACKEND_URL}/api/quizzes/${subdomain}`)
        .then((res) => res.json())
        .then((data) => setQuiz(data))
        .catch((err) => console.error('Error fetching quiz:', err));
    }
  }, [subdomain]);

  useEffect(() => {
    if (!hasStarted || submitted) return;

    const handleBlur = () => {
      setFocusLossCount((prev) => prev + 1);
      socket.emit('focus_lost');
    };

    const handleFocus = () => {
      socket.emit('focus_gained');
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [hasStarted, submitted]);

  const handleStart = () => {
    if (!respondentName.trim()) return alert('Please enter your full name.');
    setHasStarted(true);
    socket.emit('start_session', { quizId: subdomain, respondentName });
  };

  const handleSubmit = async () => {
    const res = await fetch(`${BACKEND_URL}/api/quizzes/${subdomain}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ respondentName, answers, focusLossCount })
    });
    const data = await res.json();
    setResult(data.result);
    setSubmitted(true);
  };

  if (!quiz) {
    return (
        <div className="p-6 text-center text-slate-600 font-medium">
            Loading assessment or quiz not found. Try navigating via ?quiz=YOUR_SLUG.
        </div>
    );
}

  if (isSubmitted) {
  return (
    <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-xl shadow-md text-center space-y-4 border border-slate-200">
      <h2 className="text-2xl font-bold text-emerald-600">
        Assessment Submitted!
      </h2>
      <p className="text-slate-600">
        Thank you! Your responses have been recorded successfully.
      </p>
    </div>
  );
}

  if (!hasStarted) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-xl shadow-sm border border-slate-200 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-800">{quiz.title}</h1>
          <p className="text-sm font-medium text-slate-500">
            Time Limit: {quiz.timeLimitMinutes} minutes
          </p>
        </div>

        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          <p className="font-semibold mb-1">Proctoring Notice</p>
          <p>
            This test is proctored in real time. Switching tabs or leaving this browser window will log a violation and alert the exam host.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Full Name
          </label>
          <input
            type="text"
            value={respondentName}
            onChange={(e) => setRespondentName(e.target.value)}
            placeholder="John Doe"
            className="mt-1 w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <button
          type="button"
          onClick={handleStart}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow transition"
        >
          Start Assessment
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto my-8 p-6 bg-white rounded-xl shadow-sm border border-slate-200 space-y-6">
      {/* Violation Alert Banner */}
      {focusLossCount > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 font-medium text-sm">
          ⚠️ Warning: Tab switch detected! (Total violations: {focusLossCount})
        </div>
      )}

      {/* Quiz Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-800">{quiz.title}</h1>
        <p className="text-sm text-slate-500">Respondent: {respondentName}</p>
      </div>

      {/* Questions List */}
      <div className="space-y-6">
        {quiz.questions && quiz.questions.map((q, idx) => (
          <div key={q.id || idx} className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-3">
            <p className="font-semibold text-slate-800">
              {idx + 1}. {q.text}
            </p>

            <div className="space-y-2">
              {q.options && q.options.map((opt, optIdx) => (
                <label
                  key={optIdx}
                  className="flex items-center space-x-3 p-2 bg-white rounded border border-slate-200 hover:bg-slate-100 cursor-pointer text-sm"
                >
                  <input
                    type="radio"
                    name={`question-${idx}`}
                    checked={answers[q.id || idx] === optIdx}
                    onChange={() => setAnswers({ ...answers, [q.id || idx]: optIdx })}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-slate-700">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Submit Button */}
      <button
        type="button"
        onClick={handleSubmit}
        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md shadow transition"
      >
        Submit Answers
      </button>
    </div>
  );
}