import { useEffect, useState } from 'react';
import { fetchCloudEndpoints, upsertCloudEndpoint, syncCloudModels, fetchLocalEndpoints, upsertLocalEndpoint, deleteLocalEndpoint, getConfig, setConfig, fetchResearchContexts, addResearchContext, updateResearchContext, deleteResearchContext, fetchMetaPromptTemplates, addMetaPromptTemplate, updateMetaPromptTemplate, deleteMetaPromptTemplate, syncLocalModels } from '../services/api';
import { Settings, Plus, Trash2, Power, PowerOff, Pencil, Monitor, Moon, Sun, X, Cloud } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import ReactJson from '@uiw/react-json-view';
import { lightTheme } from '@uiw/react-json-view/light';
import { darkTheme } from '@uiw/react-json-view/dark';

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

    // Cloud-based Endpoint State
    const [cloudEndpoints, setCloudEndpoints] = useState([]);
    const [isCloudConfigSaving, setIsCloudConfigSaving] = useState(false);

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

    // UI states
    const [isFetchingLocalModels, setIsFetchingLocalModels] = useState({});

    const handleCloudToggle = async (id) => {
        setCloudEndpoints(prev => prev.map(ce =>
            ce.id === id ? { ...ce, enabled: !ce.enabled } : ce
        ));
        const ce = cloudEndpoints.find(c => c.id === id);
        if (ce) {
            await saveCloudEndpointWithData({ ...ce, enabled: !ce.enabled });
        }
    };

    const handleCloudFieldChange = (id, field, value) => {
        setCloudEndpoints(prev => prev.map(ce =>
            ce.id === id ? { ...ce, [field]: value } : ce
        ));
    };

    const fetchCloudModels = async (id) => {
        handleCloudFieldChange(id, 'fetchStatus', 'fetching');
        try {
            await saveCloudEndpoint(id);
            const response = await syncCloudModels(id);
            const models = response.models.map(m => m.name);
            handleCloudFieldChange(id, 'modelsList', models);
            handleCloudFieldChange(id, 'model', models.length > 0 ? models[0] : '');
            handleCloudFieldChange(id, 'fetchStatus', 'idle');
        } catch (error) {
            console.error('Error fetching cloud models:', error);
            alert(`Failed to fetch cloud models: ${error.message}`);
            handleCloudFieldChange(id, 'fetchStatus', 'error');
        }
    };

    const saveCloudEndpointWithData = async (ce) => {
        setIsCloudConfigSaving(true);
        try {
            const modelsPayload = ce.model ? [{
                id: null,
                name: ce.model,
                default_config: ce.modelConfig
            }] : [];

            const payload = {
                id: ce.id,
                provider: ce.provider || 'gemini',
                name: ce.name,
                enabled: ce.enabled,
                model_prefix: ce.modelPrefix,
                api_key: ce.apiKey,
                models_cache: JSON.stringify(ce.modelsList),
                streaming: ce.isStreaming,
                models: modelsPayload
            };
            await upsertCloudEndpoint(payload);
        } catch (error) {
            console.error('Error saving cloud endpoint:', error);
            alert('Failed to save cloud endpoint configuration.');
        } finally {
            setIsCloudConfigSaving(false);
        }
    };

    const saveCloudEndpoint = async (id) => {
        const ce = cloudEndpoints.find(c => c.id === id);
        if (!ce) return;
        await saveCloudEndpointWithData(ce);
    };

    const loadCloudEndpoints = async () => {
        try {
            const data = await fetchCloudEndpoints();
            const mappedData = data.map(dbEndpoint => ({
                id: dbEndpoint.id,
                provider: dbEndpoint.provider,
                name: dbEndpoint.name,
                enabled: dbEndpoint.is_enabled === 1 || dbEndpoint.is_enabled === true,
                modelPrefix: dbEndpoint.model_prefix || '',
                apiKey: dbEndpoint.api_key || '',
                model: dbEndpoint.models?.[0]?.name || '',
                modelsList: Array.isArray(dbEndpoint.models_list_cache) ? dbEndpoint.models_list_cache.map(m => (typeof m === 'object' && m !== null) ? m.name : m) : [],
                fetchStatus: 'idle',
                isStreaming: dbEndpoint.is_streaming === 1 || dbEndpoint.is_streaming === true,
                modelConfig: typeof dbEndpoint.models?.[0]?.default_config === 'string' ? dbEndpoint.models[0].default_config : JSON.stringify(dbEndpoint.models?.[0]?.default_config || {}, null, 2)
            }));
            setCloudEndpoints(mappedData);
        } catch (error) {
            console.error('Error loading cloud endpoints:', error);
        }
    };

    const loadEndpointsAndConfig = async () => {
        try {
            setLoading(true);
            const [data, updateCacheRes] = await Promise.all([
                fetchLocalEndpoints(),
                getConfig('UPDATE_CACHE')
            ]);

            setGlobalUpdateCache(updateCacheRes.value === 'true');

            const mappedLocalData = (Array.isArray(data) ? data : []).map(dbEndpoint => {
                const firstModel = dbEndpoint.models?.[0] || {};
                return {
                    ...dbEndpoint,
                    label: dbEndpoint.provider || '',
                    enabled: dbEndpoint.is_enabled === 1 || dbEndpoint.is_enabled === true,
                    stream_mode: dbEndpoint.is_streaming === 1 || dbEndpoint.is_streaming === true,
                    cpu_model: dbEndpoint.cpu_model || firstModel.cpu_model || '',
                    gpu_model: dbEndpoint.gpu_model || firstModel.gpu_model || '',
                    ram_size: dbEndpoint.ram_size || firstModel.ram_size || '',
                    running_environment: dbEndpoint.running_environment || firstModel.running_environment || '',
                    modelsList: Array.isArray(dbEndpoint.models_list_cache) ? dbEndpoint.models_list_cache.map(m => (typeof m === 'object' && m !== null) ? m.name : m) : [],
                    selectedModel: firstModel.name || '',
                    configuredModels: dbEndpoint.models || []
                };
            });

            setEndpoints(mappedLocalData);
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
        loadCloudEndpoints();
        loadMetaPromptingData();
    }, []);

    const handleLocalFieldChange = (id, field, value) => {
        setEndpoints(prev => prev.map(ep =>
            ep.id === id ? { ...ep, [field]: value } : ep
        ));
    };

    const handleLocalModelSelect = (id, modelName) => {
        setEndpoints(prev => prev.map(ep => {
            if (ep.id !== id) return ep;
            return {
                ...ep,
                selectedModel: modelName
            };
        }));
    };

    const handleLocalModelConfigChange = (id, modelName, configValue) => {
        setEndpoints(prev => prev.map(ep => {
            if (ep.id !== id) return ep;
            const newConfigured = [...(ep.configuredModels || [])];
            const existingIndex = newConfigured.findIndex(m => m.name === modelName);
            if (existingIndex >= 0) {
                newConfigured[existingIndex] = { ...newConfigured[existingIndex], default_config: configValue };
            } else {
                newConfigured.push({ name: modelName, default_config: configValue });
            }
            return { ...ep, configuredModels: newConfigured };
        }));
    };

    const handleLocalToggleActive = async (id) => {
        setEndpoints(prev => prev.map(ep =>
            ep.id === id ? { ...ep, enabled: !ep.enabled } : ep
        ));
        const ep = endpoints.find(e => e.id === id);
        if (ep) {
            await saveLocalEndpointWithData({ ...ep, enabled: !ep.enabled });
        }
    };

    const handleFetchLocalModels = async (id) => {
        if (!id || String(id).startsWith('temp-')) {
            alert('Please save the endpoint first before fetching models.');
            return;
        }
        setIsFetchingLocalModels(prev => ({...prev, [id]: true}));
        try {
            await saveLocalEndpoint(id);
            const response = await syncLocalModels(id);
            const models = response.models.map(m => m.name);
            handleLocalFieldChange(id, 'modelsList', models);
            handleLocalModelSelect(id, models.length > 0 ? models[0] : '');
            await loadEndpointsAndConfig();
        } catch (error) {
            console.error('Error fetching local models:', error);
            alert(`Failed to fetch models: ${error.message}`);
        } finally {
            setIsFetchingLocalModels(prev => ({...prev, [id]: false}));
        }
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

    const handleAddEndpoint = () => {
        const newEp = {
            id: `temp-${Date.now()}`,
            label: '',
            endpoint_url: '',
            enabled: true,
            stream_mode: false,
            cpu_model: '',
            gpu_model: '',
            ram_size: '',
            running_environment: '',
            selectedModel: '',
            configuredModels: [],
            modelsList: []
        };
        setEndpoints(prev => [...prev, newEp]);
    };

    const saveLocalEndpointWithData = async (ep) => {
        try {
            const modelsPayload = (ep.configuredModels || []).map(model => {
                let pConfig = null;
                if (model.default_config) {
                    try {
                        pConfig = typeof model.default_config === 'string' ? JSON.parse(model.default_config) : model.default_config;
                    } catch {
                        throw new Error(`Default config for model ${model.name} must be valid JSON`);
                    }
                }
                return {
                    id: model.id || null,
                    name: model.name,
                    default_config: pConfig ? JSON.stringify(pConfig) : null
                };
            });

            const submitId = String(ep.id).startsWith('temp-') ? null : ep.id;

            await upsertLocalEndpoint({
                id: submitId,
                provider: ep.label || 'ollama',
                endpoint_url: ep.endpoint_url,
                is_enabled: ep.enabled,
                is_streaming: ep.stream_mode,
                cpu_model: ep.cpu_model,
                gpu_model: ep.gpu_model,
                ram_size: ep.ram_size,
                running_environment: ep.running_environment,
                models: modelsPayload
            });

            await loadEndpointsAndConfig();
        } catch (error) {
            console.error('Error adding endpoint:', error);
            alert(`Failed to save endpoint: ${error.message}`);
        }
    };

    const saveLocalEndpoint = async (id) => {
        const ep = endpoints.find(e => e.id === id);
        if (!ep) return;
        await saveLocalEndpointWithData(ep);
    };

    const handleDeleteLocalEndpoint = async (id, label) => {
        if (!window.confirm(`Are you sure you want to delete ${label}?`)) return;
        try {
            await deleteLocalEndpoint(id);
            await loadEndpointsAndConfig();
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
                                    <input
                                        type="text"
                                        value={ce.name}
                                        onChange={(e) => handleCloudFieldChange(ce.id, 'name', e.target.value)}
                                        className="text-lg font-semibold text-gray-800 dark:text-gray-200 bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-500 focus:ring-0 px-0 py-1 transition-colors w-full max-w-md"
                                        placeholder="Endpoint Name"
                                    />
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure connection to {ce.name || 'this provider\'s'} services.</p>
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

                                    <div className="flex items-center justify-between max-w-lg mt-4">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Streaming</span>
                                        <ToggleSwitch checked={ce.isStreaming} onChange={(val) => handleCloudFieldChange(ce.id, 'isStreaming', val)} />
                                    </div>

                                    {ce.model && (
                                        <div className="mt-4 bg-white dark:bg-gray-900 p-4 border dark:border-gray-700 rounded-lg space-y-4 max-w-4xl">
                                            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 border-b dark:border-gray-700 pb-2">Features Configuration</h4>
                                            <div className="flex flex-col md:flex-row gap-4 h-64">
                                                <div className="w-full md:w-1/2 flex flex-col">
                                                    <label className="text-xs text-gray-500 mb-1">JSON Input</label>
                                                    <textarea
                                                        className="w-full flex-grow p-3 font-mono text-sm border dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800"
                                                        value={ce.modelConfig}
                                                        onChange={(e) => handleCloudFieldChange(ce.id, 'modelConfig', e.target.value)}
                                                        placeholder='{
  "temperature": 0.7
}'
                                                    />
                                                </div>
                                                <div className="w-full md:w-1/2 flex flex-col">
                                                    <label className="text-xs text-gray-500 mb-1">JSON Validation</label>
                                                    <div className="flex-grow overflow-auto bg-gray-50 dark:bg-gray-800 border dark:border-gray-600 rounded-md p-3">
                                                        <ReactJson
                                                            value={(() => {
                                                                try {
                                                                    const parsed = JSON.parse(ce.modelConfig || '{}');
                                                                    if (parsed === null || typeof parsed !== 'object') {
                                                                        return { error: "Invalid JSON (must be an object)" };
                                                                    }
                                                                    if (Array.isArray(parsed)) {
                                                                        return parsed;
                                                                    }
                                                                    return parsed;
                                                                } catch (e) {
                                                                    return { error: "Invalid JSON" };
                                                                }
                                                            })()}
                                                            style={document.documentElement.classList.contains('dark') ? darkTheme : lightTheme}
                                                            displayDataTypes={false}
                                                            enableClipboard={false}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

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

                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">Local Endpoint Manager</h2>
                    <button
                        onClick={handleAddEndpoint}
                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm flex items-center"
                    >
                        <Plus className="w-4 h-4 mr-1" /> Add
                    </button>
                </div>

                <div className="space-y-6">
                    {loading ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading endpoints...</div>
                    ) : endpoints.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400 border-2 border-dashed dark:border-gray-600 rounded-lg">
                            No endpoints configured. Add one to get started.
                        </div>
                    ) : (
                        endpoints.map(ep => {
                            const currentModelConfigStr = (ep.configuredModels || []).find(m => m.name === ep.selectedModel)?.default_config || '';
                            const currentModelConfig = typeof currentModelConfigStr === 'object' ? JSON.stringify(currentModelConfigStr, null, 2) : currentModelConfigStr;

                            return (
                                <div key={ep.id} className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="w-full flex items-center gap-4">
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    value={ep.label || ''}
                                                    onChange={(e) => handleLocalFieldChange(ep.id, 'label', e.target.value)}
                                                    className="text-lg font-semibold text-gray-800 dark:text-gray-200 bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-500 focus:ring-0 px-0 py-1 transition-colors w-full max-w-md"
                                                    placeholder="Provider Name (e.g. Local Ollama)"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{ep.enabled ? 'Enabled' : 'Disabled'}</span>
                                            <ToggleSwitch checked={ep.enabled} onChange={() => handleLocalToggleActive(ep.id)} />
                                            <button onClick={() => handleDeleteLocalEndpoint(ep.id, ep.label)} className="text-red-500 hover:text-red-600 p-1" title="Delete Endpoint">
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    {ep.enabled && (
                                        <div className="space-y-4 border-t dark:border-gray-700 pt-4 mt-4">
                                            <div className="flex gap-4">
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL</label>
                                                    <input
                                                        type="text"
                                                        value={ep.endpoint_url}
                                                        onChange={(e) => handleLocalFieldChange(ep.id, 'endpoint_url', e.target.value)}
                                                        placeholder="http://127.0.0.1:11434"
                                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 disabled:opacity-50"
                                                        disabled={!String(ep.id).startsWith('temp-')}
                                                    />
                                                </div>
                                                <div className="flex items-end mb-2">
                                                    <label className="flex items-center space-x-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={ep.stream_mode}
                                                            onChange={(e) => handleLocalFieldChange(ep.id, 'stream_mode', e.target.checked)}
                                                            className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                                        />
                                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Stream Mode</span>
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-4 gap-4">
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">CPU Model</label>
                                                    <input type="text" value={ep.cpu_model || ''} onChange={e=>handleLocalFieldChange(ep.id, 'cpu_model', e.target.value)} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm" placeholder="e.g. i9" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">GPU Model</label>
                                                    <input type="text" value={ep.gpu_model || ''} onChange={e=>handleLocalFieldChange(ep.id, 'gpu_model', e.target.value)} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm" placeholder="e.g. RTX 4090" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">RAM Size</label>
                                                    <input type="text" value={ep.ram_size || ''} onChange={e=>handleLocalFieldChange(ep.id, 'ram_size', e.target.value)} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm" placeholder="e.g. 64GB" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Running Environment</label>
                                                    <input type="text" value={ep.running_environment || ''} onChange={e=>handleLocalFieldChange(ep.id, 'running_environment', e.target.value)} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm" placeholder="e.g. Docker" />
                                                </div>
                                            </div>

                                            <div className="flex items-end space-x-4">
                                                <div className="flex-1 max-w-lg">
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Model</label>
                                                    <div className="flex space-x-2">
                                                        <select
                                                            value={ep.selectedModel || ''}
                                                            onChange={(e) => handleLocalModelSelect(ep.id, e.target.value)}
                                                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                                                        >
                                                            <option value="">-- Select a Model --</option>
                                                            {(ep.modelsList || []).map(m => (
                                                                <option key={m} value={m}>{m}</option>
                                                            ))}
                                                        </select>
                                                        <span className="relative group inline-block">
                                                            <button
                                                                onClick={() => handleFetchLocalModels(ep.id)}
                                                                disabled={isFetchingLocalModels[ep.id] || String(ep.id).startsWith('temp-')}
                                                                title={String(ep.id).startsWith('temp-') ? "Please save the endpoint first" : ""}
                                                                className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
                                                            >
                                                                {isFetchingLocalModels[ep.id] ? 'Fetching...' : 'Fetch Models'}
                                                            </button>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Config (JSON)</label>
                                                <div className="flex flex-col md:flex-row gap-4 h-48">
                                                    <textarea
                                                        className="w-full md:w-1/2 p-3 font-mono text-sm border dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                                        value={currentModelConfig}
                                                        onChange={(e) => handleLocalModelConfigChange(ep.id, ep.selectedModel, e.target.value)}
                                                        placeholder='{
  "temperature": 0.7
}'
                                                    />
                                                    <div className="w-full md:w-1/2 overflow-auto bg-gray-50 dark:bg-gray-800 border dark:border-gray-600 rounded-md p-3">
                                                        <ReactJson
                                                            value={(() => {
                                                                try {
                                                                    const parsed = JSON.parse(currentModelConfig || '{}');
                                                                    if (parsed === null || typeof parsed !== 'object') {
                                                                        return { error: "Invalid JSON (must be an object)" };
                                                                    }
                                                                    if (Array.isArray(parsed)) {
                                                                        return parsed;
                                                                    }
                                                                    return parsed;
                                                                } catch (e) {
                                                                    return { error: "Invalid JSON" };
                                                                }
                                                            })()}
                                                            style={document.documentElement.classList.contains('dark') ? darkTheme : lightTheme}
                                                            displayDataTypes={false}
                                                            enableClipboard={false}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex justify-end mt-4">
                                                <button onClick={() => saveLocalEndpoint(ep.id)} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                                                    Save
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Meta Prompting Section - Separated completely from Local Endpoint Manager */}
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
