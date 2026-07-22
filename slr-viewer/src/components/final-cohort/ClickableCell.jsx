import React, { useState, useEffect, useRef } from 'react';
import { Check, Eye, Link2, X, Copy, ExternalLink } from 'lucide-react';

export default function ClickableCell({ 
  children, 
  className = "",
  title,
  valueToCopy,
  traceInfo,
  originalValue,
  pdfLink
}) {
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [copiedType, setCopiedType] = useState(null);
  const cellRef = useRef(null);

  useEffect(() => {
    if (!activeTooltip) return;
    const handleDocumentClick = (e) => {
      if (cellRef.current && !cellRef.current.contains(e.target)) {
        setActiveTooltip(null);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [activeTooltip]);

  useEffect(() => {
    const handleCloseAll = (e) => {
      if (e.detail?.exceptRef !== cellRef) {
        setActiveTooltip(null);
      }
    };
    window.addEventListener('close-all-tooltips', handleCloseAll);
    return () => window.removeEventListener('close-all-tooltips', handleCloseAll);
  }, []);

  const setAndBroadcastTooltip = (type) => {
    setActiveTooltip(type);
    if (type) {
      window.dispatchEvent(new CustomEvent('close-all-tooltips', { detail: { exceptRef: cellRef } }));
    }
  };

  const handleCopy = (text, type) => {
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
        <div className="absolute right-0 top-full mt-1.5 z-50 w-72 p-3 bg-popover border border-border rounded-lg shadow-xl text-left text-[11px] text-popover-foreground flex flex-col gap-2">
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
          <div className="bg-secondary/40 p-2 rounded text-[10px] font-medium font-mono max-h-24 overflow-y-auto select-all break-all leading-normal">
            {valueToCopy}
          </div>

          {originalValue && originalValue !== valueToCopy && (
            <div className="flex flex-col gap-1 border-t border-border/60 pt-1.5 mt-0.5">
              <div className="flex justify-between items-center">
                <span className="font-bold text-[10px] uppercase text-muted-foreground">Original Value</span>
                <button
                  onClick={() => handleCopy(originalValue, 'original')}
                  className="p-1 hover:bg-secondary rounded border border-border flex items-center gap-1 text-[9px] font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {copiedType === 'original' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  {copiedType === 'original' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="bg-secondary/40 p-2 rounded text-[10px] font-medium font-mono max-h-24 overflow-y-auto select-all break-all leading-normal">
                {originalValue}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTooltip === 'trace' && traceInfo && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-80 p-3 bg-popover border border-border rounded-lg shadow-xl text-left text-[11px] text-popover-foreground flex flex-col gap-3">
          <div className="flex justify-between items-center border-b border-border pb-1">
            <span className="font-bold text-[10px] uppercase text-primary">Logic Trace & Details</span>
            <div className="flex items-center gap-1.5">
              {pdfLink && (
                <a
                  href={pdfLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-[9px] font-bold text-primary hover:underline cursor-pointer"
                  title="Open PDF Document"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  PDF Link
                </a>
              )}
              <button
                onClick={() => setActiveTooltip(null)}
                className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          {traceInfo.mapping && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="text-[9px] uppercase font-extrabold text-muted-foreground">Mapping Rules / Reasoning</span>
                <button
                  onClick={() => handleCopy(traceInfo.mapping, 'trace-mapping')}
                  className="inline-flex items-center gap-1 text-[9px] font-bold text-primary hover:underline cursor-pointer"
                >
                  {copiedType === 'trace-mapping' ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                  {copiedType === 'trace-mapping' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="bg-secondary/40 p-2 rounded text-[10px] font-semibold max-h-20 overflow-y-auto select-all break-words leading-normal">
                {traceInfo.mapping}
              </div>
            </div>
          )}

          {traceInfo.evidence && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="text-[9px] uppercase font-extrabold text-muted-foreground">Evidence Quote</span>
                <button
                  onClick={() => handleCopy(traceInfo.evidence, 'trace-evidence')}
                  className="inline-flex items-center gap-1 text-[9px] font-bold text-primary hover:underline cursor-pointer"
                >
                  {copiedType === 'trace-evidence' ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                  {copiedType === 'trace-evidence' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="bg-secondary/40 p-2 rounded text-[10px] font-medium italic max-h-20 overflow-y-auto select-all break-words leading-normal">
                "{traceInfo.evidence}"
              </div>
            </div>
          )}

          {traceInfo.justification && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="text-[9px] uppercase font-extrabold text-muted-foreground">Taxonomy Justification</span>
                <button
                  onClick={() => handleCopy(traceInfo.justification, 'trace-justification')}
                  className="inline-flex items-center gap-1 text-[9px] font-bold text-primary hover:underline cursor-pointer"
                >
                  {copiedType === 'trace-justification' ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                  {copiedType === 'trace-justification' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="bg-secondary/40 p-2 rounded text-[10px] font-semibold max-h-20 overflow-y-auto select-all break-words leading-normal">
                {traceInfo.justification}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
