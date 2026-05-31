import React, { useState, useEffect } from 'react';
import { StorageService } from '../StorageService';
import BlindedReviewForm from './BlindedReviewForm';

const APPRAISAL_FIELDS = [
  'Reviewer_Decision', 'Reviewer_Reasoning', 'Reviewer_Confidence', 'Reviewer_EC_Code',
  'Human_Decision', 'Human_EC_Trigger', 'Human_Rationale', 'Reviewer_Name'
];

const ReviewScreen = ({ sessionId, onNavigate }) => {
  const [session, setSession] = useState(null);
  const [papers, setPapers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCookbookOpen, setIsCookbookOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [activeLeftTab, setActiveLeftTab] = useState('abstract');

  useEffect(() => {
    const loadSessionData = async () => {
      const s = await StorageService.getSession(sessionId);
      if (s) {
        setSession(s);
        const pList = await StorageService.getPapersForSession(sessionId);
        setPapers(pList);
        setCurrentIndex(s.currentIndex || 0);
      } else {
        onNavigate('dashboard');
      }
    };
    loadSessionData();
  }, [sessionId, onNavigate]);

  const handleInputChange = async (field, value) => {
    if (papers.length === 0) return;
    
    const activePaper = papers[currentIndex];
    const updates = { [field]: value };
    
    if (field === 'Human_Decision' || field === 'Reviewer_Decision') {
      updates.Human_Decision = value;
      updates.Reviewer_Decision = value;
    } else if (field === 'Human_Rationale' || field === 'Reviewer_Reasoning') {
      updates.Human_Rationale = value;
      updates.Reviewer_Reasoning = value;
    } else if (field === 'Human_EC_Trigger' || field === 'Reviewer_EC_Code') {
      updates.Human_EC_Trigger = value;
      updates.Reviewer_EC_Code = value;
    }

    const updatedAppraisal = { ...activePaper.appraisal, ...updates };
    
    // Update local state
    const newPapers = [...papers];
    newPapers[currentIndex] = {
      ...activePaper,
      appraisal: updatedAppraisal
    };
    setPapers(newPapers);

    // Save to IndexedDB
    setSaveStatus('saving');
    try {
      await StorageService.updatePaperAppraisal(sessionId, activePaper.Paper_ID, updates);
      setSaveStatus('saved');
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    }
  };

  const handleDynamicChange = async (key, subField, value) => {
    if (papers.length === 0) return;

    const activePaper = papers[currentIndex];
    const item = activePaper.appraisal[key] || { value: '', evidence: '' };
    const updatedItem = { ...item, [subField]: value };
    const updatedAppraisal = { ...activePaper.appraisal, [key]: updatedItem };

    // Update local state
    const newPapers = [...papers];
    newPapers[currentIndex] = {
      ...activePaper,
      appraisal: updatedAppraisal
    };
    setPapers(newPapers);

    // Save to IndexedDB
    setSaveStatus('saving');
    try {
      await StorageService.updatePaperAppraisal(sessionId, activePaper.Paper_ID, { [key]: updatedItem });
      setSaveStatus('saved');
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    }
  };

  const handleAddReasoningTemplate = async (newTemplate) => {
    if (!session) return;
    const currentTemplates = session.metadata?.reasoningTemplate || [];
    if (currentTemplates.includes(newTemplate)) {
      alert('Template already exists.');
      return;
    }
    const updatedTemplates = [...currentTemplates, newTemplate];
    
    setSaveStatus('saving');
    try {
      await StorageService.updateSession(sessionId, { reasoningTemplate: updatedTemplates });
      // Update local state
      setSession(prev => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          reasoningTemplate: updatedTemplates
        }
      }));
      setSaveStatus('saved');
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    }
  };

  const handleNext = async () => {
    if (currentIndex < papers.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      await StorageService.updateSession(sessionId, { currentIndex: nextIndex });
    }
  };

  const handlePrevious = async () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      await StorageService.updateSession(sessionId, { currentIndex: prevIndex });
    }
  };

  const handleComplete = async () => {
    await StorageService.updateSession(sessionId, { status: 'completed' });
    onNavigate('dashboard');
  };

  const isPaperValid = (paper) => {
    if (!paper) return false;
    const app = paper.appraisal || {};
    
    const decision = app.Human_Decision || app.Reviewer_Decision;
    const rationale = app.Human_Rationale || app.Reviewer_Reasoning;
    const ecTrigger = app.Human_EC_Trigger || app.Reviewer_EC_Code;

    // Core decision fields
    const hasBasic = decision &&
                     rationale &&
                     String(rationale).trim() !== '';
    
    if (!hasBasic) return false;

    // EC Code validation
    if (decision === 'Exclude' && session?.metadata?.ecRules?.length > 0) {
      if (!ecTrigger) return false;
      return true; // If Exclude and EC code is filled, it's valid (no need to validate dynamic extractions)
    }

    // Dynamic appraisal validation (if decision is Include and we have dynamic keys)
    if (decision === 'Include') {
      const dynamicKeys = Object.keys(app).filter(
        (key) => !APPRAISAL_FIELDS.includes(key)
      );

      for (const key of dynamicKeys) {
        const item = app[key];
        if (key.toLowerCase().startsWith('qa')) {
          // Quality Appraisal: Value must be set (1.0, 0.5, 0.0) and evidence must be non-empty
          if (item === undefined || item.value === undefined || item.value === '' || 
              !item.evidence || String(item.evidence).trim() === '') {
            return false;
          }
        } else if (key.toLowerCase().startsWith('rq')) {
          // Data Extraction: Value must be non-empty and evidence must be non-empty
          if (item === undefined || item.value === undefined || String(item.value).trim() === '' ||
              !item.evidence || String(item.evidence).trim() === '') {
            return false;
          }
        }
      }
    }

    return true;
  };

  if (!session || papers.length === 0) return <div className="p-8 text-center">Loading session data...</div>;

  const activePaper = papers[currentIndex];

  return (
    <div className="container mx-auto px-4 mt-2 mb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 mb-6 shadow-sm">
        <div>
          <h2 className="text-xl font-bold truncate max-w-lg" title={session.projectName}>
            {session.projectName}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            File: {session.filename} • Pool: <span className="font-bold">{session.poolType}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between">
          {/* Save State Indicator */}
          <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-gray-50/50 dark:bg-gray-900/40 rounded-xl border border-gray-150 dark:border-gray-800">
            {saveStatus === 'saving' ? (
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </span>
            ) : saveStatus === 'error' ? (
              <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-450">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Save Error
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                Autosaved
              </span>
            )}
          </div>

          <button
            onClick={() => setIsCookbookOpen(true)}
            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/65 dark:text-indigo-300 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Research Cookbook
          </button>
          <span className="px-3.5 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-extrabold border border-gray-200 dark:border-gray-700">
            Paper {currentIndex + 1} of {papers.length}
          </span>
        </div>
      </div>

      {/* Main Split Screen Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Panel: Reading Details */}
        <div className="lg:col-span-7 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col p-6 overflow-hidden">
          <div className="border-b border-gray-150 dark:border-gray-800 pb-4 mb-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-snug">
              {activePaper.standard_metadata.Title || 'No Title Available'}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
              Authors: {activePaper.standard_metadata.Authors || 'Unknown'}
            </p>
            <div className="flex flex-wrap gap-2 mt-3 text-[11px]">
              {activePaper.standard_metadata.Year && (
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-semibold text-gray-600 dark:text-gray-350">
                  Year: {activePaper.standard_metadata.Year}
                </span>
              )}
              {activePaper.standard_metadata.DOI && (
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-semibold text-gray-600 dark:text-gray-350">
                  DOI: {activePaper.standard_metadata.DOI}
                </span>
              )}
              {activePaper.standard_metadata.PDF_Link && (
                <a
                  href={activePaper.standard_metadata.PDF_Link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded font-bold hover:underline"
                >
                  🔗 PDF Link
                </a>
              )}
            </div>
          </div>

          {/* Tab Selection */}
          <div className="flex border-b border-gray-150 dark:border-gray-800 mb-4">
            <button
              onClick={() => setActiveLeftTab('abstract')}
              className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 -mb-[1px] ${
                activeLeftTab === 'abstract'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-650 dark:hover:text-gray-300'
              }`}
            >
              Abstract
            </button>
            {session.metadata?.ecRules && session.metadata.ecRules.length > 0 && (
              <button
                onClick={() => setActiveLeftTab('ecRules')}
                className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 -mb-[1px] ${
                  activeLeftTab === 'ecRules'
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-650 dark:hover:text-gray-300'
                }`}
              >
                Exclusion Rules ({session.metadata.ecRules.length})
              </button>
            )}
          </div>

          {activeLeftTab === 'abstract' ? (
            <div className="flex-1 flex flex-col min-h-[300px]">
              <div className="flex-1 overflow-y-auto pr-1 text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap max-h-[600px] border border-gray-100 dark:border-gray-800 p-4 bg-gray-50/50 dark:bg-gray-900/40 rounded-xl font-normal">
                {activePaper.standard_metadata.Abstract || 'No abstract content is available for this paper.'}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-[300px]">
              <div className="flex-1 overflow-y-auto pr-1 max-h-[600px] space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  {session.metadata.ecRules.map((rule, idx) => (
                    <div key={idx} className="p-4 bg-gray-50/50 dark:bg-gray-900/40 border border-gray-150 dark:border-gray-850 rounded-xl">
                      <span className="inline-block px-2.5 py-0.5 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-350 border border-rose-100 dark:border-rose-900/40 text-[10px] font-extrabold rounded-md mb-2">
                        {rule.code}
                      </span>
                      <p className="text-xs text-gray-650 dark:text-gray-300 leading-relaxed font-normal">
                        {rule.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Dynamic Form */}
        <div className="lg:col-span-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 flex flex-col">
          <h3 className="text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-wider pb-3 border-b border-gray-150 dark:border-gray-800 mb-5">
            Blinded Evaluation
          </h3>

          <div className="flex-1 overflow-y-auto max-h-[650px] pr-1">
            <BlindedReviewForm
              currentRow={activePaper.appraisal}
              handleInputChange={handleInputChange}
              handleDynamicChange={handleDynamicChange}
              ecRules={session.metadata?.ecRules || []}
              qualityAssuranceDefinition={session.metadata?.qualityAssuranceDefinition || ''}
              reasoningTemplate={session.metadata?.reasoningTemplate || []}
              onAddReasoningTemplate={handleAddReasoningTemplate}
            />
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-t border-gray-200 dark:border-gray-800 p-4 flex justify-between items-center shadow-lg z-40 transition-colors">
        <button
          className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200 font-bold rounded-xl text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
        >
          Previous
        </button>

        <button
          className="px-5 py-2 text-xs font-bold border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
          onClick={() => onNavigate('dashboard')}
        >
          Exit to Dashboard
        </button>

        {currentIndex === papers.length - 1 ? (
          <button
            className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleComplete}
            disabled={!isPaperValid(activePaper)}
          >
            Complete Review
          </button>
        ) : (
          <button
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleNext}
            disabled={!isPaperValid(activePaper)}
          >
            Next Paper
          </button>
        )}
      </div>

      {/* Cookbook Overlay Modal */}
      {isCookbookOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-gray-150 dark:border-gray-700 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-gray-150 dark:border-gray-700 mb-4">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Research Cookbook Reference
              </h3>
              <button
                onClick={() => setIsCookbookOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-250 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 pr-1 text-sm text-gray-700 dark:text-gray-300">
              <div>
                <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-xs mb-1">Project Name</h4>
                <p>{session.projectName}</p>
              </div>

              {session.metadata?.researchObjective && (
                <div>
                  <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-xs mb-1">Research Objective</h4>
                  <p className="whitespace-pre-wrap">{session.metadata.researchObjective}</p>
                </div>
              )}

              {session.metadata?.researchQuestions && (
                <div>
                  <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-xs mb-1">Research Questions</h4>
                  <p className="whitespace-pre-wrap">{session.metadata.researchQuestions}</p>
                </div>
              )}

              {session.metadata?.researchManifesto && (
                <div>
                  <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-xs mb-1">Research Manifesto</h4>
                  <p className="whitespace-pre-wrap">{session.metadata.researchManifesto}</p>
                </div>
              )}

              {session.metadata?.exclusionCriteria && (
                <div>
                  <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-xs mb-1">Exclusion Criteria (Full Description)</h4>
                  <p className="whitespace-pre-wrap">{session.metadata.exclusionCriteria}</p>
                </div>
              )}

              {session.metadata?.ecRules && session.metadata.ecRules.length > 0 && (
                <div>
                  <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-xs mb-2">Exclusion Rules (ecRules)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-150 dark:border-gray-800">
                    {session.metadata.ecRules.map((rule, idx) => (
                      <div key={idx} className="p-3 bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 rounded-xl flex flex-col gap-1.5">
                        <div>
                          <span className="inline-block px-2.5 py-0.5 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-350 border border-rose-100 dark:border-rose-900/40 text-[10px] font-extrabold rounded-md">
                            {rule.code}
                          </span>
                        </div>
                        <p className="text-xs text-gray-650 dark:text-gray-300 leading-relaxed font-normal">{rule.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {session.metadata?.qualityAssuranceDefinition && (
                <div>
                  <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-xs mb-1">Quality Assurance Definition</h4>
                  <p className="whitespace-pre-wrap">{session.metadata.qualityAssuranceDefinition}</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-150 dark:border-gray-700 mt-4 flex justify-end">
              <button
                onClick={() => setIsCookbookOpen(false)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition-colors text-xs"
              >
                Close Reference
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewScreen;
