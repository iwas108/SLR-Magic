import React, { useState, useEffect } from 'react';
import { StorageService } from '../StorageService';
import Papa from 'papaparse';

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

    // We export only the data array back to CSV
    const csv = Papa.unparse(session.data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `reviewed_${session.filename}`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container mt-4">
      <h2>SLR Magic Inter-Rater Dashboard</h2>
      <div className="mb-4">
        <button
          className="btn btn-primary"
          onClick={() => onNavigate('import')}
        >
          Import New Review (CSV)
        </button>
      </div>

      <div className="row">
        {sessions.length === 0 ? (
          <div className="col-12">
            <p className="text-muted">No review sessions found. Import a CSV to get started.</p>
          </div>
        ) : (
          sessions.map(session => (
            <div key={session.sessionId} className="col-md-6 mb-3">
              <div className="card shadow-sm">
                <div className="card-body">
                  <h5 className="card-title">{session.filename}</h5>
                  <h6 className="card-subtitle mb-2 text-muted">Reviewer: {session.reviewerName}</h6>
                  <p className="card-text">
                    Status: <span className={`badge ${session.status === 'completed' ? 'bg-success' : 'bg-warning text-dark'}`}>{session.status}</span>
                    <br/>
                    Progress: {session.currentIndex} / {session.data.length}
                    <br/>
                    Last Modified: {new Date(session.lastModified).toLocaleString()}
                  </p>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => handleResume(session.sessionId)}
                    >
                      {session.status === 'completed' ? 'Review Again' : 'Resume'}
                    </button>
                    <button
                      className="btn btn-sm btn-outline-success"
                      onClick={() => handleExport(session.sessionId)}
                    >
                      Export CSV
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDelete(session.sessionId)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Dashboard;
