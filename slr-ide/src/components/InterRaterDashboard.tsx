import React, { useState, useEffect } from 'react';
import { RefreshCw, BarChart3 } from 'lucide-react';
import { broadcastSync } from '@/lib/sync-utils';
import { renderPoolCReviewerSummary } from '@/lib/inter-rater/adjudication-calculations';
import AgreementMetricsPanel from '@/components/features/inter-rater/AgreementMetricsPanel';
import AdjudicationWorkspaceModal from '@/components/features/modals/AdjudicationWorkspaceModal';
import ActionControls from '@/components/features/inter-rater/ActionControls';
import DiscrepancyTable from '@/components/features/inter-rater/DiscrepancyTable';
import AuditLedger from '@/components/features/inter-rater/AuditLedger';

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
        fetch(`/api/adjudicate/stats?pool=${activePoolTab}&projectId=${activeProjectId}`),
        fetch(`/api/adjudicate/ledger?pool=${activePoolTab}&projectId=${activeProjectId}`)
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

  useEffect(() => {
    if (selectedDiscrepancy && stats?.discrepancies) {
      const updated = stats.discrepancies.find(d => d.paper_id === selectedDiscrepancy.paper_id);
      if (!updated) {
        if (stats.discrepancies.length > 0) {
          setSelectedDiscrepancy(stats.discrepancies[0]);
        } else {
          setSelectedDiscrepancy(null);
          showToast('All calibration conflicts resolved for this pool!', 'success');
        }
      } else if (JSON.stringify(updated) !== JSON.stringify(selectedDiscrepancy)) {
        setSelectedDiscrepancy(updated);
      }
    }
  }, [stats, selectedDiscrepancy, showToast]);

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
    window.open(`/api/export/inter-rater?pool=${activePoolTab}&projectId=${activeProjectId}`, '_blank');
    showToast(`Exporting ${activePoolTab.replace('_', ' ').toUpperCase()} blinded review template (.slr)...`, 'info');
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportError(null);
    try {
      const text = await file.text();
      const res = await fetch(`/api/import/inter-rater?pool=${activePoolTab}&projectId=${activeProjectId}`, {
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
      const res = await fetch(`/api/import/inter-rater?pool=${activePoolTab}&projectId=${activeProjectId}`, {
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
  };

  const closeAdjudicationWorkspace = () => {
    setSelectedDiscrepancy(null);
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
      const decision = stateObj.manual_decision ?? stateObj.Human_Decision ?? 'PENDING';
      if (activePoolTab === 'pool_c') {
        return decision;
      }
      const ec = stateObj.manual_exclusion_code ?? stateObj.Human_EC_Trigger;
      return `${decision}${ec ? ` (${ec})` : ''}`;
    } catch {
      return stateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Tab selector linked with PreCalibration tab */}
      <div className="flex border-b border-border select-none">
        {[
          { id: 'pool_a', label: 'Pool A (Fast Filter)' },
          { id: 'pool_b', label: 'Pool B (Gatekeeper)' },
          { id: 'pool_c', label: 'Pool C (Scientist/Miner)' }
        ].map((tab) => (
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
        <ActionControls
          isImporting={isImporting}
          isResetting={isResetting}
          stats={stats}
          importError={importError}
          activePoolTab={activePoolTab}
          handleExportBlinded={handleExportBlinded}
          handleImportFileChange={handleImportFileChange}
          handleResetCalibration={handleResetCalibration}
          maskReviewerName={maskReviewerName}
          setImportError={setImportError}
        />

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

        <DiscrepancyTable
          stats={stats}
          activePoolTab={activePoolTab}
          qaRules={qaRules}
          openAdjudicationWorkspace={openAdjudicationWorkspace}
          renderPoolCReviewerSummary={renderPoolCReviewerSummary}
        />

        <AuditLedger
          ledger={ledger}
          activePoolTab={activePoolTab}
          maskAdjudicatorString={maskAdjudicatorString}
          formatPrevState={formatPrevState}
        />
      </div>

      {/* Adjudication Split-Pane Modal */}
      <AdjudicationWorkspaceModal
        isOpen={!!selectedDiscrepancy}
        onClose={closeAdjudicationWorkspace}
        onSuccess={async () => {
          await fetchStatsAndLedger();
          loadCalPapers();
          broadcastSync('SYNC_ADJUDICATION');
          broadcastSync('SYNC_PAPERS');
        }}
        discrepancy={selectedDiscrepancy}
        activePoolTab={activePoolTab}
        activeProject={activeProject}
        qaRules={qaRules}
        extractionRules={extractionRules}
        ecRules={ecRules}
        showToast={showToast}
        discrepancies={stats?.discrepancies || []}
        onSelectDiscrepancy={setSelectedDiscrepancy}
      />
    </div>
  );
}
