import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { Activity, XCircle, CheckCircle2, Clock } from 'lucide-react';

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
    const streamsEndRef = useRef(null);

    useEffect(() => {
        // Process new messages
        if (messages.length === 0) return;

        const newStreams = { ...streams };

        messages.forEach((msg) => {
            const { stream_id, type, chunk, error, summary, timestamp, prompt, label } = msg;

            if (!stream_id) return;

            if (!newStreams[stream_id]) {
                newStreams[stream_id] = {
                    id: stream_id,
                    prompt: prompt || 'Unknown Prompt',
                    label: label || 'Unknown Endpoint',
                    status: 'active',
                    content: '',
                    thinking: '',
                    startTime: timestamp || Date.now(),
                    endTime: null,
                    error: null,
                    summary: null
                };
            }

            const stream = newStreams[stream_id];

            switch (type) {
                case 'chunk':
                    stream.content += chunk;
                    break;
                case 'thinking':
                    stream.thinking += chunk;
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

        // Auto-scroll to bottom of active streams
        streamsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, clearMessages, streams]);

    const activeStreamCount = Object.values(streams).filter(s => s.status === 'active').length;

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold flex items-center">
                        <Activity className="w-6 h-6 mr-2 text-blue-500" />
                        Realtime Streaming
                    </h2>
                    <p className="text-gray-600 mt-1">
                        Live view of active LLM generation streams
                    </p>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="flex flex-col items-end">
                        <span className="text-sm text-gray-500">WS Status</span>
                        <div className="flex items-center">
                            <span className={`w-3 h-3 rounded-full mr-2 ${
                                status === 'connected' ? 'bg-green-500' :
                                status === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                            }`}></span>
                            <span className="font-medium uppercase text-sm">{status}</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end border-l pl-4">
                        <span className="text-sm text-gray-500">Active Streams</span>
                        <span className="font-bold text-xl">{activeStreamCount}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {Object.keys(streams).length === 0 ? (
                    <div className="bg-white p-12 rounded-lg border-2 border-dashed text-center text-gray-500">
                        <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg">Waiting for streams...</p>
                        <p className="text-sm mt-2">Send a request to the proxy to see live generation here.</p>
                    </div>
                ) : (
                    Object.values(streams).reverse().map((stream) => (
                        <div key={stream.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
                                <div className="flex items-center space-x-3">
                                    {stream.status === 'active' && <Activity className="w-5 h-5 text-blue-500 animate-pulse" />}
                                    {stream.status === 'complete' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                                    {stream.status === 'error' && <XCircle className="w-5 h-5 text-red-500" />}

                                    <div>
                                        <div className="font-medium">{stream.label}</div>
                                        <div className="text-xs text-gray-500 font-mono">{stream.id}</div>
                                    </div>
                                </div>
                                <div className="text-xs text-gray-500">
                                    Started: {new Date(stream.startTime).toLocaleTimeString()}
                                    {stream.endTime && ` • Ended: ${new Date(stream.endTime).toLocaleTimeString()}`}
                                </div>
                            </div>

                            {/* Prompt */}
                            <div className="p-4 border-b bg-gray-50">
                                <div className="text-xs font-bold text-gray-500 uppercase mb-1">Prompt</div>
                                <div className="text-sm text-gray-700 truncate font-mono bg-white p-2 border rounded">
                                    {stream.prompt}
                                </div>
                            </div>

                            {/* Thinking (if any) */}
                            {stream.thinking && (
                                <div className="p-4 border-b bg-yellow-50">
                                    <div className="text-xs font-bold text-yellow-700 uppercase mb-1">Thinking Process</div>
                                    <div className="text-sm text-gray-600 font-mono whitespace-pre-wrap italic max-h-48 overflow-y-auto">
                                        {stream.thinking}
                                    </div>
                                </div>
                            )}

                            {/* Content */}
                            <div className="p-4 bg-white flex-1">
                                <div className="text-xs font-bold text-gray-500 uppercase mb-1">Response</div>
                                <div className="text-sm text-gray-900 font-mono whitespace-pre-wrap break-words">
                                    {stream.content}
                                    {stream.status === 'active' && <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse"></span>}
                                </div>
                            </div>

                            {/* Footer / Error */}
                            {stream.error && (
                                <div className="p-3 bg-red-50 text-red-700 text-sm border-t border-red-100">
                                    <span className="font-bold">Error:</span> {stream.error}
                                </div>
                            )}

                            {stream.summary && (
                                <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 border-t flex justify-end space-x-4">
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
