import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, X, FileText, ArrowRightLeft, ShieldAlert, 
  HelpCircle, CheckCircle2, ChevronRight, AlertCircle, Trash,
  Eye, Download, ExternalLink, LayoutDashboard, Loader2, Settings,
  AlertTriangle, RefreshCw, Play, Terminal
} from 'lucide-react';
import { Paper, Project } from '@/types';
import PdfPreview from '../modals/paper-details/PdfPreview';
import { broadcastSync } from '@/lib/sync-utils';

interface ManualScreeningDetailViewProps {
  projects: Project[];
  activeProjectId: string;
  selectedPaper: Paper;
  onClose: () => void;
  // Edit Form Fields passed from parent
  manualDecision: string;
  setManualDecision: (v: string) => void;
  manualEcTrigger: string;
  setManualEcTrigger: (v: string) => void;
  manualRationale: string;
  setManualRationale: (v: string) => void;
  manualStage: string;
  setManualStage: (v: string) => void;
  manualQaScores: Record<string, { value: number | null; evidence: string }>;
  setManualQaScores: React.Dispatch<React.SetStateAction<Record<string, { value: number | null; evidence: string }>>>;
  manualExtractedData: Record<string, { value: string; evidence: string }>;
  setManualExtractedData: React.Dispatch<React.SetStateAction<Record<string, { value: string; evidence: string }>>>;
  
  screeningSaving: boolean;
  screeningError: string | null;
  onSave: (paperId: string) => void;
  onClear: (paperId: string) => void;

  // Single PDF acquisition stream props
  manualPdfLogs: any[];
  manualPdfIsRunning: boolean;
  manualPdfStatusText: string;
  manualPdfProgress: number;
  manualPdfWaitingLogin: boolean;
  runSinglePaperPipeline: (paperId: string) => Promise<void>;
  cancelSinglePaperPipeline: () => void;
  singlePipelineAbortControllerRef: React.MutableRefObject<AbortController | null>;
  isMainPipelineRunning?: boolean;
}

