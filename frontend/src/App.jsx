// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, useSearchParams, useParams } from 'react-router-dom';
import Admin from './admin.jsx';
import Quiz from './quiz.jsx';

// Wrapper to handle quiz param or path parameter
function QuizWrapper() {
  const { subdomain } = useParams();
  const [searchParams] = useSearchParams();
  const querySubdomain = searchParams.get('quiz');

  const activeSubdomain = subdomain || querySubdomain;

  if (!activeSubdomain) {
    return ;
  }

  return ;
}

export default function App() {
  return (
    
      
        
          {/* Home route: Shows Admin if no ?quiz= param, or Quiz if ?quiz=slug is present */}
          } />

          {/* Direct route for Admin panel */}
          } />

          {/* Direct URL path route for Quizzes (e.g., /quiz/math-101) */}
          } />

          {/* Fallback route */}
          } />
        
      
    
  );
}