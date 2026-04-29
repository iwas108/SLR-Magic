import React, { useEffect, useState } from 'react';
import { fetchEndpointsConfig, upsertEndpointConfig, deleteEndpointConfig } from '../services/api';
import { Plus, Trash2, Power, PowerOff } from 'lucide-react';

const Configuration = () => {
    const [endpoints, setEndpoints] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form state
    const [url, setUrl] = useState('');
    const [label, setLabel] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [extraConfig, setExtraConfig] = useState('');

    useEffect(() => {
        loadEndpoints();
    }, []);

    const loadEndpoints = async () => {
        try {
            setLoading(true);
            const data = await fetchEndpointsConfig();
            setEndpoints(data.endpoints || []);
        } catch (error) {
            console.error('Error loading endpoints:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddOrUpdate = async (e) => {
        e.preventDefault();
        try {
            let parsedExtraConfig = null;
            if (extraConfig) {
                try {
                    parsedExtraConfig = JSON.parse(extraConfig);
                } catch (err) {
                    alert('Extra config must be valid JSON');
                    return;
                }
            }

            await upsertEndpointConfig({
                url,
                label,
                is_active: isActive ? 1 : 0,
                extra_config: parsedExtraConfig ? JSON.stringify(parsedExtraConfig) : null
            });

            // Reset form
            setUrl('');
            setLabel('');
            setIsActive(true);
            setExtraConfig('');

            loadEndpoints();
        } catch (error) {
            console.error('Error adding endpoint:', error);
            alert('Failed to add endpoint');
        }
    };

    const handleToggleActive = async (endpoint) => {
        try {
            await upsertEndpointConfig({
                ...endpoint,
                is_active: endpoint.is_active ? 0 : 1
            });
            loadEndpoints();
        } catch (error) {
            console.error('Error toggling endpoint:', error);
        }
    };

    const handleDelete = async (endpointUrl) => {
        if (!window.confirm(`Are you sure you want to delete ${endpointUrl}?`)) return;
        try {
            await deleteEndpointConfig(endpointUrl);
            loadEndpoints();
        } catch (error) {
            console.error('Error deleting endpoint:', error);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-2xl font-bold mb-6">Smart Endpoint Manager</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Form Column */}
                <div className="col-span-1 bg-gray-50 p-4 rounded-lg border border-gray-200 h-fit">
                    <h3 className="text-lg font-semibold mb-4">Add / Update Endpoint</h3>
                    <form onSubmit={handleAddOrUpdate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">URL (Primary Key)</label>
                            <input
                                type="text"
                                required
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="http://127.0.0.1:11434/api/chat"
                                className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                            <input
                                type="text"
                                required
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                placeholder="Local Ollama"
                                className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={isActive}
                                    onChange={(e) => setIsActive(e.target.checked)}
                                    className="rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium text-gray-700">Is Active</span>
                            </label>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Extra Config (JSON)</label>
                            <textarea
                                value={extraConfig}
                                onChange={(e) => setExtraConfig(e.target.value)}
                                placeholder='{"temperature": 0.7}'
                                rows={3}
                                className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-4 h-4 mr-2" /> Save Endpoint
                        </button>
                    </form>
                </div>

                {/* List Column */}
                <div className="col-span-1 md:col-span-2">
                    <h3 className="text-lg font-semibold mb-4">Configured Endpoints</h3>
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">Loading endpoints...</div>
                    ) : endpoints.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
                            No endpoints configured. Add one to get started.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {endpoints.map((ep) => (
                                <div key={ep.url} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border rounded-lg shadow-sm">
                                    <div className="mb-4 sm:mb-0">
                                        <div className="flex items-center space-x-2 mb-1">
                                            <span className="font-semibold text-lg">{ep.label}</span>
                                            {ep.is_active ? (
                                                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">Active</span>
                                            ) : (
                                                <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Inactive</span>
                                            )}
                                        </div>
                                        <div className="text-sm text-gray-500 font-mono">{ep.url}</div>
                                        {ep.extra_config && (
                                            <div className="mt-2 text-xs font-mono bg-gray-50 p-2 rounded border">
                                                {ep.extra_config}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => handleToggleActive(ep)}
                                            className={`p-2 rounded-md border ${
                                                ep.is_active
                                                    ? 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'
                                                    : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
                                            }`}
                                            title={ep.is_active ? "Deactivate" : "Activate"}
                                        >
                                            {ep.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(ep.url)}
                                            className="p-2 rounded-md bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Configuration;
