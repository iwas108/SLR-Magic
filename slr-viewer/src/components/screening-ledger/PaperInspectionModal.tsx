import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Clock,
  Coins,
  Cpu,
  UserCheck,
  Sparkles,
  FileText,
  Layers,
  Database,
  BookOpen,
  Calendar,
  Share2,
  GitCommit
} from 'lucide-react';
import { ScreenedCorpusPaper, ScreeningHistoryRecord } from '@/types';

export interface PaperInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  paper: ScreenedCorpusPaper | null;
  onNavigate?: (direction: 'prev' | 'next') => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  currentIndex?: number;
  totalPapers?: number;
  ecRules?: Array<{ code: string; description: string }>;
}

export default function PaperInspectionModal({
  isOpen,
  onClose,
  paper,
  onNavigate,
  hasPrev = false,
  hasNext = false,
  currentIndex = 0,
  totalPapers = 0,
  ecRules = []
}: PaperInspectionModalProps) {
  const [activeTab, setActiveTab] = useState<'screening' | 'abstract' | 'evaluation'>('screening');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Keyboard navigation listeners (Escape to close, Left/Right arrows to navigate)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrev && onNavigate) {
        onNavigate('prev');
      } else if (e.key === 'ArrowRight' && hasNext && onNavigate) {
        onNavigate('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasPrev, hasNext, onNavigate, onClose]);

  // Build exclusion criteria code-to-description map
  const ecMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (Array.isArray(ecRules)) {
      ecRules.forEach(r => {
        if (r.code) {
          map[r.code.trim().toUpperCase()] = r.description || '';
        }
      });
    }
    return map;
  }, [ecRules]);

  const handleCopy = useCallback((text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  if (!isOpen || !paper) return null;

  const effectiveStage = Number(paper.effective_stage ?? Math.max(Number(paper.manual_stage || 0), Number(paper.ai_stage || 0)));
  const rawDec = (paper.effective_decision || (paper.manual_stage && paper.manual_stage >= (paper.ai_stage || 0) ? paper.manual_decision : paper.ai_decision) || '').toUpperCase();
  const isIncluded = rawDec.startsWith('INCLUDE');
  const isExcluded = rawDec.startsWith('EXCLUDE');
  const isPdfInaccessible = (paper.Local_PDF_Status || '').toUpperCase() === 'INACCESSIBLE';
  const isDuplicate = paper.is_duplicate === 1 || paper.prisma_phase === 'DUPLICATE_REMOVED';
  const isUnretrieved = (effectiveStage === 1 && isIncluded && isPdfInaccessible) || paper.prisma_phase === 'RETRIEVAL_INACCESSIBLE';
  const isFinalIncluded = ((effectiveStage >= 4 || (effectiveStage >= 3 && !isPdfInaccessible)) && isIncluded) || paper.prisma_phase === 'FINAL_INCLUDED';
  const isUnscreened = !rawDec || rawDec === 'UNSCREENED' || rawDec === 'PENDING';
  const effectiveEc = (paper.effective_exclusion_code || (paper.manual_stage && paper.manual_stage >= (paper.ai_stage || 0) ? paper.manual_exclusion_code : paper.ai_exclusion_code) || '').trim().toUpperCase();

  const ecDescription = effectiveEc ? ecMap[effectiveEc] || null : null;

  const stageNames = ['Initial Ingestion', 'Fast Filter', 'Gatekeeper', 'Scientist (QA)', 'Miner (Extraction)'];

  // Calculate per-stage status for the visual stepper (strictly following PRISMA 2020)
  const getStageStatus = (stageNum: number): 'passed' | 'excluded' | 'in_progress' | 'skipped' | 'unscreened' => {
    if (isDuplicate) return 'skipped';
    if (effectiveStage === 0) return stageNum === 1 ? 'unscreened' : 'skipped';

    // Step 1.5: PDF Retrieval Gate
    if (stageNum === 1.5) {
      if (isUnretrieved) return 'excluded';
      if (effectiveStage > 1 || isFinalIncluded) return 'passed';
      if (effectiveStage === 1 && isExcluded) return 'skipped';
      return 'skipped';
    }

    if (effectiveStage < stageNum) return 'skipped';
    if (effectiveStage === stageNum) {
      if (isExcluded) return 'excluded';
      if (isIncluded) {
        if (stageNum === 1 && isPdfInaccessible) return 'passed';
        return 'passed';
      }
      return 'in_progress';
    }
    // effectiveStage > stageNum: passed earlier stage
    return 'passed';
  };

  const screeningHistory: ScreeningHistoryRecord[] = Array.isArray(paper.screening_history) ? paper.screening_history : [];

  const hasEvaluationData = Boolean(
    paper.ai_quality_assessment ||
    paper.manual_quality_assessment ||
    paper.ai_extracted_data ||
    paper.manual_extracted_data
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-150">
      <div 
        className="bg-card border border-border rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header Bar */}
        <div className="px-6 py-4 border-b border-border bg-secondary/40 flex items-start justify-between shrink-0 gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-mono text-xs font-bold text-primary bg-primary/10 border border-primary/25 px-2.5 py-0.5 rounded-md shadow-xs">
                {paper.Paper_ID}
              </span>

              {/* Effective Decision Badge */}
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-black uppercase tracking-wider border inline-flex items-center gap-1.5 shadow-xs ${
                isDuplicate
                  ? 'bg-orange-500/15 border-orange-500/30 text-orange-800 dark:text-orange-300'
                  : isUnretrieved
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-900 dark:text-amber-300'
                  : isFinalIncluded
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-900 dark:text-emerald-300'
                  : isIncluded
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-900 dark:text-emerald-300'
                  : isExcluded
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-800 dark:text-rose-300'
                  : 'bg-slate-500/15 border-slate-500/30 text-slate-800 dark:text-slate-300'
              }`}>
                {isDuplicate ? (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Pre-Screening: Duplicate Purged</span>
                  </>
                ) : isUnretrieved ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Stage 1 Include • PDF Inaccessible (Unretrieved)</span>
                  </>
                ) : (
                  <>
                    {isIncluded && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {isExcluded && <XCircle className="w-3.5 h-3.5" />}
                    {isUnscreened && <HelpCircle className="w-3.5 h-3.5" />}
                    <span>
                      {effectiveStage > 0 ? `Stage ${effectiveStage}: ` : ''}
                      {isFinalIncluded ? 'FINAL INCLUDED' : isIncluded ? 'INCLUDE' : isExcluded ? 'EXCLUDE' : 'UNSCREENED'}
                    </span>
                  </>
                )}
              </span>

              {/* Exclusion Code Pill */}
              {effectiveEc && isExcluded && (
                <span className="px-2 py-0.5 rounded-md bg-rose-500/15 dark:bg-rose-500/25 border border-rose-500/30 text-rose-900 dark:text-rose-200 font-mono text-[11px] font-black shadow-xs">
                  {effectiveEc}
                </span>
              )}

              {/* Manual Override Indicator */}
              {paper.is_manual_override && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-300 text-[10px] font-extrabold uppercase inline-flex items-center gap-1 shadow-xs">
                  <UserCheck className="w-3 h-3" />
                  Human Override
                </span>
              )}

              {/* Duplicate Flag */}
              {isDuplicate && (
                <span className="px-2 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/30 text-orange-900 dark:text-orange-300 text-[10px] font-extrabold uppercase inline-flex items-center gap-1 shadow-xs">
                  Duplicate
                </span>
              )}

              {/* Local PDF Status */}
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border shadow-xs ${
                paper.Local_PDF_Status === 'SYNCED' ? 'bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/25 text-emerald-900 dark:text-emerald-300' :
                paper.Local_PDF_Status === 'DOWNLOADED' || paper.Local_PDF_Status === 'MATCHED' ? 'bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/25 text-amber-900 dark:text-amber-300' :
                paper.Local_PDF_Status === 'INACCESSIBLE' ? 'bg-rose-500/10 dark:bg-rose-500/20 border-rose-500/25 text-rose-800 dark:text-rose-300' :
                paper.Local_PDF_Status === 'MISSING' ? 'bg-destructive/10 border-destructive/25 text-destructive font-black' :
                'bg-secondary border-border text-foreground/80'
              }`}>
                PDF: {paper.Local_PDF_Status || 'UNKNOWN'}
              </span>

              {paper.calibration_pool && (
                <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 dark:bg-cyan-500/20 border border-cyan-500/25 text-cyan-800 dark:text-cyan-400 font-extrabold text-[10px] uppercase shadow-xs">
                  {paper.calibration_pool === 'pool_a' ? 'Pool A (Fast Filter)' :
                   paper.calibration_pool === 'pool_b' ? 'Pool B (Gatekeeper)' :
                   paper.calibration_pool === 'pool_c' ? 'Pool C (Scientist/Miner)' : paper.calibration_pool}
                </span>
              )}
            </div>

            <h2 className="text-base md:text-lg lg:text-xl font-extrabold text-foreground leading-snug tracking-tight select-text">
              {paper.Title || 'Untitled Paper'}
            </h2>
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-2 flex-wrap font-medium">
              <span className="text-foreground/80 dark:text-foreground/75 font-semibold">{paper.Authors || 'Unknown Authors'}</span>
              <span>•</span>
              <span className="font-bold text-foreground bg-secondary/80 px-1.5 py-0.5 rounded border border-border/60 text-[11px]">{paper.Year || 'No Year'}</span>
              {paper.Source && (
                <>
                  <span>•</span>
                  <span className="font-semibold text-primary">{paper.Source}</span>
                </>
              )}
              {paper.DOI && (
                <>
                  <span>•</span>
                  <span className="font-mono text-[11px] text-muted-foreground select-text truncate max-w-xs">{paper.DOI}</span>
                </>
              )}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer border border-transparent hover:border-border"
            title="Close modal (Escape)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tab Bar */}
        <div className="px-6 border-b border-border bg-card flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6">
            {[
              { id: 'screening', label: 'Screening & Decision Audit', icon: Layers },
              { id: 'abstract', label: 'Abstract & Metadata', icon: FileText },
              ...(hasEvaluationData ? [{ id: 'evaluation', label: 'Quality & Extracted Data', icon: Database }] : []),
            ].map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-3 px-1 border-b-2 text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'border-primary text-primary font-black'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  <TabIcon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Copy BibTeX Citation Button */}
          <button
            onClick={() => {
              const bib = `@article{${paper.Paper_ID},\n  title={${paper.Title || ''}},\n  author={${paper.Authors || ''}},\n  year={${paper.Year || ''}},\n  doi={${paper.DOI || ''}}\n}`;
              handleCopy(bib, 'bibtex');
            }}
            className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary rounded-md border border-border transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Copy formatted BibTeX citation"
          >
            {copiedField === 'bibtex' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            <span>{copiedField === 'bibtex' ? 'Copied BibTeX' : 'Copy BibTeX'}</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: SCREENING & DECISION AUDIT */}
          {activeTab === 'screening' && (
            <div className="space-y-6">
              {/* 1. Visual Stage Stepper Flowchart */}
              <div className="bg-secondary/30 dark:bg-secondary/20 border border-border rounded-xl p-4.5 shadow-xs">
                <div className="text-[10.5px] font-black uppercase tracking-wider text-muted-foreground mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    <span>SLR Multi-Stage Screening Trajectory</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono uppercase bg-primary/10 text-primary border border-primary/25 shadow-xs">
                    {effectiveStage > 0 ? `Stopped at Stage ${effectiveStage}: ${stageNames[effectiveStage]}` : 'Initial / Unscreened'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                  {[
                    { stage: 1, name: 'Stage 1: Fast Filter', desc: 'Title & Abstract' },
                    { stage: 1.5, name: 'PDF Retrieval Gate', desc: 'Full-Text Acquisition' },
                    { stage: 2, name: 'Stage 2: Gatekeeper', desc: 'Full-Text Boundary' },
                    { stage: 3, name: 'Stage 3: Scientist', desc: 'Quality Appraisal' },
                    { stage: 4, name: 'Stage 4: Miner', desc: 'Data Extraction' },
                  ].map(step => {
                    const status = getStageStatus(step.stage);
                    return (
                      <div
                        key={step.stage}
                        className={`rounded-xl p-3 border transition-all flex flex-col justify-between shadow-xs ${
                          status === 'passed'
                            ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/30 dark:border-emerald-500/40 text-emerald-950 dark:text-emerald-100'
                            : status === 'excluded'
                            ? step.stage === 1.5
                              ? 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/30 dark:border-amber-500/40 text-amber-950 dark:text-amber-100'
                              : 'bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/30 dark:border-rose-500/40 text-rose-950 dark:text-rose-100'
                            : status === 'in_progress'
                            ? 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/30 text-amber-950 dark:text-amber-100'
                            : 'bg-card/70 dark:bg-secondary/30 border-border/80 text-foreground/80 dark:text-foreground/75'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-black tracking-tight ${
                            status === 'passed' ? 'text-emerald-950 dark:text-emerald-200' :
                            status === 'excluded' ? (step.stage === 1.5 ? 'text-amber-950 dark:text-amber-200' : 'text-rose-950 dark:text-rose-200') :
                            status === 'in_progress' ? 'text-amber-950 dark:text-amber-200' :
                            'text-foreground/85 dark:text-foreground/75'
                          }`}>
                            {step.name}
                          </span>
                          {status === 'passed' && <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />}
                          {status === 'excluded' && (step.stage === 1.5 ? <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-700 dark:text-rose-400 shrink-0" />)}
                          {status === 'in_progress' && <Clock className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />}
                          {status === 'skipped' && <span className="text-[9.5px] italic text-muted-foreground font-semibold">Skipped</span>}
                          {status === 'unscreened' && <HelpCircle className="w-4 h-4 text-muted-foreground shrink-0" />}
                        </div>
                        <div className={`text-[10.5px] font-semibold leading-tight ${
                          status === 'passed' ? 'text-emerald-900 dark:text-emerald-300' :
                          status === 'excluded' ? (step.stage === 1.5 ? 'text-amber-900 dark:text-amber-300' : 'text-rose-900 dark:text-rose-300') :
                          'text-muted-foreground font-medium'
                        }`}>
                          {step.desc}
                        </div>
                        <div className={`mt-2.5 pt-1.5 border-t text-[9.5px] font-black uppercase tracking-wider ${
                          status === 'passed' ? 'border-emerald-500/25 text-emerald-900 dark:text-emerald-300' :
                          status === 'excluded' ? (step.stage === 1.5 ? 'border-amber-500/25 text-amber-900 dark:text-amber-300' : 'border-rose-500/25 text-rose-800 dark:text-rose-300') :
                          status === 'in_progress' ? 'border-amber-500/25 text-amber-900 dark:text-amber-300' :
                          'border-border/60 text-muted-foreground font-bold'
                        }`}>
                          {status === 'passed' && (step.stage === 1.5 ? 'PDF Acquired' : 'Passed Stage')}
                          {status === 'excluded' && (step.stage === 1.5 ? 'PDF Inaccessible' : 'Excluded Here')}
                          {status === 'in_progress' && 'In Progress'}
                          {status === 'skipped' && 'Not Reached'}
                          {status === 'unscreened' && 'Unscreened'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 1.5 Special PRISMA Retrieval / Duplicate Notice Callouts */}
              {isUnretrieved && (
                <div className="bg-amber-500/10 dark:bg-amber-500/15 border-2 border-amber-500/30 dark:border-amber-500/40 rounded-xl p-4.5 shadow-xs space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-black uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                    <span>PRISMA Phase 2b: Report Not Retrieved</span>
                  </div>
                  <p className="text-amber-950 dark:text-amber-100 leading-relaxed font-semibold">
                    This study satisfied Stage 1 Fast Filter criteria based on Title and Abstract. However, during full-text PDF acquisition, the document was marked as <strong className="font-black underline">INACCESSIBLE</strong> (e.g. behind an unretrievable institutional paywall or restricted repository). In accordance with PRISMA 2020 guidelines, it is categorized under <em>Reports not retrieved</em> (n = 36) and was not assessed for Stage 2 eligibility.
                  </p>
                </div>
              )}

              {isDuplicate && (
                <div className="bg-orange-500/10 dark:bg-orange-500/15 border-2 border-orange-500/30 dark:border-orange-500/40 rounded-xl p-4.5 shadow-xs space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-orange-900 dark:text-orange-300 font-black uppercase tracking-wider">
                    <Copy className="w-4 h-4 text-orange-700 dark:text-orange-400 shrink-0" />
                    <span>PRISMA Phase 1: Duplicate Record Purged</span>
                  </div>
                  <p className="text-orange-950 dark:text-orange-100 leading-relaxed font-semibold">
                    This record was identified as a duplicate during automated pre-screening deduplication and purged before systematic review screening.
                  </p>
                </div>
              )}

              {/* 2. Exclusion Criterion Card (if excluded) */}
              {isExcluded && effectiveEc && (
                <div className="bg-rose-500/10 dark:bg-rose-500/15 border-2 border-rose-500/30 dark:border-rose-500/40 rounded-xl p-4.5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-black text-xs uppercase tracking-wider">
                      <AlertTriangle className="w-4 h-4 text-rose-700 dark:text-rose-400 shrink-0" />
                      <span>Triggered Exclusion Criterion</span>
                    </div>
                    <span className="font-mono text-xs font-black bg-rose-500/20 text-rose-900 dark:text-rose-200 px-2.5 py-0.5 rounded-md border border-rose-500/30 shadow-xs">
                      {effectiveEc}
                    </span>
                  </div>

                  {ecDescription ? (
                    <p className="text-sm font-semibold text-rose-950 dark:text-rose-100 leading-relaxed bg-rose-500/15 dark:bg-rose-500/20 p-3.5 rounded-lg border border-rose-500/25 dark:border-rose-500/35 select-text shadow-xs">
                      {ecDescription}
                    </p>
                  ) : (
                    <p className="text-xs text-rose-900 dark:text-rose-300 italic font-semibold">
                      Exclusion rule code: <span className="font-mono font-bold">{effectiveEc}</span>
                    </p>
                  )}
                </div>
              )}

              {/* 3. AI Screening Decision & Rationale Card */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                      AI Screening Rationale (Stage {paper.ai_stage || 0})
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border shadow-xs ${
                      (paper.ai_decision || '').toUpperCase().startsWith('INCLUDE')
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-900 dark:text-emerald-300'
                        : (paper.ai_decision || '').toUpperCase().startsWith('EXCLUDE')
                        ? 'bg-rose-500/15 border-rose-500/30 text-rose-800 dark:text-rose-300'
                        : 'bg-secondary border-border text-foreground/80'
                    }`}>
                      AI Decision: {paper.ai_decision || 'Unscreened'}
                    </span>
                    {paper.ai_exclusion_code && (
                      <span className="font-mono text-[10px] font-black text-rose-900 dark:text-rose-200 bg-rose-500/15 dark:bg-rose-500/25 px-2 py-0.5 rounded-md border border-rose-500/30 shadow-xs">
                        {paper.ai_exclusion_code}
                      </span>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <div className="text-[13px] text-foreground leading-relaxed bg-secondary/40 dark:bg-secondary/30 border border-border/80 rounded-xl p-4 whitespace-pre-wrap font-sans min-h-[80px] select-text font-medium">
                    {paper.ai_rationale || (
                      <span className="italic text-muted-foreground font-normal">No automated AI rationale provided for this record.</span>
                    )}
                  </div>
                  {paper.ai_rationale && (
                    <button
                      onClick={() => handleCopy(paper.ai_rationale || '', 'ai_rationale')}
                      className="absolute top-2.5 right-2.5 p-1.5 bg-card/90 hover:bg-card border border-border rounded-lg text-muted-foreground hover:text-foreground text-[10px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer shadow-xs"
                      title="Copy AI rationale text"
                    >
                      {copiedField === 'ai_rationale' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>

              {/* 4. Human Reviewer Decision & Override Card (if recorded) */}
              {(paper.manual_stage !== undefined && paper.manual_stage > 0 || paper.manual_decision) && (
                <div className="bg-amber-500/10 dark:bg-amber-500/15 border-2 border-amber-500/30 dark:border-amber-500/40 rounded-xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-500/25 pb-3">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-300">
                        Human Reviewer Evaluation (Stage {paper.manual_stage || 0})
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border shadow-xs ${
                        (paper.manual_decision || '').toUpperCase().startsWith('INCLUDE')
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-900 dark:text-emerald-300'
                          : (paper.manual_decision || '').toUpperCase().startsWith('EXCLUDE')
                          ? 'bg-rose-500/15 border-rose-500/30 text-rose-800 dark:text-rose-300'
                          : 'bg-secondary border-border text-foreground/80'
                      }`}>
                        Manual Decision: {paper.manual_decision || 'None'}
                      </span>
                      {paper.manual_exclusion_code && (
                        <span className="font-mono text-[10px] font-black text-amber-900 dark:text-amber-200 bg-amber-500/15 dark:bg-amber-500/25 px-2 py-0.5 rounded-md border border-amber-500/30 shadow-xs">
                          {paper.manual_exclusion_code}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-[13px] text-amber-950 dark:text-amber-100 leading-relaxed bg-amber-500/15 dark:bg-amber-500/20 border border-amber-500/25 rounded-xl p-4 whitespace-pre-wrap font-sans select-text">
                    {paper.manual_rationale || (
                      <span className="italic text-muted-foreground/70">No manual rationale provided by the reviewer.</span>
                    )}
                  </div>
                </div>
              )}

              {/* 5. Multi-Stage Screening History Log Timeline */}
              {screeningHistory.length > 0 && (
                <div className="bg-secondary/30 dark:bg-secondary/20 border border-border rounded-xl p-5 space-y-3.5 shadow-xs">
                  <div className="flex items-center justify-between border-b border-border pb-2.5">
                    <div className="flex items-center gap-2">
                      <GitCommit className="w-4 h-4 text-primary" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                        Multi-Stage Screening Audit Log ({screeningHistory.length} Runs)
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {screeningHistory.map((rec, idx) => (
                      <div key={idx} className="bg-card border border-border rounded-xl p-4 text-xs space-y-2.5 shadow-xs">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-foreground">
                              Stage {rec.stage}: {stageNames[rec.stage] || rec.task_type || 'Screening'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border shadow-xs ${
                              (rec.decision || '').toUpperCase().startsWith('INCLUDE')
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-400'
                                : 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-400'
                            }`}>
                              {rec.decision}
                            </span>
                            {rec.exclusion_code && (
                              <span className="font-mono text-[9.5px] font-black text-rose-800 dark:text-rose-300 bg-rose-500/15 dark:bg-rose-500/25 px-1.5 py-0.5 rounded border border-rose-500/25">
                                {rec.exclusion_code}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono font-medium">
                            {rec.model_id && <span className="bg-secondary px-1.5 py-0.5 rounded border border-border/50">Model: {rec.model_id}</span>}
                            {rec.total_tokens !== undefined && rec.total_tokens !== null && (
                              <span>Tokens: <strong className="text-foreground">{rec.total_tokens.toLocaleString()}</strong></span>
                            )}
                            {rec.latency_ms !== undefined && rec.latency_ms !== null && (
                              <span>Latency: <strong className="text-foreground">{rec.latency_ms}ms</strong></span>
                            )}
                            {rec.cost_usd !== undefined && rec.cost_usd !== null && (
                              <span>Cost: <strong className="text-foreground">${Number(rec.cost_usd).toFixed(4)}</strong></span>
                            )}
                          </div>
                        </div>

                        {rec.rationale && (
                          <p className="text-foreground/90 dark:text-foreground/80 bg-secondary/40 p-3 rounded-lg border border-border/60 font-sans leading-relaxed text-xs select-text">
                            {rec.rationale}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ABSTRACT & BIBLIOGRAPHIC METADATA */}
          {activeTab === 'abstract' && (
            <div className="space-y-6">
              {/* Paper Abstract */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                      Full Paper Abstract
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-muted-foreground font-semibold bg-secondary px-2 py-0.5 rounded border border-border/60">
                      {paper.Abstract ? `${paper.Abstract.trim().split(/\s+/).length} words` : '0 words'}
                    </span>
                    {paper.Abstract && (
                      <button
                        onClick={() => handleCopy(paper.Abstract, 'abstract')}
                        className="p-1 px-2.5 bg-secondary hover:bg-secondary/80 text-foreground text-[11px] font-bold rounded-md border border-border transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                        title="Copy abstract text"
                      >
                        {copiedField === 'abstract' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedField === 'abstract' ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-[13px] text-foreground leading-relaxed font-sans bg-secondary/30 dark:bg-secondary/20 p-4.5 rounded-xl border border-border/70 max-h-[380px] overflow-y-auto whitespace-pre-wrap select-text">
                  {paper.Abstract || (
                    <span className="italic text-muted-foreground/60">No abstract available for this paper.</span>
                  )}
                </div>
              </div>

              {/* Bibliographic Metadata Grid */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <Database className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                    Bibliographic Details & Ingestion Provenance
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 bg-secondary/30 dark:bg-secondary/20 rounded-lg border border-border/50 space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-muted-foreground block tracking-wider">Digital Object Identifier (DOI)</span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-foreground font-medium select-text truncate">
                        {paper.DOI || '—'}
                      </span>
                      {paper.DOI && (
                        <a
                          href={`https://doi.org/${encodeURIComponent(paper.DOI.trim())}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline font-bold inline-flex items-center gap-1 shrink-0 text-xs"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Resolve</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 bg-secondary/30 dark:bg-secondary/20 rounded-lg border border-border/50 space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-muted-foreground block tracking-wider">Publisher / Journal</span>
                    <span className="text-foreground font-semibold select-text block truncate">
                      {paper.Publisher || paper.Original_Publisher || '—'}
                    </span>
                  </div>

                  <div className="p-3.5 bg-secondary/30 dark:bg-secondary/20 rounded-lg border border-border/50 space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-muted-foreground block tracking-wider">Primary Database Source</span>
                    <span className="text-foreground font-semibold select-text block truncate">
                      {paper.Source || '—'}
                    </span>
                  </div>

                  <div className="p-3.5 bg-secondary/30 dark:bg-secondary/20 rounded-lg border border-border/50 space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-muted-foreground block tracking-wider">Ingestion Source & Date</span>
                    <span className="text-foreground font-semibold select-text block truncate">
                      {paper.Import_Source || 'Direct Ingestion'} {paper.Import_Date ? `(${new Date(paper.Import_Date).toLocaleDateString()})` : ''}
                    </span>
                  </div>

                  <div className="p-3.5 bg-secondary/30 dark:bg-secondary/20 rounded-lg border border-border/50 space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-muted-foreground block tracking-wider">Citations & Search Ranking</span>
                    <span className="text-foreground font-medium select-text block">
                      Citations: <strong className="font-mono text-foreground">{paper.citation_count ?? 0}</strong> • Search Rank: <strong className="font-mono text-foreground">{paper.search_rank || '—'}</strong>
                    </span>
                  </div>

                  <div className="p-3.5 bg-secondary/30 dark:bg-secondary/20 rounded-lg border border-border/50 space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-muted-foreground block tracking-wider">Full-Text PDF Storage</span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-foreground font-semibold select-text truncate">
                        Status: <strong className="text-foreground">{paper.Local_PDF_Status}</strong>
                      </span>
                      {paper.PDF_Link && (
                        <a
                          href={paper.PDF_Link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline font-bold inline-flex items-center gap-1 shrink-0 text-xs"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>PDF</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Duplicate Details (if duplicate) */}
                {paper.is_duplicate === 1 && (
                  <div className="p-4 bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/30 rounded-xl text-xs space-y-1.5 shadow-xs">
                    <div className="font-extrabold text-orange-800 dark:text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Deduplication Merge Details</span>
                    </div>
                    <p className="text-orange-950 dark:text-orange-100 text-xs leading-relaxed font-medium">
                      This paper was classified as a duplicate. It was merged into primary paper{' '}
                      <strong className="font-mono text-foreground font-bold">{paper.merged_into_id || paper.Parent_Paper_ID || 'Unknown Parent'}</strong>
                      {paper.Parent_Paper_Title ? ` ("${paper.Parent_Paper_Title}")` : ''}.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: QUALITY APPRAISAL & EXTRACTION DATA (STAGE 3/4) */}
          {activeTab === 'evaluation' && hasEvaluationData && (
            <div className="space-y-6">
              {/* Quality Appraisal Scores */}
              {(paper.ai_quality_assessment || paper.manual_quality_assessment) && (
                <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 border-b border-border pb-3">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                      Stage 3 Scientist: Quality Appraisal Scores
                    </h3>
                  </div>

                  <div className="bg-secondary/30 dark:bg-secondary/20 p-4 rounded-xl border border-border/60 font-mono text-xs max-h-60 overflow-y-auto select-text text-foreground/90">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(paper.manual_quality_assessment || paper.ai_quality_assessment, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Miner Extracted Data */}
              {(paper.ai_extracted_data || paper.manual_extracted_data) && (
                <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 border-b border-border pb-3">
                    <Database className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                      Stage 4 Miner: Extracted Literature Variables
                    </h3>
                  </div>

                  <div className="bg-secondary/30 dark:bg-secondary/20 p-4 rounded-xl border border-border/60 font-mono text-xs max-h-60 overflow-y-auto select-text text-foreground/90">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(paper.manual_extracted_data || paper.ai_extracted_data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Bar with Quick Previous / Next Navigation */}
        <div className="px-6 py-3.5 border-t border-border bg-secondary/40 flex items-center justify-between shrink-0">
          <div className="text-xs text-muted-foreground font-semibold">
            {totalPapers > 0 ? (
              <span>
                Paper <strong className="text-foreground font-bold">{currentIndex + 1}</strong> of{' '}
                <strong className="text-foreground font-bold">{totalPapers}</strong> in current view
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            {onNavigate && (
              <div className="flex items-center gap-1 bg-secondary/80 border border-border rounded-lg p-0.5 shadow-xs">
                <button
                  disabled={!hasPrev}
                  onClick={() => onNavigate('prev')}
                  className="px-3 py-1.5 text-xs font-bold text-foreground hover:bg-card rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors flex items-center gap-1 cursor-pointer"
                  title="Previous paper (Left Arrow)"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Prev</span>
                </button>

                <div className="w-px h-4 bg-border my-auto" />

                <button
                  disabled={!hasNext}
                  onClick={() => onNavigate('next')}
                  className="px-3 py-1.5 text-xs font-bold text-foreground hover:bg-card rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors flex items-center gap-1 cursor-pointer"
                  title="Next paper (Right Arrow)"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="px-5 py-1.5 bg-primary text-primary-foreground font-extrabold text-xs rounded-lg hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
