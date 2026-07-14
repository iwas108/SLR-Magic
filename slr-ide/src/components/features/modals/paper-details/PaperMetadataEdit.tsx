import React from 'react';
import { ExternalLink, GitCommit, FileText, Database, Cpu, UserCheck } from 'lucide-react';
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
  editHumanEcTrigger: string;
  setEditHumanEcTrigger: (val: string) => void;
  editHumanRationale: string;
  setEditHumanRationale: (val: string) => void;
  getActiveProjectPoolTags: (poolId: string) => any[];
  aiDecision?: string;
  aiEcTrigger?: string;
  aiRationale?: string;
}

const Section = ({ title, icon: Icon, children }: { title: string, icon: any, children: React.ReactNode }) => (
  <div className="bg-card border border-border/50 rounded-xl overflow-hidden shadow-sm">
    <div className="bg-secondary/30 px-4 py-2.5 border-b border-border/50 flex items-center gap-2">
      <Icon className="w-4 h-4 text-primary/70" />
      <h3 className="text-xs font-bold text-foreground/80 uppercase tracking-wider">{title}</h3>
    </div>
    <div className="divide-y divide-border/30">
      {children}
    </div>
  </div>
);

const Row = ({ label, children, isVertical = false }: { label: React.ReactNode, children: React.ReactNode, isVertical?: boolean }) => (
  <div className={`p-4 ${isVertical ? 'flex flex-col gap-2' : 'flex flex-col sm:flex-row sm:items-start gap-4'}`}>
    <div className={`text-xs font-semibold text-muted-foreground shrink-0 ${isVertical ? '' : 'sm:w-48 sm:pt-2'}`}>
      {label}
    </div>
    <div className={`text-sm text-foreground flex-1 min-w-0 font-medium ${isVertical ? 'bg-secondary/10 p-3.5 rounded-lg border border-border/30 shadow-inner' : ''}`}>
      {children}
    </div>
  </div>
);

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
  editHumanEcTrigger,
  setEditHumanEcTrigger,
  editHumanRationale,
  setEditHumanRationale,
  getActiveProjectPoolTags,
  aiDecision,
  aiEcTrigger,
  aiRationale
}: PaperMetadataEditProps) {
  
  const aiDecisionVal = (aiDecision || 'PENDING').toUpperCase();
  
  return (
    <div className="space-y-6 pb-8 max-w-5xl mx-auto w-full">
      
      {/* 1. Core Identity */}
      <Section title="Core Identity" icon={FileText}>
        <Row label={<>Title <span className="text-destructive">*</span></>}>
          <textarea
            rows={2}
            required
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold leading-relaxed"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
          />
        </Row>
        <Row label="Authors">
          <input
            type="text"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
            value={editAuthors}
            onChange={(e) => setEditAuthors(e.target.value)}
          />
        </Row>
        <Row label="Publication Year">
          <input
            type="text"
            className="w-full max-w-xs bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
            value={editYear}
            onChange={(e) => setEditYear(e.target.value)}
          />
        </Row>
        <Row label="DOI">
          <input
            type="text"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-mono"
            value={editDoi}
            onChange={(e) => setEditDoi(e.target.value)}
          />
        </Row>
        <Row label="Publisher (Mapped)">
          <input
            type="text"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
            value={editPublisher}
            onChange={(e) => setEditPublisher(e.target.value)}
          />
        </Row>
        <Row label="Original Publisher">
          <input
            type="text"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
            value={editOriginalPublisher}
            onChange={(e) => setEditOriginalPublisher(e.target.value)}
          />
        </Row>
        <Row label="Citation Count">
          <input
            type="number"
            min="0"
            className="w-full max-w-xs bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold font-mono"
            value={editCitationCount}
            onChange={(e) => setEditCitationCount(e.target.value)}
          />
        </Row>
      </Section>

      {/* 2. Pipeline & Decisions */}
      <Section title="Pipeline & Decisions" icon={GitCommit}>
        <Row label="Database Identifiers">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-muted-foreground w-16">Paper ID</span>
              <span className="font-mono text-xs bg-secondary/30 px-2 py-0.5 rounded">{paperId}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-muted-foreground w-16">Imported</span>
              <span className="text-xs text-muted-foreground">{importDate || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-muted-foreground w-16">Source</span>
              <span className="text-xs text-muted-foreground">{importSource || '—'}</span>
            </div>
          </div>
        </Row>
        
        <Row label="System State">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Pipeline Stage</label>
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
            
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">PDF Status</label>
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
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">PDF Link / Cloud URL</label>
            <input
              type="text"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
              value={editPdfLink}
              onChange={(e) => setEditPdfLink(e.target.value)}
            />
          </div>
        </Row>
        
        <Row label="Adjudication">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* AI Box (Read-Only) */}
            <div className="bg-secondary/15 rounded-lg border border-border/40 p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase">AI Evaluation</span>
              </div>
              <div className="flex items-center gap-2">
                {aiDecision ? (
                  <>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        aiDecisionVal === 'INCLUDE' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                        aiDecisionVal === 'EXCLUDE' ? 'bg-destructive/10 border-destructive/20 text-destructive' :
                        'bg-secondary border-border text-muted-foreground'
                      }`}>
                        {aiDecisionVal}
                    </span>
                    {aiEcTrigger && aiEcTrigger !== 'NONE' && (
                      <span className="px-1.5 py-0.5 bg-background border border-border text-muted-foreground rounded text-[9px] font-bold uppercase">
                        {aiEcTrigger}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[10px] font-bold text-muted-foreground/50 uppercase italic">Undecided</span>
                )}
              </div>
              {aiRationale && (
                <div className="text-[11px] text-muted-foreground leading-relaxed mt-1 line-clamp-4 hover:line-clamp-none transition-all">
                  {aiRationale}
                </div>
              )}
            </div>

            {/* Human Box (Editable) */}
            <div className={`bg-secondary/15 rounded-lg border ${editHumanDecision ? 'border-primary/40' : 'border-border/40'} p-3 flex flex-col gap-3`}>
              <div className="flex items-center gap-2 mb-1">
                <UserCheck className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Human Override</span>
              </div>
              
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

              {editHumanDecision === 'EXCLUDE' && (
                <div className="flex flex-col gap-3 pt-2 border-t border-border/50 animate-in fade-in duration-200">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-destructive uppercase flex items-center gap-1">
                      Exclusion Code <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. EC-1"
                      className="w-full bg-secondary border border-destructive/30 focus:border-destructive rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none font-bold uppercase font-mono"
                      value={editHumanEcTrigger}
                      onChange={(e) => setEditHumanEcTrigger(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">
                      Exclusion Rationale
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Enter details on why this paper was excluded..."
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                      value={editHumanRationale}
                      onChange={(e) => setEditHumanRationale(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </Row>
        
        <Row label="Calibration">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex flex-col gap-2 w-full sm:w-1/2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Pool</label>
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
            
            <div className="flex flex-col gap-2 w-full sm:w-1/2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Tag</label>
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
        </Row>
      </Section>

      {/* 3. Content & Notes */}
      <Section title="Content & Notes" icon={Database}>
        <Row label="Abstract" isVertical>
          <textarea
            rows={5}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-medium leading-relaxed"
            value={editAbstract}
            onChange={(e) => setEditAbstract(e.target.value)}
          />
        </Row>
        
        <Row label="Notes & Findings" isVertical>
          <textarea
            rows={4}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-medium leading-relaxed"
            placeholder="Record findings, comments, or extra context here..."
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
          />
        </Row>

        <Row label="Parent Paper (Chain)" isVertical>
          <ParentPaperSelector
            paperId={paperId}
            projectId={projectId}
            editParentPaperId={editParentPaperId}
            setEditParentPaperId={setEditParentPaperId}
            selectedEditParentPaper={selectedEditParentPaper}
            setSelectedEditParentPaper={setSelectedEditParentPaper}
          />
        </Row>
      </Section>

    </div>
  );
}
