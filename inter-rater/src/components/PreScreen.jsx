import React, { useState, useEffect } from 'react';
import { StorageService } from '../StorageService';

const PreScreen = ({ sessionId, onNavigate }) => {
  const [session, setSession] = useState(null);
  const [reviewerName, setReviewerName] = useState('');

  useEffect(() => {
    const s = StorageService.getSession(sessionId);
    if (s) {
      setSession(s);
      setReviewerName(s.reviewerName || '');
    } else {
      onNavigate('dashboard');
    }
  }, [sessionId, onNavigate]);

  const handleStartReviewing = (e) => {
    e.preventDefault();
    if (!reviewerName.trim()) return;

    StorageService.updateSession(sessionId, { reviewerName: reviewerName.trim() });
    onNavigate('review', { sessionId });
  };

  if (!session) return <div className="p-4">Loading...</div>;

  const metadata = session.metadata || {};

  return (
    <div className="container mx-auto px-4 mt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Research Context</h2>
        <button
          className="px-4 py-2 border border-gray-400 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          onClick={() => onNavigate('dashboard')}
        >
          Back to Dashboard
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-2">Project Name</h3>
          <p className="text-gray-700 dark:text-gray-300">{metadata.PROJECT_NAME || 'Not specified'}</p>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-2">Research Questions</h3>
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{metadata.RESEARCH_QUESTIONS || 'Not specified'}</p>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-2">Inclusion Criteria</h3>
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{metadata.INCLUSION_CRITERIA || 'Not specified'}</p>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-2">Exclusion Criteria</h3>
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{metadata.EXCLUSION_CRITERIA || 'Not specified'}</p>
        </div>

        {metadata.ecRules && metadata.ecRules.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-2">EC Rules (Exclusion Codes)</h3>
            <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
              {metadata.ecRules.map((rule, idx) => (
                <li key={idx}>
                  <strong>{rule.code}</strong>: {rule.description}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <form onSubmit={handleStartReviewing}>
          <div className="mb-6">
            <label htmlFor="reviewerName" className="block text-sm font-medium mb-2">Reviewer Name</label>
            <input
              type="text"
              className="block w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500"
              id="reviewerName"
              placeholder="e.g., Jane Doe"
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!reviewerName.trim()}
          >
            Start Reviewing
          </button>
        </form>
      </div>
    </div>
  );
};

export default PreScreen;
