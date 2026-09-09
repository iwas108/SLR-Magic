import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  CheckCircle2,
  AlertTriangle,
  GitCommit,
  Scale,
  Award,
  Hash,
  Clock,
  BookOpen
} from 'lucide-react';

export interface AdjudicationInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  discrepancy: any;
  poolOrBatchTitle?: string;
  stageName?: string;
  poolType: 'pool_a' | 'pool_b' | 'pool_c' | 'rolling_batch';
  qaRules?: any[];
  extractionRules?: any[];
  ecRules?: any[];
  discrepanciesList?: any[];
  onSelectDiscrepancy?: (item: any) => void;
  ledgerEntries?: any[];
}

export default function AdjudicationInspectionModal({
  isOpen,
  onClose,
  discrepancy,
  poolOrBatchTitle = 'Adjudication Review',
  stageName,
  poolType,
  qaRules = [],
  extractionRules = [],
  ecRules = [],
  discrepanciesList = [],
  onSelectDiscrepancy,
  ledgerEntries = []
}: AdjudicationInspectionModalProps) {
  const [activeTab, setActiveTab] = useState<'qa' | 'extraction'>('qa');

  // Keyboard navigation & close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && discrepanciesList.length > 1 && onSelectDiscrepancy) {
        const currentIndex = discrepanciesList.findIndex(d => d.paper_id === discrepancy?.paper_id);
        if (currentIndex > 0) {
          onSelectDiscrepancy(discrepanciesList[currentIndex - 1]);
        }
      } else if (e.key === 'ArrowRight' && discrepanciesList.length > 1 && onSelectDiscrepancy) {
        const currentIndex = discrepanciesList.findIndex(d => d.paper_id === discrepancy?.paper_id);
        if (currentIndex !== -1 && currentIndex < discrepanciesList.length - 1) {
          onSelectDiscrepancy(discrepanciesList[currentIndex + 1]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, discrepancy, discrepanciesList, onSelectDiscrepancy, onClose]);

  if (!isOpen || !discrepancy) return null;

  const currentIndex = discrepanciesList.findIndex(d => d.paper_id === discrepancy.paper_id);
  const totalCount = discrepanciesList.length;

  // Find commit ledger entry for this paper if available
  const matchingCommit = ledgerEntries.find(l => l.paper_id === discrepancy.paper_id) || null;

  // Parse QA scores and extraction payloads safely
  const parseJsonSafe = (raw: any) => {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  };

  const r1_qa = parseJsonSafe(discrepancy.r1_qa_scores);
  const r2_qa = parseJsonSafe(discrepancy.r2_qa_scores);
  const resolved_qa = parseJsonSafe(discrepancy.resolved_qa_scores || matchingCommit?.resolved_qa_scores);

  const r1_ext = parseJsonSafe(discrepancy.r1_extracted_data);
  const r2_ext = parseJsonSafe(discrepancy.r2_extracted_data);
  const resolved_ext = parseJsonSafe(discrepancy.resolved_extracted_data || matchingCommit?.resolved_extracted_data);

  // Helper to extract score and quote from QA object
  const getQaField = (qaObj: any, code: string) => {
    if (!qaObj || typeof qaObj !== 'object') return { value: null, evidence: '' };
    const cleanCode = code.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchKey = Object.keys(qaObj).find(k => {
      const kl = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      return kl === cleanCode || kl.startsWith(cleanCode);
    });
    const item = matchKey ? qaObj[matchKey] : undefined;
    if (item === undefined || item === null) return { value: null, evidence: '' };
    if (typeof item === 'object') {
      const val = item.value ?? item.score ?? item.val ?? null;
      const num = val !== null ? parseFloat(String(val)) : null;
      const ev = item.evidence ?? item.exact_quote ?? item.quote ?? '';
      return { value: !isNaN(num!) ? num : val, evidence: String(ev) };
    }
    const num = parseFloat(String(item));
    return { value: !isNaN(num) ? num : item, evidence: '' };
  };

  // Helper to extract value and quote from extraction object
  const getExtField = (extObj: any, jsonKey: string) => {
    if (!extObj || typeof extObj !== 'object') return { value: '', evidence: '' };
    const cleanKey = jsonKey.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchKey = Object.keys(extObj).find(k => {
      const kl = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      return kl === cleanKey || kl.startsWith(cleanKey);
    });
    const item = matchKey ? extObj[matchKey] : undefined;
    if (item === undefined || item === null) return { value: '', evidence: '' };
    if (typeof item === 'object') {
      let val = item.value ?? item.val ?? item.text ?? '';
      if (Array.isArray(val)) val = val.join(', ');
      const ev = item.evidence ?? item.quote ?? '';
      return { value: String(val), evidence: String(ev) };
    }
    if (Array.isArray(item)) return { value: item.join(', '), evidence: '' };
    return { value: String(item), evidence: '' };
  };

  // EC definition resolver
  const getEcLabel = (code?: string | null) => {
    if (!code) return null;
    const rule = ecRules.find((r: any) => String(r.code).toLowerCase() === String(code).toLowerCase());
    return rule?.description || rule?.label || null;
  };

  const isResolved = discrepancy.is_resolved !== false;
  const isPoolAB = poolType === 'pool_a' || poolType === 'pool_b';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-2xl w-full max-w-6xl h-[92vh] max-h-[950px] flex flex-col shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200 text-foreground">
        
        {/* Top Header Bar */}
        <div className="px-5 py-4 border-b border-border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-black text-xs sm:text-sm text-foreground select-all bg-secondary/80 px-2 py-0.5 rounded border border-border">
                  {discrepancy.paper_id}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                  {poolOrBatchTitle}
                </span>
                {stageName && (
                  <span className="text-[10px] font-semibold text-muted-foreground hidden md:inline-block">
                    • {stageName}
                  </span>
                )}
                {isResolved ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    Consensus Resolved
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                    <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    Pending Adjudication
                  </span>
                )}
              </div>
              <h3 className="font-extrabold text-xs sm:text-sm text-foreground truncate mt-0.5 max-w-xl" title={discrepancy.title}>
                {discrepancy.title}
              </h3>
            </div>
          </div>

          {/* Header Controls (Prev/Next navigation & close) */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {totalCount > 1 && onSelectDiscrepancy && (
              <div className="flex items-center gap-1 mr-2 bg-secondary p-1 rounded-xl border border-border">
                <button
                  type="button"
                  disabled={currentIndex <= 0}
                  onClick={() => onSelectDiscrepancy(discrepanciesList[currentIndex - 1])}
                  className="p-1.5 rounded-lg hover:bg-card text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Previous Paper (Left Arrow)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono font-bold px-2 text-foreground">
                  {currentIndex + 1} / {totalCount}
                </span>
                <button
                  type="button"
                  disabled={currentIndex >= totalCount - 1}
                  onClick={() => onSelectDiscrepancy(discrepanciesList[currentIndex + 1])}
                  className="p-1.5 rounded-lg hover:bg-card text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Next Paper (Right Arrow)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-secondary transition-colors cursor-pointer"
              title="Close Modal (Escape)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body: 2-Column Split */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          
          {/* Left Column (5/12): Paper Metadata & Abstract */}
          <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-border p-5 overflow-y-auto bg-muted/20 space-y-4">
            
            {/* Title & Bibliographic Data */}
            <div className="space-y-2">
              <h4 className="font-extrabold text-sm sm:text-base text-foreground leading-snug">
                {discrepancy.title}
              </h4>
              <p className="text-xs text-muted-foreground font-medium">
                {discrepancy.authors || 'Unknown Authors'}
              </p>
              
              <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                {discrepancy.year && (
                  <span className="font-mono font-bold bg-secondary px-2 py-0.5 rounded border border-border">
                    {discrepancy.year}
                  </span>
                )}
                {discrepancy.source && (
                  <span className="bg-secondary px-2 py-0.5 rounded border border-border text-muted-foreground">
                    {discrepancy.source}
                  </span>
                )}
                {discrepancy.publisher && (
                  <span className="bg-secondary px-2 py-0.5 rounded border border-border text-muted-foreground">
                    {discrepancy.publisher}
                  </span>
                )}
              </div>
            </div>

            {/* External Links Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {discrepancy.doi && (
                <a
                  href={`https://doi.org/${discrepancy.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold border border-border transition-colors cursor-pointer"
                  title="Open Published DOI Link"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-primary" />
                  <span className="truncate max-w-[200px]">doi.org/{discrepancy.doi}</span>
                </a>
              )}
              {discrepancy.pdf_link && (
                <a
                  href={discrepancy.pdf_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold border border-primary/20 transition-colors cursor-pointer"
                  title="Open Verified PDF Document"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Full-Text PDF</span>
                </a>
              )}
            </div>

            {/* Abstract Box */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <BookOpen className="w-3.5 h-3.5 text-primary" />
                <span>Abstract</span>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 text-xs text-foreground/90 leading-relaxed font-sans max-h-[350px] overflow-y-auto whitespace-pre-wrap select-text">
                {discrepancy.abstract || 'No abstract content available for this study.'}
              </div>
            </div>

            {/* Cryptographic Commit Stamp (if resolved) */}
            {(matchingCommit || discrepancy.resolved_decision) && (
              <div className="p-3.5 rounded-xl bg-card border border-border space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-muted-foreground flex items-center gap-1">
                    <GitCommit className="w-3.5 h-3.5 text-primary" />
                    Commit Hash
                  </span>
                  <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                    {matchingCommit?.commit_hash || 'ADJUDICATED'}
                  </span>
                </div>
                {matchingCommit?.timestamp && (
                  <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Committed
                    </span>
                    <span>{new Date(matchingCommit.timestamp).toLocaleString()}</span>
                  </div>
                )}
                {matchingCommit?.commit_message && (
                  <p className="italic text-foreground/80 pt-1 border-t border-border/50">
                    "{matchingCommit.commit_message}"
                  </p>
                )}
              </div>
            )}

          </div>

          {/* Right Column (7/12): Adjudication Workspace Breakdown */}
          <div className="lg:col-span-7 p-5 overflow-y-auto bg-background space-y-6 flex flex-col">
            
            {/* Pool A & Pool B Mode: Fast Filter & Gatekeeper Screening */}
            {isPoolAB ? (
              <div className="space-y-6">
                
                {/* Reviewer Alpha vs Reviewer Beta Comparison */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-primary" />
                    Double-Blind Reviewer Evaluations
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Reviewer Alpha */}
                    <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          {discrepancy.r1_name || 'Reviewer Alpha'}
                        </span>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase ${
                          (discrepancy.r1_decision || '').toUpperCase() === 'INCLUDE'
                            ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30'
                        }`}>
                          {discrepancy.r1_decision || 'N/A'}
                        </span>
                      </div>

                      {discrepancy.r1_ec && (
                        <div className="text-xs space-y-1">
                          <span className="font-mono font-bold text-rose-800 dark:text-rose-300 bg-rose-500/10 px-1.5 py-0.5 rounded text-[10px]">
                            {discrepancy.r1_ec}
                          </span>
                          {getEcLabel(discrepancy.r1_ec) && (
                            <p className="text-[11px] text-muted-foreground">
                              {getEcLabel(discrepancy.r1_ec)}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="bg-secondary/40 p-3 rounded-lg text-xs leading-relaxed text-foreground italic border border-border/50">
                        "{discrepancy.r1_rationale || 'No rationale notes recorded.'}"
                      </div>
                    </div>

                    {/* Reviewer Beta */}
                    <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          {discrepancy.r2_name || 'Reviewer Beta'}
                        </span>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase ${
                          (discrepancy.r2_decision || '').toUpperCase() === 'INCLUDE'
                            ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30'
                        }`}>
                          {discrepancy.r2_decision || 'N/A'}
                        </span>
                      </div>

                      {discrepancy.r2_ec && (
                        <div className="text-xs space-y-1">
                          <span className="font-mono font-bold text-rose-800 dark:text-rose-300 bg-rose-500/10 px-1.5 py-0.5 rounded text-[10px]">
                            {discrepancy.r2_ec}
                          </span>
                          {getEcLabel(discrepancy.r2_ec) && (
                            <p className="text-[11px] text-muted-foreground">
                              {getEcLabel(discrepancy.r2_ec)}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="bg-secondary/40 p-3 rounded-lg text-xs leading-relaxed text-foreground italic border border-border/50">
                        "{discrepancy.r2_rationale || 'No rationale notes recorded.'}"
                      </div>
                    </div>
                  </div>
                </div>

                {/* Final Adjudicated Consensus Card */}
                <div className="bg-gradient-to-br from-card via-card to-primary/5 border border-border rounded-xl p-5 space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <h4 className="font-extrabold text-sm text-foreground">
                        Adjudicated Final Consensus
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black px-3 py-1 rounded-full border uppercase ${
                        (discrepancy.resolved_decision || '').toUpperCase() === 'INCLUDE'
                          ? 'bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-900 dark:text-rose-200 border-rose-500/40'
                      }`}>
                        {discrepancy.resolved_decision || 'Consensus Recorded'}
                      </span>
                      {discrepancy.resolved_ec && (
                        <span className="font-mono font-bold text-xs bg-rose-500/15 text-rose-800 dark:text-rose-300 px-2 py-0.5 rounded border border-rose-500/30">
                          {discrepancy.resolved_ec}
                        </span>
                      )}
                    </div>
                  </div>

                  {discrepancy.resolved_ec && getEcLabel(discrepancy.resolved_ec) && (
                    <p className="text-xs text-muted-foreground font-semibold">
                      Triggered Criterion: <span className="text-foreground">{getEcLabel(discrepancy.resolved_ec)}</span>
                    </p>
                  )}

                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Adjudicator Rationale &amp; Resolution Argument
                    </span>
                    <p className="text-xs leading-relaxed text-foreground bg-secondary/30 p-3.5 rounded-lg border border-border select-text">
                      {discrepancy.resolved_rationale || matchingCommit?.resolved_rationale || 'Adjudication decision verified and signed by consensus.'}
                    </p>
                  </div>
                </div>

              </div>
            ) : (
              /* Pool C & Rolling Batch Mode: Scientist QA Rubric & Miner Extraction */
              <div className="space-y-4 flex-1 flex flex-col">
                
                {/* Sub-Tabs: QA vs Extraction */}
                <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
                  <div className="flex gap-2 bg-secondary p-1 rounded-xl border border-border">
                    <button
                      type="button"
                      onClick={() => setActiveTab('qa')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === 'qa'
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>Quality Assessment Rubric</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('extraction')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === 'extraction'
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Hash className="w-3.5 h-3.5" />
                      <span>Data Extraction Variables</span>
                    </button>
                  </div>

                  {discrepancy.resolved_decision && (
                    <span className={`text-xs font-black px-3 py-1 rounded-full border uppercase ${
                      String(discrepancy.resolved_decision).toUpperCase().startsWith('INCLUDE')
                        ? 'bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-900 dark:text-rose-200 border-rose-500/40'
                    }`}>
                      Consensus: {discrepancy.resolved_decision}
                    </span>
                  )}
                </div>

                {/* Tab 1: QA Scorecard Table */}
                {activeTab === 'qa' && (
                  <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                    {qaRules.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground text-xs border border-dashed border-border rounded-xl">
                        No custom QA rubric criteria specified in this project definition.
                      </div>
                    ) : (
                      qaRules.map((rule: any) => {
                        const alpha = getQaField(r1_qa, rule.code);
                        const beta = getQaField(r2_qa, rule.code);
                        const gold = getQaField(resolved_qa, rule.code);

                        const hasScoreDiscrepancy = alpha.value !== null && beta.value !== null && alpha.value !== beta.value;
                        const diff = (alpha.value !== null && beta.value !== null) ? Math.abs(Number(alpha.value) - Number(beta.value)) : 0;

                        return (
                          <div key={rule.code} className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                              <div className="flex items-center gap-2">
                                <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded border ${
                                  rule.is_fatal_flaw
                                    ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30 font-black'
                                    : 'bg-secondary text-foreground border-border'
                                }`}>
                                  {rule.code} {rule.is_fatal_flaw ? '(Fatal Flaw)' : ''}
                                </span>
                                <span className="font-bold text-xs text-foreground">
                                  {rule.question}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {hasScoreDiscrepancy ? (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    diff === 0.5
                                      ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30'
                                      : 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/30'
                                  }`}>
                                    {diff === 0.5 ? 'Minor Deviation (0.5 pts)' : `Discrepancy (Δ ${diff} pts)`}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                                    Aligned Consensus
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* 3-Column Comparison: Alpha vs Beta vs Consensus */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                              {/* Reviewer Alpha */}
                              <div className="bg-secondary/35 p-3 rounded-lg border border-border/40 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-extrabold text-blue-600 dark:text-blue-400 text-[11px]">
                                    Reviewer Alpha
                                  </span>
                                  <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                                    {alpha.value !== null ? alpha.value : '—'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground italic line-clamp-3 select-text" title={alpha.evidence}>
                                  "{alpha.evidence || 'No quote recorded'}"
                                </p>
                              </div>

                              {/* Reviewer Beta */}
                              <div className="bg-secondary/35 p-3 rounded-lg border border-border/40 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-[11px]">
                                    Reviewer Beta
                                  </span>
                                  <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                                    {beta.value !== null ? beta.value : '—'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground italic line-clamp-3 select-text" title={beta.evidence}>
                                  "{beta.evidence || 'No quote recorded'}"
                                </p>
                              </div>

                              {/* Adjudicated Consensus */}
                              <div className="bg-primary/5 p-3 rounded-lg border border-primary/20 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-extrabold text-primary text-[11px] flex items-center gap-1">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    Adjudicated
                                  </span>
                                  <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                                    {gold.value !== null ? gold.value : (alpha.value ?? beta.value ?? '—')}
                                  </span>
                                </div>
                                <p className="text-[11px] text-foreground font-medium italic line-clamp-3 select-text" title={gold.evidence || alpha.evidence || beta.evidence}>
                                  "{gold.evidence || alpha.evidence || beta.evidence || 'Consensus rating applied'}"
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Tab 2: Extraction Variables Table */}
                {activeTab === 'extraction' && (
                  <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                    {extractionRules.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground text-xs border border-dashed border-border rounded-xl">
                        No custom extraction schema rules configured in this project.
                      </div>
                    ) : (
                      extractionRules.map((rule: any) => {
                        const alpha = getExtField(r1_ext, rule.json_key);
                        const beta = getExtField(r2_ext, rule.json_key);
                        const gold = getExtField(resolved_ext, rule.json_key);

                        const isAligned = alpha.value && beta.value && alpha.value.trim().toLowerCase() === beta.value.trim().toLowerCase();

                        return (
                          <div key={rule.json_key} className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs bg-secondary text-foreground px-2 py-0.5 rounded border border-border">
                                  {rule.json_key}
                                </span>
                                <span className="font-bold text-xs text-foreground">
                                  {rule.question}
                                </span>
                              </div>

                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isAligned
                                  ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                                  : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30'
                              }`}>
                                {isAligned ? 'Aligned Match' : 'Discrepancy Synthesized'}
                              </span>
                            </div>

                            {/* 3-Column Comparison: Alpha vs Beta vs Consensus */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                              {/* Alpha */}
                              <div className="bg-secondary/35 p-3 rounded-lg border border-border/40 space-y-1">
                                <span className="font-extrabold text-blue-600 dark:text-blue-400 text-[11px] block">
                                  Reviewer Alpha
                                </span>
                                <p className="font-semibold text-foreground select-text truncate" title={alpha.value}>
                                  {alpha.value || '—'}
                                </p>
                                <p className="text-[11px] text-muted-foreground italic line-clamp-2 select-text" title={alpha.evidence}>
                                  "{alpha.evidence || 'No quote'}"
                                </p>
                              </div>

                              {/* Beta */}
                              <div className="bg-secondary/35 p-3 rounded-lg border border-border/40 space-y-1">
                                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-[11px] block">
                                  Reviewer Beta
                                </span>
                                <p className="font-semibold text-foreground select-text truncate" title={beta.value}>
                                  {beta.value || '—'}
                                </p>
                                <p className="text-[11px] text-muted-foreground italic line-clamp-2 select-text" title={beta.evidence}>
                                  "{beta.evidence || 'No quote'}"
                                </p>
                              </div>

                              {/* Consensus */}
                              <div className="bg-primary/5 p-3 rounded-lg border border-primary/20 space-y-1">
                                <span className="font-extrabold text-primary text-[11px] flex items-center gap-1">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  Adjudicated Consensus
                                </span>
                                <p className="font-bold text-primary select-text truncate" title={gold.value || alpha.value || beta.value}>
                                  {gold.value || alpha.value || beta.value || '—'}
                                </p>
                                <p className="text-[11px] text-foreground font-medium italic line-clamp-2 select-text" title={gold.evidence || alpha.evidence || beta.evidence}>
                                  "{gold.evidence || alpha.evidence || beta.evidence || 'Normalized'}"
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
