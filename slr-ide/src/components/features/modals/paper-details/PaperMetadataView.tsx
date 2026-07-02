import React, { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';

interface PaperMetadataViewProps {
  paper: any;
  setPaperModal: (val: any) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  getActiveProjectPoolTags: (poolId: string) => any[];
}

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

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        {/* Paper ID */}
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Paper ID</label>
          <div className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground font-bold select-text truncate" title={paper.Paper_ID}>
            {paper.Paper_ID}
          </div>
        </div>

        {/* Import Date */}
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Import Date</label>
          <div className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground font-semibold select-text">
            {paper.Import_Date || '—'}
          </div>
        </div>

        {/* Source Scope */}
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Source Scope</label>
          <div className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground font-semibold select-text truncate" title={paper.Import_Source || '—'}>
            {paper.Import_Source || '—'}
          </div>
        </div>
      </div>

      {/* Parent Paper (Chained Reference) */}
      <div>
        <label className="text-[10px] font-bold text-muted-foreground uppercase">Parent Paper (Chained Reference)</label>
        {paper.Parent_Paper_ID ? (
          <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-semibold flex items-center justify-between overflow-hidden">
            <span className="truncate flex-1 font-bold text-primary" title={paper.Parent_Paper_Title || ''}>
              {paper.Parent_Paper_Title || 'Untitled Paper'} ({paper.Parent_Paper_ID})
            </span>
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
              className="text-primary hover:underline ml-2 flex items-center gap-0.5 text-[10px] shrink-0"
            >
              Open Parent <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground font-semibold select-none">
            None
          </div>
        )}
      </div>

      {/* Title */}
      <div>
        <label className="text-[10px] font-bold text-muted-foreground uppercase">Title</label>
        <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2.5 text-xs text-foreground font-bold leading-relaxed select-text">
          {paper.Title}
        </div>
      </div>

      {/* Authors & Year */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Authors</label>
          <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-semibold truncate select-text" title={paper.Authors || '—'}>
            {paper.Authors || '—'}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Year</label>
          <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-semibold select-text">
            {paper.Year || '—'}
          </div>
        </div>
      </div>

      {/* DOI & PDF Link */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">DOI</label>
          <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-mono truncate select-text flex items-center justify-between">
            {paper.DOI ? (
              <a
                href={getProxyDoiUrl(paper.DOI, proxyBaseUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-mono inline-flex items-center gap-1 select-text truncate max-w-full"
                title={proxyBaseUrl ? "Open DOI via library EzProxy redirection" : "Open DOI link"}
              >
                <span className="truncate">{paper.DOI}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            ) : (
              <span>—</span>
            )}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">PDF Link / Cloud URL</label>
          <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-semibold flex items-center justify-between overflow-hidden select-text">
            <span className="truncate flex-1" title={paper.PDF_Link || '—'}>
              {paper.PDF_Link || '—'}
            </span>
            {paper.PDF_Link && paper.PDF_Link.startsWith('http') && (
              <a
                href={paper.PDF_Link}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline ml-2 flex items-center gap-0.5 text-[10px] shrink-0"
              >
                Open <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Original Publisher, Publisher & Citations */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Original Publisher</label>
          <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-semibold truncate select-text" title={paper.Original_Publisher || '—'}>
            {paper.Original_Publisher || '—'}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Publisher (Mapped)</label>
          <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-semibold truncate select-text" title={paper.Publisher || '—'}>
            {paper.Publisher || '—'}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Citation Count</label>
          <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-semibold select-text">
            {paper.citation_count !== undefined && paper.citation_count !== null ? paper.citation_count : '0'}
          </div>
        </div>
      </div>

      {/* Abstract */}
      <div>
        <label className="text-[10px] font-bold text-muted-foreground uppercase">Abstract</label>
        <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2.5 text-xs text-muted-foreground font-medium leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap select-text">
          {paper.Abstract || 'No abstract available.'}
        </div>
      </div>

      {/* Notes / Findings */}
      <div>
        <label className="text-[10px] font-bold text-muted-foreground uppercase">Notes / Findings</label>
        <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2.5 text-xs text-muted-foreground font-medium leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap select-text">
          {paper.notes || <span className="italic text-muted-foreground/45">No notes or findings recorded yet. Click Edit Paper to add notes.</span>}
        </div>
      </div>

      {/* PDF Status & Review Status */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Local PDF Status</label>
          <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-semibold flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              paper.Local_PDF_Status === 'SYNCED' ? 'bg-emerald-500' :
              paper.Local_PDF_Status === 'DOWNLOADED' || paper.Local_PDF_Status === 'MATCHED' ? 'bg-amber-500 animate-pulse' :
              paper.Local_PDF_Status === 'FAILED' ? 'bg-destructive' :
              paper.Local_PDF_Status === 'IGNORED' ? 'bg-muted-foreground/50' :
              'bg-destructive/60'
            }`} />
            <span className="text-[10px] font-bold tracking-wider uppercase">
              {paper.Local_PDF_Status}
            </span>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Review Status</label>
          <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-semibold">
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
              paper.Status === 'INCLUDE' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
              paper.Status === 'EXCLUDE' ? 'bg-destructive/10 border-destructive/20 text-destructive' :
              'bg-secondary border-border text-muted-foreground'
            }`}>
              {paper.Status}
            </span>
          </div>
        </div>
      </div>

      {/* Calibration Pool & Tag */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Calibration Pool</label>
          <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-semibold">
            {paper.calibration_pool ? (
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border truncate inline-block ${
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
        </div>

        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Calibration Tag</label>
          <div className="bg-secondary/25 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-semibold">
            {paper.calibration_tag ? (
              (() => {
                const tags = getActiveProjectPoolTags(paper.calibration_pool || '');
                const matchedTag = tags.find((t: any) => t.code === paper.calibration_tag);
                return (
                  <span 
                    className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-primary/10 border border-primary/20 text-primary truncate inline-block cursor-help"
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
      </div>
    </>
  );
}
