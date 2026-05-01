const fs = require('fs');
const filepath = 'llm-proxy/frontend/src/pages/Realtime.jsx';
let content = fs.readFileSync(filepath, 'utf8');

// The user wants to show `stream.prompt_json?.messages?.[0]?.content` if available, or fallback to `stream.prompt`.
// The backend might be sending `stream.prompt` as a truncated version. We can extract it from the full JSON payload.
const oldString = '{stream.prompt}';
const newString = '{stream.prompt_json?.messages?.[0]?.content || stream.prompt}';

content = content.replace(oldString, newString);
fs.writeFileSync(filepath, content);
