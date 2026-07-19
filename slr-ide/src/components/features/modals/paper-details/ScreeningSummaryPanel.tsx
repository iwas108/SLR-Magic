import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import JSONViewer from '@/components/ui/JSONViewer';

interface ScreeningSummaryPanelProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  colorTheme: 'blue' | 'amber';
  stage: number;
  decision: string | null;
  exclusionCode?: string | null;
  rationale: string | null;
  qualityAssessment: string | null; // JSON string
  extractedData: string | null; // JSON string
}

export default function ScreeningSummaryPanel({
  title,
  icon: Icon,
  colorTheme,
  stage,
  decision,
  exclusionCode,
  rationale,
  qualityAssessment,
  extractedData
}: ScreeningSummaryPanelProps) {
  const [qaExpanded, setQaExpanded] = useState(false);
  const [extExpanded, setExtExpanded] = useState(false);

  const getStageLabel = (s: number) => {
    if (s === 1) return 'Fast Filter';
    if (s === 2) return 'Gatekeeper';
    if (s === 3) return 'Scientist';
    if (s === 4) return 'Miner';
    return 'Initial / Unscreened';
  };

  const rawDec = (decision || '').toUpperCase();
  const isExcluded = rawDec.startsWith('EXCLUDE');

  // Both LLM and Manual pipelines write the literal completed stage number (N) regardless of decision.
  // A stage of 0 means the paper is Initial / Unscreened.
  const displayStage = stage || 0;

  const badgeText = displayStage > 0
    ? `Stage ${displayStage}: ${getStageLabel(displayStage)}`
    : 'Initial / Unscreened';

  const decisionText = isExcluded ? 'EXCLUDE' : (rawDec || 'UNSCREENED');
  
  const ecTrigger = isExcluded ? (exclusionCode || '') : '';

  // Parse JSON data safely
  let parsedQA: any = null;
  if (qualityAssessment) {
    try {
      parsedQA = typeof qualityAssessment === 'string' ? JSON.parse(qualityAssessment) : qualityAssessment;
    } catch (e) {
      console.error('Error parsing quality assessment JSON:', e);
    }
  }

  let parsedExt: any = null;
  if (extractedData) {
    try {
      parsedExt = typeof extractedData === 'string' ? JSON.parse(extractedData) : extractedData;
    } catch (e) {
      console.error('Error parsing extracted data JSON:', e);
    }
  }

  const themeClasses = colorTheme === 'blue' 
    ? {
        border: 'border-blue-500/20',
        bg: 'bg-blue-500/5',
        titleText: 'text-blue-400',
        badge: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
        headerBg: 'bg-blue-500/10 border-blue-500/20'
      }
    : {
        border: 'border-amber-500/20',
        bg: 'bg-amber-500/5',
        titleText: 'text-amber-400',
        badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
        headerBg: 'bg-amber-500/10 border-amber-500/20'
      };

  return (
    <div className={`rounded-xl border ${themeClasses.border} ${themeClasses.bg} overflow-hidden shadow-sm flex flex-col h-full`}>
      {/* Panel Header */}
      <div className={`px-4 py-3 border-b ${themeClasses.headerBg} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-foreground/80" />
          <span className="text-xs font-extrabold uppercase tracking-wider text-foreground">{title}</span>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border ${themeClasses.badge}`}>
          {badgeText}
        </span>
      </div>

      {/* Panel Body */}
      <div className="p-4 flex-1 flex flex-col gap-4">
        {/* Decision & Trigger Row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase font-bold text-muted-foreground w-20">Decision</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
            decisionText === 'INCLUDE' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
            decisionText === 'EXCLUDE' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
            'bg-secondary border-border text-muted-foreground'
          }`}>
            {decisionText}
          </span>
          {ecTrigger && (
            <span className="px-1.5 py-0.5 bg-background border border-border text-muted-foreground rounded text-[9px] font-bold uppercase" title="Exclusion Criterion Trigger">
              Trigger: {ecTrigger}
            </span>
          )}
        </div>

        {/* Rationale Section */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground">Rationale</span>
          <div className="text-xs text-foreground/90 leading-relaxed bg-background/50 border border-border/30 rounded-lg p-3 whitespace-pre-wrap font-medium shadow-inner min-h-[60px]">
            {rationale || <span className="italic text-muted-foreground/50">No rationale provided.</span>}
          </div>
        </div>

        {/* Quality Assessment Collapsible Viewer */}
        {parsedQA && (
          <div className="border border-border/40 rounded-lg overflow-hidden bg-background/30">
            <button
              type="button"
              onClick={() => setQaExpanded(!qaExpanded)}
              className="w-full flex items-center justify-between p-2.5 hover:bg-secondary/40 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                {qaExpanded ? <ChevronDown className="w-3.5 h-3.5 text-primary" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                <span className="font-bold text-[10px] uppercase text-foreground/80 tracking-wide">Quality Appraisal Data</span>
              </div>
              <span className="text-[9px] text-muted-foreground font-mono bg-background border border-border px-1.5 py-0.5 rounded">
                JSON
              </span>
            </button>
            {qaExpanded && (
              <div className="p-3 border-t border-border/40 bg-background/55 text-xs max-h-[250px] overflow-y-auto">
                <JSONViewer data={parsedQA} />
              </div>
            )}
          </div>
        )}

        {/* Extracted Data Collapsible Viewer */}
        {parsedExt && (
          <div className="border border-border/40 rounded-lg overflow-hidden bg-background/30">
            <button
              type="button"
              onClick={() => setExtExpanded(!extExpanded)}
              className="w-full flex items-center justify-between p-2.5 hover:bg-secondary/40 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                {extExpanded ? <ChevronDown className="w-3.5 h-3.5 text-primary" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                <span className="font-bold text-[10px] uppercase text-foreground/80 tracking-wide">Extracted Variables</span>
              </div>
              <span className="text-[9px] text-muted-foreground font-mono bg-background border border-border px-1.5 py-0.5 rounded">
                JSON
              </span>
            </button>
            {extExpanded && (
              <div className="p-3 border-t border-border/40 bg-background/55 text-xs max-h-[250px] overflow-y-auto">
                <JSONViewer data={parsedExt} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
