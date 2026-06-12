import React, { useState, useEffect } from 'react';
import {
  Upload, Download, FileText, Check, AlertCircle, RefreshCw, X, AlertTriangle,
  ArrowRightLeft, BarChart3, Clock, HelpCircle, ChevronRight, CheckCircle2,
  BookOpen, GitCommit, FileCheck, Info, RotateCcw
} from 'lucide-react';

interface ReviewerDecision {
  reviewer_name: string;
  decision: string;
  ec_trigger: string | null;
  rationale: string;
}

interface Discrepancy {
  paper_id: string;
  title: string;
  abstract: string;
  r1_decision: string;
  r2_decision: string;
  r1_rationale: string;
  r2_rationale: string;
  r1_ec: string | null;
  r2_ec: string | null;
}

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
  kappa_label?: string;
  raw_agreement_pct?: number;
  expected_agreement_pct?: number;
  kappa_warning?: boolean;
  discrepancies?: Discrepancy[];
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
}

export default function InterRaterDashboard({
  activeProjectId,
  activeProject,
  showToast,
  loadCalPapers,
  setCalActivePool
}: InterRaterDashboardProps) {
  const [activePoolTab, setActivePoolTab] = useState<'pool_a' | 'pool_b' | 'pool_c'>('pool_a');
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Modal State for Adjudication
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<Discrepancy | null>(null);
  const [adjudicateDecision, setAdjudicateDecision] = useState<'Include' | 'Exclude'>('Include');
  const [adjudicateEc, setAdjudicateEc] = useState<string>('');
  const [adjudicateRationale, setAdjudicateRationale] = useState<string>('');
  const [commitMessage, setCommitMessage] = useState<string>('');
  const [submittingAdjudication, setSubmittingAdjudication] = useState(false);

  // Parse project's EC rules
  const ecRules = React.useMemo(() => {
    if (!activeProject || !activeProject.ec_rules) return [];
    try {
      const parsed = typeof activeProject.ec_rules === 'string'
        ? JSON.parse(activeProject.ec_rules)
        : activeProject.ec_rules;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [activeProject]);

  const fetchStatsAndLedger = async () => {
    setLoading(true);
    try {
      const [statsRes, ledgerRes] = await Promise.all([
        fetch('/api/adjudicate/stats'),
        fetch('/api/adjudicate/ledger')
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
  }, [activeProjectId]);

  const handleExportBlinded = () => {
    window.open('/api/export/inter-rater?pool=pool_a', '_blank');
    showToast('Exporting Pool A blinded review template (.slr)...', 'info');
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportError(null);
    try {
      const text = await file.text();
      const res = await fetch('/api/import/inter-rater?pool=pool_a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message || `Successfully imported results for ${data.reviewer_name}!`, 'success');
        await fetchStatsAndLedger();
        loadCalPapers();
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
      'Are you sure you want to clear all imported raters, calibration decisions, and the audit ledger? This action cannot be undone.'
    );
    if (!confirmed) return;

    setIsResetting(true);
    try {
      const res = await fetch('/api/import/inter-rater?pool=pool_a', {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Successfully reset all calibration reviewer decisions.', 'success');
        await fetchStatsAndLedger();
        loadCalPapers();
      } else {
        showToast(data.error || 'Failed to reset calibration decisions', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error occurred while resetting calibration data', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const openAdjudicationWorkspace = (disc: Discrepancy) => {
    setSelectedDiscrepancy(disc);
    setAdjudicateDecision('Include');
    setAdjudicateEc('');
    setAdjudicateRationale('');
    setCommitMessage('');
  };

  const closeAdjudicationWorkspace = () => {
    setSelectedDiscrepancy(null);
  };

  const handleCommitAdjudication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDiscrepancy) return;
    if (!adjudicateRationale.trim()) {
      showToast('Strategic rationale is required.', 'error');
      return;
    }
    if (!commitMessage.trim()) {
      showToast('Commit message is required.', 'error');
      return;
    }
    if (adjudicateDecision === 'Exclude' && !adjudicateEc) {
      showToast('An exclusion criterion code is required for Exclude decisions.', 'error');
      return;
    }

    setSubmittingAdjudication(true);
    try {
      const res = await fetch('/api/adjudicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paper_id: selectedDiscrepancy.paper_id,
          final_decision: adjudicateDecision,
          final_ec: adjudicateDecision === 'Exclude' ? adjudicateEc : null,
          final_rationale: adjudicateRationale,
          commit_message: commitMessage
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Committed adjudication for ${selectedDiscrepancy.paper_id}`, 'success');
        closeAdjudicationWorkspace();
        await fetchStatsAndLedger();
        loadCalPapers();
      } else {
        showToast(data.error || 'Failed to commit adjudication', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error sending adjudication request', 'error');
    } finally {
      setSubmittingAdjudication(false);
    }
  };

  // Helper to mask reviewer name dynamically based on alphabetically ordered roster
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

  // Helper to render state string
  const formatPrevState = (stateStr: string) => {
    try {
      const stateObj = JSON.parse(stateStr);
      const decision = stateObj.Human_Decision || 'PENDING';
      const ec = stateObj.Human_EC_Trigger;
      return `${decision}${ec ? ` (${ec})` : ''}`;
    } catch {
      return stateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs header */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActivePoolTab('pool_a')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${activePoolTab === 'pool_a'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          Pool A (Fast Filter)
        </button>
        <button
          onClick={() => setActivePoolTab('pool_b')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${activePoolTab === 'pool_b'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          Pool B (Structural Integration) <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full font-bold">Coming Soon</span>
        </button>
        <button
          onClick={() => setActivePoolTab('pool_c')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${activePoolTab === 'pool_c'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          Pool C (Appraisal & Extraction) <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full font-bold">Coming Soon</span>
        </button>
      </div>

      {activePoolTab !== 'pool_a' ? (
        <div className="bg-card border border-border p-8 text-center rounded-2xl">
          <Info className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
          <h4 className="text-lg font-bold text-foreground">Calibration Phase Restricted</h4>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Review of Pool B and Pool C is disabled in this phase. Calibration and inter-rater analysis runs solely on Pool A.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
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

            {/* Reviewers roster */}
            {stats && stats.reviewers && stats.reviewers.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">Raters Ingested:</span>
                <div className="flex gap-1.5">
                  {stats.reviewers.map((reviewer, idx) => (
                    <span
                      key={reviewer}
                      className={`px-2.5 py-1 text-xs font-extrabold rounded-lg border ${idx === 0
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

          {/* Conflict Slot Error Alert */}
          {importError && (
            <div className="bg-destructive/15 border border-destructive/30 rounded-xl p-4 flex gap-3 text-destructive text-sm font-semibold">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-destructive-foreground">Import Denied</p>
                <p className="text-xs text-destructive-foreground/80 mt-0.5">{importError}</p>
                <button
                  className="mt-2 text-xs font-bold underline cursor-pointer"
                  onClick={() => setImportError(null)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Stats section */}
          {loading ? (
            <div className="bg-card border border-border p-12 text-center rounded-2xl shadow-sm">
              <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground font-semibold">Calculating agreement statistics...</p>
            </div>
          ) : stats && stats.isCalibrated === false ? (
            <div className="bg-card border border-border p-8 text-center rounded-2xl shadow-sm flex flex-col items-center justify-center">
              <div className="p-4 bg-muted text-muted-foreground rounded-2xl mb-3">
                <BarChart3 className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-foreground">Waiting for Second Reviewer</h4>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Kappa statistics and discrepancy resolution will become available once the second reviewer uploads their completed .slr file.
              </p>
            </div>
          ) : stats && stats.isCalibrated ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Cohen's Kappa Card */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Inter-Rater Reliability</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <h3 className="text-4xl font-extrabold text-foreground tracking-tight">{stats.cohens_kappa}</h3>
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-md ${(stats.cohens_kappa || 0) >= 0.8
                      ? 'bg-green-500/15 text-green-600'
                      : (stats.cohens_kappa || 0) >= 0.6
                        ? 'bg-blue-500/15 text-blue-600'
                        : 'bg-amber-500/15 text-amber-600'
                      }`}>
                      {stats.kappa_label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Calculated over the paired intersection of <strong className="text-foreground">{stats.total_intersection}</strong> papers reviewed by both raters.
                  </p>
                </div>

                {stats.kappa_warning && (
                  <div className="bg-amber-500/15 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-3 rounded-xl flex gap-2 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <div>
                      <span className="font-bold">Low Agreement Threshold</span>
                      <p className="mt-0.5">Cohen's Kappa is below 0.80. We recommend aligning on calibration discrepancies before executing full reviews.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Agreement stats card */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Agreement Rates</span>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground">Observed Agreement</span>
                      <h4 className="text-2xl font-bold text-foreground mt-1">{stats.raw_agreement_pct}%</h4>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground">Expected (By Chance)</span>
                      <h4 className="text-2xl font-bold text-foreground mt-1">{stats.expected_agreement_pct}%</h4>
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground pt-4 border-t border-border mt-4">
                  Intersection sets isolate papers evaluated by both raters, ensuring unbiased score denominator.
                </div>
              </div>

              {/* Symmetrical Cross-tabulation card */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Confusion Matrix</span>

                <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs">
                  <div className="col-span-1"></div>
                  <div className="font-bold text-muted-foreground pb-1">Beta INC</div>
                  <div className="font-bold text-muted-foreground pb-1">Beta EXC</div>

                  <div className="font-bold text-muted-foreground text-left self-center">Alpha INC</div>
                  <div className="bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 p-2.5 rounded-xl font-bold">
                    {stats.agree_include}
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-2.5 rounded-xl font-medium">
                    {stats.r1_inc_r2_exc}
                  </div>

                  <div className="font-bold text-muted-foreground text-left self-center">Alpha EXC</div>
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-2.5 rounded-xl font-medium">
                    {stats.r1_exc_r2_inc}
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 p-2.5 rounded-xl font-bold">
                    {stats.agree_exclude}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Discrepancies listing */}
          {stats && stats.isCalibrated && stats.discrepancies && (
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
                <h4 className="text-sm font-extrabold text-foreground flex items-center gap-1.5">
                  <ArrowRightLeft className="w-4 h-4 text-amber-500" />
                  Calibration Discrepancies ({stats.discrepancies.length})
                </h4>
                <span className="text-xs text-muted-foreground">Click a row to adjudicate choice</span>
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
                      <tr className="bg-muted/50 text-muted-foreground font-bold border-b border-border">
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
                            <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${disc.r1_decision === 'Include'
                              ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                              : 'bg-red-500/15 text-red-700 dark:text-red-400'
                              }`}>
                              {disc.r1_decision}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${disc.r2_decision === 'Include'
                              ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                              : 'bg-red-500/15 text-red-700 dark:text-red-400'
                              }`}>
                              {disc.r2_decision}
                            </span>
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
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
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
                  <div key={entry.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-muted/10 transition-all">
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
      )}

      {/* Adjudication Workspace Split-Pane Modal */}
      {selectedDiscrepancy && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-background text-foreground rounded-2xl border border-border max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center shrink-0">
              <div>
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Calibration Adjudication</span>
                <h3 className="text-base font-extrabold text-foreground mt-0.5">
                  Resolve Conflict: {selectedDiscrepancy.paper_id}
                </h3>
              </div>
              <button
                onClick={closeAdjudicationWorkspace}
                className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split-Pane Content */}
            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
              {/* Left Pane: Paper Details */}
              <div className="p-6 space-y-4 overflow-y-auto max-h-[45vh] md:max-h-full">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Paper Title</label>
                  <h4 className="text-sm font-bold text-foreground">{selectedDiscrepancy.title}</h4>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Abstract</label>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {selectedDiscrepancy.abstract || 'No abstract available for this paper.'}
                  </p>
                </div>
              </div>

              {/* Right Pane: Reviewer Comparison */}
              <div className="p-6 space-y-6 overflow-y-auto max-h-[45vh] md:max-h-full bg-muted/10">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Blinded Review Comparison</label>

                <div className="space-y-4">
                  {/* Reviewer 1 (Alpha) */}
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

                  {/* Reviewer 2 (Beta) */}
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
            </div>

            {/* Bottom Actions Form */}
            <form onSubmit={handleCommitAdjudication} className="p-4 border-t border-border bg-muted/30 shrink-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Adjudicated Decision</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjudicateDecision('Include')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${adjudicateDecision === 'Include'
                        ? 'bg-green-500/10 border-green-500 text-green-700 dark:text-green-400 shadow-sm'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      Include
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjudicateDecision('Exclude')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${adjudicateDecision === 'Exclude'
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

              <div className="space-y-3">
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

              <div className="flex justify-end gap-3 mt-4 border-t border-border/50 pt-3">
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
