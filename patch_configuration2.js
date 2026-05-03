const fs = require('fs');

const file = 'llm-proxy/frontend/src/pages/Configuration.jsx';
let content = fs.readFileSync(file, 'utf8');

// The file doesn't have an `EndpointManager` component, it has one large `Configuration` component.
// So let's extract the `CloudEndpointsManager` code into a standalone component string and inject it before `const Configuration = () => {`

const cloudManagerComponent = `
const CloudEndpointsManager = () => {
    const [endpoints, setEndpoints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [syncingId, setSyncingId] = useState(null);

    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        provider: 'google',
        name: '',
        api_key: '',
        model_prefix: '',
        thinking_mode: false,
        streaming: false,
        structured_output: false,
        flex_inference: false
    });

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await fetchCloudEndpoints();
            setEndpoints(data);
            setError('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            await upsertCloudEndpoint({
                id: editingId,
                ...formData
            });
            setIsModalOpen(false);
            loadData();
        } catch (err) {
            alert('Error saving: ' + err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this cloud endpoint?')) return;
        try {
            await deleteCloudEndpoint(id);
            loadData();
        } catch (err) {
            alert('Error deleting: ' + err.message);
        }
    };

    const handleSync = async (id) => {
        try {
            setSyncingId(id);
            const res = await syncCloudModels(id);
            alert(\`Successfully synced \${res.models.length} models\`);
            loadData();
        } catch (err) {
            alert('Error syncing models: ' + err.message);
        } finally {
            setSyncingId(null);
        }
    };

    const openModal = (endpoint = null) => {
        if (endpoint) {
            setEditingId(endpoint.id);
            setFormData({
                provider: endpoint.provider,
                name: endpoint.name,
                api_key: endpoint.api_key,
                model_prefix: endpoint.model_prefix,
                thinking_mode: endpoint.thinking_mode,
                streaming: endpoint.streaming,
                structured_output: endpoint.structured_output,
                flex_inference: endpoint.flex_inference
            });
        } else {
            setEditingId(null);
            setFormData({
                provider: 'google',
                name: '',
                api_key: '',
                model_prefix: '',
                thinking_mode: false,
                streaming: false,
                structured_output: false,
                flex_inference: false
            });
        }
        setIsModalOpen(true);
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mt-8">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Cloud className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Cloud Endpoints</h2>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm"
                >
                    <Plus className="w-4 h-4" />
                    Add Provider
                </button>
            </div>

            <div className="p-4">
                {error && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
                        {error}
                    </div>
                )}
                {loading ? (
                    <div className="text-center py-4 text-gray-500">Loading configs...</div>
                ) : endpoints.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        No cloud endpoints configured.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Provider</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Prefix</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cached Models</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {endpoints.map((ep) => (
                                    <tr key={ep.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{ep.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 capitalize">{ep.provider}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{ep.model_prefix}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {ep.models_cache ? ep.models_cache.length : 0} models
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleSync(ep.id)}
                                                disabled={syncingId === ep.id}
                                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-4"
                                            >
                                                {syncingId === ep.id ? 'Syncing...' : 'Fetch Models'}
                                            </button>
                                            <button
                                                onClick={() => openModal(ep)}
                                                className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-4"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(ep.id)}
                                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {editingId ? 'Edit Cloud Endpoint' : 'Add Cloud Endpoint'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Provider</label>
                                <select
                                    value={formData.provider}
                                    onChange={(e) => setFormData({...formData, provider: e.target.value})}
                                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    required
                                >
                                    <option value="google">Google Gemini</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    placeholder="e.g. My Gemini Config"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
                                <input
                                    type="password"
                                    value={formData.api_key}
                                    onChange={(e) => setFormData({...formData, api_key: e.target.value})}
                                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    placeholder="AIza..."
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model Prefix Filter</label>
                                <input
                                    type="text"
                                    value={formData.model_prefix}
                                    onChange={(e) => setFormData({...formData, model_prefix: e.target.value})}
                                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    placeholder="e.g. gemini-"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">Requests for models containing this string will route here.</p>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Thinking Mode</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Request thought summaries</div>
                                    </div>
                                    <ToggleSwitch checked={formData.thinking_mode} onChange={(c) => setFormData({...formData, thinking_mode: c})} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Streaming</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Stream response chunks</div>
                                    </div>
                                    <ToggleSwitch checked={formData.streaming} onChange={(c) => setFormData({...formData, streaming: c})} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Structured Output</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Force JSON based on prompt template</div>
                                    </div>
                                    <ToggleSwitch checked={formData.structured_output} onChange={(c) => setFormData({...formData, structured_output: c})} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Flex Inference</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Use cheaper, lower priority tier</div>
                                    </div>
                                    <ToggleSwitch checked={formData.flex_inference} onChange={(c) => setFormData({...formData, flex_inference: c})} />
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm bg-purple-600 text-white hover:bg-purple-700 rounded-md flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
`;

content = content.replace(
    /const Configuration = \(\) => \{/,
    `${cloudManagerComponent}\n\nconst Configuration = () => {`
);

content = content.replace(
    /<div className="bg-white dark:bg-gray-800 rounded-lg shadow mt-8 p-6 mb-8">/,
    `<CloudEndpointsManager />\n            <div className="bg-white dark:bg-gray-800 rounded-lg shadow mt-8 p-6 mb-8">`
);

fs.writeFileSync(file, content, 'utf8');
