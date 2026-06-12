import React from 'react';
import { 
  Upload, Search, FileText, Check, AlertCircle, RefreshCw, X, Play, 
  Download, FileSpreadsheet, Layers, Sparkles, AlertTriangle, ExternalLink, Trash2,
  ArrowUpDown, ArrowUp, ArrowDown, Eye, Edit2, ChevronLeft, ChevronRight,
  Minus, Maximize2, LayoutDashboard, Plus, Edit, Folder, Calendar, CheckCircle2,
  TrendingUp, BarChart3, Cloud, Database, ShieldAlert, Terminal, ArrowRightLeft,
  Lock, Unlock, Loader2, Settings, MoreHorizontal, Globe, BookOpen, UserCheck, Shield
} from 'lucide-react';

export default function PreCalibrationView(props: any) {
  const {activeTab, setActiveTab, projects, setProjects, activeProjectId, setActiveProjectId, loadingProjects, setLoadingProjects, projectSubTab, setProjectSubTab, compressOnSync, setCompressOnSync, showCreateProjectModal, setShowCreateProjectModal, savingProject, setSavingProject, showEditProjectModal, setShowEditProjectModal, editingProjectId, setEditingProjectId, projectSettingsTab, setProjectSettingsTab, testingProjectConnection, setTestingProjectConnection, projectConnectionTestResult, setProjectConnectionTestResult, calibrationSubTab, setCalibrationSubTab, projectFormName, setProjectFormName, projectFormManifesto, setProjectFormManifesto, projectFormObjective, setProjectFormObjective, projectFormQuestions, setProjectFormQuestions, projectFormQaDefinition, setProjectFormQaDefinition, projectFormExclusionCriteria, setProjectFormExclusionCriteria, projectFormPoolA, setProjectFormPoolA, projectFormPoolB, setProjectFormPoolB, projectFormPoolC, setProjectFormPoolC, projectFormGDriveDest, setProjectFormGDriveDest, projectFormCloudProvider, setProjectFormCloudProvider, projectFormRemoteName, setProjectFormRemoteName, projectFormPoolTags, setProjectFormPoolTags, projectFormEcRules, setProjectFormEcRules, projectFormReasoningTemplate, setProjectFormReasoningTemplate, newProjName, setNewProjName, newProjFolder, setNewProjFolder, newProjManifesto, setNewProjManifesto, newProjObjective, setNewProjObjective, newProjQuestions, setNewProjQuestions, newProjQaDefinition, setNewProjQaDefinition, newProjExclusionCriteria, setNewProjExclusionCriteria, newProjPoolA, setNewProjPoolA, newProjPoolB, setNewProjPoolB, newProjPoolC, setNewProjPoolC, newProjGDriveDest, setNewProjGDriveDest, newProjCloudProvider, setNewProjCloudProvider, newProjRemoteName, setNewProjRemoteName, newProjPoolTags, setNewProjPoolTags, deleteProjectConfirm, setDeleteProjectConfirm, deleteProjectConfirmationText, setDeleteProjectConfirmationText, deletingProject, setDeletingProject, csvSource, setCsvSource, csvFile, setCsvFile, csvImportDate, setCsvImportDate, manualSource, setManualSource, manualImportDate, setManualImportDate, manualYear, setManualYear, manualTitle, setManualTitle, manualAuthors, setManualAuthors, manualDoi, setManualDoi, manualAbstract, setManualAbstract, manualIngesting, setManualIngesting, papers, setPapers, loadingPapers, setLoadingPapers, searchTerm, setSearchTerm, statusFilter, setStatusFilter, pdfFilter, setPdfFilter, deleteConfirm, setDeleteConfirm, deletingPaper, setDeletingPaper, deleteAllConfirm, setDeleteAllConfirm, isSettingsOpen, setIsSettingsOpen, toasts, setToasts, assignSelectedPaper, setAssignSelectedPaper, operationModal, setOperationModal, cloudProvider, cloudName, handleTestProjectConnection, handleAddPoolTag, handleUpdatePoolTag, activeProject, showToast, loadProjects, activateProject, handleCreateProject, handleSaveProjectManifesto, loadPapers, handleManualIngest, runBatchExecution, paperModal, setPaperModal, hasLocalPdf, showInterRaterModal, setShowInterRaterModal, showImport, setShowImport,     pipelineStats, setPipelineStats, currentStep, setCurrentStep, isModalMinimized, setIsModalMinimized, formatBytes, getTimeEstimates, indexingState, logEndRef, handleResumeOperation, handleCancelOperation, renderCalSortIcon, handleCalSort, calActivePool, calPapers, calTotalPapers, calPage, calLimit, setCalLimit, setCalPage, calTotalPages, handleAssignPool, setSelectedParentPaper, setManualParentPaperId, setManualParentSearch, setShowParentSuggestions, showParentSuggestions, manualParentSearch, parentPaperSuggestions, LoaderIcon, handleSort, renderSortIcon, totalPapers, page, limit, setLimit, setPage, totalPages, calStats, setCalActivePool, handleExportCalPoolA, setShowAssignModal, calSearchTerm, setCalSearchTerm, calStatusFilter, setCalStatusFilter, calPdfFilter, setCalPdfFilter, calLoading, openProjectSettings, handleRemovePoolTag, handleAddEcRule, handleUpdateEcRule, handleRemoveEcRule, handleAddReasoningTemplate, handleUpdateReasoningTemplate, handleRemoveReasoningTemplate, handleCsvSelect, csvData, columnMapping, setColumnMapping, csvHeaders, previewPapers, previewStats, handleImport, importing, selectedParentPaper, setParentPaperSuggestions} = props;

  return (
    <>
            <div className="h-full flex flex-col overflow-hidden space-y-6 animate-in fade-in duration-200">
              {/* TOP METRICS ROW */}
              {(() => {
                const activeProj = projects.find((p: any) => p.id === activeProjectId);
                const targetA = activeProj?.pool_a_size || 50;
                const targetB = activeProj?.pool_b_size || 30;
                const targetC = activeProj?.pool_c_size || 20;
                const countA = activeProj?.stats?.pool_a_count || 0;
                const countB = activeProj?.stats?.pool_b_count || 0;
                const countC = activeProj?.stats?.pool_c_count || 0;

                const pctA = Math.min(100, Math.round((countA / targetA) * 100));
                const pctB = Math.min(100, Math.round((countB / targetB) * 100));
                const pctC = Math.min(100, Math.round((countC / targetC) * 100));

                return (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
                    {/* Pool A Card */}
                    <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group">
                      <div className="space-y-1.5 z-10">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-indigo-400 uppercase font-black tracking-wider">Pool A (Fast Filter)</span>
                          <span className="text-[9px] font-mono font-bold bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded">PDF Not Required</span>
                        </div>
                        <h4 className="font-bold text-lg text-foreground font-mono">{countA} <span className="text-xs text-muted-foreground font-normal">/ {targetA} papers</span></h4>
                        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${pctA}%` }} />
                        </div>
                        <p className="text-[9px] text-muted-foreground flex justify-between">
                          <span>Progress: {pctA}%</span>
                          <span>Reviewed: {calStats.reviewedCount}</span>
                        </p>
                      </div>
                    </div>

                    {/* Pool B Card */}
                    <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group">
                      <div className="space-y-1.5 z-10">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-emerald-400 uppercase font-black tracking-wider">Pool B (Gatekeeper)</span>
                          <span className="text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">PDF Required</span>
                        </div>
                        <h4 className="font-bold text-lg text-foreground font-mono">{countB} <span className="text-xs text-muted-foreground font-normal">/ {targetB} papers</span></h4>
                        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pctB}%` }} />
                        </div>
                        <p className="text-[9px] text-muted-foreground">Progress: {pctB}%</p>
                      </div>
                    </div>

                    {/* Pool C Card */}
                    <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group">
                      <div className="space-y-1.5 z-10">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-amber-400 uppercase font-black tracking-wider">Pool C (Scientist)</span>
                          <span className="text-[9px] font-mono font-bold bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">PDF Required</span>
                        </div>
                        <h4 className="font-bold text-lg text-foreground font-mono">{countC} <span className="text-xs text-muted-foreground font-normal">/ {targetC} papers</span></h4>
                        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${pctC}%` }} />
                        </div>
                        <p className="text-[9px] text-muted-foreground">Progress: {pctC}%</p>
                      </div>
                    </div>

                    {/* Consensus Scorecard Card */}
                    <div className="bg-card border border-border p-3.5 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group">
                      <div className="space-y-1 z-10 flex flex-col h-full justify-between">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-primary uppercase font-black tracking-wider">Consensus Scorecard (Pool A)</span>
                          <span className="text-[9px] font-mono font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">Cohen's Kappa</span>
                        </div>
                        
                        <div className="flex items-center justify-between py-1">
                          <div>
                            <span className="text-[9px] text-muted-foreground block font-bold uppercase">Agreement</span>
                            <span className="text-sm font-black text-foreground font-mono">{calStats.agreementRate.toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-muted-foreground block font-bold uppercase">Kappa</span>
                            <span className="text-sm font-black text-primary font-mono">{calStats.kappa}</span>
                          </div>
                        </div>

                        {/* Confusion Matrix Mini Grid */}
                        <div className="grid grid-cols-4 gap-1 text-[8px] font-mono text-center border-t border-border/60 pt-1">
                          <div className="bg-secondary/40 rounded p-0.5">
                            <span className="text-muted-foreground block scale-90">TP</span>
                            <span className="font-bold text-foreground">{calStats.TP}</span>
                          </div>
                          <div className="bg-secondary/40 rounded p-0.5">
                            <span className="text-muted-foreground block scale-90">TN</span>
                            <span className="font-bold text-foreground">{calStats.TN}</span>
                          </div>
                          <div className="bg-secondary/40 rounded p-0.5">
                            <span className="text-muted-foreground block scale-90">FP</span>
                            <span className="font-bold text-foreground">{calStats.FP}</span>
                          </div>
                          <div className="bg-secondary/40 rounded p-0.5">
                            <span className="text-muted-foreground block scale-90">FN</span>
                            <span className="font-bold text-foreground">{calStats.FN}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

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
                  {/* Blinded Review SLR Import/Export only for Pool A */}
                  {calActivePool === 'pool_a' && (
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
                  )}

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
                    <option value="MATCHED">MATCHED</option>
                    <option value="DOWNLOADED">DOWNLOADED</option>
                    <option value="SYNCED">SYNCED</option>
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
                                <th className="p-3 w-[10%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleCalSort('Human_Decision')}>
                                  <div className="flex items-center gap-1.5">
                                    Human {renderCalSortIcon('Human_Decision')}
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
                                <div className="font-bold text-foreground truncate" title={p.Title}>
                                  {p.Title}
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
                                    p.Local_PDF_Status === 'FAILED' ? 'bg-destructive' :
                                    p.Local_PDF_Status === 'IGNORED' ? 'bg-muted-foreground/50' :
                                    'bg-destructive/60'
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
                                    {p.Human_Decision ? (
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border truncate inline-block ${
                                        p.Human_Decision === 'INCLUDE' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                        p.Human_Decision === 'EXCLUDE' ? 'bg-destructive/10 border-destructive/20 text-destructive' :
                                        'bg-secondary border-border text-muted-foreground'
                                      }`} title={p.Human_Rationale || ''}>
                                        {p.Human_Decision}
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
            </div>
         ) : activeTab !== 'database' && activeTab !== 'pre-calibration' ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-border rounded-xl bg-card/35 max-w-lg mx-auto my-12">
              <Layers className="w-12 h-12 text-muted-foreground/60 mb-4 animate-pulse" />
              <h3 className="font-bold text-sm mb-1 text-foreground">Workflow Stage On Hold</h3>
              <p className="text-xs text-muted-foreground max-w-sm leading-relaxed mb-4">
                This workflow block (&quot;{activeTab.replace('-', ' ')}&quot;) is currently on hold. We are polishing the Paper Database stage first.
              </p>
              <button
                onClick={() => setActiveTab('database')}
                className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 text-xs font-semibold rounded-lg border border-border transition-colors"
              >
                Back to Paper Database
              </button>
            </div>
          ) : operationModal.isOpen && !isModalMinimized ? (
            /* BATCH PDF PIPELINE PANEL CARD */
            <div className="h-full flex flex-col bg-card border border-border rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/25 shrink-0">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-primary fill-current animate-pulse" />
                  <h3 className="font-bold text-sm">{operationModal.title}</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsModalMinimized(true)}
                    className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-[10px] font-bold uppercase"
                    title="Minimize to Widget"
                  >
                    <Minus className="w-4 h-4" />
                    Minimize
                  </button>
                  {!operationModal.isExecuting && (
                    <button 
                      onClick={() => {
                        setOperationModal((prev: any) => ({ ...prev, isOpen: false }));
                        setCurrentStep(null);
                      }} 
                      className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 p-5 overflow-hidden flex flex-col space-y-4">
                {/* Progress bar */}
                <div className="space-y-1.5 shrink-0">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase text-muted-foreground">
                    <span>{operationModal.statusText}</span>
                    <span>{operationModal.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-secondary border border-border rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300 rounded-full" 
                      style={{ width: `${operationModal.progress}%` }} 
                    />
                  </div>
                </div>

                {/* Statistics Row */}
                {currentStep && (
                  (() => {
                    let statsFound = 0;
                    let statsNotFound = 0;
                    let statsTotal = pipelineStats.total;
                    let statsCurrent = pipelineStats.current;

                    if (currentStep === 'scan') {
                      statsFound = pipelineStats.matched;
                      statsNotFound = Math.max(0, pipelineStats.current - pipelineStats.matched);
                    } else if (currentStep === 'scrape') {
                    statsFound = pipelineStats.downloaded;
                      statsNotFound = pipelineStats.failed;
                    } else if (currentStep === 'sync') {
                      statsFound = pipelineStats.current;
                      statsNotFound = pipelineStats.failed;
                    }

                    if (currentStep === 'compress') {
                      const ratio = pipelineStats.originalSpaceBytes > 0 
                        ? (pipelineStats.savedSpaceBytes / pipelineStats.originalSpaceBytes) * 100 
                        : 0;
                      return (
                        <div className="grid grid-cols-3 gap-3 shrink-0 text-[10px] select-none">
                          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 flex flex-col items-center justify-center">
                            <span className="font-bold text-emerald-400 uppercase tracking-wide">Processed / Total</span>
                            <span className="text-sm font-black text-emerald-400 mt-0.5">{statsCurrent} / {statsTotal || '—'}</span>
                          </div>
                          <div className="bg-primary/5 border border-primary/20 rounded-lg p-2 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-200">
                            <span className="font-bold text-primary uppercase tracking-wide">Space Saved</span>
                            <span className="text-sm font-black text-primary mt-0.5">{formatBytes(pipelineStats.savedSpaceBytes)}</span>
                          </div>
                          <div className="bg-secondary border border-border rounded-lg p-2 flex flex-col items-center justify-center">
                            <span className="font-bold text-muted-foreground uppercase tracking-wide">Original Total Size</span>
                            <span className="text-sm font-black text-foreground mt-0.5">
                              {formatBytes(pipelineStats.originalSpaceBytes)} {ratio > 0 ? `(-${ratio.toFixed(1)}%)` : ''}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    if (currentStep === 'sync') {
                      const isLinking = pipelineStats.total > 0;
                      const syncStatus = isLinking ? "Generating Links..." : "Syncing Files (Rclone)...";
                      return (
                        <div className="grid grid-cols-3 gap-3 shrink-0 text-[10px] select-none animate-in fade-in zoom-in duration-200">
                          <div className="bg-primary/5 border border-primary/20 rounded-lg p-2 flex flex-col items-center justify-center">
                            <span className="font-bold text-primary uppercase tracking-wide">Sync Phase</span>
                            <span className="text-sm font-black text-primary mt-0.5">{syncStatus}</span>
                          </div>
                          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 flex flex-col items-center justify-center">
                            <span className="font-bold text-emerald-400 uppercase tracking-wide">Links Generated</span>
                            <span className="text-sm font-black text-emerald-400 mt-0.5">{statsFound} / {statsTotal || '—'}</span>
                          </div>
                          <div className={`rounded-lg p-2 flex flex-col items-center justify-center border ${statsNotFound > 0 ? 'bg-destructive/5 border-destructive/20 text-destructive animate-pulse' : 'bg-secondary border-border text-muted-foreground'}`}>
                            <span className={`font-bold uppercase tracking-wide ${statsNotFound > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>Link Failures</span>
                            <span className={`text-sm font-black mt-0.5 ${statsNotFound > 0 ? 'text-destructive' : 'text-foreground'}`}>{statsNotFound}</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-3 gap-3 shrink-0 text-[10px] select-none">
                        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 flex flex-col items-center justify-center">
                          <span className="font-bold text-emerald-400 uppercase tracking-wide">Found / Success</span>
                          <span className="text-sm font-black text-emerald-400 mt-0.5">{statsFound}</span>
                        </div>
                        <div className="bg-destructive/5 border border-destructive/10 rounded-lg p-2 flex flex-col items-center justify-center">
                          <span className="font-bold text-destructive uppercase tracking-wide">Not Found / Fail</span>
                          <span className="text-sm font-black text-destructive mt-0.5">{statsNotFound}</span>
                        </div>
                        <div className="bg-secondary border border-border rounded-lg p-2 flex flex-col items-center justify-center">
                          <span className="font-bold text-muted-foreground uppercase tracking-wide">Processed / Total</span>
                          <span className="text-sm font-black text-foreground mt-0.5">{statsCurrent} / {statsTotal || '—'}</span>
                        </div>
                      </div>
                    );
                  })()
                )}

                {currentStep && (
                  (() => {
                    const { avgTime, timeLeft } = getTimeEstimates();
                    return (
                      <div className="bg-secondary/15 border border-border/80 rounded-lg p-2.5 flex items-center justify-between text-[10px] select-none shrink-0 font-semibold text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-pulse" />
                          <span>Average Speed:</span>
                          <span className="text-foreground font-black">{avgTime} / paper</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span>Time Remaining:</span>
                          <span className="text-primary font-black tracking-wide">{timeLeft}</span>
                        </div>
                      </div>
                    );
                  })()
                )}

                {indexingState && (
                  <div className="bg-primary/5 border border-primary/10 rounded-lg p-2.5 flex items-center justify-between text-[10px] select-none shrink-0 font-semibold text-muted-foreground animate-in fade-in duration-200">
                    <div className="flex items-center gap-1.5 text-primary max-w-[70%]">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping shrink-0" />
                      <span className="shrink-0 font-bold">Indexing Cache:</span>
                      <span className="text-foreground font-black truncate" title={indexingState.filename}>
                        {indexingState.filename}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span>
                        Tool: <span className="text-foreground font-black uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[9px]">{indexingState.tool}</span>
                      </span>
                      <span className="text-primary font-bold">
                        ({indexingState.current}/{indexingState.total})
                      </span>
                    </div>
                  </div>
                )}

                {operationModal.currentItem && (
                  <div className="bg-secondary/30 border border-border rounded-lg p-2.5 text-[10px] font-bold text-foreground shrink-0 whitespace-normal break-words">
                    Current paper: {operationModal.currentItem}
                  </div>
                )}

                {/* Logs area */}
                <div className="flex-1 bg-secondary/15 border border-border rounded-lg p-3 overflow-y-auto font-mono text-[10px] leading-relaxed text-muted-foreground space-y-1 select-text">
                  {operationModal.logs.slice(-500).map((log: any, idx: any) => (
                    <div key={idx} className={
                      log.includes('✓') || log.includes('[SUCCESS]') || log.includes('>>>') ? 'text-emerald-400' :
                      log.includes('✗') || log.includes('[ERROR]') || log.includes('<<<') ? 'text-destructive' :
                      log.includes('[START]') ? 'text-primary font-bold' :
                      log.includes('[SKIPPED]') ? 'text-amber-500/70' :
                      log.includes('[SCANNING]') ? 'text-muted-foreground/60' : 'text-muted-foreground'
                    }>
                      {log}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-4 border-t border-border flex items-center justify-end bg-secondary/25 shrink-0 gap-3">
                {operationModal.isExecuting && operationModal.isWaitingLogin && (
                  <button
                    onClick={handleResumeOperation}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white hover:text-white text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-colors flex items-center gap-1.5 animate-pulse"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Resume Download
                  </button>
                )}
                {operationModal.isExecuting && (
                  <button
                    onClick={handleCancelOperation}
                    className="px-4 py-2 border border-border text-xs font-semibold rounded-lg hover:bg-secondary text-foreground transition-colors"
                  >
                    Cancel Process
                  </button>
                )}
                {!operationModal.isExecuting && (
                  <button
                    onClick={() => {
                      setOperationModal((prev: any) => ({ ...prev, isOpen: false }));
                      setCurrentStep(null);
                    }}
                    className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-colors"
                  >
                    Close Window
                  </button>
                )}
              </div>
            </div>
    </>
  );
}
