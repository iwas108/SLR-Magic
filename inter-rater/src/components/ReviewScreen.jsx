import React, { useState, useEffect, useCallback } from 'react';
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

  const handleInputChange = useCallback(async (field, value) => {
    if (papers.length === 0) return;
    
    const activePaper = papers[currentIndex];
    const updates = { [field]: value };
    
    if (field === 'Human_Decision' || field === 'Reviewer_Decision') {
      updates.Human_Decision = value;
      updates.Reviewer_Decision = value;
      // Clear exclusion trigger if user changes decision to Include
      if (value === 'Include') {
        updates.Human_EC_Trigger = '';
        updates.Reviewer_EC_Code = '';
      }
    } else if (field === 'Human_Rationale' || field === 'Reviewer_Reasoning') {
      updates.Human_Rationale = value;
      updates.Reviewer_Reasoning = value;
    } else if (field === 'Human_EC_Trigger' || field === 'Reviewer_EC_Code') {
      updates.Human_EC_Trigger = value;
      updates.Reviewer_EC_Code = value;
    }

    const updatedAppraisal = { ...activePaper.appraisal, ...updates };
    
    // Update local state
    setPapers(prevPapers => {
      const newPapers = [...prevPapers];
      newPapers[currentIndex] = {
        ...activePaper,
        appraisal: updatedAppraisal
      };
      return newPapers;
    });

    // Save to IndexedDB
    setSaveStatus('saving');
    try {
      await StorageService.updatePaperAppraisal(sessionId, activePaper.Paper_ID, updates);
      setSaveStatus('saved');
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    }
  }, [papers, currentIndex, sessionId]);

  const handleDynamicChange = useCallback(async (key, subField, value) => {
    if (papers.length === 0) return;

    const activePaper = papers[currentIndex];
    const item = activePaper.appraisal[key] || { value: '', evidence: '' };
    const updatedItem = { ...item, [subField]: value };
    const updatedAppraisal = { ...activePaper.appraisal, [key]: updatedItem };

    // Update local state
    setPapers(prevPapers => {
      const newPapers = [...prevPapers];
      newPapers[currentIndex] = {
        ...activePaper,
        appraisal: updatedAppraisal
      };
      return newPapers;
    });

    // Save to IndexedDB
    setSaveStatus('saving');
    try {
      await StorageService.updatePaperAppraisal(sessionId, activePaper.Paper_ID, { [key]: updatedItem });
      setSaveStatus('saved');
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    }
  }, [papers, currentIndex, sessionId]);

  const handleAddReasoningTemplate = useCallback(async (newTemplate) => {
    if (!session) return;
    const currentTemplates = session.metadata?.reasoning_template || session.metadata?.reasoningTemplate || [];
    if (currentTemplates.includes(newTemplate)) {
      alert('Template already exists.');
      return;
    }
    const updatedTemplates = [...currentTemplates, newTemplate];
    
    setSaveStatus('saving');
    try {
      await StorageService.updateSession(sessionId, { reasoning_template: updatedTemplates, reasoningTemplate: updatedTemplates });
      // Update local state
      setSession(prev => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          reasoning_template: updatedTemplates,
          reasoningTemplate: updatedTemplates
        }
      }));
      setSaveStatus('saved');
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    }
  }, [session, sessionId]);

  const handleNext = useCallback(async () => {
    if (currentIndex < papers.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      await StorageService.updateSession(sessionId, { currentIndex: nextIndex });
    }
  }, [currentIndex, papers.length, sessionId]);

  const handlePrevious = useCallback(async () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      await StorageService.updateSession(sessionId, { currentIndex: prevIndex });
    }
  }, [currentIndex, sessionId]);

  const handleComplete = useCallback(async () => {
    await StorageService.updateSession(sessionId, { status: 'completed' });
    onNavigate('dashboard');
  }, [sessionId, onNavigate]);

  const isPaperValid = useCallback((paper) => {
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
    const ecRules = session?.metadata?.ec_rules || session?.metadata?.ecRules || [];
    if (decision === 'Exclude' && ecRules.length > 0) {
      if (!ecTrigger) return false;
      return true;
    }

    // Dynamic appraisal validation
    if (decision === 'Include') {
      const dynamicKeys = Object.keys(app).filter(
        (key) => !APPRAISAL_FIELDS.includes(key)
      );

      for (const key of dynamicKeys) {
        const item = app[key];
        if (key.toLowerCase().startsWith('qa')) {
          if (item === undefined || item.value === undefined || item.value === '' || 
              !item.evidence || String(item.evidence).trim() === '') {
            return false;
          }
        } else if (key.toLowerCase().startsWith('rq')) {
          if (item === undefined || item.value === undefined || String(item.value).trim() === '' ||
              !item.evidence || String(item.evidence).trim() === '') {
            return false;
          }
        }
      }
    }

    return true;
  }, [session]);

  const activePaper = papers[currentIndex];
  const isValid = isPaperValid(activePaper);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    if (!session || papers.length === 0) return;

    const handleKeyDown = (e) => {
      // Don't trigger shortcuts if user is typing in forms/textareas
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        return;
      }

      const key = e.key.toLowerCase();
      const ecRules = session.metadata?.ec_rules || session.metadata?.ecRules || [];
      const paperApp = activePaper?.appraisal || {};

      if (key === 'i') {
        e.preventDefault();
        handleInputChange('Human_Decision', 'Include');
      } else if (key === 'e') {
        e.preventDefault();
        handleInputChange('Human_Decision', 'Exclude');
      } else if (key === 'arrowleft') {
        e.preventDefault();
        handlePrevious();
      } else if (key === 'arrowright') {
        e.preventDefault();
        if (isValid) {
          if (currentIndex === papers.length - 1) {
            handleComplete();
          } else {
            handleNext();
          }
        }
      } else if (key === 'enter') {
        e.preventDefault();
        if (isValid) {
          if (currentIndex === papers.length - 1) {
            handleComplete();
          } else {
            handleNext();
          }
        }
      } else if (/^[1-9]$/.test(key)) {
        // Select exclusion rule by index
        if (paperApp.Human_Decision === 'Exclude') {
          const ruleIndex = parseInt(key, 10) - 1;
          if (ruleIndex >= 0 && ruleIndex < ecRules.length) {
            e.preventDefault();
            handleInputChange('Human_EC_Trigger', ecRules[ruleIndex].code);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session, papers.length, currentIndex, activePaper, handleInputChange, handlePrevious, handleNext, handleComplete, isValid]);

  if (!session || papers.length === 0) return <div className="p-8 text-center text-gray-550 dark:text-gray-400">Loading session data...</div>;

  const isPoolA = session.poolType === 'CAL_Pool_A';
  const ecRules = session.metadata?.ec_rules || session.metadata?.ecRules || [];

  return (
    <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-8 xl:px-12 mt-4 mb-28">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-250 dark:border-gray-800 mb-4 shadow-sm">
        <div>
          <h2 className="text-xl font-bold truncate max-w-lg" title={session.projectName}>
            {session.projectName}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
            File: {session.filename} • Pool: <span className="font-bold">{session.poolType}</span>
            {isPoolA && <span className="ml-2.5 px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-md font-extrabold uppercase tracking-wide text-[10px]">Title, Year & Abstract Mode</span>}
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
              <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-455">
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
          <span className="px-3.5 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-extrabold border border-gray-205 dark:border-gray-700">
            Paper {currentIndex + 1} of {papers.length}
          </span>
        </div>
      </div>

      {/* Main Split Screen Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Panel: Reading Details */}
        <div className="lg:col-span-7 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
          <div className="pb-3 border-b border-gray-150 dark:border-gray-800">
            <h1 className="text-xl font-black text-gray-900 dark:text-white leading-snug tracking-tight">
              {activePaper.standard_metadata.Title || 'No Title Available'}
            </h1>
            
            <div className="flex flex-wrap items-center gap-2 mt-3 text-[10px]">
              {activePaper.standard_metadata.Year && (
                <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-105/30 font-extrabold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                  Year: {activePaper.standard_metadata.Year}
                </span>
              )}
              {activePaper.standard_metadata.Authors && (
                <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-900 rounded-lg text-gray-500 dark:text-gray-400 font-medium truncate max-w-sm" title={activePaper.standard_metadata.Authors}>
                  Authors: {activePaper.standard_metadata.Authors}
                </span>
              )}
              {activePaper.standard_metadata.DOI && (
                <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-900 rounded-lg text-gray-500 dark:text-gray-400 font-mono">
                  DOI: {activePaper.standard_metadata.DOI}
                </span>
              )}
              {activePaper.standard_metadata.PDF_Link && (
                <a
                  href={activePaper.standard_metadata.PDF_Link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 rounded-lg font-bold border border-indigo-100/30 hover:underline"
                >
                  🔗 PDF Link
                </a>
              )}
            </div>
          </div>

          {isPoolA ? (
            // REDESIGNED POOL A LAYOUT: DIRECT ABSTRACT & GUIDELINES (NO TABS)
            <div className="mt-4 space-y-6">
              <div>
                <h3 className="text-xs font-bold text-gray-450 dark:text-gray-500 uppercase tracking-wider mb-2.5">
                  Abstract
                </h3>
                <div className="text-sm text-gray-750 dark:text-gray-300 leading-relaxed whitespace-pre-wrap font-normal p-4 bg-gray-50/50 dark:bg-gray-900/40 rounded-xl border border-gray-105 dark:border-gray-850">
                  {activePaper.standard_metadata.Abstract || 'No abstract content is available for this paper.'}
                </div>
              </div>

              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-450 dark:text-gray-500 uppercase tracking-wider">
                    Exclusion Criteria Guidelines
                  </h3>
                  <span className="text-[10px] text-gray-400">Press [1-9] on Exclude to quick-select</span>
                </div>
                <div className="space-y-2.5">
                  {ecRules.length === 0 ? (
                    <div className="p-4 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-400">
                      No Exclusion Criteria rules configured in project settings.
                    </div>
                  ) : (
                    ecRules.map((rule, idx) => {
                      const isSelected = activePaper?.appraisal?.Human_EC_Trigger === rule.code;
                      return (
                        <div 
                          key={idx} 
                          className={`p-3.5 border rounded-xl transition-all ${
                            isSelected
                              ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-400 shadow-sm'
                              : 'bg-gray-50/40 dark:bg-gray-900/30 border-gray-150 dark:border-gray-850 hover:bg-gray-50 dark:hover:bg-gray-900/50'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`px-2 py-0.5 text-[9px] font-black rounded-md border shrink-0 ${
                              isSelected
                                ? 'bg-rose-600 border-rose-600 text-white'
                                : 'bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/30 dark:text-rose-350'
                            }`}>
                              {rule.code}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">Shortcut: [{idx + 1}]</span>
                          </div>
                          <p className="text-xs text-gray-650 dark:text-gray-300 leading-relaxed font-normal">
                            {rule.description}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            // STANDARD TABBED LAYOUT FOR OTHER POOLS
            <div className="mt-4">
              <div className="flex border-b border-gray-150 dark:border-gray-800 mb-3">
                <button
                  onClick={() => setActiveLeftTab('abstract')}
                  className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 -mb-[1px] ${
                    activeLeftTab === 'abstract'
                      ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  Abstract
                </button>
                {ecRules.length > 0 && (
                  <button
                    onClick={() => setActiveLeftTab('ecRules')}
                    className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 -mb-[1px] ${
                      activeLeftTab === 'ecRules'
                        ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                        : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                    }`}
                  >
                    Exclusion Rules ({ecRules.length})
                  </button>
                )}
              </div>

              <div>
                {activeLeftTab === 'abstract' ? (
                  <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap font-normal p-4 bg-gray-50/50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-850">
                    {activePaper.standard_metadata.Abstract || 'No abstract content is available for this paper.'}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {ecRules.map((rule, idx) => (
                      <div key={idx} className="p-3 bg-gray-50/50 dark:bg-gray-900/40 border border-gray-150 dark:border-gray-850 rounded-xl">
                        <span className="inline-block px-2.5 py-0.5 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-350 border border-rose-100 dark:border-rose-900/40 text-[10px] font-extrabold rounded-md mb-2">
                          {rule.code}
                        </span>
                        <p className="text-xs text-gray-650 dark:text-gray-300 leading-relaxed font-normal">
                          {rule.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Dynamic Form */}
        <div className="lg:col-span-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
          <h3 className="text-xs font-extrabold text-gray-900 dark:text-white uppercase tracking-wider pb-2 border-b border-gray-150 dark:border-gray-800 mb-3">
            Blinded Evaluation
          </h3>

          <div>
            <BlindedReviewForm
              currentRow={activePaper.appraisal}
              handleInputChange={handleInputChange}
              handleDynamicChange={handleDynamicChange}
              ecRules={ecRules}
              qualityAssuranceDefinition={session.metadata?.quality_assurance_definition || session.metadata?.qualityAssuranceDefinition || ''}
              reasoningTemplate={session.metadata?.reasoning_template || session.metadata?.reasoningTemplate || []}
              onAddReasoningTemplate={handleAddReasoningTemplate}
            />
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-t border-gray-200 dark:border-gray-800 p-4 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-lg z-40 transition-colors shrink-0">
        <div className="flex items-center gap-3">
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
        </div>

        {/* Keyboard Shortcuts Legend (Premium UI Feature) */}
        <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-850 rounded-xl border border-gray-150 dark:border-gray-800 text-[11px] text-gray-500 font-medium">
          <span className="font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mr-1">Shortcuts:</span>
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-sm">I</kbd> Include</span>
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-sm">E</kbd> Exclude</span>
          {activePaper?.appraisal?.Human_Decision === 'Exclude' && ecRules.length > 0 && (
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-sm">1-{Math.min(9, ecRules.length)}</kbd> EC Code</span>
          )}
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-sm">← / →</kbd> Prev/Next</span>
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-sm">Enter</kbd> Next</span>
        </div>

        {currentIndex === papers.length - 1 ? (
          <button
            className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleComplete}
            disabled={!isValid}
          >
            Complete Review
          </button>
        ) : (
          <button
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleNext}
            disabled={!isValid}
          >
            Next Paper
          </button>
        )}
      </div>

      {/* Cookbook Overlay Modal */}
      {isCookbookOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-gray-150 dark:border-gray-700 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-gray-150 dark:border-gray-700 mb-4 shrink-0">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Research Cookbook Reference
              </h3>
              <button
                onClick={() => setIsCookbookOpen(false)}
                className="text-gray-400 hover:text-gray-650 dark:hover:text-gray-250 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 pr-1 text-sm text-gray-700 dark:text-gray-300">
              <div>
                <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-xs mb-1">Project Name</h4>
                <p>{session.projectName || session.metadata?.project_name || session.metadata?.projectName || 'Untitled Project'}</p>
              </div>

              {session.metadata?.research_objective || session.metadata?.researchObjective ? (
                <div>
                  <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-xs mb-1">Research Objective</h4>
                  <p className="whitespace-pre-wrap">{session.metadata.research_objective || session.metadata.researchObjective}</p>
                </div>
              ) : null}

              {session.metadata?.research_questions || session.metadata?.researchQuestions ? (
                <div>
                  <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-xs mb-1">Research Questions</h4>
                  <p className="whitespace-pre-wrap">{session.metadata.research_questions || session.metadata.researchQuestions}</p>
                </div>
              ) : null}

              {session.metadata?.research_manifesto || session.metadata?.researchManifesto ? (
                <div>
                  <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-xs mb-1">Research Manifesto</h4>
                  <p className="whitespace-pre-wrap">{session.metadata.research_manifesto || session.metadata.researchManifesto}</p>
                </div>
              ) : null}

              {session.metadata?.exclusion_criteria || session.metadata?.exclusionCriteria ? (
                <div>
                  <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-xs mb-1">Exclusion Criteria (Full Description)</h4>
                  <p className="whitespace-pre-wrap">{session.metadata.exclusion_criteria || session.metadata.exclusionCriteria}</p>
                </div>
              ) : null}

              {ecRules.length > 0 && (
                <div>
                  <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-xs mb-2">Exclusion Rules (ecRules)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-150 dark:border-gray-800">
                    {ecRules.map((rule, idx) => (
                      <div key={idx} className="p-3 bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 rounded-xl flex flex-col gap-1.5">
                        <div>
                          <span className="inline-block px-2.5 py-0.5 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-355 border border-rose-100 dark:border-rose-900/40 text-[10px] font-extrabold rounded-md">
                            {rule.code}
                          </span>
                        </div>
                        <p className="text-xs text-gray-650 dark:text-gray-300 leading-relaxed font-normal">{rule.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {session.metadata?.quality_assurance_definition || session.metadata?.qualityAssuranceDefinition ? (
                <div>
                  <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-xs mb-1">Quality Assurance Definition</h4>
                  <p className="whitespace-pre-wrap">{session.metadata.quality_assurance_definition || session.metadata.qualityAssuranceDefinition}</p>
                </div>
              ) : null}
            </div>

            <div className="pt-4 border-t border-gray-150 dark:border-gray-700 mt-4 flex justify-end shrink-0">
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
