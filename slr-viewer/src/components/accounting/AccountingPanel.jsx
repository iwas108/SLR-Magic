import React, { useState, useMemo } from 'react';
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
import { useViewerData } from '../../context/ViewerContext';

const STAGE_CONFIGS = {
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
  }
};

export default function AccountingPanel() {
  const { activeSession, loading } = useViewerData();

  const accountingData = activeSession?.rawData?.accounting || null;
  const overallStats = accountingData?.summary || null;
  const pipelineBreakdown = accountingData?.pipeline_breakdown || [];
  const expensiveCalls = accountingData?.top_expensive_calls || [];

  // Sorting, Filtering & Pagination State
  const [sortField, setSortField] = useState('cost_usd');
  const [sortDirection, setSortDirection] = useState('desc');
  const [taskFilter, setTaskFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filteredCalls = useMemo(() => {
    if (!expensiveCalls) return [];
    if (taskFilter === 'all') return expensiveCalls;
    return expensiveCalls.filter(
      (c) => (c.task_type || '').toLowerCase() === taskFilter.toLowerCase()
    );
  }, [expensiveCalls, taskFilter]);

  const sortedCalls = useMemo(() => {
    if (!filteredCalls) return [];
    return [...filteredCalls].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'task_type' || sortField === 'model_id') {
        aVal = (aVal || '').toString().toLowerCase();
        bVal = (bVal || '').toString().toLowerCase();
      } else if (sortField === 'created_at' || sortField === 'timestamp') {
        aVal = new Date(a.created_at || a.timestamp || 0).getTime();
        bVal = new Date(b.created_at || b.timestamp || 0).getTime();
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

  const handleSort = (field) => {
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

  if (!accountingData) {
    return (
      <div className="bg-card border border-border p-8 rounded-xl text-center text-muted-foreground text-xs">
        No accounting data available in this snapshot.
      </div>
    );
  }

  const totalCost = pipelineBreakdown.reduce((sum, item) => sum + (item.total_cost || 0), 0);
  const totalTokens = pipelineBreakdown.reduce((sum, item) => sum + (item.total_tokens || 0), 0);

  const breakdownMap = new Map();
  pipelineBreakdown.forEach((item) => {
    breakdownMap.set((item.task_type || '').toLowerCase(), item);
  });

  const getMinCost = (itemData, taskType) => {
    const rawMin = itemData?.min_cost;
    if (rawMin !== undefined && rawMin !== null && Number(rawMin) > 0) {
      return Number(rawMin);
    }
    const stageCalls = expensiveCalls.filter(
      (c) => (c.task_type || '').toLowerCase() === (taskType || '').toLowerCase()
    );
    const validCosts = stageCalls.map((c) => Number(c.cost_usd || 0)).filter((c) => c > 0);
    return validCosts.length > 0 ? Math.min(...validCosts) : 0;
  };

  const getMinTokens = (itemData, taskType) => {
    const rawMin = itemData?.min_tokens;
    if (rawMin !== undefined && rawMin !== null && Number(rawMin) > 0) {
      return Number(rawMin);
    }
    const stageCalls = expensiveCalls.filter(
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
    const breakdownMins = pipelineBreakdown
      .map((item) => getMinCost(item, item.task_type))
      .filter((v) => v > 0);
    if (breakdownMins.length > 0) return Math.min(...breakdownMins);
    const validCosts = expensiveCalls.map((c) => Number(c.cost_usd || 0)).filter((c) => c > 0);
    return validCosts.length > 0 ? Math.min(...validCosts) : 0;
  };

  const getOverallMinTokens = () => {
    const rawMin = overallStats?.min_tokens;
    if (rawMin !== undefined && rawMin !== null && Number(rawMin) > 0) {
      return Number(rawMin);
    }
    const breakdownMins = pipelineBreakdown
      .map((item) => getMinTokens(item, item.task_type))
      .filter((v) => v > 0);
    if (breakdownMins.length > 0) return Math.min(...breakdownMins);
    const validTokens = expensiveCalls.map((c) => Number(c.total_tokens || 0)).filter((c) => c > 0);
    return validTokens.length > 0 ? Math.min(...validTokens) : 0;
  };

  const renderStatsSubGrid = (minCost, avgCost, maxCost, minTokens, avgTokens, maxTokens) => {
    const formatCost = (val) => (val !== undefined && val !== null && val !== Infinity && Number(val) > 0 ? `$${Number(val).toFixed(4)}` : '$0.0000');
    const formatTokens = (val) => (val !== undefined && val !== null && val !== Infinity && Number(val) > 0 ? Math.round(Number(val)).toLocaleString() : '0');

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

  const renderStageCard = (key, itemData, extraClass = '') => {
    const config = STAGE_CONFIGS[key] || {
      label: key.replace('_', ' '),
      border: 'border-t-4 border-t-primary',
      bg: 'bg-primary/10',
      text: 'text-primary'
    };

    const cost = Number(itemData?.total_cost || 0);
    const tokens = Number(itemData?.total_tokens || 0);

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
      <div>
        <h3 className="text-sm font-normal mb-3 flex items-center gap-2 text-foreground">
          <TrendingUp className="w-4 h-4 text-primary" />
          Pipeline Cost Breakdown
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Spend */}
          <div className="md:row-span-2 md:col-span-1 bg-card border border-border border-t-4 border-t-emerald-500 p-5 rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-normal text-emerald-500 uppercase tracking-wider">Total Spend</span>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-normal text-foreground tracking-tight">
                  ${Number(overallStats?.total_cost_usd || overallStats?.total_cost || totalCost).toFixed(4)}
                </div>
                <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5 font-normal">
                  <Hash className="w-3.5 h-3.5" />
                  <span>{Number(overallStats?.total_tokens || totalTokens).toLocaleString()} total tokens</span>
                </div>
                {overallStats?.total_calls ? (
                  <div className="text-[11px] text-muted-foreground/80 mt-1 font-mono font-normal">
                    {Number(overallStats.total_calls).toLocaleString()} API calls logged
                  </div>
                ) : null}
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

          {renderStageCard('fast_filter', breakdownMap.get('fast_filter'))}
          {renderStageCard('gatekeeper', breakdownMap.get('gatekeeper'))}
          {renderStageCard('scientist', breakdownMap.get('scientist'))}

          {renderStageCard('miner', breakdownMap.get('miner'))}
          {renderStageCard('umbrellanizer', breakdownMap.get('umbrellanizer'), 'md:col-span-2')}
        </div>
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
                <option value="all">All Tasks</option>
                <option value="fast_filter">Fast Filter</option>
                <option value="gatekeeper">Gatekeeper</option>
                <option value="scientist">Scientist</option>
                <option value="miner">Miner</option>
                <option value="umbrellanizer">Umbrellanizer</option>
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
                      No API calls logged in this snapshot.
                    </td>
                  </tr>
                ) : (
                  paginatedCalls.map((call, idx) => (
                    <tr key={call.id || idx} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-1.5 font-medium text-xs text-foreground capitalize">
                        {call.task_type ? call.task_type.replace('_', ' ') : 'Unknown'}
                      </td>
                      <td className="px-4 py-1.5 font-mono text-xs text-muted-foreground">{call.model_id || '—'}</td>
                      <td className="px-4 py-1.5 text-right font-normal text-xs font-mono">{call.total_tokens?.toLocaleString() || 0}</td>
                      <td className="px-4 py-1.5 text-right font-semibold text-xs font-mono text-destructive">${(call.cost_usd || 0).toFixed(4)}</td>
                      <td className="px-4 py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                        {call.timestamp || call.created_at ? new Date(call.timestamp || call.created_at).toLocaleString() : '—'}
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
                  className="p-1.5 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="First Page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
                  className="p-1.5 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="p-1.5 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
                className="bg-card border border-border text-foreground text-xs rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
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
