import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Check, AlertCircle, RefreshCw, Layers, FileText, ArrowRight, ArrowLeft, 
  Loader2, Award, Copy, CheckCircle2, Sparkles, BrainCircuit, Bot, AlertTriangle, 
  GitMerge, BookOpen, Compass, ShieldAlert, Cpu
} from 'lucide-react';
import { broadcastSync, subscribeSyncChannel } from '@/lib/sync-utils';

interface DuplicateReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  loadPapers: () => void;
  activeProject?: any;
}

export default function DuplicateReviewModal({ isOpen, onClose, showToast, loadPapers, activeProject }: DuplicateReviewModalProps) {

  const [pairs, setPairs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [primaryOverride, setPrimaryOverride] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [dupPrompts, setDupPrompts] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // prevent stale closures for BroadcastChannel messages
  const loadPapersRef = useRef(loadPapers);
  useEffect(() => {
    loadPapersRef.current = loadPapers;
  }, [loadPapers]);

  const loadPrompts = async () => {
    try {
      const url = activeProject?.id
        ? `/api/llm/prompts?project_id=${activeProject.id}&include_global=true`
        : '/api/llm/prompts';
      const res = await fetch(url);
      const data = await res.json();
      if (data.prompts) {
        const filtered = data.prompts.filter((p: any) => p.prompt_type === 'duplicate_review' && p.is_active);
        setDupPrompts(filtered);

        let defaultTplId = '';
        if (activeProject?.llm_config) {
          try {
            const pCfg = JSON.parse(activeProject.llm_config);
            defaultTplId = pCfg.default_prompts?.duplicate_review || '';
          } catch (e) {}
        }

        if (defaultTplId && filtered.some((p: any) => p.id === defaultTplId)) {
          setSelectedTemplateId(defaultTplId);
        } else if (filtered.length > 0 && !selectedTemplateId) {
          setSelectedTemplateId(filtered[0].id);
        }
      }
    } catch {}
  };

  const loadPairs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const url = activeProject?.id ? `/api/duplicates?projectId=${encodeURIComponent(activeProject.id)}` : '/api/duplicates';
      const res = await fetch(url);
      const data = await res.json();
      if (data.pairs) {
        setPairs(data.pairs);
        // Reset current index if it exceeds list
        if (currentIndex >= data.pairs.length) {
          setCurrentIndex(Math.max(0, data.pairs.length - 1));
        }
      }
    } catch (e: any) {
      showToast(`Failed to load duplicates: ${e.message}`, 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPairs();
      loadPrompts();
    }
  }, [isOpen]);

  // Subscribe to channel messages to keep tabs in sync
  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = subscribeSyncChannel((type) => {
      if (type === 'SYNC_PAPERS') {
        loadPairs(true);
      }
    });
    return unsubscribe;
  }, [isOpen, currentIndex]);

  if (!isOpen) return null;

  const activePair = pairs[currentIndex];

  // Helper to score papers
  const calculatePaperScore = (paper: any) => {
    if (!paper) return { total: 0, breakdown: [] };
    const breakdown: { name: string; points: number }[] = [];

    // 1. Local PDF
    const pdfStatus = paper.Local_PDF_Status;
    if (pdfStatus === 'MATCHED' || pdfStatus === 'DOWNLOADED' || pdfStatus === 'SYNCED') {
      breakdown.push({ name: `Local PDF (${pdfStatus})`, points: 10 });
    }

    // 2. DOI
    if (paper.DOI && paper.DOI.trim().length > 0) {
      breakdown.push({ name: 'Valid DOI', points: 5 });
    }

    // 3. Abstract length
    if (paper.Abstract) {
      const len = paper.Abstract.trim().length;
      const points = Math.min(10, Math.floor(len / 100));
      if (points > 0) {
        breakdown.push({ name: `Abstract length (${len} chars)`, points });
      }
    }

    // 4. Authors
    if (paper.Authors && paper.Authors.trim().length > 0) {
      breakdown.push({ name: 'Author metadata present', points: 2 });
    }

    const total = breakdown.reduce((sum, item) => sum + item.points, 0);
    return { total, breakdown };
  };

  // Resolve Recommended Primary Paper
  const getScoringRecommendation = () => {
    if (!activePair) return { recommendedId: null, score1: 0, score2: 0, breakdown1: [], breakdown2: [] };
    const { paper1, paper2 } = activePair;

    const r1 = calculatePaperScore(paper1);
    const r2 = calculatePaperScore(paper2);

    let score1 = r1.total;
    let score2 = r2.total;

    const breakdown1 = [...r1.breakdown];
    const breakdown2 = [...r2.breakdown];

    // Year comparison
    if (paper1.Year && paper2.Year) {
      const y1 = parseInt(paper1.Year);
      const y2 = parseInt(paper2.Year);
      if (y1 > y2) {
        score1 += 1;
        breakdown1.push({ name: `Later Year (${y1} vs ${y2})`, points: 1 });
      } else if (y2 > y1) {
        score2 += 1;
        breakdown2.push({ name: `Later Year (${y2} vs ${y1})`, points: 1 });
      }
    }

    // If AI suggested primary ID exists, prefer it, otherwise score
    const recommendedId = activePair.ai_suggested_primary_id || (score2 > score1 ? paper2.Paper_ID : paper1.Paper_ID);
    return { recommendedId, score1, score2, breakdown1, breakdown2 };
  };

  const { recommendedId, score1, score2, breakdown1, breakdown2 } = getScoringRecommendation();
  const activePrimaryId = primaryOverride || recommendedId;

  // Helper to parse AI analysis
  const getParsedAiAnalysis = () => {
    if (!activePair?.ai_analysis) return null;
    try {
      return typeof activePair.ai_analysis === 'string' ? JSON.parse(activePair.ai_analysis) : activePair.ai_analysis;
    } catch {
      return null;
    }
  };
  const aiAnalysis = getParsedAiAnalysis();

  const handleAiScreen = async () => {
    if (!activePair) return;
    setAiLoading(true);
    setAiError(null);

    try {
      const res = await fetch('/api/duplicates/ai-screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pair_id: activePair.id,
          template_id: selectedTemplateId || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI Duplicate Screening failed');
      }

      showToast(`AI Adjudication Verdict: ${data.verdict}`, 'success');

      // Update local pair state with AI result
      const updatedPairs = [...pairs];
      updatedPairs[currentIndex] = {
        ...activePair,
        ai_verdict: data.verdict,
        ai_suggested_primary_id: data.suggested_primary_id,
        ai_analysis: typeof data.analysis === 'string' ? data.analysis : JSON.stringify(data.analysis)
      };
      setPairs(updatedPairs);

      // Auto-set suggested primary override
      if (data.suggested_primary_id) {
        setPrimaryOverride(data.suggested_primary_id);
      }
    } catch (e: any) {
      setAiError(e.message);
      showToast(e.message, 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const activePromptObj = dupPrompts.find(p => p.id === selectedTemplateId) || dupPrompts[0];
  const activePromptConfig = (() => {
    try {
      return activePromptObj?.llm_config ? JSON.parse(activePromptObj.llm_config) : {};
    } catch {
      return {};
    }
  })();

  const handleResolve = async (action: 'KEEP_BOTH' | 'CONFIRMED_DUPLICATE') => {
    if (!activePair) return;

    // Guard: ensure a primary paper is selected before confirming a duplicate
    if (action === 'CONFIRMED_DUPLICATE' && !activePrimaryId) {
      showToast('Please select a primary paper to keep before confirming.', 'error');
      return;
    }

    setLoading(true);

    const keep_paper_id = activePrimaryId;
    const exclude_paper_id = keep_paper_id === activePair.paper1_id ? activePair.paper2_id : activePair.paper1_id;

    try {
      const res = await fetch('/api/duplicates/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pair_id: activePair.id,
          action,
          keep_paper_id,
          exclude_paper_id
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Duplicate resolved successfully.', 'success');
        broadcastSync('SYNC_PAPERS');
        broadcastSync('SYNC_DUPLICATES');
        loadPapersRef.current();

        // Load next or update
        setPrimaryOverride(null);
        setAiError(null);
        const updatedPairs = pairs.filter((_, idx) => idx !== currentIndex);
        setPairs(updatedPairs);
        if (currentIndex >= updatedPairs.length) {
          setCurrentIndex(Math.max(0, updatedPairs.length - 1));
        }
      } else {
        showToast(data.error || 'Failed to resolve duplicate.', 'error');
      }
    } catch (e: any) {
      showToast(`Error resolving duplicate: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col animate-in fade-in duration-300">
      {/* Header */}
      <div className="h-16 px-6 border-b border-border bg-card/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Layers className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-bold text-sm">Review Duplicates ({pairs.length} pending)</h3>
            <p className="text-[10px] text-muted-foreground font-medium">Evaluate candidate duplicate paper references side-by-side and confirm resolution</p>
          </div>
        </div>

        {/* Navigation & Actions */}
        <div className="flex items-center gap-3">
          {activePair && (
            <>
              {dupPrompts.length > 1 ? (
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  disabled={loading || aiLoading}
                  className="bg-secondary/80 border border-border text-foreground font-bold text-xs rounded-lg px-2.5 py-1.5 outline-none"
                >
                  {dupPrompts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({JSON.parse(p.llm_config || '{}').model_id || 'gemini-2.5-flash'})
                    </option>
                  ))}
                </select>
              ) : activePromptObj ? (
                <div 
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-secondary/50 border border-border/70 rounded-lg text-[10px] text-muted-foreground font-mono"
                  title={`Prompt Template: ${activePromptObj.name} | Model: ${activePromptConfig.model_id || 'gemini-2.5-flash'} | Temp: ${activePromptConfig.temperature ?? 0.0} | Speed: ${(activePromptConfig.execution_mode || 'flex').toUpperCase()}`}
                >
                  <BrainCircuit className="w-3 h-3 text-indigo-400" />
                  <span className="font-bold text-foreground truncate max-w-[120px]">{activePromptObj.name}</span>
                  <span className="text-primary font-bold">({activePromptConfig.model_id || 'gemini-2.5-flash'})</span>
                </div>
              ) : null}

              <button
                onClick={handleAiScreen}
                disabled={loading || aiLoading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg font-extrabold text-xs cursor-pointer transition-all shadow-md hover:shadow-indigo-500/25 disabled:opacity-50"
                title={`Run automated LLM deduplication specialist analysis (${activePromptConfig.model_id || 'gemini-2.5-flash'})`}
              >
                {aiLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                )}
                <span>{aiLoading ? 'Analyzing...' : activePair.ai_verdict ? 'Re-Run AI Screen' : 'AI Screen Pair'}</span>
              </button>

              <button
                onClick={() => {
                  const text = `Paper 1:\nTitle: ${activePair.paper1?.Title || 'N/A'}\nDOI: ${activePair.paper1?.DOI || 'N/A'}\nAbstract: ${activePair.paper1?.Abstract || 'N/A'}\n\nPaper 2:\nTitle: ${activePair.paper2?.Title || 'N/A'}\nDOI: ${activePair.paper2?.DOI || 'N/A'}\nAbstract: ${activePair.paper2?.Abstract || 'N/A'}`;
                  navigator.clipboard.writeText(text);
                  showToast('Copied both paper details to clipboard!', 'info');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 border border-border text-foreground hover:text-foreground rounded-lg font-bold text-xs cursor-pointer transition-colors shadow-sm"
                title="Copy details of both papers to clipboard"
              >
                <Copy className="w-3.5 h-3.5 text-primary" />
                Copy Both Details
              </button>
            </>
          )}

          {pairs.length > 1 && (
            <div className="flex items-center gap-2 border border-border/80 bg-background/50 rounded-lg px-2 py-1 shadow-sm text-xs">
              <button
                onClick={() => {
                  setCurrentIndex(prev => (prev - 1 + pairs.length) % pairs.length);
                  setPrimaryOverride(null);
                  setAiError(null);
                }}
                disabled={loading || aiLoading}
                className="p-1 hover:bg-secondary rounded cursor-pointer disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-muted-foreground">
                {currentIndex + 1} / {pairs.length}
              </span>
              <button
                onClick={() => {
                  setCurrentIndex(prev => (prev + 1) % pairs.length);
                  setPrimaryOverride(null);
                  setAiError(null);
                }}
                disabled={loading || aiLoading}
                className="p-1 hover:bg-secondary rounded cursor-pointer disabled:opacity-50"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            onClick={onClose}
            disabled={loading || aiLoading}
            className="p-1.5 hover:bg-secondary border border-border/60 hover:border-border rounded-lg cursor-pointer transition-all disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main workspace */}
      <div className="flex-1 overflow-auto p-6 flex flex-col justify-between">
        {loading && pairs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-xs font-semibold">Loading duplicate candidates...</span>
          </div>
        ) : pairs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 animate-bounce" />
            <div>
              <h4 className="font-bold text-sm text-foreground">All Clear!</h4>
              <p className="text-[11px] mt-1 text-muted-foreground max-w-xs">No pending duplicate pairs identified for review. Run the scan pipeline to scan for more.</p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 bg-secondary border border-border text-foreground hover:bg-secondary/80 font-bold rounded-lg text-xs transition-colors cursor-pointer"
            >
              Close Panel
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Metadata metrics bar */}
            <div className="shrink-0 bg-primary/5 border border-primary/20 rounded-lg p-3 flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-primary">SCAN HEURISTIC MATCH:</span>
                <span className="bg-primary/20 text-primary font-extrabold px-2 py-0.5 rounded text-[10px]">
                  {activePair.similarity_score}% Title Match
                </span>
                {activePair.shared_authors_count > 0 && (
                  <span className="bg-indigo-500/10 text-indigo-500 font-extrabold px-2 py-0.5 rounded text-[10px]">
                    {activePair.shared_authors_count} Shared Author Signature(s)
                  </span>
                )}
              </div>
              <div className="text-muted-foreground font-medium">
                Detected: {new Date(activePair.created_at).toLocaleString()}
              </div>
            </div>

            {/* Error Notification Banner if AI call failed */}
            {aiError && (
              <div className="shrink-0 bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-start gap-2.5 text-xs text-destructive animate-in fade-in duration-200">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold">AI Screening Blocked:</span> {aiError}
                </div>
                <button onClick={() => setAiError(null)} className="p-0.5 hover:bg-destructive/20 rounded cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* AI Verdict & Technical Breakdown Banner */}
            {activePair.ai_verdict && (
              <div className="shrink-0 bg-card border border-indigo-500/30 rounded-xl p-4 shadow-md animate-in fade-in zoom-in-95 duration-200 space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-indigo-500/10 rounded-md border border-indigo-500/20 text-indigo-400">
                      <BrainCircuit className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">AI Deduplication Verdict</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`px-2.5 py-0.5 rounded text-xs font-black uppercase tracking-wider border ${
                          activePair.ai_verdict === 'CONFIRMED DUPLICATE' ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' :
                          activePair.ai_verdict === 'STRUCTURAL OVERLAP' ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' :
                          activePair.ai_verdict === 'COMPANION PAPERS' ? 'bg-sky-500/15 text-sky-400 border-sky-500/30' :
                          'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        }`}>
                          {activePair.ai_verdict}
                        </span>
                        {aiAnalysis?.primary_action && (
                          <span className="text-xs font-semibold text-foreground">
                            • {aiAnalysis.primary_action}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {aiAnalysis?.database_execution?.lineage_actions && (
                    <div className="text-right">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Database Lineage</span>
                      <p className="text-[11px] font-mono font-medium text-primary">
                        {aiAnalysis.database_execution.lineage_actions}
                      </p>
                    </div>
                  )}
                </div>

                {/* Technical Differences Grid */}
                {aiAnalysis?.technical_breakdown && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <div className="bg-secondary/25 border border-border/50 rounded-lg p-2.5 space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                        <Cpu className="w-3 h-3" />
                        <span>Mathematical / Algorithmic Shift</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {aiAnalysis.technical_breakdown.mathematical_algorithmic_shift || 'No fundamental algorithmic shift noted.'}
                      </p>
                    </div>

                    <div className="bg-secondary/25 border border-border/50 rounded-lg p-2.5 space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                        <Compass className="w-3 h-3" />
                        <span>Topology / Scope Change</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {aiAnalysis.technical_breakdown.topology_scope_change || 'No scope or topology expansion noted.'}
                      </p>
                    </div>

                    <div className="bg-secondary/25 border border-border/50 rounded-lg p-2.5 space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                        <FileText className="w-3 h-3" />
                        <span>Data & Implementation Footprint</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {aiAnalysis.technical_breakdown.data_implementation_footprint || 'Comparable implementation footprint.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Split View */}
            <div className="flex-1 min-h-0 grid grid-cols-2 gap-6">
              {/* Paper 1 */}
              {renderPaperCard(activePair.paper1, activePrimaryId === activePair.paper1_id, score1, breakdown1, () => setPrimaryOverride(activePair.paper1_id))}

              {/* Paper 2 */}
              {renderPaperCard(activePair.paper2, activePrimaryId === activePair.paper2_id, score2, breakdown2, () => setPrimaryOverride(activePair.paper2_id))}
            </div>

            {/* Sticky Actions bar */}
            <div className="shrink-0 pt-3 border-t border-border flex justify-center gap-4">
              <button
                onClick={() => handleResolve('KEEP_BOTH')}
                disabled={loading || aiLoading}
                className={`px-6 py-2.5 bg-background border text-foreground font-bold rounded-lg text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  activePair.ai_verdict === 'FALSE FLAG' || activePair.ai_verdict === 'COMPANION PAPERS'
                    ? 'border-emerald-500/80 bg-emerald-500/10 text-emerald-400 ring-2 ring-emerald-500/20'
                    : 'border-border/80 hover:border-border hover:bg-secondary/40'
                }`}
              >
                <AlertCircle className="w-4 h-4 text-emerald-500" />
                Keep Both ({activePair.ai_verdict === 'COMPANION PAPERS' ? 'Companion Study' : 'False Flag'})
              </button>

              <button
                onClick={() => handleResolve('CONFIRMED_DUPLICATE')}
                disabled={loading || aiLoading}
                className={`px-8 py-2.5 font-extrabold rounded-lg text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  activePair.ai_verdict === 'CONFIRMED DUPLICATE' || activePair.ai_verdict === 'STRUCTURAL OVERLAP'
                    ? 'bg-gradient-to-r from-rose-600 to-primary text-white ring-2 ring-rose-500/30'
                    : 'bg-primary text-primary-foreground'
                }`}
              >
                <Check className="w-4 h-4" />
                Confirm Duplicate & Merge
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  function renderPaperCard(paper: any, isPrimary: boolean, score: number, breakdown: any[], onSetPrimary: () => void) {
    const isRecommended = recommendedId === paper.Paper_ID;

    return (
      <div className={`h-full flex flex-col bg-card border rounded-xl shadow-sm transition-all overflow-hidden ${isPrimary ? 'border-primary ring-2 ring-primary/20' : 'border-border/60'}`}>
        {/* Card Header */}
        <div className={`p-4 border-b flex justify-between items-center shrink-0 ${isPrimary ? 'bg-primary/5 border-primary/20' : 'bg-secondary/10 border-border/50'}`}>
          <div className="flex items-center gap-2">
            <input
              type="radio"
              checked={isPrimary}
              onChange={onSetPrimary}
              id={`radio-${paper.Paper_ID}`}
              className="rounded-full border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
            />
            <label htmlFor={`radio-${paper.Paper_ID}`} className="font-bold text-xs uppercase cursor-pointer select-none">
              {isPrimary ? 'Keep as Primary version' : 'Exclude as Duplicate'}
            </label>
          </div>

          <div className="flex items-center gap-2">
            {activePair.ai_suggested_primary_id === paper.Paper_ID && (
              <span className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 font-extrabold px-2 py-0.5 rounded text-[9px] uppercase flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                AI Primary Choice
              </span>
            )}
            {isRecommended && activePair.ai_suggested_primary_id !== paper.Paper_ID && (
              <span className="bg-emerald-500/10 text-emerald-600 font-extrabold px-2 py-0.5 rounded text-[9px] uppercase flex items-center gap-1">
                <Award className="w-3 h-3" />
                Score Recommendation
              </span>
            )}
            <div className="relative group flex items-center gap-1 bg-secondary/80 px-2 py-1 rounded text-[10px] font-bold cursor-help border border-border/50">
              Score: {score} pts
              
              {/* Scorecard breakdown tooltip */}
              <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block z-10 w-48 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[10px] text-popover-foreground animate-in fade-in duration-200">
                <p className="font-extrabold text-xs border-b border-border pb-1 mb-1 text-primary">Scorecard Breakdown</p>
                <div className="space-y-1 font-medium">
                  {breakdown.map((item, index) => (
                    <div key={index} className="flex justify-between">
                      <span>{item.name}</span>
                      <span className="text-primary font-bold">+{item.points}</span>
                    </div>
                  ))}
                  {breakdown.length === 0 && (
                    <div className="text-muted-foreground text-center py-1">0 points calculated</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Title */}
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Title</span>
            <h4 className="font-extrabold text-sm text-foreground leading-snug mt-0.5 select-text">{paper.Title}</h4>
          </div>

          {/* DOI & Year */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">DOI</span>
              <p className="font-mono text-xs font-semibold text-foreground truncate mt-0.5 select-text">
                {paper.DOI || <span className="text-muted-foreground/50 italic">None</span>}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Year</span>
              <p className="text-xs font-bold text-foreground mt-0.5">
                {paper.Year || <span className="text-muted-foreground/50 italic">None</span>}
              </p>
            </div>
          </div>

          {/* Authors */}
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Authors</span>
            <p className="text-xs font-medium text-foreground leading-relaxed mt-0.5 select-text">
              {paper.Authors || <span className="text-muted-foreground/50 italic">None</span>}
            </p>
          </div>

          {/* Statuses */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Local PDF Status</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-2 h-2 rounded-full ${
                  paper.Local_PDF_Status === 'SYNCED' ? 'bg-emerald-500 shadow-sm shadow-emerald-500/20' :
                  paper.Local_PDF_Status === 'DOWNLOADED' ? 'bg-blue-500' :
                  paper.Local_PDF_Status === 'MATCHED' ? 'bg-indigo-500' : 
                  paper.Local_PDF_Status === 'INACCESSIBLE' ? 'bg-rose-500' : 
                  paper.Local_PDF_Status === 'NEEDS_REVIEW' ? 'bg-purple-500' : 'bg-muted-foreground/50'
                }`} />
                <span className="text-xs font-bold uppercase">{paper.Local_PDF_Status || 'MISSING'}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Screening Status</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-xs font-bold uppercase bg-secondary/80 border border-border px-2 py-0.5 rounded">
                  {paper.Status || 'PENDING'}
                </span>
              </div>
            </div>
          </div>

          {/* Abstract */}
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Abstract</span>
            <p className="text-[11px] font-normal text-muted-foreground leading-relaxed mt-1 select-text h-40 overflow-y-auto border border-border/40 p-2.5 rounded-lg bg-secondary/10 whitespace-pre-wrap">
              {paper.Abstract || <span className="text-muted-foreground/30 italic">No abstract available.</span>}
            </p>
          </div>
        </div>
      </div>
    );
  }
}
