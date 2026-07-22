import React, { useState } from 'react';
import { Paper } from '@/types';
import { 
  Upload, Search, FileText, CheckCircle2, RefreshCw, X, Play, AlertTriangle 
} from 'lucide-react';

interface IngestionPanelProps {
  loadPapers: () => Promise<void>;
  showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  broadcastSync: (event: string) => void;
}

export default function IngestionPanel({ loadPapers, showToast, broadcastSync }: IngestionPanelProps) {
  // Manual Ingestion states
  const [manualSource, setManualSource] = useState('Backward Snowball');
  const [manualImportDate, setManualImportDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [manualYear, setManualYear] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualAuthors, setManualAuthors] = useState('');
  const [manualDoi, setManualDoi] = useState('');
  const [manualAbstract, setManualAbstract] = useState('');
  const [manualIngesting, setManualIngesting] = useState(false);

  const handleManualIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim()) {
      showToast('Paper title is mandatory', 'error');
      return;
    }

    setManualIngesting(true);
    try {
      const parsedYear = parseInt(manualYear, 10);
      const res = await fetch('/api/papers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          papers: [{
            Title: manualTitle.trim(),
            Authors: manualAuthors.trim(),
            Year: !isNaN(parsedYear) ? parsedYear : null,
            DOI: manualDoi.trim(),
            Abstract: manualAbstract.trim(),
            Source: manualSource.trim(),
            Import_Source: manualSource.trim(),
            Import_Date: manualImportDate,
            Parent_Paper_ID: null
          }]
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.imported > 0) {
          showToast('Paper ingested successfully!', 'success');
          setManualTitle('');
          setManualAuthors('');
          setManualYear('');
          setManualDoi('');
          setManualAbstract('');
          await loadPapers();
          broadcastSync('SYNC_PAPERS');
        } else {
          showToast('Paper was skipped (likely a duplicate by Title/DOI)', 'warning');
        }
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to ingest paper', 'error');
      }
    } catch (err: any) {
      showToast(`Error ingesting paper: ${err.message || err}`, 'error');
    } finally {
      setManualIngesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl shadow-md p-6 space-y-4">
        <h3 className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border pb-3">
          <FileText className="w-4 h-4 text-primary" />
          Manual Single Ingestion
        </h3>
        <form onSubmit={handleManualIngest} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Title *</label>
              <input type="text" value={manualTitle} onChange={e => setManualTitle(e.target.value)} required className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Authors</label>
              <input type="text" value={manualAuthors} onChange={e => setManualAuthors(e.target.value)} className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Year</label>
              <input type="number" value={manualYear} onChange={e => setManualYear(e.target.value)} className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">DOI</label>
              <input type="text" value={manualDoi} onChange={e => setManualDoi(e.target.value)} className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Source</label>
              <select value={manualSource} onChange={e => setManualSource(e.target.value)} className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary">
                <option value="Backward Snowball">Backward Snowball</option>
                <option value="Forward Snowball">Forward Snowball</option>
                <option value="Manual Addition">Manual Addition</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Import Date</label>
              <input type="date" value={manualImportDate} onChange={e => setManualImportDate(e.target.value)} className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Abstract</label>
            <textarea rows={3} value={manualAbstract} onChange={e => setManualAbstract(e.target.value)} className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
          </div>
          <button type="submit" disabled={manualIngesting} className="w-full py-2 bg-primary text-primary-foreground font-bold uppercase rounded-lg text-xs hover:bg-primary/95 transition-colors shadow-md">
            {manualIngesting ? 'Ingesting...' : 'Ingest Paper'}
          </button>
        </form>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-md p-6 space-y-4">
        <h3 className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border pb-3">
          <Upload className="w-4 h-4 text-primary" />
          Bulk CSV Import
        </h3>
        <p className="text-xs text-muted-foreground">CSV import logic would normally be placed here. In this abstracted layer, use the manual ingress or the legacy bulk upload API.</p>
      </div>
    </div>
  );
}
