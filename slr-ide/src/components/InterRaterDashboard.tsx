import React, { useState, useEffect } from 'react';
import {
  Upload, Download, AlertCircle, RefreshCw, X,
  ArrowRightLeft, BarChart3, ChevronRight, CheckCircle2,
  GitCommit, RotateCcw
} from 'lucide-react';
import { broadcastSync } from '@/lib/sync-utils';
import { calculatePoolCDecision, renderPoolCReviewerSummary } from '@/lib/inter-rater/adjudication-calculations';
import AgreementMetricsPanel from '@/components/features/inter-rater/AgreementMetricsPanel';
import AdjudicationScorecardView from '@/components/features/inter-rater/AdjudicationScorecardView';
import DataExtractionComparisonView from '@/components/features/inter-rater/DataExtractionComparisonView';

interface StatsPayload {
  isCalibrated: boolean;
  message?: string;
  reviewers: string[];
  total_reviewers: number;
  agree_include?: number;
  agree_exclude?: number;
  r1_inc_r2_exc?: number;
  r1_exc_r2_inc?: number;
  total_intersection?: number;
  cohens_kappa?: number;
  weighted_kappa?: number; // Pool C
  kappa_label?: string;
  raw_agreement_pct?: number;
  expected_agreement_pct?: number;
  kappa_warning?: boolean;
  r1_precision?: number; // Pool B
  r2_precision?: number; // Pool B
  precision_warning?: boolean; // Pool B
  missing_keys_pct?: number; // Pool C
  type_match_pct?: number; // Pool C
  r1_include_count?: number; // Pool C
  r2_include_count?: number; // Pool C
  discrepancies?: any[];
}

interface LedgerEntry {
  id: number;
  commit_hash: string;
  project_id: string;
  paper_id: string;
  pool: string;
  adjudicator: string;
  previous_state: string; // JSON string
  resolved_decision: string;
  resolved_ec: string | null;
  resolved_rationale: string;
  commit_message: string;
  timestamp: string;
}

interface InterRaterDashboardProps {
  activeProjectId: string;
  activeProject: any;
  showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  loadCalPapers: () => void;
  setCalActivePool: (pool: 'pool_a' | 'pool_b' | 'pool_c') => void;
  calActivePool?: 'pool_a' | 'pool_b' | 'pool_c';
}

