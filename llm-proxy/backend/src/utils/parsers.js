function optimisticRepairJson(text) {
    // 1. Repair quotes in flat string values
    const pattern = /("\w+"\s*:\s*")([\s\S]*?)("\s*(?:,|}|\]))/g;

    let repaired = text.replace(pattern, (match, start, content, end) => {
        // If content contains standard object/array syntax or looks like nested JSON mapping, skip quote repair
        if (/\{\s*\\?"\w+\\?"\s*:/.test(content)) {
            return match;
        }

        let repairedContent = content.replace(/\\"/g, '"').replace(/"/g, '\\"');
        return start + repairedContent + end;
    });

    // 2. Safely encode newlines and control characters everywhere inside strings
    let inString = false;
    let escapeNext = false;
    let result = '';

    for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];

        if (escapeNext) {
            result += char;
            escapeNext = false;
            continue;
        }

        if (char === '\\') {
            result += char;
            escapeNext = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            result += char;
            continue;
        }

        if (inString) {
            if (char === '\n') {
                result += '\\n';
            } else if (char === '\r') {
                // skip
            } else if (char === '\t') {
                result += '\\t';
            } else {
                result += char;
            }
        } else {
            result += char;
        }
    }

    return result;
}

function extractJsonFromMixedText(text) {
    // First, strip valid think blocks
    let textNoThink = text.replace(/<think>[\s\S]*?<\/think>/g, '');
    textNoThink = textNoThink.replace(/### LOGIC TRACE[\s\S]*?### FINAL DECISION/g, '');

    // Check if it has markdown json block
    const markdownMatch = textNoThink.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (markdownMatch) {
        const extracted = markdownMatch[1].trim();
        try {
            JSON.parse(extracted);
            return extracted;
        } catch (e) {
            // Ignore parse error and fallback
        }
    }

    // Global basic repair for trailing commas
    const textRepaired = textNoThink.replace(/,\s*([}\]])/g, '$1');

    // Very simple attempt to find JSON
    // A robust JSON extraction port from Python raw_decode
    function extractJsonBlocks(str) {
        let blocks = [];
        let inString = false;
        let escapeNext = false;
        let stack = [];
        let startIndex = -1;

        for (let i = 0; i < str.length; i++) {
            const char = str[i];

            if (escapeNext) {
                escapeNext = false;
                continue;
            }

            if (char === '\\') {
                escapeNext = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === '{' || char === '[') {
                    if (stack.length === 0) {
                        startIndex = i;
                    }
                    stack.push(char);
                } else if (char === '}' || char === ']') {
                    const expectedMatch = char === '}' ? '{' : '[';
                    if (stack.length > 0 && stack[stack.length - 1] === expectedMatch) {
                        stack.pop();
                        if (stack.length === 0 && startIndex !== -1) {
                            const possibleJson = str.slice(startIndex, i + 1);
                            try {
                                JSON.parse(possibleJson);
                                blocks.push(possibleJson);
                            } catch (e) {
                                // Invalid block
                            }
                            startIndex = -1; // Ready for next block
                        }
                    } else {
                        // Unmatched bracket, reset
                        stack = [];
                        startIndex = -1;
                    }
                }
            }
        }
        return blocks;
    }

    const validBlocks = extractJsonBlocks(textRepaired);
    if (validBlocks.length > 0) {
        return validBlocks[validBlocks.length - 1]; // Return the last valid block
    }

    // Optimistic repair
    const repairedAllText = optimisticRepairJson(textRepaired);
    const validBlocksRepaired = extractJsonBlocks(repairedAllText);
    if (validBlocksRepaired.length > 0) {
        return validBlocksRepaired[validBlocksRepaired.length - 1];
    }

    return text;
}

module.exports = {
    optimisticRepairJson,
    extractJsonFromMixedText
};
