// frontend/src/quiz.jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const socket = io(BACKEND_URL);

export default function Quiz({ subdomain }) {
  const [quiz, setQuiz] = useState(null);

  const [respondentName, setRespondentName] = useState(() => {
    return localStorage.getItem(`quiz_${subdomain}_name`) || '';
  });
  const [passcode, setPasscode] = useState(''); // Passcode Entry State
  const [hasStarted, setHasStarted] = useState(() => {
    return localStorage.getItem(`quiz_${subdomain}_started`) === 'true';
  });
  const [answers, setAnswers] = useState(() => {
    const saved = localStorage.getItem(`quiz_${subdomain}_answers`);
    return saved ? JSON.parse(saved) : {};
  });
  const [focusLossCount, setFocusLossCount] = useState(() => {
    const saved = localStorage.getItem(`quiz_${subdomain}_violations`);
    return saved ? Number(saved) : 0;
  });

  const [isSubmitted, setIsSubmitted] = useState(() => {
    return localStorage.getItem(`quiz_${subdomain}_submitted`) === 'true';
  });
  const [scoreResult, setScoreResult] = useState(() => {
    const saved = localStorage.getItem(`quiz_${subdomain}_score`);
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/quizzes/${subdomain}`)
      .then((res) => res.json())
      .then((data) => setQuiz(data))
      .catch((err) => console.error('Error fetching quiz:', err));
  }, [subdomain]);

  useEffect(() => {
    if (hasStarted && !isSubmitted) {
      localStorage.setItem(`quiz_${subdomain}_name`, respondentName);
      localStorage.setItem(`quiz_${subdomain}_started`, 'true');
      localStorage.setItem(`quiz_${subdomain}_answers`, JSON.stringify(answers));
      localStorage.setItem(`quiz_${subdomain}_violations`, focusLossCount.toString());
    }
  }, [hasStarted, isSubmitted, respondentName, answers, focusLossCount, subdomain]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasStarted && !isSubmitted) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasStarted, isSubmitted]);

  useEffect(() => {
    if (!hasStarted || isSubmitted) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setFocusLossCount((prev) => {
          const updated = prev + 1;
          socket.emit('tab_switch_detected', {
            subdomain,
            respondentName,
            focusLossCount: updated,
            timestamp: new Date().toISOString()
          });
          return updated;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [hasStarted, isSubmitted, subdomain, respondentName]);

  const handleStart = () => {
    if (!respondentName.trim()) {
      alert('Please enter your full name to start.');
      return;
    }

    // Check Passcode Validation
    if (quiz.passcode && passcode.trim() !== quiz.passcode) {
      alert('Incorrect Group Passcode! Please check and try again.');
      return;
    }

    setHasStarted(true);
    socket.emit('start_session', { subdomain, respondentName });
  };

  const handleSubmit = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/quizzes/${subdomain}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          respondentName,
          answers,
          focusLossCount
        })
      });

      if (res.ok) {
        const data = await res.json();
        setScoreResult(data);
        setIsSubmitted(true);

        localStorage.setItem(`quiz_${subdomain}_submitted`, 'true');
        localStorage.setItem(`quiz_${subdomain}_score`, JSON.stringify(data));

        localStorage.removeItem(`quiz_${subdomain}_started`);
        localStorage.removeItem(`quiz_${subdomain}_answers`);
        localStorage.removeItem(`quiz_${subdomain}_violations`);
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.message || 'Submission failed. Please try again.');
      }
    } catch (err) {
      console.error('Submission error:', err);
      alert('Network error when submitting your quiz.');
    }
  };

  if (!quiz) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-xl shadow-sm border border-slate-200 text-center">
        <p className="text-slate-600 font-medium">
          Loading assessment or quiz not found. Try navigating via ?quiz=YOUR_SLUG.
        </p>
      </div>
    );
  }

  if (isSubmitted) {
    const score =
      scoreResult?.score ??
      scoreResult?.correctCount ??
      scoreResult?.correct ??
      0;

    const totalQuestions =
      scoreResult?.totalQuestions ??
      scoreResult?.total ??
      quiz?.questions?.length ??
      0;

    const percentage =
      scoreResult?.percentage ??
      (totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0);

    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-xl shadow-sm border border-slate-200 text-center space-y-4">
        <h2 className="text-2xl font-bold text-emerald-600">
          Assessment Submitted!
        </h2>
        <p className="text-slate-600">
          Thank you, {respondentName || 'Candidate'}. Your responses have been recorded.
        </p>

        <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 my-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Your Final Score
          </p>
          <p className="text-4xl font-extrabold text-indigo-600 my-2">
            {score} / {totalQuestions}
          </p>
          <p className="text-sm font-medium text-slate-600">
            {percentage}%
          </p>
        </div>
      </div>
    );
  }
  // Screen: Test Status Check inside Quiz.jsx
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
  // Start Screen with Passcode Requirement
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

        <div className="space-y-4">
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

          {/* Render Passcode Input IF Quiz Has Passcode Set */}
          {quiz.passcode && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Group Passcode
              </label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter access code"
                className="mt-1 w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          )}
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
      {focusLossCount > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 font-medium text-sm">
          ⚠️ Warning: Tab switch detected! (Total violations: {focusLossCount})
        </div>
      )}

      <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{quiz.title}</h1>
          <p className="text-sm text-slate-500">Respondent: {respondentName}</p>
        </div>
        {focusLossCount > 0 && (
          <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
            Tab Switches: {focusLossCount}
          </span>
        )}
      </div>

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