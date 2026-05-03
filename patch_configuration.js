const fs = require('fs');

let content = fs.readFileSync('llm-proxy/frontend/src/pages/Configuration.jsx', 'utf8');

const importReplacement = `import { Cloud } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';`;

content = content.replace("import { useTheme } from '../hooks/useTheme';", importReplacement);

// We need to add state for the new Cloud-based Endpoint section
const stateInsertPoint = `    // Meta Prompting states`;

const newState = `    // Cloud-based Endpoint State (Mock)
    const [cloudEndpoints, setCloudEndpoints] = useState([
        { id: 'gemini', name: 'Gemini API (Google)', enabled: false, apiKey: '', model: '', fetchStatus: 'idle', modelsList: [] }
    ]);
    const [isCloudConfigSaving, setIsCloudConfigSaving] = useState(false);

    const handleCloudToggle = (id) => {
        setCloudEndpoints(prev => prev.map(ce => ce.id === id ? { ...ce, enabled: !ce.enabled } : ce));
    };

    const handleCloudFieldChange = (id, field, value) => {
        setCloudEndpoints(prev => prev.map(ce => ce.id === id ? { ...ce, [field]: value } : ce));
    };

    const fetchCloudModels = async (id) => {
        handleCloudFieldChange(id, 'fetchStatus', 'fetching');
        // Mock fetch available models
        setTimeout(() => {
            if (id === 'gemini') {
                handleCloudFieldChange(id, 'modelsList', ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro']);
                handleCloudFieldChange(id, 'model', 'gemini-1.5-pro'); // set default
            }
            handleCloudFieldChange(id, 'fetchStatus', 'success');
        }, 1000);
    };

    const saveCloudEndpoint = async (id) => {
        setIsCloudConfigSaving(true);
        // Mock saving
        setTimeout(() => {
            setIsCloudConfigSaving(false);
            alert('Cloud endpoint config saved! (Mock)');
        }, 800);
    };

    // Meta Prompting states`;

content = content.replace(stateInsertPoint, newState);

const cloudSection = `
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
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{ce.enabled ? 'Enabled' : 'Disabled'}</span>
                                    <input
                                        type="checkbox"
                                        checked={ce.enabled}
                                        onChange={() => handleCloudToggle(ce.id)}
                                        className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                    />
                                </label>
                            </div>

                            {ce.enabled && (
                                <div className="space-y-4 border-t dark:border-gray-700 pt-4 mt-4">
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

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mt-4 bg-white dark:bg-gray-900 p-4 border dark:border-gray-700 rounded-lg">
                                        <div className="col-span-full">
                                            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 border-b dark:border-gray-700 pb-1">Features Configuration</h4>
                                        </div>
                                        <label className="flex items-center space-x-2">
                                            <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600" defaultChecked />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">Enable Thinking</span>
                                        </label>
                                        <label className="flex items-center space-x-2">
                                            <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600" defaultChecked />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">Structured Output</span>
                                        </label>
                                        <label className="flex items-center space-x-2">
                                            <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600" defaultChecked />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">Enable Streaming</span>
                                        </label>
                                        <label className="flex items-center space-x-2">
                                            <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600" />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">Flex Inference Tier</span>
                                        </label>
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
`;

// Insert just above Smart Endpoint Manager
content = content.replace(
    `<div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold mb-6">Smart Endpoint Manager</h2>`,
    `${cloudSection}\n\n            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold mb-6">Smart Endpoint Manager</h2>`
);

fs.writeFileSync('llm-proxy/frontend/src/pages/Configuration.jsx', content);
