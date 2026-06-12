import React from 'react';
import {
  Upload, Search, FileText, Check, AlertCircle, RefreshCw, X, Play,
  Download, FileSpreadsheet, Layers, Sparkles, AlertTriangle, ExternalLink, Trash2,
  ArrowUpDown, ArrowUp, ArrowDown, Eye, Edit2, ChevronLeft, ChevronRight,
  Minus, Maximize2, LayoutDashboard, Plus, Edit, Folder, Calendar, CheckCircle2,
  TrendingUp, BarChart3, Cloud, Database, ShieldAlert, Terminal, ArrowRightLeft,
  Lock, Unlock, Loader2, Settings, MoreHorizontal, Globe, BookOpen, UserCheck, Shield
} from 'lucide-react';

export default function PaperDatabaseView(props: any) {
  const { activeTab, setActiveTab, projects, setProjects, activeProjectId, setActiveProjectId, loadingProjects, setLoadingProjects, projectSubTab, setProjectSubTab, compressOnSync, setCompressOnSync, showCreateProjectModal, setShowCreateProjectModal, savingProject, setSavingProject, showEditProjectModal, setShowEditProjectModal, editingProjectId, setEditingProjectId, projectSettingsTab, setProjectSettingsTab, testingProjectConnection, setTestingProjectConnection, projectConnectionTestResult, setProjectConnectionTestResult, calibrationSubTab, setCalibrationSubTab, projectFormName, setProjectFormName, projectFormManifesto, setProjectFormManifesto, projectFormObjective, setProjectFormObjective, projectFormQuestions, setProjectFormQuestions, projectFormQaDefinition, setProjectFormQaDefinition, projectFormExclusionCriteria, setProjectFormExclusionCriteria, projectFormPoolA, setProjectFormPoolA, projectFormPoolB, setProjectFormPoolB, projectFormPoolC, setProjectFormPoolC, projectFormGDriveDest, setProjectFormGDriveDest, projectFormCloudProvider, setProjectFormCloudProvider, projectFormRemoteName, setProjectFormRemoteName, projectFormPoolTags, setProjectFormPoolTags, projectFormEcRules, setProjectFormEcRules, projectFormReasoningTemplate, setProjectFormReasoningTemplate, newProjName, setNewProjName, newProjFolder, setNewProjFolder, newProjManifesto, setNewProjManifesto, newProjObjective, setNewProjObjective, newProjQuestions, setNewProjQuestions, newProjQaDefinition, setNewProjQaDefinition, newProjExclusionCriteria, setNewProjExclusionCriteria, newProjPoolA, setNewProjPoolA, newProjPoolB, setNewProjPoolB, newProjPoolC, setNewProjPoolC, newProjGDriveDest, setNewProjGDriveDest, newProjCloudProvider, setNewProjCloudProvider, newProjRemoteName, setNewProjRemoteName, newProjPoolTags, setNewProjPoolTags, deleteProjectConfirm, setDeleteProjectConfirm, deleteProjectConfirmationText, setDeleteProjectConfirmationText, deletingProject, setDeletingProject, csvSource, setCsvSource, csvFile, setCsvFile, csvImportDate, setCsvImportDate, manualSource, setManualSource, manualImportDate, setManualImportDate, manualYear, setManualYear, manualTitle, setManualTitle, manualAuthors, setManualAuthors, manualDoi, setManualDoi, manualAbstract, setManualAbstract, manualIngesting, setManualIngesting, papers, setPapers, loadingPapers, setLoadingPapers, searchTerm, setSearchTerm, statusFilter, setStatusFilter, pdfFilter, setPdfFilter, deleteConfirm, setDeleteConfirm, deletingPaper, setDeletingPaper, deleteAllConfirm, setDeleteAllConfirm, isSettingsOpen, setIsSettingsOpen, toasts, setToasts, assignSelectedPaper, setAssignSelectedPaper, operationModal, setOperationModal, cloudProvider, cloudName, handleTestProjectConnection, handleAddPoolTag, handleUpdatePoolTag, activeProject, showToast, loadProjects, activateProject, handleCreateProject, handleSaveProjectManifesto, loadPapers, handleManualIngest, runBatchExecution, paperModal, setPaperModal, hasLocalPdf, showInterRaterModal, setShowInterRaterModal, showImport, setShowImport, pipelineStats, setPipelineStats, currentStep, setCurrentStep, isModalMinimized, setIsModalMinimized, formatBytes, getTimeEstimates, indexingState, logEndRef, handleResumeOperation, handleCancelOperation, renderCalSortIcon, handleCalSort, calActivePool, calPapers, calTotalPapers, calPage, calLimit, setCalLimit, setCalPage, calTotalPages, handleAssignPool, setSelectedParentPaper, setManualParentPaperId, setManualParentSearch, setShowParentSuggestions, showParentSuggestions, manualParentSearch, parentPaperSuggestions, LoaderIcon, handleSort, renderSortIcon, totalPapers, page, limit, setLimit, setPage, totalPages, calStats, setCalActivePool, handleExportCalPoolA, setShowAssignModal, calSearchTerm, setCalSearchTerm, calStatusFilter, setCalStatusFilter, calPdfFilter, setCalPdfFilter, calLoading, openProjectSettings, handleRemovePoolTag, handleAddEcRule, handleUpdateEcRule, handleRemoveEcRule, handleAddReasoningTemplate, handleUpdateReasoningTemplate, handleRemoveReasoningTemplate, handleCsvSelect, csvData, columnMapping, setColumnMapping, csvHeaders, previewPapers, previewStats, handleImport, importing, selectedParentPaper, setParentPaperSuggestions } = props;

  return (
    <>
      <div className="h-full flex flex-col bg-card border border-border rounded-xl shadow-lg overflow-hidden animate-in fade-in duration-200">

        {/* Search & Actions Panel */}
        <div className="p-4 border-b border-border bg-secondary/25 flex flex-wrap items-center justify-between gap-3 shrink-0">

          {/* Search field */}
          <div className="relative w-72">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              className="w-full bg-secondary border border-border rounded-lg pl-9 pr-4 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
              placeholder="Search ID, Title, DOI, Authors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <select
              className="bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="INCLUDE">INCLUDE</option>
              <option value="EXCLUDE">EXCLUDE</option>
            </select>

            <select
              className="bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
              value={pdfFilter}
              onChange={(e) => setPdfFilter(e.target.value)}
            >
              <option value="">All PDF Status</option>
              <option value="IGNORED">IGNORED</option>
              <option value="MISSING">MISSING</option>
              <option value="MATCHED">MATCHED</option>
              <option value="DOWNLOADED">DOWNLOADED</option>
              <option value="SYNCED">SYNCED</option>
              <option value="FAILED">FAILED</option>
            </select>

            <button
              onClick={() => setShowImport(true)}
              className="px-3 py-2 bg-secondary text-foreground border border-border hover:bg-secondary/80 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Ingestion Hub
            </button>

            <a
              href="/api/export"
              download
              className="px-3 py-2 bg-secondary text-foreground border border-border hover:bg-secondary/80 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </a>

            <button
              onClick={() => setDeleteAllConfirm(true)}
              disabled={operationModal.isExecuting}
              className="px-3 py-2 bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete All
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 flex flex-col overflow-hidden bg-card">
          {loadingPapers ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
              <LoaderIcon />
              <span className="text-xs font-medium">Loading papers database...</span>
            </div>
          ) : papers.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <FileText className="w-12 h-12 text-muted-foreground/50 mb-3" />
              <h4 className="font-bold text-sm mb-1 text-foreground">No papers found</h4>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                Try clearing filters, searching different keywords, or importing a fresh CSV spreadsheet to populate the database.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden bg-card">
              <div className="flex-1 overflow-auto">
                <table className="w-full table-fixed text-left text-xs border-collapse relative">
                  <thead className="sticky top-0 z-10 bg-secondary border-b border-border shadow-sm">
                    <tr className="text-muted-foreground text-[10px] font-bold uppercase">
                      <th className="p-3 w-[15%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleSort('Paper_ID')}>
                        <div className="flex items-center gap-1.5">
                          ID {renderSortIcon('Paper_ID')}
                        </div>
                      </th>
                      <th className="p-3 w-[30%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleSort('Title')}>
                        <div className="flex items-center gap-1.5">
                          Title {renderSortIcon('Title')}
                        </div>
                      </th>
                      <th className="p-3 w-[15%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleSort('Authors')}>
                        <div className="flex items-center gap-1.5">
                          Authors {renderSortIcon('Authors')}
                        </div>
                      </th>
                      <th className="p-3 w-[8%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleSort('Year')}>
                        <div className="flex items-center gap-1.5">
                          Year {renderSortIcon('Year')}
                        </div>
                      </th>
                      <th className="p-3 w-[12%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleSort('DOI')}>
                        <div className="flex items-center gap-1.5">
                          DOI {renderSortIcon('DOI')}
                        </div>
                      </th>
                      <th className="p-3 w-[10%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleSort('Local_PDF_Status')}>
                        <div className="flex items-center gap-1.5">
                          PDF Status {renderSortIcon('Local_PDF_Status')}
                        </div>
                      </th>
                      <th className="p-3 w-[10%] cursor-pointer hover:bg-secondary/30 select-none" onClick={() => handleSort('Status')}>
                        <div className="flex items-center gap-1.5">
                          Status {renderSortIcon('Status')}
                        </div>
                      </th>
                      <th className="p-3 w-[10%] text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {papers.map((p: any) => (
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
                        <td className="p-3 font-mono text-[10px] text-muted-foreground/80 truncate" title={p.DOI || '—'}>
                          {p.DOI || '—'}
                        </td>
                        <td className="p-3 truncate">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${p.Local_PDF_Status === 'SYNCED' ? 'bg-emerald-500' :
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
                                title={`Open ${cloudName} File`}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="p-3 truncate">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border truncate inline-block ${p.Status === 'INCLUDE' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                            p.Status === 'EXCLUDE' ? 'bg-destructive/10 border-destructive/20 text-destructive' :
                              'bg-secondary border-border text-muted-foreground'
                            }`}>
                            {p.Status}
                          </span>
                        </td>
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
                              onClick={() => setDeleteConfirm({ isOpen: true, paper: p })}
                              className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-destructive transition-colors"
                              title="Delete Paper"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
                  Showing {totalPapers > 0 ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, totalPapers)} of {totalPapers} papers
                </div>

                <div className="flex items-center gap-4">
                  {/* Rows per page selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase">Rows:</span>
                    <select
                      className="bg-secondary border border-border rounded px-1.5 py-0.5 text-[10px] text-foreground focus:outline-none focus:border-primary font-bold"
                      value={limit}
                      onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setPage(1);
                      }}
                    >
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>

                  {/* Navigation buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage((prev: any) => Math.max(prev - 1, 1))}
                      className="p-1 border border-border rounded hover:bg-secondary text-foreground disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    {/* Render page numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                      let targetPage = page;
                      if (totalPages <= 5) {
                        targetPage = idx + 1;
                      } else if (page <= 3) {
                        targetPage = idx + 1;
                      } else if (page > totalPages - 2) {
                        targetPage = totalPages - 4 + idx;
                      } else {
                        targetPage = page - 2 + idx;
                      }

                      if (targetPage < 1 || targetPage > totalPages) return null;

                      return (
                        <button
                          key={targetPage}
                          onClick={() => setPage(targetPage)}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-colors ${page === targetPage
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'bg-secondary border-border text-foreground hover:bg-secondary/80'
                            }`}
                        >
                          {targetPage}
                        </button>
                      );
                    })}

                    <button
                      disabled={page === totalPages}
                      onClick={() => setPage((prev: any) => Math.min(prev + 1, totalPages))}
                      className="p-1 border border-border rounded hover:bg-secondary text-foreground disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
