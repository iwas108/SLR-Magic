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
  const pool_type = session.poolType || metadata.pool_type || metadata.poolType || 'CAL_Pool_A';
  const research_objective = metadata.research_objective || metadata.researchObjective || '';
  const research_questions = metadata.research_questions || metadata.researchQuestions || '';
  const research_manifesto = metadata.research_manifesto || metadata.researchManifesto || '';
  const inclusion_criteria = metadata.inclusion_criteria || metadata.inclusionCriteria || '';
  const exclusion_criteria = metadata.exclusion_criteria || metadata.exclusionCriteria || '';
  const ec_rules = metadata.ec_rules || metadata.ecRules || [];

  // New calibration context fields
  const quality_assurance_definition = metadata.quality_assurance_definition || metadata.qualityAssuranceDefinition || '';
  const qa_rules = metadata.qa_rules || metadata.qaRules || [];
  const extraction_rules = metadata.extraction_rules || metadata.extractionRules || [];

  const isPoolB = pool_type === 'CAL_Pool_B' || pool_type === 'pool_b';
  const isPoolC = pool_type === 'CAL_Pool_C' || pool_type === 'pool_c' || pool_type === 'QC_Batch';

  return (
    <div className="container mx-auto px-4 mt-4 pb-12">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">Research Context & Pre-Screen</h2>
            <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${isPoolC
              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300'
              : isPoolB
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
              }`}>
              {pool_type}
            </span>
          </div>
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
            <p className="text-gray-800 dark:text-gray-300 font-semibold text-lg leading-snug">{project_name}</p>
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
              <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed font-mono bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-855">{research_questions}</p>
            </div>
          )}

          {research_manifesto && (
            <div>
              <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Research Manifesto</h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-855">{research_manifesto}</p>
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
              <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-855">{exclusion_criteria}</p>
            </div>
          )}

          {ec_rules && ec_rules.length > 0 && !isPoolC && (
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

          {/* Conditional rendering of Quality Assurance details for Pool B and Pool C */}
          {(isPoolB || isPoolC) && quality_assurance_definition && (
            <div>
              <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Quality Assurance Definition</h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-855">{quality_assurance_definition}</p>
            </div>
          )}

          {/* Structured QA Rules for Pool C */}
          {isPoolC && qa_rules && qa_rules.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3">QA Scoring Rules</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {qa_rules.map((rule, idx) => (
                  <div key={idx} className="p-3.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-855 rounded-xl">
                    <span className="inline-block px-2.5 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-100/30 text-[10px] font-bold rounded mb-2">
                      {rule.code}
                    </span>
                    <p className="text-xs text-gray-800 dark:text-gray-300 leading-relaxed font-semibold">{rule.question}</p>
                    {((rule.score_1_logic || rule.score1Logic) || (rule.score_05_logic || rule.score05Logic) || (rule.score_0_logic || rule.score0Logic)) && (
                      <div className="mt-2 text-[10px] text-gray-500 dark:text-gray-400 space-y-1 bg-white dark:bg-gray-950 p-2 rounded-lg border dark:border-gray-800 font-semibold leading-relaxed">
                        {(rule.score_1_logic || rule.score1Logic) && (
                          <div className="flex gap-1.5">
                            <span className="font-bold text-blue-600 dark:text-blue-400 shrink-0">1.0:</span>
                            <span>{rule.score_1_logic || rule.score1Logic}</span>
                          </div>
                        )}
                        {(rule.score_05_logic || rule.score05Logic) && (
                          <div className="flex gap-1.5">
                            <span className="font-bold text-blue-600 dark:text-blue-400 shrink-0">0.5:</span>
                            <span>{rule.score_05_logic || rule.score05Logic}</span>
                          </div>
                        )}
                        {(rule.score_0_logic || rule.score0Logic) && (
                          <div className="flex gap-1.5">
                            <span className="font-bold text-blue-600 dark:text-blue-400 shrink-0">0.0:</span>
                            <span>{rule.score_0_logic || rule.score0Logic}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Structured Data Extraction Rules for Pool C */}
          {isPoolC && extraction_rules && extraction_rules.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3">Data Extraction Schema</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {extraction_rules.map((rule, idx) => (
                  <div key={idx} className="p-3.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-855 rounded-xl">
                    <span className="inline-block px-2.5 py-0.5 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-100/30 text-[10px] font-mono rounded mb-2">
                      {rule.json_key || rule.key}
                    </span>
                    <p className="text-xs text-gray-800 dark:text-gray-300 leading-relaxed font-semibold">{rule.question}</p>
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
