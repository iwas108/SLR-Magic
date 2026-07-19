import React, { useState } from 'react';
import { 
  Upload, Search, FileText, Check, AlertCircle, RefreshCw, X, Play, 
  Download, FileSpreadsheet, Layers, Sparkles, AlertTriangle, ExternalLink, Trash2,
  ArrowUpDown, ArrowUp, ArrowDown, Eye, Edit2, ChevronLeft, ChevronRight,
  Minus, Maximize2, LayoutDashboard, Plus, Edit, Folder, Calendar, CheckCircle2,
  TrendingUp, BarChart3, Cloud, Database, ShieldAlert, Terminal, ArrowRightLeft,
  Lock, Unlock, Loader2, Settings, MoreHorizontal, Globe, BookOpen, UserCheck, Shield
} from 'lucide-react';

import { broadcastSync } from '@/lib/sync-utils';
import PoolMetricsPanel from './pre-calibration/PoolMetricsPanel';
import StageComparisonPanel from './pre-calibration/StageComparisonPanel';

interface PreCalibrationViewProps {
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  projectsHook: {
    projects: any[];
    activeProjectId: string;
    activeProject: any;
  };
  papersHook: {
    paperModal: any;
    setPaperModal: React.Dispatch<React.SetStateAction<any>>;
  };
  calibrationHook: {
    calActivePool: 'pool_a' | 'pool_b' | 'pool_c';
    setCalActivePool: React.Dispatch<React.SetStateAction<'pool_a' | 'pool_b' | 'pool_c'>>;
    stageStats: any[];
    stageStatsLoading: boolean;
    calPapers: any[];
    calLoading: boolean;
    calSearchTerm: string;
    setCalSearchTerm: (v: string) => void;
    calStatusFilter: string;
    setCalStatusFilter: (v: string) => void;
    calPdfFilter: string;
    setCalPdfFilter: (v: string) => void;
    calTagFilter: string;
    setCalTagFilter: (v: string) => void;
    calPage: number;
    setCalPage: React.Dispatch<React.SetStateAction<number>>;
    calLimit: number;
    setCalLimit: React.Dispatch<React.SetStateAction<number>>;
    calTotalPapers: number;
    calTotalPages: number;
    calSortBy: string;
    calSortOrder: 'asc' | 'desc';
    showAssignModal: boolean;
    setShowAssignModal: React.Dispatch<React.SetStateAction<boolean>>;
    assignIsRunning: boolean;
    setAssignIsRunning: React.Dispatch<React.SetStateAction<boolean>>;
    assignStatusText: string;
    setAssignStatusText: (v: string) => void;
    setAssignLogs: React.Dispatch<React.SetStateAction<any[]>>;
    handleCalSort: (field: string) => void;
    handleAssignPool: (paperId: string, pool: string | null) => Promise<void>;
    loadCalPapers: () => void;
    loadAssignPapers: () => void;
  };
  showInterRaterModal: boolean;
  setShowInterRaterModal: React.Dispatch<React.SetStateAction<boolean>>;
  handleExportCalPoolA: () => void;
}

