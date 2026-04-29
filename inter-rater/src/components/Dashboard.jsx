import React, { useState, useEffect } from 'react';
import { StorageService } from '../StorageService';

const Dashboard = ({ onNavigate }) => {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    setSessions(StorageService.getSessions());
  }, []);

  const handleResume = (sessionId) => {
    onNavigate('review', { sessionId });
  };

  const handleDelete = (sessionId) => {
    if (window.confirm('Are you sure you want to delete this session? Un-exported progress will be lost.')) {
      StorageService.deleteSession(sessionId);
      setSessions(StorageService.getSessions());
    }
  };

  const handleExport = (sessionId) => {
    const session = StorageService.getSession(sessionId);
    if (!session) return;

    // Export the data as a JSON file matching the import format
    const exportPayload = {
      metadata: session.metadata || {},
      papers: session.data
    };

    const jsonString = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);

    // Ensure the downloaded file has a .slr extension (if original didn't have one) or append correctly.
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
  };

  return (
    <div className="container mx-auto px-4 mt-8">
      <h2 className="text-2xl font-bold mb-6">SLR Magic Inter-Rater Dashboard</h2>
      <div className="mb-8">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          onClick={() => onNavigate('import')}
        >
          Import New Review (.slr)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sessions.length === 0 ? (
          <div className="col-span-full">
            <p className="text-gray-500 dark:text-gray-400">No review sessions found. Import a .slr file to get started.</p>
          </div>
        ) : (
          sessions.map(session => (
            <div key={session.sessionId} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col">
              <h5 className="text-xl font-semibold mb-2">{session.filename}</h5>
              <h6 className="text-sm text-gray-600 dark:text-gray-400 mb-4">Reviewer: {session.reviewerName}</h6>
              <div className="mb-6 flex-grow text-gray-700 dark:text-gray-300 space-y-1">
                <p>
                  Status:{' '}
                  <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${session.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                    {session.status}
                  </span>
                </p>
                <p>Progress: {session.currentIndex} / {session.data.length}</p>
                <p>Last Modified: {new Date(session.lastModified).toLocaleString()}</p>
              </div>
              <div className="flex flex-wrap gap-2 mt-auto">
                <button
                  className="px-3 py-1.5 text-sm border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-600 dark:hover:text-white rounded transition-colors"
                  onClick={() => handleResume(session.sessionId)}
                >
                  {session.status === 'completed' ? 'Review Again' : 'Resume'}
                </button>
                <button
                  className="px-3 py-1.5 text-sm border border-green-600 text-green-600 hover:bg-green-600 hover:text-white dark:border-green-400 dark:text-green-400 dark:hover:bg-green-600 dark:hover:text-white rounded transition-colors"
                  onClick={() => handleExport(session.sessionId)}
                >
                  Export Results
                </button>
                <button
                  className="px-3 py-1.5 text-sm border border-red-600 text-red-600 hover:bg-red-600 hover:text-white dark:border-red-400 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white rounded transition-colors"
                  onClick={() => handleDelete(session.sessionId)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Dashboard;
