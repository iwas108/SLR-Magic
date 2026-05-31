import React, { useState, useEffect } from 'react';
import { StorageService } from '../StorageService';

const Dashboard = ({ onNavigate }) => {
  const [sessions, setSessions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPool, setSelectedPool] = useState('All');
  


  // State for updating SLR
  const [updatingSessionId, setUpdatingSessionId] = useState(null);

  const handleUpdateSlrClick = (sessionId) => {
    setUpdatingSessionId(sessionId);
    const inputEl = document.getElementById('update-slr-input');
    if (inputEl) {
      inputEl.value = '';
      inputEl.click();
    }
  };

  const handleUpdateSlrFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !updatingSessionId) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsedData = JSON.parse(event.target.result);
        if (!parsedData.papers || !Array.isArray(parsedData.papers)) {
          alert('Invalid file format. The file must contain a "papers" array.');
          return;
        }

        const data = parsedData.papers;
        if (data.length === 0) {
          alert('The file contains no papers.');
          return;
        }

        // Validate Paper_ID presence
        if (!data[0].Paper_ID) {
          alert('The papers must contain a "Paper_ID" attribute.');
          return;
        }

        const metadata = parsedData.metadata || {};

        if (window.confirm('This will update the project data. Papers not present in the new file will be removed, new papers will be added, and existing papers will have their metadata updated while preserving your review progress. Proceed?')) {
          await StorageService.updateSessionData(updatingSessionId, metadata, data);
          alert('Project SLR updated successfully!');
          await loadSessions();
        }
      } catch (err) {
        alert(`Error parsing JSON: ${err.message}`);
      } finally {
        setUpdatingSessionId(null);
      }
    };
    reader.onerror = () => {
      alert('Error reading file.');
      setUpdatingSessionId(null);
    };
    reader.readAsText(file);
  };

  const loadSessions = async () => {
    const data = await StorageService.getSessions();
    setSessions(data);
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleResume = (sessionId) => {
    onNavigate('prescreen', { sessionId });
  };

  const handleDelete = async (sessionId) => {
    if (window.confirm('Are you sure you want to delete this session? All associated papers and review progress will be permanently deleted.')) {
      await StorageService.deleteSession(sessionId);
      await loadSessions();
    }
  };

  const handleExport = async (sessionId) => {
    try {
      const payload = await StorageService.exportSession(sessionId);
      const session = sessions.find(s => s.id === sessionId);
      
      const jsonString = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);

      let outName = session.filename;
      if (outName.toLowerCase().endsWith('.slr')) {
        outName = `reviewed_${outName}`;
      } else {
        outName = `reviewed_${outName}.slr`;
      }

      link.setAttribute("download", outName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  };



  // Filter sessions based on search query and poolType selection
  const filteredSessions = sessions.filter(session => {
    const matchesSearch = 
      session.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.filename.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesPool = 
      selectedPool === 'All' || 
      session.poolType === selectedPool;

    return matchesSearch && matchesPool;
  });

  const poolTypes = ['All', 'CAL_Pool_A', 'CAL_Pool_B', 'CAL_Pool_C', 'QC_Audit_Batch'];

  return (
    <div className="container mx-auto px-4 mt-4 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Workspace Dashboard
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage your offline double-blind Systematic Literature Review sessions.
          </p>
        </div>
        <button
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg active:bg-blue-800 transition-all flex items-center gap-2"
          onClick={() => onNavigate('import')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          Import Review (.slr)
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 mb-8 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <input
            type="text"
            placeholder="Search projects or filenames..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mr-2">Filter Pool:</span>
          {poolTypes.map(pool => (
            <button
              key={pool}
              onClick={() => setSelectedPool(pool)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedPool === pool
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300'
              }`}
            >
              {pool === 'All' ? 'All Pools' : pool}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredSessions.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-12 text-center shadow-sm">
            <svg className="w-12 h-12 text-gray-350 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              {sessions.length === 0 
                ? 'No review sessions found in IndexedDB. Import a .slr file to get started.' 
                : 'No review sessions match your search and filter criteria.'}
            </p>
          </div>
        ) : (
          filteredSessions.map(session => {
            const completionRate = session.totalPapers > 0 
              ? Math.round((session.completedPapers / session.totalPapers) * 100) 
              : 0;

            const isDone = session.completedPapers === session.totalPapers && session.totalPapers > 0;

            return (
              <div 
                key={session.id} 
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-800 p-6 flex flex-col transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex justify-between items-start gap-4 mb-3">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2" title={session.projectName}>
                    {session.projectName}
                  </h3>
                  <span className={`shrink-0 inline-block px-2.5 py-1 text-xs font-bold rounded-full border ${
                    session.poolType === 'CAL_Pool_A' 
                      ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/45 dark:border-purple-900/60 dark:text-purple-300' 
                      : session.poolType === 'CAL_Pool_B'
                      ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/45 dark:border-amber-900/60 dark:text-amber-300'
                      : session.poolType === 'CAL_Pool_C'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/45 dark:border-emerald-900/60 dark:text-emerald-300'
                      : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/45 dark:border-rose-900/60 dark:text-rose-300'
                  }`}>
                    {session.poolType}
                  </span>
                </div>

                <div className="text-xs text-gray-400 mb-4 space-y-1">
                  <p className="truncate">File: <span className="font-semibold text-gray-600 dark:text-gray-300">{session.filename}</span></p>
                  <p>Reviewer: <span className="font-semibold text-gray-600 dark:text-gray-300">{session.reviewerName}</span></p>
                  <p>Imported: <span className="font-semibold text-gray-600 dark:text-gray-300">{new Date(session.importedAt).toLocaleString()}</span></p>
                </div>

                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between items-center text-xs font-semibold mb-2">
                    <span className="text-gray-500 dark:text-gray-400">Review Progress</span>
                    <span className={isDone ? "text-green-600 dark:text-green-400 font-bold" : "text-blue-600 dark:text-blue-400"}>
                      {session.completedPapers} / {session.totalPapers} ({completionRate}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isDone 
                          ? 'bg-green-500' 
                          : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                      }`}
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-gray-100 dark:border-gray-800">
                  <button
                    className="px-3.5 py-2 text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:hover:bg-blue-900/65 dark:text-blue-300 rounded-lg transition-colors flex items-center gap-1.5"
                    onClick={() => handleResume(session.id)}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {isDone ? 'Review Again' : 'Resume Review'}
                  </button>



                  <button
                    className="px-3.5 py-2 text-xs font-bold bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-900/40 dark:hover:bg-green-900/65 dark:text-green-300 rounded-lg transition-colors flex items-center gap-1.5"
                    onClick={() => handleExport(session.id)}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export Results
                  </button>

                  <button
                    className="px-3.5 py-2 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:hover:bg-amber-900/65 dark:text-amber-300 rounded-lg transition-colors flex items-center gap-1.5"
                    onClick={() => handleUpdateSlrClick(session.id)}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12" />
                    </svg>
                    Update SLR
                  </button>

                  <button
                    className="ml-auto px-3.5 py-2 text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/65 dark:text-rose-300 rounded-lg transition-colors flex items-center gap-1.5"
                    onClick={() => handleDelete(session.id)}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>


      <input
        type="file"
        id="update-slr-input"
        className="hidden"
        accept=".slr,application/json"
        onChange={handleUpdateSlrFileChange}
      />
    </div>
  );
};

export default Dashboard;
