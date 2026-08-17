'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  DollarSign,
  Zap,
  Hash,
  AlertTriangle,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';

export interface AccountingPanelProps {
  projectId?: string;
  showToast?: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  accountingData?: {
    summary?: any;
    pipeline_breakdown?: any[];
    top_expensive_calls?: any[];
    overallStats?: any;
    pipelineBreakdown?: any[];
    expensiveCalls?: any[];
  } | null;
}

const STAGE_CONFIGS: Record<string, { label: string; border: string; bg: string; text: string }> = {
  fast_filter: {
    label: 'Fast Filter',
    border: 'border-t-4 border-t-sky-500',
    bg: 'bg-sky-500/10',
    text: 'text-sky-500'
  },
  gatekeeper: {
    label: 'Gatekeeper',
    border: 'border-t-4 border-t-indigo-500',
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-500'
  },
  scientist: {
    label: 'Scientist',
    border: 'border-t-4 border-t-amber-500',
    bg: 'bg-amber-500/10',
    text: 'text-amber-500'
  },
  miner: {
    label: 'Miner',
    border: 'border-t-4 border-t-green-500',
    bg: 'bg-green-500/10',
    text: 'text-green-500'
  },
  umbrellanizer: {
    label: 'Umbrellanizer',
    border: 'border-t-4 border-t-rose-500',
    bg: 'bg-rose-500/10',
    text: 'text-rose-500'
  },
  mockup_pool_a: {
    label: 'Mockup (Pool A)',
    border: 'border-t-4 border-t-purple-500',
    bg: 'bg-purple-500/10',
    text: 'text-purple-500'
  },
  mockup_pool_b: {
    label: 'Mockup (Pool B)',
    border: 'border-t-4 border-t-fuchsia-500',
    bg: 'bg-fuchsia-500/10',
    text: 'text-fuchsia-500'
  },
  mockup_pool_c: {
    label: 'Mockup (Pool C)',
    border: 'border-t-4 border-t-pink-500',
    bg: 'bg-pink-500/10',
    text: 'text-pink-500'
  },
  duplicate_review: {
    label: 'Duplicate Review',
    border: 'border-t-4 border-t-cyan-500',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-500'
  },
  consolidation_audit: {
    label: 'Stage Audit',
    border: 'border-t-4 border-t-orange-500',
    bg: 'bg-orange-500/10',
    text: 'text-orange-500'
  },
  prompt_benchmark: {
    label: 'Prompt Benchmark',
    border: 'border-t-4 border-t-teal-500',
    bg: 'bg-teal-500/10',
    text: 'text-teal-500'
  },
  prompt_optimizer: {
    label: 'Prompt Optimizer',
    border: 'border-t-4 border-t-violet-500',
    bg: 'bg-violet-500/10',
    text: 'text-violet-500'
  }
};

