import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, X, Trash2, Edit2, RefreshCw, Copy, Check, 
  Play, AlertTriangle, Terminal, ExternalLink 
} from 'lucide-react';
import { broadcastSync } from '@/lib/sync-utils';
import { useNdjsonStream } from '@/hooks/useNdjsonStream';

import PaperMetadataView from './paper-details/PaperMetadataView';
import PaperMetadataEdit from './paper-details/PaperMetadataEdit';
import PdfPreview from './paper-details/PdfPreview';

import { Paper, Project } from '@/types';

interface ViewEditPaperModalProps {
  paperModal: { isOpen: boolean; mode: 'view' | 'edit'; paper: Paper | null };
  setPaperModal: React.Dispatch<React.SetStateAction<any>>;
  hasLocalPdf?: boolean;
  activeProject: Project | null;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  loadPapers: () => void;
  loadProjects: () => void;
  setDeleteConfirm: React.Dispatch<React.SetStateAction<any>>;
  papers?: Paper[];
}

export default function ViewEditPaperModal({
  paperModal,
  setPaperModal,
  activeProject,
  showToast,
  loadPapers,
  loadProjects,
  setDeleteConfirm,
  papers = []
}: ViewEditPaperModalProps) {
  const [editTitle, setEditTitle] = useState('');
  const [editAuthors, setEditAuthors] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editDoi, setEditDoi] = useState('');
  const [editPdfLink, setEditPdfLink] = useState('');
  const [editAbstract, setEditAbstract] = useState('');
  const [editPdfStatus, setEditPdfStatus] = useState('missing');
  const [editOriginalPublisher, setEditOriginalPublisher] = useState('');
  const [editPublisher, setEditPublisher] = useState('');
  const [editCitationCount, setEditCitationCount] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingPaper, setSavingPaper] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedEditParentPaper, setSelectedEditParentPaper] = useState<any>(null);
  const [editParentPaperId, setEditParentPaperId] = useState<string>('');

  // Single PDF acquisition states
  const [pdfLogs, setPdfLogs] = useState<string[]>([]);
  const [pdfIsRunning, setPdfIsRunning] = useState(false);
  const [pdfStatusText, setPdfStatusText] = useState('Idle');
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfWaitingLogin, setPdfWaitingLogin] = useState(false);
  const currentRunningPaperIdRef = useRef<string | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  const { connect: connectNdjson, cancelStream: cancelSinglePipeline, abortControllerRef: singlePipelineAbortControllerRef } = useNdjsonStream({
    onEvent: (parsed) => {
      if (parsed.event === 'log') {
        setPdfLogs(prev => [...prev, parsed.message]);
      } else if (parsed.event === 'step_start') {
        setPdfStatusText(parsed.message);
        if (parsed.step === 'scan') {
          setPdfProgress(15);
        } else if (parsed.step === 'scrape') {
          setPdfProgress(45);
        }
      } else if (parsed.event === 'step_complete') {
        setPdfStatusText(parsed.message);
      } else if (parsed.event === 'waiting_login') {
        setPdfWaitingLogin(true);
        setPdfStatusText(parsed.message);
      } else if (parsed.event === 'resume') {
        setPdfWaitingLogin(false);
      } else if (parsed.event === 'paper_success') {
        setPdfProgress(90);
        showToast('Paper PDF acquired successfully!', 'success');
      } else if (parsed.event === 'paper_fail') {
        setPdfProgress(100);
        showToast(`Scrape failed: ${parsed.error}`, 'error');
      } else if (parsed.event === 'complete') {
        setPdfProgress(100);
        setPdfStatusText(parsed.message);
        showToast(parsed.message, 'success');
      } else if (parsed.event === 'error') {
        setPdfProgress(100);
        setPdfStatusText(parsed.message);
        showToast(parsed.message, 'error');
      }
    },
    onComplete: async () => {
      const targetPaperId = currentRunningPaperIdRef.current || paperModal.paper?.Paper_ID;
      const projId = activeProject?.id || paperModal.paper?.Project_ID || '';
      if (targetPaperId) {
        try {
          const res = await fetch(`/api/papers/${encodeURIComponent(targetPaperId)}?projectId=${encodeURIComponent(projId)}`);
          if (res.ok) {
            const updatedPaper = await res.json();
            setPaperModal((prev: any) => ({ ...prev, paper: updatedPaper }));
            setEditPdfStatus(updatedPaper.Local_PDF_Status || 'MISSING');
          }
        } catch (e) {
          console.error('Failed to re-fetch paper in ViewEditPaperModal:', e);
        }

        loadPapers();
        loadProjects();
        broadcastSync('SYNC_PAPERS');
        broadcastSync('SYNC_PROJECTS');
      }
      setPdfIsRunning(false);
      setPdfWaitingLogin(false);
    },
    onError: (err) => {
      showToast(err.message || 'Failed to acquire PDF', 'error');
      setPdfIsRunning(false);
      setPdfWaitingLogin(false);
    }
  });

  const runSinglePaperPipeline = async (paperId: string) => {
    if (pdfIsRunning) {
      showToast('A PDF acquisition process is already active.', 'warning');
      return;
    }
    currentRunningPaperIdRef.current = paperId;
    setPdfIsRunning(true);
    setPdfLogs([]);
    setPdfProgress(0);
    setPdfStatusText('Starting single paper acquisition...');
    setPdfWaitingLogin(false);

    const projId = activeProject?.id || paperModal.paper?.Project_ID || '';

    try {
      await connectNdjson('/api/pdf/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperId, projectId: projId })
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        showToast('Pipeline cancelled by user.', 'info');
      } else {
        showToast(`Pipeline execution failed: ${err.message}`, 'error');
      }
      setPdfIsRunning(false);
    }
  };

  const handleResumeCrawler = async () => {
    try {
      const res = await fetch('/api/pdf/batch/resume', { method: 'POST' });
      if (res.ok) {
        showToast('Resuming crawler...', 'info');
        setPdfWaitingLogin(false);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || 'Failed to resume crawler', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error resuming crawler', 'error');
    }
  };

  const handleCancelCrawler = async () => {
    singlePipelineAbortControllerRef.current?.abort();
    await fetch('/api/pdf/batch/cancel', { method: 'POST' }).catch(() => {});
  };

  // Auto-scroll terminal log widget
  useEffect(() => {
    if (pdfLogs.length > 0) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [pdfLogs]);

  // Multi-tab BroadcastChannel listener to rehydrate paper data dynamically
  useEffect(() => {
    if (typeof window === 'undefined' || !window.BroadcastChannel) return;
    const channel = new BroadcastChannel('slr-magic-sync');
    channel.onmessage = (event) => {
      const { type } = event.data || {};
      if (type === 'SYNC_PAPERS' && paperModal?.isOpen && paperModal?.paper?.Paper_ID) {
        const pId = paperModal.paper.Paper_ID;
        const projId = activeProject?.id || paperModal.paper?.Project_ID || '';
        fetch(`/api/papers/${encodeURIComponent(pId)}?projectId=${encodeURIComponent(projId)}`)
          .then(res => res.json())
          .then(updatedPaper => {
            if (updatedPaper && !updatedPaper.error) {
              setPaperModal((prev: any) => (prev && prev.paper?.Paper_ID === pId ? { ...prev, paper: updatedPaper } : prev));
            }
          })
          .catch(() => {});
      }
    };
    return () => channel.close();
  }, [paperModal?.isOpen, paperModal?.paper?.Paper_ID, activeProject?.id, paperModal?.paper?.Project_ID, setPaperModal]);

  // Authoritative on-open server re-fetch to ensure paper details and PDF status are up-to-date
  useEffect(() => {
    if (paperModal?.isOpen && paperModal?.paper?.Paper_ID) {
      const pId = paperModal.paper.Paper_ID;
      const projId = activeProject?.id || paperModal.paper?.Project_ID || '';
      let isMounted = true;
      fetch(`/api/papers/${encodeURIComponent(pId)}?projectId=${encodeURIComponent(projId)}`)
        .then(res => res.json())
        .then(serverPaper => {
          if (!isMounted || !serverPaper || serverPaper.error) return;
          setPaperModal((prev: any) => {
            if (!prev?.isOpen || prev?.paper?.Paper_ID !== pId) return prev;
            // Guard: Don't downgrade if local modal has acquired PDF and server returned stale
            const localHasPdf = !!prev.paper?.Local_PDF_Path && prev.paper?.Local_PDF_Status !== 'MISSING';
            const serverHasNoPdf = !serverPaper.Local_PDF_Path || serverPaper.Local_PDF_Status === 'MISSING';
            if (localHasPdf && serverHasNoPdf) {
              return prev;
            }
            if (JSON.stringify(serverPaper) !== JSON.stringify(prev.paper)) {
              return { ...prev, paper: serverPaper };
            }
            return prev;
          });
        })
        .catch(() => {});
      return () => {
        isMounted = false;
      };
    }
  }, [paperModal?.isOpen, paperModal?.paper?.Paper_ID, activeProject?.id, setPaperModal]);

  const hasPdfAvailable = Boolean(
    paperModal.paper?.Local_PDF_Path &&
    ['MATCHED', 'DOWNLOADED', 'SYNCED', 'NEEDS_REVIEW'].includes(paperModal.paper?.Local_PDF_Status)
  );

  const hasChanges = !!(
    editTitle !== (paperModal.paper?.Title || '') ||
    editAuthors !== (paperModal.paper?.Authors || '') ||
    editYear !== (paperModal.paper?.Year !== null ? String(paperModal.paper?.Year) : '') ||
    editDoi !== (paperModal.paper?.DOI || '') ||
    editAbstract !== (paperModal.paper?.Abstract || '') ||
    editPdfLink !== (paperModal.paper?.PDF_Link || '') ||
    editPdfStatus !== (paperModal.paper?.Local_PDF_Status || 'MISSING') ||
    editOriginalPublisher !== (paperModal.paper?.Original_Publisher || '') ||
    editPublisher !== (paperModal.paper?.Publisher || '') ||
    editNotes !== (paperModal.paper?.notes || '') ||
    editCitationCount !== (paperModal.paper?.citation_count !== undefined && paperModal.paper?.citation_count !== null ? String(paperModal.paper?.citation_count) : '0') ||
    editParentPaperId !== (paperModal.paper?.Parent_Paper_ID || '')
  );

  const paperIdsSnapshotRef = useRef<string[]>([]);

  useEffect(() => {
    if (paperModal?.isOpen && papers && papers.length > 0 && paperIdsSnapshotRef.current.length === 0) {
      paperIdsSnapshotRef.current = papers.map((p: any) => p.Paper_ID);
    }
    if (!paperModal?.isOpen) {
      paperIdsSnapshotRef.current = [];
    }
  }, [paperModal?.isOpen, papers]);

  const navigationIds = paperIdsSnapshotRef.current.length > 0 ? paperIdsSnapshotRef.current : papers.map((p: any) => p.Paper_ID);
  const currentIndex = navigationIds.indexOf(paperModal.paper?.Paper_ID);

  const loadAndSetPaper = async (paperId: string) => {
    const projId = activeProject?.id || paperModal.paper?.Project_ID || '';
    try {
      const res = await fetch(`/api/papers/${encodeURIComponent(paperId)}?projectId=${encodeURIComponent(projId)}`);
      if (res.ok) {
        const paper = await res.json();
        setPaperModal((prev: any) => ({
          ...prev,
          paper
        }));
      } else {
        const localMatch = papers.find((p: any) => p.Paper_ID === paperId);
        if (localMatch) {
          setPaperModal((prev: any) => ({
            ...prev,
            paper: localMatch
          }));
        } else {
          showToast('Failed to load paper details', 'error');
        }
      }
    } catch (err: any) {
      const localMatch = papers.find((p: any) => p.Paper_ID === paperId);
      if (localMatch) {
        setPaperModal((prev: any) => ({
          ...prev,
          paper: localMatch
        }));
      } else {
        showToast('Error loading paper details', 'error');
      }
    }
  };

  const handlePrevPaper = () => {
    if (paperModal.mode === 'edit' && hasChanges) {
      if (!confirm("You have unsaved changes. Are you sure you want to navigate away?")) {
        return;
      }
    }
    if (currentIndex > 0) {
      const prevId = navigationIds[currentIndex - 1];
      loadAndSetPaper(prevId);
    }
  };

  const handleNextPaper = () => {
    if (paperModal.mode === 'edit' && hasChanges) {
      if (!confirm("You have unsaved changes. Are you sure you want to navigate away?")) {
        return;
      }
    }
    if (currentIndex !== -1 && currentIndex < navigationIds.length - 1) {
      const nextId = navigationIds[currentIndex + 1];
      loadAndSetPaper(nextId);
    }
  };

  const handleCopyDetails = async () => {
    if (!paperModal?.paper) return;
    const publisherName = paperModal.paper.Publisher || paperModal.paper.Original_Publisher || '—';
    const citationCount = paperModal.paper.citation_count !== undefined && paperModal.paper.citation_count !== null ? paperModal.paper.citation_count : '0';
    const textToCopy = [
      `Title: ${paperModal.paper.Title || '—'}`,
      `Authors: ${paperModal.paper.Authors || '—'}`,
      `Year: ${paperModal.paper.Year || '—'}`,
      `DOI: ${paperModal.paper.DOI || '—'}`,
      `Publisher: ${publisherName}`,
      `Abstract: ${paperModal.paper.Abstract || '—'}`,
      `Citations: ${citationCount}`
    ].join('\n');

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      showToast('Paper details copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      showToast('Failed to copy details to clipboard', 'error');
    }
  };

  const lastLoadedPaperRef = useRef<any | null>(null);

  useEffect(() => {
    if (paperModal?.isOpen && paperModal?.paper) {
      const paperId = paperModal.paper.Paper_ID;
      const isNewPaper = !lastLoadedPaperRef.current || lastLoadedPaperRef.current.Paper_ID !== paperId;

      // Determine if key database fields for inputs changed (from another tab sync)
      const dbValuesChanged = lastLoadedPaperRef.current && (
        lastLoadedPaperRef.current.Title !== paperModal.paper.Title ||
        lastLoadedPaperRef.current.Authors !== paperModal.paper.Authors ||
        lastLoadedPaperRef.current.Year !== paperModal.paper.Year ||
        lastLoadedPaperRef.current.DOI !== paperModal.paper.DOI ||
        lastLoadedPaperRef.current.Abstract !== paperModal.paper.Abstract ||
        lastLoadedPaperRef.current.PDF_Link !== paperModal.paper.PDF_Link ||
        lastLoadedPaperRef.current.Local_PDF_Status !== paperModal.paper.Local_PDF_Status ||
        lastLoadedPaperRef.current.notes !== paperModal.paper.notes ||
        lastLoadedPaperRef.current.citation_count !== paperModal.paper.citation_count
      ) && (
        // Guard: check if the new database paper values are different from the user's current inputs
        paperModal.paper.Title !== editTitle ||
        paperModal.paper.Authors !== editAuthors ||
        (paperModal.paper.Year !== null ? String(paperModal.paper.Year) : '') !== editYear ||
        paperModal.paper.DOI !== editDoi ||
        paperModal.paper.Abstract !== editAbstract ||
        paperModal.paper.PDF_Link !== editPdfLink ||
        (paperModal.paper.Local_PDF_Status || 'MISSING') !== editPdfStatus ||
        (paperModal.paper.notes || '') !== editNotes ||
        (paperModal.paper.citation_count !== undefined && paperModal.paper.citation_count !== null ? String(paperModal.paper.citation_count) : '0') !== editCitationCount
      );

      lastLoadedPaperRef.current = paperModal.paper;

      if (isNewPaper || dbValuesChanged) {
        setEditTitle(paperModal.paper.Title || '');
        setEditAuthors(paperModal.paper.Authors || '');
        setEditYear(paperModal.paper.Year !== null ? String(paperModal.paper.Year) : '');
        setEditDoi(paperModal.paper.DOI || '');
        setEditAbstract(paperModal.paper.Abstract || '');
        setEditPdfLink(paperModal.paper.PDF_Link || '');
        setEditPdfStatus(paperModal.paper.Local_PDF_Status || 'MISSING');
        setEditOriginalPublisher(paperModal.paper.Original_Publisher || '');
        setEditPublisher(paperModal.paper.Publisher || '');
        setEditNotes(paperModal.paper.notes || '');
        setEditCitationCount(paperModal.paper.citation_count !== undefined && paperModal.paper.citation_count !== null ? String(paperModal.paper.citation_count) : '0');
        
        const parentId = paperModal.paper.Parent_Paper_ID || '';
        const parentTitle = paperModal.paper.Parent_Paper_Title || '';
        setEditParentPaperId(parentId);
        setSelectedEditParentPaper(parentId ? { Paper_ID: parentId, Title: parentTitle } : null);

        if (dbValuesChanged && !isNewPaper) {
          showToast('Paper details were updated in another session. Form refreshed.', 'info');
        }
      }
    } else if (!paperModal?.isOpen) {
      lastLoadedPaperRef.current = null;
    }
  }, [paperModal?.isOpen, paperModal?.paper, paperModal?.mode, showToast]);

  const handleSavePaper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paperModal.paper) return;
    if (!editTitle.trim()) {
      showToast('Title is mandatory', 'error');
      return;
    }

    const projId = activeProject?.id || paperModal.paper?.Project_ID || '';

    setSavingPaper(true);
    try {
      const res = await fetch(`/api/papers/${encodeURIComponent(paperModal.paper.Paper_ID)}?projectId=${encodeURIComponent(projId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Title: editTitle,
          Authors: editAuthors,
          Year: editYear,
          DOI: editDoi,
          Abstract: editAbstract,
          PDF_Link: editPdfLink,
          Local_PDF_Status: editPdfStatus,
          Local_PDF_Path: paperModal.paper.Local_PDF_Path,
          Parent_Paper_ID: editParentPaperId || null,
          Original_Publisher: editOriginalPublisher,
          Publisher: editPublisher,
          citation_count: editCitationCount,
          notes: editNotes,
          projectId: projId
        })
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const updatedPaper = data.paper || {
          ...paperModal.paper,
          Title: editTitle,
          Authors: editAuthors,
          Year: editYear ? Number(editYear) : null,
          DOI: editDoi,
          Abstract: editAbstract,
          PDF_Link: editPdfLink,
          Local_PDF_Status: editPdfStatus,
          Local_PDF_Path: paperModal.paper.Local_PDF_Path,
          Parent_Paper_ID: editParentPaperId || null,
          Original_Publisher: editOriginalPublisher,
          Publisher: editPublisher,
          citation_count: editCitationCount ? Number(editCitationCount) : 0,
          notes: editNotes
        };
        showToast('Paper details updated successfully', 'success');
        setPaperModal({ isOpen: true, mode: 'edit', paper: updatedPaper });
        loadPapers();
        loadProjects();
        broadcastSync('SYNC_PAPERS');
        broadcastSync('SYNC_PROJECTS');
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to update paper details', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update paper details', 'error');
    } finally {
      setSavingPaper(false);
    }
  };

  if (!paperModal?.isOpen || !paperModal?.paper) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-screen h-screen bg-card border-none shadow-2xl overflow-hidden flex flex-col transition-all duration-300 animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/25 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm">
              {paperModal.mode === 'view' ? 'Paper Details' : 'Edit Paper Details'}
            </h3>
          </div>

          <button 
            type="button"
            onClick={() => setPaperModal({ isOpen: false, mode: 'view', paper: null })} 
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Two column layout (Left: Metadata/Edit, Right: PDF Preview/Acquisition) */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Column: Metadata View / Edit Form */}
          <form onSubmit={handleSavePaper} className="flex-1 overflow-y-auto lg:border-r border-border p-6">
            <div className="w-full max-w-5xl space-y-4 mx-auto">
              {paperModal.mode === 'edit' ? (
                <PaperMetadataEdit
                  paperId={paperModal.paper!.Paper_ID}
                  importDate={paperModal.paper!.Import_Date || ''}
                  importSource={paperModal.paper!.Import_Source || ''}
                  projectId={activeProject?.id || ''}
                  editParentPaperId={editParentPaperId}
                  setEditParentPaperId={setEditParentPaperId}
                  selectedEditParentPaper={selectedEditParentPaper}
                  setSelectedEditParentPaper={setSelectedEditParentPaper}
                  editTitle={editTitle}
                  setEditTitle={setEditTitle}
                  editAuthors={editAuthors}
                  setEditAuthors={setEditAuthors}
                  editYear={editYear}
                  setEditYear={setEditYear}
                  editDoi={editDoi}
                  setEditDoi={setEditDoi}
                  editPdfLink={editPdfLink}
                  setEditPdfLink={setEditPdfLink}
                  editOriginalPublisher={editOriginalPublisher}
                  setEditOriginalPublisher={setEditOriginalPublisher}
                  editPublisher={editPublisher}
                  setEditPublisher={setEditPublisher}
                  editAbstract={editAbstract}
                  setEditAbstract={setEditAbstract}
                  editPdfStatus={editPdfStatus}
                  setEditPdfStatus={setEditPdfStatus}
                  editCitationCount={editCitationCount}
                  setEditCitationCount={setEditCitationCount}
                  editNotes={editNotes}
                  setEditNotes={setEditNotes}
                  activeProject={activeProject}
                  paper={paperModal.paper!}
                />
              ) : (
                <PaperMetadataView
                  paper={paperModal.paper!}
                  setPaperModal={setPaperModal}
                  showToast={showToast}
                  activeProject={activeProject}
                  onTriggerPdfAcquisition={() => runSinglePaperPipeline(paperModal.paper!.Paper_ID)}
                  isPdfRunning={pdfIsRunning}
                />
              )}
              
              {/* Hidden submit button to support Enter key save in edit mode */}
              {paperModal.mode === 'edit' && <input type="submit" className="hidden" />}
            </div>
          </form>

          {/* Right Column: PDF Viewer / Acquisition Workspace */}
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-secondary/15">
            {hasPdfAvailable ? (
              <PdfPreview localPdfPath={paperModal.paper!.Local_PDF_Path || ''} />
            ) : (
              <div className="flex-1 p-6 select-none flex flex-col justify-center overflow-y-auto">
                <div className={`flex flex-col items-center justify-center text-center py-6 ${pdfIsRunning ? 'border-b border-border/40 pb-6 shrink-0' : 'flex-1'}`}>
                  <AlertTriangle className="w-14 h-14 text-amber-500 mb-4 animate-pulse" />
                  <h4 className="font-bold text-base mb-1.5 text-foreground">Local PDF Not Found</h4>
                  <p className="text-xs text-muted-foreground max-w-md leading-relaxed mb-6">
                    This paper reference does not have a local PDF yet. Trigger smart cache matching and crawler scraping specifically for this paper reference.
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => runSinglePaperPipeline(paperModal.paper!.Paper_ID)}
                      disabled={pdfIsRunning}
                      className={`px-5 py-2.5 font-bold rounded-xl shadow-md transition-all flex items-center gap-2 uppercase tracking-wide text-xs cursor-pointer ${
                        pdfIsRunning
                          ? 'bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-50 shadow-none'
                          : 'bg-primary text-primary-foreground hover:bg-primary/95 hover:shadow-lg hover:scale-105'
                      }`}
                    >
                      {pdfIsRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                      {pdfIsRunning ? 'Acquiring PDF...' : 'Get PDF via Cache Matching & Scraping'}
                    </button>

                    {pdfIsRunning && (
                      <button
                        type="button"
                        onClick={handleCancelCrawler}
                        className="px-4 py-2.5 border border-border text-xs font-bold uppercase rounded-xl hover:bg-secondary text-foreground transition-colors shrink-0 cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}

                    {pdfIsRunning && pdfWaitingLogin && (
                      <button
                        type="button"
                        onClick={handleResumeCrawler}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase rounded-xl text-xs tracking-wide shadow-md flex items-center gap-2 animate-pulse transition-all hover:scale-105 shrink-0 cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        Resume Download
                      </button>
                    )}

                    {!pdfIsRunning && paperModal.paper?.DOI && (
                      <a
                        href={`https://doi.org/${encodeURIComponent(paperModal.paper.DOI.trim())}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border text-xs font-bold rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <span>Publisher DOI</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {!pdfIsRunning && paperModal.paper?.PDF_Link && (
                      <a
                        href={paperModal.paper.PDF_Link}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border text-xs font-bold rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <span>Direct Web Link</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Real-time single-run console log widget */}
                {pdfIsRunning && (
                  <div className="mt-4 h-72 border border-border/80 rounded-xl bg-black text-emerald-400 font-mono text-[10px] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300 shadow-inner select-text">
                    {/* console header */}
                    <div className="p-2.5 border-b border-border/40 bg-zinc-900/60 flex items-center justify-between shrink-0 select-none">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                        Single PDF Pipeline: {pdfStatusText}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-400">{pdfProgress}%</span>
                        {pdfWaitingLogin && (
                          <button
                            type="button"
                            onClick={handleResumeCrawler}
                            className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-black font-bold uppercase rounded text-[8px] cursor-pointer"
                          >
                            Resume Login
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleCancelCrawler}
                          className="px-2 py-0.5 bg-destructive hover:bg-destructive/80 text-white font-bold uppercase rounded text-[8px] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                    {/* logs body */}
                    <div className="flex-1 p-3 overflow-y-auto space-y-1.5">
                      {pdfLogs.length === 0 ? (
                        <span className="text-zinc-600 block italic">Spawning subprocess connection...</span>
                      ) : (
                        pdfLogs.map((log: string, index: number) => (
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
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-border flex items-center justify-between bg-secondary/25 shrink-0">
          <div className="min-w-[120px]">
            {paperModal.mode === 'view' && (
              <button
                type="button"
                onClick={() => setDeleteConfirm({ isOpen: true, paper: paperModal.paper })}
                className="px-3.5 py-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-semibold rounded-lg border border-destructive/20 transition-colors flex items-center gap-1.5 animate-in fade-in cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Paper
              </button>
            )}
          </div>

          {/* Navigation Controls */}
          {papers && papers.length > 0 && (
            <div className="flex items-center gap-2 bg-background/50 border border-border/60 px-2 py-0.5 rounded-lg shadow-sm">
              <button
                type="button"
                onClick={handlePrevPaper}
                disabled={currentIndex <= 0}
                className="px-2 py-0.5 text-[10px] font-bold uppercase hover:bg-secondary border border-border/80 text-foreground disabled:opacity-30 disabled:cursor-not-allowed rounded transition-all cursor-pointer"
                title="Previous Paper"
              >
                &larr; Prev
              </button>
              <span className="text-[10px] text-muted-foreground font-mono font-bold select-none min-w-[55px] text-center">
                {currentIndex !== -1 ? currentIndex + 1 : '—'} / {navigationIds.length}
              </span>
              <button
                type="button"
                onClick={handleNextPaper}
                disabled={currentIndex === -1 || currentIndex >= navigationIds.length - 1}
                className="px-2 py-0.5 text-[10px] font-bold uppercase hover:bg-secondary border border-border/80 text-foreground disabled:opacity-30 disabled:cursor-not-allowed rounded transition-all cursor-pointer"
                title="Next Paper"
              >
                Next &rarr;
              </button>
            </div>
          )}

          <div className="flex gap-3 min-w-[120px] justify-end">
            {paperModal.mode === 'view' ? (
              <>
                <button
                  type="button"
                  onClick={handleCopyDetails}
                  className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold rounded-lg border border-primary/20 transition-all duration-200 flex items-center gap-1.5 cursor-pointer"
                  title="Copy paper metadata to clipboard"
                >
                  {copied ? <Check className="w-3.5 h-3.5 animate-in zoom-in-50 duration-150" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Details'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaperModal((prev: any) => ({ ...prev, mode: 'edit' }))}
                  className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Details
                </button>
                <button
                  type="button"
                  onClick={() => setPaperModal({ isOpen: false, mode: 'view', paper: null })}
                  className="px-4 py-2 border border-border text-xs font-semibold rounded-lg hover:bg-secondary text-foreground transition-colors cursor-pointer"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setPaperModal((prev: any) => ({ ...prev, mode: 'view' }))}
                  className="px-4 py-2 border border-border text-xs font-semibold rounded-lg hover:bg-secondary text-foreground transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingPaper || !hasChanges}
                  onClick={handleSavePaper}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg shadow-md transition-colors flex items-center gap-1.5 cursor-pointer ${(!hasChanges || savingPaper) ? 'bg-muted text-muted-foreground/50 border border-border/50 cursor-not-allowed shadow-none' : 'bg-primary text-primary-foreground hover:bg-primary/95 hover:shadow-lg'}`}
                >
                  {savingPaper && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Save Changes
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

