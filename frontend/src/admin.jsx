// frontend/src/Admin.jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const socket = io(BACKEND_URL);

export default function Admin() {
  const [tab, setTab] = useState('create');
  const [activeSessions, setActiveSessions] = useState([]);
  const [results, setResults] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const [title, setTitle] = useState('');
  const [subdomainInput, setSubdomainInput] = useState('');
  const [timeLimit, setTimeLimit] = useState(15);
  const [questions, setQuestions] = useState([
    { id: 1, text: '', options: ['', '', '', ''], correct: 0 }
  ]);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/admin/results`)
      .then((res) => res.json())
      .then((data) => setResults(data))
      .catch((err) => console.error('Error loading results:', err));

    socket.on('active_sessions_update', (sessions) => setActiveSessions(sessions));
    socket.on('proctor_alert', (alert) => setAlerts((prev) => [alert, ...prev]));
    socket.on('admin_result_update', (newResult) => setResults((prev) => [newResult, ...prev]));

    return () => {
      socket.off('active_sessions_update');
      socket.off('proctor_alert');
      socket.off('admin_result_update');
    };
  }, []);

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      { id: questions.length + 1, text: '', options: ['', '', '', ''], correct: 0 }
    ]);
  };

  const handleSaveQuiz = async () => {
    if (!title || !subdomainInput) {
      alert('Please fill in both Title and Subdomain/Slug.');
      return;
    }

    const res = await fetch(`${BACKEND_URL}/api/quizzes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        subdomain: subdomainInput,
        timeLimitMinutes: Number(timeLimit),
        questions
      })
    });

    if (res.ok) {
      alert(`Quiz Published! Test Link: ${window.location.origin}/?quiz=${subdomainInput}`);
      setTitle('');
      setSubdomainInput('');
      setQuestions([{ id: 1, text: '', options: ['', '', '', ''], correct: 0 }]);
    }
  };

  return (
    
      
        {['create', 'live', 'results'].map((t) => (
           setTab(t)}
            className={`pb-2 px-1 capitalize font-medium text-sm border-b-2 transition ${
              tab === t
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'create'
              ? 'Create Quiz'
              : t === 'live'
              ? 'Live Respondent Monitor'
              : 'Test Results'}
          
        ))}
      

      {tab === 'create' && (
        
          Prepare New Assessment
          
          
            
              Quiz Title
               setTitle(e.target.value)}
                placeholder="e.g. Physics 101 Final Exam"
                className="mt-1 w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            
            
              Subdomain / Slug
              
                  setSubdomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                }
                placeholder="e.g. physics-final"
                className="mt-1 w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            
            
              Time Limit (Minutes)
               setTimeLimit(e.target.value)}
                className="mt-1 w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            
          

          
            Questions Builder
            {questions.map((q, idx) => (
              
                 {
                    const newQs = [...questions];
                    newQs[idx].text = e.target.value;
                    setQuestions(newQs);
                  }}
                  className="w-full border border-slate-300 rounded p-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                
                  {q.options.map((opt, optIdx) => (
                    
                       {
                          const newQs = [...questions];
                          newQs[idx].correct = optIdx;
                          setQuestions(newQs);
                        }}
                      />
                       {
                          const newQs = [...questions];
                          newQs[idx].options[optIdx] = e.target.value;
                          setQuestions(newQs);
                        }}
                        className="w-full border border-slate-300 rounded p-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    
                  ))}
                
              
            ))}
            
              + Add Question
            
          

          
            Publish Assessment
          
        
      )}

      {tab === 'live' && (
        
          
            Active Respondents Monitor
            
                {activeSessions.length === 0 ? (
                  
                ) : (
                  activeSessions.map((s) => (
                    
                  ))
                )}
              
              
                
                  Respondent
                  Quiz ID
                  Status
                  Tab Switches
                
              
              
                    
                      No respondents currently active.
                    
                  
                      {s.respondentName}
                      {s.quizId}
                      
                        
                          {s.status}
                        
                      
                      {s.focusLossCount}
                    
            
          

          
            Proctoring Alerts
            
              {alerts.length === 0 ? (
                No violations detected yet.
              ) : (
                alerts.map((a, i) => (
                  
                    {a.respondentName} switched tabs!
                    Violations count: {a.focusLossCount}
                    {a.timestamp}
                  
                ))
              )}
            
          
        
      )}

      {tab === 'results' && (
        
          Completed Submissions
          
              {results.length === 0 ? (
                
              ) : (
                results.map((r) => (
                  
                ))
              )}
            
            
              
                Respondent
                Quiz
                Score
                Percentage
                Violations
                Date
              
            
            
                  
                    No submissions recorded yet.
                  
                
                    {r.respondentName}
                    {r.quizTitle}
                    
                      {r.score} / {r.totalQuestions}
                    
                    {r.percentage}%
                    {r.focusLossCount}
                    
                      {new Date(r.submittedAt).toLocaleTimeString()}
                    
                  
          
        
      )}
    
  );
}