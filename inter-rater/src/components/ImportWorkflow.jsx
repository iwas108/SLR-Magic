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
    <div className="container mx-auto px-4 mt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Import New Review</h2>
        <button
          className="px-4 py-2 border border-gray-400 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          onClick={() => onNavigate('dashboard')}
        >
          Back to Dashboard
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="csvFile" className="block text-sm font-medium mb-2">Select Quality Check CSV</label>
            <input
              type="file"
              className="block w-full text-sm text-gray-500 dark:text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                dark:file:bg-blue-900 dark:file:text-blue-200
                hover:file:bg-blue-100 dark:hover:file:bg-blue-800
                border border-gray-300 dark:border-gray-600 rounded-md"
              id="csvFile"
              accept=".csv"
              onChange={handleFileChange}
            />
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              File must be exported from SLR Magic and contain a "Paper_ID" column.
            </div>
          </div>

          <div className="mb-6">
            <label htmlFor="reviewerName" className="block text-sm font-medium mb-2">Reviewer Name</label>
            <input
              type="text"
              className="block w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500"
              id="reviewerName"
              placeholder="e.g., Jane Doe"
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
            />
          </div>

          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            Start Review
          </button>
        </form>
      </div>
    </div>
  );
};

export default ImportWorkflow;
