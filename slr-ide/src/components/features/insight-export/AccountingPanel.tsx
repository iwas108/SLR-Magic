'use client';

import React, { useEffect, useState } from 'react';
import { DollarSign, Zap, Hash, AlertTriangle, TrendingUp } from 'lucide-react';

interface AccountingPanelProps {
  projectId: string;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function AccountingPanel({ projectId, showToast }: AccountingPanelProps) {
  const [data, setData] = useState<{ pipelineBreakdown: any[]; expensiveCalls: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!projectId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/insight/accounting?projectId=${projectId}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        setData(json);
      } catch (err) {
        showToast('Error loading accounting data', 'error');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [projectId, showToast]);

  if (loading) {
    return <div className="p-4 flex items-center justify-center text-muted-foreground">Loading accounting data...</div>;
  }

  if (!data) return null;

  const totalCost = data.pipelineBreakdown.reduce((sum, item) => sum + (item.total_cost || 0), 0);

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground">
          <TrendingUp className="w-4 h-4 text-primary" />
          Pipeline Cost Breakdown
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border p-4 rounded-lg shadow-sm">
            <p className="text-xs font-medium text-muted-foreground uppercase">Total Spend</p>
            <p className="text-2xl font-black text-foreground mt-1">${totalCost.toFixed(4)}</p>
          </div>
          {data.pipelineBreakdown.map((item, idx) => (
            <div key={idx} className="bg-card border border-border p-4 rounded-lg shadow-sm">
              <p className="text-xs font-medium text-muted-foreground uppercase">{item.task_type.replace('_', ' ')}</p>
              <div className="flex items-end justify-between mt-1">
                <p className="text-xl font-bold text-foreground">${(item.total_cost || 0).toFixed(4)}</p>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end"><Hash className="w-3 h-3" /> {item.total_tokens?.toLocaleString() || 0} tokens</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expensive Calls Table */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          Top Expensive API Calls
        </h3>
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3 font-semibold">Task / Source</th>
                <th className="px-4 py-3 font-semibold">Model</th>
                <th className="px-4 py-3 font-semibold text-right">Tokens</th>
                <th className="px-4 py-3 font-semibold text-right">Cost (USD)</th>
                <th className="px-4 py-3 font-semibold">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.expensiveCalls.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs italic">
                    No API calls logged yet.
                  </td>
                </tr>
              ) : (
                data.expensiveCalls.map((call, idx) => (
                  <tr key={idx} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2">
                      <div className="font-medium text-foreground capitalize">{call.task_type.replace('_', ' ')}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">{call.source}</div>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{call.model_id}</td>
                    <td className="px-4 py-2 text-right font-medium">{call.total_tokens.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-bold text-destructive">${call.cost_usd.toFixed(4)}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {new Date(call.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
