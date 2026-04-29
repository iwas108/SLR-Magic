import React, { useEffect, useState } from 'react';
import { fetchHistory } from '../services/api';
import { Search, ChevronLeft, ChevronRight, Copy, X } from 'lucide-react';

const History = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            setLoading(true);
            const data = await fetchHistory();
            setHistory(data.history || []);
        } catch (error) {
            console.error('Error loading history:', error);
        } finally {
            setLoading(false);
        }
    };

    const openModal = (request, index) => {
        setSelectedRequest(request);
        setSelectedIndex(index);
    };

    const closeModal = () => {
        setSelectedRequest(null);
        setSelectedIndex(-1);
    };

    const navigatePrev = () => {
        if (selectedIndex > 0) {
            const newIndex = selectedIndex - 1;
            setSelectedRequest(history[newIndex]);
            setSelectedIndex(newIndex);
        }
    };

    const navigateNext = () => {
        if (selectedIndex < history.length - 1) {
            const newIndex = selectedIndex + 1;
            setSelectedRequest(history[newIndex]);
            setSelectedIndex(newIndex);
        }
    };

    const copyRefinementPrompt = () => {
        if (!selectedRequest) return;
        const prompt = `<research_context>\n</research_context>\n\n<task>\n</task>\n\n<original_prompt>\n${selectedRequest.prompt}\n</original_prompt>\n\n<model_response>\n${selectedRequest.response}\n</model_response>\n\n<critique>\n</critique>\n\n<refinement>\n</refinement>`;
        navigator.clipboard.writeText(prompt).then(() => {
            alert('Refinement prompt copied to clipboard!');
        });
    };

    const formatTime = (ms) => {
        if (!ms) return '-';
        return (ms / 1000).toFixed(2) + ' s';
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">History</h2>
                <button
                    onClick={loadHistory}
                    className="px-4 py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
                >
                    Refresh
                </button>
            </div>

            {loading ? (
                <div className="text-center py-8 text-gray-500">Loading history...</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prompt (Truncated)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tokens (In/Out)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cache</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {history.map((item, index) => (
                                <tr
                                    key={item.id}
                                    onClick={() => openModal(item, index)}
                                    className="hover:bg-gray-50 cursor-pointer"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(item.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {item.model}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                                        {item.prompt}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {item.prompt_tokens} / {item.completion_tokens}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {formatTime(item.total_duration)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {item.is_cached ? (
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                Hit
                                            </span>
                                        ) : (
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                                Miss
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h3 className="text-lg font-semibold">Request Details</h3>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-500">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                            <div className="flex gap-2">
                                <button
                                    onClick={navigatePrev}
                                    disabled={selectedIndex === 0}
                                    className="px-3 py-1 bg-white border rounded shadow-sm disabled:opacity-50 flex items-center"
                                >
                                    <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                                </button>
                                <button
                                    onClick={navigateNext}
                                    disabled={selectedIndex === history.length - 1}
                                    className="px-3 py-1 bg-white border rounded shadow-sm disabled:opacity-50 flex items-center"
                                >
                                    Next <ChevronRight className="w-4 h-4 ml-1" />
                                </button>
                            </div>
                            <button
                                onClick={copyRefinementPrompt}
                                className="px-3 py-1 bg-blue-600 text-white rounded shadow-sm hover:bg-blue-700 flex items-center"
                            >
                                <Copy className="w-4 h-4 mr-1" /> Copy Refinement Prompt
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-gray-50 p-3 rounded">
                                    <span className="text-xs text-gray-500 font-bold uppercase">Model</span>
                                    <div className="font-mono text-sm">{selectedRequest.model}</div>
                                </div>
                                <div className="bg-gray-50 p-3 rounded">
                                    <span className="text-xs text-gray-500 font-bold uppercase">Endpoint</span>
                                    <div className="font-mono text-sm">{selectedRequest.endpoint || 'N/A'}</div>
                                </div>
                                <div className="bg-gray-50 p-3 rounded">
                                    <span className="text-xs text-gray-500 font-bold uppercase">Tokens (Prompt/Completion)</span>
                                    <div className="font-mono text-sm">
                                        {selectedRequest.prompt_tokens} / {selectedRequest.completion_tokens}
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-3 rounded">
                                    <span className="text-xs text-gray-500 font-bold uppercase">Total Duration</span>
                                    <div className="font-mono text-sm">{formatTime(selectedRequest.total_duration)}</div>
                                </div>
                            </div>

                            <div className="mb-6">
                                <h4 className="text-sm font-bold text-gray-700 mb-2">Prompt</h4>
                                <pre className="bg-gray-100 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap overflow-x-auto border border-gray-200">
                                    {selectedRequest.prompt}
                                </pre>
                            </div>

                            {selectedRequest.thinking && (
                                <div className="mb-6">
                                    <h4 className="text-sm font-bold text-gray-700 mb-2">Thinking Process</h4>
                                    <pre className="bg-yellow-50 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap overflow-x-auto border border-yellow-200 text-gray-600 italic">
                                        {selectedRequest.thinking}
                                    </pre>
                                </div>
                            )}

                            <div>
                                <h4 className="text-sm font-bold text-gray-700 mb-2">Response</h4>
                                <pre className="bg-blue-50 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap overflow-x-auto border border-blue-200">
                                    {selectedRequest.response}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default History;
