import React, { useState, useEffect } from 'react';
import { FileText, X, Trash2, Edit2, RefreshCw, Copy, Check } from 'lucide-react';
import { broadcastSync } from '@/lib/sync-utils';

import PaperMetadataView from './paper-details/PaperMetadataView';
import PaperMetadataEdit from './paper-details/PaperMetadataEdit';
import PdfPreview from './paper-details/PdfPreview';

interface ViewEditPaperModalProps {
  paperModal: any;
  setPaperModal: any;
  hasLocalPdf: boolean;
  activeProject: any;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  loadPapers: () => void;
  loadProjects: () => void;
  setDeleteConfirm: any;
}

export default function ViewEditPaperModal({
  paperModal,
  setPaperModal,
  hasLocalPdf,
  activeProject,
  showToast,
  loadPapers,
  loadProjects,
  setDeleteConfirm
}: ViewEditPaperModalProps) {
  const [editTitle, setEditTitle] = useState('');
  const [editAuthors, setEditAuthors] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editDoi, setEditDoi] = useState('');
  const [editPdfLink, setEditPdfLink] = useState('');
  const [editAbstract, setEditAbstract] = useState('');
  const [editPdfStatus, setEditPdfStatus] = useState('missing');
  const [editStatus, setEditStatus] = useState('pending');
  const [editCalPool, setEditCalPool] = useState('none');
  const [editCalTag, setEditCalTag] = useState('');
  const [editOriginalPublisher, setEditOriginalPublisher] = useState('');
  const [editPublisher, setEditPublisher] = useState('');
  const [editCitationCount, setEditCitationCount] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editHumanDecision, setEditHumanDecision] = useState('');
  const [savingPaper, setSavingPaper] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedEditParentPaper, setSelectedEditParentPaper] = useState<any>(null);
  const [editParentPaperId, setEditParentPaperId] = useState<string>('');

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

  useEffect(() => {
    if (paperModal?.isOpen && paperModal?.paper) {
      setEditTitle(paperModal.paper.Title || '');
      setEditAuthors(paperModal.paper.Authors || '');
      setEditYear(paperModal.paper.Year !== null ? String(paperModal.paper.Year) : '');
      setEditDoi(paperModal.paper.DOI || '');
      setEditAbstract(paperModal.paper.Abstract || '');
      setEditPdfLink(paperModal.paper.PDF_Link || '');
      setEditPdfStatus(paperModal.paper.Local_PDF_Status || 'MISSING');
      setEditStatus(paperModal.paper.Status || 'PENDING');
      setEditCalPool(paperModal.paper.calibration_pool || '');
      setEditCalTag(paperModal.paper.calibration_tag || '');
      setEditOriginalPublisher(paperModal.paper.Original_Publisher || '');
      setEditPublisher(paperModal.paper.Publisher || '');
      setEditNotes(paperModal.paper.notes || '');
      setEditCitationCount(paperModal.paper.citation_count !== undefined && paperModal.paper.citation_count !== null ? String(paperModal.paper.citation_count) : '0');
      setEditHumanDecision(paperModal.paper.Human_Decision || '');
      
      const parentId = paperModal.paper.Parent_Paper_ID || '';
      const parentTitle = paperModal.paper.Parent_Paper_Title || '';
      setEditParentPaperId(parentId);
      setSelectedEditParentPaper(parentId ? { Paper_ID: parentId, Title: parentTitle } : null);
    }
  }, [paperModal?.isOpen, paperModal?.paper, paperModal?.mode]);

  const getActiveProjectPoolTags = (poolId: string) => {
    if (!activeProject) return [];
    let parsedTags: { pool_a: any[]; pool_b: any[]; pool_c: any[] } = { pool_a: [], pool_b: [], pool_c: [] };
    if (activeProject.pool_tags) {
      try {
        parsedTags = typeof activeProject.pool_tags === 'string'
          ? JSON.parse(activeProject.pool_tags)
          : activeProject.pool_tags;
      } catch (e) {
        console.error("Error parsing pool tags in ViewEditPaperModal", e);
      }
    }
    if (poolId === 'pool_a') return parsedTags.pool_a || [];
    if (poolId === 'pool_b') return parsedTags.pool_b || [];
    if (poolId === 'pool_c') return parsedTags.pool_c || [];
    return [];
  };

  const handleSavePaper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paperModal.paper) return;
    if (!editTitle.trim()) {
      showToast('Title is mandatory', 'error');
      return;
    }

    setSavingPaper(true);
    try {
      const res = await fetch(`/api/papers/${paperModal.paper.Paper_ID}`, {
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
          Status: editStatus,
          Parent_Paper_ID: editParentPaperId || null,
          calibration_pool: editCalPool || null,
          calibration_tag: editCalTag || null,
          Original_Publisher: editOriginalPublisher,
          Publisher: editPublisher,
          citation_count: editCitationCount,
          notes: editNotes,
          Human_Decision: editHumanDecision || null
        })
      });

      if (res.ok) {
        showToast('Paper details updated successfully', 'success');
        setPaperModal({ isOpen: false, mode: 'view', paper: null });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`w-full bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 animate-in zoom-in-95 duration-200 ${
        hasLocalPdf ? 'max-w-7xl h-[85vh]' : 'max-w-2xl max-h-[90vh]'
      }`}>
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/25 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm">
              {paperModal.mode === 'view' ? 'Paper Details' : 'Edit Paper Details'}
            </h3>
          </div>
          <button 
            onClick={() => setPaperModal({ isOpen: false, mode: 'view', paper: null })} 
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body wrapper for optional two column layout */}
        <div className={`flex-1 flex overflow-hidden ${hasLocalPdf ? 'flex-col lg:flex-row' : 'flex-col'}`}>
          {/* Modal Content / Form */}
          <form onSubmit={handleSavePaper} className={`flex-1 overflow-y-auto p-6 space-y-4 ${hasLocalPdf ? 'lg:border-r border-border' : ''}`}>
            {paperModal.mode === 'edit' ? (
              <PaperMetadataEdit
                paperId={paperModal.paper.Paper_ID}
                importDate={paperModal.paper.Import_Date}
                importSource={paperModal.paper.Import_Source}
                projectId={activeProject?.id}
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
                editStatus={editStatus}
                setEditStatus={setEditStatus}
                editCalPool={editCalPool}
                setEditCalPool={setEditCalPool}
                editCalTag={editCalTag}
                setEditCalTag={setEditCalTag}
                editCitationCount={editCitationCount}
                setEditCitationCount={setEditCitationCount}
                editNotes={editNotes}
                setEditNotes={setEditNotes}
                editHumanDecision={editHumanDecision}
                setEditHumanDecision={setEditHumanDecision}
                getActiveProjectPoolTags={getActiveProjectPoolTags}
                aiDecision={paperModal.paper.AI_Decision}
                aiEcTrigger={paperModal.paper.AI_EC_Trigger}
                aiRationale={paperModal.paper.AI_Rationale}
              />
            ) : (
              <PaperMetadataView
                paper={paperModal.paper}
                setPaperModal={setPaperModal}
                showToast={showToast}
                getActiveProjectPoolTags={getActiveProjectPoolTags}
              />
            )}
            
            {/* Hidden submit button to support Enter key save in edit mode */}
            {paperModal.mode === 'edit' && <input type="submit" className="hidden" />}
          </form>

          {/* Right Column (PDF Viewer) */}
          {hasLocalPdf && <PdfPreview localPdfPath={paperModal.paper.Local_PDF_Path} />}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-border flex items-center justify-between bg-secondary/25 shrink-0">
          <div>
            {paperModal.mode === 'view' && (
              <button
                type="button"
                onClick={() => setDeleteConfirm({ isOpen: true, paper: paperModal.paper })}
                className="px-3.5 py-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-semibold rounded-lg border border-destructive/20 transition-colors flex items-center gap-1.5 animate-in fade-in"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Paper
              </button>
            )}
          </div>

          <div className="flex gap-3">
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
                  className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-colors flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Details
                </button>
                <button
                  type="button"
                  onClick={() => setPaperModal({ isOpen: false, mode: 'view', paper: null })}
                  className="px-4 py-2 border border-border text-xs font-semibold rounded-lg hover:bg-secondary text-foreground transition-colors"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setPaperModal((prev: any) => ({ ...prev, mode: 'view' }))}
                  className="px-4 py-2 border border-border text-xs font-semibold rounded-lg hover:bg-secondary text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingPaper}
                  onClick={handleSavePaper}
                  className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-colors flex items-center gap-1.5"
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
