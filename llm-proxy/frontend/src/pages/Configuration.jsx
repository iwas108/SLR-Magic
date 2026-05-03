import { useEffect, useState } from 'react';
import { fetchCloudEndpoints, upsertCloudEndpoint, syncCloudModels, fetchEndpointsConfig, upsertEndpointConfig, deleteEndpointConfig, setEndpointProperties, getConfig, setConfig, fetchResearchContexts, addResearchContext, updateResearchContext, deleteResearchContext, fetchMetaPromptTemplates, addMetaPromptTemplate, updateMetaPromptTemplate, deleteMetaPromptTemplate } from '../services/api';
import { Settings, Save, Plus, Trash2, Power, PowerOff, Edit, Pencil, Monitor, Moon, Sun, X, Cloud } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

const ToggleSwitch = ({ checked, onChange, disabled }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => { if (!disabled) onChange(!checked); }}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        <span className="sr-only">Use setting</span>
        <span aria-hidden="true" className={`pointer-events-none absolute h-full w-full rounded-md bg-transparent`} />
        <span aria-hidden="true" className={`pointer-events-none absolute mx-auto h-4 w-9 rounded-full transition-colors duration-200 ease-in-out ${checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
        <span aria-hidden="true" className={`pointer-events-none absolute left-0 inline-block h-5 w-5 transform rounded-full border border-gray-200 dark:border-gray-600 bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
);

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
    const [showEndpointModal, setShowEndpointModal] = useState(false);
    const [isEditingEndpoint, setIsEditingEndpoint] = useState(false);
    const [url, setUrl] = useState('');
    const [label, setLabel] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [streamMode, setStreamMode] = useState(false);
    const [extraConfig, setExtraConfig] = useState('');
    const [gpuModel, setGpuModel] = useState('');
    const [cpuModel, setCpuModel] = useState('');
    const [ramSize, setRamSize] = useState('');

    // Cloud-based Endpoint State (Mock)
    const [cloudEndpoints, setCloudEndpoints] = useState([]);
    const [isCloudConfigSaving, setIsCloudConfigSaving] = useState(false);

    const handleCloudToggle = (id) => {
    };

    const handleCloudFieldChange = (id, field, value) => {
    };

    const handleCloudFeatureToggle = (id, feature, value) => {
    };

    const fetchCloudModels = async (id) => {
    };

    const saveCloudEndpoint = async (id) => {
    };

    // Meta Prompting states
    const [researchContexts, setResearchContexts] = useState([]);
    const [metaPromptTemplates, setMetaPromptTemplates] = useState([]);
    const [rcName, setRcName] = useState('');
    const [rcContent, setRcContent] = useState('');
    const [editingRcId, setEditingRcId] = useState(null);
    const [showRcModal, setShowRcModal] = useState(false);
    const [mptName, setMptName] = useState('');
    const [mptContent, setMptContent] = useState('');
    const [editingMptId, setEditingMptId] = useState(null);
    const [showMptModal, setShowMptModal] = useState(false);

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

    const clearEndpointForm = () => {
        setUrl('');
        setLabel('');
        setIsActive(true);
        setStreamMode(false);
        setExtraConfig('');
        setGpuModel('');
        setCpuModel('');
        setRamSize('');
        setIsEditingEndpoint(false);
        setShowEndpointModal(false);
    };

    const handleOpenAddEndpoint = () => {
        clearEndpointForm();
        setShowEndpointModal(true);
    };

    const handleEditEndpoint = (ep) => {
        setUrl(ep.endpoint_url);
        setLabel(ep.label || '');
        setIsActive(ep.enabled);
        setStreamMode(ep.stream_mode === 1 || ep.stream_mode === true);
        setExtraConfig(ep.extra_config || '');
        setGpuModel(ep.gpu_model || '');
        setCpuModel(ep.cpu_model || '');
        setRamSize(ep.ram_size || '');
        setIsEditingEndpoint(true);
        setShowEndpointModal(true);
    };

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

            // Reset form and close modal
            clearEndpointForm();

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
        if (e && e.preventDefault) e.preventDefault();
        try {
            if (editingRcId) {
                await updateResearchContext(editingRcId, { name: rcName, content: rcContent });
            } else {
                await addResearchContext({ name: rcName, content: rcContent });
            }
            setRcName(''); setRcContent(''); setEditingRcId(null); setShowRcModal(false);
            loadMetaPromptingData();
        } catch (err) { console.error(err); }
    };
    const handleEditRc = (rc) => { setEditingRcId(rc.id); setRcName(rc.name); setRcContent(rc.content); setShowRcModal(true); };
    const handleDeleteRc = async (id) => { if(confirm('Delete context?')) { await deleteResearchContext(id); loadMetaPromptingData(); } };
    const handleCancelEditRc = () => { setEditingRcId(null); setRcName(''); setRcContent(''); setShowRcModal(false); };
    const handleOpenAddRc = () => { setEditingRcId(null); setRcName(''); setRcContent(''); setShowRcModal(true); };

    const handleSaveMpt = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        try {
            if (editingMptId) {
                await updateMetaPromptTemplate(editingMptId, { name: mptName, content: mptContent });
            } else {
                await addMetaPromptTemplate({ name: mptName, content: mptContent });
            }
            setMptName(''); setMptContent(''); setEditingMptId(null); setShowMptModal(false);
            loadMetaPromptingData();
        } catch (err) { console.error(err); }
    };
    const handleEditMpt = (mpt) => { setEditingMptId(mpt.id); setMptName(mpt.name); setMptContent(mpt.content); setShowMptModal(true); };
    const handleDeleteMpt = async (id) => { if(confirm('Delete template?')) { await deleteMetaPromptTemplate(id); loadMetaPromptingData(); } };
    const handleCancelEditMpt = () => { setEditingMptId(null); setMptName(''); setMptContent(''); setShowMptModal(false); };
    const handleOpenAddMpt = () => { setEditingMptId(null); setMptName(''); setMptContent(''); setShowMptModal(true); };

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


            {/* Cloud-based Endpoint Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2 mb-6">
                    <Cloud className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    <h2 className="text-2xl font-bold">Cloud-based Endpoints</h2>
                </div>

                <div className="space-y-6">
                    {cloudEndpoints.map(ce => (
                        <div key={ce.id} className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{ce.name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Configure connection to {ce.name} services.</p>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{ce.enabled ? 'Enabled' : 'Disabled'}</span>
                                    <ToggleSwitch checked={ce.enabled} onChange={() => handleCloudToggle(ce.id)} />
                                </div>
                            </div>

                            {ce.enabled && (
                                <div className="space-y-4 border-t dark:border-gray-700 pt-4 mt-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model Prefix</label>
                                        <input
                                            type="text"
                                            value={ce.modelPrefix}
                                            onChange={(e) => handleCloudFieldChange(ce.id, 'modelPrefix', e.target.value)}
                                            placeholder="gemini,gemma"
                                            className="w-full max-w-lg px-3 py-2 border dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 mb-4"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
                                        <input
                                            type="password"
                                            value={ce.apiKey}
                                            onChange={(e) => handleCloudFieldChange(ce.id, 'apiKey', e.target.value)}
                                            placeholder="Enter API Key"
                                            className="w-full max-w-lg px-3 py-2 border dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                                        />
                                    </div>

                                    <div className="flex items-end space-x-4">
                                        <div className="flex-1 max-w-lg">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Model</label>
                                            <select
                                                value={ce.model}
                                                onChange={(e) => handleCloudFieldChange(ce.id, 'model', e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                                                disabled={ce.modelsList.length === 0}
                                            >
                                                {ce.modelsList.length === 0 && <option value="">No models fetched yet</option>}
                                                {ce.modelsList.map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <button
                                            onClick={() => fetchCloudModels(ce.id)}
                                            disabled={ce.fetchStatus === 'fetching' || !ce.apiKey}
                                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                                        >
                                            {ce.fetchStatus === 'fetching' ? 'Fetching...' : 'Fetch Models'}
                                        </button>
                                    </div>

                                    <div className="max-w-2xl mt-4 bg-white dark:bg-gray-900 p-4 border dark:border-gray-700 rounded-lg space-y-4">
                                        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 border-b dark:border-gray-700 pb-2">Features Configuration</h4>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-700 dark:text-gray-300">Enable Thinking</span>
                                                <ToggleSwitch checked={ce.features.thinking} onChange={(val) => handleCloudFeatureToggle(ce.id, 'thinking', val)} />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-700 dark:text-gray-300">Structured Output</span>
                                                <ToggleSwitch checked={ce.features.structuredOutput} onChange={(val) => handleCloudFeatureToggle(ce.id, 'structuredOutput', val)} />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-700 dark:text-gray-300">Enable Streaming</span>
                                                <ToggleSwitch checked={ce.features.streaming} onChange={(val) => handleCloudFeatureToggle(ce.id, 'streaming', val)} />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-700 dark:text-gray-300">Flex Inference Tier</span>
                                                <ToggleSwitch checked={ce.features.flexInference} onChange={(val) => handleCloudFeatureToggle(ce.id, 'flexInference', val)} />
                                            </div>
                                        </div>

                                        {ce.features.thinking && (
                                            <div className="mt-4 pt-4 border-t dark:border-gray-800 bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded border dark:border-blue-900/30">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Thinking Configuration</span>
                                                    <select
                                                        value={ce.features.thinkingType}
                                                        onChange={(e) => handleCloudFeatureToggle(ce.id, 'thinkingType', e.target.value)}
                                                        className="text-xs px-2 py-1 border dark:border-gray-600 rounded focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                                    >
                                                        <option value="level">Thinking Level (v3 Models)</option>
                                                        <option value="budget">Thinking Budget (v2.5 Models)</option>
                                                    </select>
                                                </div>

                                                {ce.features.thinkingType === 'level' ? (
                                                    <div>
                                                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">Level of logical reasoning effort applied to the prompt.</label>
                                                        <div className="flex space-x-4">
                                                            {['low', 'medium', 'high'].map(level => (
                                                                <label key={level} className="flex items-center space-x-2 cursor-pointer">
                                                                    <input
                                                                        type="radio"
                                                                        name={`thinking-level-${ce.id}`}
                                                                        value={level}
                                                                        checked={ce.features.thinkingLevel === level}
                                                                        onChange={() => handleCloudFeatureToggle(ce.id, 'thinkingLevel', level)}
                                                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                                                    />
                                                                    <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{level}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Budget allocated for thinking operations (minimum 1024).</label>
                                                        <div className="flex items-center space-x-2">
                                                            <input
                                                                type="number"
                                                                min="1024"
                                                                value={ce.features.thinkingBudget}
                                                                onChange={(e) => handleCloudFeatureToggle(ce.id, 'thinkingBudget', parseInt(e.target.value) || 1024)}
                                                                className="w-32 px-3 py-1.5 border dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 text-sm"
                                                            />
                                                            <span className="text-xs font-mono text-gray-500">tokens</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-2">
                                        <button
                                            onClick={() => saveCloudEndpoint(ce.id)}
                                            disabled={isCloudConfigSaving}
                                            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {isCloudConfigSaving ? 'Saving...' : 'Save Configuration'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>


            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold mb-6">Smart Endpoint Manager</h2>

                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Configured Endpoints</h3>
                    <button
                        onClick={handleOpenAddEndpoint}
                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm flex items-center"
                    >
                        <Plus className="w-4 h-4 mr-1" /> Add
                    </button>
                </div>

                <div>
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
                                            onClick={() => handleEditEndpoint(ep)}
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

            {/* Meta Prompting Section - Separated completely from Smart Endpoint Manager */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                <h2 className="text-2xl font-bold mb-6">Meta Prompting</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Research Contexts Table */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Research Contexts</h3>
                            <button onClick={handleOpenAddRc} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm flex items-center">
                                <Plus className="w-4 h-4 mr-1" /> Add
                            </button>
                        </div>
                        <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-900">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Content</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {researchContexts.map(rc => (
                                        <tr key={rc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-4 py-2 text-sm font-medium whitespace-nowrap">{rc.name}</td>
                                            <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs" title={rc.content}>{rc.content}</td>
                                            <td className="px-4 py-2 text-right text-sm font-medium whitespace-nowrap">
                                                <button onClick={()=>handleEditRc(rc)} className="text-blue-500 hover:text-blue-600 mr-3" title="Edit"><Pencil className="w-4 h-4 inline"/></button>
                                                <button onClick={()=>handleDeleteRc(rc.id)} className="text-red-500 hover:text-red-600" title="Delete"><Trash2 className="w-4 h-4 inline"/></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {researchContexts.length === 0 && (
                                        <tr><td colSpan="3" className="px-4 py-4 text-center text-gray-500 text-sm">No Research Contexts added.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Meta Prompt Templates Table */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Meta Prompt Templates</h3>
                            <button onClick={handleOpenAddMpt} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm flex items-center">
                                <Plus className="w-4 h-4 mr-1" /> Add
                            </button>
                        </div>
                        <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-900">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Content</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {metaPromptTemplates.map(mpt => (
                                        <tr key={mpt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-4 py-2 text-sm font-medium whitespace-nowrap">{mpt.name}</td>
                                            <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs" title={mpt.content}>{mpt.content}</td>
                                            <td className="px-4 py-2 text-right text-sm font-medium whitespace-nowrap">
                                                <button onClick={()=>handleEditMpt(mpt)} className="text-blue-500 hover:text-blue-600 mr-3" title="Edit"><Pencil className="w-4 h-4 inline"/></button>
                                                <button onClick={()=>handleDeleteMpt(mpt.id)} className="text-red-500 hover:text-red-600" title="Delete"><Trash2 className="w-4 h-4 inline"/></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {metaPromptTemplates.length === 0 && (
                                        <tr><td colSpan="3" className="px-4 py-4 text-center text-gray-500 text-sm">No Meta Prompt Templates added.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Research Context Modal */}
            {showRcModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{editingRcId ? 'Edit Research Context' : 'Add Research Context'}</h3>
                            <button onClick={handleCancelEditRc} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto">
                            <form id="rcForm" onSubmit={handleSaveRc} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Context Name</label>
                                    <input className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100" value={rcName} onChange={e=>setRcName(e.target.value)} placeholder="Context Name" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Context Content</label>
                                    <textarea className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 font-mono text-sm focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100" rows="10" value={rcContent} onChange={e=>setRcContent(e.target.value)} placeholder="Context Content" required></textarea>
                                </div>
                            </form>
                        </div>
                        <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-2">
                            <button type="button" onClick={handleCancelEditRc} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">Cancel</button>
                            <button type="submit" form="rcForm" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{editingRcId ? 'Update' : 'Save'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Endpoint Modal */}
            {showEndpointModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{isEditingEndpoint ? 'Edit Endpoint' : 'Add Endpoint'}</h3>
                            <button onClick={clearEndpointForm} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto">
                            <form id="endpointForm" onSubmit={handleAddOrUpdate} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL (Primary Key)</label>
                                    <input
                                        type="text"
                                        required
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        placeholder="http://127.0.0.1:11434/api/chat"
                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                                        disabled={isEditingEndpoint}
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
                            </form>
                        </div>
                        <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-2">
                            <button type="button" onClick={clearEndpointForm} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">Cancel</button>
                            <button type="submit" form="endpointForm" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{isEditingEndpoint ? 'Update' : 'Save'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Meta Prompt Template Modal */}
            {showMptModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{editingMptId ? 'Edit Meta Prompt Template' : 'Add Meta Prompt Template'}</h3>
                            <button onClick={handleCancelEditMpt} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto">
                            <form id="mptForm" onSubmit={handleSaveMpt} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template Name</label>
                                    <input className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100" value={mptName} onChange={e=>setMptName(e.target.value)} placeholder="Template Name" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template Content</label>
                                    <textarea className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 font-mono text-sm focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100" rows="10" value={mptContent} onChange={e=>setMptContent(e.target.value)} placeholder="Template Content e.g. Context: {{Research Context}}" required></textarea>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                    <span className="font-semibold block mb-1">Available placeholders:</span>
                                    <div className="flex flex-wrap gap-1">
                                        <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded border dark:border-gray-700">{"{{Research Context}}"}</code>
                                        <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded border dark:border-gray-700">{"{{Input Prompt}}"}</code>
                                        <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded border dark:border-gray-700">{"{{Thinking Trace}}"}</code>
                                        <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded border dark:border-gray-700">{"{{Output}}"}</code>
                                        <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded border dark:border-gray-700">{"{{Model}}"}</code>
                                        <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded border dark:border-gray-700">{"{{Execution Duration}}"}</code>
                                        <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded border dark:border-gray-700">{"{{GPU}}"}</code>
                                        <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded border dark:border-gray-700">{"{{CPU}}"}</code>
                                        <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded border dark:border-gray-700">{"{{RAM}}"}</code>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-2">
                            <button type="button" onClick={handleCancelEditMpt} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">Cancel</button>
                            <button type="submit" form="mptForm" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{editingMptId ? 'Update' : 'Save'}</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Configuration;
