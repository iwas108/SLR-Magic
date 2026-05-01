import { useEffect, useState } from 'react';
import { fetchStats, fetchQueueStats } from '../services/api';
import { BarChart2, Server, List } from 'lucide-react';

const Stats = () => {
    const [stats, setStats] = useState(null);
    const [queueStats, setQueueStats] = useState(null);
    const [loading, setLoading] = useState(true);

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
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center mb-4">
                        <List className="w-5 h-5 text-gray-500 mr-2" />
                        <h3 className="text-lg font-semibold">Queue Activity</h3>
                    </div>
                    {queueStats ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-gray-600">Active Requests</span>
                                <span className="font-bold text-xl">{queueStats.active_requests}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-gray-600">Pending in Queue</span>
                                <span className="font-bold text-xl">{queueStats.pending_in_queue}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-gray-600">Total Processed</span>
                                <span className="font-bold text-xl">{queueStats.total_processed}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-gray-600">Max Concurrent</span>
                                <span className="font-bold text-xl">{queueStats.max_concurrent_requests}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-gray-500 italic">No queue stats available</div>
                    )}
                </div>

                {/* DB Stats Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center mb-4">
                        <Server className="w-5 h-5 text-gray-500 mr-2" />
                        <h3 className="text-lg font-semibold">Proxy Metrics</h3>
                    </div>
                    {stats ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-gray-600">Cache Hits</span>
                                <span className="font-bold text-xl text-green-600">{stats.cache_hits || 0}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-gray-600">Total Requests Logged</span>
                                <span className="font-bold text-xl">{stats.total_requests || 0}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-gray-600">Cache Hit Ratio</span>
                                <span className="font-bold text-xl">
                                    {stats.total_requests ?
                                        ((stats.cache_hits / stats.total_requests) * 100).toFixed(1) + '%'
                                        : '0%'}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-gray-500 italic">No DB stats available</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Stats;