export default function ManualScreeningDetailView({
  projects,
  activeProjectId,
  selectedPaper,
  onClose,
  manualDecision,
  setManualDecision,
  manualEcTrigger,
  setManualEcTrigger,
  manualRationale,
  setManualRationale,
  manualStage,
  setManualStage,
  manualQaScores,
  setManualQaScores,
  manualExtractedData,
  setManualExtractedData,
  screeningSaving,
  screeningError,
  onSave,
  onClear,
  manualPdfLogs,
  manualPdfIsRunning,
  manualPdfStatusText,
  manualPdfProgress,
  manualPdfWaitingLogin,
  runSinglePaperPipeline,
  cancelSinglePaperPipeline,
  singlePipelineAbortControllerRef,
  isMainPipelineRunning
}: ManualScreeningDetailViewProps) {
  const activeProj = projects.find(p => String(p.id) === String(activeProjectId));
  const [activeDetailTab, setActiveDetailTab] = useState<'metadata' | 'pdf'>('metadata');

  const logEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll single PDF console logs
  useEffect(() => {
    if (manualPdfIsRunning && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [manualPdfLogs, manualPdfIsRunning]);

  // Load criteria configs from project schema
  const getEcRules = () => {
    if (!activeProj) return [];
    
    if (manualStage === 'fast_filter') {
      const field = activeProj.ec_rules;
      if (!field) return [];
      try {
        return typeof field === 'string' ? JSON.parse(field) : field;
      } catch {
        return [];
      }
    }
    
    if (manualStage === 'gatekeeper') {
      const field = activeProj.pool_b_ec_rules;
      if (!field) return [];
      try {
        return typeof field === 'string' ? JSON.parse(field) : field;
      } catch {
        return [];
      }
    }
    
    if (manualStage === 'scientist') {
      const field = activeProj.pool_c_qa_rules;
      if (!field) return [];
      try {
        const parsed = typeof field === 'string' ? JSON.parse(field) : field;
        const mapped = parsed.map((rule: any) => ({
          code: `FATAL_FLAW_${rule.code}`,
          description: `Fatal Flaw: ${rule.question || ''}`
        }));
        mapped.push({
          code: 'CUMULATIVE_BELOW_4.5',
          description: 'Cumulative score below 4.5/8.0'
        });
        return mapped;
      } catch {
        return [];
      }
    }
    
    return [];
  };

  const getQaRules = () => {
    if (!activeProj || !activeProj.pool_c_qa_rules) return [];
    try {
      return typeof activeProj.pool_c_qa_rules === 'string' 
        ? JSON.parse(activeProj.pool_c_qa_rules) 
        : activeProj.pool_c_qa_rules;
    } catch {
      return [];
    }
  };

  const getExtractionRules = () => {
    if (!activeProj || !activeProj.pool_c_extraction_rules) return [];
    try {
      return typeof activeProj.pool_c_extraction_rules === 'string' 
        ? JSON.parse(activeProj.pool_c_extraction_rules) 
        : activeProj.pool_c_extraction_rules;
    } catch {
      return [];
    }
  };

  const ecRules = getEcRules();
  const qaRules = getQaRules();
  const extractionRules = getExtractionRules();

  // Toggle stage options depending on pool
  const renderStageSelector = () => (
    <div>
      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Screening Stage</label>
      <select
        value={manualStage}
        onChange={(e) => setManualStage(e.target.value)}
        className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
      >
        <option value="fast_filter">Fast Filter (Title-Abstract)</option>
        <option value="gatekeeper">Gatekeeper (Full-text)</option>
        <option value="scientist">Scientist (Quality Appraisal)</option>
        <option value="miner">Miner (Data Extraction)</option>
      </select>
    </div>
  );

  // Scientist and Miner stage auto-decision calculator (Dual-Gate Quality Cutoff / Extraction defaults)
  React.useEffect(() => {
    if (manualStage === 'scientist') {
      let total = 0;
      let answeredCount = 0;
      let fatalTriggered = '';
      
      qaRules.forEach((rule: any) => {
        const scoreObj = manualQaScores[rule.code];
        const val = scoreObj ? scoreObj.value : null;
        if (val !== null && val !== undefined) {
          total += val;
          answeredCount++;
          
          const isFatal = rule.is_fatal_flaw || ['QA1', 'QA2', 'QA3', 'QA4', 'QA6'].includes(rule.code?.toUpperCase().replace(/[^A-Z0-9]/g, ''));
          if (isFatal && val === 0.0) {
            fatalTriggered = `FATAL_FLAW_${rule.code}`;
          }
        }
      });

      if (fatalTriggered) {
        setManualDecision('EXCLUDE');
        setManualEcTrigger(fatalTriggered);
      } else if (answeredCount === qaRules.length && qaRules.length > 0) {
        if (total < 4.5) {
          setManualDecision('EXCLUDE');
          setManualEcTrigger('CUMULATIVE_BELOW_4.5');
        } else {
          setManualDecision('INCLUDE');
          setManualEcTrigger('');
        }
      } else {
        setManualDecision('');
        setManualEcTrigger('');
      }
    } else if (manualStage === 'miner') {
      setManualDecision('INCLUDE');
      setManualEcTrigger('');
    }
  }, [manualStage, manualQaScores, qaRules, setManualDecision, setManualEcTrigger]);

  const { hasChanges, validationErrors } = React.useMemo(() => {
    const errors: string[] = [];

    // Parse DB QA Scores
    let dbQaScores: Record<string, { value: number | null; evidence: string }> = {};
    const qaField = selectedPaper.manual_quality_assessment;
    if (qaField) {
      try {
        dbQaScores = typeof qaField === 'string'
          ? JSON.parse(qaField)
          : qaField;
      } catch {}
    }

    // Parse DB Extracted Data
    let dbExtData: Record<string, { value: string; evidence: string }> = {};
    if (selectedPaper.manual_extracted_data) {
      try {
        dbExtData = typeof selectedPaper.manual_extracted_data === 'string'
          ? JSON.parse(selectedPaper.manual_extracted_data)
          : selectedPaper.manual_extracted_data;
      } catch {}
    }

    // 1. Check for changes
    const decisionChanged = (manualDecision || '') !== (selectedPaper.manual_decision || '');
    const rawDbDecision = selectedPaper.manual_decision || '';
    let dbEcVal = '';
    if (rawDbDecision.startsWith('EXCLUDE')) {
      const match = rawDbDecision.match(/EXCLUDE \(([^)]+)\)/);
      if (match) {
        dbEcVal = match[1];
      }
    }
    const ecTriggerChanged = (manualEcTrigger || '') !== dbEcVal;
    const rationaleChanged = (manualRationale || '') !== (selectedPaper.manual_rationale || '');
    
    const numToStageMap: Record<number, string> = {
      0: 'unscreened',
      1: 'fast_filter',
      2: 'gatekeeper',
      3: 'scientist',
      4: 'miner'
    };
    const dbStageStr = numToStageMap[selectedPaper.manual_stage || 0] || 'fast_filter';
    const stageChanged = (manualStage || 'fast_filter') !== dbStageStr;

    let qaChanged = false;
    qaRules.forEach((rule: any) => {
      const dbVal = dbQaScores[rule.code]?.value;
      const dbEv = dbQaScores[rule.code]?.evidence || '';
      const currVal = manualQaScores[rule.code]?.value;
      const currEv = manualQaScores[rule.code]?.evidence || '';

      const valChanged = (currVal !== undefined ? currVal : null) !== (dbVal !== undefined ? dbVal : null);
      const evChanged = currEv !== dbEv;
      if (valChanged || evChanged) {
        qaChanged = true;
      }
    });

    let extChanged = false;
    extractionRules.forEach((rule: any) => {
      const dbVal = dbExtData[rule.json_key]?.value || '';
      const dbEv = dbExtData[rule.json_key]?.evidence || '';
      const currVal = manualExtractedData[rule.json_key]?.value || '';
      const currEv = manualExtractedData[rule.json_key]?.evidence || '';

      if (currVal !== dbVal || currEv !== dbEv) {
        extChanged = true;
      }
    });

    const changed = decisionChanged || ecTriggerChanged || rationaleChanged || stageChanged || qaChanged || extChanged;

    // 2. Validate fields
    if (!manualRationale || !manualRationale.trim()) {
      errors.push('Rationale/Justification is required.');
    }

    if (manualStage !== 'scientist' && manualStage !== 'miner') {
      if (!manualDecision) {
        errors.push('Human Decision Override is required.');
      } else if (manualDecision === 'EXCLUDE') {
        if (ecRules.length === 0) {
          errors.push(`Cannot submit EXCLUDE decision: No Exclusion Criteria Rules (${manualStage === 'fast_filter' ? 'Pool A' : 'Pool B'}) configured in Project Settings.`);
        } else if (!manualEcTrigger) {
          errors.push('Exclusion Criterion Triggered is required.');
        }
      }
    }

    if (manualStage === 'scientist') {
      qaRules.forEach((rule: any) => {
        const sc = manualQaScores[rule.code];
        if (!sc || sc.value === null || sc.value === undefined) {
          errors.push(`Quality appraisal score for "${rule.code}" is required.`);
        }
        if (!sc || !sc.evidence || !sc.evidence.trim()) {
          errors.push(`Evidence snippet for "${rule.code}" is required.`);
        }
      });
    }

    if (manualStage === 'miner') {
      extractionRules.forEach((rule: any) => {
        const ext = manualExtractedData[rule.json_key];
        if (!ext || !ext.value || !ext.value.trim()) {
          errors.push(`Extracted value for "${rule.json_key}" is required.`);
        }
        if (!ext || !ext.evidence || !ext.evidence.trim()) {
          errors.push(`Evidence snippet for "${rule.json_key}" is required.`);
        }
      });
    }

    return {
      hasChanges: changed,
      validationErrors: errors
    };
  }, [
    selectedPaper,
    manualDecision,
    manualEcTrigger,
    manualRationale,
    manualStage,
    manualQaScores,
    manualExtractedData,
    qaRules,
    extractionRules,
    ecRules
  ]);

  return (
    <div className="flex-1 bg-background p-6 overflow-y-auto flex flex-col space-y-6 border-l border-border/80">
      
      {/* Detail View Header controls & Top-Level Tab Switcher */}
      <div className="flex items-center justify-between shrink-0 select-none pb-2 border-b border-border/40 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Manual Screening detail</span>
          
          {/* Tabs Switcher */}
          <div className="flex items-center bg-secondary/50 border border-border rounded-lg p-0.5">
            <button
              onClick={() => setActiveDetailTab('metadata')}
              className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeDetailTab === 'metadata'
                  ? 'bg-card text-foreground shadow-sm border border-border/50 font-extrabold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Metadata & Decisions</span>
            </button>
            <button
              onClick={() => setActiveDetailTab('pdf')}
              className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeDetailTab === 'pdf'
                  ? 'bg-card text-foreground shadow-sm border border-border/50 font-extrabold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-primary" />
              <span>Full-Text PDF Viewer</span>
              <span className={`px-1.5 py-0.2 text-[8px] font-black uppercase rounded ml-1 ${
                selectedPaper.Local_PDF_Path
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                {selectedPaper.Local_PDF_Path ? 'AVAILABLE' : 'OFFLINE'}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground text-[10px] font-extrabold rounded-lg border border-border flex items-center gap-1 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close Details</span>
          </button>
        </div>
      </div>

      {activeDetailTab === 'pdf' ? (
        /* Full-Width PDF Viewer Tab View */
        <div className="flex-1 w-full min-h-[650px] h-[calc(100vh-200px)] bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col">
          {selectedPaper.Local_PDF_Path ? (
            <PdfPreview localPdfPath={selectedPaper.Local_PDF_Path} />
          ) : (
            <div className="p-6 select-none flex flex-col h-full justify-center">
              <div className={`flex flex-col items-center justify-center text-center py-6 ${manualPdfIsRunning ? 'border-b border-border/40 pb-6 shrink-0' : 'flex-1'}`}>
                <AlertTriangle className="w-14 h-14 text-amber-500 mb-4 animate-pulse" />
                <h4 className="font-bold text-base mb-1.5 text-foreground">Local PDF Not Found</h4>
                <p className="text-xs text-muted-foreground max-w-md leading-relaxed mb-6">
                  Pool B and Pool C require full-text literature screening. Trigger smart cache matching and crawler scraping specifically for this paper reference.
                </p>
                
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => runSinglePaperPipeline(selectedPaper.Paper_ID)}
                    disabled={manualPdfIsRunning || isMainPipelineRunning}
                    className={`px-5 py-2.5 font-bold rounded-xl shadow-md transition-all flex items-center gap-2 uppercase tracking-wide text-xs cursor-pointer ${
                      (manualPdfIsRunning || isMainPipelineRunning)
                        ? 'bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-50 shadow-none' 
                        : 'bg-primary text-primary-foreground hover:bg-primary/95 hover:shadow-lg hover:scale-105'
                    }`}
                  >
                    {manualPdfIsRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    {manualPdfIsRunning ? 'Acquiring PDF...' : 'Get PDF via Cache Matching & Scraping'}
                  </button>

                  {manualPdfIsRunning && (
                    <button
                      onClick={async () => {
                        singlePipelineAbortControllerRef.current?.abort();
                        await fetch('/api/pdf/batch/cancel', { method: 'POST' });
                      }}
                      className="px-4 py-2.5 border border-border text-xs font-bold uppercase rounded-xl hover:bg-secondary text-foreground transition-colors shrink-0 cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}

                  {manualPdfIsRunning && manualPdfWaitingLogin && (
                    <button
                      onClick={async () => {
                        await fetch('/api/pdf/batch/resume', { method: 'POST' });
                      }}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase rounded-xl text-xs tracking-wide shadow-md flex items-center gap-2 animate-pulse transition-all hover:scale-105 shrink-0 cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Resume Download
                    </button>
                  )}

                  {!manualPdfIsRunning && selectedPaper.DOI && (
                    <a
                      href={`https://doi.org/${encodeURIComponent(selectedPaper.DOI)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border text-xs font-bold rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <span>Publisher DOI</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}

                  {!manualPdfIsRunning && selectedPaper.PDF_Link && (
                    <a
                      href={selectedPaper.PDF_Link}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border text-xs font-bold rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <span>Direct Web Link</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {isMainPipelineRunning && (
                  <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-left max-w-md flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-xs text-amber-500 block mb-1">Single Acquisition Disabled</span>
                      <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                        The main PDF batch pipeline is currently running. Single PDF download is disabled to prevent database conflicts and browser thread locks. Please wait for the main pipeline to complete or cancel it first.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Real-time single-run console log widget */}
              {manualPdfIsRunning && (
                <div className="mt-4 h-72 border border-border/80 rounded-xl bg-black text-emerald-400 font-mono text-[10px] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300 shadow-inner select-text">
                  {/* console header */}
                  <div className="p-2.5 border-b border-border/40 bg-zinc-900/60 flex items-center justify-between shrink-0 select-none">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                      Single PDF Pipeline: {manualPdfStatusText}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-400">{manualPdfProgress}%</span>
                      {manualPdfWaitingLogin && (
                        <button
                          onClick={async () => {
                            await fetch('/api/pdf/batch/resume', { method: 'POST' });
                          }}
                          className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-black font-bold uppercase rounded text-[8px] cursor-pointer"
                        >
                          Resume Login
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          singlePipelineAbortControllerRef.current?.abort();
                          await fetch('/api/pdf/batch/cancel', { method: 'POST' });
                        }}
                        className="px-2 py-0.5 bg-destructive hover:bg-destructive/80 text-white font-bold uppercase rounded text-[8px] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  {/* logs body */}
                  <div className="flex-1 p-3 overflow-y-auto space-y-1.5">
                    {manualPdfLogs.length === 0 ? (
                      <span className="text-zinc-600 block italic">Spawning subprocess connection...</span>
                    ) : (
                      manualPdfLogs.map((log: string, index: number) => (
                        <div key={index} className="leading-normal whitespace-pre-wrap">{log}</div>
                      ))
                    )}
                    <div ref={logEndRef} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Main Content Workspace Layout (Metadata & Decisions) */
        <div className="flex flex-col xl:flex-row gap-6 w-full pb-8">
        
        {/* Left Side: Metadata Card */}
        <div className="flex-1 space-y-5">
          <div className="bg-card border border-border p-5 rounded-xl space-y-4 shadow-sm">
            <div>
              <span className="font-mono text-[9px] font-bold text-muted-foreground/80 block uppercase">
                Paper ID: {selectedPaper.Paper_ID}
              </span>
              <h2 className="font-bold text-base text-foreground leading-snug mt-1">
                {selectedPaper.Title}
              </h2>
            </div>

            {/* Metadata Fields Grid */}
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/60 text-xs font-semibold text-muted-foreground">
              <div>
                <span className="block text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Authors</span>
                <span className="text-foreground">{selectedPaper.Authors || '—'}</span>
              </div>
              <div>
                <span className="block text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Year</span>
                <span className="text-foreground">{selectedPaper.Year || '—'}</span>
              </div>
              <div>
                <span className="block text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Publisher</span>
                <span className="text-foreground">{selectedPaper.Publisher || selectedPaper.Original_Publisher || '—'}</span>
              </div>
              <div>
                <span className="block text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">DOI</span>
                <span className="text-foreground font-mono truncate block" title={selectedPaper.DOI || ''}>
                  {selectedPaper.DOI || '—'}
                </span>
              </div>
            </div>

            {/* Abstract */}
            {selectedPaper.Abstract && (
              <div className="pt-3 border-t border-border/60">
                <span className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-wider block mb-1">Abstract</span>
                <p className="text-xs text-foreground font-medium leading-relaxed max-h-48 overflow-y-auto pr-1">
                  {selectedPaper.Abstract}
                </p>
              </div>
            )}

            {/* Notes / Findings */}
            {selectedPaper.notes && (
              <div className="pt-3 border-t border-border/60">
                <span className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-wider block mb-1">General Notes</span>
                <p className="text-xs text-muted-foreground font-medium leading-relaxed italic">
                  {selectedPaper.notes}
                </p>
              </div>
            )}
          </div>

          {(() => {
            const aiDec = selectedPaper.ai_decision || '';
            const isAiExclude = aiDec.startsWith('EXCLUDE');
            let aiEcTrigger = '';
            if (isAiExclude) {
              const match = aiDec.match(/EXCLUDE \(([^)]+)\)/);
              if (match) {
                aiEcTrigger = match[1];
              }
            }
            const displayAiDec = isAiExclude ? 'EXCLUDE' : (aiDec || 'PENDING');
            
            const aiStageNames: Record<number, string> = {
              0: 'Unprocessed',
              1: 'Stage 1: Fast Filter',
              2: 'Stage 2: The Gatekeeper',
              3: 'Stage 3: The Scientist',
              4: 'Stage 4: The Miner'
            };
            const displayAiStage = aiStageNames[selectedPaper.ai_stage || 0] || 'Unprocessed';

            if (!aiDec && !selectedPaper.ai_rationale && !selectedPaper.ai_stage) return null;
            
            return (
              <div className="bg-secondary/15 border border-border/40 rounded-xl p-4 space-y-2">
                <span className="block text-[9px] text-muted-foreground/70 font-black uppercase tracking-wider">AI Screening Context Reference</span>
                <div className="flex flex-wrap gap-4 justify-between items-start">
                  <div>
                    <span className="block text-[9px] text-muted-foreground/60">AI Stage Progress</span>
                    <span className="text-foreground text-xs font-bold block mt-0.5">{displayAiStage}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-muted-foreground/60">Decision</span>
                    <span className={`inline-block px-1.5 py-0.5 mt-0.5 rounded text-[10px] font-extrabold uppercase border ${
                      displayAiDec === 'INCLUDE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      displayAiDec === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {displayAiDec}
                    </span>
                  </div>
                  {aiEcTrigger && (
                    <div>
                      <span className="block text-[9px] text-muted-foreground/60">AI Exclusion Trigger</span>
                      <span className="text-foreground text-xs font-bold block mt-0.5">{aiEcTrigger}</span>
                    </div>
                  )}
                </div>
                {selectedPaper.ai_rationale && (
                  <div className="pt-1.5 border-t border-border/20">
                    <span className="block text-[9px] text-muted-foreground/60">AI Reasoning Rationale</span>
                    <p className="text-[11px] text-muted-foreground font-medium mt-0.5 leading-relaxed italic line-clamp-3" title={selectedPaper.ai_rationale}>
                      "{selectedPaper.ai_rationale}"
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Right Side: Active Decisions Input Form Panel */}
        <div className="w-full xl:w-[480px] space-y-4">
          <div className="bg-card border border-border p-5 rounded-xl space-y-4 shadow-sm">
            <span className="text-[10px] text-primary uppercase font-black tracking-wider block">Decision Panel</span>

            {/* Error notifications */}
            {screeningError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{screeningError}</span>
              </div>
            )}

            <div className="space-y-4">
              {renderStageSelector()}

              {manualStage !== 'scientist' && manualStage !== 'miner' ? (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Human Decision Override</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { val: 'INCLUDE', label: 'Include', activeColor: 'bg-emerald-600 text-white border-emerald-600 shadow-sm' },
                        { val: 'EXCLUDE', label: 'Exclude', activeColor: 'bg-rose-600 text-white border-rose-600 shadow-sm' }
                      ].map((item) => {
                        const isActive = manualDecision === item.val;
                        return (
                          <button
                            key={item.val}
                            type="button"
                            onClick={() => setManualDecision(item.val)}
                            className={`px-3 py-2 border rounded-lg text-center text-xs font-bold transition-all cursor-pointer flex-1 ${
                              isActive
                                ? item.activeColor
                                : 'bg-secondary border-border text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Exclusions checklist dropdown */}
                  {manualDecision === 'EXCLUDE' && (
                    ecRules.length > 0 ? (
                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Exclusion Criterion Triggered</label>
                        <select
                          value={manualEcTrigger}
                          onChange={(e) => setManualEcTrigger(e.target.value)}
                          className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:border-primary font-mono"
                        >
                          <option value="">Select criteria...</option>
                          {ecRules.map((rule: any) => (
                            <option key={rule.code} value={rule.code}>
                              {rule.code} - {rule.description}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs space-y-2">
                        <div className="flex items-center gap-1.5 text-amber-500 font-bold">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>No Exclusion Criteria Rules Configured</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Project Settings does not have any Exclusion Criteria Rules ({manualStage === 'fast_filter' ? 'Pool A' : 'Pool B'}) defined. You must configure rules before submitting an EXCLUDE decision.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('open-project-settings', {
                              detail: { initialTab: 'calibration', project: activeProj }
                            }));
                          }}
                          className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-md text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          Configure Rules in Project Settings
                        </button>
                      </div>
                    )
                  )}
                </>
              ) : manualStage === 'miner' ? (
                /* Miner stage info banner */
                <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-xs space-y-1">
                  <span className="block text-[9px] uppercase tracking-wider text-emerald-400 font-black">Stage 4: Miner (Data Extraction)</span>
                  <p className="text-[11px] font-semibold text-muted-foreground leading-relaxed">
                    Paper screening decision is set to <strong className="text-emerald-400 font-extrabold uppercase">INCLUDE</strong>. Complete the data extraction variables below.
                  </p>
                </div>
              ) : (
                /* Scientist stage auto-calculated info banner */
                <div className="p-3 bg-secondary/30 rounded-lg border border-border/80 text-xs space-y-1.5">
                  <span className="block text-[9px] uppercase tracking-wider text-muted-foreground/60 font-black">Quality appraisal stats (Auto-calculated)</span>
                  <div className="flex justify-between font-bold">
                    <span>Cumulative Score:</span>
                    <span className="text-foreground">{(() => {
                      let total = 0;
                      qaRules.forEach((rule: any) => {
                        const scoreObj = manualQaScores[rule.code];
                        if (scoreObj && scoreObj.value !== null) {
                          total += scoreObj.value;
                        }
                      });
                      return `${total.toFixed(1)} / ${qaRules.length}.0`;
                    })()}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Calculated Decision:</span>
                    <span className={manualDecision === 'INCLUDE' ? 'text-emerald-500' : manualDecision === 'EXCLUDE' ? 'text-rose-500' : 'text-amber-500'}>
                      {manualDecision || 'PENDING'}
                    </span>
                  </div>
                  {manualDecision === 'EXCLUDE' && manualEcTrigger && (
                    <div className="text-[10px] text-rose-400 font-semibold bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded">
                      Exclusion trigger: {manualEcTrigger}
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase">
                    Rationale / Exclusion Justification
                  </label>
                  {/* Reasoning Templates Quick Insertion dropdown */}
                  {(() => {
                    const templates = (() => {
                      const raw = manualStage === 'gatekeeper'
                        ? activeProj?.pool_b_reasoning_template
                        : activeProj?.reasoning_template;
                      if (!raw) return [];
                      try {
                        return typeof raw === 'string' ? JSON.parse(raw) : raw;
                      } catch {
                        if (typeof raw === 'string') return [raw];
                        return Array.isArray(raw) ? raw : [];
                      }
                    })();

                    if (!templates || templates.length === 0) return null;

                    return (
                      <select
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            setManualRationale(manualRationale ? `${manualRationale}\n${val}` : val);
                            e.target.value = '';
                          }
                        }}
                        className="bg-transparent border-0 text-[10px] font-extrabold text-primary hover:underline focus:outline-none max-w-[180px] cursor-pointer"
                      >
                        <option value="">+ Insert Template...</option>
                        {templates.map((tpl: string, idx: number) => (
                          <option key={idx} value={tpl} className="bg-card text-foreground">
                            {tpl.length > 30 ? `${tpl.substring(0, 30)}...` : tpl}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
                <textarea
                  rows={4}
                  placeholder="Provide details on inclusion/exclusion reasons..."
                  value={manualRationale}
                  onChange={(e) => setManualRationale(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg p-2.5 text-xs text-foreground focus:outline-none focus:border-primary font-medium leading-relaxed"
                />
              </div>

              {/* Quality Appraisal rules checklist (Scientist) */}
              {manualStage === 'scientist' && qaRules.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="block text-[9px] text-muted-foreground font-black uppercase tracking-wider border-b border-border pb-1">
                    Quality Appraisal Rules Check
                  </span>
                  {qaRules.map((rule: any) => {
                    const currentVal = manualQaScores[rule.code]?.value;
                    const currentEv = manualQaScores[rule.code]?.evidence || '';
                    
                    return (
                      <div key={rule.code} className="p-3 bg-secondary/20 rounded-lg border border-border/40 space-y-2">
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-xs font-bold text-foreground">
                            {rule.code}: {rule.question}
                          </span>
                          {rule.is_fatal_flaw && (
                            <span className="px-1.5 py-0.2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded text-[7px] font-black shrink-0">
                              Fatal Flaw
                            </span>
                          )}
                        </div>
                        
                        <div className="flex gap-1 select-none">
                          {[
                            { val: 1.0, label: 'Yes (1.0)' },
                            { val: 0.5, label: 'Partial (0.5)' },
                            { val: 0.0, label: 'No (0.0)' }
                          ].map((sc) => (
                            <button
                              key={sc.val}
                              type="button"
                              onClick={() => setManualQaScores(prev => ({
                                ...prev,
                                [rule.code]: { value: sc.val, evidence: currentEv }
                              }))}
                              className={`flex-1 py-1 rounded border text-[10px] font-extrabold uppercase transition-colors cursor-pointer ${
                                currentVal === sc.val
                                  ? 'bg-primary border-primary text-primary-foreground'
                                  : 'bg-secondary border-border text-muted-foreground hover:bg-secondary/80'
                              }`}
                            >
                              {sc.label}
                            </button>
                          ))}
                        </div>

                        <textarea
                          rows={1.5}
                          placeholder="Evidence snippet from full-text..."
                          value={currentEv}
                          onChange={(e) => {
                            const evText = e.target.value;
                            setManualQaScores(prev => ({
                              ...prev,
                              [rule.code]: { value: currentVal ?? null, evidence: evText }
                            }));
                          }}
                          className="w-full bg-background border border-border rounded p-1.5 text-[11px] text-foreground focus:outline-none"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Data Extraction variables (Miner) */}
              {manualStage === 'miner' && extractionRules.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="block text-[9px] text-muted-foreground font-black uppercase tracking-wider border-b border-border pb-1">
                    Data Extraction Variables
                  </span>
                  {extractionRules.map((rule: any) => {
                    const currentVal = manualExtractedData[rule.json_key]?.value || '';
                    const currentEv = manualExtractedData[rule.json_key]?.evidence || '';
                    
                    return (
                      <div key={rule.json_key} className="p-3 bg-secondary/20 rounded-lg border border-border/40 space-y-2">
                        <label className="block text-xs font-bold text-foreground">
                          {rule.json_key} - <span className="text-muted-foreground">{rule.question}</span>
                        </label>
                        
                        <input
                          type="text"
                          placeholder="Extracted value..."
                          value={currentVal}
                          onChange={(e) => {
                            const v = e.target.value;
                            setManualExtractedData(prev => ({
                              ...prev,
                              [rule.json_key]: { value: v, evidence: currentEv }
                            }));
                          }}
                          className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                        />

                        <textarea
                          rows={2}
                          placeholder="Location/Evidence snippet from paper..."
                          value={currentEv}
                          onChange={(e) => {
                            const evText = e.target.value;
                            setManualExtractedData(prev => ({
                              ...prev,
                              [rule.json_key]: { value: currentVal, evidence: evText }
                            }));
                          }}
                          className="w-full bg-background border border-border rounded p-1.5 text-[11px] text-foreground focus:outline-none focus:border-primary"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Validation errors */}
            {hasChanges && validationErrors.length > 0 && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-lg space-y-1 text-[11px] font-semibold">
                <span className="block font-bold uppercase text-[9px] tracking-wider mb-0.5">Missing Required Fields:</span>
                <ul className="list-disc pl-3.5 space-y-0.5">
                  {validationErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions Submit buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => onSave(selectedPaper.Paper_ID)}
                disabled={screeningSaving || !hasChanges || validationErrors.length > 0}
                className="flex-1 py-2 bg-primary text-primary-foreground hover:bg-primary/95 disabled:opacity-40 rounded-xl text-xs font-black uppercase tracking-wide transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {screeningSaving ? 'Saving...' : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Decision</span>
                  </>
                )}
              </button>

              {selectedPaper.manual_decision && (
                <button
                  onClick={() => onClear(selectedPaper.Paper_ID)}
                  disabled={screeningSaving}
                  className="px-3.5 py-2 border border-border hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="Wipe and clear manual decisions"
                >
                  <Trash className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Local PDF status view alert */}
          {!selectedPaper.Local_PDF_Path && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <span className="block font-bold">Local PDF File Offline</span>
                <span className="text-[10px] leading-relaxed text-muted-foreground/80 block mt-0.5">
                  Gatekeeper, Scientist, and Miner stages require full-text inspection. Execute the Data Acquisition pipeline first to sync PDF file.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
