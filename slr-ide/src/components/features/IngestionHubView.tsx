import React from 'react';
import {
  Upload, Search, FileText, Check, AlertCircle, RefreshCw, X, Play,
  Download, FileSpreadsheet, Layers, Sparkles, AlertTriangle, ExternalLink, Trash2,
  ArrowUpDown, ArrowUp, ArrowDown, Eye, Edit2, ChevronLeft, ChevronRight,
  Minus, Maximize2, LayoutDashboard, Plus, Edit, Folder, Calendar, CheckCircle2,
  TrendingUp, BarChart3, Cloud, Database, ShieldAlert, Terminal, ArrowRightLeft,
  Lock, Unlock, Loader2, Settings, MoreHorizontal, Globe, BookOpen, UserCheck, Shield
} from 'lucide-react';
import { useAppState } from '@/hooks/AppStateProvider';

export default function IngestionHubView() {
  const props = useAppState();
  const { activeTab, setActiveTab, projects, setProjects, activeProjectId, setActiveProjectId, loadingProjects, setLoadingProjects, projectSubTab, setProjectSubTab, compressOnSync, setCompressOnSync, showCreateProjectModal, setShowCreateProjectModal, savingProject, setSavingProject, showEditProjectModal, setShowEditProjectModal, editingProjectId, setEditingProjectId, projectSettingsTab, setProjectSettingsTab, testingProjectConnection, setTestingProjectConnection, projectConnectionTestResult, setProjectConnectionTestResult, calibrationSubTab, setCalibrationSubTab, projectFormName, setProjectFormName, projectFormManifesto, setProjectFormManifesto, projectFormObjective, setProjectFormObjective, projectFormQuestions, setProjectFormQuestions, projectFormQaDefinition, setProjectFormQaDefinition, projectFormExclusionCriteria, setProjectFormExclusionCriteria, projectFormPoolA, setProjectFormPoolA, projectFormPoolB, setProjectFormPoolB, projectFormPoolC, setProjectFormPoolC, projectFormGDriveDest, setProjectFormGDriveDest, projectFormCloudProvider, setProjectFormCloudProvider, projectFormRemoteName, setProjectFormRemoteName, projectFormPoolTags, setProjectFormPoolTags, projectFormEcRules, setProjectFormEcRules, projectFormReasoningTemplate, setProjectFormReasoningTemplate, newProjName, setNewProjName, newProjFolder, setNewProjFolder, newProjManifesto, setNewProjManifesto, newProjObjective, setNewProjObjective, newProjQuestions, setNewProjQuestions, newProjQaDefinition, setNewProjQaDefinition, newProjExclusionCriteria, setNewProjExclusionCriteria, newProjPoolA, setNewProjPoolA, newProjPoolB, setNewProjPoolB, newProjPoolC, setNewProjPoolC, newProjGDriveDest, setNewProjGDriveDest, newProjCloudProvider, setNewProjCloudProvider, newProjRemoteName, setNewProjRemoteName, newProjPoolTags, setNewProjPoolTags, deleteProjectConfirm, setDeleteProjectConfirm, deleteProjectConfirmationText, setDeleteProjectConfirmationText, deletingProject, setDeletingProject, csvSource, setCsvSource, csvFile, setCsvFile, csvImportDate, setCsvImportDate, manualSource, setManualSource, manualImportDate, setManualImportDate, manualYear, setManualYear, manualTitle, setManualTitle, manualAuthors, setManualAuthors, manualDoi, setManualDoi, manualAbstract, setManualAbstract, manualIngesting, setManualIngesting, papers, setPapers, loadingPapers, setLoadingPapers, searchTerm, setSearchTerm, statusFilter, setStatusFilter, pdfFilter, setPdfFilter, deleteConfirm, setDeleteConfirm, deletingPaper, setDeletingPaper, deleteAllConfirm, setDeleteAllConfirm, isSettingsOpen, setIsSettingsOpen, toasts, setToasts, assignSelectedPaper, setAssignSelectedPaper, operationModal, setOperationModal, cloudProvider, cloudName, handleTestProjectConnection, handleAddPoolTag, handleUpdatePoolTag, activeProject, showToast, loadProjects, activateProject, handleCreateProject, handleSaveProjectManifesto, loadPapers, handleManualIngest, runBatchExecution, paperModal, setPaperModal, hasLocalPdf, showInterRaterModal, setShowInterRaterModal, showImport, setShowImport, pipelineStats, setPipelineStats, currentStep, setCurrentStep, isModalMinimized, setIsModalMinimized, formatBytes, getTimeEstimates, indexingState, logEndRef, handleResumeOperation, handleCancelOperation, renderCalSortIcon, handleCalSort, calActivePool, calPapers, calTotalPapers, calPage, calLimit, setCalLimit, setCalPage, calTotalPages, handleAssignPool, setSelectedParentPaper, setManualParentPaperId, setManualParentSearch, setShowParentSuggestions, showParentSuggestions, manualParentSearch, parentPaperSuggestions, LoaderIcon, handleSort, renderSortIcon, totalPapers, page, limit, setLimit, setPage, totalPages, calStats, setCalActivePool, handleExportCalPoolA, setShowAssignModal, calSearchTerm, setCalSearchTerm, calStatusFilter, setCalStatusFilter, calPdfFilter, setCalPdfFilter, calLoading, openProjectSettings, handleRemovePoolTag, handleAddEcRule, handleUpdateEcRule, handleRemoveEcRule, handleAddReasoningTemplate, handleUpdateReasoningTemplate, handleRemoveReasoningTemplate, handleCsvSelect, csvData, columnMapping, setColumnMapping, csvHeaders, previewPapers, previewStats, handleImport, importing, selectedParentPaper, setParentPaperSuggestions } = props;

  const [isReviewModalOpen, setIsReviewModalOpen] = React.useState(false);
  const [reviewPage, setReviewPage] = React.useState(1);
  const [reviewLimit, setReviewLimit] = React.useState(50);
  const [reviewSearch, setReviewSearch] = React.useState('');
  const [reviewStatusFilter, setReviewStatusFilter] = React.useState('all');

  // Filtered review papers
  const filteredReviewPapers = React.useMemo(() => {
    return previewPapers.filter((p: any) => {
      const matchesSearch = p.Title?.toLowerCase().includes(reviewSearch.toLowerCase()) || 
                            p.Paper_ID?.toLowerCase().includes(reviewSearch.toLowerCase());
      const matchesStatus = reviewStatusFilter === 'all' || 
                            (reviewStatusFilter === 'new' && !p.isDuplicate) || 
                            (reviewStatusFilter === 'duplicate' && p.isDuplicate);
      return matchesSearch && matchesStatus;
    });
  }, [previewPapers, reviewSearch, reviewStatusFilter]);

  const totalReviewPages = Math.ceil(filteredReviewPapers.length / reviewLimit);
  const paginatedReviewPapers = filteredReviewPapers.slice((reviewPage - 1) * reviewLimit, reviewPage * reviewLimit);

  return (
    <>
      <div className="h-full flex flex-col bg-card border border-border rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/25">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm">Ingestion Hub</h3>
          </div>
          <button onClick={() => setShowImport(false)} className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: Bulk CSV Ingest */}
            <div className="lg:col-span-7 space-y-6 border-r border-border/50 pr-6">
              <div>
                <h4 className="font-bold text-xs text-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-primary" />
                  Bulk CSV Ingest
                </h4>

                {!csvFile ? (
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-border/80 rounded-lg py-12 px-6 bg-secondary/5 hover:bg-secondary/15 transition-colors cursor-pointer group relative">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCsvSelect}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Upload className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors mb-3" />
                    <span className="text-xs font-bold text-foreground">Click to upload or drag CSV file</span>
                    <span className="text-[10px] text-muted-foreground mt-1">Conforms to 00_Raw_Harvest schema headers</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between bg-secondary/35 border border-border rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <FileText className="w-8 h-8 text-primary" />
                        <div>
                          <h4 className="font-semibold text-xs text-foreground">{csvFile.name}</h4>
                          <p className="text-[10px] text-muted-foreground">{(csvFile.size / 1024).toFixed(1)} KB • {csvData.length} records</p>
                        </div>
                      </div>
                      <button onClick={() => setCsvFile(null)} className="text-xs font-semibold text-destructive hover:underline flex items-center gap-1">
                        <Trash2 className="w-3.5 h-3.5" />
                        Change File
                      </button>
                    </div>

                    {/* Column Mapping Configuration */}
                    <div className="space-y-4">
                      <h5 className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-primary" />
                        Visual Column Mapper
                      </h5>

                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { key: 'Paper_ID', label: 'Paper ID (Unique)', req: false },
                          { key: 'Title', label: 'Title', req: true },
                          { key: 'DOI', label: 'DOI (Digital Object Identifier)', req: false },
                          { key: 'Abstract', label: 'Abstract', req: false },
                          { key: 'Authors', label: 'Authors', req: false },
                          { key: 'Year', label: 'Year', req: false },
                          { key: 'Original_Publisher', label: 'Original Publisher', req: false },
                          { key: 'Publisher', label: 'Publisher (Initial Empty)', req: false },
                          { key: 'PDF_Link', label: 'PDF Link / Cloud URL', req: false },
                          { key: 'Status', label: 'Status (e.g. INCLUDE)', req: false }
                        ].map((col) => {
                          const isMapped = !!columnMapping[col.key];

                          return (
                            <div key={col.key} className="space-y-1">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center justify-between">
                                <span>
                                  {col.label} {col.req && <span className="text-destructive">*</span>}
                                </span>
                                {isMapped ? (
                                  <span className="text-emerald-400 flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wider bg-emerald-500/10 px-1 py-0.5 rounded">
                                    <Check className="w-2.5 h-2.5" />
                                    Mapped
                                  </span>
                                ) : col.req ? (
                                  <span className="text-destructive text-[8px] font-bold uppercase tracking-wider bg-destructive/10 px-1 py-0.5 rounded">
                                    Required
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-[8px] font-bold uppercase tracking-wider bg-secondary px-1 py-0.5 rounded">
                                    Empty
                                  </span>
                                )}
                              </label>

                              <select
                                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-medium"
                                value={columnMapping[col.key] || ''}
                                onChange={(e) => setColumnMapping((prev: any) => ({ ...prev, [col.key]: e.target.value }))}
                              >
                                <option value="">-- Skip / Not present --</option>
                                {csvHeaders.map((h: any) => (
                                  <option key={h} value={h}>{h}</option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Deduplication & Preview Summary */}
                    {previewPapers.length > 0 && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <button onClick={() => setIsReviewModalOpen(true)} className="bg-secondary/20 hover:bg-secondary/40 transition-colors border border-border hover:border-primary/50 rounded-lg p-3 text-center cursor-pointer">
                            <span className="text-[10px] text-muted-foreground font-semibold uppercase">Total Rows</span>
                            <div className="text-lg font-black text-foreground mt-0.5">{previewStats.total}</div>
                            <span className="text-[9px] text-primary mt-1 block">Click to review</span>
                          </button>
                          <button onClick={() => { setReviewStatusFilter('new'); setIsReviewModalOpen(true); }} className="bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors border border-emerald-500/10 hover:border-emerald-500/30 rounded-lg p-3 text-center cursor-pointer">
                            <span className="text-[10px] text-emerald-400 font-semibold uppercase">New Papers</span>
                            <div className="text-lg font-black text-emerald-400 mt-0.5">{previewStats.newCount}</div>
                            <span className="text-[9px] text-primary mt-1 block">Click to review</span>
                          </button>
                          <button onClick={() => { setReviewStatusFilter('duplicate'); setIsReviewModalOpen(true); }} className="bg-amber-500/5 hover:bg-amber-500/10 transition-colors border border-amber-500/10 hover:border-amber-500/30 rounded-lg p-3 text-center cursor-pointer">
                            <span className="text-[10px] text-amber-500/80 font-semibold uppercase">Duplicates Detected</span>
                            <div className="text-lg font-black text-amber-500 mt-0.5">{previewStats.dupCount}</div>
                            <span className="text-[9px] text-primary mt-1 block">Click to review</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        onClick={handleImport}
                        disabled={importing || !csvFile || previewStats.newCount === 0}
                        className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {importing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        Execute Bulk Import ({previewStats.newCount})
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Manual Ingest (Snowballing) */}
            <div className="lg:col-span-5 space-y-6">
              <h4 className="font-bold text-xs text-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-primary" />
                Manual Ingest (Snowballing)
              </h4>

              <form onSubmit={handleManualIngest} className="space-y-4 bg-secondary/10 border border-border/50 rounded-xl p-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Source Scope *</label>
                    <select
                      value={manualSource}
                      onChange={(e) => setManualSource(e.target.value)}
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                    >
                      <option value="Backward Snowball">Backward Snowball</option>
                      <option value="Forward Snowball">Forward Snowball</option>
                      <option value="Manual Search">Manual Search</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Import Date *</label>
                    <input
                      type="date"
                      required
                      value={manualImportDate}
                      onChange={(e) => setManualImportDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold font-mono"
                    />
                  </div>
                </div>

                {/* Parent Paper Chaining Search Input */}
                <div className="relative">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Parent Paper (Chained Reference)</label>
                  {selectedParentPaper ? (
                    <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5 text-xs text-primary font-semibold">
                      <span className="truncate flex-1" title={selectedParentPaper.Title}>
                        {selectedParentPaper.Title} ({selectedParentPaper.Paper_ID})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedParentPaper(null);
                          setManualParentPaperId('');
                          setManualParentSearch('');
                        }}
                        className="ml-2 text-primary hover:text-primary-foreground focus:outline-none"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          value={manualParentSearch}
                          onChange={(e) => {
                            setManualParentSearch(e.target.value);
                            setShowParentSuggestions(true);
                          }}
                          onFocus={() => setShowParentSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowParentSuggestions(false), 200)}
                          placeholder="Search parent paper by title or ID..."
                          className="w-full px-3 py-1.5 pr-8 text-xs bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
                        />
                        {manualParentSearch && (
                          <button
                            type="button"
                            onClick={() => {
                              setManualParentSearch('');
                              setParentPaperSuggestions([]);
                            }}
                            className="absolute right-2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      {showParentSuggestions && parentPaperSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y divide-border">
                          {parentPaperSuggestions.map((p: any) => (
                            <div
                              key={p.Paper_ID}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setSelectedParentPaper(p);
                                setManualParentPaperId(p.Paper_ID);
                                setManualParentSearch('');
                                setShowParentSuggestions(false);
                              }}
                              className="px-3 py-2 text-xs hover:bg-secondary cursor-pointer transition-colors text-foreground font-semibold flex flex-col gap-0.5"
                            >
                              <span className="font-bold truncate">{p.Title}</span>
                              <span className="text-[10px] text-muted-foreground truncate">{p.Authors || 'Unknown authors'} ({p.Year || 'N/A'})</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {showParentSuggestions && manualParentSearch.trim() && parentPaperSuggestions.length === 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl px-3 py-2 text-xs text-muted-foreground">
                          No matching papers found
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-3">
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Digital Object Identifier (DOI)</label>
                    <input
                      type="text"
                      value={manualDoi}
                      onChange={(e) => setManualDoi(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold font-mono"
                      placeholder="e.g. 10.1145/3318464.3389700"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Year</label>
                    <input
                      type="text"
                      value={manualYear}
                      onChange={(e) => setManualYear(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold font-mono text-center"
                      placeholder="e.g. 2024"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Paper Title *</label>
                  <input
                    type="text"
                    required
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
                    placeholder="e.g. SLR Magic: Automated System Architecture"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Authors List</label>
                  <input
                    type="text"
                    value={manualAuthors}
                    onChange={(e) => setManualAuthors(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
                    placeholder="e.g. Aditya Suranata, et al."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Abstract Preview</label>
                  <textarea
                    rows={3}
                    value={manualAbstract}
                    onChange={(e) => setManualAbstract(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
                    placeholder="Enter summary or abstract notes..."
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={manualIngesting}
                    className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {manualIngesting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Execute Manual Ingest
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Import Footer Actions */}
        <div className="p-4 border-t border-border flex items-center justify-end bg-secondary/25 gap-3 shrink-0">
          <button
            onClick={() => setShowImport(false)}
            className="px-4 py-2 border border-border text-xs font-semibold rounded-lg hover:bg-secondary text-foreground transition-colors"
          >
            Close Hub
          </button>
        </div>
      </div>

      {/* CSV Review Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-6xl h-[85vh] rounded-xl border border-border shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/30">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-bold text-sm">Review Incoming Data</h3>
                  <p className="text-[10px] text-muted-foreground">Observe mapped CSV data before import</p>
                </div>
              </div>
              <button onClick={() => setIsReviewModalOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors bg-secondary/50 hover:bg-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-b border-border bg-secondary/10 flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by Title or ID..."
                  value={reviewSearch}
                  onChange={(e) => { setReviewSearch(e.target.value); setReviewPage(1); }}
                  className="w-full pl-9 pr-4 py-1.5 bg-secondary border border-border rounded-lg text-xs focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Status Filter:</span>
                  <select
                    value={reviewStatusFilter}
                    onChange={(e) => { setReviewStatusFilter(e.target.value); setReviewPage(1); }}
                    className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary"
                  >
                    <option value="all">All Records</option>
                    <option value="new">New Papers Only</option>
                    <option value="duplicate">Duplicates Only</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Rows per page:</span>
                  <select
                    value={reviewLimit}
                    onChange={(e) => { setReviewLimit(Number(e.target.value)); setReviewPage(1); }}
                    className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                <thead className="sticky top-0 bg-card z-10 shadow-sm">
                  <tr className="border-b border-border bg-secondary/30 text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                    <th className="p-3 pl-4 font-semibold">Status</th>
                    <th className="p-3 font-semibold">Paper ID</th>
                    <th className="p-3 font-semibold w-1/3 min-w-[300px]">Title</th>
                    <th className="p-3 font-semibold">Authors</th>
                    <th className="p-3 font-semibold">Year</th>
                    <th className="p-3 font-semibold">DOI</th>
                    <th className="p-3 font-semibold">Original Publisher</th>
                    <th className="p-3 font-semibold">Publisher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {paginatedReviewPapers.length > 0 ? (
                    paginatedReviewPapers.map((p: any, idx: number) => (
                      <tr key={idx} className="hover:bg-secondary/20 transition-colors">
                        <td className="p-3 pl-4">
                          {p.isDuplicate ? (
                            <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit">
                              <AlertTriangle className="w-3 h-3" /> Skip
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit">
                              <Check className="w-3 h-3" /> Import
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground font-mono text-[10px]">{p.Paper_ID}</td>
                        <td className="p-3 font-semibold text-foreground truncate max-w-[300px]" title={p.Title}>{p.Title}</td>
                        <td className="p-3 text-muted-foreground truncate max-w-[150px]" title={p.Authors}>{p.Authors || '—'}</td>
                        <td className="p-3 text-muted-foreground">{p.Year || '—'}</td>
                        <td className="p-3 text-muted-foreground font-mono text-[10px]">{p.DOI || '—'}</td>
                        <td className="p-3 text-muted-foreground truncate max-w-[150px]" title={p.Original_Publisher}>{p.Original_Publisher || '—'}</td>
                        <td className="p-3 text-muted-foreground truncate max-w-[150px]" title={p.Publisher}>{p.Publisher || '—'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Search className="w-8 h-8 opacity-20" />
                          <p>No records found matching filters.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 border-t border-border bg-secondary/10 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold">
                Showing {(reviewPage - 1) * reviewLimit + 1} - {Math.min(reviewPage * reviewLimit, filteredReviewPapers.length)} of {filteredReviewPapers.length} mapped records
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setReviewPage(Math.max(1, reviewPage - 1))}
                  disabled={reviewPage === 1}
                  className="p-1.5 rounded bg-secondary hover:bg-secondary/80 disabled:opacity-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 font-bold text-foreground">
                  Page {reviewPage} of {totalReviewPages || 1}
                </span>
                <button
                  onClick={() => setReviewPage(Math.min(totalReviewPages, reviewPage + 1))}
                  disabled={reviewPage === totalReviewPages || totalReviewPages === 0}
                  className="p-1.5 rounded bg-secondary hover:bg-secondary/80 disabled:opacity-50 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
