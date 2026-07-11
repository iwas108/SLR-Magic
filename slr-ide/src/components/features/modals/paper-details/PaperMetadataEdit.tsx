import React from 'react';
import ParentPaperSelector from './ParentPaperSelector';

interface PaperMetadataEditProps {
  paperId: string;
  importDate: string;
  importSource: string;
  projectId: string;
  editParentPaperId: string;
  setEditParentPaperId: (id: string) => void;
  selectedEditParentPaper: any;
  setSelectedEditParentPaper: (paper: any) => void;
  editTitle: string;
  setEditTitle: (val: string) => void;
  editAuthors: string;
  setEditAuthors: (val: string) => void;
  editYear: string;
  setEditYear: (val: string) => void;
  editDoi: string;
  setEditDoi: (val: string) => void;
  editPdfLink: string;
  setEditPdfLink: (val: string) => void;
  editOriginalPublisher: string;
  setEditOriginalPublisher: (val: string) => void;
  editPublisher: string;
  setEditPublisher: (val: string) => void;
  editAbstract: string;
  setEditAbstract: (val: string) => void;
  editPdfStatus: string;
  setEditPdfStatus: (val: string) => void;
  editStatus: string;
  setEditStatus: (val: string) => void;
  editCalPool: string;
  setEditCalPool: (val: string) => void;
  editCalTag: string;
  setEditCalTag: (val: string) => void;
  editCitationCount: string;
  setEditCitationCount: (val: string) => void;
  editNotes: string;
  setEditNotes: (val: string) => void;
  editHumanDecision: string;
  setEditHumanDecision: (val: string) => void;
  getActiveProjectPoolTags: (poolId: string) => any[];
  aiDecision?: string;
  aiEcTrigger?: string;
  aiRationale?: string;
}

