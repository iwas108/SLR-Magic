import React, { useState, useEffect, useRef } from 'react';
import { X, GitCommit, RefreshCw, AlertCircle, ExternalLink, Download, Play } from 'lucide-react';
import { useNdjsonStream } from '@/hooks/useNdjsonStream';
import { broadcastSync } from '@/lib/sync-utils';
import { calculatePoolCDecision } from '@/lib/inter-rater/adjudication-calculations';
import AdjudicationScorecardView from '@/components/features/inter-rater/AdjudicationScorecardView';
import DataExtractionComparisonView from '@/components/features/inter-rater/DataExtractionComparisonView';
import PdfPreview from '@/components/features/modals/paper-details/PdfPreview';

interface RollingBatchAdjudicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  discrepancy: any;
  activeProject: any;
  qaRules: any[];
  extractionRules: any[];
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  discrepancies?: any[];
  onSelectDiscrepancy?: (discrepancy: any) => void;
  batchId: string;
}

export default function RollingBatchAdjudicationModal({
  isOpen,
  onClose,
  onSuccess,
  discrepancy,
  activeProject,
  qaRules,
  extractionRules,
  showToast,
  discrepancies = [],
  onSelectDiscrepancy,
  batchId
}: RollingBatchAdjudicationModalProps) {
  const [adjudicateDecision, setAdjudicateDecision] = useState<'Include' | 'Exclude'>('Include');
  const [adjudicateEc, setAdjudicateEc] = useState<string>('');
  const [adjudicateRationale, setAdjudicateRationale] = useState<string>('');
  const [commitMessage, setCommitMessage] = useState<string>('');
  const [submittingAdjudication, setSubmittingAdjudication] = useState(false);

  const [adjudicateQaScores, setAdjudicateQaScores] = useState<Record<string, { value: number | null, evidence: string }>>({});
  const [adjudicateExtractedData, setAdjudicateExtractedData] = useState<Record<string, { value: string, evidence: string }>>({});
  const [adjudicationWorkspaceTab, setAdjudicationWorkspaceTab] = useState<'qa' | 'extraction'>('qa');

  const [activeLeftTab, setActiveLeftTab] = useState<'pdf' | 'details'>('details');
  const [localPaperDetails, setLocalPaperDetails] = useState<any>(null);

  const [crawlerIsRunning, setCrawlerIsRunning] = useState(false);
  const [crawlerWaitingLogin, setCrawlerWaitingLogin] = useState(false);
  const [crawlerLogs, setCrawlerLogs] = useState<string[]>([]);
  const [crawlerProgress, setCrawlerProgress] = useState(0);
  const [crawlerStatusText, setCrawlerStatusText] = useState('');
  const [lastCommittedState, setLastCommittedState] = useState<string | null>(null);

  const currentFormState = JSON.stringify({
    adjudicateDecision,
    adjudicateEc,
    adjudicateRationale,
    commitMessage,
    adjudicateQaScores,
    adjudicateExtractedData
  });

  const isCommitted = lastCommittedState === currentFormState;

  const refreshPaperDetails = async () => {
    if (!discrepancy) return;
    try {
      const res = await fetch(`/api/papers/${discrepancy.paper_id}`);
      if (res.ok) {
        const updatedPaper = await res.json();
        setLocalPaperDetails((prev: any) => ({
          ...prev,
          local_pdf_path: updatedPaper.Local_PDF_Path
        }));
      }
    } catch (err) {
      console.error('Failed to refresh paper details:', err);
    }
  };

  const lastLoadedDiscrepancyRef = useRef<any | null>(null);

  useEffect(() => {
    if (isOpen && discrepancy) {
      const isNewPaper = !lastLoadedDiscrepancyRef.current || lastLoadedDiscrepancyRef.current.paper_id !== discrepancy.paper_id;
      
      const dbValuesChanged = lastLoadedDiscrepancyRef.current && (
        lastLoadedDiscrepancyRef.current.resolved_decision !== discrepancy.resolved_decision ||
        JSON.stringify(lastLoadedDiscrepancyRef.current.r1_qa_scores) !== JSON.stringify(discrepancy.r1_qa_scores) ||
        JSON.stringify(lastLoadedDiscrepancyRef.current.r2_qa_scores) !== JSON.stringify(discrepancy.r2_qa_scores)
      );

      lastLoadedDiscrepancyRef.current = discrepancy;

      const details = {
        title: discrepancy.title || discrepancy.Title,
        abstract: discrepancy.abstract || discrepancy.Abstract,
        authors: discrepancy.authors || discrepancy.Authors,
        year: discrepancy.year || discrepancy.Year,
        doi: discrepancy.doi || discrepancy.DOI,
        source: discrepancy.source || discrepancy.Source,
        pdf_link: discrepancy.pdf_link || discrepancy.PDF_Link,
        publisher: discrepancy.publisher || discrepancy.Publisher,
        local_pdf_path: discrepancy.local_pdf_path || discrepancy.Local_PDF_Path
      };
      setLocalPaperDetails(details);

      if (isNewPaper || dbValuesChanged) {
        setAdjudicateDecision(discrepancy.resolved_decision || 'Include');
        setAdjudicateEc(discrepancy.resolved_ec || '');
        setAdjudicateRationale(discrepancy.resolved_rationale || '');
        setCommitMessage('');
        setLastCommittedState(null);
        refreshPaperDetails();

        if (isNewPaper) {
          setActiveLeftTab('details');
          setCrawlerIsRunning(false);
          setCrawlerWaitingLogin(false);
          setCrawlerLogs([]);
          setCrawlerProgress(0);
          setCrawlerStatusText('');
          setAdjudicationWorkspaceTab('qa');
        }

        // Helper to extract QA score object with clean key matching
        const getQaScoreObj = (qaObj: any, ruleCode: string) => {
          if (!qaObj || typeof qaObj !== 'object') return { value: null, evidence: '' };
          const cleanCode = ruleCode.toLowerCase().replace(/[^a-z0-9]/g, '');
          const matchKey = Object.keys(qaObj).find(k => {
            const kl = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            return kl === cleanCode || kl.startsWith(cleanCode);
          });
          const item = matchKey ? qaObj[matchKey] : undefined;
          if (item === undefined || item === null) return { value: null, evidence: '' };
          if (typeof item === 'object') {
            const val = item.value ?? item.score ?? item.val ?? null;
            const num = val !== null ? parseFloat(String(val)) : null;
            const ev = item.evidence ?? item.exact_quote ?? item.quote ?? '';
            return { value: !isNaN(num!) ? num : val, evidence: String(ev) };
          }
          const num = parseFloat(String(item));
          return { value: !isNaN(num) ? num : item, evidence: '' };
        };

        const getExtDataObj = (extObj: any, jsonKey: string) => {
          if (!extObj || typeof extObj !== 'object') return { value: '', evidence: '' };
          const cleanKey = jsonKey.toLowerCase().replace(/[^a-z0-9]/g, '');
          const matchKey = Object.keys(extObj).find(k => {
            const kl = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            return kl === cleanKey || kl.startsWith(cleanKey);
          });
          const item = matchKey ? extObj[matchKey] : undefined;
          if (item === undefined || item === null) return { value: '', evidence: '' };
          if (typeof item === 'object') {
            let val = item.value ?? item.val ?? item.text ?? '';
            if (Array.isArray(val)) val = val.join(', ');
            const ev = item.evidence ?? item.quote ?? '';
            return { value: String(val), evidence: String(ev) };
          }
          return { value: String(item), evidence: '' };
        };

        // Initialize review comparison scores
        const r1_qa = JSON.parse(discrepancy.r1_qa_scores || '{}');
        const r2_qa = JSON.parse(discrepancy.r2_qa_scores || '{}');
        const qaInit: any = {};
        qaRules.forEach(rule => {
          const obj1 = getQaScoreObj(r1_qa, rule.code);
          const obj2 = getQaScoreObj(r2_qa, rule.code);
          const v1 = obj1.value;
          const v2 = obj2.value;
          const ev1 = obj1.evidence;
          const ev2 = obj2.evidence;
          qaInit[rule.code] = {
            value: v1 === v2 ? v1 : v1 !== undefined && v1 !== null ? v1 : v2,
            evidence: v1 === v2 ? ev1 : ev1 || ev2
          };
        });
        setAdjudicateQaScores(qaInit);

        const r1_ext = JSON.parse(discrepancy.r1_extracted_data || '{}');
        const r2_ext = JSON.parse(discrepancy.r2_extracted_data || '{}');
        const extInit: any = {};
        extractionRules.forEach(rule => {
          const obj1 = getExtDataObj(r1_ext, rule.json_key);
          const obj2 = getExtDataObj(r2_ext, rule.json_key);
          const v1 = obj1.value;
          const v2 = obj2.value;
          const ev1 = obj1.evidence;
          const ev2 = obj2.evidence;
          extInit[rule.json_key] = {
            value: v1 === v2 ? v1 : v1 || v2,
            evidence: v1 === v2 ? ev1 : ev1 || ev2
          };
        });
        setAdjudicateExtractedData(extInit);
      }
    } else if (!isOpen) {
      lastLoadedDiscrepancyRef.current = null;
    }
  }, [isOpen, discrepancy, qaRules, extractionRules]);

  const previewDecision = React.useMemo(() => {
    if (!adjudicateQaScores) return null;
    return calculatePoolCDecision(adjudicateQaScores, qaRules);
  }, [adjudicateQaScores, qaRules]);

  const { connect: connectNdjson, cancelStream: cancelSinglePaperPipeline } = useNdjsonStream({
    onEvent: (parsed) => {
      if (parsed.event === 'log') {
        setCrawlerLogs(prev => [...prev, parsed.message]);
      } else if (parsed.event === 'progress') {
        setCrawlerProgress(parsed.pct || 0);
        if (parsed.message) setCrawlerStatusText(parsed.message);
      } else if (parsed.event === 'step_start' || parsed.event === 'step_complete') {
        if (parsed.message) setCrawlerStatusText(parsed.message);
        setCrawlerLogs(prev => [...prev, `[STEP]: ${parsed.message}`]);
      } else if (parsed.event === 'waiting_login') {
        setCrawlerWaitingLogin(true);
        setCrawlerStatusText(parsed.message);
      } else if (parsed.event === 'resume') {
        setCrawlerWaitingLogin(false);
        setCrawlerStatusText('Resuming...');
      } else if (parsed.event === 'complete') {
        setCrawlerProgress(100);
        setCrawlerStatusText('Success!');
        setCrawlerLogs(prev => [...prev, '✓ PDF acquisition finished successfully.']);
        showToast('PDF acquired successfully!', 'success');
      } else if (parsed.event === 'error') {
        setCrawlerLogs(prev => [...prev, `✗ Error: ${parsed.message}`]);
        showToast(parsed.message || 'Failed to acquire PDF', 'error');
      }
    },
    onComplete: async () => {
      await refreshPaperDetails();
      setActiveLeftTab('pdf');
      broadcastSync('SYNC_PAPERS');
      broadcastSync('SYNC_PROJECTS');
      setCrawlerIsRunning(false);
      setCrawlerWaitingLogin(false);
    },
    onError: (err) => {
      showToast(err.message || 'Error acquiring PDF', 'error');
      setCrawlerLogs(prev => [...prev, `Error: ${err.message}`]);
      setCrawlerIsRunning(false);
      setCrawlerWaitingLogin(false);
    }
  });

  const runSinglePaperPipeline = async () => {
    if (!discrepancy?.paper_id) return;
    setCrawlerIsRunning(true);
    setCrawlerLogs([]);
    setCrawlerProgress(0);
    setCrawlerStatusText('Starting acquisition...');
    setCrawlerWaitingLogin(false);

    try {
      await connectNdjson('/api/pdf/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          paperId: discrepancy.paper_id,
          projectId: activeProject?.id || discrepancy.project_id || ''
        })
      });
    } catch (err: any) {
      setCrawlerIsRunning(false);
      setCrawlerWaitingLogin(false);
    }
  };

  const handleResumeCrawler = async () => {
    try {
      const res = await fetch('/api/pdf/batch/resume', { method: 'POST' });
      if (res.ok) {
        showToast('Resuming crawler...', 'info');
        setCrawlerWaitingLogin(false);
      }
    } catch (err: any) {
      showToast(err.message || 'Error resuming crawler', 'error');
    }
  };

  const handleCommitAdjudication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discrepancy) return;
    if (!commitMessage.trim()) {
      showToast('Commit message is required.', 'error');
      return;
    }

    // Ensure all QA scores have a default numerical value (0) if unreviewed, preventing blocked commits
    const resolvedQaScores = { ...adjudicateQaScores };
    qaRules.forEach(rule => {
      if (resolvedQaScores[rule.code]?.value === null || resolvedQaScores[rule.code]?.value === undefined) {
        resolvedQaScores[rule.code] = {
          value: 0,
          evidence: resolvedQaScores[rule.code]?.evidence || 'Unreviewed criterion auto-defaulted to 0'
        };
      }
    });

    setSubmittingAdjudication(true);
    try {
      const bodyData = {
        paper_id: discrepancy.paper_id,
        batch_id: batchId,
        final_qa_scores: resolvedQaScores,
        final_extracted_data: adjudicateExtractedData,
        commit_message: commitMessage
      };

      const res = await fetch('/api/rolling-batch/adjudicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Committed adjudication for ${discrepancy.paper_id}`, 'success');
        setLastCommittedState(currentFormState);
        onSuccess();
      } else {
        showToast(data.error || 'Failed to commit adjudication', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error sending adjudication request', 'error');
    } finally {
      setSubmittingAdjudication(false);
    }
  };

  const [localDiscrepancies, setLocalDiscrepancies] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (localDiscrepancies.length === 0 && discrepancies.length > 0) {
        setLocalDiscrepancies(discrepancies);
      }
    } else {
      if (localDiscrepancies.length > 0) {
        setLocalDiscrepancies([]);
      }
    }
  }, [isOpen, discrepancies, localDiscrepancies.length]);

  const activeDiscrepancies = localDiscrepancies.length > 0 ? localDiscrepancies : discrepancies;
  const currentIndex = activeDiscrepancies.findIndex(d => d.paper_id === discrepancy?.paper_id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < activeDiscrepancies.length - 1;

  const handlePrev = () => {
    if (hasPrev && onSelectDiscrepancy) {
      onSelectDiscrepancy(activeDiscrepancies[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext && onSelectDiscrepancy) {
      onSelectDiscrepancy(activeDiscrepancies[currentIndex + 1]);
    }
  };

  if (!isOpen || !discrepancy) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full h-full max-w-7xl max-h-[90vh] rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in duration-150">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center select-none shrink-0">
          <div>
            <h3 className="text-sm font-extrabold text-foreground">Rolling Batch Adjudication Workspace</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{discrepancy.paper_id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Container */}
        <form onSubmit={handleCommitAdjudication} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border overflow-hidden">
            
            {/* Left Pane: Paper Details & PDF Preview */}
            <div className="flex flex-col overflow-hidden h-full">
              {/* Left Tabs */}
              <div className="flex border-b border-border shrink-0 select-none bg-muted/20">
                <button
                  type="button"
                  onClick={() => setActiveLeftTab('details')}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                    activeLeftTab === 'details' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Abstract & Details
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLeftTab('pdf')}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                    activeLeftTab === 'pdf' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  PDF Viewer
                </button>
              </div>

              {/* Tab Panels */}
              <div className="flex-1 overflow-y-auto p-6 relative">
                {/* Abstract & Details Tab */}
                <div style={{ display: activeLeftTab === 'details' ? 'block' : 'none' }} className="space-y-5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Paper Title</label>
                    <h4 className="text-base font-extrabold text-foreground leading-snug">{localPaperDetails?.title}</h4>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-muted/20 border border-border/50 p-4 rounded-xl text-xs">
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Authors</span>
                      <p className="font-semibold text-foreground truncate" title={localPaperDetails?.authors}>{localPaperDetails?.authors || 'Unknown'}</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Year</span>
                      <p className="font-semibold text-foreground">{localPaperDetails?.year || 'Unknown'}</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Publisher</span>
                      <p className="font-semibold text-foreground truncate" title={localPaperDetails?.publisher}>{localPaperDetails?.publisher || 'Unknown'}</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Source</span>
                      <p className="font-semibold text-foreground">{localPaperDetails?.source || 'Unknown'}</p>
                    </div>
                    {localPaperDetails?.pdf_link && (
                      <div className="sm:col-span-2 space-y-0.5 border-t border-border/30 pt-2 mt-1">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Original URL</span>
                        <a
                          href={localPaperDetails.pdf_link}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-primary hover:underline block truncate"
                          title={localPaperDetails.pdf_link}
                        >
                          {localPaperDetails.pdf_link}
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Abstract</label>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {localPaperDetails?.abstract || 'No abstract available for this paper.'}
                    </p>
                  </div>
                </div>

                {/* PDF Preview Tab */}
                <div style={{ display: activeLeftTab === 'pdf' ? 'flex' : 'none', height: '100%' }} className="min-h-[300px] flex flex-col">
                  {localPaperDetails?.local_pdf_path ? (
                    <div className="flex-1 flex flex-col border border-border rounded-xl overflow-hidden bg-card shadow-sm h-full">
                      <PdfPreview localPdfPath={localPaperDetails.local_pdf_path} />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-2xl bg-card min-h-[300px] space-y-4 flex-1">
                      <div className="p-3 bg-red-500/10 text-red-500 rounded-full">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <div className="text-center space-y-1">
                        <h4 className="text-sm font-bold text-foreground">Local PDF Not Acquired</h4>
                        <p className="text-xs text-muted-foreground max-w-xs text-center">
                          This paper does not have a cached or downloaded PDF on the local machine.
                        </p>
                      </div>

                      {!crawlerIsRunning ? (
                        <button
                          type="button"
                          onClick={runSinglePaperPipeline}
                          className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                        >
                          <Download className="w-4 h-4" />
                          Match & Acquire PDF
                        </button>
                      ) : (
                        <div className="w-full max-w-md space-y-3">
                          <div className="flex justify-between text-xs font-semibold text-muted-foreground px-1">
                            <span>{crawlerStatusText}</span>
                            <span>{crawlerProgress}%</span>
                          </div>
                          <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-primary h-full transition-all duration-300"
                              style={{ width: `${crawlerProgress}%` }}
                            />
                          </div>
                          <div className="bg-muted/50 border border-border rounded-lg p-3 max-h-[150px] overflow-y-auto font-mono text-[10px] space-y-1 text-left">
                            {crawlerLogs.map((log, idx) => (
                              <div key={idx} className="truncate" title={log}>{log}</div>
                            ))}
                          </div>
                          <div className="flex gap-2 select-none">
                            <button
                              type="button"
                              onClick={cancelSinglePaperPipeline}
                              className="flex-1 py-1.5 border border-border hover:bg-muted text-xs font-bold rounded-lg text-destructive"
                            >
                              Cancel Process
                            </button>
                            {crawlerWaitingLogin && (
                              <button
                                type="button"
                                onClick={handleResumeCrawler}
                                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 animate-pulse"
                              >
                                <Play className="w-3.5 h-3.5 fill-current animate-pulse" />
                                Resume Scraper
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Controls & Commit Message */}
              <div className="p-4 border-t border-border bg-muted/30 shrink-0 space-y-3">
                <div className="bg-card border border-border rounded-xl p-3 flex justify-between items-center text-xs">
                  <span className="font-bold text-muted-foreground uppercase text-[10px]">Calculated Decision Preview</span>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded border ${
                    previewDecision?.decision === 'Include' 
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                      : 'bg-red-500/10 text-red-500 border-red-500/20'
                  }`}>
                    {previewDecision ? `${previewDecision.decision.toUpperCase()} (Score: ${previewDecision.totalScore.toFixed(1)})` : 'Calculating...'}
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Commit Message</label>
                  <input
                    type="text"
                    placeholder="e.g. Adjudicated Scientist scores on reproducibility"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    className="w-full bg-card border border-border text-foreground px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>

                <div className="flex justify-between items-center pt-2 select-none border-t border-border/30">
                  {activeDiscrepancies.length > 1 ? (
                    <div className="flex items-center gap-1.5 bg-secondary border border-border px-2.5 py-1 rounded-xl">
                      <button
                        type="button"
                        onClick={handlePrev}
                        disabled={!hasPrev}
                        className="px-2 py-0.5 text-[10px] font-extrabold bg-card border border-border rounded-lg hover:bg-muted disabled:opacity-50 text-foreground transition-all"
                      >
                        &larr; Prev
                      </button>
                      <span className="text-[10px] font-bold px-1 text-muted-foreground font-mono">
                        {currentIndex + 1} / {activeDiscrepancies.length}
                      </span>
                      <button
                        type="button"
                        onClick={handleNext}
                        disabled={!hasNext}
                        className="px-2 py-0.5 text-[10px] font-extrabold bg-card border border-border rounded-lg hover:bg-muted disabled:opacity-50 text-foreground transition-all"
                      >
                        Next &rarr;
                      </button>
                    </div>
                  ) : (
                    <div />
                  )}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                      disabled={submittingAdjudication}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                      disabled={submittingAdjudication || isCommitted}
                    >
                      {submittingAdjudication ? <RefreshCw className="w-4 h-4 animate-spin" /> : <GitCommit className="w-4 h-4" />}
                      Commit Resolution
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Pane: Reviewer Comparison */}
            <div className="p-6 flex flex-col overflow-y-auto max-h-[50vh] md:max-h-full bg-muted/10">
              <div className="flex justify-between items-center mb-3 shrink-0 select-none">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Blinded Review Comparison</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (adjudicationWorkspaceTab === 'qa') {
                        const r1_qa = JSON.parse(discrepancy.r1_qa_scores || '{}');
                        const qaInit: any = {};
                        qaRules.forEach(rule => {
                          const val = r1_qa[rule.code]?.value;
                          qaInit[rule.code] = {
                            value: val !== undefined ? val : null,
                            evidence: r1_qa[rule.code]?.evidence || ''
                          };
                        });
                        setAdjudicateQaScores(qaInit);
                      } else {
                        const r1_ext = JSON.parse(discrepancy.r1_extracted_data || '{}');
                        const extInit: any = {};
                        extractionRules.forEach(rule => {
                          extInit[rule.json_key] = {
                            value: r1_ext[rule.json_key]?.value || '',
                            evidence: r1_ext[rule.json_key]?.evidence || ''
                          };
                        });
                        setAdjudicateExtractedData(extInit);
                      }
                    }}
                    className="px-2.5 py-1 bg-blue-500/15 hover:bg-blue-500/20 text-blue-500 border border-blue-500/25 text-[9px] font-bold rounded-lg transition-all"
                  >
                    Use All Alpha
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (adjudicationWorkspaceTab === 'qa') {
                        const r2_qa = JSON.parse(discrepancy.r2_qa_scores || '{}');
                        const qaInit: any = {};
                        qaRules.forEach(rule => {
                          const val = r2_qa[rule.code]?.value;
                          qaInit[rule.code] = {
                            value: val !== undefined ? val : null,
                            evidence: r2_qa[rule.code]?.evidence || ''
                          };
                        });
                        setAdjudicateQaScores(qaInit);
                      } else {
                        const r2_ext = JSON.parse(discrepancy.r2_extracted_data || '{}');
                        const extInit: any = {};
                        extractionRules.forEach(rule => {
                          extInit[rule.json_key] = {
                            value: r2_ext[rule.json_key]?.value || '',
                            evidence: r2_ext[rule.json_key]?.evidence || ''
                          };
                        });
                        setAdjudicateExtractedData(extInit);
                      }
                    }}
                    className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/25 text-[9px] font-bold rounded-lg transition-all"
                  >
                    Use All Beta
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border mb-4 shrink-0 select-none">
                <button
                  type="button"
                  onClick={() => setAdjudicationWorkspaceTab('qa')}
                  className={`flex-1 pb-2 text-xs font-extrabold border-b-2 transition-all ${
                    adjudicationWorkspaceTab === 'qa' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
                  }`}
                >
                  Quality Assessment ({qaRules.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAdjudicationWorkspaceTab('extraction')}
                  className={`flex-1 pb-2 text-xs font-extrabold border-b-2 transition-all ${
                    adjudicationWorkspaceTab === 'extraction' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
                  }`}
                >
                  Data Extraction ({extractionRules.length})
                </button>
              </div>

              {/* Sub-tab scroll panels */}
              <div className="flex-1 overflow-y-auto space-y-6 pr-1">
                {adjudicationWorkspaceTab === 'qa' ? (
                  <AdjudicationScorecardView
                    activePoolTab="pool_c"
                    selectedDiscrepancy={discrepancy}
                    qaRules={qaRules}
                    adjudicateQaScores={adjudicateQaScores}
                    setAdjudicateQaScores={setAdjudicateQaScores}
                  />
                ) : (
                  <DataExtractionComparisonView
                    selectedDiscrepancy={discrepancy}
                    extractionRules={extractionRules}
                    adjudicateExtractedData={adjudicateExtractedData}
                    setAdjudicateExtractedData={setAdjudicateExtractedData}
                  />
                )}
              </div>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}
