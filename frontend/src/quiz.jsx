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
      
        Loading assessment or quiz not found. Try navigating via ?quiz=YOUR_SLUG.
      
    );
  }

  if (submitted) {
    return (
      
        Assessment Submitted
        
          Respondent: {respondentName}
        
        
          
            Score: {result.score} / {result.totalQuestions}
          
          
            Percentage: {result.percentage}%
          
          
            Focus Violations: {result.focusLossCount}
          
        
      
    );
  }

  if (!hasStarted) {
    return (
      
        {quiz.title}
        Time Limit: {quiz.timeLimitMinutes} minutes
        
        
          Notice: This test is proctored in real time. Switching tabs or leaving this browser window will log a violation and alert the exam host.
        

        
          Full Name
           setRespondentName(e.target.value)}
            placeholder="John Doe"
            className="mt-1 w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        

        
          Start Assessment
        
      
    );
  }

  return (
    
      {focusLossCount > 0 && (
        
          ⚠️ Warning: Tab switch detected! (Total violations: {focusLossCount})
        
      )}

      
        
          {quiz.title}
          Respondent: {respondentName}
        

        {quiz.questions.map((q, idx) => (
          
            
              {idx + 1}. {q.text}
            
            
              {q.options.map((opt, optIdx) => (
                
                   setAnswers({ ...answers, [q.id]: optIdx })}
                  />
                  {opt}
                
              ))}
            
          
        ))}

        
          Submit Answers
        
      
    
  );
}