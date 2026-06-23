<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


### 3.4 Refactoring & Tree Shaking
*   **Mandatory Tree Shaking**: Whenever a coding agent refactors large monolithic files or extracts components/hooks, the agent **MUST** perform rigorous tree-shaking and compilation checks (`npx tsc --noEmit`). 
*   Always remove dead code, unused states, unused imports, and duplicate variable declarations left behind after extracting logic.
*   Do not leave fragmented code blocks that cause silent failures or typescript errors.
