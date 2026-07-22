import React, { useState, useEffect } from 'react';
import { StorageService } from '../StorageService';

const Dashboard = ({ onNavigate }) => {
  const [sessions, setSessions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPool, setSelectedPool] = useState('All');
  
  // Sort State
  const [sortField, setSortField] = useState('lastModified');
  const [sortOrder, setSortOrder] = useState('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // State for updating SLR
  const [updatingSessionId, setUpdatingSessionId] = useState(null);

  // State for Export Identity Modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSessionId, setExportSessionId] = useState(null);
  const [reviewerNameInput, setReviewerNameInput] = useState('');
  const [generatedSuffix, setGeneratedSuffix] = useState('');

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

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedPool, pageSize]);

  const handleResume = (sessionId) => {
    onNavigate('prescreen', { sessionId });
  };

  const handleDelete = async (sessionId) => {
    if (window.confirm('Are you sure you want to delete this session? All associated papers and review progress will be permanently deleted.')) {
      await StorageService.deleteSession(sessionId);
      await loadSessions();
    }
  };

  const handleExport = (sessionId) => {
    setExportSessionId(sessionId);
    const cached = localStorage.getItem('slr_reviewer_identity') || '';
    setReviewerNameInput(cached);
    const suffix = Math.floor(0x1000 + Math.random() * 0xF000).toString(16);
    setGeneratedSuffix(suffix);
    setShowExportModal(true);
  };

  const handleConfirmExport = async () => {
    const namePart = reviewerNameInput.trim();
    if (!namePart) {
      alert('Reviewer name cannot be empty.');
      return;
    }

    let reviewerName = '';
    if (/^[a-zA-Z0-9_]+_[a-fA-F0-9]{4}$/.test(namePart)) {
      reviewerName = namePart;
    } else {
      reviewerName = `${namePart.replace(/_[a-fA-F0-9]{4}$/, '')}_${generatedSuffix}`;
    }

    try {
      localStorage.setItem('slr_reviewer_identity', reviewerName);
      setShowExportModal(false);

      const payload = await StorageService.exportSession(exportSessionId, reviewerName);
      const session = sessions.find(s => s.id === exportSessionId);

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

  // Sort handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filter sessions based on search query and poolType selection
  const filteredSessions = sessions.filter(session => {
    const matchesSearch = 
      (session.projectName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (session.filename || '').toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesPool = 
      selectedPool === 'All' || 
      session.poolType === selectedPool;

    return matchesSearch && matchesPool;
  });

  // Sort sessions
  const sortedSessions = [...filteredSessions].sort((a, b) => {
    let aVal, bVal;
    if (sortField === 'projectName') {
      aVal = (a.projectName || '').toLowerCase();
      bVal = (b.projectName || '').toLowerCase();
    } else if (sortField === 'poolType') {
      aVal = (a.poolType || '').toLowerCase();
      bVal = (b.poolType || '').toLowerCase();
    } else if (sortField === 'totalPapers') {
      aVal = a.totalPapers || 0;
      bVal = b.totalPapers || 0;
    } else if (sortField === 'progress') {
      const rateA = a.totalPapers > 0 ? (a.completedPapers / a.totalPapers) : 0;
      const rateB = b.totalPapers > 0 ? (b.completedPapers / b.totalPapers) : 0;
      aVal = rateA;
      bVal = rateB;
    } else if (sortField === 'importedAt') {
      aVal = a.importedAt || 0;
      bVal = b.importedAt || 0;
    } else if (sortField === 'lastModified') {
      aVal = a.lastModified || 0;
      bVal = b.lastModified || 0;
    } else {
      aVal = a.lastModified || 0;
      bVal = b.lastModified || 0;
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination Slice
  const totalItems = sortedSessions.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedSessions = sortedSessions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Statistics calculation
  const totalSessions = sessions.length;
  const totalPapersCount = sessions.reduce((sum, s) => sum + (s.totalPapers || 0), 0);
  const totalCompletedPapers = sessions.reduce((sum, s) => sum + (s.completedPapers || 0), 0);
  const globalCompletionPercentage = totalPapersCount > 0 
    ? Math.round((totalCompletedPapers / totalPapersCount) * 100) 
    : 0;

  const poolTypes = ['All', 'CAL_Pool_A', 'CAL_Pool_B', 'CAL_Pool_C', 'QC_Batch'];

  return (
    <div className="container mx-auto px-4 mt-2 pb-12">
      {/* Upper header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
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

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Active Projects */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Active Projects</p>
            <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mt-0.5">{totalSessions}</h3>
          </div>
        </div>

        {/* Card 2: Ingested Papers */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Ingested Papers</p>
            <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mt-0.5">{totalPapersCount}</h3>
          </div>
        </div>

        {/* Card 3: Completed Appraisals */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Completed Reviews</p>
            <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mt-0.5">{totalCompletedPapers}</h3>
          </div>
        </div>

        {/* Card 4: Global Progress */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className="p-3 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Overall Progress</p>
            <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mt-0.5">{globalCompletionPercentage}%</h3>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 mb-6 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative w-full lg:w-96">
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

        <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
          <span className="text-xs font-semibold text-muted-foreground mr-2">Filter Pool:</span>
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

      {/* Table view */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 text-muted-foreground text-xs uppercase font-extrabold border-b border-gray-200 dark:border-gray-800">
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => handleSort('projectName')}>
                  <div className="flex items-center gap-1">
                    Project Name
                    {sortField === 'projectName' && (sortOrder === 'asc' ? ' 🔼' : ' 🔽')}
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => handleSort('poolType')}>
                  <div className="flex items-center gap-1">
                    Pool Type
                    {sortField === 'poolType' && (sortOrder === 'asc' ? ' 🔼' : ' 🔽')}
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => handleSort('totalPapers')}>
                  <div className="flex items-center gap-1">
                    Papers
                    {sortField === 'totalPapers' && (sortOrder === 'asc' ? ' 🔼' : ' 🔽')}
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => handleSort('progress')}>
                  <div className="flex items-center gap-1">
                    Progress
                    {sortField === 'progress' && (sortOrder === 'asc' ? ' 🔼' : ' 🔽')}
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => handleSort('importedAt')}>
                  <div className="flex items-center gap-1">
                    Imported Date
                    {sortField === 'importedAt' && (sortOrder === 'asc' ? ' 🔼' : ' 🔽')}
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => handleSort('lastModified')}>
                  <div className="flex items-center gap-1">
                    Last Modified
                    {sortField === 'lastModified' && (sortOrder === 'asc' ? ' 🔼' : ' 🔽')}
                  </div>
                </th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              {paginatedSessions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="max-w-xs mx-auto">
                      <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0l-8 5-8-5" />
                      </svg>
                      <p className="font-semibold text-xs text-gray-400 uppercase tracking-wider">No reviews found</p>
                      <p className="text-xs text-muted-foreground mt-1">Import a .slr file from your SLR IDE workspace to start.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedSessions.map(session => {
                  const completionRate = session.totalPapers > 0 
                    ? Math.round((session.completedPapers / session.totalPapers) * 100) 
                    : 0;
                  const isDone = session.completedPapers === session.totalPapers && session.totalPapers > 0;

                  return (
                    <tr key={session.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 dark:text-white truncate max-w-xs" title={session.projectName}>
                          {session.projectName}
                        </div>
                        <div className="text-xs text-gray-400 mt-1 font-mono truncate max-w-xs" title={session.filename}>
                          {session.filename}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-0.5 text-[10px] font-extrabold rounded-md border ${
                          session.poolType === 'CAL_Pool_A' 
                            ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/45 dark:border-purple-900/60 dark:text-purple-300' 
                            : session.poolType === 'CAL_Pool_B'
                            ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/45 dark:border-amber-900/60 dark:text-amber-300'
                            : (session.poolType === 'CAL_Pool_C' || session.poolType === 'QC_Batch')
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/45 dark:border-emerald-900/60 dark:text-emerald-300'
                            : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/45 dark:border-rose-900/60 dark:text-rose-300'
                        }`}>
                          {session.poolType}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-700 dark:text-gray-300 text-xs">
                        {session.totalPapers} papers
                      </td>
                      <td className="px-6 py-4 w-48">
                        <div className="flex items-center gap-3">
                          <div className="w-24 bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden shrink-0">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                isDone 
                                  ? 'bg-green-500' 
                                  : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                              }`}
                              style={{ width: `${completionRate}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold shrink-0 ${isDone ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"}`}>
                            {completionRate}%
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 mt-1 block">
                          {session.completedPapers} / {session.totalPapers} completed
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400 font-medium">
                        {new Date(session.importedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400 font-medium">
                        {new Date(session.lastModified).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:hover:bg-blue-900/65 dark:text-blue-300 rounded-lg transition-colors flex items-center justify-center"
                            onClick={() => handleResume(session.id)}
                            title={isDone ? 'Review Again' : 'Resume Review'}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          
                          <button
                            className="p-1.5 bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-900/40 dark:hover:bg-green-900/65 dark:text-green-300 rounded-lg transition-colors flex items-center justify-center"
                            onClick={() => handleExport(session.id)}
                            title="Export Results (.slr)"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>

                          <button
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:hover:bg-amber-900/65 dark:text-amber-300 rounded-lg transition-colors flex items-center justify-center"
                            onClick={() => handleUpdateSlrClick(session.id)}
                            title="Update SLR (Merge File)"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12" />
                            </svg>
                          </button>

                          <button
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/65 dark:text-rose-300 rounded-lg transition-colors flex items-center justify-center"
                            onClick={() => handleDelete(session.id)}
                            title="Delete Session"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalItems > 0 && (
          <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-bold text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>
                Showing {Math.min(totalItems, (currentPage - 1) * pageSize + 1)} to {Math.min(totalItems, currentPage * pageSize)} of {totalItems} projects
              </span>
              <div className="flex items-center gap-1.5">
                <span>Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer text-xs"
                >
                  {[5, 10, 20, 50].map(sz => (
                    <option key={sz} value={sz}>{sz} rows</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    currentPage === page
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
              <button
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showExportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full overflow-hidden shadow-2xl transform transition-all duration-300 scale-100">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Confirm Reviewer Identity
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Please enter your short name. An identity suffix will be generated to guarantee anonymity in the adjudication process.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                    Reviewer Short Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. onder"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all text-gray-950 dark:text-white"
                    value={reviewerNameInput}
                    onChange={(e) => setReviewerNameInput(e.target.value)}
                    autoFocus
                  />
                </div>
                
                {reviewerNameInput.trim() && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl">
                    <span className="block text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-0.5">
                      Preview Generated Identity
                    </span>
                    <span className="text-sm font-mono font-bold text-blue-700 dark:text-blue-300">
                      {/^[a-zA-Z0-9_]+_[a-fA-F0-9]{4}$/.test(reviewerNameInput.trim())
                        ? reviewerNameInput.trim()
                        : `${reviewerNameInput.trim().replace(/_[a-fA-F0-9]{4}$/, '')}_${generatedSuffix}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-800">
              <button
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                onClick={() => setShowExportModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!reviewerNameInput.trim()}
                onClick={handleConfirmExport}
              >
                Confirm & Export
              </button>
            </div>
          </div>
        </div>
      )}

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
