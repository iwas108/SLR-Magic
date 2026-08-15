import React, { useState } from 'react';
import { StorageService } from '../StorageService';
import { decompressSlr } from '../lib/slrCompression';

const ImportWorkflow = ({ onNavigate }) => {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a .slr file.');
      return;
    }

    try {
      const parsedData = await decompressSlr(file);

      if (!parsedData.papers || !Array.isArray(parsedData.papers)) {
        setError('Invalid file format. The file must contain a "papers" array.');
        return;
      }

      const data = parsedData.papers;
      if (data.length === 0) {
        setError('The file contains no papers to review.');
        return;
      }

      // Validate Paper_ID presence
      if (!Object.keys(data[0]).includes('Paper_ID')) {
        setError('The papers must contain a "Paper_ID" attribute.');
        return;
      }

      const metadata = parsedData.metadata || {};

      // Create the session
      const session = await StorageService.createSession(file.name, data, metadata);
      onNavigate('prescreen', { sessionId: session.id });

    } catch (err) {
      setError(`Error reading .slr file: ${err.message}`);
    }
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
            <label htmlFor="slrFile" className="block text-sm font-medium mb-2">Select SLR Magic Export (.slr)</label>
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
              id="slrFile"
              accept=".slr,application/json"
              onChange={handleFileChange}
            />
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              File must be exported from SLR Magic (.slr) and contain papers with a "Paper_ID".
            </div>
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