export default function PreCalibrationView({
  showToast,
  projectsHook,
  papersHook,
  calibrationHook,
  showInterRaterModal,
  setShowInterRaterModal,
  handleExportCalPoolA
}: PreCalibrationViewProps) {
  const { projects, activeProjectId, activeProject } = projectsHook;
  const { paperModal, setPaperModal } = papersHook;
  const {
    calActivePool,
    setCalActivePool,
    stageStats,
    stageStatsLoading,
    calPapers,
    calLoading,
    calSearchTerm,
    setCalSearchTerm,
    calStatusFilter,
    setCalStatusFilter,
    calPdfFilter,
    setCalPdfFilter,
    calTagFilter,
    setCalTagFilter,
    calPage,
    setCalPage,
    calLimit,
    setCalLimit,
    calTotalPapers,
    calTotalPages,
    calSortBy,
    calSortOrder,
    showAssignModal,
    setShowAssignModal,
    assignIsRunning,
    setAssignIsRunning,
    assignStatusText,
    setAssignStatusText,
    setAssignLogs,
    handleCalSort,
    handleAssignPool,
    loadCalPapers,
    loadAssignPapers
  } = calibrationHook;

  const [activeSection, setActiveSection] = useState<'statistics' | 'papers'>('statistics');

  const getActivePoolTags = (): { code: string; label: string }[] => {
    if (!activeProject || !activeProject.pool_tags) return [];
    try {
      const parsed = typeof activeProject.pool_tags === 'string' ? JSON.parse(activeProject.pool_tags) : activeProject.pool_tags;
      return parsed[calActivePool] || [];
    } catch (e) {
      return [];
    }
  };

  const poolTags = getActivePoolTags();


  function LoaderIcon() {
    return (
      <svg className="w-6 h-6 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    );
  }


  const renderCalSortIcon = (field: string) => {
    if (calSortBy !== field) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/30" />;
    return calSortOrder === 'asc' ? 
      <ArrowUp className="w-3 h-3 text-primary" /> : 
      <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const handleDeployInterRater = async () => {
    setAssignIsRunning(true);
    setAssignStatusText('Deploying to Inter-Rater module...');
    setAssignLogs([]);
    try {
      const res = await fetch('/api/inter-rater/deploy', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (res.ok) {
        setAssignStatusText('Deployment Successful');
        showToast('Inter-Rater deployment completed', 'success');
        setTimeout(() => setShowInterRaterModal(false), 2000);
      } else {
        const data = await res.json();
        setAssignStatusText('Deployment Failed');
        showToast(data.error || 'Failed to deploy', 'error');
      }
    } catch (err: any) {
      setAssignStatusText('Error occurred');
      showToast(err.message, 'error');
    } finally {
      setAssignIsRunning(false);
    }
  };


  return (
    <>
      <div className="h-full flex flex-col overflow-hidden space-y-6 animate-in fade-in duration-200">
        
        {/* SECTION TAB SELECTOR */}
        <div className="flex border-b border-border space-x-6 shrink-0">
          <button
            onClick={() => setActiveSection('statistics')}
            className={`pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-all ${
              activeSection === 'statistics'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Statistics
          </button>
          <button
            onClick={() => setActiveSection('papers')}
            className={`pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-all ${
              activeSection === 'papers'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Papers
          </button>
        </div>

        {activeSection === 'statistics' ? (
          <div className="flex-1 flex flex-col space-y-6 overflow-y-auto pr-1">
            {/* Pool status filling cards */}
            <PoolMetricsPanel
              projects={projects}
              activeProjectId={activeProjectId}
            />

            {/* Stage comparison gold standard vs screening cards */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Gold Standard vs AI Stage Comparisons</h3>
              <StageComparisonPanel
                stageStats={stageStats}
                loading={stageStatsLoading}
              />
            </div>
          </div>
        ) : (
          <>
            {/* ACTION BAR AND SUBTABS */}
            <div className="bg-card border border-border p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-sm">
              {/* Subtabs selection */}
              <div className="flex items-center gap-1.5 bg-secondary/45 p-1 rounded-lg border border-border shrink-0 select-none">
                {[
                  { id: 'pool_a', label: 'Pool A (Fast Filter)' },
                  { id: 'pool_b', label: 'Pool B (Gatekeeper)' },
                  { id: 'pool_c', label: 'Pool C (Scientist/Miner)' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setCalActivePool(tab.id as any)}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${
                      calActivePool === tab.id
                        ? 'bg-background text-foreground shadow-sm border border-border/85'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                {/* Blinded Review SLR Import/Export for all pools */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportCalPoolA}
                    className="px-3 py-2 bg-secondary text-foreground hover:bg-secondary/80 border border-border text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 uppercase tracking-wide text-[10px]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Blinded (.slr)
                  </button>
                  <button
                    onClick={() => setShowInterRaterModal(true)}
                    className="px-3 py-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 uppercase tracking-wide text-[10px]"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    Inter-Rater Dashboard
                  </button>
                </div>

                <button
                  onClick={() => setShowAssignModal(true)}
                  className="px-3 py-2 bg-primary text-primary-foreground hover:bg-primary/95 hover:shadow-md transition-all flex items-center gap-1.5 uppercase tracking-wide text-[10px] font-bold rounded-lg shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Assign Papers to Pools
                </button>
              </div>
            </div>

            {/* FILTER BAR */}
            <div className="bg-card border border-border p-4 rounded-xl flex flex-col md:flex-row md:items-center gap-4 shrink-0 shadow-sm">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-muted-foreground/70 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by ID, Title, DOI, Authors, or Abstract..."
                  value={calSearchTerm}
                  onChange={(e) => setCalSearchTerm(e.target.value)}
                  className="w-full bg-secondary/35 border border-border rounded-lg pl-9 pr-4 py-2 text-xs text-foreground focus:outline-none focus:border-primary placeholder-muted-foreground/60 transition-colors font-medium"
                />
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <select
                  className="bg-secondary/35 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold transition-colors"
                  value={calStatusFilter}
                  onChange={(e) => setCalStatusFilter(e.target.value)}
                >
                  <option value="">All Screen Decisions</option>
                  <option value="PENDING">PENDING</option>
                  <option value="INCLUDE">INCLUDE</option>
                  <option value="EXCLUDE">EXCLUDE</option>
                </select>

                <select
                  className="bg-secondary/35 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold transition-colors"
                  value={calPdfFilter}
                  onChange={(e) => setCalPdfFilter(e.target.value)}
                >
                  <option value="">All PDF Statuses</option>
                  <option value="IGNORED">IGNORED</option>
                  <option value="MISSING">MISSING</option>
                  <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
                  <option value="MATCHED">MATCHED</option>
                  <option value="DOWNLOADED">DOWNLOADED</option>
                  <option value="SYNCED">SYNCED</option>
                </select>

                <select
                  className="bg-secondary/35 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold transition-colors"
                  value={calTagFilter}
                  onChange={(e) => setCalTagFilter(e.target.value)}
                >
                  <option value="">All Cohorts (No Tag Filter)</option>
                  <option value="none">General (No Tag)</option>
                  {poolTags.map((tag: any) => (
                    <option key={tag.code} value={tag.code}>
                      {tag.code} - {tag.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* DATA TABLE */}
            <div className="flex-1 flex flex-col overflow-hidden bg-card border border-border rounded-xl shadow-sm">
              {calLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="text-xs font-semibold">Loading calibration data...</span>
                </div>
              ) : calPapers.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <FileText className="w-12 h-12 text-muted-foreground/50 mb-3" />
                  <h4 className="font-bold text-sm mb-1 text-foreground">No papers in this pool</h4>
                  <p className="text-xs text-muted-foreground max-w-xs leading-relaxed mb-4">
                    No papers matching your filters are currently assigned to this calibration pool.
                  </p>
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 text-xs font-bold rounded-lg border border-border transition-colors uppercase tracking-wider text-[10px]"
                  >
                    Assign Papers Now
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-auto">
                    <table className="w-full table-fixed text-left text-xs border-collapse relative">
                      <thead className="sticky top-0 z-10 bg-secondary border-b border-border shadow-sm">
                        <tr className="text-muted-foreground text-[10px] font-bold uppercase">
                          <th className="p-3 w-[15%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleCalSort('Paper_ID')}>
                            <div className="flex items-center gap-1.5">
                              ID {renderCalSortIcon('Paper_ID')}
                            </div>
                          </th>
                          <th className="p-3 w-[30%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleCalSort('Title')}>
                            <div className="flex items-center gap-1.5">
                              Title {renderCalSortIcon('Title')}
                            </div>
                          </th>
                          <th className="p-3 w-[15%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleCalSort('Authors')}>
                            <div className="flex items-center gap-1.5">
                              Authors {renderCalSortIcon('Authors')}
                            </div>
                          </th>
                          <th className="p-3 w-[8%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleCalSort('Year')}>
                            <div className="flex items-center gap-1.5">
                              Year {renderCalSortIcon('Year')}
                            </div>
                          </th>
                          <th className="p-3 w-[12%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleCalSort('Local_PDF_Status')}>
                            <div className="flex items-center gap-1.5">
                              PDF Status {renderCalSortIcon('Local_PDF_Status')}
                            </div>
                          </th>
                          {calActivePool === 'pool_a' ? (
                            <>
                              <th className="p-3 w-[10%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleCalSort('manual_decision')}>
                                <div className="flex items-center gap-1.5">
                                  Human {renderCalSortIcon('manual_decision')}
                                </div>
                              </th>
                              <th className="p-3 w-[10%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleCalSort('Status')}>
                                <div className="flex items-center gap-1.5">
                                  AI Decision {renderCalSortIcon('Status')}
                                </div>
                              </th>
                            </>
                          ) : (
                            <th className="p-3 w-[10%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleCalSort('Status')}>
                              <div className="flex items-center gap-1.5">
                                Decision {renderCalSortIcon('Status')}
                              </div>
                            </th>
                          )}
                          <th className="p-3 w-[10%] text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {calPapers.map((p: any) => (
                          <tr key={p.Paper_ID} className="h-16 hover:bg-secondary/15 transition-colors group">
                            <td className="p-3 font-bold text-muted-foreground truncate" title={p.Paper_ID}>
                              {p.Paper_ID}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2 max-w-full">
                                <span className="font-bold text-foreground truncate" title={p.Title}>
                                  {p.Title}
                                </span>
                                {p.calibration_tag && (
                                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                                    {p.calibration_tag}
                                  </span>
                                )}
                              </div>
                              {p.Abstract && (
                                <div className="text-[10px] text-muted-foreground truncate mt-0.5 italic" title={p.Abstract}>
                                  {p.Abstract}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-muted-foreground truncate" title={p.Authors || '—'}>
                              {p.Authors || '—'}
                            </td>
                            <td className="p-3 text-muted-foreground font-semibold truncate">{p.Year || '—'}</td>
                            <td className="p-3 truncate">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${
                                  p.Local_PDF_Status === 'SYNCED' ? 'bg-emerald-500' :
                                  p.Local_PDF_Status === 'DOWNLOADED' || p.Local_PDF_Status === 'MATCHED' ? 'bg-amber-500 animate-pulse' :
                                  p.Local_PDF_Status === 'NEEDS_REVIEW' ? 'bg-purple-500' :
                                  p.Local_PDF_Status === 'FAILED' ? 'bg-destructive' :
                                  p.Local_PDF_Status === 'IGNORED' ? 'bg-muted-foreground/50' :
                                  'bg-transparent border border-muted-foreground'
                                }`} />
                                <span className="text-[10px] font-bold tracking-wider uppercase truncate">
                                  {p.Local_PDF_Status}
                                </span>
                                {p.PDF_Link && p.PDF_Link.startsWith('http') && (
                                  <a
                                    href={p.PDF_Link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary hover:text-primary/80 transition-colors p-0.5 rounded ml-1 shrink-0"
                                    title="Open Google Drive File"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </td>
                            
                            {/* Decisions Columns */}
                            {calActivePool === 'pool_a' ? (
                              <>
                                <td className="p-3 truncate">
                                  {p.manual_decision ? (
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border truncate inline-block ${
                                      p.manual_decision.toUpperCase().startsWith('INCLUDE') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                      p.manual_decision.toUpperCase().startsWith('EXCLUDE') ? 'bg-destructive/10 border-destructive/20 text-destructive' :
                                      'bg-secondary border-border text-muted-foreground'
                                    }`} title={p.manual_rationale || ''}>
                                      {p.manual_decision}{p.manual_decision === 'EXCLUDE' && p.manual_exclusion_code ? ` (${p.manual_exclusion_code})` : ''}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-muted-foreground/50 uppercase italic">—</span>
                                  )}
                                </td>
                                <td className="p-3 truncate">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border truncate inline-block ${
                                    p.Status === 'INCLUDE' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                    p.Status === 'EXCLUDE' ? 'bg-destructive/10 border-destructive/20 text-destructive' :
                                    'bg-secondary border-border text-muted-foreground'
                                  }`}>
                                    {p.Status}
                                  </span>
                                </td>
                              </>
                            ) : (
                              <td className="p-3 truncate">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border truncate inline-block ${
                                  p.Status === 'INCLUDE' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                  p.Status === 'EXCLUDE' ? 'bg-destructive/10 border-destructive/20 text-destructive' :
                                  'bg-secondary border-border text-muted-foreground'
                                }`}>
                                  {p.Status}
                                </span>
                              </td>
                            )}

                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setPaperModal({ isOpen: true, mode: 'view', paper: p })}
                                  className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"
                                  title="View Paper Details"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setPaperModal({ isOpen: true, mode: 'edit', paper: p })}
                                  className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-primary transition-colors"
                                  title="Edit Paper Details"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleAssignPool(p.Paper_ID, null)}
                                  className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-destructive transition-colors"
                                  title="Remove from Calibration Pool"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  <div className="px-4 py-3 border-t border-border bg-secondary/20 flex items-center justify-between shrink-0 select-none">
                    <div className="text-[10px] text-muted-foreground font-semibold uppercase">
                      Showing {calTotalPapers > 0 ? (calPage - 1) * calLimit + 1 : 0} to {Math.min(calPage * calLimit, calTotalPapers)} of {calTotalPapers} papers
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase">Rows:</span>
                        <select
                          className="bg-secondary border border-border rounded px-1.5 py-0.5 text-[10px] text-foreground focus:outline-none focus:border-primary font-bold"
                          value={calLimit}
                          onChange={(e) => {
                            setCalLimit(Number(e.target.value));
                            setCalPage(1);
                          }}
                        >
                          {[10, 25, 50, 100].map(val => (
                            <option key={val} value={val}>{val}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1 bg-secondary border border-border rounded-lg p-0.5">
                        <button
                          disabled={calPage === 1}
                          onClick={() => setCalPage((prev: any) => Math.max(1, prev - 1))}
                          className="p-1 hover:bg-background rounded-md text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-[10px] font-bold px-2 select-none">
                          {calPage} / {calTotalPages}
                        </span>
                        <button
                          disabled={calPage === calTotalPages}
                          onClick={() => setCalPage((prev: any) => Math.min(calTotalPages, prev + 1))}
                          className="p-1 hover:bg-background rounded-md text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}