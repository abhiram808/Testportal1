import React, { useState, useEffect } from 'react';
import Admin from './Admin';
import Quiz from './Quiz';

export default function App() {
  const [subdomain, setSubdomain] = useState('');
  const [view, setView] = useState('admin'); // 'admin' or 'quiz'

  useEffect(() => {
    // Detect dynamic subdomains (e.g., math-101.yourdomain.com)
    const host = window.location.hostname;
    const parts = host.split('.');
    
    if (parts.length > 1 && parts[0] !== 'www' && parts[0] !== 'localhost') {
      setSubdomain(parts[0]);
      setView('quiz');
    } else {
      // Fallback: check query parameter ?quiz=math-101
      const params = new URLSearchParams(window.location.search);
      if (params.get('quiz')) {
        setSubdomain(params.get('quiz'));
        setView('quiz');
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      <header className="bg-indigo-600 text-white px-6 py-4 shadow-md flex justify-between items-center">
        <h1 className="text-xl font-bold tracking-tight">Testportal Engine</h1>
        <div className="space-x-2">
          <button 
            onClick={() => setView('admin')} 
            className={`px-3 py-1.5 rounded text-sm font-medium transition ${
              view === 'admin' ? 'bg-indigo-800' : 'bg-indigo-500 hover:bg-indigo-700'
            }`}>
            Admin Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto p-6 flex-grow">
        {view === 'admin' ? (
          <Admin />
        ) : (
          <Quiz subdomain={subdomain} />
        )}
      </main>
    </div>
  );
}