// frontend/src/App.jsx
import React from 'react';
import Quiz from './quiz';
import Dashboard from './Dashboard';

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const quizSlug = params.get('quiz');
  const isDashboard = window.location.pathname === '/dashboard' || window.location.pathname === '/admin';

  // 1. If user visits /dashboard or /admin, show their personal Creator Dashboard
  if (isDashboard) {
    return <Dashboard />;
  }

  // 2. If URL has ?quiz=SLUG, show the student assessment taking screen
  if (quizSlug) {
    return <Quiz subdomain={quizSlug} />;
  }

  // 3. Main Landing Page
  return (
    <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-xl shadow border border-slate-200 text-center space-y-4">
      <h1 className="text-2xl font-bold text-slate-800">Proctored Quiz Portal</h1>
      <p className="text-slate-600 text-sm">
        Sign in with Google to create your own quizzes and view responses.
      </p>
      <a
        href="/dashboard"
        className="inline-block px-4 py-2 bg-indigo-600 text-white font-medium text-sm rounded shadow hover:bg-indigo-700 transition"
      >
        Create & Host a Quiz
      </a>
    </div>
  );
}