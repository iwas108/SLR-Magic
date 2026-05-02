const API_BASE_URL = import.meta.env.DEV
    ? `http://${window.location.hostname}:8899/api`
    : `${window.location.origin}/api`;

export const fetchHistory = async (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.search) query.append('search', params.search);
    if (params.endpoint) query.append('endpoint', params.endpoint);
    if (params.sort_by) query.append('sort_by', params.sort_by);
    if (params.sort_desc !== undefined) query.append('sort_desc', params.sort_desc);
    if (params.time_start) query.append('time_start', params.time_start);
    if (params.time_end) query.append('time_end', params.time_end);

    const url = `${API_BASE_URL}/history?${query.toString()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch history');
    return response.json();
};

export const deleteHistoryItem = async (id) => {
    const response = await fetch(`${API_BASE_URL}/history/${id}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete history item');
    return response.json();
};

export const bulkDeleteHistory = async (ids) => {
    const response = await fetch(`${API_BASE_URL}/history/bulk_delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
    });
    if (!response.ok) throw new Error('Failed to bulk delete history');
    return response.json();
};

export const clearHistory = async () => {
    const response = await fetch(`${API_BASE_URL}/history`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to clear history');
    return response.json();
};

export const fetchEndpointsConfig = async () => {
    const response = await fetch(`${API_BASE_URL}/endpoints/config`);
    if (!response.ok) throw new Error('Failed to fetch endpoint config');
    return response.json();
};

export const fetchEndpoints = async () => {
    const response = await fetch(`${API_BASE_URL}/endpoints`);
    if (!response.ok) throw new Error('Failed to fetch endpoints');
    return response.json();
};

export const upsertEndpointConfig = async (config) => {
    const response = await fetch(`${API_BASE_URL}/endpoints/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    });
    if (!response.ok) throw new Error('Failed to upsert endpoint config');
    return response.json();
};

export const deleteEndpointConfig = async (endpoint_url) => {
    const response = await fetch(`${API_BASE_URL}/endpoints/config`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint_url })
    });
    if (!response.ok) throw new Error('Failed to delete endpoint config');
    return response.json();
};

export const setEndpointProperties = async (properties) => {
    const response = await fetch(`${API_BASE_URL}/stats/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(properties)
    });
    if (!response.ok) throw new Error('Failed to set endpoint properties');
    return response.json();
};

export const fetchStats = async () => {
    const response = await fetch(`${API_BASE_URL}/stats`);
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
};

export const fetchQueueStats = async () => {
    const response = await fetch(`${API_BASE_URL}/queue_stats`);
    if (!response.ok) throw new Error('Failed to fetch queue stats');
    return response.json();
};

export const fetchActiveStreams = async () => {
    const response = await fetch(`${API_BASE_URL}/streams/active`);
    if (!response.ok) throw new Error('Failed to fetch active streams');
    return response.json();
};

export const getConfig = async (key) => {
    const response = await fetch(`${API_BASE_URL}/config/${key}`);
    if (!response.ok) throw new Error(`Failed to fetch config for ${key}`);
    return response.json();
};

export const setConfig = async (key, value) => {
    const response = await fetch(`${API_BASE_URL}/config/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
    });
    if (!response.ok) throw new Error(`Failed to set config for ${key}`);
    return response.json();
};

export const fetchResearchContexts = async () => {
    const response = await fetch(`${API_BASE_URL}/research_contexts`);
    if (!response.ok) throw new Error('Failed to fetch research contexts');
    return response.json();
};

export const addResearchContext = async (data) => {
    const response = await fetch(`${API_BASE_URL}/research_contexts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to add research context');
    return response.json();
};

export const updateResearchContext = async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/research_contexts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update research context');
    return response.json();
};

export const deleteResearchContext = async (id) => {
    const response = await fetch(`${API_BASE_URL}/research_contexts/${id}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete research context');
    return response.json();
};

export const fetchMetaPromptTemplates = async () => {
    const response = await fetch(`${API_BASE_URL}/meta_prompt_templates`);
    if (!response.ok) throw new Error('Failed to fetch meta prompt templates');
    return response.json();
};

export const addMetaPromptTemplate = async (data) => {
    const response = await fetch(`${API_BASE_URL}/meta_prompt_templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to add meta prompt template');
    return response.json();
};

export const updateMetaPromptTemplate = async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/meta_prompt_templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update meta prompt template');
    return response.json();
};

export const deleteMetaPromptTemplate = async (id) => {
    const response = await fetch(`${API_BASE_URL}/meta_prompt_templates/${id}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete meta prompt template');
    return response.json();
};
