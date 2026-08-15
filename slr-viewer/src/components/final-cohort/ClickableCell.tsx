import React, { useState, useEffect, useRef } from 'react';
import { Check, Eye, Link2, X, Copy, ExternalLink } from 'lucide-react';

export interface ClickableCellProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  valueToCopy?: string;
  traceInfo?: {
    mapping?: string;
    evidence?: string;
    justification?: string;
  };
  originalValue?: string;
  pdfLink?: string;
}

export default function ClickableCell({ 
  children, 
  className = "",
  title,
  valueToCopy,
  traceInfo,
  originalValue,
  pdfLink
}: ClickableCellProps) {
  const [activeTooltip, setActiveTooltip] = useState<'value' | 'trace' | null>(null);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeTooltip) return;
    const handleDocumentClick = (e: MouseEvent) => {
      if (cellRef.current && !cellRef.current.contains(e.target as Node)) {
        setActiveTooltip(null);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [activeTooltip]);

  useEffect(() => {
    const handleCloseAll = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.exceptRef !== cellRef) {
        setActiveTooltip(null);
      }
    };
    window.addEventListener('close-all-tooltips', handleCloseAll);
    return () => window.removeEventListener('close-all-tooltips', handleCloseAll);
  }, []);

  const setAndBroadcastTooltip = (type: 'value' | 'trace' | null) => {
    setActiveTooltip(type);
    if (type) {
      window.dispatchEvent(new CustomEvent('close-all-tooltips', { detail: { exceptRef: cellRef } }));
    }
  };

  const handleCopy = (text: string, type: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div ref={cellRef} className="relative group/cell w-full h-full min-h-[22px]">
      <div 
        title={title}
        className={`transition-all duration-150 select-text pr-10 truncate max-h-[18px] overflow-hidden whitespace-nowrap text-ellipsis block ${className}`}
      >
        {children}
      </div>

      <div className={`absolute right-1 top-0.5 flex items-center gap-1 opacity-0 group-hover/cell:opacity-100 transition-opacity duration-150 z-10 ${activeTooltip ? 'opacity-100' : ''}`}>
        {valueToCopy && (
          <button
            onClick={() => setAndBroadcastTooltip(activeTooltip === 'value' ? null : 'value')}
            className={`p-0.5 rounded hover:bg-secondary border border-border/40 text-muted-foreground hover:text-foreground transition-colors bg-card/90 shadow-sm cursor-pointer ${activeTooltip === 'value' ? 'bg-secondary text-primary border-primary/30' : ''}`}
            title="View and copy cell value"
          >
            <Eye className="w-3 h-3" />
          </button>
        )}
        
        {traceInfo && (traceInfo.mapping || traceInfo.evidence || traceInfo.justification) && (
          <button
            onClick={() => setAndBroadcastTooltip(activeTooltip === 'trace' ? null : 'trace')}
            className={`p-0.5 rounded hover:bg-secondary border border-border/40 text-muted-foreground hover:text-foreground transition-colors bg-card/90 shadow-sm cursor-pointer ${activeTooltip === 'trace' ? 'bg-secondary text-primary border-primary/30' : ''}`}
            title="View extraction logic trace"
          >
            <Link2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {activeTooltip === 'value' && valueToCopy && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-72 p-3 bg-popover border border-border rounded-lg shadow-xl text-left text-[11px] text-popover-foreground flex flex-col gap-2 animate-in fade-in zoom-in-95">
          <div className="flex justify-between items-center border-b border-border pb-1">
            <span className="font-bold text-[10px] uppercase text-primary">Copy Cell Value</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleCopy(valueToCopy, 'value')}
                className="p-1 hover:bg-secondary rounded border border-border flex items-center gap-1 text-[9px] font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {copiedType === 'value' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                {copiedType === 'value' ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={() => setActiveTooltip(null)}
                className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto font-mono text-[10px] break-words bg-secondary/50 p-2 rounded border border-border/50 select-text whitespace-pre-wrap">
            {valueToCopy}
          </div>
          {pdfLink && (
            <div className="pt-1 border-t border-border flex justify-end">
              <a
                href={pdfLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Open Paper PDF</span>
              </a>
            </div>
          )}
        </div>
      )}

      {activeTooltip === 'trace' && traceInfo && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-80 p-3 bg-popover border border-border rounded-lg shadow-xl text-left text-[11px] text-popover-foreground flex flex-col gap-2.5 animate-in fade-in zoom-in-95">
          <div className="flex justify-between items-center border-b border-border pb-1">
            <span className="font-bold text-[10px] uppercase text-primary flex items-center gap-1.5">
              <Link2 className="w-3 h-3" />
              Logic Trace & Evidence
            </span>
            <button
              onClick={() => setActiveTooltip(null)}
              className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {traceInfo.justification && (
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] font-bold text-amber-500">
                <span>Taxonomy Normalization</span>
                <button
                  onClick={() => handleCopy(traceInfo.justification || '', 'trace-justification')}
                  className="hover:underline text-[9px] flex items-center gap-1 cursor-pointer"
                >
                  {copiedType === 'trace-justification' ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                  {copiedType === 'trace-justification' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="text-[10px] bg-secondary/40 p-2 rounded border border-border/40 font-mono select-text">
                {traceInfo.justification}
              </div>
            </div>
          )}

          {traceInfo.mapping && (
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground">
                <span>Reasoning / Synthesis</span>
                <button
                  onClick={() => handleCopy(traceInfo.mapping || '', 'trace-mapping')}
                  className="hover:underline text-[9px] flex items-center gap-1 cursor-pointer"
                >
                  {copiedType === 'trace-mapping' ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                  {copiedType === 'trace-mapping' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="text-[10px] bg-secondary/40 p-2 rounded border border-border/40 font-mono select-text whitespace-pre-wrap">
                {traceInfo.mapping}
              </div>
            </div>
          )}

          {traceInfo.evidence && (
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] font-bold text-emerald-500">
                <span>Exact Paper Evidence Quote</span>
                <button
                  onClick={() => handleCopy(traceInfo.evidence || '', 'trace-evidence')}
                  className="hover:underline text-[9px] flex items-center gap-1 cursor-pointer"
                >
                  {copiedType === 'trace-evidence' ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                  {copiedType === 'trace-evidence' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="text-[10px] bg-emerald-500/10 text-emerald-300 p-2 rounded border border-emerald-500/20 font-mono select-text italic whitespace-pre-wrap">
                "{traceInfo.evidence}"
              </div>
            </div>
          )}

          {pdfLink && (
            <div className="pt-1 border-t border-border flex justify-end">
              <a
                href={pdfLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Open Paper PDF</span>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
