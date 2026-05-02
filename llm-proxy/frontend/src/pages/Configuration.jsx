import { useEffect, useState } from 'react';
import { fetchEndpointsConfig, upsertEndpointConfig, deleteEndpointConfig, setEndpointProperties, getConfig, setConfig, fetchResearchContexts, addResearchContext, updateResearchContext, deleteResearchContext, fetchMetaPromptTemplates, addMetaPromptTemplate, updateMetaPromptTemplate, deleteMetaPromptTemplate } from '../services/api';
import { Settings, Save, Plus, Trash2, Power, PowerOff, Edit, Pencil, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

const ThemeSetting = () => {
    const { theme, setTheme } = useTheme();

    return (
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 border dark:border-gray-700 rounded-lg max-w-lg">
            <div>
                <div className="font-semibold text-gray-800 dark:text-gray-200">Theme Preference</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    Choose your preferred application appearance.
                </div>
            </div>
            <div className="flex items-center space-x-2 ml-4 bg-white dark:bg-gray-900 border dark:border-gray-600 rounded-lg p-1">
                <button
                    onClick={() => setTheme('light')}
                    className={`p-2 rounded-md flex items-center justify-center transition-colors ${theme === 'light' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    title="Light Theme"
                >
                    <Sun className="w-5 h-5" />
                </button>
                <button
                    onClick={() => setTheme('dark')}
                    className={`p-2 rounded-md flex items-center justify-center transition-colors ${theme === 'dark' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    title="Dark Theme"
                >
                    <Moon className="w-5 h-5" />
                </button>
                <button
                    onClick={() => setTheme('system')}
                    className={`p-2 rounded-md flex items-center justify-center transition-colors ${theme === 'system' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    title="System Theme"
                >
                    <Monitor className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

const Configuration = () => {
    const [endpoints, setEndpoints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [globalUpdateCache, setGlobalUpdateCache] = useState(false);
    const [savingGlobal, setSavingGlobal] = useState(false);

    // Form state
    const [url, setUrl] = useState('');
    const [label, setLabel] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [streamMode, setStreamMode] = useState(false);
    const [extraConfig, setExtraConfig] = useState('');
    const [gpuModel, setGpuModel] = useState('');
    const [cpuModel, setCpuModel] = useState('');
    const [ramSize, setRamSize] = useState('');

    // Meta Prompting states
    const [researchContexts, setResearchContexts] = useState([]);
    const [metaPromptTemplates, setMetaPromptTemplates] = useState([]);
    const [rcName, setRcName] = useState('');
    const [rcContent, setRcContent] = useState('');
    const [editingRcId, setEditingRcId] = useState(null);
    const [mptName, setMptName] = useState('');
    const [mptContent, setMptContent] = useState('');
    const [editingMptId, setEditingMptId] = useState(null);

    const loadEndpointsAndConfig = async () => {
        try {
            setLoading(true);
            const [data, updateCacheRes] = await Promise.all([
                fetchEndpointsConfig(),
                getConfig('UPDATE_CACHE')
            ]);

            setGlobalUpdateCache(updateCacheRes.value === 'true');
            // The API returns an array directly, not an object with an `endpoints` key
            setEndpoints(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error loading endpoints:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMetaPromptingData = async () => {
        try {
            const [rcs, mpts] = await Promise.all([
                fetchResearchContexts(),
                fetchMetaPromptTemplates()
            ]);
            setResearchContexts(rcs);
            setMetaPromptTemplates(mpts);
        } catch (err) {
            console.error('Failed to load meta prompting data:', err);
        }
    };

    useEffect(() => {
        loadEndpointsAndConfig();
        loadMetaPromptingData();
    }, []);

    const handleSaveGlobalConfig = async () => {
        setSavingGlobal(true);
        try {
            await setConfig('UPDATE_CACHE', globalUpdateCache ? 'true' : 'false');
        } catch (e) {
            console.error('Failed to save global config', e);
            alert('Failed to save global configuration');
        } finally {
            setSavingGlobal(false);
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
                endpoint_url: url,
                enabled: isActive,
                stream_mode: streamMode,
                extra_config: parsedExtraConfig ? JSON.stringify(parsedExtraConfig) : null
            });

            // Also set label and properties
            await setEndpointProperties({
                endpoint_url: url,
                label,
                gpu_model: gpuModel,
                cpu_model: cpuModel,
                ram_size: ramSize
            });

            // Reset form
            setUrl('');
            setLabel('');
            setIsActive(true);
            setStreamMode(false);
            setExtraConfig('');
            setGpuModel('');
            setCpuModel('');
            setRamSize('');

            loadEndpointsAndConfig();
        } catch (error) {
            console.error('Error adding endpoint:', error);
            alert('Failed to add endpoint');
        }
    };

    const handleToggleActive = async (endpoint) => {
        try {
            await upsertEndpointConfig({
                ...endpoint,
                enabled: !endpoint.enabled
            });
            loadEndpointsAndConfig();
        } catch (error) {
            console.error('Error toggling endpoint:', error);
        }
    };

    const handleDelete = async (endpointUrl) => {
        if (!window.confirm(`Are you sure you want to delete ${endpointUrl}?`)) return;
        try {
            await deleteEndpointConfig(endpointUrl);
            loadEndpointsAndConfig();
        } catch (error) {
            console.error('Error deleting endpoint:', error);
        }
    };

    const handleSaveRc = async (e) => {
        e.preventDefault();
        try {
            if (editingRcId) {
                await updateResearchContext(editingRcId, { name: rcName, content: rcContent });
            } else {
                await addResearchContext({ name: rcName, content: rcContent });
            }
            setRcName(''); setRcContent(''); setEditingRcId(null);
            loadMetaPromptingData();
        } catch (err) { console.error(err); }
    };
    const handleEditRc = (rc) => { setEditingRcId(rc.id); setRcName(rc.name); setRcContent(rc.content); };
    const handleDeleteRc = async (id) => { if(confirm('Delete context?')) { await deleteResearchContext(id); loadMetaPromptingData(); } };
    const handleCancelEditRc = () => { setEditingRcId(null); setRcName(''); setRcContent(''); };

    const handleSaveMpt = async (e) => {
        e.preventDefault();
        try {
            if (editingMptId) {
                await updateMetaPromptTemplate(editingMptId, { name: mptName, content: mptContent });
            } else {
                await addMetaPromptTemplate({ name: mptName, content: mptContent });
            }
            setMptName(''); setMptContent(''); setEditingMptId(null);
            loadMetaPromptingData();
        } catch (err) { console.error(err); }
    };
    const handleEditMpt = (mpt) => { setEditingMptId(mpt.id); setMptName(mpt.name); setMptContent(mpt.content); };
    const handleDeleteMpt = async (id) => { if(confirm('Delete template?')) { await deleteMetaPromptTemplate(id); loadMetaPromptingData(); } };
    const handleCancelEditMpt = () => { setEditingMptId(null); setMptName(''); setMptContent(''); };

    return (
        <div className="space-y-6 text-gray-900 dark:text-gray-100">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2 mb-6">
                    <Settings className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                    <h2 className="text-2xl font-bold">Global Configuration</h2>
                </div>

                <div className="space-y-4">
                    {/* Update Cache Setting */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 border dark:border-gray-700 rounded-lg max-w-lg">
                        <div>
                            <div className="font-semibold text-gray-800 dark:text-gray-200">Update Cache</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                Bypass the cache entirely and force endpoints to generate new responses for all requests.
                            </div>
                        </div>
                        <div className="flex items-center space-x-4 ml-4">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={globalUpdateCache}
                                    onChange={(e) => setGlobalUpdateCache(e.target.checked)}
                                    className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                />
                            </label>
                            <button
                                onClick={handleSaveGlobalConfig}
                                disabled={savingGlobal}
                                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                                {savingGlobal ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>

                    {/* Theme Setting */}
                    <ThemeSetting />
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold mb-6">Smart Endpoint Manager</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Form Column */}
                    <div className="col-span-1 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 h-fit">
                    <h3 className="text-lg font-semibold mb-4">Add / Update Endpoint</h3>
                    <form onSubmit={handleAddOrUpdate} className="space-y-4">
                        <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL (Primary Key)</label>
                            <input
                                type="text"
                                required
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="http://127.0.0.1:11434/api/chat"
                                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                            />
                        </div>
                        <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Label</label>
                            <input
                                type="text"
                                required
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                placeholder="Local Ollama"
                                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                            />
                        </div>
                        <div className="flex space-x-6">
                            <label className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={isActive}
                                    onChange={(e) => setIsActive(e.target.checked)}
                                        className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Is Active</span>
                            </label>
                            <label className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={streamMode}
                                    onChange={(e) => setStreamMode(e.target.checked)}
                                        className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Stream Mode</span>
                            </label>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Extra Config (JSON)</label>
                            <textarea
                                value={extraConfig}
                                onChange={(e) => setExtraConfig(e.target.value)}
                                placeholder='{"temperature": 0.7}'
                                rows={3}
                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-sm dark:bg-gray-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GPU Model</label>
                            <input type="text" value={gpuModel} onChange={(e) => setGpuModel(e.target.value)} placeholder="e.g. RTX 3090" className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CPU Model</label>
                            <input type="text" value={cpuModel} onChange={(e) => setCpuModel(e.target.value)} placeholder="e.g. i9-13900K" className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">RAM Size</label>
                            <input type="text" value={ramSize} onChange={(e) => setRamSize(e.target.value)} placeholder="e.g. 64GB" className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700" />
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
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading endpoints...</div>
                    ) : endpoints.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400 border-2 border-dashed dark:border-gray-600 rounded-lg">
                            No endpoints configured. Add one to get started.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {endpoints.map((ep) => (
                                <div key={ep.endpoint_url} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-sm">
                                    <div className="mb-4 sm:mb-0">
                                        <div className="flex items-center space-x-2 mb-1">
                                            <span className="font-semibold text-lg">{ep.label || 'Unlabeled'}</span>
                                            {ep.enabled ? (
                                                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full">Active</span>
                                            ) : (
                                                <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full">Inactive</span>
                                            )}
                                            {ep.stream_mode ? (
                                                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">Stream</span>
                                            ) : null}
                                        </div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">{ep.endpoint_url}</div>
                                        {(ep.gpu_model || ep.cpu_model || ep.ram_size) && (
                                            <div className="mt-2 text-xs font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded border dark:border-gray-700 flex gap-2">
                                                {ep.gpu_model && <span>GPU: {ep.gpu_model}</span>}
                                                {ep.cpu_model && <span>CPU: {ep.cpu_model}</span>}
                                                {ep.ram_size && <span>RAM: {ep.ram_size}</span>}
                                            </div>
                                        )}
                                        {ep.extra_config && (
                                            <div className="mt-2 text-xs font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded border dark:border-gray-700">
                                                {ep.extra_config}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => {
                                                setUrl(ep.endpoint_url);
                                                setLabel(ep.label || '');
                                                setIsActive(ep.enabled);
                                                setStreamMode(ep.stream_mode === 1 || ep.stream_mode === true);
                                                setExtraConfig(ep.extra_config || '');
                                                setGpuModel(ep.gpu_model || '');
                                                setCpuModel(ep.cpu_model || '');
                                                setRamSize(ep.ram_size || '');
                                            }}
                                            className="p-2 rounded-md bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900"
                                            title="Edit"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleToggleActive(ep)}
                                            className={`p-2 rounded-md border ${
                                                ep.enabled
                                                    ? 'bg-orange-50 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900'
                                                    : 'bg-green-50 dark:bg-green-900/50 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900'
                                            }`}
                                            title={ep.enabled ? "Deactivate" : "Activate"}
                                        >
                                            {ep.enabled ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(ep.endpoint_url)}
                                            className="p-2 rounded-md bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900"
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

            {/* Meta Prompting Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mt-8 text-gray-900 dark:text-gray-100">
                <h2 className="text-xl font-bold mb-6">Meta Prompting</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Research Contexts */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Research Contexts</h3>
                        <form onSubmit={handleSaveRc} className="mb-4 space-y-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border dark:border-gray-700">
                            <input className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500" value={rcName} onChange={e=>setRcName(e.target.value)} placeholder="Context Name" required />
                            <textarea className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 font-mono text-sm focus:ring-blue-500 focus:border-blue-500" rows="3" value={rcContent} onChange={e=>setRcContent(e.target.value)} placeholder="Context Content" required></textarea>
                            <div className="flex gap-2">
                                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">{editingRcId ? 'Update' : 'Add'}</button>
                                {editingRcId && <button type="button" onClick={handleCancelEditRc} className="bg-gray-200 text-black px-4 py-2 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">Cancel</button>}
                            </div>
                        </form>
                        <div className="space-y-2">
                            {researchContexts.map(rc => (
                                <div key={rc.id} className="p-3 border rounded bg-white dark:bg-gray-800 dark:border-gray-700">
                                    <div className="flex justify-between font-bold"><span>{rc.name}</span>
                                    <div>
                                        <button onClick={()=>handleEditRc(rc)} className="text-blue-500 hover:text-blue-600 mr-2"><Pencil className="w-4 h-4 inline"/></button>
                                        <button onClick={()=>handleDeleteRc(rc.id)} className="text-red-500 hover:text-red-600"><Trash2 className="w-4 h-4 inline"/></button>
                                    </div></div>
                                    <div className="text-sm mt-1 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{rc.content}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Templates */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Meta Prompt Templates</h3>
                        <form onSubmit={handleSaveMpt} className="mb-4 space-y-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border dark:border-gray-700">
                            <input className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500" value={mptName} onChange={e=>setMptName(e.target.value)} placeholder="Template Name" required />
                            <textarea className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 font-mono text-sm focus:ring-blue-500 focus:border-blue-500" rows="3" value={mptContent} onChange={e=>setMptContent(e.target.value)} placeholder="Template Content e.g. Context: {{Research Context}}" required></textarea>
                            <div className="flex gap-2">
                                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">{editingMptId ? 'Update' : 'Add'}</button>
                                {editingMptId && <button type="button" onClick={handleCancelEditMpt} className="bg-gray-200 text-black px-4 py-2 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">Cancel</button>}
                            </div>
                        </form>
                        <div className="space-y-2">
                            {metaPromptTemplates.map(mpt => (
                                <div key={mpt.id} className="p-3 border rounded bg-white dark:bg-gray-800 dark:border-gray-700">
                                    <div className="flex justify-between font-bold"><span>{mpt.name}</span>
                                    <div>
                                        <button onClick={()=>handleEditMpt(mpt)} className="text-blue-500 hover:text-blue-600 mr-2"><Pencil className="w-4 h-4 inline"/></button>
                                        <button onClick={()=>handleDeleteMpt(mpt.id)} className="text-red-500 hover:text-red-600"><Trash2 className="w-4 h-4 inline"/></button>
                                    </div></div>
                                    <div className="text-sm mt-1 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{mpt.content}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

        </div>
        </div>
    );
};

export default Configuration;
