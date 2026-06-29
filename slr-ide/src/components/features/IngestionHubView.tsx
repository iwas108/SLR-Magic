import React from 'react';
import {
  Upload, Search, FileText, Check, AlertCircle, RefreshCw, X, Play,
  Download, FileSpreadsheet, Layers, Sparkles, AlertTriangle, ExternalLink, Trash2,
  ArrowUpDown, ArrowUp, ArrowDown, Eye, Edit2, ChevronLeft, ChevronRight,
  Minus, Maximize2, LayoutDashboard, Plus, Edit, Folder, Calendar, CheckCircle2,
  TrendingUp, BarChart3, Cloud, Database, ShieldAlert, Terminal, ArrowRightLeft,
  Lock, Unlock, Loader2, Settings, MoreHorizontal, Globe, BookOpen, UserCheck, Shield
} from 'lucide-react';
import CsvReviewModal from './modals/CsvReviewModal';

interface IngestionHubViewProps {
  setShowImport: (show: boolean) => void;
  // bulk csv ingest props
  csvFile: File | null;
  setCsvFile: React.Dispatch<React.SetStateAction<File | null>>;
  csvHeaders: string[];
  csvData: string[][];
  csvSource: string;
  setCsvSource: (v: string) => void;
  csvImportDate: string;
  setCsvImportDate: (v: string) => void;
  columnMapping: Record<string, string>;
  setColumnMapping: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  previewPapers: any[];
  previewStats: { total: number; newCount: number; dupCount: number };
  importing: boolean;
  handleCsvSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleImport: () => Promise<void>;
  // manual ingest props
  manualSource: string;
  setManualSource: (v: string) => void;
  manualImportDate: string;
  setManualImportDate: (v: string) => void;
  manualYear: string;
  setManualYear: (v: string) => void;
  manualTitle: string;
  setManualTitle: (v: string) => void;
  manualAuthors: string;
  setManualAuthors: (v: string) => void;
  manualDoi: string;
  setManualDoi: (v: string) => void;
  manualAbstract: string;
  setManualAbstract: (v: string) => void;
  manualIngesting: boolean;
  manualParentPaperId: string;
  setManualParentPaperId: (v: string) => void;
  manualParentSearch: string;
  setManualParentSearch: (v: string) => void;
  showParentSuggestions: boolean;
  setShowParentSuggestions: (v: boolean) => void;
  parentPaperSuggestions: any[];
  setParentPaperSuggestions: React.Dispatch<React.SetStateAction<any[]>>;
  selectedParentPaper: any;
  setSelectedParentPaper: (v: any) => void;
  handleManualIngest: (e: React.FormEvent) => Promise<void>;
}

export default function IngestionHubView({
  setShowImport,
  csvFile,
  setCsvFile,
  csvHeaders,
  csvData,
  csvSource,
  setCsvSource,
  csvImportDate,
  setCsvImportDate,
  columnMapping,
  setColumnMapping,
  previewPapers,
  previewStats,
  importing,
  handleCsvSelect,
  handleImport,
  manualSource,
  setManualSource,
  manualImportDate,
  setManualImportDate,
  manualYear,
  setManualYear,
  manualTitle,
  setManualTitle,
  manualAuthors,
  setManualAuthors,
  manualDoi,
  setManualDoi,
  manualAbstract,
  setManualAbstract,
  manualIngesting,
  manualParentPaperId,
  setManualParentPaperId,
  manualParentSearch,
  setManualParentSearch,
  showParentSuggestions,
  setShowParentSuggestions,
  parentPaperSuggestions,
  setParentPaperSuggestions,
  selectedParentPaper,
  setSelectedParentPaper,
  handleManualIngest
}: IngestionHubViewProps) {

  const [isReviewModalOpen, setIsReviewModalOpen] = React.useState(false);
  const [reviewPage, setReviewPage] = React.useState(1);
  const [reviewLimit, setReviewLimit] = React.useState(50);
  const [reviewSearch, setReviewSearch] = React.useState('');
  const [reviewStatusFilter, setReviewStatusFilter] = React.useState('all');


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

      <CsvReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        previewPapers={previewPapers}
        reviewPage={reviewPage}
        setReviewPage={setReviewPage}
        reviewLimit={reviewLimit}
        setReviewLimit={setReviewLimit}
        reviewSearch={reviewSearch}
        setReviewSearch={setReviewSearch}
        reviewStatusFilter={reviewStatusFilter}
        setReviewStatusFilter={setReviewStatusFilter}
      />
    </>
  );
}
