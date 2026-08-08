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

  // Assessment Navigation State
  const [hasStarted, setHasStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0); // 👈 ONE-BY-ONE INDEX
  const [answers, setAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);

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

  // Handle Answer Submission
  const handleSubmitQuiz = async () => {
    if (!window.confirm('Are you sure you want to submit your assessment?')) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/quizzes/${subdomain}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respondentName: candidateName, answers })
      });

      const data = await response.json();

      if (response.ok) {
        setSubmissionResult(data);
        setIsSubmitted(true);
      } else {
        alert(data.message || 'Error submitting assessment.');
      }
    } catch (err) {
      alert('Error connecting to backend server.');
    }
  };

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

  // SCREEN 3: SUBMITTED SUCCESS & RESULT BREAKDOWN
  if (isSubmitted && submissionResult) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-xl shadow-md border border-slate-200 text-center space-y-6">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl font-bold">
          ✓
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-slate-800">Assessment Completed!</h2>
          <p className="text-sm text-slate-500">
            Great job, <strong className="text-slate-700">{candidateName}</strong>!
          </p>
        </div>

        {/* Score Summary Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-3">
          <div className="text-xs uppercase font-semibold text-slate-400">Your Final Result</div>
          
          <div className="text-4xl font-extrabold text-indigo-600">
            {submissionResult.score} / {submissionResult.totalQuestions}
          </div>

          <div className="text-sm font-semibold text-slate-700">
            Score: <span className="text-emerald-600 font-bold">{submissionResult.percentage}%</span>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Your response has been transmitted to the assessment host.
        </p>
      </div>
    );
  }

  // SCREEN 4: START QUIZ (Candidate Details Input)
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

  // Active Single Question Data
  const currentQuestion = quiz.questions ? quiz.questions[currentQuestionIndex] : null;
  const totalQuestions = quiz.questions ? quiz.questions.length : 0;
  const currentQuestionKey = currentQuestion ? (currentQuestion.id !== undefined ? currentQuestion.id : currentQuestionIndex) : currentQuestionIndex;

  // SCREEN 5: ONE-BY-ONE ACTIVE TEST TAKING
  return (
    <div className="max-w-3xl mx-auto my-8 p-6 bg-white rounded-xl border border-slate-200 shadow-sm space-y-6">
      {/* Header Bar */}
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{quiz.title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Question <span className="font-semibold text-indigo-600">{currentQuestionIndex + 1}</span> of {totalQuestions}
          </p>
        </div>
        <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-3 py-1 rounded-full border border-indigo-100">
          Candidate: {candidateName}
        </span>
      </div>

      {/* Question Number Palette / Navigation Pills */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {quiz.questions && quiz.questions.map((q, idx) => {
          const qKey = q.id !== undefined ? q.id : idx;
          const isAnswered = answers[qKey] !== undefined;
          const isCurrent = idx === currentQuestionIndex;

          return (
            <button
              key={idx}
              onClick={() => setCurrentQuestionIndex(idx)}
              className={`w-8 h-8 rounded-md text-xs font-semibold border transition ${
                isCurrent
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : isAnswered
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Single Active Question Box */}
      {currentQuestion ? (
        <div className="p-6 border border-slate-200 rounded-lg bg-slate-50 space-y-4">
          <p className="font-semibold text-slate-800 text-base">
            Q{currentQuestionIndex + 1}. {currentQuestion.text}
          </p>

          <div className="space-y-2.5 pt-2">
            {currentQuestion.options.map((opt, optIdx) => (
              <label
                key={optIdx}
                onClick={() => setAnswers({ ...answers, [currentQuestionKey]: optIdx })}
                className={`flex items-center space-x-3 p-3 rounded-md border cursor-pointer text-sm font-medium transition ${
                  answers[currentQuestionKey] === optIdx
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <input
                  type="radio"
                  name={`question-${currentQuestionIndex}`}
                  checked={answers[currentQuestionKey] === optIdx}
                  onChange={() => setAnswers({ ...answers, [currentQuestionKey]: optIdx })}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-slate-500 text-center py-6">No question content available.</p>
      )}

      {/* Action Controls: Previous, Save & Next, Submit */}
      <div className="flex justify-between items-center border-t pt-4">
        {/* Previous Button */}
        <button
          onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
          disabled={currentQuestionIndex === 0}
          className={`px-4 py-2 text-xs font-semibold rounded-md border transition ${
            currentQuestionIndex === 0
              ? 'opacity-40 bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          ← Previous
        </button>

        {/* Right Action: Save & Next OR Submit */}
        {currentQuestionIndex < totalQuestions - 1 ? (
          <button
            onClick={() => setCurrentQuestionIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow text-xs transition"
          >
            Save & Next →
          </button>
        ) : (
          <button
            onClick={handleSubmitQuiz}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md shadow text-xs transition"
          >
            ✓ Submit Assessment
          </button>
        )}
      </div>
    </div>
  );
}