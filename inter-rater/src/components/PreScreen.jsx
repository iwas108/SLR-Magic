import React, { useState, useEffect } from 'react';
import { StorageService } from '../StorageService';

const PreScreen = ({ sessionId, onNavigate }) => {
  const [session, setSession] = useState(null);
  const [reviewerName, setReviewerName] = useState('');

  useEffect(() => {
    const loadData = async () => {
      const s = await StorageService.getSession(sessionId);
      if (s) {
        setSession(s);
        setReviewerName(s.reviewerName || '');
      } else {
        onNavigate('dashboard');
      }
    };
    loadData();
  }, [sessionId, onNavigate]);

  const handleStartReviewing = async (e) => {
    e.preventDefault();
    if (!reviewerName.trim()) return;

    await StorageService.updateSession(sessionId, { reviewerName: reviewerName.trim() });
    onNavigate('review', { sessionId });
  };

  if (!session) return <div className="p-8 text-center">Loading research context...</div>;

  const metadata = session.metadata || {};

  return (
    <div className="container mx-auto px-4 mt-4 pb-12">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">Research Context & Pre-Screen</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Review the objectives and criteria before starting evaluation.</p>
        </div>
        <button
          className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-sm font-semibold transition-colors"
          onClick={() => onNavigate('dashboard')}
        >
          Back to Dashboard
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          <div>
            <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Project Name</h3>
            <p className="text-gray-800 dark:text-gray-250 font-semibold text-lg leading-snug">{session.projectName || 'Not specified'}</p>
          </div>

          {metadata.researchObjective && (
            <div>
              <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Research Objective</h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{metadata.researchObjective}</p>
            </div>
          )}

          {metadata.researchQuestions && (
            <div>
              <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Research Questions</h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed font-mono bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">{metadata.researchQuestions}</p>
            </div>
          )}

          {metadata.researchManifesto && (
            <div>
              <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Research Manifesto</h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">{metadata.researchManifesto}</p>
            </div>
          )}

          {metadata.inclusionCriteria && (
            <div>
              <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Inclusion Criteria</h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{metadata.inclusionCriteria}</p>
            </div>
          )}

          {metadata.exclusionCriteria && (
            <div>
              <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Exclusion Criteria</h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">{metadata.exclusionCriteria}</p>
            </div>
          )}

          {metadata.ecRules && metadata.ecRules.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3">EC Rules (Exclusion Codes)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {metadata.ecRules.map((rule, idx) => (
                  <div key={idx} className="p-3.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl">
                    <span className="inline-block px-2 py-0.5 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-100 dark:border-rose-900/30 text-[10px] font-bold rounded mb-2">
                      {rule.code}
                    </span>
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{rule.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <form onSubmit={handleStartReviewing} className="space-y-4">
            <div>
              <label htmlFor="reviewerName" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Verify Reviewer Name
              </label>
              <input
                type="text"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all"
                id="reviewerName"
                placeholder="e.g., Jane Doe"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!reviewerName.trim()}
            >
              Start Reviewing
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PreScreen;