export default function PaperMetadataEdit({
  paperId,
  importDate,
  importSource,
  projectId,
  editParentPaperId,
  setEditParentPaperId,
  selectedEditParentPaper,
  setSelectedEditParentPaper,
  editTitle,
  setEditTitle,
  editAuthors,
  setEditAuthors,
  editYear,
  setEditYear,
  editDoi,
  setEditDoi,
  editPdfLink,
  setEditPdfLink,
  editOriginalPublisher,
  setEditOriginalPublisher,
  editPublisher,
  setEditPublisher,
  editAbstract,
  setEditAbstract,
  editPdfStatus,
  setEditPdfStatus,
  editStatus,
  setEditStatus,
  editCalPool,
  setEditCalPool,
  editCalTag,
  setEditCalTag,
  editCitationCount,
  setEditCitationCount,
  editNotes,
  setEditNotes,
  editHumanDecision,
  setEditHumanDecision,
  getActiveProjectPoolTags,
  aiDecision,
  aiEcTrigger,
  aiRationale
}: PaperMetadataEditProps) {
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        {/* Paper ID */}
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Paper ID</label>
          <input
            type="text"
            disabled
            className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground focus:outline-none font-bold truncate"
            value={paperId}
            title={paperId}
          />
        </div>

        {/* Import Date */}
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Import Date</label>
          <input
            type="text"
            disabled
            className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground focus:outline-none font-semibold"
            value={importDate || '—'}
          />
        </div>

        {/* Source Scope */}
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Source Scope</label>
          <input
            type="text"
            disabled
            className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground focus:outline-none font-semibold truncate"
            value={importSource || '—'}
            title={importSource}
          />
        </div>
      </div>

      {/* Parent Paper (Chained Reference) */}
      <div className="relative">
        <label className="text-[10px] font-bold text-muted-foreground uppercase">Parent Paper (Chained Reference)</label>
        <ParentPaperSelector
          paperId={paperId}
          projectId={projectId}
          editParentPaperId={editParentPaperId}
          setEditParentPaperId={setEditParentPaperId}
          selectedEditParentPaper={selectedEditParentPaper}
          setSelectedEditParentPaper={setSelectedEditParentPaper}
        />
      </div>

      {/* Title */}
      <div>
        <label className="text-[10px] font-bold text-muted-foreground uppercase flex justify-between">
          <span>Title <span className="text-destructive">*</span></span>
        </label>
        <textarea
          rows={2}
          required
          className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold leading-relaxed"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
        />
      </div>

      {/* Authors & Year */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Authors</label>
          <input
            type="text"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
            value={editAuthors}
            onChange={(e) => setEditAuthors(e.target.value)}
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Year</label>
          <input
            type="text"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
            value={editYear}
            onChange={(e) => setEditYear(e.target.value)}
          />
        </div>
      </div>

      {/* DOI & PDF Link */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">DOI</label>
          <input
            type="text"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-mono"
            value={editDoi}
            onChange={(e) => setEditDoi(e.target.value)}
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">PDF Link / Cloud URL</label>
          <input
            type="text"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
            value={editPdfLink}
            onChange={(e) => setEditPdfLink(e.target.value)}
          />
        </div>
      </div>

      {/* Original Publisher, Publisher & Citations */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Original Publisher</label>
          <input
            type="text"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
            value={editOriginalPublisher}
            onChange={(e) => setEditOriginalPublisher(e.target.value)}
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Publisher (Mapped)</label>
          <input
            type="text"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
            value={editPublisher}
            onChange={(e) => setEditPublisher(e.target.value)}
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Citation Count</label>
          <input
            type="number"
            min="0"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold font-mono"
            value={editCitationCount}
            onChange={(e) => setEditCitationCount(e.target.value)}
          />
        </div>
      </div>

      {/* Abstract */}
      <div>
        <label className="text-[10px] font-bold text-muted-foreground uppercase">Abstract</label>
        <textarea
          rows={4}
          className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-medium leading-relaxed"
          value={editAbstract}
          onChange={(e) => setEditAbstract(e.target.value)}
        />
      </div>

      {/* Notes / Findings */}
      <div>
        <label className="text-[10px] font-bold text-muted-foreground uppercase">Notes / Findings</label>
        <textarea
          rows={3}
          className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-medium leading-relaxed"
          placeholder="Record findings, comments, or extra context here..."
          value={editNotes}
          onChange={(e) => setEditNotes(e.target.value)}
        />
      </div>

      {/* PDF Status, Pipeline Stage & Decision Override */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Local PDF Status</label>
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
        </div>

        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Pipeline Stage</label>
          <select
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
            value={editStatus}
            onChange={(e) => setEditStatus(e.target.value)}
          >
            <option value="0">0: Initial</option>
            <option value="1">1: Fast Filter</option>
            <option value="2">2: Gatekeeper</option>
            <option value="3">3: Scientist</option>
            <option value="4">4: Miner</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Decision Override</label>
          <select
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
            value={editHumanDecision}
            onChange={(e) => setEditHumanDecision(e.target.value)}
          >
            <option value="">Auto (Use AI Decision)</option>
            <option value="INCLUDE">INCLUDE</option>
            <option value="EXCLUDE">EXCLUDE</option>
            <option value="QA_WAIT">QA_WAIT</option>
          </select>
        </div>
      </div>

      {/* AI Decision Read-Only Info */}
      <div className="grid grid-cols-3 gap-4 bg-secondary/15 border border-border/40 rounded-xl p-3.5">
        <div className="col-span-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase">AI Decision</label>
          <div className="mt-1">
            {aiDecision ? (
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                aiDecision === 'INCLUDE' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                aiDecision === 'EXCLUDE' ? 'bg-destructive/10 border-destructive/20 text-destructive' :
                'bg-secondary border-border text-muted-foreground'
              }`}>
                {aiDecision} {aiEcTrigger && aiEcTrigger !== 'NONE' ? `(${aiEcTrigger})` : ''}
              </span>
            ) : (
              <span className="text-[10px] font-bold text-muted-foreground/40 uppercase italic">Undecided</span>
            )}
          </div>
        </div>
        <div className="col-span-2">
          <label className="text-[10px] font-bold text-muted-foreground uppercase">AI Rationale</label>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground leading-relaxed max-h-24 overflow-y-auto pr-1">
            {aiRationale || <span className="italic text-muted-foreground/35">—</span>}
          </p>
        </div>
      </div>

      {/* Calibration Pool & Tag */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Calibration Pool</label>
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
        </div>

        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Calibration Tag</label>
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
        </div>
      </div>
    </>
  );
}
