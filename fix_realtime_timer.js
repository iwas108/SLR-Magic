const fs = require('fs');
const filepath = 'llm-proxy/frontend/src/pages/Realtime.jsx';
let content = fs.readFileSync(filepath, 'utf8');

// We need to add a timer to the Realtime component to periodically update the UI for active streams.
// Let's add a `currentTime` state that updates every second.
content = content.replace(
    'const streamsEndRef = useRef(null);',
    'const streamsEndRef = useRef(null);\n    const [now, setNow] = useState(Date.now());\n\n    useEffect(() => {\n        const interval = setInterval(() => setNow(Date.now()), 1000);\n        return () => clearInterval(interval);\n    }, []);'
);

const oldHeader = `<div className="text-xs text-gray-500 dark:text-gray-400">
                                    Started: {new Date(stream.startTime).toLocaleTimeString()}
                                    {stream.endTime && \` • Ended: \${new Date(stream.endTime).toLocaleTimeString()}\`}
                                </div>`;

const newHeader = `<div className="text-xs text-gray-500 dark:text-gray-400">
                                    Started: {new Date(stream.startTime).toLocaleTimeString()}
                                    {stream.status === 'active' && \` • Elapsed: \${Math.floor((now - stream.startTime) / 1000)}s\`}
                                    {stream.endTime && \` • Ended: \${new Date(stream.endTime).toLocaleTimeString()}\`}
                                </div>`;

content = content.replace(oldHeader, newHeader);
fs.writeFileSync(filepath, content);
