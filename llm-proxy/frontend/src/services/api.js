const API_BASE_URL = import.meta.env.DEV
    ? `http://${window.location.hostname}:8899/api`
    : `${window.location.origin}/api`;

export const fetchHistory = async () => {
    const response = await fetch(`${API_BASE_URL}/history`);
    if (!response.ok) throw new Error('Failed to fetch history');
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
