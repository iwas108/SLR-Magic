import React, { useState, useEffect } from 'react';
import { FileText, X, ExternalLink, Trash2, Edit2, RefreshCw, Eye } from 'lucide-react';
import { broadcastSync } from '@/lib/sync-utils';

interface ViewEditPaperModalProps {
  paperModal: any;
  setPaperModal: any;
  hasLocalPdf: boolean;
  activeProject: any;
  showToast: (msg: string, type: string) => void;
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
  const [savingPaper, setSavingPaper] = useState(false);
  const [selectedEditParentPaper, setSelectedEditParentPaper] = useState<any>(null);
  const [editParentPaperId, setEditParentPaperId] = useState<string>('');
  const [editParentSearch, setEditParentSearch] = useState<string>('');
  const [showEditParentSuggestions, setShowEditParentSuggestions] = useState(false);
  const [editParentSuggestions, setEditParentSuggestions] = useState<any[]>([]);

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
      
      const parentId = paperModal.paper.Parent_Paper_ID || '';
      const parentTitle = paperModal.paper.Parent_Paper_Title || '';
      setEditParentPaperId(parentId);
      setSelectedEditParentPaper(parentId ? { Paper_ID: parentId, Title: parentTitle } : null);
      setEditParentSearch('');
      setShowEditParentSuggestions(false);
    }
  }, [paperModal?.isOpen, paperModal?.paper, paperModal?.mode]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (editParentSearch.length < 2) {
        setEditParentSuggestions([]);
        return;
      }
      try {
        const currentId = paperModal?.paper?.Paper_ID;
        const res = await fetch(`/api/papers?projectId=${activeProject?.id}&search=${encodeURIComponent(editParentSearch)}&limit=5${currentId ? `&excludeId=${currentId}` : ''}`);
        if (res.ok) {
          const data = await res.json();
          setEditParentSuggestions(data.papers || []);
        }
      } catch (err) {
        console.error('Error fetching parent suggestions:', err);
      }
    };
    
    const delay = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(delay);
  }, [editParentSearch, paperModal?.paper, activeProject?.id]);

  const getActiveProjectPoolTags = (poolId: string) => {
    if (!activeProject) return [];
    if (poolId === 'pool_a') return activeProject.Pool_A_Tags || [];
    if (poolId === 'pool_b') return activeProject.Pool_B_Tags || [];
    if (poolId === 'pool_c') return activeProject.Pool_C_Tags || [];
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
          Publisher: editPublisher
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
            <div className="grid grid-cols-2 gap-4">
              {/* Paper ID */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Paper ID</label>
                <input
                  type="text"
                  disabled
                  className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground focus:outline-none font-bold"
                  value={paperModal.paper.Paper_ID}
                />
              </div>

              {/* Import Date */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Import Date</label>
                <input
                  type="text"
                  disabled
                  className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground focus:outline-none font-semibold"
                  value={paperModal.paper.Import_Date}
                />
              </div>
            </div>

            {/* Parent Paper (Chained Reference) */}
            <div className="relative">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Parent Paper (Chained Reference)</label>
              {paperModal.mode === 'edit' ? (
                selectedEditParentPaper ? (
                  <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5 text-xs text-primary font-semibold">
                    <span className="truncate flex-1" title={selectedEditParentPaper.Title || ''}>
                      {selectedEditParentPaper.Title || 'Untitled Paper'} ({selectedEditParentPaper.Paper_ID})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEditParentPaper(null);
                        setEditParentPaperId('');
                        setEditParentSearch('');
                      }}
                      className="ml-2 text-primary hover:text-primary-foreground focus:outline-none"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={editParentSearch}
                        onChange={(e) => {
                          setEditParentSearch(e.target.value);
                          setShowEditParentSuggestions(true);
                        }}
                        onFocus={() => setShowEditParentSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowEditParentSuggestions(false), 200)}
                        placeholder="Search parent paper by title or ID..."
                        className="w-full px-3 py-1.5 pr-8 text-xs bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
                      />
                      {editParentSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditParentSearch('');
                            setEditParentSuggestions([]);
                          }}
                          className="absolute right-2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {showEditParentSuggestions && editParentSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y divide-border">
                        {editParentSuggestions.map((p) => (
                          <div
                            key={p.Paper_ID}
                            onClick={() => {
                              setSelectedEditParentPaper(p);
                              setEditParentPaperId(p.Paper_ID);
                              setEditParentSearch('');
                              setShowEditParentSuggestions(false);
                            }}
                            className="px-3 py-2 text-xs hover:bg-secondary cursor-pointer transition-colors text-foreground font-semibold flex flex-col gap-0.5"
                          >
                            <span className="font-bold truncate">{p.Title}</span>
                            <span className="text-[10px] text-muted-foreground truncate">{p.Authors || 'Unknown authors'} ({p.Year || 'N/A'})</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {showEditParentSuggestions && editParentSearch.trim() && editParentSuggestions.length === 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl px-3 py-2 text-xs text-muted-foreground">
                        No matching papers found
                      </div>
                    )}
                  </>
                )
              ) : (
                paperModal.paper.Parent_Paper_ID ? (
                  <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-semibold flex items-center justify-between overflow-hidden">
                    <span className="truncate flex-1 font-bold text-primary" title={paperModal.paper.Parent_Paper_Title || ''}>
                      {paperModal.paper.Parent_Paper_Title || 'Untitled Paper'} ({paperModal.paper.Parent_Paper_ID})
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/papers/${paperModal.paper?.Parent_Paper_ID}`);
                          if (res.ok) {
                            const parentPaper = await res.json();
                            setPaperModal({ isOpen: true, mode: 'view', paper: parentPaper });
                          } else {
                            showToast('Failed to load parent paper details', 'error');
                          }
                        } catch (err: any) {
                          showToast(`Error loading parent paper: ${err.message || err}`, 'error');
                        }
                      }}
                      className="text-primary hover:underline ml-2 flex items-center gap-0.5 text-[10px] shrink-0"
                    >
                      Open Parent <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground font-semibold select-none">
                    None
                  </div>
                )
              )}
            </div>

            {/* Title */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase flex justify-between">
                <span>Title {paperModal.mode === 'edit' && <span className="text-destructive">*</span>}</span>
              </label>
              {paperModal.mode === 'edit' ? (
                <textarea
                  rows={2}
                  required
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold leading-relaxed"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              ) : (
                <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2.5 text-xs text-foreground font-bold leading-relaxed select-text">
                  {paperModal.paper.Title}
                </div>
              )}
            </div>

            {/* Authors & Year */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Authors</label>
                {paperModal.mode === 'edit' ? (
                  <input
                    type="text"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                    value={editAuthors}
                    onChange={(e) => setEditAuthors(e.target.value)}
                  />
                ) : (
                  <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-semibold truncate select-text" title={paperModal.paper.Authors || '—'}>
                    {paperModal.paper.Authors || '—'}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Year</label>
                {paperModal.mode === 'edit' ? (
                  <input
                    type="text"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                    value={editYear}
                    onChange={(e) => setEditYear(e.target.value)}
                  />
                ) : (
                  <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-semibold select-text">
                    {paperModal.paper.Year || '—'}
                  </div>
                )}
              </div>
            </div>

            {/* DOI & PDF Link */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase">DOI</label>
                {paperModal.mode === 'edit' ? (
                  <input
                    type="text"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-mono"
                    value={editDoi}
                    onChange={(e) => setEditDoi(e.target.value)}
                  />
                ) : (
                  <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-mono truncate select-text" title={paperModal.paper.DOI || '—'}>
                    {paperModal.paper.DOI || '—'}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase">PDF Link / Cloud URL</label>
                {paperModal.mode === 'edit' ? (
                  <input
                    type="text"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                    value={editPdfLink}
                    onChange={(e) => setEditPdfLink(e.target.value)}
                  />
                ) : (
                  <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-semibold flex items-center justify-between overflow-hidden select-text">
                    <span className="truncate flex-1" title={paperModal.paper.PDF_Link || '—'}>
                      {paperModal.paper.PDF_Link || '—'}
                    </span>
                    {paperModal.paper.PDF_Link && paperModal.paper.PDF_Link.startsWith('http') && (
                      <a
                        href={paperModal.paper.PDF_Link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline ml-2 flex items-center gap-0.5 text-[10px] shrink-0"
                      >
                        Open <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Original Publisher & Publisher */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Original Publisher</label>
                {paperModal.mode === 'edit' ? (
                  <input
                    type="text"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                    value={editOriginalPublisher}
                    onChange={(e) => setEditOriginalPublisher(e.target.value)}
                  />
                ) : (
                  <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-semibold truncate select-text" title={paperModal.paper.Original_Publisher || '—'}>
                    {paperModal.paper.Original_Publisher || '—'}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Publisher (Mapped)</label>
                {paperModal.mode === 'edit' ? (
                  <input
                    type="text"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                    value={editPublisher}
                    onChange={(e) => setEditPublisher(e.target.value)}
                  />
                ) : (
                  <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-semibold truncate select-text" title={paperModal.paper.Publisher || '—'}>
                    {paperModal.paper.Publisher || '—'}
                  </div>
                )}
              </div>
            </div>

            {/* Abstract */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Abstract</label>
              {paperModal.mode === 'edit' ? (
                <textarea
                  rows={4}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-medium leading-relaxed"
                  value={editAbstract}
                  onChange={(e) => setEditAbstract(e.target.value)}
                />
              ) : (
                <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2.5 text-xs text-muted-foreground font-medium leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap select-text">
                  {paperModal.paper.Abstract || 'No abstract available.'}
                </div>
              )}
            </div>

            {/* PDF Status & Review Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Local PDF Status</label>
                {paperModal.mode === 'edit' ? (
                  <select
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                    value={editPdfStatus}
                    onChange={(e) => setEditPdfStatus(e.target.value)}
                  >
                    <option value="IGNORED">IGNORED</option>
                    <option value="MISSING">MISSING</option>
                    <option value="MATCHED">MATCHED</option>
                    <option value="DOWNLOADED">DOWNLOADED</option>
                    <option value="SYNCED">SYNCED</option>
                    <option value="FAILED">FAILED</option>
                  </select>
                ) : (
                  <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-semibold flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      paperModal.paper.Local_PDF_Status === 'SYNCED' ? 'bg-emerald-500' :
                      paperModal.paper.Local_PDF_Status === 'DOWNLOADED' || paperModal.paper.Local_PDF_Status === 'MATCHED' ? 'bg-amber-500 animate-pulse' :
                      paperModal.paper.Local_PDF_Status === 'FAILED' ? 'bg-destructive' :
                      paperModal.paper.Local_PDF_Status === 'IGNORED' ? 'bg-muted-foreground/50' :
                      'bg-destructive/60'
                    }`} />
                    <span className="text-[10px] font-bold tracking-wider uppercase">
                      {paperModal.paper.Local_PDF_Status}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Review Status</label>
                {paperModal.mode === 'edit' ? (
                  <select
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="INCLUDE">INCLUDE</option>
                    <option value="EXCLUDE">EXCLUDE</option>
                  </select>
                ) : (
                  <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-semibold">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                      paperModal.paper.Status === 'INCLUDE' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                      paperModal.paper.Status === 'EXCLUDE' ? 'bg-destructive/10 border-destructive/20 text-destructive' :
                      'bg-secondary border-border text-muted-foreground'
                    }`}>
                      {paperModal.paper.Status}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Calibration Pool & Tag */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Calibration Pool</label>
                {paperModal.mode === 'edit' ? (
                  <select
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                    value={editCalPool}
                    onChange={(e) => {
                      const newPool = e.target.value;
                      setEditCalPool(newPool);
                      const tags = getActiveProjectPoolTags(newPool);
                      if (!tags.some((t: any) => t.code === editCalTag)) {
                        setEditCalTag('');
                      }
                    }}
                  >
                    <option value="">None (Not in Calibration)</option>
                    <option value="pool_a">Pool A (Fast Filter)</option>
                    <option value="pool_b">Pool B (Consensus)</option>
                    <option value="pool_c">Pool C (Consensus)</option>
                  </select>
                ) : (
                  <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-semibold">
                    {paperModal.paper?.calibration_pool ? (
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border truncate inline-block ${
                        paperModal.paper?.calibration_pool === 'pool_a' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' :
                        paperModal.paper?.calibration_pool === 'pool_b' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                        'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      }`}>
                        {paperModal.paper?.calibration_pool.replace('_', ' ')}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-muted-foreground/50 uppercase italic">None</span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Calibration Tag</label>
                {paperModal.mode === 'edit' ? (
                  <select
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold disabled:opacity-50"
                    value={editCalTag}
                    onChange={(e) => setEditCalTag(e.target.value)}
                    disabled={!editCalPool}
                  >
                    <option value="">No Tag</option>
                    {editCalPool && getActiveProjectPoolTags(editCalPool).map((tag: any) => (
                      <option key={tag.code} value={tag.code}>
                        {tag.code} - {tag.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-semibold">
                    {paperModal.paper?.calibration_tag ? (
                      (() => {
                        const tags = getActiveProjectPoolTags(paperModal.paper?.calibration_pool || '');
                        const matchedTag = tags.find((t: any) => t.code === paperModal.paper?.calibration_tag);
                        return (
                          <span 
                            className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-primary/10 border border-primary/20 text-primary truncate inline-block cursor-help"
                            title={matchedTag ? matchedTag.label : paperModal.paper?.calibration_tag}
                          >
                            {paperModal.paper?.calibration_tag}
                          </span>
                        );
                      })()
                    ) : (
                      <span className="text-[10px] font-bold text-muted-foreground/50 uppercase italic">None</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Hidden submit button to support Enter key save in edit mode */}
            {paperModal.mode === 'edit' && <input type="submit" className="hidden" />}
          </form>

          {/* Right Column (PDF Viewer) */}
          {hasLocalPdf && (
            <div className="flex-1 bg-secondary/15 flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0 select-none">
                <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-primary" />
                  PDF Preview
                </span>
                <a
                  href={`/api/pdf/serve?path=${encodeURIComponent(paperModal.paper.Local_PDF_Path || '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[9px] font-bold uppercase tracking-wider text-primary hover:underline flex items-center gap-1"
                >
                  Open in New Tab <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex-1 relative bg-secondary/10">
                <iframe
                  src={`/api/pdf/serve?path=${encodeURIComponent(paperModal.paper.Local_PDF_Path || '')}#toolbar=1`}
                  className="absolute inset-0 w-full h-full border-none"
                  title="PDF Viewer"
                />
              </div>
            </div>
          )}
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
