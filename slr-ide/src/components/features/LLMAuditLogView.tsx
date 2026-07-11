'use client';

import React, { useState, useEffect } from 'react';
import { Loader, ChevronDown, ChevronUp, Database, FileText, CheckCircle2, XCircle, RefreshCw, Layers } from 'lucide-react';
import JSONViewer from '@/components/ui/JSONViewer';

interface AuditLog {
  id: number;
  paper_id: string;
  paper_title: string;
  job_id: string;
  interaction_id: string;
  previous_interaction_id: string;
  model_id: string;
  task_type: string;
  input_tokens: number;
  output_tokens: number;
  thinking_tokens: number;
  cached_tokens: number;
  total_tokens: number;
  cost_usd: number;
  flex_discount: number;
  speed_mode: string;
  raw_prompt: string;
  raw_response: string;
  structured_output: string;
  status: string;
  error_message: string;
  latency_ms: number;
  retry_count: number;
  created_at: string;
}

interface LLMAuditLogViewProps {
  activeProject: any;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

interface InteractionChainVisualizerProps {
  projectId: number;
  paperId: string;
  currentLogId: number;
}

function InteractionChainVisualizer({ projectId, paperId, currentLogId }: InteractionChainVisualizerProps) {
  const [chain, setChain] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/llm/audit?projectId=${projectId}&paperId=${paperId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setChain(data.logs || []);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [projectId, paperId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground p-3 border-t border-border/40">
        <Loader className="w-3.5 h-3.5 animate-spin text-primary" />
        <span>Loading interaction chain history...</span>
      </div>
    );
  }

  if (chain.length <= 1) {
    return (
      <div className="text-[10px] text-muted-foreground italic p-2 bg-secondary/15 rounded-lg border-t border-border/40">
        This paper has no other associated turns. It is a single-turn interaction.
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-3 border-t border-border/40">
      <div className="flex items-center gap-1.5 text-foreground font-bold">
        <Layers className="w-3.5 h-3.5 text-primary" />
        <span>Conversation Interaction Chain ({chain.length} Turns)</span>
      </div>
      
      <div className="relative pl-6 border-l-2 border-primary/20 space-y-4 ml-3">
        {chain.map((turn, index) => {
          const isCurrent = turn.id === currentLogId;
          return (
            <div key={turn.id} className="relative">
              {/* Dot indicator */}
              <div className={`absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full border-2 bg-card flex items-center justify-center ${isCurrent ? 'border-primary shadow-sm shadow-primary/20' : 'border-muted-foreground/30'}`}>
                <span className="text-[8px] font-bold">{index + 1}</span>
              </div>
              
              <div className={`p-3 border rounded-xl space-y-2 bg-secondary/5 ${isCurrent ? 'border-primary/40 bg-primary/5' : 'border-border/60'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground capitalize">{turn.task_type}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">{turn.model_id}</span>
                  </div>
                  <div className="text-[9px] text-muted-foreground font-mono">
                    ${turn.cost_usd.toFixed(5)} • {turn.total_tokens} tokens
                  </div>
                </div>

                {turn.previous_interaction_id && (
                  <div className="text-[8px] text-muted-foreground font-mono bg-black/20 px-1.5 py-0.5 rounded inline-block">
                    ↳ Parent interaction: {turn.previous_interaction_id.slice(0, 8)}...
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-[9px] pt-1">
                  <div>
                    <span className="font-bold text-muted-foreground block mb-0.5">Prompt:</span>
                    <div className="max-h-20 overflow-y-auto bg-black/35 p-1.5 rounded text-muted-foreground select-all leading-normal whitespace-pre-wrap">
                      {turn.raw_prompt}
                    </div>
                  </div>
                  <div>
                    <span className="font-bold text-muted-foreground block mb-0.5">Response:</span>
                    <div className="max-h-36 overflow-y-auto select-all leading-normal">
                      {turn.status === 'SUCCESS' ? (
                        <JSONViewer data={turn.structured_output || turn.raw_response} />
                      ) : (
                        <pre className="p-1.5 rounded bg-red-950/20 text-red-400 font-mono text-[9px] whitespace-pre-wrap">{turn.error_message}</pre>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function LLMAuditLogView({ activeProject, showToast }: LLMAuditLogViewProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 10;

  const loadAuditLogs = () => {
    if (!activeProject?.id) return;
    setLoading(true);
    fetch(`/api/llm/audit?projectId=${activeProject.id}&limit=${limit}&offset=${page * limit}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setLogs(data.logs);
          setTotal(data.pagination.total);
        } else {
          showToast?.(data.error || 'Failed to load audit logs', 'error');
        }
      })
      .catch(err => {
        console.error(err);
        showToast?.('Error fetching audit logs', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAuditLogs();
  }, [activeProject?.id, page]);

  const toggleRow = (id: number) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  if (loading && logs.length === 0) {
    return (
      <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-3">
        <Loader className="w-5 h-5 animate-spin text-primary" />
        <span className="text-[10px] font-medium">Loading interaction audit trail...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-primary" />
            Immutable LLM Audit Ledger
          </h4>
          <p className="text-[10px] text-muted-foreground">Trace of every API interaction call, costs, and token usages</p>
        </div>
        <button
          onClick={loadAuditLogs}
          className="p-1.5 rounded-lg border border-border hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="h-36 flex flex-col items-center justify-center border border-dashed border-border rounded-xl text-muted-foreground text-[10px]">
          <FileText className="w-5 h-5 text-muted-foreground/30 mb-1" />
          <span>No LLM interactions recorded for this project yet.</span>
        </div>
      ) : (
        <div className="border border-border/60 rounded-xl overflow-hidden bg-card/30 backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-secondary/30 text-[10px] text-muted-foreground font-bold border-b border-border/80">
                  <th className="p-3">Paper</th>
                  <th className="p-3">Model</th>
                  <th className="p-3">Task</th>
                  <th className="p-3 text-right">Tokens</th>
                  <th className="p-3 text-right">Cost</th>
                  <th className="p-3">Latency</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isExpanded = expandedRow === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr 
                        onClick={() => toggleRow(log.id)}
                        className="hover:bg-secondary/20 cursor-pointer border-b border-border/40 transition-colors"
                      >
                        <td className="p-3 font-medium max-w-[200px] truncate">
                          {log.paper_title || log.paper_id || 'Global Job'}
                        </td>
                        <td className="p-3 font-mono text-[10px] text-muted-foreground">{log.model_id}</td>
                        <td className="p-3 capitalize">{log.task_type}</td>
                        <td className="p-3 text-right font-mono">
                          {log.total_tokens.toLocaleString()}
                          {log.cached_tokens > 0 && (
                            <span className="text-[9px] text-green-400 ml-1">({log.cached_tokens} cached)</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-400 font-medium">
                          ${log.cost_usd.toFixed(5)}
                          {log.flex_discount > 0 && (
                            <span className="text-[9px] text-primary ml-0.5" title="Flex Discount Applied">(F)</span>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">{(log.latency_ms / 1000).toFixed(2)}s</td>
                        <td className="p-3">
                          {log.status === 'SUCCESS' ? (
                            <span className="inline-flex items-center gap-1 text-green-400 font-medium bg-green-500/10 px-2 py-0.5 rounded-full text-[9px]">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Success
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-400 font-medium bg-red-500/10 px-2 py-0.5 rounded-full text-[9px]">
                              <XCircle className="w-2.5 h-2.5" /> Error
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-secondary/10 border-b border-border/40">
                          <td colSpan={8} className="p-4 space-y-4 font-mono text-[10px]">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="font-bold text-muted-foreground block mb-1">Interaction ID:</span>
                                <span className="text-foreground select-all">{log.interaction_id || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="font-bold text-muted-foreground block mb-1">Created At:</span>
                                <span className="text-foreground">{new Date(log.created_at).toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <span className="font-bold text-muted-foreground block">Hydrated Prompt:</span>
                              <pre className="p-2.5 bg-black/40 border border-border/60 rounded-lg max-h-48 overflow-y-auto whitespace-pre-wrap text-[9px] text-muted-foreground select-all font-mono">
                                {log.raw_prompt}
                              </pre>
                            </div>
                            {log.status === 'SUCCESS' ? (
                              <div className="space-y-1">
                                <span className="font-bold text-muted-foreground block">Structured JSON Response:</span>
                                <JSONViewer data={log.structured_output || log.raw_response} />
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <span className="font-bold text-red-400 block">Execution Error:</span>
                                <pre className="p-2.5 bg-red-950/20 border border-red-500/20 rounded-lg text-red-400 whitespace-pre-wrap font-mono">
                                  {log.error_message}
                                </pre>
                              </div>
                            )}

                            {log.paper_id && (
                              <InteractionChainVisualizer 
                                projectId={activeProject.id} 
                                paperId={log.paper_id} 
                                currentLogId={log.id} 
                              />
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Pagination controls */}
          {total > limit && (
            <div className="flex items-center justify-between px-4 py-3 bg-secondary/20 border-t border-border/80">
              <span className="text-[10px] text-muted-foreground">
                Showing {page * limit + 1} - {Math.min((page + 1) * limit, total)} of {total} records
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-2.5 py-1 border border-border rounded-lg bg-card/60 hover:bg-secondary/40 disabled:opacity-40 disabled:hover:bg-card/60 transition-all font-medium"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={(page + 1) * limit >= total}
                  className="px-2.5 py-1 border border-border rounded-lg bg-card/60 hover:bg-secondary/40 disabled:opacity-40 disabled:hover:bg-card/60 transition-all font-medium"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
