import React, { useState, useEffect } from 'react';
import { ExternalLink, GitCommit, FileText, Database, Cpu, UserCheck, ChevronDown, ChevronRight } from 'lucide-react';
import JSONViewer from '@/components/ui/JSONViewer';
import ParentPaperSelector from './ParentPaperSelector';
import { broadcastSync } from '@/lib/sync-utils';

import { Paper, Project } from '@/types';

interface PaperMetadataEditProps {
  paperId: string;
  importDate: string;
  importSource: string;
  projectId: string;
  editParentPaperId: string;
  setEditParentPaperId: (id: string) => void;
  selectedEditParentPaper: Paper | null;
  setSelectedEditParentPaper: (paper: Paper | null) => void;
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

  editCitationCount: string;
  setEditCitationCount: (val: string) => void;
  editNotes: string;
  setEditNotes: (val: string) => void;

  activeProject?: Project | null;
  paper?: Paper;
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

  editCitationCount,
  setEditCitationCount,
  editNotes,
  setEditNotes,

  activeProject,
  paper
}: PaperMetadataEditProps) {
  
  const aiDecisionVal = (paper?.ai_decision || 'PENDING').toUpperCase();
  const resolvedDecisionVal = (paper?.manual_decision || paper?.ai_decision || '').toUpperCase();

  const getAiStageFriendlyName = (stage: number | undefined) => {
    const s = stage || 0;
    if (s === 1) return 'Fast Filter';
    if (s === 2) return 'Gatekeeper';
    if (s === 3) return 'Scientist';
    if (s === 4) return 'Miner';
    return 'Pending';
  };

  const getManualStageFriendlyName = (stage: number | undefined) => {
    const s = stage || 0;
    if (s === 1) return 'Fast Filter';
    if (s === 2) return 'Gatekeeper';
    if (s === 3) return 'Scientist';
    if (s === 4) return 'Miner';
    return 'Pending';
  };

  const getAiHighestStage = (logs: any[]) => {
    return paper?.ai_stage || 0;
  };

  const [llmLogs, setLlmLogs] = useState<any[]>([]);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [proxyBaseUrl, setProxyBaseUrl] = useState('');

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.SCRAPER_PROXY_BASE_URL) {
          setProxyBaseUrl(data.SCRAPER_PROXY_BASE_URL);
        }
      })
      .catch((err) => console.error('Error loading proxy config:', err));
  }, []);

  const getProxyDoiUrl = (doi: string, proxyUrl: string): string => {
    if (!doi) return '';
    const cleanDoi = doi.trim();
    if (!proxyUrl) {
      return `https://doi.org/${cleanDoi}`;
    }
    const cleanProxy = proxyUrl.trim();
    if (cleanProxy.endsWith('doi.org/') || cleanProxy.endsWith('doi.org')) {
      const sep = cleanProxy.endsWith('/') ? '' : '/';
      return `${cleanProxy}${sep}${cleanDoi}`;
    }
    if (cleanProxy.includes('doi.org/')) {
      return `${cleanProxy}${cleanDoi}`;
    }
    if (cleanProxy.endsWith('url=')) {
      return `${cleanProxy}https://doi.org/${cleanDoi}`;
    }
    if (cleanProxy.includes('?')) {
      return `${cleanProxy}&url=${encodeURIComponent(`https://doi.org/${cleanDoi}`)}`;
    }
    return `${cleanProxy}/login?url=${encodeURIComponent(`https://doi.org/${cleanDoi}`)}`;
  };

  useEffect(() => {
    if (paperId && activeProject?.id) {
      fetch(`/api/llm/audit?projectId=${activeProject.id}&paperId=${paperId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.logs) {
            setLlmLogs(data.logs);
          }
        })
        .catch(err => console.error('Failed to load paper LLM logs:', err));
    }
  }, [paperId, activeProject?.id]);
  
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
          <div className="flex flex-col gap-2 w-full">
            <input
              type="text"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-mono font-semibold"
              value={editDoi}
              onChange={(e) => setEditDoi(e.target.value)}
            />
            {editDoi ? (
              <div className="flex items-center gap-1.5">
                <a
                  href={getProxyDoiUrl(editDoi, proxyBaseUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-mono text-xs inline-flex items-center gap-1.5 transition-colors"
                  title={proxyBaseUrl ? "Open DOI via library EzProxy redirection" : "Open DOI link"}
                >
                  <span>Open: {editDoi}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : (
              <span className="text-muted-foreground text-xs italic">Not available</span>
            )}
          </div>
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
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Pipeline Stage</label>
                <div className="w-full bg-secondary/30 border border-border/80 rounded-lg px-3 py-2 text-xs text-foreground/85 focus:outline-none font-semibold font-mono shadow-sm">
                  {((paper?.manual_stage ?? 0) > 0 ? (paper?.manual_stage ?? 0) : (paper?.ai_stage ?? 0)) === 0 && '0: Initial / Unscreened'}
                  {((paper?.manual_stage ?? 0) > 0 ? (paper?.manual_stage ?? 0) : (paper?.ai_stage ?? 0)) === 1 && '1: Fast Filter (Metadata)'}
                  {((paper?.manual_stage ?? 0) > 0 ? (paper?.manual_stage ?? 0) : (paper?.ai_stage ?? 0)) === 2 && '2: Passed Gatekeeper (PDF)'}
                  {((paper?.manual_stage ?? 0) > 0 ? (paper?.manual_stage ?? 0) : (paper?.ai_stage ?? 0)) === 3 && '3: Passed Scientist (QA)'}
                  {((paper?.manual_stage ?? 0) > 0 ? (paper?.manual_stage ?? 0) : (paper?.ai_stage ?? 0)) === 4 && '4: Passed Miner (Extraction)'}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Decision State</label>
                <div className={`w-full border rounded-lg px-3 py-2 text-xs font-bold font-mono shadow-sm ${
                  resolvedDecisionVal === 'INCLUDE' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                  resolvedDecisionVal === 'EXCLUDE' ? 'bg-destructive/10 border-destructive/20 text-destructive' :
                  resolvedDecisionVal === 'UNCERTAIN' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                  'bg-secondary/30 border-border/80 text-foreground/85'
                }`}>
                  {resolvedDecisionVal || 'UNSCREENED'}
                </div>
              </div>
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
                <option value="INACCESSIBLE">INACCESSIBLE</option>
                <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
                <option value="MATCHED">MATCHED</option>
                <option value="DOWNLOADED">DOWNLOADED</option>
                <option value="SYNCED">SYNCED</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">PDF Link / Cloud URL</label>
              {editPdfStatus === 'NEEDS_REVIEW' && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm('Are you sure you want to delete this PDF file?')) return;
                    try {
                      const res = await fetch(`/api/pdf/delete?paperId=${encodeURIComponent(paperId)}`, { method: 'DELETE' });
                      if (res.ok) {
                        setEditPdfStatus('MISSING');
                        setEditPdfLink('');
                        broadcastSync('SYNC_PAPERS');
                        alert('PDF file deleted and status reset to MISSING.');
                      } else {
                        const err = await res.json();
                        alert('Error deleting PDF: ' + (err.error || 'Unknown error'));
                      }
                    } catch (err: any) {
                      alert('Error: ' + err.message);
                    }
                  }}
                  className="text-[10px] uppercase font-bold text-destructive hover:text-destructive/80 transition-colors flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                  Delete PDF
                </button>
              )}
            </div>
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
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">AI Evaluation</span>
                </div>
                <span className="text-[9px] bg-secondary border border-border text-muted-foreground font-extrabold px-1.5 py-0.5 rounded uppercase">
                  Stage: {getAiStageFriendlyName(getAiHighestStage(llmLogs))}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {paper?.ai_decision ? (
                  <>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        aiDecisionVal === 'INCLUDE' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                        aiDecisionVal === 'EXCLUDE' ? 'bg-destructive/10 border-destructive/20 text-destructive' :
                        'bg-secondary border-border text-muted-foreground'
                      }`}>
                        {aiDecisionVal}
                    </span>
                    {paper.ai_exclusion_code && (
                      <span className="px-1.5 py-0.5 bg-background border border-border text-muted-foreground rounded text-[9px] font-bold uppercase">
                        {paper.ai_exclusion_code}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[10px] font-bold text-muted-foreground/50 uppercase italic">Undecided</span>
                )}
              </div>
              {paper?.ai_rationale && (
                <div className="text-[11px] text-muted-foreground leading-relaxed mt-1 line-clamp-4 hover:line-clamp-none transition-all">
                  {paper.ai_rationale}
                </div>
              )}
            </div>

            {/* Manual Screening Decision Box (Read Only) */}
            <div className={`bg-secondary/5 rounded-lg border border-border/30 p-3 flex flex-col gap-2`}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Manual Screening Decision (Read Only)</span>
                </div>
                <span className="text-[9px] bg-secondary border border-border text-muted-foreground font-extrabold px-1.5 py-0.5 rounded uppercase">
                  Stage: {getManualStageFriendlyName(paper?.manual_stage)}
                </span>
              </div>
              {paper?.manual_decision ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      paper.manual_decision === 'INCLUDE' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                      paper.manual_decision === 'EXCLUDE' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                      'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    }`}>
                      {paper.manual_decision}
                    </span>
                    {paper.manual_exclusion_code && (
                      <span className="px-1.5 py-0.5 bg-background border border-border text-muted-foreground rounded text-[9px] font-bold uppercase">
                        {paper.manual_exclusion_code}
                      </span>
                    )}
                  </div>
                  {paper.manual_rationale && (
                    <div className="text-[11px] text-muted-foreground leading-relaxed mt-1 line-clamp-4 hover:line-clamp-none transition-all">
                      {paper.manual_rationale}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[10px] font-bold text-muted-foreground/50 uppercase italic mt-1">None (Auto)</div>
              )}
              <p className="text-[10px] text-muted-foreground/70 italic border-t border-border/30 pt-2 mt-1">
                * Note: Screening decisions cannot be modified from Paper Details. Please adjust decisions using the Manual Screening Pipeline.
              </p>
            </div>
          </div>
        </Row>
        
        {llmLogs.length > 0 && (
          <Row label="LLM Stage Details">
            <div className="flex flex-col gap-2 w-full">
              {['fast_filter', 'gatekeeper', 'scientist', 'miner'].map(stage => {
                const logsForStage = llmLogs.filter(l => l.task_type === stage && l.status === 'SUCCESS');
                if (logsForStage.length === 0) return null;
                const latestLog = logsForStage[logsForStage.length - 1]; // chronologically last
                const isExpanded = expandedLog === stage;
                return (
                  <div key={stage} className="border border-border/50 rounded-lg overflow-hidden bg-secondary/5">
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setExpandedLog(isExpanded ? null : stage);
                      }}
                      className="w-full flex items-center justify-between p-3 bg-secondary/20 hover:bg-secondary/40 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        <span className="font-bold text-xs uppercase text-foreground">{stage.replace('_', ' ')}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono bg-background border border-border px-1.5 py-0.5 rounded">
                        {latestLog.model_id}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="p-3 border-t border-border/50 bg-secondary/10">
                        <JSONViewer data={latestLog.structured_output || latestLog.raw_response} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Row>
        )}
        

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
