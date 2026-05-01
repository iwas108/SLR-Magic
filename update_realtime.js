const fs = require('fs');
const filepath = 'llm-proxy/frontend/src/pages/Realtime.jsx';
let content = fs.readFileSync(filepath, 'utf8');

// 1. Add theme imports for JsonView and Chevron icons
content = content.replace(
  "import JsonView from '@uiw/react-json-view';",
  "import JsonView from '@uiw/react-json-view';\nimport { lightTheme } from '@uiw/react-json-view/light';\nimport { darkTheme } from '@uiw/react-json-view/dark';\nimport { ChevronDown, ChevronRight } from 'lucide-react';"
);

// 2. Add local state to Realtime component to handle accordion state
content = content.replace(
  "const [streams, setStreams] = useState({});",
  "const [streams, setStreams] = useState({});\n    const [expandedPrompts, setExpandedPrompts] = useState({});\n\n    const togglePrompt = (id) => {\n        setExpandedPrompts(prev => ({ ...prev, [id]: !prev[id] }));\n    };"
);

// 3. Update the JsonView usage and add Accordion
const replaceString = `<div className="text-sm text-gray-700 dark:text-gray-300 font-mono bg-white dark:bg-gray-900 p-2 border dark:border-gray-600 rounded overflow-y-auto flex-1">
                                        {stream.prompt_json ? (
                                            <JsonView
                                                value={stream.prompt_json}
                                                displayDataTypes={false}
                                                displayObjectSize={false}
                                                collapsed={1}
                                                style={document.documentElement.classList.contains('dark') ? { backgroundColor: 'transparent' } : {}}
                                            />
                                        ) : (
                                            <div className="whitespace-pre-wrap break-words">{stream.prompt}</div>
                                        )}
                                    </div>`;

const newString = `<div className="flex flex-col flex-1 overflow-y-auto">
                                        <div className="mb-2">
                                            <button
                                                onClick={() => togglePrompt(stream.id)}
                                                className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                                            >
                                                {expandedPrompts[stream.id] ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
                                                Raw Prompt Content
                                            </button>
                                            {expandedPrompts[stream.id] && (
                                                <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 font-mono bg-white dark:bg-gray-900 p-2 border dark:border-gray-600 rounded whitespace-pre-wrap break-words">
                                                    {stream.prompt}
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
                                    </div>`;

content = content.replace(replaceString, newString);

fs.writeFileSync(filepath, content);
