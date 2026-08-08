// 1. ALL IMPORTS MUST BE AT THE VERY TOP OF THE FILE
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import AuthModal from './AuthModal';
import { auth, signOut } from './firebase';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const socket = io(BACKEND_URL);

export default function Quiz({ subdomain }) {
  const [user, setUser] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [respondentName, setRespondentName] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [passcodeEntered, setPasscodeEntered] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  // 2. LISTEN FOR FIREBASE AUTH CHANGES
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser({
          uid: currentUser.uid,
          email: currentUser.email,
          name: currentUser.displayName || currentUser.email.split('@')[0]
        });
        setRespondentName(currentUser.displayName || currentUser.email.split('@')[0]);
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // 3. FETCH QUIZ DATA
  useEffect(() => {
    if (!subdomain || !user) return;

    fetch(`${BACKEND_URL}/api/quizzes/${subdomain}`)
      .then((res) => {
        if (!res.ok) throw new Error('Quiz not found');
        return res.json();
      })
      .then((data) => setQuiz(data))
      .catch((err) => console.error('Error loading quiz:', err));
  }, [subdomain, user]);

  // SCREEN 1: LOGIN CHECK (Inside the function body)
  if (!user) {
    return <AuthModal onUserAuthenticated={(authenticatedUser) => setUser(authenticatedUser)} />;
  }

  // SCREEN 2: LOADING / NOT FOUND
  if (!quiz) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-xl shadow-sm border border-slate-200 text-center">
        <p className="text-slate-600 font-medium">Loading assessment...</p>
      </div>
    );
  }

  // SCREEN 3: TEST STATUS CHECKS
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

  // SCREEN 4: SUBMITTED SUCCESS
  if (isSubmitted) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-xl shadow-sm border border-slate-200 text-center space-y-4">
        <h2 className="text-2xl font-bold text-emerald-600">Assessment Submitted!</h2>
        <p className="text-slate-600">Thank you, {respondentName}. Your responses have been recorded.</p>
      </div>
    );
  }

  // SCREEN 5: START QUIZ / PASSCODE SCREEN
  if (!hasStarted) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-xl shadow-sm border border-slate-200 space-y-6">
        <div className="flex justify-between items-center border-b pb-3">
          <span className="text-xs text-slate-500 font-medium">Signed in as {user.email}</span>
          <button
            onClick={() => signOut(auth)}
            className="text-xs text-red-600 hover:underline font-semibold"
          >
            Sign Out
          </button>
        </div>

        <h1 className="text-xl font-bold text-slate-800 text-center">{quiz.title}</h1>

        {quiz.passcode && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Group Passcode</label>
            <input
              type="text"
              value={passcodeEntered}
              onChange={(e) => setPasscodeEntered(e.target.value)}
              placeholder="Enter passcode"
              className="w-full border border-slate-300 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {passcodeError && <p className="text-red-500 text-xs mt-1">{passcodeError}</p>}
          </div>
        )}

        <button
          onClick={() => {
            if (quiz.passcode && passcodeEntered.trim() !== quiz.passcode.trim()) {
              setPasscodeError('Invalid Group Passcode!');
              return;
            }
            setHasStarted(true);
            socket.emit('start_session', { subdomain, respondentName });
          }}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow text-sm transition"
        >
          Start Assessment
        </button>
      </div>
    );
  }

  // SCREEN 6: ACTIVE TEST TAKING
  return (
    <div className="max-w-2xl mx-auto my-8 p-6 bg-white rounded-xl border border-slate-200 space-y-6">
      <h2 className="text-xl font-bold text-slate-800">{quiz.title}</h2>
      
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
            body: JSON.stringify({ respondentName, answers })
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