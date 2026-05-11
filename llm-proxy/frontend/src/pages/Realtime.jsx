import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { fetchActiveStreams } from '../services/api';
import { Activity, XCircle, CheckCircle2, Clock } from 'lucide-react';
import JsonView from '@uiw/react-json-view';
import { lightTheme } from '@uiw/react-json-view/light';
import { darkTheme } from '@uiw/react-json-view/dark';
import { ChevronDown, ChevronRight } from 'lucide-react';

const getWebSocketUrl = () => {
    if (import.meta.env.DEV) {
        return `ws://${window.location.hostname}:8899`;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
};

const Realtime = () => {
    const wsUrl = getWebSocketUrl();
    const { messages, status, clearMessages } = useWebSocket(wsUrl);
    const [streams, setStreams] = useState({});
    const [expandedPrompts, setExpandedPrompts] = useState({});

    const togglePrompt = (id) => {
        setExpandedPrompts(prev => ({ ...prev, [id]: !prev[id] }));
    };
    const streamsEndRef = useRef(null);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            const currentTime = Date.now();
            setNow(currentTime);

            setStreams(prevStreams => {
                let hasChanges = false;
                const newStreams = { ...prevStreams };

                Object.keys(newStreams).forEach(id => {
                    const stream = newStreams[id];
                    if (stream.status === 'error' && stream.endTime) {
                        if (currentTime - stream.endTime > 60000) {
                            delete newStreams[id];
                            hasChanges = true;
                        }
                    }
                });

                return hasChanges ? newStreams : prevStreams;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const initStreams = async () => {
            try {
                const activeStreamsData = await fetchActiveStreams();
                if (activeStreamsData && Object.keys(activeStreamsData).length > 0) {
                    const mappedStreams = {};
                    for (const [id, data] of Object.entries(activeStreamsData)) {
                        let fullContent = '';
                        let fullThinking = '';
                        for (const chunk of (data.content_chunks || [])) {
                            if (chunk.in_thinking) {
                                fullThinking += chunk.content;
                            } else {
                                fullContent += chunk.content;
                            }
                        }

                        mappedStreams[id] = {
                            id: id,
                            prompt: data.prompt || 'Unknown Prompt',
                            prompt_json: data.prompt_json || null,
                            label: data.label || 'Unknown Endpoint',
                            status: data.status || 'active',
                            content: fullContent,
                            thinking: fullThinking,
                            startTime: data.startTime || Date.now(),
                            endTime: data.endTime || null,
                            error: data.error || null,
                            summary: null
                        };
                    }
                    setStreams(mappedStreams);
                }
            } catch (err) {
                console.error("Failed to fetch active streams on mount:", err);
            }
        };

        initStreams();
    }, []);

    useEffect(() => {
        // Process new messages
        if (messages.length === 0) return;

        const newStreams = { ...streams };

        messages.forEach((msg) => {
            const { stream_id, type, content, in_thinking, error, summary, timestamp, prompt, label } = msg;

            if (!stream_id) return;

            if (!newStreams[stream_id]) {
                newStreams[stream_id] = {
                    id: stream_id,
                    prompt: prompt || 'Unknown Prompt',
                    prompt_json: msg.prompt_json || null,
                    label: label || 'Unknown Endpoint',
                    status: type === 'error' ? 'error' : (msg.status || 'active'),
                    content: '',
                    thinking: '',
                    startTime: timestamp || Date.now(),
                    endTime: msg.endTime || null,
                    error: msg.error || null,
                    summary: null
                };
            }

            const stream = newStreams[stream_id];

            switch (type) {
                case 'content':
                    if (in_thinking) {
                        stream.thinking += (content || '');
                    } else {
                        stream.content += (content || '');
                    }
                    break;
                case 'error':
                    stream.status = 'error';
                    stream.error = error;
                    stream.endTime = Date.now();
                    break;
                case 'end':
                    stream.status = 'complete';
                    stream.summary = summary;
                    stream.endTime = Date.now();
                    break;
                default:
                    break;
            }
        });

        setStreams(newStreams);
        // We handle messages, now clear them so we don't re-process
        clearMessages();

        // Auto-scroll all thinking containers to bottom
        setTimeout(() => {
            const thinkingContainers = document.querySelectorAll('.thinking-container-active');
            thinkingContainers.forEach(container => {
                // Only auto-scroll if the user hasn't significantly scrolled up manually
                const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
                // Only force scroll on top if content is very small to avoid snapping while reading
                if (isNearBottom || (container.scrollTop === 0 && container.scrollHeight < 300)) {
                    container.scrollTop = container.scrollHeight;
                }
            });
        }, 0);
    }, [messages, clearMessages, streams]);

    const activeStreamCount = Object.values(streams).filter(s => s.status === 'active').length;

    return (
        <div className="space-y-6 text-gray-900 dark:text-gray-100">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold flex items-center">
                        <Activity className="w-6 h-6 mr-2 text-blue-500 dark:text-blue-400" />
                        Realtime Streaming
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Live view of active LLM generation streams
                    </p>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="flex flex-col items-end">
                        <span className="text-sm text-gray-500 dark:text-gray-400">WS Status</span>
                        <div className="flex items-center">
                            <span className={`w-3 h-3 rounded-full mr-2 ${
                                status === 'connected' ? 'bg-green-500' :
                                status === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                            }`}></span>
                            <span className="font-medium uppercase text-sm">{status}</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end border-l dark:border-gray-600 pl-4">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Active Streams</span>
                        <span className="font-bold text-xl">{activeStreamCount}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {Object.keys(streams).length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 p-12 rounded-lg border-2 border-dashed dark:border-gray-600 text-center text-gray-500 dark:text-gray-400">
                        <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg">Waiting for streams...</p>
                        <p className="text-sm mt-2">Send a request to the proxy to see live generation here.</p>
                    </div>
                ) : (
                    Object.values(streams).reverse().map((stream) => (
                        <div key={stream.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b dark:border-gray-700 flex justify-between items-center">
                                <div className="flex items-center space-x-3">
                                    {stream.status === 'active' && <Activity className="w-5 h-5 text-blue-500 dark:text-blue-400 animate-pulse" />}
                                    {stream.status === 'complete' && <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400" />}
                                    {stream.status === 'error' && <XCircle className="w-5 h-5 text-red-500 dark:text-red-400" />}

                                    <div>
                                        <div className="font-medium">{stream.label}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{stream.id}</div>
                                    </div>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Started: {new Date(stream.startTime).toLocaleTimeString()}
                                    {stream.status === 'active' && ` • Elapsed: ${Math.floor((now - stream.startTime) / 1000)}s`}
                                    {stream.endTime && ` • Ended: ${new Date(stream.endTime).toLocaleTimeString()}`}
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                                {/* Prompt (Left on Desktop, Top on Mobile) */}
                                <div className="p-4 border-b md:border-b-0 md:border-r dark:border-gray-700 bg-gray-50 dark:bg-gray-800 md:w-1/2 flex flex-col max-h-[500px]">
                                    <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Prompt</div>
                                    <div className="flex flex-col flex-1 overflow-y-auto">
                                        <div className="mb-2">
                                            <button
                                                onClick={() => togglePrompt(stream.id)}
                                                className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                                            >
                                                {expandedPrompts[stream.id] ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
                                                Raw Prompt Content
                                            </button>
                                            {expandedPrompts[stream.id] && (
                                                <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 font-mono bg-white dark:bg-gray-900 p-2 border dark:border-gray-600 rounded whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto">
                                                    {stream.prompt_json?.messages?.[0]?.content || stream.prompt}
                                                </div>
                                            )}
                                        </div>
                                        {stream.prompt_json && (
                                            <div className="text-sm text-gray-700 dark:text-gray-300 font-mono bg-white dark:bg-gray-900 p-2 border dark:border-gray-600 rounded overflow-y-auto flex-1">
                                                <JsonView
                                                    value={stream.prompt_json}
                                                    displayDataTypes={false}
                                                    displayObjectSize={false}
                                                    collapsed={1}
                                                    style={document.documentElement.classList.contains('dark') ? darkTheme : lightTheme}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Response Area (Right on Desktop, Bottom on Mobile) */}
                                <div className="md:w-1/2 flex flex-col max-h-[500px]">
                                    {/* Thinking (if any) */}
                                    {stream.thinking && (
                                        <div className="p-4 border-b dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/20 flex-shrink-0 max-h-[50%] flex flex-col">
                                            <div className="text-xs font-bold text-yellow-700 dark:text-yellow-500 uppercase mb-1">Thinking Process</div>
                                            <div className={`text-sm text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap italic overflow-y-auto flex-1 ${stream.status === 'active' ? 'thinking-container-active' : ''}`}>
                                                {stream.thinking}
                                                {stream.status === 'active' && <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse opacity-50"></span>}
                                            </div>
                                        </div>
                                    )}

                                    {/* Content */}
                                    <div className="p-4 bg-white dark:bg-gray-800 flex-1 overflow-y-auto">
                                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Response</div>
                                        {(() => {
                                            if (stream.status === 'active') {
                                                return (
                                                    <div className="text-sm text-gray-900 dark:text-gray-100 font-mono whitespace-pre-wrap break-words">
                                                        {stream.content}
                                                        <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse"></span>
                                                    </div>
                                                );
                                            }

                                            let parsed = null;
                                            try {
                                                if (stream.content) {
                                                    parsed = JSON.parse(stream.content);
                                                }
                                            } catch (e) {
                                                // Failed to parse, will render as flat text
                                            }

                                            if (parsed && typeof parsed === 'object' && parsed.final_evaluation) {
                                                return (
                                                    <div className="flex flex-col space-y-4">
                                                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                                                            <h5 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2 border-b border-blue-200 dark:border-blue-800 pb-1">Final Evaluation</h5>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                                                <div>
                                                                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">Decision</span>
                                                                    <div className="font-mono text-sm text-gray-900 dark:text-gray-100">{parsed.final_evaluation.decision}</div>
                                                                </div>
                                                                <div>
                                                                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">Exclusion Code</span>
                                                                    <div className="font-mono text-sm text-gray-900 dark:text-gray-100">{parsed.final_evaluation.exclusion_code || 'N/A'}</div>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">Reasoning</span>
                                                                <div className="font-mono text-sm text-gray-900 dark:text-gray-100 mt-1">{parsed.final_evaluation.reasoning}</div>
                                                            </div>
                                                        </div>

                                                        {parsed.logic_trace && (
                                                            <div>
                                                                <h5 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Logic Trace</h5>
                                                                <div className="text-sm text-gray-700 dark:text-gray-300 font-mono bg-white dark:bg-gray-900 p-2 border dark:border-gray-600 rounded overflow-x-auto">
                                                                    <JsonView
                                                                        value={parsed.logic_trace}
                                                                        displayDataTypes={false}
                                                                        displayObjectSize={false}
                                                                        collapsed={1}
                                                                        style={document.documentElement.classList.contains('dark') ? darkTheme : lightTheme}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            } else {
                                                return (
                                                    <div className="text-sm text-gray-900 dark:text-gray-100 font-mono whitespace-pre-wrap break-words">
                                                        {stream.content}
                                                    </div>
                                                );
                                            }
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* Footer / Error */}
                            {stream.error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm border-t border-red-100 dark:border-red-800">
                                    <span className="font-bold">Error:</span> {stream.error}
                                </div>
                            )}

                            {stream.summary && (
                                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 dark:text-gray-400 border-t dark:border-gray-700 flex justify-end space-x-4">
                                    <span>Tokens: {stream.summary.prompt_tokens} / {stream.summary.completion_tokens}</span>
                                    <span>Duration: {(stream.summary.total_duration / 1000).toFixed(2)}s</span>
                                </div>
                            )}
                        </div>
                    ))
                )}
                <div ref={streamsEndRef} />
            </div>
        </div>
    );
};

export default Realtime;
