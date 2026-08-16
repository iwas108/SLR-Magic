import React, { useState, useEffect } from 'react';
import { ExternalLink, Hash, Clock, Globe, GitCommit, FileText, Database, ShieldAlert, Cpu, UserCheck, ChevronDown, ChevronRight, Play, RefreshCw } from 'lucide-react';
import JSONViewer from '@/components/ui/JSONViewer';
import ScreeningSummaryPanel from './ScreeningSummaryPanel';

import { Paper, Project } from '@/types';

interface PaperMetadataViewProps {
  paper: Paper;
  setPaperModal: React.Dispatch<React.SetStateAction<any>>;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  activeProject?: Project | null;
  onTriggerPdfAcquisition?: () => void;
  isPdfRunning?: boolean;
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

const Row = ({ label, children, isVertical = false }: { label: string, children: React.ReactNode, isVertical?: boolean }) => (
  <div className={`p-4 ${isVertical ? 'flex flex-col gap-2' : 'flex flex-col sm:flex-row sm:items-start gap-4'}`}>
    <div className={`text-xs font-semibold text-muted-foreground shrink-0 ${isVertical ? '' : 'sm:w-48 sm:pt-0.5'}`}>
      {label}
    </div>
    <div className={`text-sm text-foreground flex-1 min-w-0 font-medium ${isVertical ? 'bg-secondary/10 p-3.5 rounded-lg border border-border/30 shadow-inner' : ''}`}>
      {children}
    </div>
  </div>
);

export default function PaperMetadataView({
  paper,
  setPaperModal,
  showToast,
  activeProject,
  onTriggerPdfAcquisition,
  isPdfRunning = false
}: PaperMetadataViewProps) {
  const [proxyBaseUrl, setProxyBaseUrl] = useState('');
  const [screeningRecords, setScreeningRecords] = useState<any[]>([]);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    if (paper?.Paper_ID) {
      fetch(`/api/papers/${encodeURIComponent(paper.Paper_ID)}/screening`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.records) {
            setScreeningRecords(data.records);
          }
        })
        .catch(err => console.error('Failed to load paper screening records:', err));
    }
  }, [paper?.Paper_ID, activeProject?.id]);

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

  const rawAiDec = (paper.ai_decision || '').toUpperCase();
  const manualDecisionVal = (paper.manual_decision || '').toUpperCase();
  const resolvedDecisionVal = manualDecisionVal 
    ? (manualDecisionVal.startsWith('EXCLUDE') ? 'EXCLUDE' : manualDecisionVal) 
    : (rawAiDec.startsWith('EXCLUDE') ? 'EXCLUDE' : (rawAiDec || ''));
  const activeStage = (paper.manual_stage ?? 0) > 0 ? (paper.manual_stage ?? 0) : (paper.ai_stage ?? 0);
  
  return (
    <div className="space-y-6 pb-8 max-w-5xl mx-auto w-full">
      
      {/* 1. Core Identity */}
      <Section title="Core Identity" icon={FileText}>
        <Row label="Title">
          <span className="font-bold text-base leading-snug">{paper.Title}</span>
        </Row>
        <Row label="Authors">
          <span className="text-muted-foreground">{paper.Authors || '—'}</span>
        </Row>
        <Row label="Publication Year">
          <span className="font-mono bg-secondary/30 px-2 py-0.5 rounded text-xs">{paper.Year || '—'}</span>
        </Row>
        <Row label="DOI">
          {paper.DOI ? (
            <a
              href={getProxyDoiUrl(paper.DOI, proxyBaseUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-mono inline-flex items-center gap-1.5 transition-colors"
              title={proxyBaseUrl ? "Open DOI via library EzProxy redirection" : "Open DOI link"}
            >
              <span>{paper.DOI}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <span className="text-muted-foreground italic">Not available</span>
          )}
        </Row>
        <Row label="Publisher (Mapped)">
          <span>{paper.Publisher || '—'}</span>
        </Row>
        <Row label="Original Publisher">
          <span className="text-muted-foreground">{paper.Original_Publisher || '—'}</span>
        </Row>
        <Row label="Citation Count">
          <span className="font-mono bg-secondary/30 px-2 py-0.5 rounded text-xs">
            {paper.citation_count !== undefined && paper.citation_count !== null ? paper.citation_count : '0'}
          </span>
        </Row>
      </Section>

      {/* 2. Pipeline & Decisions */}
      <Section title="Pipeline & Decisions" icon={GitCommit}>
        <Row label="Database Identifiers">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-muted-foreground w-16">Paper ID</span>
              <span className="font-mono text-xs bg-secondary/30 px-2 py-0.5 rounded">{paper.Paper_ID}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-muted-foreground w-16">Imported</span>
              <span className="text-xs text-muted-foreground">{paper.Import_Date || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-muted-foreground w-16">Source</span>
              <span className="text-xs text-muted-foreground">{paper.Import_Source || '—'}</span>
            </div>
          </div>
        </Row>
        
        <Row label="System State">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase font-bold text-muted-foreground w-24">Pipeline Stage</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                  {
                    '0': 'bg-slate-500/10 border-slate-500/20 text-slate-400',
                    '1': 'bg-blue-500/10 border-blue-500/20 text-blue-400',
                    '2': 'bg-purple-500/10 border-purple-500/20 text-purple-400',
                    '3': 'bg-amber-500/10 border-amber-500/20 text-amber-400',
                    '4': 'bg-pink-500/10 border-pink-500/20 text-pink-400'
                  }[String(activeStage)] || 'bg-secondary border-border text-muted-foreground'
                }`}>
                  {{
                    '0': '0: Initial',
                    '1': '1: Fast Filter',
                    '2': '2: Gatekeeper',
                    '3': '3: Scientist',
                    '4': '4: Miner'
                  }[String(activeStage)] || String(activeStage)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase font-bold text-muted-foreground w-24 sm:w-auto">Decision State</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                  resolvedDecisionVal === 'INCLUDE' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                  resolvedDecisionVal === 'EXCLUDE' ? 'bg-destructive/10 border-destructive/20 text-destructive' :
                  resolvedDecisionVal === 'UNCERTAIN' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                  'bg-slate-500/10 border-slate-500/20 text-slate-400'
                }`}>
                  {resolvedDecisionVal || 'UNSCREENED'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase font-bold text-muted-foreground w-24">PDF Status</span>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  paper.Local_PDF_Status === 'SYNCED' ? 'bg-emerald-500' :
                  paper.Local_PDF_Status === 'DOWNLOADED' || paper.Local_PDF_Status === 'MATCHED' ? 'bg-amber-500' :
                  paper.Local_PDF_Status === 'NEEDS_REVIEW' ? 'bg-purple-500' :
                  paper.Local_PDF_Status === 'FAILED' ? 'bg-destructive' :
                  paper.Local_PDF_Status === 'IGNORED' ? 'bg-muted-foreground/50' :
                  'bg-destructive/60'
                }`} />
                <span className="text-xs font-bold uppercase tracking-wider">{paper.Local_PDF_Status || 'MISSING'}</span>
                {(!paper.Local_PDF_Path || ['MISSING', 'FAILED', 'IGNORED'].includes(paper.Local_PDF_Status as string) || !paper.Local_PDF_Status) && onTriggerPdfAcquisition && (
                  <button
                    type="button"
                    onClick={onTriggerPdfAcquisition}
                    disabled={isPdfRunning}
                    className="ml-2 px-2 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold rounded border border-primary/20 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="Acquire PDF via Cache Matching & Web Scraping"
                  >
                    {isPdfRunning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
                    <span>{isPdfRunning ? 'Acquiring...' : 'Acquire PDF'}</span>
                  </button>
                )}
              </div>
            </div>
            {paper.PDF_Link && (
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase font-bold text-muted-foreground w-24">PDF Link</span>
                <a href={paper.PDF_Link} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 truncate max-w-[200px] sm:max-w-md">
                  {paper.PDF_Link} <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            )}
          </div>
        </Row>
        
        <Row label="Adjudication">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ScreeningSummaryPanel
              title="AI Screening"
              icon={Cpu}
              colorTheme="blue"
              stage={paper.ai_stage || 0}
              decision={paper.ai_decision ?? null}
              exclusionCode={paper.ai_exclusion_code ?? null}
              rationale={paper.ai_rationale ?? null}
              qualityAssessment={paper.ai_quality_assessment ?? null}
              extractedData={paper.ai_extracted_data ?? null}
            />
            <ScreeningSummaryPanel
              title="Manual Screening"
              icon={UserCheck}
              colorTheme="amber"
              stage={paper.manual_stage || 0}
              decision={paper.manual_decision ?? null}
              exclusionCode={paper.manual_exclusion_code ?? null}
              rationale={paper.manual_rationale ?? null}
              qualityAssessment={paper.manual_quality_assessment ?? null}
              extractedData={paper.manual_extracted_data ?? null}
            />
          </div>
        </Row>
        
        {screeningRecords.length > 0 && (
          <Row label="LLM Stage Details">
            <div className="flex flex-col gap-2">
              {screeningRecords.map((record) => {
                const stageKey = `stage_${record.stage}_${record.task_type}`;
                const isExpanded = expandedLog === stageKey;
                const isExclude = (record.decision || '').toUpperCase().startsWith('EXCLUDE');
                const stageNames: Record<number, string> = {
                  1: 'Stage 1: Fast Filter',
                  2: 'Stage 2: Gatekeeper',
                  3: 'Stage 3: Quality Assessment',
                  4: 'Stage 4: Data Extraction'
                };
                const displayTitle = stageNames[record.stage] || record.task_type.replace('_', ' ').toUpperCase();

                return (
                  <div key={record.id || stageKey} className="border border-border/50 rounded-lg overflow-hidden bg-secondary/5">
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setExpandedLog(isExpanded ? null : stageKey);
                      }}
                      className="w-full flex items-center justify-between p-3 bg-secondary/20 hover:bg-secondary/40 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        <span className="font-bold text-xs uppercase text-foreground">{displayTitle}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isExclude ? 'bg-destructive/20 text-destructive border border-destructive/30' : 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'}`}>
                          {record.decision} {record.exclusion_code ? `(${record.exclusion_code})` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {record.total_tokens ? (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {record.total_tokens.toLocaleString()} tok
                          </span>
                        ) : null}
                        <span className="text-[10px] text-muted-foreground font-mono bg-background border border-border px-1.5 py-0.5 rounded">
                          {record.model_id}
                        </span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="p-3 border-t border-border/50 bg-secondary/10 flex flex-col gap-2">
                        {record.rationale && (
                          <div className="text-xs text-muted-foreground bg-background/50 p-2 rounded border border-border/30">
                            <span className="font-semibold text-foreground">Rationale: </span>
                            {record.rationale}
                          </div>
                        )}
                        <JSONViewer data={record.structured_output || record.extracted_data || record.quality_assessment || record.logic_trace || record} />
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
          <div className="text-[13px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {paper.Abstract || <span className="italic text-muted-foreground/50">No abstract available.</span>}
          </div>
        </Row>
        
        <Row label="Notes & Findings" isVertical>
          <div className="text-[13px] leading-relaxed whitespace-pre-wrap text-foreground">
            {paper.notes || <span className="italic text-muted-foreground/50">No notes or findings recorded yet. Click Edit Paper to add notes.</span>}
          </div>
        </Row>

        <Row label="Parent Paper (Chain)">
          {paper.Parent_Paper_ID ? (
            <div className="flex items-center justify-between bg-secondary/20 p-2.5 rounded-lg border border-border/30">
              <div className="flex flex-col min-w-0 pr-4">
                <span className="text-xs font-bold text-primary truncate" title={paper.Parent_Paper_Title || 'Referenced Parent Paper'}>
                  {paper.Parent_Paper_Title || 'Referenced Parent (Origin Project)'}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground mt-0.5">ID: {paper.Parent_Paper_ID}</span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/papers/${paper.Parent_Paper_ID}`);
                    if (res.ok) {
                      const parentPaper = await res.json();
                      setPaperModal({ isOpen: true, mode: 'view', paper: parentPaper });
                    } else {
                      showToast(`Parent paper (${paper.Parent_Paper_ID}) was not transferred or is not in this project database`, 'info');
                    }
                  } catch (err: any) {
                    showToast(`Error loading parent paper: ${err.message || err}`, 'error');
                  }
                }}
                className="shrink-0 flex items-center justify-center bg-primary/10 hover:bg-primary/20 text-primary p-2 rounded-lg transition-colors group"
                title="Open Parent Paper"
              >
                <ExternalLink className="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          ) : (
            <span className="text-muted-foreground italic">No parent reference</span>
          )}
        </Row>
      </Section>

    </div>
  );
}
