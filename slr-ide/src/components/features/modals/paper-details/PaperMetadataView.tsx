import React, { useState, useEffect } from 'react';
import { ExternalLink, Hash, Clock, Globe, GitCommit, FileText, Database, ShieldAlert, Cpu, UserCheck } from 'lucide-react';

interface PaperMetadataViewProps {
  paper: any;
  setPaperModal: (val: any) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  getActiveProjectPoolTags: (poolId: string) => any[];
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
  getActiveProjectPoolTags
}: PaperMetadataViewProps) {
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

  const aiDecisionVal = (paper.AI_Decision || 'PENDING').toUpperCase();
  const humanDecisionVal = (paper.Human_Decision || '').toUpperCase();
  
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
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase font-bold text-muted-foreground w-24">Pipeline Stage</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                {
                  '0': 'bg-slate-500/10 border-slate-500/20 text-slate-400',
                  '1': 'bg-blue-500/10 border-blue-500/20 text-blue-400',
                  '2': 'bg-purple-500/10 border-purple-500/20 text-purple-400',
                  '3': 'bg-amber-500/10 border-amber-500/20 text-amber-400',
                  '4': 'bg-pink-500/10 border-pink-500/20 text-pink-400'
                }[String(paper.Status)] || 'bg-secondary border-border text-muted-foreground'
              }`}>
                {{
                  '0': '0: Initial',
                  '1': '1: Fast Filter',
                  '2': '2: Gatekeeper',
                  '3': '3: Scientist',
                  '4': '4: Miner'
                }[String(paper.Status)] || String(paper.Status)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase font-bold text-muted-foreground w-24">PDF Status</span>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${
                  paper.Local_PDF_Status === 'SYNCED' ? 'bg-emerald-500' :
                  paper.Local_PDF_Status === 'DOWNLOADED' || paper.Local_PDF_Status === 'MATCHED' ? 'bg-amber-500' :
                  paper.Local_PDF_Status === 'FAILED' ? 'bg-destructive' :
                  paper.Local_PDF_Status === 'IGNORED' ? 'bg-muted-foreground/50' :
                  'bg-destructive/60'
                }`} />
                <span className="text-xs font-bold uppercase tracking-wider">{paper.Local_PDF_Status}</span>
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
            {/* AI Box */}
            <div className="bg-secondary/15 rounded-lg border border-border/40 p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase">AI Evaluation</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                    aiDecisionVal === 'INCLUDE' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                    aiDecisionVal === 'EXCLUDE' ? 'bg-destructive/10 border-destructive/20 text-destructive' :
                    'bg-secondary border-border text-muted-foreground'
                  }`}>
                    {aiDecisionVal}
                </span>
                {paper.AI_EC_Trigger && paper.AI_EC_Trigger !== 'NONE' && (
                  <span className="px-1.5 py-0.5 bg-background border border-border text-muted-foreground rounded text-[9px] font-bold uppercase">
                    {paper.AI_EC_Trigger}
                  </span>
                )}
              </div>
              {paper.AI_Rationale && (
                <div className="text-[11px] text-muted-foreground leading-relaxed mt-1 line-clamp-4 hover:line-clamp-none transition-all">
                  {paper.AI_Rationale}
                </div>
              )}
            </div>

            {/* Human Box */}
            <div className={`bg-secondary/15 rounded-lg border ${humanDecisionVal ? 'border-primary/40' : 'border-border/40'} p-3 flex flex-col gap-2`}>
              <div className="flex items-center gap-2 mb-1">
                <UserCheck className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Human Override</span>
              </div>
              {humanDecisionVal ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        humanDecisionVal === 'INCLUDE' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                        humanDecisionVal === 'EXCLUDE' ? 'bg-destructive/10 border-destructive/20 text-destructive' :
                        'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      }`}>
                        {humanDecisionVal}
                    </span>
                    {paper.Human_EC_Trigger && paper.Human_EC_Trigger !== 'NONE' && (
                      <span className="px-1.5 py-0.5 bg-background border border-border text-muted-foreground rounded text-[9px] font-bold uppercase">
                        {paper.Human_EC_Trigger}
                      </span>
                    )}
                  </div>
                  {paper.Human_Rationale && (
                    <div className="text-[11px] text-muted-foreground leading-relaxed mt-1 line-clamp-4 hover:line-clamp-none transition-all">
                      {paper.Human_Rationale}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[10px] font-bold text-muted-foreground/50 uppercase italic mt-1">None (Auto)</div>
              )}
            </div>
          </div>
        </Row>
        
        <Row label="Calibration">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase w-12">Pool</span>
              {paper.calibration_pool ? (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border truncate inline-block ${
                  paper.calibration_pool === 'pool_a' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' :
                  paper.calibration_pool === 'pool_b' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                  'bg-amber-500/10 border-amber-500/20 text-amber-400'
                }`}>
                  {paper.calibration_pool.replace('_', ' ')}
                </span>
              ) : (
                <span className="text-[10px] font-bold text-muted-foreground/50 uppercase italic">None</span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase w-12">Tag</span>
              {paper.calibration_tag ? (
                (() => {
                  const tags = getActiveProjectPoolTags(paper.calibration_pool || '');
                  const matchedTag = tags.find((t: any) => t.code === paper.calibration_tag);
                  return (
                    <span 
                      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 border border-primary/20 text-primary truncate inline-block cursor-help"
                      title={matchedTag ? matchedTag.label : paper.calibration_tag}
                    >
                      {paper.calibration_tag}
                    </span>
                  );
                })()
              ) : (
                <span className="text-[10px] font-bold text-muted-foreground/50 uppercase italic">None</span>
              )}
            </div>
          </div>
        </Row>
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
                <span className="text-xs font-bold text-primary truncate" title={paper.Parent_Paper_Title || ''}>
                  {paper.Parent_Paper_Title || 'Untitled Paper'}
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
                      showToast('Failed to load parent paper details', 'error');
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
