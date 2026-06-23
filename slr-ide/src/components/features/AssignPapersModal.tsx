import React, { useState, useRef, useEffect } from 'react';
import { ShieldAlert, Plus, RefreshCw, X, ChevronLeft, ChevronRight, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Search, CheckCircle2, ExternalLink, AlertTriangle, Play, Terminal } from 'lucide-react';

export default function AssignPapersModal({ allProps }: { allProps: any }) {
  const {
    projects, activeProjectId, assignSearch, setAssignSearch, assignPoolFilter, setAssignPoolFilter,
    assignPapers, assignTotalPapers, assignPage, setAssignPage, assignTotalPages, assignLoading, assignSelectedPaper, setAssignSelectedPaper,
    activeAssignDropdown, setActiveAssignDropdown, handleAssignPool, showAssignModal, setShowAssignModal, calPapers,
    activeProject, loadCalPapers, loadPapers, formatBytes, showToast, cloudName,
    assignIsRunning, setAssignIsRunning, assignLogs, setAssignLogs, assignProgress, setAssignProgress, assignStatusText, setAssignStatusText,
    assignWaitingLogin, setAssignWaitingLogin, singlePipelineAbortControllerRef, runSinglePaperPipeline
  } = allProps;

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [assignLogs]);

  const getActiveProjectPoolTags = (poolId: string) => {
    if (!activeProject) return [];
    if (poolId === 'pool_a') return activeProject.Pool_A_Tags || [];
    if (poolId === 'pool_b') return activeProject.Pool_B_Tags || [];
    if (poolId === 'pool_c') return activeProject.Pool_C_Tags || [];
    return [];
  };

  if (!showAssignModal) return null;

  return (
    <>
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col animate-in fade-in duration-300">
          {/* Header */}
          <div className="h-16 px-6 border-b border-border bg-card/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-primary animate-pulse" />
              <div>
                <h3 className="font-bold text-sm">Assign Papers to Calibration Pools</h3>
                <p className="text-[10px] text-muted-foreground font-medium">Select and partition literature references into independent calibration sets</p>
              </div>
            </div>

            {/* Realtime progress bars inside header */}
            {(() => {
              const activeProj = projects.find((p: any) => p.id === activeProjectId);
              const targetA = activeProj?.pool_a_size || 50;
              const targetB = activeProj?.pool_b_size || 30;
              const targetC = activeProj?.pool_c_size || 20;
              const countA = activeProj?.stats?.pool_a_count || 0;
              const countB = activeProj?.stats?.pool_b_count || 0;
              const countC = activeProj?.stats?.pool_c_count || 0;
              const tagStats = activeProj?.stats?.tagStats;

              const pctA = Math.min(100, Math.round((countA / targetA) * 100));
              const pctB = Math.min(100, Math.round((countB / targetB) * 100));
              const pctC = Math.min(100, Math.round((countC / targetC) * 100));

              return (
                <div className="hidden xl:flex items-center gap-6 text-[10px] select-none">
                  <div className="w-48 space-y-1 group relative cursor-pointer">
                    <div className="flex justify-between font-bold">
                      <span className="text-indigo-400">Pool A</span>
                      <span className="text-muted-foreground">{countA} / {targetA}</span>
                    </div>
                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden border border-border/50">
                      <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${pctA}%` }} />
                    </div>

                    {/* Floating Balloon */}
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-popover border border-border shadow-xl rounded-lg p-2.5 w-56 hidden group-hover:block z-50 text-[10px] font-semibold text-foreground space-y-1.5 transition-all duration-200 animate-in fade-in slide-in-from-top-2">
                      <div className="font-bold text-primary border-b border-border/40 pb-1 flex justify-between">
                        <span>Pool A Tag Breakdown</span>
                        <span>Count</span>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        <div className="flex justify-between text-muted-foreground hover:text-foreground">
                          <span className="truncate max-w-[170px]">General (No Tag)</span>
                          <span className="font-mono">{tagStats?.['pool_a']?.['__general'] || 0}</span>
                        </div>
                        {getActiveProjectPoolTags('pool_a').map((tag: any) => {
                          const cnt = tagStats?.['pool_a']?.[tag.code] || 0;
                          return (
                            <div key={tag.code} className="flex justify-between hover:text-foreground">
                              <span className="truncate max-w-[170px]" title={`${tag.code}: ${tag.label}`}>
                                <span className="font-bold text-primary mr-1">{tag.code}</span>{tag.label}
                              </span>
                              <span className="font-mono">{cnt}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="w-48 space-y-1 group relative cursor-pointer">
                    <div className="flex justify-between font-bold">
                      <span className="text-emerald-400">Pool B</span>
                      <span className="text-muted-foreground">{countB} / {targetB}</span>
                    </div>
                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden border border-border/50">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${pctB}%` }} />
                    </div>

                    {/* Floating Balloon */}
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-popover border border-border shadow-xl rounded-lg p-2.5 w-56 hidden group-hover:block z-50 text-[10px] font-semibold text-foreground space-y-1.5 transition-all duration-200 animate-in fade-in slide-in-from-top-2">
                      <div className="font-bold text-primary border-b border-border/40 pb-1 flex justify-between">
                        <span>Pool B Tag Breakdown</span>
                        <span>Count</span>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        <div className="flex justify-between text-muted-foreground hover:text-foreground">
                          <span className="truncate max-w-[170px]">General (No Tag)</span>
                          <span className="font-mono">{tagStats?.['pool_b']?.['__general'] || 0}</span>
                        </div>
                        {getActiveProjectPoolTags('pool_b').map((tag: any) => {
                          const cnt = tagStats?.['pool_b']?.[tag.code] || 0;
                          return (
                            <div key={tag.code} className="flex justify-between hover:text-foreground">
                              <span className="truncate max-w-[170px]" title={`${tag.code}: ${tag.label}`}>
                                <span className="font-bold text-primary mr-1">{tag.code}</span>{tag.label}
                              </span>
                              <span className="font-mono">{cnt}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="w-48 space-y-1 group relative cursor-pointer">
                    <div className="flex justify-between font-bold">
                      <span className="text-amber-400">Pool C</span>
                      <span className="text-muted-foreground">{countC} / {targetC}</span>
                    </div>
                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden border border-border/50">
                      <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${pctC}%` }} />
                    </div>

                    {/* Floating Balloon */}
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-popover border border-border shadow-xl rounded-lg p-2.5 w-56 hidden group-hover:block z-50 text-[10px] font-semibold text-foreground space-y-1.5 transition-all duration-200 animate-in fade-in slide-in-from-top-2">
                      <div className="font-bold text-primary border-b border-border/40 pb-1 flex justify-between">
                        <span>Pool C Tag Breakdown</span>
                        <span>Count</span>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        <div className="flex justify-between text-muted-foreground hover:text-foreground">
                          <span className="truncate max-w-[170px]">General (No Tag)</span>
                          <span className="font-mono">{tagStats?.['pool_c']?.['__general'] || 0}</span>
                        </div>
                        {getActiveProjectPoolTags('pool_c').map((tag: any) => {
                          const cnt = tagStats?.['pool_c']?.[tag.code] || 0;
                          return (
                            <div key={tag.code} className="flex justify-between hover:text-foreground">
                              <span className="truncate max-w-[170px]" title={`${tag.code}: ${tag.label}`}>
                                <span className="font-bold text-primary mr-1">{tag.code}</span>{tag.label}
                              </span>
                              <span className="font-mono">{cnt}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <button
              onClick={() => {
                setShowAssignModal(false);
                loadCalPapers();
                loadPapers();
              }}
              className="p-2 hover:bg-secondary rounded-xl text-muted-foreground hover:text-foreground transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Fullscreen Body split into left list and right details */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Panel: Searchable paper list */}
            <div className="w-96 border-r border-border bg-card/30 flex flex-col overflow-hidden shrink-0">
              {/* Search and pool filter */}
              <div className="p-4 border-b border-border space-y-3 shrink-0">
                <div className="relative">
                  <Search className="w-4 h-4 text-muted-foreground/70 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search papers..."
                    value={assignSearch}
                    onChange={(e) => setAssignSearch(e.target.value)}
                    className="w-full bg-secondary/40 border border-border rounded-lg pl-9 pr-4 py-2 text-xs text-foreground focus:outline-none focus:border-primary placeholder-muted-foreground/60 transition-colors font-semibold"
                  />
                </div>

                {/* mini sub-filter for pool assignment */}
                <div className="grid grid-cols-5 gap-1 bg-secondary/50 p-0.5 rounded-lg border border-border text-[9px] font-bold text-center uppercase tracking-wide">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'unassigned', label: 'Un' },
                    { id: 'pool_a', label: 'A' },
                    { id: 'pool_b', label: 'B' },
                    { id: 'pool_c', label: 'C' }
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setAssignPoolFilter(f.id)}
                      className={`py-1 rounded-md transition-colors ${
                        assignPoolFilter === f.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title={`Show ${f.id === 'unassigned' ? 'Unassigned' : f.id.toUpperCase()} papers`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Papers List */}
              <div className="flex-1 overflow-y-auto divide-y divide-border/60">
                {assignLoading ? (
                  <div className="p-8 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span>Loading papers database...</span>
                  </div>
                ) : assignPapers.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-xs">
                    No papers found matching filters.
                  </div>
                ) : (
                  assignPapers.map((paper: any) => {
                    const isSelected = assignSelectedPaper?.Paper_ID === paper.Paper_ID;
                    return (
                      <div
                        key={paper.Paper_ID}
                        onClick={() => {
                          if (!assignIsRunning) {
                            setAssignSelectedPaper(paper);
                            setAssignLogs([]);
                            setAssignProgress(0);
                            setAssignStatusText('');
                          } else {
                            showToast('Please wait or cancel the running acquisition process first.', 'warning');
                          }
                        }}
                        className={`p-3.5 cursor-pointer transition-all flex flex-col gap-1 border-l-2 select-none ${
                          isSelected
                            ? 'bg-secondary/40 border-primary'
                            : paper.calibration_pool === 'pool_a'
                            ? 'border-indigo-500 hover:bg-secondary/10'
                            : paper.calibration_pool === 'pool_b'
                            ? 'border-emerald-500 hover:bg-secondary/10'
                            : paper.calibration_pool === 'pool_c'
                            ? 'border-amber-500 hover:bg-secondary/10'
                            : 'border-transparent hover:bg-secondary/10'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-mono text-[9px] font-bold text-muted-foreground shrink-0">{paper.Paper_ID}</span>
                          {paper.calibration_pool && (
                            <span className={`text-[8px] font-black uppercase tracking-wider px-1 py-0.5 rounded ${
                              paper.calibration_pool === 'pool_a' ? 'bg-indigo-500/10 text-indigo-400' :
                              paper.calibration_pool === 'pool_b' ? 'bg-emerald-500/10 text-emerald-400' :
                              'bg-amber-500/10 text-amber-400'
                            }`}>
                              {paper.calibration_pool.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-xs text-foreground line-clamp-2 leading-relaxed">{paper.Title}</h4>
                        <p className="text-[9px] text-muted-foreground truncate">{paper.Authors || 'Unknown Author'} • {paper.Year || '—'}</p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* sticky bottom page controls inside list */}
              <div className="p-3 border-t border-border bg-secondary/10 flex items-center justify-between shrink-0 select-none">
                <span className="text-[9px] text-muted-foreground font-semibold">Total: {assignTotalPapers}</span>
                <div className="flex items-center gap-1 bg-secondary border border-border rounded-lg p-0.5">
                  <button
                    disabled={assignPage === 1 || assignIsRunning}
                    onClick={() => setAssignPage((prev: number) => Math.max(1, prev - 1))}
                    className="p-1 hover:bg-background rounded text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[9px] font-bold px-1.5">{assignPage} / {assignTotalPages}</span>
                  <button
                    disabled={assignPage === assignTotalPages || assignIsRunning}
                    onClick={() => setAssignPage((prev: number) => Math.min(assignTotalPages, prev + 1))}
                    className="p-1 hover:bg-background rounded text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Panel: Detailed view and assignment controls */}
            <div className="flex-1 bg-background p-6 overflow-y-auto flex flex-col space-y-6">
              {!assignSelectedPaper ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-6">
                  <ShieldAlert className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <h4 className="font-bold text-sm mb-1 text-foreground">No paper selected</h4>
                  <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                    Select a literature reference from the left panel list to inspect its metadata and assign it to a calibration pool.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 w-full pb-8">
                  
                  {/* Paper Info Section */}
                  <div className="bg-card border border-border p-5 rounded-xl space-y-3 shrink-0 shadow-sm">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="font-mono text-xs font-bold text-muted-foreground/80 block uppercase">Paper Identification: {assignSelectedPaper.Paper_ID}</span>
                        <h2 className="font-bold text-lg xl:text-xl text-foreground leading-snug mt-0.5">{assignSelectedPaper.Title}</h2>
                      </div>
                      {/* Assignment buttons inside Detail View */}
                      <div className="flex flex-col gap-1.5 shrink-0 select-none">
                        <span className="text-[8px] text-muted-foreground uppercase font-black tracking-wider text-right block mb-0.5">Quick Actions</span>
                        <div className="flex items-center gap-1.5 bg-secondary/35 p-1 rounded-lg border border-border">
                          {[
                            { id: 'pool_a', label: 'Pool A', color: 'hover:bg-indigo-500/10 hover:text-indigo-400' },
                            { id: 'pool_b', label: 'Pool B', color: 'hover:bg-emerald-500/10 hover:text-emerald-400' },
                            { id: 'pool_c', label: 'Pool C', color: 'hover:bg-amber-500/10 hover:text-amber-400' }
                          ].map((pool) => {
                            const isAssigned = assignSelectedPaper.calibration_pool === pool.id;
                            const currentTag = isAssigned ? assignSelectedPaper.calibration_tag : null;
                            const tags = getActiveProjectPoolTags(pool.id);
                            const hasTags = tags.length > 0;
                            const showDropdown = activeAssignDropdown?.paperId === assignSelectedPaper.Paper_ID && activeAssignDropdown?.poolId === pool.id;

                            return (
                              <div key={pool.id} className="relative">
                                <button
                                  type="button"
                                  disabled={assignIsRunning}
                                  onClick={() => {
                                    if (tags.length > 0) {
                                      if (showDropdown) {
                                        setActiveAssignDropdown(null);
                                      } else {
                                        setActiveAssignDropdown({ paperId: assignSelectedPaper.Paper_ID, poolId: pool.id });
                                      }
                                    } else {
                                      handleAssignPool(assignSelectedPaper.Paper_ID, pool.id, null);
                                    }
                                  }}
                                  className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase transition-all duration-200 flex items-center gap-1 ${
                                    isAssigned
                                      ? pool.id === 'pool_a' ? 'bg-indigo-50 text-indigo-foreground shadow-sm' :
                                        pool.id === 'pool_b' ? 'bg-emerald-500 text-emerald-foreground shadow-sm' :
                                        'bg-amber-500 text-amber-foreground shadow-sm'
                                      : `text-muted-foreground hover:bg-secondary ${pool.color}`
                                  }`}
                                >
                                  <span>{pool.label}</span>
                                  {currentTag && (
                                    <span className="bg-background/20 px-1 rounded text-[8px] font-bold border border-foreground/10">
                                      {currentTag}
                                    </span>
                                  )}
                                </button>

                                {showDropdown && hasTags && (
                                  <>
                                    <div 
                                      className="fixed inset-0 z-40 bg-transparent" 
                                      onClick={() => setActiveAssignDropdown(null)} 
                                    />
                                    <div className="absolute top-full mt-1.5 right-0 bg-popover/95 border border-border shadow-2xl rounded-lg py-1.5 z-50 w-48 text-[10px] font-semibold text-foreground flex flex-col shrink-0 animate-in fade-in slide-in-from-top-1 duration-150">
                                      <div className="px-2 pb-1 text-[8px] uppercase tracking-wider text-muted-foreground border-b border-border/40 mb-1">
                                        Select Pool Tag
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleAssignPool(assignSelectedPaper.Paper_ID, pool.id, null);
                                          setActiveAssignDropdown(null);
                                        }}
                                        className="px-2.5 py-1.5 text-left hover:bg-secondary transition-colors"
                                      >
                                        No Tag (General)
                                      </button>
                                      {tags.map((tag: any) => (
                                        <button
                                          key={tag.code}
                                          type="button"
                                          onClick={() => {
                                            handleAssignPool(assignSelectedPaper.Paper_ID, pool.id, tag.code);
                                            setActiveAssignDropdown(null);
                                          }}
                                          className="px-2.5 py-1.5 text-left hover:bg-secondary transition-colors border-t border-border/30"
                                        >
                                          <span className="font-bold text-primary mr-1">{tag.code}</span> - {tag.label}
                                        </button>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                          {assignSelectedPaper.calibration_pool && (
                            <button
                              disabled={assignIsRunning}
                              onClick={() => handleAssignPool(assignSelectedPaper.Paper_ID, null)}
                              className="px-2.5 py-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-md text-[9px] font-bold uppercase transition-all duration-200"
                              title="Unassign Paper"
                            >
                              Unassign
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground font-semibold leading-relaxed">
                      Authors: <span className="text-foreground">{assignSelectedPaper.Authors || '—'}</span>
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground font-semibold">
                      <p>Year: <span className="text-foreground">{assignSelectedPaper.Year || '—'}</span></p>
                      <p>DOI: <span className="text-foreground font-mono">{assignSelectedPaper.DOI || '—'}</span></p>
                    </div>

                    {assignSelectedPaper.Abstract && (
                      <div className="pt-2 border-t border-border/60">
                        <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider block mb-1">Abstract</span>
                        <p className="text-xs xl:text-sm text-foreground font-medium leading-relaxed select-text pt-1">{assignSelectedPaper.Abstract}</p>
                      </div>
                    )}
                  </div>

                  {/* PDF Viewer or Acquisition Panel */}
                  <div className="bg-card border border-border rounded-xl shadow-sm relative shrink-0 overflow-hidden">
                    {/* Pool A: PDF is not required */}
                    {assignSelectedPaper.calibration_pool === 'pool_a' ? (
                      <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6">
                        <CheckCircle2 className="w-12 h-12 text-indigo-400 mb-3 animate-bounce" />
                        <h4 className="font-bold text-sm mb-1 text-foreground font-semibold">Paper Assigned to Pool A</h4>
                        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                          Pool A only screens Title and Abstract. Full text PDF file matching is not required for this calibration cohort.
                        </p>
                      </div>
                    ) : (assignSelectedPaper.Local_PDF_Status === 'MATCHED' || assignSelectedPaper.Local_PDF_Status === 'DOWNLOADED' || assignSelectedPaper.Local_PDF_Status === 'SYNCED') && assignSelectedPaper.Local_PDF_Path ? (
                      /* Embed PDF Viewer */
                      <div className="h-[600px] flex flex-col overflow-hidden">
                        <div className="p-3 border-b border-border bg-secondary/15 flex items-center justify-between shrink-0 select-none">
                          <span className="text-[9px] text-emerald-400 uppercase font-black tracking-wider flex items-center gap-1.5 font-bold">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                            PDF Available Inline
                          </span>
                          <a
                            href={`/api/pdf/serve?path=${encodeURIComponent(assignSelectedPaper.Local_PDF_Path)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[9px] font-bold text-primary hover:text-primary/80 transition-colors p-0.5 rounded ml-1 shrink-0"
                            title={`Open ${cloudName} File`}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="flex-1 bg-secondary/20 h-[550px]">
                          <iframe
                            src={`/api/pdf/serve?path=${encodeURIComponent(assignSelectedPaper.Local_PDF_Path)}`}
                            className="w-full h-full border-0"
                            title="Embedded PDF Viewer"
                          />
                        </div>
                      </div>
                    ) : (
                      /* Get PDF Acquisition Area */
                      <div className="border border-border rounded-xl bg-card p-6 select-none flex flex-col min-h-[350px] shrink-0 shadow-sm">
                        <div className={`flex flex-col items-center justify-center text-center py-4 ${assignIsRunning ? 'border-b border-border/40 pb-4 shrink-0' : 'flex-1'}`}>
                          <AlertTriangle className="w-12 h-12 text-amber-500 mb-3 animate-pulse" />
                          <h4 className="font-bold text-sm mb-1 text-foreground">Local PDF Not Found</h4>
                          <p className="text-xs text-muted-foreground max-w-sm leading-relaxed mb-4">
                            Pool B and Pool C require full-text screening. Trigger PDF matching and crawler scraping specifically for this paper now.
                          </p>
                          
                          <div className="flex flex-wrap items-center justify-center gap-3">
                            <button
                              onClick={() => runSinglePaperPipeline(assignSelectedPaper.Paper_ID)}
                              disabled={assignIsRunning}
                              className={`px-4 py-2 font-bold rounded-lg shadow-md transition-all flex items-center gap-1.5 uppercase tracking-wide text-[10px] ${
                                assignIsRunning 
                                  ? 'bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-50 shadow-none' 
                                  : 'bg-primary text-primary-foreground hover:bg-primary/95 hover:shadow-lg'
                              }`}
                            >
                              {assignIsRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                              {assignIsRunning ? 'Acquiring PDF...' : 'Get PDF via Cache Matching & Scraping'}
                            </button>

                            {assignIsRunning && (
                              <button
                                onClick={async () => {
                                  singlePipelineAbortControllerRef.current?.abort();
                                  await fetch('/api/pdf/batch/cancel', { method: 'POST' });
                                }}
                                className="px-4 py-2 border border-border text-[10px] font-bold uppercase rounded-lg hover:bg-secondary text-foreground transition-colors shrink-0"
                              >
                                Cancel
                              </button>
                            )}

                            {assignIsRunning && assignWaitingLogin && (
                              <button
                                onClick={async () => {
                                  setAssignWaitingLogin(false);
                                  await fetch('/api/pdf/batch/resume', { method: 'POST' });
                                }}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase rounded-lg text-[10px] tracking-wide shadow-md flex items-center gap-1.5 animate-pulse transition-all hover:scale-105 shrink-0"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                Resume Download
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Real-time single-run console log widget */}
                        {assignIsRunning && (
                          <div className="mt-4 h-64 border border-border/80 rounded-lg bg-black text-emerald-400 font-mono text-[9px] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300 shadow-inner select-text">
                            {/* console header */}
                            <div className="p-2 border-b border-border/40 bg-zinc-900/60 flex items-center justify-between shrink-0 select-none">
                              <span className="text-[8px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                                Single PDF Pipeline: {assignStatusText}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-emerald-400">{assignProgress}%</span>
                                {assignWaitingLogin && (
                                  <button
                                    onClick={async () => {
                                      await fetch('/api/pdf/batch/resume', { method: 'POST' });
                                    }}
                                    className="px-1.5 py-0.5 bg-amber-500 hover:bg-amber-600 text-black font-bold uppercase rounded text-[7px]"
                                  >
                                    Resume Login
                                  </button>
                                )}
                                <button
                                  onClick={async () => {
                                    singlePipelineAbortControllerRef.current?.abort();
                                    await fetch('/api/pdf/batch/cancel', { method: 'POST' });
                                  }}
                                  className="px-1.5 py-0.5 bg-destructive hover:bg-destructive/80 text-white font-bold uppercase rounded text-[7px]"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                            {/* logs body */}
                            <div className="flex-1 p-3 overflow-y-auto space-y-1.5">
                              {assignLogs.length === 0 ? (
                                <span className="text-zinc-600 block italic">Spawning subprocess connection...</span>
                              ) : (
                                assignLogs.map((log: any, index: number) => (
                                  <div key={index} className="leading-normal whitespace-pre-wrap">{log}</div>
                                ))
                              )}
                              <div ref={logEndRef} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </>
  );
}
