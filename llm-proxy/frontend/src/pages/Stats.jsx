import { useEffect, useState } from 'react';
import { fetchStats, fetchQueueStats } from '../services/api';
import { BarChart2, Server, List, ArrowDown, ArrowUp } from 'lucide-react';

const Stats = () => {
    const [stats, setStats] = useState(null);
    const [queueStats, setQueueStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sortField, setSortField] = useState('request_count');
    const [sortDesc, setSortDesc] = useState(true);

    const loadData = async () => {
        try {
            const [statsData, queueData] = await Promise.all([
                fetchStats(),
                fetchQueueStats()
            ]);
            setStats(statsData);
            setQueueStats(queueData);
        } catch (error) {
            console.error('Error loading stats:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // Refresh every 5 seconds
        const interval = setInterval(loadData, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDesc(!sortDesc);
        } else {
            setSortField(field);
            setSortDesc(true);
        }
    };

    const getSortedMetrics = () => {
        if (!stats || !stats.metrics) return [];
        return [...stats.metrics].sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return sortDesc ? 1 : -1;
            if (valA > valB) return sortDesc ? -1 : 1;
            return 0;
        });
    };

    if (loading && !stats) {
        return (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading stats...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6 text-gray-900 dark:text-gray-100">
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold flex items-center">
                    <BarChart2 className="w-6 h-6 mr-2 text-blue-500 dark:text-blue-400" />
                    Performance & Metrics
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                    Auto-updating
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Queue Stats Card */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center mb-4">
                        <List className="w-5 h-5 text-gray-500 mr-2" />
                        <h3 className="text-lg font-semibold">Queue Activity</h3>
                    </div>
                    {queueStats ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                                <span className="text-gray-600 dark:text-gray-400">Active Requests</span>
                                <span className="font-bold text-xl">{queueStats.active_requests}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                                <span className="text-gray-600 dark:text-gray-400">Pending in Queue</span>
                                <span className="font-bold text-xl">{queueStats.pending_in_queue}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                                <span className="text-gray-600 dark:text-gray-400">Total Processed</span>
                                <span className="font-bold text-xl">{queueStats.total_processed}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-gray-600 dark:text-gray-400">Max Concurrent</span>
                                <span className="font-bold text-xl">{queueStats.max_concurrent_requests}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-gray-500 dark:text-gray-400 italic">No queue stats available</div>
                    )}
                </div>

                {/* DB Stats Card */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center mb-4">
                        <Server className="w-5 h-5 text-gray-500 mr-2" />
                        <h3 className="text-lg font-semibold">Proxy Metrics</h3>
                    </div>
                    {stats ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                                <span className="text-gray-600 dark:text-gray-400">Cache Hits</span>
                                <span className="font-bold text-xl text-green-600">{stats.cache_hits || 0}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                                <span className="text-gray-600 dark:text-gray-400">Total Requests Logged</span>
                                <span className="font-bold text-xl">{stats.total_requests || 0}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-gray-600 dark:text-gray-400">Cache Hit Ratio</span>
                                <span className="font-bold text-xl">
                                    {stats.total_requests ?
                                        ((stats.cache_hits / stats.total_requests) * 100).toFixed(1) + '%'
                                        : '0%'}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-gray-500 dark:text-gray-400 italic">No DB stats available</div>
                    )}
                </div>
            </div>

            {/* Leaderboard Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold">Model & Endpoint Leaderboard</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                                {[
                                    { key: 'model_name', label: 'Model' },
                                    { key: 'endpoint_label', label: 'Endpoint' },
                                    { key: 'request_count', label: 'Requests' },
                                    { key: 'avg_duration_ms', label: 'Avg Duration (ms)' }
                                ].map(({ key, label }) => (
                                    <th
                                        key={key}
                                        onClick={() => handleSort(key)}
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                                    >
                                        <div className="flex items-center">
                                            {label}
                                            {sortField === key && (
                                                sortDesc ? <ArrowDown className="w-4 h-4 ml-1" /> : <ArrowUp className="w-4 h-4 ml-1" />
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {getSortedMetrics().map((metric, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {metric.model_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {metric.endpoint_label}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {metric.request_count}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {Math.round(metric.avg_duration_ms)} ms
                                    </td>
                                </tr>
                            ))}
                            {(!stats || !stats.metrics || stats.metrics.length === 0) && (
                                <tr>
                                    <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400 italic">
                                        No data available for leaderboard
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Stats;
