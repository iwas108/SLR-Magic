import React, { useState, useEffect, useRef } from 'react';
import { X, GitCommit, RefreshCw, FileText, Eye, Download, AlertCircle, ExternalLink, Play } from 'lucide-react';
import { useNdjsonStream } from '@/hooks/useNdjsonStream';
import { broadcastSync } from '@/lib/sync-utils';
import { calculatePoolCDecision } from '@/lib/inter-rater/adjudication-calculations';
import AdjudicationScorecardView from '@/components/features/inter-rater/AdjudicationScorecardView';
import DataExtractionComparisonView from '@/components/features/inter-rater/DataExtractionComparisonView';
import PdfPreview from './paper-details/PdfPreview';

interface AdjudicationWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  discrepancy: any;
  activePoolTab: 'pool_a' | 'pool_b' | 'pool_c';
  activeProject: any;
  qaRules: any[];
  extractionRules: any[];
  ecRules: any[];
  showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  discrepancies?: any[];
  onSelectDiscrepancy?: (discrepancy: any) => void;
}

export default function AdjudicationWorkspaceModal({
  isOpen,
  onClose,
  onSuccess,
  discrepancy,
  activePoolTab,
  activeProject,
  qaRules,
  extractionRules,
  ecRules,
  showToast,
  discrepancies = [],
  onSelectDiscrepancy
}: AdjudicationWorkspaceModalProps) {
  // Modal State for Adjudication (Pool A & B)
  const [adjudicateDecision, setAdjudicateDecision] = useState<'Include' | 'Exclude'>('Include');
  const [adjudicateEc, setAdjudicateEc] = useState<string>('');
  const [adjudicateRationale, setAdjudicateRationale] = useState<string>('');
  const [commitMessage, setCommitMessage] = useState<string>('');
  const [submittingAdjudication, setSubmittingAdjudication] = useState(false);

  // Modal State for Pool C Adjudication
  const [adjudicateQaScores, setAdjudicateQaScores] = useState<Record<string, { value: number | null, evidence: string }>>({});
  const [adjudicateExtractedData, setAdjudicateExtractedData] = useState<Record<string, { value: string, evidence: string }>>({});
  const [adjudicationWorkspaceTab, setAdjudicationWorkspaceTab] = useState<'qa' | 'extraction'>('qa');

  // Left Pane states (PDF vs details)
  const [activeLeftTab, setActiveLeftTab] = useState<'pdf' | 'details'>('details');
  const [localPaperDetails, setLocalPaperDetails] = useState<any>(null);

  // Crawler/Match states
  const [crawlerIsRunning, setCrawlerIsRunning] = useState(false);
  const [crawlerWaitingLogin, setCrawlerWaitingLogin] = useState(false);
  const [crawlerLogs, setCrawlerLogs] = useState<string[]>([]);
  const [crawlerProgress, setCrawlerProgress] = useState(0);
  const [crawlerStatusText, setCrawlerStatusText] = useState('');


  // State to track if the current configuration has been committed
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

  // Refresh single paper details from API
  const refreshPaperDetails = async () => {
    if (!discrepancy) return;
    try {
      const res = await fetch(`/api/papers/${discrepancy.paper_id}`);
      if (res.ok) {
        const updatedPaper = await res.json();
        const pdfPath = updatedPaper.Local_PDF_Path;
        setLocalPaperDetails({
          title: updatedPaper.Title,
          abstract: updatedPaper.Abstract,
          authors: updatedPaper.Authors,
          year: updatedPaper.Year,
          doi: updatedPaper.DOI,
          source: updatedPaper.Source,
          pdf_link: updatedPaper.PDF_Link,
          publisher: updatedPaper.Publisher,
          local_pdf_path: pdfPath
        });
      }
    } catch (err) {
      console.error('Failed to refresh paper details:', err);
    }
  };

  const lastLoadedDiscrepancyRef = useRef<any | null>(null);

  // Initialize resolved structures on mount or when discrepancy changes
  useEffect(() => {
    if (isOpen && discrepancy) {
      const isNewPaper = !lastLoadedDiscrepancyRef.current || lastLoadedDiscrepancyRef.current.paper_id !== discrepancy.paper_id;
      
      const dbValuesChanged = lastLoadedDiscrepancyRef.current && (
        lastLoadedDiscrepancyRef.current.resolved_decision !== discrepancy.resolved_decision ||
        lastLoadedDiscrepancyRef.current.resolved_ec !== discrepancy.resolved_ec ||
        lastLoadedDiscrepancyRef.current.resolved_rationale !== discrepancy.resolved_rationale ||
        JSON.stringify(lastLoadedDiscrepancyRef.current.r1_qa_scores) !== JSON.stringify(discrepancy.r1_qa_scores) ||
        JSON.stringify(lastLoadedDiscrepancyRef.current.r2_qa_scores) !== JSON.stringify(discrepancy.r2_qa_scores)
      );

      lastLoadedDiscrepancyRef.current = discrepancy;

      // Setup initial paper details from discrepancy query with robust casing fallback
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
        setLastCommittedState(null); // Enable commit button on loaded paper
        refreshPaperDetails();

        if (isNewPaper) {
          // Default to Abstract & Details tab first
          setActiveLeftTab('details');

          // Reset crawler logs
          setCrawlerIsRunning(false);
          setCrawlerWaitingLogin(false);
          setCrawlerLogs([]);
          setCrawlerProgress(0);
          setCrawlerStatusText('');
        }

        if (activePoolTab === 'pool_c') {
          if (isNewPaper) setAdjudicationWorkspaceTab('qa');
          // Initialize resolved structures using Alpha (r1) as starting baseline
          const r1_qa = JSON.parse(discrepancy.r1_qa_scores || '{}');
          const r2_qa = JSON.parse(discrepancy.r2_qa_scores || '{}');
          const qaInit: any = {};
          qaRules.forEach(rule => {
            const v1 = r1_qa[rule.code]?.value;
            const v2 = r2_qa[rule.code]?.value;
            const ev1 = r1_qa[rule.code]?.evidence || '';
            const ev2 = r2_qa[rule.code]?.evidence || '';
            qaInit[rule.code] = {
              value: v1 === v2 ? v1 : v1 !== undefined ? v1 : null,
              evidence: v1 === v2 ? ev1 : ev1 || ev2
            };
          });
          setAdjudicateQaScores(qaInit);

          const r1_ext = JSON.parse(discrepancy.r1_extracted_data || '{}');
          const r2_ext = JSON.parse(discrepancy.r2_extracted_data || '{}');
          const extInit: any = {};
          extractionRules.forEach(rule => {
            const v1 = r1_ext[rule.json_key]?.value || '';
            const v2 = r2_ext[rule.json_key]?.value || '';
            const ev1 = r1_ext[rule.json_key]?.evidence || '';
            const ev2 = r2_ext[rule.json_key]?.evidence || '';
            extInit[rule.json_key] = {
              value: v1 === v2 ? v1 : v1 || v2,
              evidence: v1 === v2 ? ev1 : ev1 || ev2
            };
          });
          setAdjudicateExtractedData(extInit);
        }

        if (dbValuesChanged && !isNewPaper) {
          showToast('Adjudication data was updated in another session. Form refreshed.', 'info');
        }
      }
    } else if (!isOpen) {
      lastLoadedDiscrepancyRef.current = null;
    }
  }, [isOpen, discrepancy, activePoolTab, qaRules, extractionRules, showToast]);

  // Real-time Preview calculation of dynamic gates for the workspace
  const previewDecision = React.useMemo(() => {
    if (activePoolTab !== 'pool_c' || !adjudicateQaScores) return null;
    return calculatePoolCDecision(adjudicateQaScores, qaRules);
  }, [adjudicateQaScores, qaRules, activePoolTab]);

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
    if (!discrepancy) return;
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
      if (err.name === 'AbortError') {
        setCrawlerLogs(prev => [...prev, 'Process aborted by user.']);
      }
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
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || 'Failed to resume crawler', 'error');
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

    if (activePoolTab === 'pool_c') {
      // Validate all QA scores have resolved choices
      const incomplete = qaRules.some(rule => adjudicateQaScores[rule.code]?.value === null || adjudicateQaScores[rule.code]?.value === undefined);
      if (incomplete) {
        showToast('A resolved score must be selected for all QA criteria.', 'warning');
        return;
      }
    } else {
      if (!adjudicateRationale.trim()) {
        showToast('Strategic rationale is required.', 'error');
        return;
      }
      if (adjudicateDecision === 'Exclude' && !adjudicateEc) {
        showToast('An exclusion criterion code is required for Exclude decisions.', 'error');
        return;
      }
    }

    setSubmittingAdjudication(true);
    try {
      let bodyData: any = {
        paper_id: discrepancy.paper_id,
        pool: activePoolTab,
        commit_message: commitMessage
      };

      if (activePoolTab === 'pool_c') {
        bodyData.final_qa_scores = adjudicateQaScores;
        bodyData.final_extracted_data = adjudicateExtractedData;
      } else {
        bodyData.final_decision = adjudicateDecision;
        bodyData.final_ec = adjudicateDecision === 'Exclude' ? adjudicateEc : null;
        bodyData.final_rationale = adjudicateRationale;
      }

      const res = await fetch('/api/adjudicate', {
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

  const currentIndex = discrepancies.findIndex(d => d.paper_id === discrepancy?.paper_id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < discrepancies.length - 1;

  const handlePrev = () => {
    if (hasPrev && onSelectDiscrepancy) {
      onSelectDiscrepancy(discrepancies[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext && onSelectDiscrepancy) {
      onSelectDiscrepancy(discrepancies[currentIndex + 1]);
    }
  };

  if (!isOpen || !discrepancy) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-background text-foreground rounded-2xl border border-border max-w-[95vw] w-full h-[95vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Calibration Adjudication</span>
              <h3 className="text-base font-extrabold text-foreground mt-0.5">
                Resolve Conflict ({activePoolTab.replace('_', ' ').toUpperCase()}): {discrepancy.paper_id}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global form enclosing layout to submit decisions, commit, and rationales */}
        <form onSubmit={handleCommitAdjudication} className="flex-1 overflow-hidden flex flex-col">
          
          {/* Top Bar: Adjudicated Decision / Total QA Score */}
          <div className="bg-secondary/40 border-b border-border px-6 py-3 shrink-0 select-none">
            {activePoolTab === 'pool_c' ? (
              previewDecision && (
                <div className="flex flex-wrap justify-between items-center gap-4">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-muted-foreground">Adjudicated Decision:</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      previewDecision.decision === 'Include'
                        ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'
                        : 'bg-destructive/10 border-destructive/20 text-destructive'
                    }`}>
                      {previewDecision.decision}
                    </span>
                    {previewDecision.decision === 'Exclude' && previewDecision.exclusionCode && (
                      <span className="font-mono bg-destructive/10 text-destructive px-2 py-0.5 rounded text-[10px] font-bold">
                        {previewDecision.exclusionCode}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-muted-foreground">Total QA Score:</span>
                    <span className="font-mono font-black text-foreground">{previewDecision.totalScore.toFixed(1)} / 8.0</span>
                  </div>
                </div>
              )
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Adjudicated Decision</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjudicateDecision('Include')}
                      className={`px-4 py-1 rounded-xl text-xs font-bold border transition-all ${
                        adjudicateDecision === 'Include'
                          ? 'bg-green-500/10 border-green-500 text-green-700 dark:text-green-400 shadow-sm'
                          : 'border-border bg-card text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Include
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjudicateDecision('Exclude')}
                      className={`px-4 py-1 rounded-xl text-xs font-bold border transition-all ${
                        adjudicateDecision === 'Exclude'
                          ? 'bg-red-500/10 border-red-500 text-red-700 dark:text-red-400 shadow-sm'
                          : 'border-border bg-card text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Exclude
                    </button>
                  </div>
                </div>

                {adjudicateDecision === 'Exclude' && (
                  <div className="flex items-center gap-2.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Exclusion Rule</label>
                    <select
                      value={adjudicateEc}
                      onChange={(e) => setAdjudicateEc(e.target.value)}
                      className="bg-card border border-border text-foreground px-3 py-1.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20"
                      required
                    >
                      <option value="">-- Select Rule Code --</option>
                      {ecRules.map(rule => (
                        <option key={rule.code} value={rule.code}>
                          {rule.code}: {rule.description}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Split-Pane Body Content */}
          <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            
            {/* Left Pane: PDF Viewer / Details Tabs AND Action controls */}
            <div className="flex flex-col overflow-hidden max-h-[50vh] md:max-h-full">
              {/* Left Pane Tab Bar */}
              <div className="flex border-b border-border bg-muted/20 shrink-0 select-none px-4 py-2 justify-between items-center">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveLeftTab('details')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeLeftTab === 'details'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Abstract & Details
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveLeftTab('pdf')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeLeftTab === 'pdf'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    PDF Preview
                  </button>
                </div>
                
                {localPaperDetails?.doi && (
                  <a
                    href={`https://doi.org/${localPaperDetails.doi}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    DOI Link <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* Tab Panels */}
              <div className="flex-1 overflow-y-auto p-6 relative">
                {/* Abstract & Details Tab (Persistent) */}
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

                {/* PDF Preview Tab (Persistent) */}
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

              {/* Action Controls & Commit inputs split-pane bottom */}
              <div className="p-4 border-t border-border bg-muted/30 shrink-0 space-y-3">
                {activePoolTab !== 'pool_c' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Strategic Rationale</label>
                    <textarea
                      rows={2}
                      placeholder="Enter strategic reason for this adjudication choice..."
                      value={adjudicateRationale}
                      onChange={(e) => setAdjudicateRationale(e.target.value)}
                      className="w-full bg-card border border-border text-foreground px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                      required
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Commit Message</label>
                  <input
                    type="text"
                    placeholder="e.g. Resolved inclusion divergence on method scope"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    className="w-full bg-card border border-border text-foreground px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>

                <div className="flex justify-between items-center pt-2 select-none border-t border-border/30">
                  {discrepancies.length > 1 ? (
                    <div className="flex items-center gap-1.5 bg-secondary border border-border px-2.5 py-1 rounded-xl select-none">
                      <button
                        type="button"
                        onClick={handlePrev}
                        disabled={!hasPrev}
                        className="px-2 py-0.5 text-[10px] font-extrabold bg-card border border-border rounded-lg hover:bg-muted disabled:opacity-50 text-foreground transition-all"
                      >
                        &larr; Prev
                      </button>
                      <span className="text-[10px] font-bold px-1 text-muted-foreground font-mono">
                        {currentIndex + 1} / {discrepancies.length}
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

            {/* Right Pane: Reviewer Comparison (expanded to full height) */}
            <div className="p-6 flex flex-col overflow-y-auto max-h-[50vh] md:max-h-full bg-muted/10">
              {activePoolTab === 'pool_c' ? (
                <>
                  {/* Header Controls for copying review data */}
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

                  {/* Tabs for Pool C */}
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
                        activePoolTab={activePoolTab}
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
                </>
              ) : (
                <AdjudicationScorecardView
                  activePoolTab={activePoolTab}
                  selectedDiscrepancy={discrepancy}
                  qaRules={qaRules}
                  adjudicateQaScores={adjudicateQaScores}
                  setAdjudicateQaScores={setAdjudicateQaScores}
                />
              )}
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}
