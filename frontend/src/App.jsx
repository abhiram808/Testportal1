// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, useSearchParams, useParams } from 'react-router-dom';
import Admin from './admin.jsx';
import Quiz from './quiz.jsx';

function QuizResolver() {
  const { subdomain } = useParams();
  const [searchParams] = useSearchParams();
  const activeQuiz = subdomain || searchParams.get('quiz');

  if (activeQuiz) {
    return <Quiz subdomain={activeQuiz} />;
  }
  return <Admin />;
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 p-6">
        <Routes>
          <Route path="/" element={<QuizResolver />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/quiz/:subdomain" element={<QuizResolver />} />
          <Route path="*" element={<QuizResolver />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}