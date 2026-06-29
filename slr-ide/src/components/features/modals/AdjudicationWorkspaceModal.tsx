import React, { useState, useEffect } from 'react';
import { X, GitCommit, RefreshCw } from 'lucide-react';
import { calculatePoolCDecision } from '@/lib/inter-rater/adjudication-calculations';
import AdjudicationScorecardView from '@/components/features/inter-rater/AdjudicationScorecardView';
import DataExtractionComparisonView from '@/components/features/inter-rater/DataExtractionComparisonView';

interface AdjudicationWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  discrepancy: any;
  activePoolTab: 'pool_a' | 'pool_b' | 'pool_c';
  activeProject: any;
  qaRules: any[];
  extractionRules: any[];
  ecRules: any[];
  showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function AdjudicationWorkspaceModal({
  isOpen,
  onClose,
  onSuccess,
  discrepancy,
  activePoolTab,
  activeProject,
  qaRules,
  extractionRules,
  ecRules,
  showToast
}: AdjudicationWorkspaceModalProps) {
  // Modal State for Adjudication (Pool A & B)
  const [adjudicateDecision, setAdjudicateDecision] = useState<'Include' | 'Exclude'>('Include');
  const [adjudicateEc, setAdjudicateEc] = useState<string>('');
  const [adjudicateRationale, setAdjudicateRationale] = useState<string>('');
  const [commitMessage, setCommitMessage] = useState<string>('');
  const [submittingAdjudication, setSubmittingAdjudication] = useState(false);

  // Modal State for Pool C Adjudication
  const [adjudicateQaScores, setAdjudicateQaScores] = useState<Record<string, { value: number | null, evidence: string }>>({});
  const [adjudicateExtractedData, setAdjudicateExtractedData] = useState<Record<string, { value: string, evidence: string }>>({});
  const [adjudicationWorkspaceTab, setAdjudicationWorkspaceTab] = useState<'qa' | 'extraction'>('qa');

  // Initialize resolved structures on mount or when discrepancy changes
  useEffect(() => {
    if (isOpen && discrepancy) {
      setAdjudicateDecision('Include');
      setAdjudicateEc('');
      setAdjudicateRationale('');
      setCommitMessage('');

      if (activePoolTab === 'pool_c') {
        setAdjudicationWorkspaceTab('qa');
        // Initialize resolved structures using Alpha (r1) as starting baseline
        const r1_qa = JSON.parse(discrepancy.r1_qa_scores || '{}');
        const r2_qa = JSON.parse(discrepancy.r2_qa_scores || '{}');
        const qaInit: any = {};
        qaRules.forEach(rule => {
          const v1 = r1_qa[rule.code]?.value;
          const v2 = r2_qa[rule.code]?.value;
          const ev1 = r1_qa[rule.code]?.evidence || '';
          const ev2 = r2_qa[rule.code]?.evidence || '';
          qaInit[rule.code] = {
            value: v1 === v2 ? v1 : v1 !== undefined ? v1 : null,
            evidence: v1 === v2 ? ev1 : ev1 || ev2
          };
        });
        setAdjudicateQaScores(qaInit);

        const r1_ext = JSON.parse(discrepancy.r1_extracted_data || '{}');
        const r2_ext = JSON.parse(discrepancy.r2_extracted_data || '{}');
        const extInit: any = {};
        extractionRules.forEach(rule => {
          const v1 = r1_ext[rule.json_key]?.value || '';
          const v2 = r2_ext[rule.json_key]?.value || '';
          const ev1 = r1_ext[rule.json_key]?.evidence || '';
          const ev2 = r2_ext[rule.json_key]?.evidence || '';
          extInit[rule.json_key] = {
            value: v1 === v2 ? v1 : v1 || v2,
            evidence: v1 === v2 ? ev1 : ev1 || ev2
          };
        });
        setAdjudicateExtractedData(extInit);
      }
    }
  }, [isOpen, discrepancy, activePoolTab, qaRules, extractionRules]);

  // Real-time Preview calculation of dynamic gates for the workspace
  const previewDecision = React.useMemo(() => {
    if (activePoolTab !== 'pool_c' || !adjudicateQaScores) return null;
    return calculatePoolCDecision(adjudicateQaScores, qaRules);
  }, [adjudicateQaScores, qaRules, activePoolTab]);

  const handleCommitAdjudication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discrepancy) return;
    if (!commitMessage.trim()) {
      showToast('Commit message is required.', 'error');
      return;
    }

    if (activePoolTab === 'pool_c') {
      // Validate all QA scores have resolved choices
      const incomplete = qaRules.some(rule => adjudicateQaScores[rule.code]?.value === null || adjudicateQaScores[rule.code]?.value === undefined);
      if (incomplete) {
        showToast('A resolved score must be selected for all QA criteria.', 'warning');
        return;
      }
    } else {
      if (!adjudicateRationale.trim()) {
        showToast('Strategic rationale is required.', 'error');
        return;
      }
      if (adjudicateDecision === 'Exclude' && !adjudicateEc) {
        showToast('An exclusion criterion code is required for Exclude decisions.', 'error');
        return;
      }
    }

    setSubmittingAdjudication(true);
    try {
      let bodyData: any = {
        paper_id: discrepancy.paper_id,
        pool: activePoolTab,
        commit_message: commitMessage
      };

      if (activePoolTab === 'pool_c') {
        bodyData.final_qa_scores = adjudicateQaScores;
        bodyData.final_extracted_data = adjudicateExtractedData;
      } else {
        bodyData.final_decision = adjudicateDecision;
        bodyData.final_ec = adjudicateDecision === 'Exclude' ? adjudicateEc : null;
        bodyData.final_rationale = adjudicateRationale;
      }

      const res = await fetch('/api/adjudicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Committed adjudication for ${discrepancy.paper_id}`, 'success');
        onSuccess();
      } else {
        showToast(data.error || 'Failed to commit adjudication', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error sending adjudication request', 'error');
    } finally {
      setSubmittingAdjudication(false);
    }
  };

  if (!isOpen || !discrepancy) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-background text-foreground rounded-2xl border border-border max-w-5xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center shrink-0">
          <div>
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Calibration Adjudication</span>
            <h3 className="text-base font-extrabold text-foreground mt-0.5">
              Resolve Conflict ({activePoolTab.replace('_', ' ').toUpperCase()}): {discrepancy.paper_id}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Split-Pane Body Content */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Left Pane: Paper Title and Abstract */}
          <div className="p-6 space-y-4 overflow-y-auto max-h-[35vh] md:max-h-full">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Paper Title</label>
              <h4 className="text-sm font-bold text-foreground leading-snug">{discrepancy.title}</h4>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Abstract</label>
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {discrepancy.abstract || 'No abstract available for this paper.'}
              </p>
            </div>
          </div>

          {/* Right Pane: Reviewer Comparison & Form */}
          <div className="p-6 flex flex-col overflow-y-auto max-h-[55vh] md:max-h-full bg-muted/10">
            {activePoolTab === 'pool_c' ? (
              <>
                {/* Header Controls for copying review data */}
                <div className="flex justify-between items-center mb-3 shrink-0 select-none">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Blinded Review Comparison</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (adjudicationWorkspaceTab === 'qa') {
                          const r1_qa = JSON.parse(discrepancy.r1_qa_scores || '{}');
                          const qaInit: any = {};
                          qaRules.forEach(rule => {
                            const val = r1_qa[rule.code]?.value;
                            qaInit[rule.code] = {
                              value: val !== undefined ? val : null,
                              evidence: r1_qa[rule.code]?.evidence || ''
                            };
                          });
                          setAdjudicateQaScores(qaInit);
                        } else {
                          const r1_ext = JSON.parse(discrepancy.r1_extracted_data || '{}');
                          const extInit: any = {};
                          extractionRules.forEach(rule => {
                            extInit[rule.json_key] = {
                              value: r1_ext[rule.json_key]?.value || '',
                              evidence: r1_ext[rule.json_key]?.evidence || ''
                            };
                          });
                          setAdjudicateExtractedData(extInit);
                        }
                      }}
                      className="px-2.5 py-1 bg-blue-500/15 hover:bg-blue-500/20 text-blue-500 border border-blue-500/25 text-[9px] font-bold rounded-lg transition-all"
                    >
                      Use All Alpha
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (adjudicationWorkspaceTab === 'qa') {
                          const r2_qa = JSON.parse(discrepancy.r2_qa_scores || '{}');
                          const qaInit: any = {};
                          qaRules.forEach(rule => {
                            const val = r2_qa[rule.code]?.value;
                            qaInit[rule.code] = {
                              value: val !== undefined ? val : null,
                              evidence: r2_qa[rule.code]?.evidence || ''
                            };
                          });
                          setAdjudicateQaScores(qaInit);
                        } else {
                          const r2_ext = JSON.parse(discrepancy.r2_extracted_data || '{}');
                          const extInit: any = {};
                          extractionRules.forEach(rule => {
                            extInit[rule.json_key] = {
                              value: r2_ext[rule.json_key]?.value || '',
                              evidence: r2_ext[rule.json_key]?.evidence || ''
                            };
                          });
                          setAdjudicateExtractedData(extInit);
                        }
                      }}
                      className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/25 text-[9px] font-bold rounded-lg transition-all"
                    >
                      Use All Beta
                    </button>
                  </div>
                </div>

                {/* Tabs for Pool C */}
                <div className="flex border-b border-border mb-4 shrink-0 select-none">
                  <button
                    type="button"
                    onClick={() => setAdjudicationWorkspaceTab('qa')}
                    className={`flex-1 pb-2 text-xs font-extrabold border-b-2 transition-all ${
                      adjudicationWorkspaceTab === 'qa' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
                    }`}
                  >
                    Quality Assessment ({qaRules.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjudicationWorkspaceTab('extraction')}
                    className={`flex-1 pb-2 text-xs font-extrabold border-b-2 transition-all ${
                      adjudicationWorkspaceTab === 'extraction' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
                    }`}
                  >
                    Data Extraction ({extractionRules.length})
                  </button>
                </div>

                {/* Sub-tab scroll panels */}
                <div className="flex-1 overflow-y-auto space-y-6 pr-1">
                  {adjudicationWorkspaceTab === 'qa' ? (
                    <AdjudicationScorecardView
                      activePoolTab={activePoolTab}
                      selectedDiscrepancy={discrepancy}
                      qaRules={qaRules}
                      adjudicateQaScores={adjudicateQaScores}
                      setAdjudicateQaScores={setAdjudicateQaScores}
                    />
                  ) : (
                    <DataExtractionComparisonView
                      selectedDiscrepancy={discrepancy}
                      extractionRules={extractionRules}
                      adjudicateExtractedData={adjudicateExtractedData}
                      setAdjudicateExtractedData={setAdjudicateExtractedData}
                    />
                  )}
                </div>
              </>
            ) : (
              <AdjudicationScorecardView
                activePoolTab={activePoolTab}
                selectedDiscrepancy={discrepancy}
                qaRules={qaRules}
                adjudicateQaScores={adjudicateQaScores}
                setAdjudicateQaScores={setAdjudicateQaScores}
              />
            )}
          </div>
        </div>

        {/* Bottom Actions Form Pane */}
        <form onSubmit={handleCommitAdjudication} className="p-4 border-t border-border bg-muted/30 shrink-0">
          {activePoolTab === 'pool_c' ? (
            previewDecision && (
              <div className="bg-secondary/40 border border-border rounded-xl p-3.5 mb-3 flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-2 text-xs select-none">
                  <span className="font-bold text-muted-foreground">Adjudicated Decision:</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    previewDecision.decision === 'Include'
                      ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'
                      : 'bg-destructive/10 border-destructive/20 text-destructive'
                  }`}>
                    {previewDecision.decision}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs select-none">
                  <span className="font-bold text-muted-foreground">Total QA Score:</span>
                  <span className="font-mono font-black text-foreground">{previewDecision.totalScore.toFixed(1)} / 8.0</span>
                </div>

                {previewDecision.decision === 'Exclude' && (
                  <div className="flex items-center gap-2 text-xs select-none">
                    <span className="font-bold text-muted-foreground">Exclusion Code:</span>
                    <span className="font-mono bg-destructive/10 text-destructive px-2 py-0.5 rounded text-[10px] font-bold">
                      {previewDecision.exclusionCode}
                    </span>
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="space-y-1.5 select-none">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Adjudicated Decision</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjudicateDecision('Include')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                      adjudicateDecision === 'Include'
                        ? 'bg-green-500/10 border-green-500 text-green-700 dark:text-green-400 shadow-sm'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Include
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjudicateDecision('Exclude')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                      adjudicateDecision === 'Exclude'
                        ? 'bg-red-500/10 border-red-500 text-red-700 dark:text-red-400 shadow-sm'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Exclude
                  </button>
                </div>
              </div>

              {adjudicateDecision === 'Exclude' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Exclusion Rule Trigger</label>
                  <select
                    value={adjudicateEc}
                    onChange={(e) => setAdjudicateEc(e.target.value)}
                    className="w-full bg-card border border-border text-foreground px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  >
                    <option value="">-- Select Rule Code --</option>
                    {ecRules.map(rule => (
                      <option key={rule.code} value={rule.code}>
                        {rule.code}: {rule.description}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            {activePoolTab !== 'pool_c' && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Strategic Rationale</label>
                <textarea
                  rows={2}
                  placeholder="Enter strategic reason for this adjudication choice..."
                  value={adjudicateRationale}
                  onChange={(e) => setAdjudicateRationale(e.target.value)}
                  className="w-full bg-card border border-border text-foreground px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Commit Message</label>
              <input
                type="text"
                placeholder="e.g. Resolved inclusion divergence on method scope"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="w-full bg-card border border-border text-foreground px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4 border-t border-border/50 pt-3 select-none">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
              disabled={submittingAdjudication}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
              disabled={submittingAdjudication}
            >
              {submittingAdjudication ? <RefreshCw className="w-4 h-4 animate-spin" /> : <GitCommit className="w-4 h-4" />}
              Commit Resolution
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
