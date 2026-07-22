import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  Trash2, 
  Upload, 
  RefreshCw,
  Search, 
  Filter, 
  FileText, 
  Layers, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  BarChart2
} from 'lucide-react';
import StorageService from '../StorageService';
import { useViewerData } from '../context/ViewerContext';

export default function Dashboard({ onSelectSession, onImportClick }) {
  const { switchSession } = useViewerData();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState('importedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [updatingSessionId, setUpdatingSessionId] = useState(null);

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

  const handleDelete = async (id, name, e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${name}" from your local viewer storage?`)) {
      try {
        await StorageService.deleteSession(id);
        setSessions(sessions.filter((s) => s.id !== id));
      } catch (err) {
        alert('Failed to delete project: ' + err.message);
      }
    }
  };

  const handleUpdateClick = (sessionId, e) => {
    e.stopPropagation();
    setUpdatingSessionId(sessionId);
    const inputEl = document.getElementById('update-slr-input');
    if (inputEl) {
      inputEl.value = '';
      inputEl.click();
    }
  };

  const handleUpdateFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !updatingSessionId) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.type !== 'slr-viewer-export') {
          alert('Invalid file format. The file must contain `"type": "slr-viewer-export"`.');
          return;
        }

        const updated = await StorageService.updateSession(updatingSessionId, parsed);
        alert(`Successfully updated project dataset for "${updated.projectName}".`);
        loadSessions();
      } catch (err) {
        alert('Failed to update project dataset: ' + err.message);
      } finally {
        setUpdatingSessionId(null);
      }
    };
    reader.readAsText(file);
  };

  // Filtered and Sorted Sessions
  const filteredSessions = sessions.filter((session) => {
    const term = searchTerm.toLowerCase();
    return (
      session.projectName?.toLowerCase().includes(term) ||
      session.filename?.toLowerCase().includes(term)
    );
  });

  const sortedSessions = [...filteredSessions].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (sortField === 'importedAt' || sortField === 'exportDate' || sortField === 'lastViewed') {
      valA = new Date(valA || 0).getTime();
      valB = new Date(valB || 0).getTime();
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedSessions.length / pageSize) || 1;
  const paginatedSessions = sortedSessions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // KPI Calculations
  const totalProjects = sessions.length;
  const totalCohortPapers = sessions.reduce((sum, s) => sum + (s.paperCount || 0), 0);
  const latestImport = sessions.length > 0 ? sessions[0].importedAt : null;

  return (
    <div className="space-y-6">
      {/* Hidden file input for Update SLR dataset */}
      <input
        type="file"
        id="update-slr-input"
        accept=".slr-viewer,.json"
        className="hidden"
        onChange={handleUpdateFileChange}
      />

      {/* Top Banner / Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-card border border-border rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-primary/10 text-primary rounded-lg">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">{totalProjects}</div>
            <div className="text-xs text-muted-foreground font-medium">Imported SLR Projects</div>
          </div>
        </div>

        <div className="p-5 bg-card border border-border rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-lg">
            <BarChart2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">{totalCohortPapers}</div>
            <div className="text-xs text-muted-foreground font-medium">Total Final Cohort Papers</div>
          </div>
        </div>

        <div className="p-5 bg-card border border-border rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-lg">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">
              {latestImport ? new Date(latestImport).toLocaleDateString() : 'None'}
            </div>
            <div className="text-xs text-muted-foreground font-medium">Latest Import Activity</div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search projects or filenames..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-medium"
            />
          </div>

          <button
            onClick={onImportClick}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-lg transition-all shadow-sm uppercase tracking-wide"
          >
            <Upload className="w-4 h-4" />
            Import .slr-viewer File
          </button>
        </div>

        {/* Table List */}
        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-xs font-medium">
            Loading SLR Viewer sessions...
          </div>
        ) : paginatedSessions.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-secondary text-muted-foreground flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">No SLR Viewer files found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {searchTerm
                  ? 'No projects match your search query.'
                  : 'Import a `.slr-viewer` dataset file exported from SLR IDE to visualize Scientific Rigor, Final Cohort, and Accounting metrics.'}
              </p>
            </div>
            {!searchTerm && (
              <button
                onClick={onImportClick}
                className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg shadow-sm hover:bg-primary/90"
              >
                Import First File
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-secondary/50 border-b border-border text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('projectName')}
                  >
                    Project Name
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('paperCount')}
                  >
                    Final Cohort
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('exportDate')}
                  >
                    Export Date
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('importedAt')}
                  >
                    Imported At
                  </th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedSessions.map((session) => (
                  <tr
                    key={session.id}
                    onClick={() => {
                      if (onSelectSession) onSelectSession(session.id);
                      switchSession(session.id, 'insight-export-rigor');
                    }}
                    className="hover:bg-secondary/30 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-foreground group-hover:text-primary transition-colors">
                        {session.projectName}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {session.filename}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-foreground">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-mono text-[11px]">
                        {session.paperCount} papers
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">
                      {session.exportDate
                        ? new Date(session.exportDate).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">
                      {new Date(session.importedAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectSession) onSelectSession(session.id);
                          switchSession(session.id, 'insight-export-rigor');
                        }}
                        className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        title="View Project Scientific Rigor"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => handleUpdateClick(session.id, e)}
                        className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 transition-colors"
                        title="Update Dataset File"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => handleDelete(session.id, session.projectName, e)}
                        className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                        title="Delete Session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <div>
              Page {currentPage} of {totalPages} ({sortedSessions.length} total projects)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded bg-secondary hover:bg-secondary/80 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded bg-secondary hover:bg-secondary/80 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
