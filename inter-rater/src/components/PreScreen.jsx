import React, { useState, useEffect } from 'react';
import { StorageService } from '../StorageService';

const PreScreen = ({ sessionId, onNavigate }) => {
  const [session, setSession] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      const s = await StorageService.getSession(sessionId);
      if (s) {
        setSession(s);
      } else {
        onNavigate('dashboard');
      }
    };
    loadData();
  }, [sessionId, onNavigate]);

  if (!session) return <div className="p-8 text-center text-gray-550 dark:text-gray-400">Loading research context...</div>;

  const metadata = session.metadata || {};
  const project_name = session.projectName || metadata.project_name || metadata.projectName || 'Not specified';
  const research_objective = metadata.research_objective || metadata.researchObjective || '';
  const research_questions = metadata.research_questions || metadata.researchQuestions || '';
  const research_manifesto = metadata.research_manifesto || metadata.researchManifesto || '';
  const inclusion_criteria = metadata.inclusion_criteria || metadata.inclusionCriteria || '';
  const exclusion_criteria = metadata.exclusion_criteria || metadata.exclusionCriteria || '';
  const ec_rules = metadata.ec_rules || metadata.ecRules || [];

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
            <p className="text-gray-800 dark:text-gray-250 font-semibold text-lg leading-snug">{project_name}</p>
          </div>

          {research_objective && (
            <div>
              <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Research Objective</h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{research_objective}</p>
            </div>
          )}

          {research_questions && (
            <div>
              <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Research Questions</h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed font-mono bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-850">{research_questions}</p>
            </div>
          )}

          {research_manifesto && (
            <div>
              <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Research Manifesto</h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-850">{research_manifesto}</p>
            </div>
          )}

          {inclusion_criteria && (
            <div>
              <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Inclusion Criteria</h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{inclusion_criteria}</p>
            </div>
          )}

          {exclusion_criteria && (
            <div>
              <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Exclusion Criteria</h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-850">{exclusion_criteria}</p>
            </div>
          )}

          {ec_rules && ec_rules.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3">EC Rules (Exclusion Codes)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ec_rules.map((rule, idx) => (
                  <div key={idx} className="p-3.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-855 rounded-xl">
                    <span className="inline-block px-2.5 py-0.5 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-355 border border-rose-105 dark:border-rose-900/30 text-[10px] font-bold rounded mb-2">
                      {rule.code}
                    </span>
                    <p className="text-xs text-gray-650 dark:text-gray-300 leading-relaxed">{rule.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Ready to begin?</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Start evaluating papers sequentially using double-blind criteria.
            </p>
          </div>
          <button
            onClick={() => onNavigate('review', { sessionId })}
            className="w-full md:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all text-sm flex items-center justify-center gap-2"
          >
            Start Blinded Review
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreScreen;
