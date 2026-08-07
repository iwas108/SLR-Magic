import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StorageService } from '../StorageService';
import BlindedReviewForm from './BlindedReviewForm';
import PdfViewer from './PdfViewer';
import AutofillModal from './features/modals/AutofillModal';

const APPRAISAL_FIELDS = [
  'Reviewer_Decision', 'Reviewer_Reasoning', 'Reviewer_Confidence', 'Reviewer_EC_Code',
  'Human_Decision', 'Human_EC_Trigger', 'Human_Rationale', 'Reviewer_Name'
];

const ReviewScreen = ({ sessionId, onNavigate, theme, onThemeChange }) => {
  const [session, setSession] = useState(null);
  const [papers, setPapers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCookbookOpen, setIsCookbookOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [activeLeftTab, setActiveLeftTab] = useState('abstract');
  const [isEvaluationOpen, setIsEvaluationOpen] = useState(false);
  const [isAutofillOpen, setIsAutofillOpen] = useState(false);
  const drawerScrollRef = useRef(null);
  const prevScrollTop = useRef(0);

  useEffect(() => {
    if (isEvaluationOpen) {
      const savedScroll = prevScrollTop.current;
      setTimeout(() => {
        const el = document.querySelector('.side-drawer-container textarea, .side-drawer-container input');
        if (el) {
          el.focus({ preventScroll: true });
        }
        if (drawerScrollRef.current) {
          drawerScrollRef.current.scrollTop = savedScroll;
        }
      }, 150);
    } else {
      if (drawerScrollRef.current) {
        prevScrollTop.current = drawerScrollRef.current.scrollTop;
      }
    }
  }, [isEvaluationOpen]);

  useEffect(() => {
    prevScrollTop.current = 0;
    if (drawerScrollRef.current) {
      drawerScrollRef.current.scrollTop = 0;
    }
  }, [currentIndex]);

  const loadSessionDataRef = useRef(null);

  const loadSessionData = useCallback(async () => {
    const s = await StorageService.getSession(sessionId);
    if (s) {
      setSession(s);
      const pList = await StorageService.getPapersForSession(sessionId);
      setPapers(pList);
      setCurrentIndex(s.currentIndex || 0);

      const pool = s.poolType || s.metadata?.pool_type || '';
      const hasPdf = pList[s.currentIndex || 0]?.standard_metadata?.PDF_Link || pList[s.currentIndex || 0]?.standard_metadata?.PDF_Base64;
      if (pool !== 'CAL_Pool_A' && pool !== 'pool_a' && hasPdf) {
        setActiveLeftTab('pdf');
      } else {
        setActiveLeftTab('abstract');
      }
    } else {
      onNavigate('dashboard');
    }
  }, [sessionId, onNavigate]);

  useEffect(() => {
    loadSessionDataRef.current = loadSessionData;
  }, [loadSessionData]);

  useEffect(() => {
    if (loadSessionDataRef.current) {
      loadSessionDataRef.current();
    }
  }, [sessionId]);

  const handleInputChange = useCallback(async (field, value) => {
    if (papers.length === 0) return;

    const activePaper = papers[currentIndex];
    const updates = { [field]: value };

    if (field === 'Human_Decision' || field === 'Reviewer_Decision') {
      updates.Human_Decision = value;
      updates.Reviewer_Decision = value;
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

    setPapers(prevPapers => {
      const newPapers = [...prevPapers];
      newPapers[currentIndex] = {
        ...activePaper,
        appraisal: updatedAppraisal
      };
      return newPapers;
    });

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

    setPapers(prevPapers => {
      const newPapers = [...prevPapers];
      newPapers[currentIndex] = {
        ...activePaper,
        appraisal: updatedAppraisal
      };
      return newPapers;
    });

    setSaveStatus('saving');
    try {
      await StorageService.updatePaperAppraisal(sessionId, activePaper.Paper_ID, { [key]: updatedItem });
      setSaveStatus('saved');
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    }
  }, [papers, currentIndex, sessionId]);

  const handleNestedDynamicChange = useCallback(async (nestedKey, ruleCodeOrJsonKey, subField, value) => {
    if (papers.length === 0) return;

    const activePaper = papers[currentIndex];
    const nestedObj = activePaper.appraisal[nestedKey] || {};
    const item = nestedObj[ruleCodeOrJsonKey] || { value: '', evidence: '' };
    const updatedItem = { ...item, [subField]: value };
    const updatedNestedObj = { ...nestedObj, [ruleCodeOrJsonKey]: updatedItem };
    const updatedAppraisal = { ...activePaper.appraisal, [nestedKey]: updatedNestedObj };

    setPapers(prevPapers => {
      const newPapers = [...prevPapers];
      newPapers[currentIndex] = {
        ...activePaper,
        appraisal: updatedAppraisal
      };
      return newPapers;
    });

    setSaveStatus('saving');
    try {
      await StorageService.updatePaperAppraisal(sessionId, activePaper.Paper_ID, { [nestedKey]: updatedNestedObj });
      setSaveStatus('saved');
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    }
  }, [papers, currentIndex, sessionId]);

  const handleAutofillAppraisal = useCallback(async (appraisalUpdates) => {
    if (papers.length === 0) return;

    const activePaper = papers[currentIndex];
    const updates = { ...appraisalUpdates };

    // Standardize decision and reasoning updates
    if (updates.Human_Decision !== undefined) {
      updates.Reviewer_Decision = updates.Human_Decision;
      if (updates.Human_Decision === 'Include') {
        updates.Human_EC_Trigger = '';
        updates.Reviewer_EC_Code = '';
      }
    }
    if (updates.Human_EC_Trigger !== undefined) {
      updates.Reviewer_EC_Code = updates.Human_EC_Trigger;
    }
    if (updates.Human_Rationale !== undefined) {
      updates.Reviewer_Reasoning = updates.Human_Rationale;
    }

    const updatedAppraisal = { ...activePaper.appraisal, ...updates };

    setPapers(prevPapers => {
      const newPapers = [...prevPapers];
      newPapers[currentIndex] = {
        ...activePaper,
        appraisal: updatedAppraisal
      };
      return newPapers;
    });

    setSaveStatus('saving');
    setIsEvaluationOpen(true); // Open drawer to inspect autofill results
    try {
      await StorageService.updatePaperAppraisal(sessionId, activePaper.Paper_ID, updates);
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

      const pool = session?.poolType || session?.metadata?.pool_type || '';
      const hasPdf = papers[nextIndex]?.standard_metadata?.PDF_Link || papers[nextIndex]?.standard_metadata?.PDF_Base64;
      if (pool !== 'CAL_Pool_A' && pool !== 'pool_a' && hasPdf) {
        setActiveLeftTab('pdf');
      } else {
        setActiveLeftTab('abstract');
      }
    }
  }, [currentIndex, papers, sessionId, session]);

  const handlePrevious = useCallback(async () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      await StorageService.updateSession(sessionId, { currentIndex: prevIndex });

      const pool = session?.poolType || session?.metadata?.pool_type || '';
      const hasPdf = papers[prevIndex]?.standard_metadata?.PDF_Link || papers[prevIndex]?.standard_metadata?.PDF_Base64;
      if (pool !== 'CAL_Pool_A' && pool !== 'pool_a' && hasPdf) {
        setActiveLeftTab('pdf');
      } else {
        setActiveLeftTab('abstract');
      }
    }
  }, [currentIndex, papers, sessionId, session]);

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

    const pool = session?.poolType || session?.metadata?.pool_type || '';
    const isCStylePool = pool === 'CAL_Pool_C' || pool === 'pool_c' || pool === 'QC_Batch';
    const hasBasic = decision && (isCStylePool || (rationale && String(rationale).trim() !== ''));

    if (!hasBasic) return false;

    const ecRules = session?.metadata?.ec_rules || session?.metadata?.ecRules || [];
    if (decision === 'Exclude' && ecRules.length > 0) {
      if (!ecTrigger) return false;
      return true;
    }

    if (decision === 'Include') {
      if (isCStylePool) {
        const qaRules = session?.metadata?.qa_rules || session?.metadata?.qaRules || [];
        const qaScores = app.Human_QA_Scores || {};
        for (const rule of qaRules) {
          const item = qaScores[rule.code];
          if (item === undefined || item.value === undefined || item.value === null || item.value === '' ||
            !item.evidence || String(item.evidence).trim() === '') {
            return false;
          }
        }

        const extRules = session?.metadata?.extraction_rules || session?.metadata?.extractionRules || [];
        const extData = app.Human_Extracted_Data || {};
        for (const rule of extRules) {
          const item = extData[rule.json_key];
          if (item === undefined || item.value === undefined || item.value === null || String(item.value).trim() === '' ||
            !item.evidence || String(item.evidence).trim() === '') {
            return false;
          }
        }
      } else {
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
    }

    return true;
  }, [session]);

  const activePaper = papers[currentIndex];
  const isValid = isPaperValid(activePaper);

  const isPoolA = session?.poolType === 'CAL_Pool_A' || session?.poolType === 'pool_a';
  const isPoolB = session?.poolType === 'CAL_Pool_B' || session?.poolType === 'pool_b';
  const isPoolC = session?.poolType === 'CAL_Pool_C' || session?.poolType === 'pool_c' || session?.poolType === 'QC_Batch';

  useEffect(() => {
    if (!session || papers.length === 0) return;

    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      const isInputActive = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

      const key = e.key.toLowerCase();
      const ecRules = session.metadata?.ec_rules || session.metadata?.ecRules || [];
      const paperApp = activePaper?.appraisal || {};

      if (e.key === 'Escape') {
        e.preventDefault();
        if (isEvaluationOpen) {
          setIsEvaluationOpen(false);
        } else {
          setIsCookbookOpen(false);
        }
        if (isAutofillOpen) {
          setIsAutofillOpen(false);
        }
        if (isInputActive) {
          activeEl.blur();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && key === 'j') {
        e.preventDefault();
        setIsAutofillOpen(true);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && key === 's') {
        e.preventDefault();
        setSaveStatus('saving');
        setTimeout(() => setSaveStatus('saved'), 400);
        return;
      }

      if (isAutofillOpen) {
        return;
      }

      if (isInputActive) {
        return;
      }

      if (key === 'i') {
        e.preventDefault();
        handleInputChange('Human_Decision', 'Include');
        setIsEvaluationOpen(true);
      } else if (key === 'e') {
        e.preventDefault();
        handleInputChange('Human_Decision', 'Exclude');
        setIsEvaluationOpen(true);
      } else if (key === ' ' || key === 'v') {
        e.preventDefault();
        setIsEvaluationOpen(prev => !prev);
      } else if (key === 'r') {
        e.preventDefault();
        setIsCookbookOpen(prev => !prev);
      } else if (key === 'a') {
        e.preventDefault();
        setActiveLeftTab('abstract');
      } else if (key === 'p' && !isPoolA) {
        e.preventDefault();
        if (activePaper?.standard_metadata?.PDF_Link || activePaper?.standard_metadata?.PDF_Base64) {
          setActiveLeftTab('pdf');
        }
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
  }, [session, papers.length, currentIndex, activePaper, handleInputChange, handlePrevious, handleNext, handleComplete, isValid, isPoolA, isPoolC, isEvaluationOpen, isAutofillOpen]);

  if (!session || papers.length === 0) return <div className="p-8 text-center text-muted-foreground">Loading session data...</div>;
  if (!session || papers.length === 0) return <div className="p-8 text-center text-muted-foreground">Loading session data...</div>;

  const ecRules = session.metadata?.ec_rules || session.metadata?.ecRules || [];
  const qaRules = session.metadata?.qa_rules || session.metadata?.qaRules || [];
  const extractionRules = session.metadata?.extraction_rules || session.metadata?.extractionRules || [];

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Combined Unified Navigation Bar */}
      <nav className="bg-card border-b border-border py-3.5 px-4 sm:px-6 shadow-sm shrink-0 transition-colors duration-200">
        <div className="max-w-[1800px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left: Brand + Separator + Project Details */}
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent cursor-pointer shrink-0"
              onClick={() => onNavigate('dashboard')}
            >
              SLR Magic Inter-Rater
            </span>
            <div className="hidden sm:block h-6 w-[1px] bg-border shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-card-foreground truncate max-w-[280px] sm:max-w-[400px] md:max-w-[500px]" title={session.projectName}>
                {session.projectName}
              </h2>
              <p className="text-[10px] text-muted-foreground truncate max-w-[280px] sm:max-w-[400px] md:max-w-[500px]">
                File: {session.filename} • Pool: <span className="font-bold">{session.poolType}</span>
                {isPoolA && <span className="ml-2 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded font-semibold text-[9px] uppercase">Abstract Mode</span>}
              </p>
            </div>
          </div>

          {/* Right: Autosave Status, Cookbook, Page counter & Theme */}
          <div className="flex items-center gap-2.5 shrink-0 ml-auto sm:ml-0">
            <div className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 bg-secondary rounded-lg border border-border">
              {saveStatus === 'saving' ? (
                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : saveStatus === 'error' ? (
                <span className="flex items-center gap-1 text-destructive">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Error
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  Autosaved
                </span>
              )}
            </div>

            <button
              onClick={() => setIsCookbookOpen(true)}
              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/65 dark:text-indigo-300 font-bold rounded-lg text-[11px] transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>Research Cookbook</span>
            </button>

            <span className="px-2.5 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-[11px] font-extrabold border border-border">
              Paper {currentIndex + 1} of {papers.length}
            </span>

            <div className="flex items-center gap-1.5 border-l border-border pl-2.5">
              <select
                value={theme}
                onChange={(e) => onThemeChange(e.target.value)}
                className="bg-background border border-border rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
              >
                <option value="light">☀️ Light</option>
                <option value="dark">🌙 Dark</option>
                <option value="system">💻 System</option>
              </select>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 w-full max-w-[1800px] mx-auto px-4 sm:px-8 xl:px-12 mt-4 flex flex-col overflow-hidden">
        <div className="bg-card rounded-2xl border border-border shadow-sm flex flex-row h-full overflow-hidden mb-6 relative">

          {/* Vertical left tab bar */}
          <div className="w-48 bg-muted/30 border-r border-border p-3 flex flex-col gap-1.5 shrink-0">
            <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider px-3 mb-1 shrink-0">
              Navigation
            </div>

            {/* PDF Reader tab: visible if not Pool A and has PDF */}
            {!isPoolA && (activePaper.standard_metadata.PDF_Link || activePaper.standard_metadata.PDF_Base64) && (
              <button
                onClick={() => setActiveLeftTab('pdf')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-left flex items-center gap-2 border ${activeLeftTab === 'pdf'
                  ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/45 dark:border-blue-900/50 dark:text-blue-300 font-extrabold shadow-sm'
                  : 'border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
              >
                <span className="text-sm">📄</span>
                <span className="truncate">PDF Reader</span>
              </button>
            )}

            {/* Abstract tab */}
            <button
              onClick={() => setActiveLeftTab('abstract')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-left flex items-center gap-2 border ${activeLeftTab === 'abstract'
                ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/45 dark:border-blue-900/50 dark:text-blue-300 font-extrabold shadow-sm'
                : 'border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
            >
              <span className="text-sm">📝</span>
              <span className="truncate">Abstract</span>
            </button>

            {/* Exclusion Rules tab */}
            {ecRules.length > 0 && !isPoolC && (
              <button
                onClick={() => setActiveLeftTab('ecRules')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-left flex items-center gap-2 border ${activeLeftTab === 'ecRules'
                  ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/45 dark:border-blue-900/50 dark:text-blue-300 font-extrabold shadow-sm'
                  : 'border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
              >
                <span className="text-sm">🚫</span>
                <span className="truncate">EC Rules</span>
              </button>
            )}

            {/* Paper Details / Metadata tab */}
            {!isPoolA && (
              <button
                onClick={() => setActiveLeftTab('metadata')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-left flex items-center gap-2 border ${activeLeftTab === 'metadata'
                  ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/45 dark:border-blue-900/50 dark:text-blue-300 font-extrabold shadow-sm'
                  : 'border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
              >
                <span className="text-sm">ℹ️</span>
                <span className="truncate">Paper Details</span>
              </button>
            )}

            {/* QA Schema tab (Only if Pool C) */}
            {isPoolC && qaRules.length > 0 && (
              <button
                onClick={() => setActiveLeftTab('qaRulesPreview')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-left flex items-center gap-2 border ${activeLeftTab === 'qaRulesPreview'
                  ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/45 dark:border-blue-900/50 dark:text-blue-300 font-extrabold shadow-sm'
                  : 'border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
              >
                <span className="text-sm">⚖️</span>
                <span className="truncate">QA Schema</span>
              </button>
            )}

            {/* Extraction Schema tab (Only if Pool C) */}
            {isPoolC && extractionRules.length > 0 && (
              <button
                onClick={() => setActiveLeftTab('extractionRulesPreview')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-left flex items-center gap-2 border ${activeLeftTab === 'extractionRulesPreview'
                  ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/45 dark:border-blue-900/50 dark:text-blue-300 font-extrabold shadow-sm'
                  : 'border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
              >
                <span className="text-sm">🧬</span>
                <span className="truncate">Extraction Schema</span>
              </button>
            )}
          </div>

          {/* Right side content viewport */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-5 relative">
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              {/* PDF Viewer - kept mounted to preserve scroll/state, toggled via display style */}
              {!isPoolA && (activePaper.standard_metadata.PDF_Link || activePaper.standard_metadata.PDF_Base64) && (
                <div
                  className="h-full min-h-[450px]"
                  style={{ display: activeLeftTab === 'pdf' ? 'block' : 'none' }}
                >
                  <PdfViewer
                    url={activePaper.standard_metadata.PDF_Link}
                    base64={activePaper.standard_metadata.PDF_Base64}
                  />
                </div>
              )}

              {activeLeftTab === 'abstract' ? (
                <div className="space-y-4">
                  {isPoolA && (
                    <div className="bg-muted/30 border border-border rounded-xl p-5 space-y-4">
                      <h3 className="text-base font-extrabold text-foreground leading-snug">
                        {activePaper.standard_metadata.Title || 'No Title Available'}
                      </h3>

                      <div className="border-t border-border pt-3 space-y-2.5 text-xs">
                        {activePaper.standard_metadata.Year && (
                          <div className="flex py-1 border-b border-border">
                            <span className="w-24 font-bold text-muted-foreground uppercase tracking-wider">Year</span>
                            <span className="text-foreground font-semibold">{activePaper.standard_metadata.Year}</span>
                          </div>
                        )}
                        {activePaper.standard_metadata.Authors && (
                          <div className="flex py-1 border-b border-border">
                            <span className="w-24 font-bold text-muted-foreground uppercase tracking-wider">Authors</span>
                            <span className="text-foreground font-normal leading-relaxed">{activePaper.standard_metadata.Authors}</span>
                          </div>
                        )}
                        {activePaper.standard_metadata.DOI && (
                          <div className="flex py-1 border-b border-border">
                            <span className="w-24 font-bold text-muted-foreground uppercase tracking-wider">DOI</span>
                            <span className="text-foreground font-mono select-all">{activePaper.standard_metadata.DOI}</span>
                          </div>
                        )}
                        {activePaper.standard_metadata.Publisher && (
                          <div className="flex py-1 border-b border-border">
                            <span className="w-24 font-bold text-muted-foreground uppercase tracking-wider">Publisher</span>
                            <span className="text-foreground font-normal">{activePaper.standard_metadata.Publisher}</span>
                          </div>
                        )}
                        {activePaper.standard_metadata.Import_Source && (
                          <div className="flex py-1 border-b border-border">
                            <span className="w-24 font-bold text-muted-foreground uppercase tracking-wider">Source</span>
                            <span className="text-foreground font-normal">{activePaper.standard_metadata.Import_Source}</span>
                          </div>
                        )}
                        {activePaper.standard_metadata.PDF_Link && (
                          <div className="flex py-1 border-b border-border">
                            <span className="w-24 font-bold text-muted-foreground uppercase tracking-wider">Original Link</span>
                            <a
                              href={activePaper.standard_metadata.PDF_Link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:underline dark:text-indigo-400 font-bold"
                            >
                              🔗 Open Link in New Tab
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap font-normal p-4 bg-muted/30 rounded-xl border border-border">
                    {isPoolA && <h4 className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-2">Abstract</h4>}
                    {activePaper.standard_metadata.Abstract || 'No abstract content is available for this paper.'}
                  </div>
                </div>
              ) : activeLeftTab === 'ecRules' ? (
                <div className="space-y-2.5">
                  {ecRules.map((rule, idx) => (
                    <div key={idx} className="p-3.5 bg-gray-50/50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-xl">
                      <span className="inline-block px-2.5 py-0.5 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-100 dark:border-rose-900/40 text-[10px] font-extrabold rounded-md mb-2">
                        {rule.code}
                      </span>
                      <p className="text-xs text-muted-foreground leading-relaxed font-normal">
                        {rule.description}
                      </p>
                    </div>
                  ))}
                </div>
              ) : activeLeftTab === 'qaRulesPreview' ? (
                <div className="space-y-4">
                  <div className="border-b border-border pb-2">
                    <h3 className="text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-wider">
                      Quality Assessment (QA) Scoring Schema
                    </h3>
                  </div>
                  {qaRules.map((rule, idx) => (
                    <div key={idx} className="p-4 bg-gray-50/50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-xl space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-gray-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40 text-[10px] font-extrabold rounded-md">
                          {rule.code}
                        </span>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                          {rule.title || rule.label || ''}
                        </span>
                      </div>
                      {rule.question && (
                        <p className="text-xs font-semibold text-muted-foreground italic">
                          ❓ {rule.question}
                        </p>
                      )}
                      {rule.description && rule.description !== rule.title && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-normal">
                          {rule.description}
                        </p>
                      )}
                      {((rule.score_1_logic || rule.score1Logic) || (rule.score_05_logic || rule.score05Logic) || (rule.score_0_logic || rule.score0Logic)) && (
                        <div className="mt-2 p-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/40 rounded-lg space-y-1 text-[10px] text-gray-500 dark:text-gray-400 font-semibold leading-relaxed">
                          <span className="block font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-[8px] mb-1">Scoring Logic:</span>
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
              ) : activeLeftTab === 'extractionRulesPreview' ? (
                <div className="space-y-4">
                  <div className="border-b border-border pb-2">
                    <h3 className="text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-wider">
                      Data Extraction Parameters Schema
                    </h3>
                  </div>
                  {extractionRules.map((rule, idx) => (
                    <div key={idx} className="p-4 bg-gray-50/50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-xl space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 dark:bg-gray-700 dark:text-purple-300 border border-purple-100 dark:border-purple-900/40 text-[10px] font-mono font-extrabold rounded-md">
                          {rule.json_key}
                        </span>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                          {rule.label || rule.title || ''}
                        </span>
                      </div>
                      {rule.question && (
                        <p className="text-xs font-semibold text-muted-foreground italic">
                          ❓ {rule.question}
                        </p>
                      )}
                      {rule.description && rule.description !== rule.label && (
                        <p className="text-xs text-muted-foreground leading-relaxed font-normal">
                          {rule.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : activeLeftTab === 'metadata' || (!isPoolA && activeLeftTab !== 'pdf') ? (
                <div className="bg-gray-50/50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 rounded-xl p-5 space-y-4">
                  <h3 className="text-base font-extrabold text-gray-900 dark:text-white leading-snug">
                    {activePaper.standard_metadata.Title || 'No Title Available'}
                  </h3>

                  <div className="border-t border-border pt-3 space-y-2.5 text-xs">
                    {activePaper.standard_metadata.Year && (
                      <div className="flex py-1 border-b border-gray-100/50 dark:border-gray-800/40">
                        <span className="w-24 font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Year</span>
                        <span className="text-gray-800 dark:text-gray-200 font-semibold">{activePaper.standard_metadata.Year}</span>
                      </div>
                    )}
                    {activePaper.standard_metadata.Authors && (
                      <div className="flex py-1 border-b border-gray-100/50 dark:border-gray-800/40">
                        <span className="w-24 font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Authors</span>
                        <span className="text-gray-800 dark:text-gray-200 font-normal leading-relaxed">{activePaper.standard_metadata.Authors}</span>
                      </div>
                    )}
                    {activePaper.standard_metadata.DOI && (
                      <div className="flex py-1 border-b border-gray-100/50 dark:border-gray-800/40">
                        <span className="w-24 font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">DOI</span>
                        <span className="text-gray-800 dark:text-gray-200 font-mono select-all">{activePaper.standard_metadata.DOI}</span>
                      </div>
                    )}
                    {activePaper.standard_metadata.Publisher && (
                      <div className="flex py-1 border-b border-gray-100/50 dark:border-gray-800/40">
                        <span className="w-24 font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Publisher</span>
                        <span className="text-gray-800 dark:text-gray-200 font-normal">{activePaper.standard_metadata.Publisher}</span>
                      </div>
                    )}
                    {activePaper.standard_metadata.Import_Source && (
                      <div className="flex py-1 border-b border-border">
                        <span className="w-24 font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Source</span>
                        <span className="text-gray-800 dark:text-gray-200 font-normal">{activePaper.standard_metadata.Import_Source}</span>
                      </div>
                    )}
                    {activePaper.standard_metadata.PDF_Link && (
                      <div className="flex py-1 border-b border-gray-100/50 dark:border-gray-800/40">
                        <span className="w-24 font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Original Link</span>
                        <a
                          href={activePaper.standard_metadata.PDF_Link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:underline dark:text-indigo-400 font-bold"
                        >
                          🔗 Open Link in New Tab
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Floating Action Button (FAB) inside the content panel */}
            <div className="absolute bottom-5 right-5 z-30">
              <button
                onClick={() => setIsEvaluationOpen(true)}
                className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer text-xs uppercase tracking-wider"
              >
                <span>📝 Evaluate Paper</span>
                <kbd className="px-1.5 py-0.5 bg-blue-700 rounded border border-blue-500 text-[10px] font-mono capitalize">Space</kbd>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Side Drawer Backdrop */}
      {isEvaluationOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-[1px] z-45 transition-opacity"
          onClick={() => setIsEvaluationOpen(false)}
        />
      )}

      {/* Sliding Side Drawer Container */}
      <div className={`side-drawer-container fixed top-0 right-0 h-full w-[460px] bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isEvaluationOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="px-5 py-4 border-b border-border flex justify-between items-center bg-gray-50 dark:bg-gray-800 shrink-0">
          <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
            Blinded Evaluation
          </h3>
          <button
            onClick={() => setIsEvaluationOpen(false)}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Close (Esc)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div ref={drawerScrollRef} className="flex-1 overflow-y-auto p-5 min-h-0">
          <BlindedReviewForm
            currentRow={activePaper.appraisal}
            handleInputChange={handleInputChange}
            handleDynamicChange={handleDynamicChange}
            handleNestedDynamicChange={handleNestedDynamicChange}
            ecRules={ecRules}
            qaRules={qaRules}
            extractionRules={extractionRules}
            isPoolC={isPoolC}
            qualityAssuranceDefinition={session.metadata?.quality_assurance_definition || session.metadata?.qualityAssuranceDefinition || ''}
            reasoningTemplate={session.metadata?.reasoning_template || session.metadata?.reasoningTemplate || []}
            onAddReasoningTemplate={handleAddReasoningTemplate}
          />
        </div>
      </div>

      <div className="bg-white/90 dark:bg-gray-900/90 border-t border-gray-200 dark:border-gray-800 p-4 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-lg z-40 transition-colors shrink-0">
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

        <div className="hidden lg:flex items-center gap-2.5 px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-xl border border-border text-[10px] text-gray-500 font-semibold max-w-full overflow-x-auto">
          <span className="font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mr-1 shrink-0">Shortcuts:</span>
          <span className="flex items-center gap-1 shrink-0"><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-sm font-mono text-[9px]">I</kbd> Include</span>
          <span className="flex items-center gap-1 shrink-0"><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-sm font-mono text-[9px]">E</kbd> Exclude</span>
          {!isPoolA && (activePaper?.standard_metadata?.PDF_Link || activePaper?.standard_metadata?.PDF_Base64) && (
            <span className="flex items-center gap-1 shrink-0"><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-sm font-mono text-[9px]">P</kbd> PDF Tab</span>
          )}
          <span className="flex items-center gap-1 shrink-0"><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-sm font-mono text-[9px]">A</kbd> Abstract Tab</span>
          <span className="flex items-center gap-1 shrink-0"><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-sm font-mono text-[9px]">R</kbd> Cookbook</span>
          <span className="flex items-center gap-1 shrink-0"><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-sm font-mono text-[9px]">Space / V</kbd> Evaluate</span>
          <span className="flex items-center gap-1 shrink-0"><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-sm font-mono text-[9px]">Esc</kbd> Close Drawer</span>
          <span className="flex items-center gap-1 shrink-0"><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-sm font-mono text-[9px]">←/→</kbd> Prev/Next</span>
          <span className="flex items-center gap-1 shrink-0"><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-sm font-mono text-[9px]">Ctrl+S</kbd> Save</span>
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

      {isCookbookOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-border max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-border mb-4 shrink-0">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Research Cookbook Reference
              </h3>
              <button
                onClick={() => setIsCookbookOpen(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 pr-1 text-sm text-gray-700 dark:text-gray-300">
              <div>
                <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-xs mb-1">Project Name</h4>
                <p className="font-semibold text-base">{session.projectName || session.metadata?.project_name || session.metadata?.projectName || 'Untitled Project'}</p>
              </div>

              {session.metadata?.research_objective || session.metadata?.researchObjective ? (
                <div>
                  <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-xs mb-1">Research Objective</h4>
                  <p className="whitespace-pre-wrap leading-relaxed">{session.metadata.research_objective || session.metadata.researchObjective}</p>
                </div>
              ) : null}

              {session.metadata?.research_questions || session.metadata?.researchQuestions ? (
                <div>
                  <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-xs mb-1">Research Questions</h4>
                  <p className="whitespace-pre-wrap leading-relaxed font-mono bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border dark:border-gray-800">{session.metadata.research_questions || session.metadata.researchQuestions}</p>
                </div>
              ) : null}

              {session.metadata?.research_manifesto || session.metadata?.researchManifesto ? (
                <div>
                  <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-xs mb-1">Research Manifesto</h4>
                  <p className="whitespace-pre-wrap leading-relaxed bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border dark:border-gray-800">{session.metadata.research_manifesto || session.metadata.researchManifesto}</p>
                </div>
              ) : null}

              {session.metadata?.exclusion_criteria || session.metadata?.exclusionCriteria ? (
                <div>
                  <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-xs mb-1">Exclusion Criteria (Full Description)</h4>
                  <p className="whitespace-pre-wrap leading-relaxed bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border dark:border-gray-800">{session.metadata.exclusion_criteria || session.metadata.exclusionCriteria}</p>
                </div>
              ) : null}

              {ecRules.length > 0 && !isPoolC && (
                <div>
                  <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-xs mb-2">Exclusion Rules (ecRules)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-border">
                    {ecRules.map((rule, idx) => (
                      <div key={idx} className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex flex-col gap-1.5">
                        <div>
                          <span className="inline-block px-2.5 py-0.5 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-100 dark:border-rose-900/40 text-[10px] font-extrabold rounded-md">
                            {rule.code}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed font-normal">{rule.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(isPoolB || isPoolC) && (session.metadata?.quality_assurance_definition || session.metadata?.qualityAssuranceDefinition) && (
                <div>
                  <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-xs mb-1">Quality Assurance Definition</h4>
                  <p className="whitespace-pre-wrap leading-relaxed bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border dark:border-gray-800">{session.metadata.quality_assurance_definition || session.metadata.qualityAssuranceDefinition}</p>
                </div>
              )}

              {isPoolC && session.metadata?.qa_rules && session.metadata.qa_rules.length > 0 && (
                <div>
                  <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-xs mb-2">QA Scoring Schema</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-border">
                    {session.metadata.qa_rules.map((rule, idx) => (
                      <div key={idx} className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex flex-col gap-1">
                        <span className="inline-block self-start px-2 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-100/30 text-[10px] font-bold rounded mb-1">
                          {rule.code}
                        </span>
                        <p className="text-xs font-semibold">{rule.question}</p>
                        {((rule.score_1_logic || rule.score1Logic) || (rule.score_05_logic || rule.score05Logic) || (rule.score_0_logic || rule.score0Logic)) && (
                          <div className="mt-1.5 p-2 bg-gray-50 dark:bg-gray-900 border dark:border-gray-800/80 rounded-lg space-y-0.5 text-[9px] text-gray-500 dark:text-gray-400 font-semibold leading-normal">
                            {(rule.score_1_logic || rule.score1Logic) && (
                              <div className="flex gap-1">
                                <span className="font-bold text-blue-600 dark:text-blue-400 shrink-0">1.0:</span>
                                <span>{rule.score_1_logic || rule.score1Logic}</span>
                              </div>
                            )}
                            {(rule.score_05_logic || rule.score05Logic) && (
                              <div className="flex gap-1">
                                <span className="font-bold text-blue-600 dark:text-blue-400 shrink-0">0.5:</span>
                                <span>{rule.score_05_logic || rule.score05Logic}</span>
                              </div>
                            )}
                            {(rule.score_0_logic || rule.score0Logic) && (
                              <div className="flex gap-1">
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

              {isPoolC && session.metadata?.extraction_rules && session.metadata.extraction_rules.length > 0 && (
                <div>
                  <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-xs mb-2">Data Extraction Schema</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-border">
                    {session.metadata.extraction_rules.map((rule, idx) => (
                      <div key={idx} className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex flex-col gap-1">
                        <span className="inline-block self-start px-2 py-0.5 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-100/30 text-[10px] font-mono rounded mb-1">
                          {rule.json_key || rule.key}
                        </span>
                        <p className="text-xs font-semibold">{rule.question}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border mt-4 flex justify-end shrink-0">
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

      {isAutofillOpen && (
        <AutofillModal
          isOpen={isAutofillOpen}
          onClose={() => setIsAutofillOpen(false)}
          onAutofill={handleAutofillAppraisal}
          session={session}
          currentAppraisal={activePaper?.appraisal}
          paper={activePaper}
        />
      )}
    </div>
  );
};

export default ReviewScreen;
