import React, { useState, useEffect } from 'react';
import { Play, Download, Upload, AlertCircle, RefreshCw, CheckCircle, HelpCircle, Layers, ArrowRight } from 'lucide-react';
import { useRollingBatch } from '@/hooks/useRollingBatch';
import BatchImportSlot from './BatchImportSlot';
import BatchStatisticsCards from './BatchStatisticsCards';
import RollingBatchAdjudicationModal from './RollingBatchAdjudicationModal';
import DiscrepancyTable from '@/components/features/inter-rater/DiscrepancyTable';
import AuditLedger from '@/components/features/inter-rater/AuditLedger';
import { renderPoolCReviewerSummary } from '@/lib/inter-rater/adjudication-calculations';

interface RollingBatchViewProps {
  projectId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  reportingOnly?: boolean;
}

export default function RollingBatchView({ projectId, showToast, reportingOnly = false }: RollingBatchViewProps) {
  const rb = useRollingBatch({ projectId, showToast });
  const [batchData, setBatchData] = useState<any>(null);
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<any>(null);
  const [isUploadingSlot1, setIsUploadingSlot1] = useState(false);
  const [isUploadingSlot2, setIsUploadingSlot2] = useState(false);

  // Fetch detailed decisions and ledger for the active batch
  const fetchBatchDecisions = async () => {
    if (!rb.currentBatch) {
      setBatchData(null);
      return;
    }
    try {
      const res = await fetch(`/api/rolling-batch/decisions?batch_id=${rb.currentBatch.id}`);
      if (res.ok) {
        const data = await res.json();
        setBatchData(data);
      }
    } catch (err) {
      console.error('Failed to load batch decisions:', err);
    }
  };

  useEffect(() => {
    fetchBatchDecisions();
  }, [rb.currentBatch]);

  // Keep selectedDiscrepancy synced with updated batchData papers
  useEffect(() => {
    if (selectedDiscrepancy && batchData?.papers) {
      const updatedPaper = batchData.papers.find((p: any) => p.Paper_ID === selectedDiscrepancy.paper_id);
      if (updatedPaper) {
        const paperDecs = (batchData.decisions || [])
          .filter((d: any) => d.paper_id === updatedPaper.Paper_ID)
          .sort((a: any, b: any) => a.reviewer_name.localeCompare(b.reviewer_name));
        
        const r1 = paperDecs[0];
        const r2 = paperDecs[1];

        const mapped = {
          paper_id: updatedPaper.Paper_ID,
          title: updatedPaper.Title,
          authors: updatedPaper.Authors,
          year: updatedPaper.Year,
          abstract: updatedPaper.Abstract,
          doi: updatedPaper.DOI,
          local_pdf_path: updatedPaper.Local_PDF_Path,
          pdf_link: updatedPaper.PDF_Link,
          publisher: updatedPaper.Publisher,
          r1_name: r1?.reviewer_name || 'Reviewer Alpha',
          r1_qa_scores: r1?.qa_scores || '{}',
          r1_extracted_data: r1?.extracted_data || '{}',
          r2_name: r2?.reviewer_name || 'Reviewer Beta',
          r2_qa_scores: r2?.qa_scores || '{}',
          r2_extracted_data: r2?.extracted_data || '{}',
          resolved_decision: updatedPaper.manual_decision,
          resolved_ec: updatedPaper.manual_exclusion_code,
          resolved_rationale: updatedPaper.manual_rationale
        };

        if (JSON.stringify(mapped) !== JSON.stringify(selectedDiscrepancy)) {
          setSelectedDiscrepancy(mapped);
        }
      }
    }
  }, [batchData, selectedDiscrepancy]);

  // Compute discrepancy list from active batch data
  const discrepancies = React.useMemo(() => {
    if (!batchData || !batchData.papers) return [];
    
    return batchData.papers
      .filter((p: any) => p.manual_decision === 'PENDING_ADJUDICATION')
      .map((paper: any) => {
        const paperDecs = (batchData.decisions || [])
          .filter((d: any) => d.paper_id === paper.Paper_ID)
          .sort((a: any, b: any) => a.reviewer_name.localeCompare(b.reviewer_name));
        
        const r1 = paperDecs[0];
        const r2 = paperDecs[1];

        return {
          paper_id: paper.Paper_ID,
          title: paper.Title,
          authors: paper.Authors,
          year: paper.Year,
          abstract: paper.Abstract,
          doi: paper.DOI,
          local_pdf_path: paper.Local_PDF_Path,
          pdf_link: paper.PDF_Link,
          publisher: paper.Publisher,
          r1_name: r1?.reviewer_name || 'Reviewer Alpha',
          r1_qa_scores: r1?.qa_scores || '{}',
          r1_extracted_data: r1?.extracted_data || '{}',
          r2_name: r2?.reviewer_name || 'Reviewer Beta',
          r2_qa_scores: r2?.qa_scores || '{}',
          r2_extracted_data: r2?.extracted_data || '{}',
          resolved_decision: paper.manual_decision,
          resolved_ec: paper.manual_exclusion_code,
          resolved_rationale: paper.manual_rationale
        };
      });
  }, [batchData]);

  // Project rules (parsed from active project config)
  const project = rb.currentBatch ? batchData?.batch?.project : null;
  const activeProject = project || {};
  
  let qaRules: any[] = [];
  let extractionRules: any[] = [];
  
  // Re-read from batch data or project config directly
  if (batchData?.batch) {
    // If we loaded the details, project data is in there
  }

  // Load project settings directly to be safe
  const [projRules, setProjRules] = useState<any>(null);
  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setProjRules(data.project);
      })
      .catch(err => console.error(err));
  }, [projectId]);

  if (projRules) {
    if (projRules.pool_c_qa_rules) {
      try {
        qaRules = typeof projRules.pool_c_qa_rules === 'string' 
          ? JSON.parse(projRules.pool_c_qa_rules) 
          : projRules.pool_c_qa_rules;
      } catch (e) {}
    }
    if (projRules.pool_c_extraction_rules) {
      try {
        extractionRules = typeof projRules.pool_c_extraction_rules === 'string' 
          ? JSON.parse(projRules.pool_c_extraction_rules) 
          : projRules.pool_c_extraction_rules;
      } catch (e) {}
    }
  }

  const reviewersList = rb.reviewers.map(r => r.reviewer_name);

  const statsObj = {
    isCalibrated: rb.reviewers.length >= 2,
    discrepancies,
    reviewers: reviewersList
  };

  const handleUploadSlot = async (slotNum: number, file: File): Promise<boolean> => {
    if (slotNum === 1) setIsUploadingSlot1(true);
    else setIsUploadingSlot2(true);

    try {
      const ok = await rb.importReviewerSlr(file);
      if (ok) {
        await fetchBatchDecisions();
      }
      return ok;
    } catch (err) {
      return false;
    } finally {
      if (slotNum === 1) setIsUploadingSlot1(false);
      else setIsUploadingSlot2(false);
    }
  };

  const maskReviewerName = (rawName: string): string => {
    const index = reviewersList.indexOf(rawName);
    if (index === 0) return 'Reviewer Alpha';
    if (index === 1) return 'Reviewer Beta';
    return rawName;
  };

  const maskAdjudicatorString = (adjudicator: string): string => {
    if (adjudicator.startsWith('IMPORT: ')) {
      const rawName = adjudicator.replace('IMPORT: ', '');
      return `Import (${maskReviewerName(rawName)})`;
    }
    return adjudicator;
  };

  const formatPrevState = (stateStr: string) => {
    try {
      const stateObj = JSON.parse(stateStr);
      return stateObj.manual_decision || 'PENDING';
    } catch {
      return stateStr;
    }
  };

  if (rb.loading && !rb.currentBatch) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-card/40 border border-border/50 rounded-2xl">
        <div className="text-center space-y-2">
          <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground font-semibold">Loading rolling batch engine state...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6 overflow-y-auto pr-1 pb-8 animate-in fade-in duration-200">
      
      {/* Cumulative Stats Row */}
      <div className="space-y-2 select-none">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sequential Audit Progress</h4>
        <BatchStatisticsCards 
          stats={rb.cumulativeStats} 
          auditPassed={rb.auditPassed} 
          batchesCount={rb.history.filter(b => b.status === 'complete').length}
        />
      </div>

      {/* Main workspace area */}
      <div className="flex-1">
        {!rb.currentBatch ? (
          reportingOnly ? null : (
            /* Empty/Initial State */
            <div className="flex flex-col items-center justify-center border border-dashed border-border rounded-2xl p-12 text-center bg-card/20 min-h-[300px]">
              <div className="bg-primary/10 border border-primary/20 p-4 rounded-full mb-4">
                <Layers className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-extrabold text-sm text-foreground mb-1">Audit Pipeline Standby</h3>
              <p className="text-xs text-muted-foreground max-w-sm mb-6 leading-relaxed">
                No active rolling batch is currently running. Initialize a batch of {projRules?.rolling_batch_size || 20} papers to begin quality control validation.
              </p>
              {rb.auditPassed ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold rounded-xl px-4 py-2 flex items-center gap-1.5">
                  <CheckCircle className="w-4.5 h-4.5" />
                  Sequential audit complete! Validation goals satisfied.
                </div>
              ) : (
                <button
                  onClick={rb.initializeBatch}
                  className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Initialize Next Audit Batch
                </button>
              )}
            </div>
          )
        ) : (
          /* Active Batch Workspace */
          <div className="space-y-6">
            
            {/* Batch Header Details Card */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="flex items-center gap-2 select-none">
                    <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                      Active
                    </span>
                    <h3 className="font-extrabold text-sm text-foreground">Rolling Batch #{rb.currentBatch.batch_number}</h3>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 font-mono">ID: {rb.currentBatch.id}</p>
                </div>
                
                <button
                  onClick={rb.downloadBatchSlr}
                  className="px-4 py-2 border border-border hover:bg-muted text-foreground text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 self-stretch sm:self-auto justify-center"
                >
                  <Download className="w-4 h-4" />
                  Download Blinded Template (.slr)
                </button>
              </div>

              {/* Reviewer uploads slots grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <BatchImportSlot 
                  slotNumber={1}
                  reviewerName={rb.reviewers[0]?.reviewer_name || null}
                  papersReviewed={rb.reviewers[0]?.papers_reviewed || null}
                  onUpload={(file) => handleUploadSlot(1, file)}
                  isUploading={isUploadingSlot1}
                />
                <BatchImportSlot 
                  slotNumber={2}
                  reviewerName={rb.reviewers[1]?.reviewer_name || null}
                  papersReviewed={rb.reviewers[1]?.papers_reviewed || null}
                  onUpload={(file) => handleUploadSlot(2, file)}
                  isUploading={isUploadingSlot2}
                />
              </div>

              {/* Status and Action bar */}
              {rb.reviewers.length >= 2 && discrepancies.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in fade-in duration-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-500">Adjudication Required</h4>
                      <p className="text-[10px] text-amber-500/80 mt-0.5 leading-relaxed max-w-md">
                        Reviewers disagreed on {discrepancies.length} papers. Open the adjudication workspace to resolve these discrepancies and finalize the batch.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => rb.setShowAdjudicationModal(true)}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 shrink-0 self-stretch sm:self-auto justify-center"
                  >
                    Open Adjudication Workspace
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {rb.reviewers.length >= 2 && discrepancies.length === 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-center gap-3 animate-in fade-in duration-200">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-500">Consensus Achieved!</h4>
                    <p className="text-[10px] text-emerald-500/80 mt-0.5 leading-relaxed">
                      All reviewer decisions are aligned. Batch #{rb.currentBatch.batch_number} is fully finalized and resolved. Initialize the next batch to continue validation.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Discrepancy details listing & audit ledger */}
            {rb.reviewers.length >= 2 && (
              <div className="space-y-6">
                <DiscrepancyTable
                  stats={statsObj}
                  activePoolTab="pool_c"
                  qaRules={qaRules}
                  openAdjudicationWorkspace={(disc) => {
                    setSelectedDiscrepancy(disc);
                    rb.setShowAdjudicationModal(true);
                  }}
                  renderPoolCReviewerSummary={renderPoolCReviewerSummary}
                />

                <AuditLedger
                  ledger={batchData?.ledger || []}
                  activePoolTab="pool_c"
                  maskAdjudicatorString={maskAdjudicatorString}
                  formatPrevState={formatPrevState}
                />
              </div>
            )}

            {/* Adjudication Workspace fullscreen overlay */}
            <RollingBatchAdjudicationModal
              isOpen={rb.showAdjudicationModal}
              onClose={() => {
                rb.setShowAdjudicationModal(false);
                setSelectedDiscrepancy(null);
              }}
              onSuccess={async () => {
                await fetchBatchDecisions();
                await rb.loadStatus();
                await rb.loadStats();
              }}
              discrepancy={selectedDiscrepancy || discrepancies[0]}
              activeProject={projRules}
              qaRules={qaRules}
              extractionRules={extractionRules}
              showToast={showToast}
              discrepancies={discrepancies}
              onSelectDiscrepancy={setSelectedDiscrepancy}
              batchId={rb.currentBatch.id}
            />

          </div>
        )}
      </div>

      {/* Historical Batch Breakdown */}
      {(rb.history.filter(b => b.status === 'complete').length > 0 || (reportingOnly && rb.auditPassed)) && (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <h3 className="font-extrabold text-xs text-foreground uppercase tracking-wider">Historical Batch Performance</h3>
            </div>
            {reportingOnly && (
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  rb.auditPassed 
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                }`}>
                  {rb.auditPassed ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      Sequential Audit Complete (Satisfied)
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" />
                      Sequential Audit In Progress (Unsatisfied)
                    </>
                  )}
                </span>
              </div>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold">
                  <th className="py-2.5 px-3">Batch</th>
                  <th className="py-2.5 px-3">Finalized Date</th>
                  <th className="py-2.5 px-3 text-center">Stage 3: Agreement</th>
                  <th className="py-2.5 px-3 text-center">Stage 3: CI Lower</th>
                  <th className="py-2.5 px-3 text-center">Stage 3: Miss Rate</th>
                  <th className="py-2.5 px-3 text-center">Stage 4: Schema Integrity</th>
                  <th className="py-2.5 px-3 text-center">Stage 4: CI Lower</th>
                  <th className="py-2.5 px-3 text-center">Stage 4: Semantic Agreement</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rb.history
                  .filter(b => b.status === 'complete')
                  .map((batch) => {
                    const batchStats = rb.individualBatchStats?.find((s: any) => s.batchId === batch.id)?.stats;
                    const isPassed = batchStats?.s3?.passed && batchStats?.s4?.passed;
                    
                    return (
                      <tr key={batch.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold">#{batch.batch_number}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {batch.finalized_at ? new Date(batch.finalized_at).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold">
                          {batchStats ? `${(batchStats.s3.p_hat * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">
                          {batchStats ? `${(batchStats.s3.CI_lower * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {batchStats ? (
                            <span className={batchStats.s3.critical_miss_rate === 0 ? "text-emerald-500 font-semibold" : "text-destructive font-semibold"}>
                              {batchStats.s3.critical_miss_rate.toFixed(1)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold">
                          {batchStats ? `${batchStats.s4.schema_integrity_rate.toFixed(1)}%` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">
                          {batchStats ? `${(batchStats.s4.CI_lower * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {batchStats ? (
                            <span className="text-amber-500 font-semibold">
                              {batchStats.s4.semantic_agreement.toFixed(1)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isPassed 
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                              : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          }`}>
                            {isPassed ? 'Passed' : 'Failed'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
