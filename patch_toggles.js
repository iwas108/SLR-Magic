const fs = require('fs');

let content = fs.readFileSync('llm-proxy/frontend/src/pages/Configuration.jsx', 'utf8');

// Update State
content = content.replace(
    `const [cloudEndpoints, setCloudEndpoints] = useState([
        { id: 'gemini', name: 'Gemini API (Google)', enabled: false, apiKey: '', model: '', fetchStatus: 'idle', modelsList: [] }
    ]);`,
    `const [cloudEndpoints, setCloudEndpoints] = useState([
        {
            id: 'gemini',
            name: 'Gemini API (Google)',
            enabled: false,
            apiKey: '',
            model: '',
            fetchStatus: 'idle',
            modelsList: [],
            features: {
                thinking: true,
                thinkingType: 'level', // 'level' or 'budget'
                thinkingLevel: 'low',
                thinkingBudget: 1024,
                structuredOutput: true,
                streaming: true,
                flexInference: false
            }
        }
    ]);`
);

// Add nested state handler
content = content.replace(
    `    const handleCloudFieldChange = (id, field, value) => {
        setCloudEndpoints(prev => prev.map(ce => ce.id === id ? { ...ce, [field]: value } : ce));
    };`,
    `    const handleCloudFieldChange = (id, field, value) => {
        setCloudEndpoints(prev => prev.map(ce => ce.id === id ? { ...ce, [field]: value } : ce));
    };

    const handleCloudFeatureToggle = (id, feature, value) => {
        setCloudEndpoints(prev => prev.map(ce => {
            if (ce.id === id) {
                return { ...ce, features: { ...ce.features, [feature]: value } };
            }
            return ce;
        }));
    };`
);

// Add Toggle Component Helper right after imports
content = content.replace(
    `const ThemeSetting = () => {`,
    `const ToggleSwitch = ({ checked, onChange, disabled }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => { if (!disabled) onChange(!checked); }}
        className={\`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 \${disabled ? 'opacity-50 cursor-not-allowed' : ''}\`}
    >
        <span className="sr-only">Use setting</span>
        <span aria-hidden="true" className={\`pointer-events-none absolute h-full w-full rounded-md bg-transparent\`} />
        <span aria-hidden="true" className={\`pointer-events-none absolute mx-auto h-4 w-9 rounded-full transition-colors duration-200 ease-in-out \${checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}\`} />
        <span aria-hidden="true" className={\`pointer-events-none absolute left-0 inline-block h-5 w-5 transform rounded-full border border-gray-200 dark:border-gray-600 bg-white shadow ring-0 transition-transform duration-200 ease-in-out \${checked ? 'translate-x-4' : 'translate-x-0'}\`} />
    </button>
);

const ThemeSetting = () => {`
);


// Replace the cloud toggle logic in the UI
const oldCloudToggleUI = `<label className="flex items-center space-x-2 cursor-pointer">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{ce.enabled ? 'Enabled' : 'Disabled'}</span>
                                    <input
                                        type="checkbox"
                                        checked={ce.enabled}
                                        onChange={() => handleCloudToggle(ce.id)}
                                        className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                    />
                                </label>`;

const newCloudToggleUI = `<div className="flex items-center space-x-3">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{ce.enabled ? 'Enabled' : 'Disabled'}</span>
                                    <ToggleSwitch checked={ce.enabled} onChange={() => handleCloudToggle(ce.id)} />
                                </div>`;

content = content.replace(oldCloudToggleUI, newCloudToggleUI);

// Replace the features block
const oldFeaturesBlock = `<div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mt-4 bg-white dark:bg-gray-900 p-4 border dark:border-gray-700 rounded-lg">
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
                                    </div>`;

const newFeaturesBlock = `<div className="max-w-2xl mt-4 bg-white dark:bg-gray-900 p-4 border dark:border-gray-700 rounded-lg space-y-4">
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
                                                                        name={\`thinking-level-\${ce.id}\`}
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
                                    </div>`;

content = content.replace(oldFeaturesBlock, newFeaturesBlock);

fs.writeFileSync('llm-proxy/frontend/src/pages/Configuration.jsx', content);
