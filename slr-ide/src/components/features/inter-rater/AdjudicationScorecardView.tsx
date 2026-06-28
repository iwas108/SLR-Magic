import React from 'react';

interface AdjudicationScorecardViewProps {
  activePoolTab: 'pool_a' | 'pool_b' | 'pool_c';
  selectedDiscrepancy: any;
  qaRules: any[];
  adjudicateQaScores: Record<string, { value: number | null, evidence: string }>;
  setAdjudicateQaScores: React.Dispatch<React.SetStateAction<Record<string, { value: number | null, evidence: string }>>>;
}

export default function AdjudicationScorecardView({
  activePoolTab,
  selectedDiscrepancy,
  qaRules,
  adjudicateQaScores,
  setAdjudicateQaScores
}: AdjudicationScorecardViewProps) {
  if (!selectedDiscrepancy) return null;

  if (activePoolTab === 'pool_c') {
    return (
      <div className="space-y-6 pr-1">
        {qaRules.map(rule => {
          const r1_qa = JSON.parse(selectedDiscrepancy.r1_qa_scores || '{}');
          const r2_qa = JSON.parse(selectedDiscrepancy.r2_qa_scores || '{}');
          const ruleCode = rule.code;

          return (
            <div key={ruleCode} className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded mr-1.5 ${
                    rule.is_fatal_flaw ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-secondary text-muted-foreground'
                  }`}>
                    {ruleCode} {rule.is_fatal_flaw ? '(Fatal Flaw)' : ''}
                  </span>
                  <span className="text-xs font-bold text-foreground">{rule.question}</span>
                </div>
                <div className="flex gap-1 shrink-0 select-none">
                  <button
                    type="button"
                    onClick={() => {
                      const val = r1_qa[ruleCode]?.value;
                      const ev = r1_qa[ruleCode]?.evidence || '';
                      setAdjudicateQaScores(prev => ({
                        ...prev,
                        [ruleCode]: { value: val !== undefined ? val : null, evidence: ev }
                      }));
                    }}
                    className="px-2 py-0.5 bg-secondary hover:bg-secondary/85 border border-border text-[9px] font-bold rounded"
                  >
                    Alpha
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const val = r2_qa[ruleCode]?.value;
                      const ev = r2_qa[ruleCode]?.evidence || '';
                      setAdjudicateQaScores(prev => ({
                        ...prev,
                        [ruleCode]: { value: val !== undefined ? val : null, evidence: ev }
                      }));
                    }}
                    className="px-2 py-0.5 bg-secondary hover:bg-secondary/85 border border-border text-[9px] font-bold rounded"
                  >
                    Beta
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] bg-secondary/35 p-2 rounded-lg text-muted-foreground">
                <div>
                  <span className="font-bold text-blue-500">Alpha: </span>
                  <span className="font-bold">{r1_qa[ruleCode]?.value !== undefined ? r1_qa[ruleCode]?.value : '—'}</span>
                  <p className="italic mt-0.5 truncate" title={r1_qa[ruleCode]?.evidence}>"{r1_qa[ruleCode]?.evidence || 'No evidence'}"</p>
                </div>
                <div>
                  <span className="font-bold text-emerald-500">Beta: </span>
                  <span className="font-bold">{r2_qa[ruleCode]?.value !== undefined ? r2_qa[ruleCode]?.value : '—'}</span>
                  <p className="italic mt-0.5 truncate" title={r2_qa[ruleCode]?.evidence}>"{r2_qa[ruleCode]?.evidence || 'No evidence'}"</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="sm:col-span-1 select-none">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Resolved Score</label>
                  <div className="flex gap-1 mt-1">
                    {[0, 0.5, 1].map(score => {
                      const active = adjudicateQaScores[ruleCode]?.value !== null && parseFloat(String(adjudicateQaScores[ruleCode]?.value)) === score;
                      return (
                        <button
                          key={score}
                          type="button"
                          onClick={() => {
                            setAdjudicateQaScores(prev => ({
                              ...prev,
                              [ruleCode]: { ...prev[ruleCode], value: score }
                            }));
                          }}
                          className={`flex-1 py-1 text-xs font-bold border rounded transition-colors ${
                            active ? 'bg-primary border-primary text-primary-foreground font-black' : 'bg-card border-border hover:bg-secondary'
                          }`}
                        >
                          {score}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Resolved Evidence</label>
                  <input
                    type="text"
                    value={adjudicateQaScores[ruleCode]?.evidence || ''}
                    onChange={(e) => {
                      setAdjudicateQaScores(prev => ({
                        ...prev,
                        [ruleCode]: { ...prev[ruleCode], evidence: e.target.value }
                      }));
                    }}
                    placeholder="Source quotation..."
                    className="w-full mt-1 bg-card border border-border text-foreground px-2.5 py-1 rounded-lg text-xs outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-y-auto">
      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Blinded Review Comparison</label>

      <div className="space-y-4">
        {/* Reviewer Alpha */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="px-2.5 py-0.5 text-xs font-extrabold rounded-lg bg-blue-50/50 dark:bg-blue-950/35 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300">
              Reviewer Alpha
            </span>
            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${selectedDiscrepancy.r1_decision === 'Include'
              ? 'bg-green-500/15 text-green-700 dark:text-green-400'
              : 'bg-red-500/15 text-red-700 dark:text-red-400'
            }`}>
              {selectedDiscrepancy.r1_decision} {selectedDiscrepancy.r1_ec ? `(${selectedDiscrepancy.r1_ec})` : ''}
            </span>
          </div>
          {selectedDiscrepancy.r1_rationale ? (
            <p className="text-xs text-muted-foreground leading-relaxed bg-muted/40 p-2.5 rounded-lg border border-border/50">
              {selectedDiscrepancy.r1_rationale}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/50 italic">No rationale provided.</p>
          )}
        </div>

        {/* Reviewer Beta */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="px-2.5 py-0.5 text-xs font-extrabold rounded-lg bg-emerald-50/50 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-900 text-emerald-750 dark:text-emerald-300">
              Reviewer Beta
            </span>
            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${selectedDiscrepancy.r2_decision === 'Include'
              ? 'bg-green-500/15 text-green-700 dark:text-green-400'
              : 'bg-red-500/15 text-red-700 dark:text-red-400'
            }`}>
              {selectedDiscrepancy.r2_decision} {selectedDiscrepancy.r2_ec ? `(${selectedDiscrepancy.r2_ec})` : ''}
            </span>
          </div>
          {selectedDiscrepancy.r2_rationale ? (
            <p className="text-xs text-muted-foreground leading-relaxed bg-muted/40 p-2.5 rounded-lg border border-border/50">
              {selectedDiscrepancy.r2_rationale}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/50 italic">No rationale provided.</p>
          )}
        </div>
      </div>
    </div>
  );
}
