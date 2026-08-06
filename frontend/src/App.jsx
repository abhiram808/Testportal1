// frontend/src/App.jsx
import React from 'react';
import Admin from './admin.jsx';
import Quiz from './quiz.jsx';

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const quizParam = urlParams.get('quiz');

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {quizParam ? <Quiz subdomain={quizParam} /> : <Admin />}
    </div>
  );
}