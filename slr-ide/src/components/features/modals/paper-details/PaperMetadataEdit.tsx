import React from 'react';
import ParentPaperSelector from './ParentPaperSelector';

interface PaperMetadataEditProps {
  paperId: string;
  importDate: string;
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
  getActiveProjectPoolTags: (poolId: string) => any[];
}

export default function PaperMetadataEdit({
  paperId,
  importDate,
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
  getActiveProjectPoolTags
}: PaperMetadataEditProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        {/* Paper ID */}
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Paper ID</label>
          <input
            type="text"
            disabled
            className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground focus:outline-none font-bold"
            value={paperId}
          />
        </div>

        {/* Import Date */}
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Import Date</label>
          <input
            type="text"
            disabled
            className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground focus:outline-none font-semibold"
            value={importDate}
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

      {/* Original Publisher & Publisher */}
      <div className="grid grid-cols-2 gap-4">
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

      {/* PDF Status & Review Status */}
      <div className="grid grid-cols-2 gap-4">
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
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Review Status</label>
          <select
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
            value={editStatus}
            onChange={(e) => setEditStatus(e.target.value)}
          >
            <option value="PENDING">PENDING</option>
            <option value="INCLUDE">INCLUDE</option>
            <option value="EXCLUDE">EXCLUDE</option>
          </select>
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
