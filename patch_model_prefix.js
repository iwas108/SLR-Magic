const fs = require('fs');

let content = fs.readFileSync('llm-proxy/frontend/src/pages/Configuration.jsx', 'utf8');

// 1. Update State
content = content.replace(
    `            enabled: false,
            apiKey: '',
            model: '',
            fetchStatus: 'idle',`,
    `            enabled: false,
            modelPrefix: '',
            apiKey: '',
            model: '',
            fetchStatus: 'idle',`
);

// 2. Insert Model Prefix Field in UI
const oldUIBlock = `                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>`;

const newUIBlock = `                                    <div>
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
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>`;

content = content.replace(oldUIBlock, newUIBlock);

fs.writeFileSync('llm-proxy/frontend/src/pages/Configuration.jsx', content);