export default function InterRaterDashboard({
  activeProjectId,
  activeProject,
  showToast,
  loadCalPapers,
  setCalActivePool,
  calActivePool
}: InterRaterDashboardProps) {
  const [activePoolTab, setActivePoolTab] = useState<'pool_a' | 'pool_b' | 'pool_c'>('pool_a');
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Modal State for Adjudication (Pool A & B)
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<any | null>(null);
  const [adjudicateDecision, setAdjudicateDecision] = useState<'Include' | 'Exclude'>('Include');
  const [adjudicateEc, setAdjudicateEc] = useState<string>('');
  const [adjudicateRationale, setAdjudicateRationale] = useState<string>('');
  const [commitMessage, setCommitMessage] = useState<string>('');
  const [submittingAdjudication, setSubmittingAdjudication] = useState(false);

  // Modal State for Pool C Adjudication
  const [adjudicateQaScores, setAdjudicateQaScores] = useState<Record<string, { value: number | null, evidence: string }>>({});
  const [adjudicateExtractedData, setAdjudicateExtractedData] = useState<Record<string, { value: string, evidence: string }>>({});
  const [adjudicationWorkspaceTab, setAdjudicationWorkspaceTab] = useState<'qa' | 'extraction'>('qa');

  // Sync state on open from parent view
  useEffect(() => {
    if (calActivePool) {
      setActivePoolTab(calActivePool);
    }
  }, [calActivePool]);

  // Parse project's EC rules
  const ecRules = React.useMemo(() => {
    const rulesField = activePoolTab === 'pool_b' ? activeProject?.pool_b_ec_rules : activeProject?.ec_rules;
    if (!rulesField) return [];
    try {
      const parsed = typeof rulesField === 'string'
        ? JSON.parse(rulesField)
        : rulesField;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [activeProject, activePoolTab]);

  // Parse project's QA rules (Pool C)
  const qaRules = React.useMemo(() => {
    if (!activeProject || !activeProject.pool_c_qa_rules) return [];
    try {
      const parsed = typeof activeProject.pool_c_qa_rules === 'string'
        ? JSON.parse(activeProject.pool_c_qa_rules)
        : activeProject.pool_c_qa_rules;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [activeProject]);

  // Parse project's Extraction rules (Pool C)
  const extractionRules = React.useMemo(() => {
    if (!activeProject || !activeProject.pool_c_extraction_rules) return [];
    try {
      const parsed = typeof activeProject.pool_c_extraction_rules === 'string'
        ? JSON.parse(activeProject.pool_c_extraction_rules)
        : activeProject.pool_c_extraction_rules;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [activeProject]);

  const fetchStatsAndLedger = async () => {
    setLoading(true);
    try {
      const [statsRes, ledgerRes] = await Promise.all([
        fetch(`/api/adjudicate/stats?pool=${activePoolTab}`),
        fetch(`/api/adjudicate/ledger?pool=${activePoolTab}`)
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (ledgerRes.ok) {
        const ledgerData = await ledgerRes.json();
        setLedger(ledgerData.ledger || []);
      }
    } catch (err) {
      console.error('Failed to fetch stats/ledger:', err);
      showToast('Failed to sync inter-rater statistics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatsAndLedger();
  }, [activeProjectId, activePoolTab]);

  const latestAdjudicationLoaders = React.useRef({ fetchStatsAndLedger });
  useEffect(() => {
    latestAdjudicationLoaders.current = { fetchStatsAndLedger };
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.BroadcastChannel) return;
    const channel = new BroadcastChannel('slr-magic-sync');
    channel.onmessage = (event) => {
      const { type } = event.data;
      if (type === 'SYNC_ADJUDICATION' || type === 'SYNC_PAPERS') {
        latestAdjudicationLoaders.current.fetchStatsAndLedger();
      }
    };
    return () => {
      channel.close();
    };
  }, []);

  const handleTabChange = (tab: 'pool_a' | 'pool_b' | 'pool_c') => {
    setActivePoolTab(tab);
    setCalActivePool(tab);
  };

  const handleExportBlinded = () => {
    window.open(`/api/export/inter-rater?pool=${activePoolTab}`, '_blank');
    showToast(`Exporting ${activePoolTab.replace('_', ' ').toUpperCase()} blinded review template (.slr)...`, 'info');
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportError(null);
    try {
      const text = await file.text();
      const res = await fetch(`/api/import/inter-rater?pool=${activePoolTab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message || `Successfully imported results for ${data.reviewer_name}!`, 'success');
        await fetchStatsAndLedger();
        loadCalPapers();
        broadcastSync('SYNC_ADJUDICATION');
        broadcastSync('SYNC_PAPERS');
      } else {
        if (res.status === 409) {
          setImportError(data.error || 'All available calibration slots (maximum 2 reviewers per pool) are fully occupied.');
        } else {
          showToast(data.error || 'Failed to import reviewer file', 'error');
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Error processing reviewer file', 'error');
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const handleResetCalibration = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to clear all imported raters, calibration decisions, and the audit ledger for ${activePoolTab.replace('_', ' ').toUpperCase()}? This action cannot be undone.`
    );
    if (!confirmed) return;

    setIsResetting(true);
    try {
      const res = await fetch(`/api/import/inter-rater?pool=${activePoolTab}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Successfully reset all calibration reviewer decisions.', 'success');
        await fetchStatsAndLedger();
        loadCalPapers();
        broadcastSync('SYNC_ADJUDICATION');
        broadcastSync('SYNC_PAPERS');
      } else {
        showToast(data.error || 'Failed to reset calibration decisions', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error occurred while resetting calibration data', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const openAdjudicationWorkspace = (disc: any) => {
    setSelectedDiscrepancy(disc);
    setAdjudicateDecision('Include');
    setAdjudicateEc('');
    setAdjudicateRationale('');
    setCommitMessage('');

    if (activePoolTab === 'pool_c') {
      setAdjudicationWorkspaceTab('qa');
      // Initialize resolved structures using Alpha (r1) as starting baseline
      const r1_qa = JSON.parse(disc.r1_qa_scores || '{}');
      const r2_qa = JSON.parse(disc.r2_qa_scores || '{}');
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

      const r1_ext = JSON.parse(disc.r1_extracted_data || '{}');
      const r2_ext = JSON.parse(disc.r2_extracted_data || '{}');
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
  };

  const closeAdjudicationWorkspace = () => {
    setSelectedDiscrepancy(null);
  };

  const handleCommitAdjudication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDiscrepancy) return;
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
        paper_id: selectedDiscrepancy.paper_id,
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
        showToast(`Committed adjudication for ${selectedDiscrepancy.paper_id}`, 'success');
        closeAdjudicationWorkspace();
        await fetchStatsAndLedger();
        loadCalPapers();
        broadcastSync('SYNC_ADJUDICATION');
        broadcastSync('SYNC_PAPERS');
      } else {
        showToast(data.error || 'Failed to commit adjudication', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error sending adjudication request', 'error');
    } finally {
      setSubmittingAdjudication(false);
    }
  };

  const maskReviewerName = (rawName: string): string => {
    if (!stats || !stats.reviewers || stats.reviewers.length === 0) {
      return rawName;
    }
    const index = stats.reviewers.indexOf(rawName);
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
      const decision = stateObj.Human_Decision || 'PENDING';
      if (activePoolTab === 'pool_c') {
        return decision;
      }
      const ec = stateObj.Human_EC_Trigger;
      return `${decision}${ec ? ` (${ec})` : ''}`;
    } catch {
      return stateStr;
    }
  };

  // Real-time Preview calculation of dynamic gates for the workspace
  const previewDecision = React.useMemo(() => {
    if (activePoolTab !== 'pool_c' || !adjudicateQaScores) return null;
    return calculatePoolCDecision(adjudicateQaScores, qaRules);
  }, [adjudicateQaScores, qaRules, activePoolTab]);

  return (
    <div className="space-y-6">
      {/* Dynamic Tab selector linked with PreCalibration tab */}
      <div className="flex border-b border-border select-none">
        {[
          { id: 'pool_a', label: 'Pool A (Fast Filter)' },
          { id: 'pool_b', label: 'Pool B (Gatekeeper)' },
          { id: 'pool_c', label: 'Pool C (Scientist/Miner)' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id as any)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
              activePoolTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {/* Action Controls Bar */}
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm select-none">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportBlinded}
              className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 border border-border text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
              disabled={isImporting}
            >
              <Download className="w-4 h-4" />
              Export Blinded Template (.slr)
            </button>

            <label className={`px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}>
              {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Import Reviewer (.slr)
              <input
                type="file"
                accept=".slr,application/json"
                className="hidden"
                onChange={handleImportFileChange}
                disabled={isImporting}
              />
            </label>

            <button
              onClick={handleResetCalibration}
              className="px-4 py-2 bg-destructive/15 text-destructive hover:bg-destructive/20 border border-destructive/25 text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
              disabled={isImporting || isResetting || !stats || !stats.reviewers || stats.reviewers.length === 0}
            >
              {isResetting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Reset Calibration
            </button>
          </div>

          {/* Roster list */}
          {stats && stats.reviewers && stats.reviewers.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">Raters Ingested:</span>
              <div className="flex gap-1.5">
                {stats.reviewers.map((reviewer, idx) => (
                  <span
                    key={reviewer}
                    className={`px-2.5 py-1 text-xs font-extrabold rounded-lg border ${
                      idx === 0
                        ? 'bg-blue-50/50 dark:bg-blue-950/35 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300'
                        : 'bg-emerald-50/50 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-900 text-emerald-750 dark:text-emerald-300'
                    }`}
                    title={reviewer}
                  >
                    {maskReviewerName(reviewer)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Error alerting banner */}
        {importError && (
          <div className="bg-destructive/15 border border-destructive/30 rounded-xl p-4 flex gap-3 text-destructive text-sm font-semibold animate-in slide-in-from-top-2 duration-200">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-destructive-foreground">Import Denied</p>
              <p className="text-xs text-destructive-foreground/80 mt-0.5">{importError}</p>
              <button
                className="mt-2 text-xs font-bold underline cursor-pointer text-destructive-foreground"
                onClick={() => setImportError(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Scorecard grids */}
        {loading ? (
          <div className="bg-card border border-border p-12 text-center rounded-2xl shadow-sm">
            <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground font-semibold">Calculating agreement statistics...</p>
          </div>
        ) : stats && stats.isCalibrated === false ? (
          <div className="bg-card border border-border p-12 text-center rounded-2xl shadow-sm flex flex-col items-center justify-center">
            <div className="p-4 bg-muted text-muted-foreground rounded-2xl mb-3">
              <BarChart3 className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-foreground">Waiting for Second Reviewer</h4>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Kappa statistics and discrepancy resolution will become available once the second reviewer uploads their completed .slr file.
            </p>
          </div>
        ) : stats && stats.isCalibrated ? (
          <AgreementMetricsPanel activePoolTab={activePoolTab} stats={stats as any} />
        ) : null}

        {/* Discrepancies Listing */}
        {stats && stats.isCalibrated && stats.discrepancies && (
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-200">
            <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center select-none">
              <h4 className="text-sm font-extrabold text-foreground flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4 text-amber-500" />
                Calibration Discrepancies ({stats.discrepancies.length})
              </h4>
              <span className="text-xs text-muted-foreground">Click a row to adjudicate paper</span>
            </div>

            {stats.discrepancies.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-1.5" />
                <p className="text-sm font-bold text-foreground">Zero Discrepancies Found!</p>
                <p className="text-xs text-muted-foreground mt-0.5">Both reviewers are in perfect alignment on all papers.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground font-bold border-b border-border select-none">
                      <th className="px-4 py-3">Paper ID</th>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Reviewer Alpha</th>
                      <th className="px-4 py-3">Reviewer Beta</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stats.discrepancies.map(disc => (
                      <tr
                        key={disc.paper_id}
                        onClick={() => openAdjudicationWorkspace(disc)}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3 font-mono font-bold text-foreground whitespace-nowrap">{disc.paper_id}</td>
                        <td className="px-4 py-3 max-w-sm truncate text-foreground" title={disc.title}>{disc.title}</td>
                        <td className="px-4 py-3">
                          {activePoolTab === 'pool_c' ? (
                            <span className="font-bold text-blue-500">
                              {renderPoolCReviewerSummary(disc.r1_qa_scores, qaRules)}
                            </span>
                          ) : (
                            <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${disc.r1_decision === 'Include'
                              ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                              : 'bg-red-500/15 text-red-700 dark:text-red-400'
                            }`}>
                              {disc.r1_decision}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {activePoolTab === 'pool_c' ? (
                            <span className="font-bold text-emerald-500">
                              {renderPoolCReviewerSummary(disc.r2_qa_scores, qaRules)}
                            </span>
                          ) : (
                            <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${disc.r2_decision === 'Include'
                              ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                              : 'bg-red-500/15 text-red-700 dark:text-red-400'
                            }`}>
                              {disc.r2_decision}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition-colors text-[10px]">
                            Adjudicate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Adjudication Commit Ledger */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden select-none">
          <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
            <h4 className="text-sm font-extrabold text-foreground flex items-center gap-1.5">
              <GitCommit className="w-4 h-4 text-primary" />
              Calibration Audit Ledger ({ledger.length})
            </h4>
          </div>

          {ledger.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs">
              No ledger actions recorded yet. Import reviews or resolve discrepancies to build the history.
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto divide-y divide-border text-xs">
              {ledger.map(entry => (
                <div key={entry.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-muted/10 transition-all animate-in fade-in duration-100">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono bg-secondary px-2 py-0.5 rounded text-[10px] font-bold text-muted-foreground">
                        {entry.commit_hash}
                      </span>
                      <strong className="text-foreground">{entry.paper_id}</strong>
                      <span className="text-muted-foreground text-[10px]">
                        by <span className="font-semibold text-foreground">{maskAdjudicatorString(entry.adjudicator)}</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs italic">"{entry.commit_message}"</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-[10px]">
                      {formatPrevState(entry.previous_state)}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${entry.resolved_decision === 'Include'
                      ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                      : entry.resolved_decision === 'Exclude'
                        ? 'bg-red-500/15 text-red-700 dark:text-red-400'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                    }`}>
                      {entry.resolved_decision} {entry.resolved_ec ? `(${entry.resolved_ec})` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Adjudication Split-Pane Modal */}
      {selectedDiscrepancy && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-background text-foreground rounded-2xl border border-border max-w-5xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center shrink-0">
              <div>
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Calibration Adjudication</span>
                <h3 className="text-base font-extrabold text-foreground mt-0.5">
                  Resolve Conflict ({activePoolTab.replace('_', ' ').toUpperCase()}): {selectedDiscrepancy.paper_id}
                </h3>
              </div>
              <button
                onClick={closeAdjudicationWorkspace}
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
                  <h4 className="text-sm font-bold text-foreground leading-snug">{selectedDiscrepancy.title}</h4>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Abstract</label>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {selectedDiscrepancy.abstract || 'No abstract available for this paper.'}
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
                              const r1_qa = JSON.parse(selectedDiscrepancy.r1_qa_scores || '{}');
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
                              const r1_ext = JSON.parse(selectedDiscrepancy.r1_extracted_data || '{}');
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
                              const r2_qa = JSON.parse(selectedDiscrepancy.r2_qa_scores || '{}');
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
                              const r2_ext = JSON.parse(selectedDiscrepancy.r2_extracted_data || '{}');
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
                          selectedDiscrepancy={selectedDiscrepancy}
                          qaRules={qaRules}
                          adjudicateQaScores={adjudicateQaScores}
                          setAdjudicateQaScores={setAdjudicateQaScores}
                        />
                      ) : (
                        <DataExtractionComparisonView
                          selectedDiscrepancy={selectedDiscrepancy}
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
                    selectedDiscrepancy={selectedDiscrepancy}
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
                  onClick={closeAdjudicationWorkspace}
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
      )}
    </div>
  );
}
