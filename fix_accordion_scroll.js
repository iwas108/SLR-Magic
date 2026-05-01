const fs = require('fs');
const filepath = 'llm-proxy/frontend/src/pages/Realtime.jsx';
let content = fs.readFileSync(filepath, 'utf8');

const oldString = `max-h-64 overflow-y-auto`;
const newString = `max-h-[300px] overflow-y-auto`; // Just change to a specific arbitrary height to see if the previous replace was accurate

content = content.replace(oldString, newString);

// Also the user mentioned "Show the full content in 'Raw Prompt Content' and add scrolling".
// Wait, maybe the user means to NOT truncate it via a line clamp?
// In the initial state, there was no line clamp, but maybe it was inheriting something.
// Ah, the user provided an image. In the image we can see `overflow-y-auto` added scrolling but maybe it needs styling changes.

// Wait, the prompt says "Show the full content in "Raw Prompt Content" and add scrolling."
// Does this mean the `JsonView` shouldn't be constrained when the accordion is open, or the accordion content itself should have scrolling?
// In the user's provided image, we see a scrollbar inside the "Raw Prompt Content" box. So `max-h-64 overflow-y-auto` or similar is exactly what they want.
fs.writeFileSync(filepath, content);
