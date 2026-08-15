import React from 'react';
import { 
  Filter, ShieldCheck, Microscope, Database, 
  ChevronRight, ArrowRight, AlertTriangle, FileText, CheckCircle2, XCircle, Clock
} from 'lucide-react';

interface MetricSummaryCardsProps {
  activeProject: any;
}

export default function MetricSummaryCards({ activeProject }: MetricSummaryCardsProps) {
  const stageStats = activeProject?.stats?.stageStats || {};
  const stage1 = stageStats['1'] || { included: 0, excluded: 0, unprocessed: 0, total: 0, ecBreakdown: {} };
  const stage2 = stageStats['2'] || { included: 0, excluded: 0, unprocessed: 0, total: 0, ecBreakdown: {} };
  const stage3 = stageStats['3'] || { included: 0, excluded: 0, unprocessed: 0, total: 0, ecBreakdown: {} };
  const stage4 = stageStats['4'] || { included: 0, excluded: 0, unprocessed: 0, total: 0, ecBreakdown: {} };

  const renderStageBar = (stageData: { 
    included: number; 
    excluded: number; 
    unprocessed: number; 
    total: number; 
    ecBreakdown?: Record<string, number>;
    inc_has_pdf?: number;
    inc_no_doi?: number;
    inc_pdf_failed?: number;
    pending_pdf?: number;
    inaccessible_pdf?: number;
  }, showPdfBreakdown: boolean = true) => {
    const stageTotal = stageData.total || 0;
    if (stageTotal === 0) {
      return <div className="text-[11px] text-muted-foreground italic py-3 text-center border border-dashed border-border/50 rounded-lg">No papers in this stage queue</div>;
    }
    
    const actualUnprocessed = stageData.unprocessed;
    const pendingPdf = stageData.pending_pdf || 0;
    const inaccessiblePdf = stageData.inaccessible_pdf || 0;

    const incPct = Math.round((stageData.included / stageTotal) * 100);
    const excPct = Math.round((stageData.excluded / stageTotal) * 100);
    const pendingPdfPct = Math.round((pendingPdf / stageTotal) * 100);
    const inaccessiblePdfPct = Math.round((inaccessiblePdf / stageTotal) * 100);
    const unpPct = Math.max(0, 100 - incPct - excPct - pendingPdfPct - inaccessiblePdfPct);

    let incBreakdownList = null;
    if (showPdfBreakdown && stageData.included > 0 && stageData.inc_has_pdf !== undefined) {
      const hasPdfPct = Math.round((stageData.inc_has_pdf / stageData.included) * 100) || 0;
      const noDoiPct = Math.round((stageData.inc_no_doi! / stageData.included) * 100) || 0;
      const failedPdfPct = Math.round((stageData.inc_pdf_failed! / stageData.included) * 100) || 0;
      
      incBreakdownList = (
        <div className="mt-2.5 text-[9px] text-muted-foreground border-t border-border/50 pt-2 grid grid-cols-3 gap-1.5">
          <div className="flex justify-between items-center bg-secondary/40 px-2 py-1 rounded border border-border/40">
            <span className="truncate">Local PDF</span>
            <span className="font-mono text-emerald-500 font-bold">{stageData.inc_has_pdf} ({hasPdfPct}%)</span>
          </div>
          <div className="flex justify-between items-center bg-secondary/40 px-2 py-1 rounded border border-border/40">
            <span className="truncate">No DOI</span>
            <span className="font-mono text-amber-500 font-bold">{stageData.inc_no_doi} ({noDoiPct}%)</span>
          </div>
          <div className="flex justify-between items-center bg-secondary/40 px-2 py-1 rounded border border-border/40">
            <span className="truncate">Scrape Failed</span>
            <span className="font-mono text-rose-500 font-bold">{stageData.inc_pdf_failed} ({failedPdfPct}%)</span>
          </div>
        </div>
      );
    }

    let topEcList = null;
    if (stageData.excluded > 0 && stageData.ecBreakdown) {
      const sortedEc = Object.entries(stageData.ecBreakdown).sort((a, b) => b[1] - a[1]);
      const top3 = sortedEc.slice(0, 3);
      const otherCount = sortedEc.slice(3).reduce((acc, curr) => acc + curr[1], 0);
      
      topEcList = (
        <div className="mt-2.5 text-[9px] text-muted-foreground border-t border-border/50 pt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {top3.map(([trigger, count], idx) => {
            const pct = Math.round((count / stageData.excluded) * 100);
            return (
              <div key={idx} className="flex justify-between items-center bg-secondary/40 px-2 py-1 rounded border border-border/40" title={trigger}>
                <span className="truncate max-w-[70px] font-medium">{trigger}</span>
                <span className="font-mono text-rose-500 font-bold">{count} ({pct}%)</span>
              </div>
            );
          })}
          {otherCount > 0 && (
            <div className="group relative flex justify-between items-center bg-secondary/40 px-2 py-1 rounded border border-border/40 cursor-help">
              <span className="truncate font-medium">Other ECs</span>
              <span className="font-mono text-rose-500 font-bold">{otherCount}</span>
              
              <div className="absolute bottom-full right-0 mb-1 hidden group-hover:flex flex-col bg-popover text-popover-foreground border border-border text-[9px] p-2.5 rounded-lg shadow-xl w-max z-50">
                <div className="font-bold border-b border-border/50 pb-1 mb-1 text-left">Additional Exclusion Triggers</div>
                {sortedEc.slice(3).map(([trigger, count], sIdx) => (
                  <div key={sIdx} className="flex justify-between gap-4 py-0.5">
                    <span>{trigger}</span>
                    <span className="font-mono text-rose-500 font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="mt-2 space-y-2 z-10 relative">
        <div className="flex justify-between text-[10px] font-bold flex-wrap gap-y-1">
          <span className="text-emerald-500 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Include: {stageData.included} ({incPct}%)
          </span>
          <span className="text-rose-500 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Exclude: {stageData.excluded} ({excPct}%)
          </span>
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" /> Unprocessed: {actualUnprocessed} ({unpPct}%)
          </span>
          {pendingPdf > 0 && (
            <span className="text-amber-500">Pending PDF: {pendingPdf} ({pendingPdfPct}%)</span>
          )}
          {inaccessiblePdf > 0 && (
            <span className="text-purple-400">Inaccessible: {inaccessiblePdf} ({inaccessiblePdfPct}%)</span>
          )}
        </div>

        <div className="w-full h-2 rounded-full overflow-hidden flex bg-secondary/80 border border-border/40 shadow-inner">
          <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${incPct}%` }} title={`Include: ${incPct}%`} />
          <div className="bg-rose-500 h-full transition-all duration-500" style={{ width: `${excPct}%` }} title={`Exclude: ${excPct}%`} />
          <div className="bg-muted h-full transition-all duration-500" style={{ width: `${unpPct}%` }} title={`Unprocessed: ${unpPct}%`} />
          {pendingPdf > 0 && (
            <div className="bg-amber-500 h-full transition-all duration-500" style={{ width: `${pendingPdfPct}%` }} title={`Pending PDF: ${pendingPdfPct}%`} />
          )}
          {inaccessiblePdf > 0 && (
            <div className="bg-purple-500 h-full transition-all duration-500" style={{ width: `${inaccessiblePdfPct}%` }} title={`Inaccessible: ${inaccessiblePdfPct}%`} />
          )}
        </div>

        {incBreakdownList}
        {topEcList}
      </div>
    );
  };

  return (
    <div className="space-y-4 shrink-0">
      {/* 4-Stage Funnel Title Banner */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <h3 className="font-extrabold text-xs text-foreground uppercase tracking-wider">
            Sequential 4-Stage Screening Funnel
          </h3>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          Stage-Aware Precedence (Rule 3.6)
        </span>
      </div>

      {/* 4 Stage Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stage 1: Fast Filter */}
        <div className="bg-card border border-border/80 p-4 rounded-xl flex flex-col justify-start shadow-sm relative overflow-hidden group hover:border-primary/50 transition-all">
          <div className="flex items-center justify-between z-10 pb-2 border-b border-border/40">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 font-mono font-bold text-xs border border-blue-500/20">
                1
              </span>
              <div>
                <span className="text-xs font-bold text-foreground">Fast Filter (Title &amp; Abstract)</span>
                <p className="text-[9px] text-muted-foreground">High-recall screening against exclusion boundaries</p>
              </div>
            </div>
            <Filter className="w-4 h-4 text-blue-400/80" />
          </div>
          {renderStageBar(stage1, true)}
        </div>

        {/* Stage 2: Gatekeeper */}
        <div className="bg-card border border-border/80 p-4 rounded-xl flex flex-col justify-start shadow-sm relative overflow-hidden group hover:border-primary/50 transition-all">
          <div className="flex items-center justify-between z-10 pb-2 border-b border-border/40">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 font-mono font-bold text-xs border border-purple-500/20">
                2
              </span>
              <div>
                <span className="text-xs font-bold text-foreground">Gatekeeper (Full PDF Review)</span>
                <p className="text-[9px] text-muted-foreground">Full-text validation on methodology &amp; criteria</p>
              </div>
            </div>
            <ShieldCheck className="w-4 h-4 text-purple-400/80" />
          </div>
          {renderStageBar(stage2, false)}
        </div>

        {/* Stage 3: Scientist */}
        <div className="bg-card border border-border/80 p-4 rounded-xl flex flex-col justify-start shadow-sm relative overflow-hidden group hover:border-primary/50 transition-all">
          <div className="flex items-center justify-between z-10 pb-2 border-b border-border/40">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 font-mono font-bold text-xs border border-amber-500/20">
                3
              </span>
              <div>
                <span className="text-xs font-bold text-foreground">Scientist (Quality Appraisal)</span>
                <p className="text-[9px] text-muted-foreground">Methodological rigor, QA scoring &amp; fatal flaws</p>
              </div>
            </div>
            <Microscope className="w-4 h-4 text-amber-400/80" />
          </div>
          {renderStageBar(stage3, false)}
        </div>

        {/* Stage 4: Miner */}
        <div className="bg-card border border-border/80 p-4 rounded-xl flex flex-col justify-start shadow-sm relative overflow-hidden group hover:border-primary/50 transition-all">
          <div className="flex items-center justify-between z-10 pb-2 border-b border-border/40">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 font-mono font-bold text-xs border border-rose-500/20">
                4
              </span>
              <div>
                <span className="text-xs font-bold text-foreground">Miner (Data Extraction &amp; Synthesis)</span>
                <p className="text-[9px] text-muted-foreground">Multi-variable JSON payload extraction per RQ</p>
              </div>
            </div>
            <Database className="w-4 h-4 text-rose-400/80" />
          </div>
          {(() => {
            const total = stage4.total || 0;
            if (total === 0) return <div className="text-[11px] text-muted-foreground italic py-3 text-center border border-dashed border-border/50 rounded-lg mt-2">No papers in miner queue</div>;
            const processed = stage4.included || 0;
            const unprocessed = stage4.unprocessed || 0;
            const procPct = Math.round((processed / total) * 100);
            const unprocPct = Math.max(0, 100 - procPct);
            
            const formatVariableKey = (key: string): string => {
              try {
                let formatted = key.replace(/^(locate_)?rq\d+([a-z_])?_/, '');
                formatted = formatted.replace(/^locate_/, '');
                if (!formatted) return key;
                return formatted
                  .split('_')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ');
              } catch (e) {
                return key;
              }
            };

            const notStatedMetrics = stage4.notStatedMetrics || {};
            const notStatedEntries = Object.entries(notStatedMetrics).sort((a, b) => (b[1] as number) - (a[1] as number));

            return (
              <div className="mt-2 space-y-2 z-10 relative">
                <div className="flex justify-between text-[10px] font-bold flex-wrap gap-y-1">
                  <span className="text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Extracted: {processed} ({procPct}%)
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Unprocessed: {unprocessed} ({unprocPct}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden flex bg-secondary/80 border border-border/40 shadow-inner">
                  <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${procPct}%` }} />
                  <div className="bg-muted h-full transition-all duration-500" style={{ width: `${unprocPct}%` }} />
                </div>
                {processed > 0 && notStatedEntries.length > 0 && (
                  <div className="mt-2.5 text-[9px] text-muted-foreground border-t border-border/50 pt-2">
                    <div className="font-bold text-[8px] uppercase tracking-wider mb-1.5 text-foreground flex items-center justify-between">
                      <span>Missing / Not Stated Variables</span>
                      <span className="text-rose-400 font-mono">{notStatedEntries.length} items</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[90px] overflow-y-auto pr-1">
                      {notStatedEntries.map(([key, count]: any) => {
                        const pct = Math.round((count / processed) * 100);
                        return (
                          <div key={key} className="flex justify-between items-center bg-secondary/40 px-2 py-1 rounded border border-border/40">
                            <span className="truncate max-w-[120px] font-medium" title={key}>{formatVariableKey(key)}</span>
                            <span className="font-mono text-rose-500 font-bold">{count} ({pct}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
