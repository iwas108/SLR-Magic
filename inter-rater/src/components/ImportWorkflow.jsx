import React, { useState } from 'react';
import Papa from 'papaparse';
import { StorageService } from '../StorageService';

const ImportWorkflow = ({ onNavigate }) => {
  const [file, setFile] = useState(null);
  const [reviewerName, setReviewerName] = useState('');
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a CSV file.');
      return;
    }
    if (!reviewerName.trim()) {
      setError('Please enter your reviewer name.');
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length) {
          setError('Error parsing CSV file. Please ensure it is a valid CSV.');
          return;
        }

        const data = results.data;
        if (data.length === 0) {
          setError('The CSV file is empty.');
          return;
        }

        // Validate Paper_ID presence
        if (!Object.keys(data[0]).includes('Paper_ID')) {
          setError('The CSV must contain a "Paper_ID" column.');
          return;
        }

        // Create the session
        const session = StorageService.createSession(file.name, reviewerName.trim(), data);
        onNavigate('review', { sessionId: session.sessionId });
      },
      error: (err) => {
        setError(`Error parsing CSV: ${err.message}`);
      }
    });
  };

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Import New Review</h2>
        <button className="btn btn-outline-secondary" onClick={() => onNavigate('dashboard')}>
          Back to Dashboard
        </button>
      </div>

      <div className="card shadow-sm">
        <div className="card-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="csvFile" className="form-label">Select Quality Check CSV</label>
              <input
                type="file"
                className="form-control"
                id="csvFile"
                accept=".csv"
                onChange={handleFileChange}
              />
              <div className="form-text">
                File must be exported from SLR Magic and contain a "Paper_ID" column.
              </div>
            </div>

            <div className="mb-3">
              <label htmlFor="reviewerName" className="form-label">Reviewer Name</label>
              <input
                type="text"
                className="form-control"
                id="reviewerName"
                placeholder="e.g., Jane Doe"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary">Start Review</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ImportWorkflow;