export default function AccountingPanel({ projectId, showToast, accountingData }: AccountingPanelProps) {
  const [data, setData] = useState<{ overallStats?: any; pipelineBreakdown: any[]; expensiveCalls: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  // Sorting, Filtering & Pagination State
  const [sortField, setSortField] = useState<string>('cost_usd');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [taskFilter, setTaskFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  useEffect(() => {
    if (accountingData) {
      setData({
        overallStats: accountingData.overallStats || accountingData.summary || {},
        pipelineBreakdown: accountingData.pipelineBreakdown || accountingData.pipeline_breakdown || [],
        expensiveCalls: accountingData.expensiveCalls || accountingData.top_expensive_calls || []
      });
      setLoading(false);
      return;
    }

    async function fetchData() {
      if (!projectId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/insight/accounting?projectId=${projectId}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        setData(json);
      } catch (err) {
        if (showToast) showToast('Error loading accounting data', 'error');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [projectId, showToast, accountingData]);

  const availableFilterOptions = useMemo(() => {
    const defaultOptions = [
      { value: 'all', label: 'All Tasks' },
      { value: 'fast_filter', label: 'Fast Filter (Stage 1)' },
      { value: 'gatekeeper', label: 'Gatekeeper (Stage 2)' },
      { value: 'scientist', label: 'Scientist (Stage 3)' },
      { value: 'miner', label: 'Miner (Stage 4)' },
      { value: 'umbrellanizer', label: 'Umbrellanizer (Taxonomy)' },
      { value: 'mockup_pool_a', label: 'Mockup (Pool A)' },
      { value: 'mockup_pool_b', label: 'Mockup (Pool B)' },
      { value: 'mockup_pool_c', label: 'Mockup (Pool C)' },
      { value: 'duplicate_review', label: 'Duplicate Review' },
      { value: 'consolidation_audit', label: 'Stage Audit' },
      { value: 'prompt_benchmark', label: 'Prompt Benchmark' },
      { value: 'prompt_optimizer', label: 'Prompt Optimizer' },
    ];

    const knownValues = new Set(defaultOptions.map(o => o.value));
    const dynamicOptions: { value: string; label: string }[] = [];

    (data?.expensiveCalls || []).forEach(c => {
      const t = (c.task_type || '').toLowerCase();
      if (t && !knownValues.has(t)) {
        knownValues.add(t);
        dynamicOptions.push({
          value: t,
          label: t.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
        });
      }
    });

    return [...defaultOptions, ...dynamicOptions];
  }, [data?.expensiveCalls]);

  const primaryKeys = useMemo(() => new Set(['fast_filter', 'gatekeeper', 'scientist', 'miner', 'umbrellanizer']), []);

  const auxiliaryTasks = useMemo(() => {
    const knownAux = [
      'mockup_pool_a',
      'mockup_pool_b',
      'mockup_pool_c',
      'duplicate_review',
      'consolidation_audit',
      'prompt_benchmark',
      'prompt_optimizer'
    ];
    const presentKeys = new Set<string>();
    (data?.pipelineBreakdown || []).forEach((item) => {
      const k = (item.task_type || '').toLowerCase();
      if (!primaryKeys.has(k) && k && (item.total_cost > 0 || item.total_tokens > 0)) {
        presentKeys.add(k);
      }
    });

    const ordered: string[] = [];
    knownAux.forEach(k => {
      if (presentKeys.has(k)) {
        ordered.push(k);
        presentKeys.delete(k);
      }
    });
    presentKeys.forEach(k => ordered.push(k));
    return ordered;
  }, [data?.pipelineBreakdown, primaryKeys]);

  const filteredCalls = useMemo(() => {
    const list = data?.expensiveCalls || [];
    if (taskFilter === 'all') return list;
    return list.filter(
      (c) => (c.task_type || '').toLowerCase() === taskFilter.toLowerCase()
    );
  }, [data?.expensiveCalls, taskFilter]);

  const sortedCalls = useMemo(() => {
    if (!filteredCalls) return [];
    return [...filteredCalls].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'task_type') {
        aVal = (aVal || '').toString().toLowerCase();
        bVal = (bVal || '').toString().toLowerCase();
      } else if (sortField === 'model_id') {
        aVal = (aVal || '').toString().toLowerCase();
        bVal = (bVal || '').toString().toLowerCase();
      } else if (sortField === 'created_at') {
        aVal = new Date(aVal || 0).getTime();
        bVal = new Date(bVal || 0).getTime();
      } else {
        aVal = Number(aVal || 0);
        bVal = Number(bVal || 0);
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredCalls, sortField, sortDirection]);

  const totalRecords = sortedCalls.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedCalls = sortedCalls.slice(startIndex, startIndex + pageSize);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  if (loading) {
    return <div className="p-4 flex items-center justify-center text-muted-foreground">Loading accounting data...</div>;
  }

  if (!data) return null;

  const totalCost = data.pipelineBreakdown.reduce((sum, item) => sum + (item.total_cost || 0), 0);
  const totalTokens = data.pipelineBreakdown.reduce((sum, item) => sum + (item.total_tokens || 0), 0);
  const overallStats = data.overallStats;

  const breakdownMap = new Map<string, any>();
  data.pipelineBreakdown.forEach((item) => {
    breakdownMap.set((item.task_type || '').toLowerCase(), item);
  });

  const getMinCost = (itemData: any, taskType: string) => {
    const rawMin = itemData?.min_cost;
    if (rawMin !== undefined && rawMin !== null && Number(rawMin) > 0) {
      return Number(rawMin);
    }
    const stageCalls = (data?.expensiveCalls || []).filter(
      (c) => (c.task_type || '').toLowerCase() === (taskType || '').toLowerCase()
    );
    const validCosts = stageCalls.map((c) => Number(c.cost_usd || 0)).filter((c) => c > 0);
    return validCosts.length > 0 ? Math.min(...validCosts) : 0;
  };

  const getMinTokens = (itemData: any, taskType: string) => {
    const rawMin = itemData?.min_tokens;
    if (rawMin !== undefined && rawMin !== null && Number(rawMin) > 0) {
      return Number(rawMin);
    }
    const stageCalls = (data?.expensiveCalls || []).filter(
      (c) => (c.task_type || '').toLowerCase() === (taskType || '').toLowerCase()
    );
    const validTokens = stageCalls.map((c) => Number(c.total_tokens || 0)).filter((c) => c > 0);
    return validTokens.length > 0 ? Math.min(...validTokens) : 0;
  };

  const getOverallMinCost = () => {
    const rawMin = overallStats?.min_cost;
    if (rawMin !== undefined && rawMin !== null && Number(rawMin) > 0) {
      return Number(rawMin);
    }
    const breakdownMins = (data?.pipelineBreakdown || [])
      .map((item: any) => getMinCost(item, item.task_type))
      .filter((v: number) => v > 0);
    if (breakdownMins.length > 0) return Math.min(...breakdownMins);
    const validCosts = (data?.expensiveCalls || []).map((c) => Number(c.cost_usd || 0)).filter((c) => c > 0);
    return validCosts.length > 0 ? Math.min(...validCosts) : 0;
  };

  const getOverallMinTokens = () => {
    const rawMin = overallStats?.min_tokens;
    if (rawMin !== undefined && rawMin !== null && Number(rawMin) > 0) {
      return Number(rawMin);
    }
    const breakdownMins = (data?.pipelineBreakdown || [])
      .map((item: any) => getMinTokens(item, item.task_type))
      .filter((v: number) => v > 0);
    if (breakdownMins.length > 0) return Math.min(...breakdownMins);
    const validTokens = (data?.expensiveCalls || []).map((c) => Number(c.total_tokens || 0)).filter((c) => c > 0);
    return validTokens.length > 0 ? Math.min(...validTokens) : 0;
  };

  const renderStatsSubGrid = (
    minCost?: number,
    avgCost?: number,
    maxCost?: number,
    minTokens?: number,
    avgTokens?: number,
    maxTokens?: number
  ) => {
    const formatCost = (val?: number) => (val !== undefined && val !== null && val !== Infinity && val > 0 ? `$${val.toFixed(4)}` : '$0.0000');
    const formatTokens = (val?: number) => (val !== undefined && val !== null && val !== Infinity && val > 0 ? Math.round(val).toLocaleString() : '0');

    return (
      <div className="grid grid-cols-3 gap-1 mt-3 pt-2.5 border-t border-border/60 text-xs bg-muted/20 p-2 rounded-md font-normal">
        <div className="text-center border-r border-border/40 px-1">
          <span className="text-[10px] font-normal uppercase tracking-wider text-muted-foreground block mb-0.5">Min</span>
          <span className="font-mono text-xs font-normal text-foreground block">{formatCost(minCost)}</span>
          <span className="font-mono text-[10px] font-normal text-muted-foreground block">{formatTokens(minTokens)} tkn</span>
        </div>
        <div className="text-center border-r border-border/40 px-1">
          <span className="text-[10px] font-normal uppercase tracking-wider text-muted-foreground block mb-0.5">Avg</span>
          <span className="font-mono text-xs font-normal text-foreground block">{formatCost(avgCost)}</span>
          <span className="font-mono text-[10px] font-normal text-muted-foreground block">{formatTokens(avgTokens)} tkn</span>
        </div>
        <div className="text-center px-1">
          <span className="text-[10px] font-normal uppercase tracking-wider text-muted-foreground block mb-0.5">Max</span>
          <span className="font-mono text-xs font-normal text-foreground block">{formatCost(maxCost)}</span>
          <span className="font-mono text-[10px] font-normal text-muted-foreground block">{formatTokens(maxTokens)} tkn</span>
        </div>
      </div>
    );
  };

  const renderStageCard = (key: string, itemData: any, extraClass = '') => {
    const config = STAGE_CONFIGS[key] || {
      label: key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      border: 'border-t-4 border-t-primary',
      bg: 'bg-primary/10',
      text: 'text-primary'
    };

    const cost = itemData?.total_cost || 0;
    const tokens = itemData?.total_tokens || 0;

    return (
      <div className={`bg-card border border-border ${config.border} p-4 rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${extraClass}`}>
        <div>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-normal uppercase tracking-wider ${config.text}`}>{config.label}</span>
            <div className={`p-1.5 rounded-lg ${config.bg} ${config.text}`}>
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-normal text-foreground">${cost.toFixed(4)}</span>
            <span className="text-xs font-mono text-muted-foreground flex items-center gap-1 font-normal">
              <Hash className="w-3 h-3" />
              {tokens.toLocaleString()}
            </span>
          </div>
        </div>

        {renderStatsSubGrid(
          getMinCost(itemData, key),
          itemData?.avg_cost,
          itemData?.max_cost,
          getMinTokens(itemData, key),
          itemData?.avg_tokens,
          itemData?.max_tokens
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 font-normal">
      {/* Metric Cards Grid */}
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-normal mb-3 flex items-center gap-2 text-foreground">
            <TrendingUp className="w-4 h-4 text-primary" />
            Core Pipeline Cost Breakdown
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Total Spend */}
            <div className="bg-card border border-border border-t-4 border-t-emerald-500 p-4 rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-normal uppercase tracking-wider text-emerald-500">Total Spend</span>
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-normal text-foreground">
                    ${(overallStats?.total_cost || totalCost).toFixed(4)}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground flex items-center gap-1.5 font-normal">
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      {(overallStats?.total_tokens || totalTokens).toLocaleString()}
                    </span>
                    {overallStats?.total_calls ? (
                      <span className="text-[10px] text-muted-foreground/80 font-mono">({overallStats.total_calls} calls)</span>
                    ) : null}
                  </span>
                </div>
              </div>

              {renderStatsSubGrid(
                getOverallMinCost(),
                overallStats?.avg_cost,
                overallStats?.max_cost,
                getOverallMinTokens(),
                overallStats?.avg_tokens,
                overallStats?.max_tokens
              )}
            </div>

            {/* Fast Filter (Stage 1) */}
            {renderStageCard('fast_filter', breakdownMap.get('fast_filter'))}

            {/* Gatekeeper (Stage 2) */}
            {renderStageCard('gatekeeper', breakdownMap.get('gatekeeper'))}

            {/* Scientist (Stage 3) */}
            {renderStageCard('scientist', breakdownMap.get('scientist'))}

            {/* Miner (Stage 4) */}
            {renderStageCard('miner', breakdownMap.get('miner'))}

            {/* Umbrellanizer */}
            {renderStageCard('umbrellanizer', breakdownMap.get('umbrellanizer'))}
          </div>
        </div>

        {/* Auxiliary & Calibration Operations */}
        {auxiliaryTasks.length > 0 && (
          <div>
            <h3 className="text-sm font-normal mb-3 flex items-center gap-2 text-foreground">
              <Zap className="w-4 h-4 text-amber-500" />
              Auxiliary & Calibration Operations
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {auxiliaryTasks.map((taskKey) => (
                <React.Fragment key={taskKey}>
                  {renderStageCard(taskKey, breakdownMap.get(taskKey))}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Top Expensive API Calls Table */}
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-normal flex items-center gap-2 text-foreground">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Top Expensive API Calls
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-normal">
              <span>Filter:</span>
              <select
                value={taskFilter}
                onChange={(e) => {
                  setTaskFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-card border border-border text-foreground text-xs rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-normal"
              >
                {availableFilterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs text-muted-foreground font-mono font-normal">
              {totalRecords.toLocaleString()} logged records
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border select-none">
                <tr>
                  <th
                    className="px-4 py-2 font-medium cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort('task_type')}
                  >
                    <div className="flex items-center gap-1">
                      Task
                      {sortField === 'task_type' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-2 font-medium cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort('model_id')}
                  >
                    <div className="flex items-center gap-1">
                      Model
                      {sortField === 'model_id' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-2 font-medium text-right cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort('total_tokens')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Tokens
                      {sortField === 'total_tokens' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-2 font-medium text-right cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort('cost_usd')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Cost (USD)
                      {sortField === 'cost_usd' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-2 font-medium cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center gap-1">
                      Timestamp
                      {sortField === 'created_at' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedCalls.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs italic">
                      No API calls logged yet.
                    </td>
                  </tr>
                ) : (
                  paginatedCalls.map((call, idx) => (
                    <tr key={call.id || idx} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-1.5 font-medium text-xs text-foreground">
                        {call.task_type ? (STAGE_CONFIGS[call.task_type]?.label || call.task_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())) : 'Unknown'}
                      </td>
                      <td className="px-4 py-1.5 font-mono text-xs text-muted-foreground">{call.model_id}</td>
                      <td className="px-4 py-1.5 text-right font-normal text-xs font-mono">{call.total_tokens?.toLocaleString() || 0}</td>
                      <td className="px-4 py-1.5 text-right font-semibold text-xs font-mono text-destructive">${(call.cost_usd || 0).toFixed(4)}</td>
                      <td className="px-4 py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(call.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-muted/20 border-t border-border text-xs">
            <div className="text-muted-foreground font-normal">
              Showing <span className="text-foreground font-semibold">{totalRecords === 0 ? 0 : startIndex + 1}</span> to{' '}
              <span className="text-foreground font-semibold">{Math.min(startIndex + pageSize, totalRecords)}</span> of{' '}
              <span className="text-foreground font-semibold">{totalRecords}</span> entries
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="First Page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-medium text-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="p-1.5 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="p-1.5 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Last Page"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>

              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-card border border-border text-foreground text-xs rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
