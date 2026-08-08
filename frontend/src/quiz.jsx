// frontend/src/quiz.jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const socket = io(BACKEND_URL);

export default function Quiz({ subdomain }) {
  const [quiz, setQuiz] = useState(null);
  
  // Candidate Inputs
  const [candidateName, setCandidateName] = useState('');
  const [passcodeEntered, setPasscodeEntered] = useState('');
  const [formError, setFormError] = useState('');

  // Assessment State
  const [hasStarted, setHasStarted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Fetch Quiz Details
  useEffect(() => {
    if (!subdomain) return;

    fetch(`${BACKEND_URL}/api/quizzes/${subdomain}`)
      .then((res) => {
        if (!res.ok) throw new Error('Quiz not found');
        return res.json();
      })
      .then((data) => setQuiz(data))
      .catch((err) => console.error('Error loading quiz:', err));
  }, [subdomain]);

  // SCREEN 1: LOADING / NOT FOUND
  if (!quiz) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-xl shadow-sm border border-slate-200 text-center">
        <p className="text-slate-600 font-medium">Loading assessment...</p>
      </div>
    );
  }

  // SCREEN 2: TEST STATUS CHECKS
  if (quiz.status === 'draft') {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-xl border border-slate-200 text-center">
        <h2 className="text-xl font-bold text-amber-600 mb-2">Test Not Started</h2>
        <p className="text-slate-600 text-sm">
          This assessment has not been started by the host yet. Please wait.
        </p>
      </div>
    );
  }

  if (quiz.status === 'ended') {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-xl border border-slate-200 text-center">
        <h2 className="text-xl font-bold text-red-600 mb-2">Test Closed</h2>
        <p className="text-slate-600 text-sm">
          This assessment is closed and is no longer accepting submissions.
        </p>
      </div>
    );
  }

  // SCREEN 3: SUBMITTED SUCCESS
  if (isSubmitted) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-xl shadow-sm border border-slate-200 text-center space-y-4">
        <h2 className="text-2xl font-bold text-emerald-600">Assessment Submitted!</h2>
        <p className="text-slate-600">Thank you, <strong>{candidateName}</strong>. Your responses have been recorded.</p>
      </div>
    );
  }

  // SCREEN 4: START QUIZ (Only Candidate Name & Passcode)
  if (!hasStarted) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-xl shadow-md border border-slate-200 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-slate-800">{quiz.title}</h1>
          <p className="text-xs text-slate-500">Please enter your name to begin the assessment</p>
        </div>

        {formError && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs font-medium text-center">
            {formError}
          </div>
        )}

        <div className="space-y-4">
          {/* Candidate Name Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Your Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Group Passcode Input (Only if set by host) */}
          {quiz.passcode && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Group Passcode <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={passcodeEntered}
                onChange={(e) => setPasscodeEntered(e.target.value)}
                placeholder="Enter passcode provided by host"
                className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>

        <button
          onClick={() => {
            setFormError('');
            if (!candidateName.trim()) {
              setFormError('Please enter your full name before starting.');
              return;
            }
            if (quiz.passcode && passcodeEntered.trim() !== quiz.passcode.trim()) {
              setFormError('Invalid Group Passcode!');
              return;
            }
            setHasStarted(true);
            socket.emit('start_session', { subdomain, respondentName: candidateName.trim() });
          }}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow text-sm transition"
        >
          Start Assessment
        </button>
      </div>
    );
  }

  // SCREEN 5: ACTIVE TEST TAKING
  return (
    <div className="max-w-2xl mx-auto my-8 p-6 bg-white rounded-xl border border-slate-200 space-y-6">
      <div className="flex justify-between items-center border-b pb-3">
        <h2 className="text-xl font-bold text-slate-800">{quiz.title}</h2>
        <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-3 py-1 rounded-full border border-indigo-100">
          Candidate: {candidateName}
        </span>
      </div>
      
      {quiz.questions && quiz.questions.map((q, idx) => (
        <div key={idx} className="p-4 border border-slate-200 rounded-lg space-y-3">
          <p className="font-medium text-slate-800 text-sm">{idx + 1}. {q.text}</p>
          <div className="space-y-2">
            {q.options.map((opt, optIdx) => (
              <label key={optIdx} className="flex items-center space-x-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name={`question-${idx}`}
                  checked={answers[q.id || idx] === optIdx}
                  onChange={() => setAnswers({ ...answers, [q.id || idx]: optIdx })}
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={async () => {
          await fetch(`${BACKEND_URL}/api/quizzes/${subdomain}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ respondentName: candidateName, answers })
          });
          setIsSubmitted(true);
        }}
        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md shadow transition"
      >
        Submit Assessment
      </button>
    </div>
  );
}