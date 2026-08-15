import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  Trash2, 
  Upload, 
  RefreshCw,
  Search, 
  FileText, 
  Layers, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  BarChart2,
  AlertTriangle
} from 'lucide-react';
import StorageService, { SessionRecord } from '../StorageService';
import { useViewerData } from '../context/ViewerContext';
import { validateViewerSnapshotSafe, MINIMUM_SCHEMA_VERSION } from '../utils/schemaValidator';
import { decompressViewerData } from '../utils/compression';
import FullscreenErrorModal from './common/FullscreenErrorModal';

export interface DashboardProps {
  onSelectSession?: (sessionId: number | string) => void;
  onImportClick?: () => void;
}

export default function Dashboard({ onSelectSession, onImportClick }: DashboardProps) {
  const { switchSession, showToast } = useViewerData();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<'importedAt' | 'projectName' | 'paperCount'>('importedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [updatingSessionId, setUpdatingSessionId] = useState<number | null>(null);
  const [schemaError, setSchemaError] = useState<any>(null);
  const [errorFilename, setErrorFilename] = useState('dataset.slr-viewer');

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await StorageService.getSessions();
      setSessions(data);
    } catch (e) {
      console.error('Failed to load sessions:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSession = async (session: SessionRecord) => {
    if (!session || session.id === undefined) return;
    // Check if session has a valid schema
    const fullSession = await StorageService.getSession(session.id);
    if (fullSession && fullSession.isSchemaValid === false) {
      setErrorFilename(session.filename || 'dataset.slr-viewer');
      setSchemaError(fullSession.schemaError || {
        error: `Stored project "${session.projectName}" uses an outdated snapshot schema. Please re-export from SLR IDE.`,
        detectedVersion: session.schemaVersion || '1.0.0 (legacy)',
        requiredVersion: MINIMUM_SCHEMA_VERSION
      });
      return;
    }

    if (onSelectSession) onSelectSession(session.id);
    switchSession(session.id, 'insight-export-rigor');
  };

  const handleDelete = async (id: number | undefined, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!id) return;
    if (window.confirm(`Are you sure you want to delete "${name}" from your local viewer storage?`)) {
      try {
        await StorageService.deleteSession(id);
        setSessions(sessions.filter((s) => s.id !== id));
        showToast('Project deleted successfully', 'info');
      } catch (err: any) {
        showToast('Failed to delete project: ' + err.message, 'error');
      }
    }
  };

  const handleUpdateClick = (sessionId: number | undefined, filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessionId === undefined) return;
    setUpdatingSessionId(sessionId);
    setErrorFilename(filename || 'dataset.slr-viewer');
    const inputEl = document.getElementById('update-slr-input') as HTMLInputElement | null;
    if (inputEl) {
      inputEl.value = '';
      inputEl.click();
    }
  };

  const handleUpdateFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || updatingSessionId === null) return;

    setErrorFilename(file.name);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        let parsed: any;
        try {
          parsed = await decompressViewerData(buffer);
        } catch (jsonErr: any) {
          setSchemaError({
            error: 'Corrupted file format: Unable to parse JSON or decompress dataset file.',
            detectedVersion: 'Invalid Payload',
            requiredVersion: MINIMUM_SCHEMA_VERSION,
            details: { rawError: jsonErr.message }
          });
          return;
        }

        const validation = validateViewerSnapshotSafe(parsed);
        if (!validation.isValid) {
          setSchemaError(validation);
          return;
        }

        await StorageService.updateSession(updatingSessionId, validation.data);
        showToast(`Workspace snapshot updated to v${validation.data.schema_version}`, 'success');
        await loadSessions();
      } catch (err: any) {
        showToast('Update failed: ' + err.message, 'error');
      } finally {
        setUpdatingSessionId(null);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const filteredSessions = sessions.filter((s) =>
    s.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedSessions = [...filteredSessions].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    if (sortField === 'importedAt') {
      aVal = new Date(a.importedAt).getTime();
      bVal = new Date(b.importedAt).getTime();
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedSessions.length / pageSize) || 1;
  const paginatedSessions = sortedSessions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const toggleSort = (field: 'importedAt' | 'projectName' | 'paperCount') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-4">
      {/* Hidden file input for updating snapshot */}
      <input
        id="update-slr-input"
        type="file"
        accept=".slr-viewer,.json"
        onChange={handleUpdateFileChange}
        className="hidden"
      />

      {/* Fullscreen Schema Error Modal */}
      {schemaError && (
        <FullscreenErrorModal
          errorInfo={schemaError}
          filename={errorFilename}
          onTryAnotherFile={() => {
            setSchemaError(null);
            if (onImportClick) onImportClick();
          }}
          onClose={() => setSchemaError(null)}
        />
      )}

      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-card border border-border rounded-2xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <span>Workspace Sessions Board</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {sessions.length} Saved
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Explore and review uploaded systematic literature review dataset snapshots stored locally in your browser.
          </p>
        </div>

        <button
          onClick={onImportClick}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/90 transition-all shadow-md shadow-primary/10 cursor-pointer shrink-0"
        >
          <Upload className="w-4 h-4" />
          <span>Import .slr-viewer</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search projects by name or filename..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-medium shadow-sm"
          />
        </div>
      </div>

      {/* Sessions Grid / Table */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold">Loading workspaces...</span>
        </div>
      ) : paginatedSessions.length === 0 ? (
        <div className="p-16 flex flex-col items-center justify-center text-muted-foreground gap-3 border border-dashed border-border rounded-2xl bg-card/50 text-center">
          <Layers className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-foreground">No SLR workspaces found</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Import an exported <code className="font-mono bg-secondary px-1 py-0.5 rounded">.slr-viewer</code> snapshot dataset to view scientific rigor metrics and cohort tables.
          </p>
          {onImportClick && (
            <button
              onClick={onImportClick}
              className="mt-2 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/90 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Import Snapshot Now</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedSessions.map((session) => (
            <div
              key={session.id}
              onClick={() => handleSelectSession(session)}
              className="p-5 bg-card border border-border rounded-2xl hover:border-primary/50 transition-all shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between group relative"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {session.projectName}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-secondary text-muted-foreground border border-border shrink-0">
                    v{session.schemaVersion || '1.1.0'}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="font-mono text-[11px] truncate" title={session.filename}>
                      {session.filename}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span><strong>{session.paperCount}</strong> Final Cohort Papers</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span>Imported {new Date(session.importedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                <button
                  onClick={(e) => handleUpdateClick(session.id, session.filename, e)}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors text-xs flex items-center gap-1 cursor-pointer"
                  title="Update with newer snapshot file"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Update</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleDelete(session.id, session.projectName, e)}
                    className="p-1.5 text-muted-foreground hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Delete session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Open</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-border select-none">
          <span className="text-xs text-muted-foreground font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-border hover:bg-secondary disabled:opacity-30 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-border hover:bg-secondary disabled:opacity-30 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
