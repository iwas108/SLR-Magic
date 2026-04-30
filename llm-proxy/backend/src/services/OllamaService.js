const EventEmitter = require('events');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const AsyncQueue = require('../utils/AsyncQueue');
const { extractJsonFromMixedText } = require('../utils/parsers');

// Simple logger mock until true logger is implemented or we use console
const logger = {
    info: console.log,
    debug: console.log,
    error: console.error
};

class StreamBroadcaster extends EventEmitter {
    constructor() {
        super();
        this.activeStreams = {};
    }

    broadcast(messageStr) {
        this._updateState(messageStr);
        this.emit('message', messageStr);
    }

    _updateState(messageStr) {
        try {
            const data = JSON.parse(messageStr);
            const streamId = data.stream_id;
            if (!streamId) return;

            const msgType = data.type;
            if (msgType === "start") {
                this.activeStreams[streamId] = {
                    endpointUrl: data.endpoint_url,
                    title: data.title,
                    abstract: data.abstract,
                    content_chunks: [],
                    current_chunk: null
                };
            } else if (msgType === "content") {
                if (this.activeStreams[streamId]) {
                    const streamState = this.activeStreams[streamId];
                    const inThinking = data.in_thinking || false;
                    const content = data.content || "";

                    if (!streamState.current_chunk || streamState.current_chunk.in_thinking !== inThinking) {
                        streamState.current_chunk = { in_thinking: inThinking, content: "" };
                        streamState.content_chunks.push(streamState.current_chunk);
                    }

                    streamState.current_chunk.content += content;
                }
            } else if (msgType === "end") {
                if (this.activeStreams[streamId]) {
                    delete this.activeStreams[streamId];
                }
            }
        } catch (e) {
            // Ignore parse errors on broadcast
        }
    }
}

const streamBroadcaster = new StreamBroadcaster();

class OllamaService {
    constructor(urls = []) {
        this.urls = urls;
        this.endpointQueue = new AsyncQueue();
        this.endpointStatus = {};
        this.pendingRequests = 0;

        this.customModels = {}; // endpoint_url -> custom_model string
        this.apiKeys = {};      // endpoint_url -> api_key string
        this.extraConfigs = {}; // endpoint_url -> extra_config json string
        this.streamModes = {};  // endpoint_url -> boolean
        this.endpointLabels = {}; // endpoint_url -> string label

        for (const url of this.urls) {
            this.endpointStatus[url] = "idle";
            this.endpointQueue.enqueue(url);
        }
    }

    syncEndpoints(configs) {
        // configs is a list of objects: [{endpoint_url: "...", enabled: true/false, custom_model: "...", api_key: "...", extra_config: "...", stream_mode: true/false, label: "..."}]
        const activeUrls = configs.filter(c => c.enabled).map(c => c.endpoint_url);

        this.customModels = {};
        this.apiKeys = {};
        this.extraConfigs = {};
        this.streamModes = {};
        this.endpointLabels = {};

        configs.filter(c => c.enabled).forEach(c => {
            if (c.custom_model) this.customModels[c.endpoint_url] = c.custom_model;
            if (c.api_key) this.apiKeys[c.endpoint_url] = c.api_key;
            if (c.extra_config) this.extraConfigs[c.endpoint_url] = c.extra_config;
            this.streamModes[c.endpoint_url] = c.stream_mode ? true : false;
            if (c.label) this.endpointLabels[c.endpoint_url] = c.label;
        });

        // Remove urls that are no longer active from status
        for (const url of this.urls) {
            if (!activeUrls.includes(url)) {
                if (this.endpointStatus[url]) {
                    delete this.endpointStatus[url];
                }
            }
        }

        // Add new urls
        for (const url of activeUrls) {
            if (!this.urls.includes(url)) {
                this.endpointStatus[url] = "idle";
            }
        }

        this.urls = activeUrls;

        // Re-populate queue
        // Extract all current items from the queue
        const currentQueueItems = this.endpointQueue.clear();

        // Re-enqueue only idle active urls
        for (const url of this.urls) {
            if (this.endpointStatus[url] === "idle") {
                this.endpointQueue.enqueue(url);
            }
        }
    }

    async fetchCompletion(openaiPayload, reqHash = "") {
        const messages = openaiPayload.messages || [];

        // Extract default/basic options
        const temperature = openaiPayload.temperature !== undefined ? openaiPayload.temperature : 0.6;
        const maxTokens = openaiPayload.max_tokens !== undefined ? openaiPayload.max_tokens : 8192;

        // Allow fully customizable options from the frontend payload "options" dict
        const customOptions = openaiPayload.options || {};

        let parsedNumCtx = parseInt(customOptions.num_ctx);
        if (isNaN(parsedNumCtx)) {
            parsedNumCtx = 4096;
        }

        const nativeOptions = {
            temperature: temperature,
            num_predict: maxTokens,
            num_ctx: parsedNumCtx
        };

        const thinkParam = customOptions.think;
        delete customOptions.think;

        let parsedKeepAlive = Number(openaiPayload.keep_alive);
        if (isNaN(parsedKeepAlive)) {
            if (typeof openaiPayload.keep_alive === 'string' && openaiPayload.keep_alive.trim() !== "") {
                parsedKeepAlive = openaiPayload.keep_alive;
            } else {
                parsedKeepAlive = 0;
            }
        }

        Object.assign(nativeOptions, customOptions);

        this.pendingRequests += 1;
        let endpointUrl;
        try {
            endpointUrl = await this.endpointQueue.dequeue();
        } finally {
            this.pendingRequests -= 1;
        }

        let hasPdf = false;
        let pdfHash = "";

        // PDF parsing logic
        for (const msg of messages) {
            const content = msg.content;
            if (Array.isArray(content)) {
                for (const part of content) {
                    if (part.type === "image_url") {
                        const url = (part.image_url && part.image_url.url) ? part.image_url.url : "";
                        if (url.startsWith("data:application/pdf;base64,")) {
                            const b64Data = url.split(",")[1];
                            const rawPdfBuffer = Buffer.from(b64Data, 'base64');

                            pdfHash = crypto.createHash('md5').update(rawPdfBuffer).digest('hex');
                            // Use correct static dir path mirroring Python layout logic, or generic static for Node
                            const pdfDir = path.join(__dirname, '..', '..', 'static', 'pdfs');
                            const pdfPath = path.join(pdfDir, `${pdfHash}.pdf`);

                            fs.mkdirSync(pdfDir, { recursive: true });
                            if (!fs.existsSync(pdfPath)) {
                                fs.writeFileSync(pdfPath, rawPdfBuffer);
                            }
                            hasPdf = true;
                        }
                    }
                }
            }
        }

        if (hasPdf) {
            openaiPayload.has_pdf = true;
            openaiPayload.req_hash = reqHash;
            openaiPayload.pdf_hash = pdfHash;
        }

        const baseModel = openaiPayload.model || "qwen3.5-slr";
        let modelName;
        if (baseModel.toLowerCase().startsWith("gemini") || baseModel.toLowerCase().startsWith("gemma")) {
            modelName = baseModel;
        } else {
            modelName = this.customModels[endpointUrl] || baseModel;
        }

        const nativePayload = {
            model: modelName,
            messages: messages,
            keep_alive: parsedKeepAlive,
            options: nativeOptions
        };

        if (thinkParam !== undefined) {
            nativePayload.think = thinkParam;
        }

        logger.debug(`Translated Native Payload: ${JSON.stringify(nativePayload)}`);

        this.endpointStatus[endpointUrl] = "active";
        const shortHash = reqHash ? reqHash.substring(0, 8) : "Unknown";

        if (modelName.toLowerCase().startsWith("gemini") || modelName.toLowerCase().startsWith("gemma")) {
            logger.info(`🚀 Dispatching request [${shortHash}] to endpoint: Gemini API (Model: ${modelName})`);
        } else {
            logger.info(`🚀 Dispatching request [${shortHash}] to endpoint: ${endpointUrl} (Model: ${modelName})`);
        }

        const startTime = Date.now();
        try {
            let result;
            if (modelName.toLowerCase().startsWith("gemini") || modelName.toLowerCase().startsWith("gemma")) {
                let apiKey = this.apiKeys[endpointUrl] || "";
                if (!apiKey) {
                    for (const key of Object.values(this.apiKeys)) {
                        if (key) {
                            apiKey = key;
                            break;
                        }
                    }
                }

                let forceStream = false;
                const extraConfigStr = this.extraConfigs[endpointUrl] || "";
                if (extraConfigStr) {
                    try {
                        const extraConf = JSON.parse(extraConfigStr);
                        forceStream = extraConf.streamMode || false;
                    } catch (e) {}
                }

                if (openaiPayload.stream || forceStream) {
                    result = await this._fetchViaStreamGemini(openaiPayload, modelName, endpointUrl, reqHash, apiKey);
                } else {
                    result = await this._fetchGemini(openaiPayload, modelName, endpointUrl, reqHash, apiKey);
                }
            } else if (this.streamModes[endpointUrl]) {
                nativePayload.stream = true;
                if (openaiPayload.has_pdf) {
                    nativePayload.has_pdf = true;
                    nativePayload.req_hash = reqHash;
                    if (openaiPayload.pdf_hash) {
                        nativePayload.pdf_hash = openaiPayload.pdf_hash;
                    }
                }
                result = await this._fetchViaStream(nativePayload, modelName, messages, endpointUrl);
            } else {
                nativePayload.stream = false;
                result = await this._fetchStandard(nativePayload, modelName, endpointUrl);
            }

            const endpointDurationMs = Date.now() - startTime;
            result.endpoint_duration_ms = endpointDurationMs;
            return result;
        } finally {
            if (this.endpointStatus[endpointUrl] !== undefined) {
                this.endpointStatus[endpointUrl] = "idle";
            }
            if (this.urls.includes(endpointUrl)) {
                this.endpointQueue.enqueue(endpointUrl);
            }
        }
    }

    async _fetchStandard(nativePayload, modelName, endpointUrl) {
        const response = await fetch(endpointUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nativePayload),
            // Timeout handling might require AbortController if necessary, but node fetch default works for basic use.
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const chunk = await response.json();

        const promptTokens = chunk.prompt_eval_count || 0;
        const completionTokens = chunk.eval_count || 0;

        const usage = {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: promptTokens + completionTokens
        };

        const msg = chunk.message || {};
        const rawContent = msg.content || "";
        const thinking = msg.thinking || "";

        let cleanedContent = extractJsonFromMixedText(rawContent);
        let finalContent = cleanedContent;

        if (thinking) {
            finalContent = `<think>\n${thinking}\n</think>\n\n${cleanedContent}`;
        } else if (rawContent.includes("<think>")) {
            const thinkMatch = rawContent.match(/(<think>[\s\S]*?<\/think>)/);
            if (thinkMatch) {
                finalContent = `${thinkMatch[1]}\n\n${cleanedContent}`;
            }
        } else if (rawContent.includes("### LOGIC TRACE")) {
            const logicMatch = rawContent.match(/(### LOGIC TRACE[\s\S]*?(?=### FINAL DECISION|\{))/);
            if (logicMatch) {
                finalContent = `<think>\n${logicMatch[1].trim()}\n</think>\n\n${cleanedContent}`;
            }
        }

        return {
            id: `chatcmpl-${Math.floor(Date.now() / 1000)}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: modelName,
            choices: [{
                index: 0,
                message: { role: "assistant", content: finalContent },
                finish_reason: "stop"
            }],
            usage: usage,
            endpoint_url: endpointUrl
        };
    }

    async _fetchViaStream(nativePayload, modelName, messages, endpointUrl) {
        const streamId = crypto.randomUUID();
        let paperTitle = "Unknown Paper";
        let paperAbstract = "No abstract available.";
        let promptText = "Unknown Prompt";

        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.role === "user") {
                let content = msg.content || "";
                if (typeof content === 'string') {
                    if (promptText === "Unknown Prompt") {
                        promptText = content;
                        // Truncate if very long
                        if (promptText.length > 500) {
                            promptText = promptText.substring(0, 500) + "...";
                        }
                    }

                    const titleMatch = content.match(/Title:\s*([\s\S]*?)(?=\nAbstract:|$)/i);
                    const abstractMatch = content.match(/Abstract:\s*([\s\S]*?)(?=\n[A-Za-z0-9_-]+:|\n\n|$)/i);

                    if (titleMatch) paperTitle = titleMatch[1].replace(/\*\*/g, '').trim();
                    if (abstractMatch) paperAbstract = abstractMatch[1].replace(/\*\*/g, '').trim();

                    if (titleMatch || abstractMatch) break;
                }
            }
        }

        const startPayload = {
            type: "start",
            stream_id: streamId,
            title: paperTitle,
            abstract: paperAbstract,
            endpoint_url: endpointUrl,
            label: this.endpointLabels[endpointUrl] || endpointUrl,
            prompt: promptText
        };

        if (nativePayload.has_pdf) {
            startPayload.has_pdf = true;
            startPayload.req_hash = nativePayload.req_hash || "";
            if (nativePayload.pdf_hash) {
                startPayload.pdf_hash = nativePayload.pdf_hash;
            }
        }

        streamBroadcaster.broadcast(JSON.stringify(startPayload));

        let isPrefilled = false;
        if (messages.length > 0 && messages[messages.length - 1].role === "assistant") {
            const lastContent = messages[messages.length - 1].content || "";
            if (lastContent.includes("<think>")) {
                isPrefilled = true;
            }
        }

        let fullContent = isPrefilled ? "<think>\n" : "";
        let usage = {};
        let inThinking = isPrefilled;
        let nativeThinkingMode = false;

        const response = await fetch(endpointUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nativePayload),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || ""; // Keep the last incomplete line in buffer

            for (const line of lines) {
                if (!line.trim()) continue;

                let chunk;
                try {
                    chunk = JSON.parse(line);
                } catch (e) {
                    continue;
                }

                const msg = chunk.message || {};
                const thinkingPiece = msg.thinking || "";
                const contentPiece = msg.content || "";

                if (thinkingPiece) {
                    if (!inThinking) {
                        fullContent += "<think>\n";
                        inThinking = true;
                        nativeThinkingMode = true;
                    }

                    fullContent += thinkingPiece;

                    streamBroadcaster.broadcast(JSON.stringify({
                        type: "content",
                        stream_id: streamId,
                        content: thinkingPiece,
                        in_thinking: true,
                        endpoint_url: endpointUrl
                    }));
                }

                if (contentPiece) {
                    if (nativeThinkingMode) {
                        fullContent += "\n</think>\n\n";
                        inThinking = false;
                        nativeThinkingMode = false;
                    }

                    if (!inThinking && contentPiece.includes("<think>")) {
                        inThinking = true;
                    }

                    fullContent += contentPiece;

                    streamBroadcaster.broadcast(JSON.stringify({
                        type: "content",
                        stream_id: streamId,
                        content: contentPiece,
                        in_thinking: inThinking,
                        endpoint_url: endpointUrl
                    }));

                    if (inThinking && contentPiece.includes("</think>")) {
                        inThinking = false;
                    }
                }

                if (chunk.done === true) {
                    const promptTokens = chunk.prompt_eval_count || 0;
                    const completionTokens = chunk.eval_count || 0;
                    usage = {
                        prompt_tokens: promptTokens,
                        completion_tokens: completionTokens,
                        total_tokens: promptTokens + completionTokens
                    };
                }
            }
        }

        streamBroadcaster.broadcast(JSON.stringify({
            type: "end",
            stream_id: streamId,
            endpoint_url: endpointUrl
        }));

        let finalContent = fullContent;
        if (isPrefilled || fullContent.includes("<think>") || fullContent.includes("### LOGIC TRACE")) {
            let thinkPart = "";
            const thinkMatch = fullContent.match(/(<think>[\s\S]*?<\/think>)/);
            if (thinkMatch) {
                thinkPart = thinkMatch[1] + "\n\n";
            } else {
                const logicMatch = fullContent.match(/(### LOGIC TRACE[\s\S]*?(?=### FINAL DECISION|\{))/);
                if (logicMatch) {
                    thinkPart = `<think>\n${logicMatch[1].trim()}\n</think>\n\n`;
                }
            }
            const cleanedJson = extractJsonFromMixedText(fullContent);
            finalContent = thinkPart + cleanedJson;
        } else {
            finalContent = extractJsonFromMixedText(fullContent);
        }

        return {
            id: `chatcmpl-${Math.floor(Date.now() / 1000)}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: modelName,
            choices: [{
                index: 0,
                message: { role: "assistant", content: finalContent },
                finish_reason: "stop"
            }],
            usage: usage,
            endpoint_url: endpointUrl
        };
    }

    async _fetchGemini(openaiPayload, modelName, endpointUrl, reqHash, apiKey) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const contents = [];
        for (const msg of (openaiPayload.messages || [])) {
            const parts = [];
            if (typeof msg.content === 'string') {
                parts.push({ text: msg.content });
            } else if (Array.isArray(msg.content)) {
                for (const part of msg.content) {
                    if (part.type === "text") {
                        parts.push({ text: part.text || "" });
                    } else if (part.type === "image_url") {
                        const imgUrl = (part.image_url && part.image_url.url) ? part.image_url.url : "";
                        if (imgUrl.startsWith("data:application/pdf;base64,")) {
                            const b64Data = imgUrl.split(",")[1];
                            parts.push({
                                inline_data: {
                                    mime_type: "application/pdf",
                                    data: b64Data
                                }
                            });
                        } else if (imgUrl.startsWith("data:image/")) {
                            const mime = imgUrl.split(";")[0].split(":")[1];
                            const b64Data = imgUrl.split(",")[1];
                            parts.push({
                                inline_data: {
                                    mime_type: mime,
                                    data: b64Data
                                }
                            });
                        }
                    }
                }
            }

            const role = ["user", "system"].includes(msg.role) ? "user" : "model";
            contents.push({ role: role, parts: parts });
        }

        const geminiPayload = {
            contents: contents,
            generationConfig: {
                temperature: openaiPayload.temperature !== undefined ? openaiPayload.temperature : 0.6,
                maxOutputTokens: openaiPayload.max_tokens !== undefined ? openaiPayload.max_tokens : 8192
            }
        };

        const extraConfigStr = this.extraConfigs[endpointUrl] || "";
        if (extraConfigStr) {
            try {
                const extraConf = JSON.parse(extraConfigStr);
                if (extraConf.temperature !== undefined && extraConf.temperature !== null) {
                    geminiPayload.generationConfig.temperature = parseFloat(extraConf.temperature);
                }
                if (extraConf.maxOutputTokens !== undefined && extraConf.maxOutputTokens !== null) {
                    geminiPayload.generationConfig.maxOutputTokens = parseInt(extraConf.maxOutputTokens);
                }
                if (extraConf.thinkingLevel && extraConf.thinkingLevel !== "none") {
                    const isGemini3 = modelName.toLowerCase().includes("gemini-3");
                    const isGemini25 = modelName.toLowerCase().includes("gemini-2.5");

                    if (isGemini3) {
                        geminiPayload.generationConfig.thinkingConfig = {
                            thinkingLevel: extraConf.thinkingLevel || "low"
                        };
                    } else if (isGemini25) {
                        let budget = parseInt(extraConf.thinkingBudget || 1024);
                        if (budget < 1024) budget = 1024;
                        geminiPayload.generationConfig.thinkingConfig = {
                            thinkingBudgetTokens: budget
                        };
                    }
                }
                if (extraConf.serviceTier === "flex") {
                    geminiPayload.service_tier = "flex";
                }
            } catch (e) {
                logger.error(`Failed to parse or apply Gemini extra_config: ${e.message}`);
            }
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload),
        });

        if (!response.ok) {
            throw new Error(`Gemini API HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const candidates = data.candidates || [];
        if (candidates.length === 0) {
            throw new Error("No candidates returned from Gemini API");
        }

        let contentText = "";
        let nativeThinkingText = "";
        const parts = candidates[0].content ? (candidates[0].content.parts || []) : [];
        for (const part of parts) {
            if (part.thought) {
                nativeThinkingText += part.text || "";
            } else {
                contentText += part.text || "";
            }
        }

        const usageMetadata = data.usageMetadata || {};
        const usage = {
            prompt_tokens: usageMetadata.promptTokenCount || 0,
            completion_tokens: usageMetadata.candidatesTokenCount || 0,
            total_tokens: usageMetadata.totalTokenCount || 0,
            thoughts_tokens: usageMetadata.thoughtsTokenCount || 0
        };

        let cleanedContent = extractJsonFromMixedText(contentText);

        if (contentText.includes("<think>")) {
            const thinkMatch = contentText.match(/(<think>[\s\S]*?<\/think>)/);
            if (thinkMatch) {
                cleanedContent = `${thinkMatch[1]}\n\n${cleanedContent}`;
            }
        } else if (contentText.includes("### LOGIC TRACE")) {
            const logicMatch = contentText.match(/(### LOGIC TRACE[\s\S]*?(?=### FINAL DECISION|\{))/);
            if (logicMatch) {
                cleanedContent = `<think>\n${logicMatch[1].trim()}\n</think>\n\n${cleanedContent}`;
            }
        }

        const msg = { role: "assistant", content: cleanedContent };
        if (nativeThinkingText) {
            msg.thinking = nativeThinkingText;
        }

        const res = {
            id: `chatcmpl-${Math.floor(Date.now() / 1000)}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: modelName,
            choices: [{
                index: 0,
                message: msg,
                finish_reason: "stop"
            }],
            usage: usage,
            endpoint_url: endpointUrl
        };

        if (openaiPayload.has_pdf) {
            res.has_pdf = true;
            res.req_hash = reqHash;
            if (openaiPayload.pdf_hash) res.pdf_hash = openaiPayload.pdf_hash;
        }

        return res;
    }

    async _fetchViaStreamGemini(openaiPayload, modelName, endpointUrl, reqHash, apiKey) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`;

        const contents = [];
        let paperTitle = "Unknown Paper";
        let paperAbstract = "No abstract available.";
        let promptText = "Unknown Prompt";

        for (const msg of (openaiPayload.messages || [])) {
            const parts = [];

            if (msg.role === "user") {
                let txtContent = "";
                if (typeof msg.content === 'string') {
                    txtContent = msg.content;
                } else if (Array.isArray(msg.content)) {
                    for (const part of msg.content) {
                        if (part.type === "text") txtContent += (part.text || "");
                    }
                }

                promptText = txtContent;
                if (promptText.length > 500) {
                    promptText = promptText.substring(0, 500) + "...";
                }

                const titleMatch = txtContent.match(/Title:\s*([\s\S]*?)(?=\nAbstract:|$)/i);
                const abstractMatch = txtContent.match(/Abstract:\s*([\s\S]*?)(?=\n[A-Za-z0-9_-]+:|\n\n|$)/i);

                if (titleMatch) paperTitle = titleMatch[1].replace(/\*\*/g, '').trim();
                if (abstractMatch) paperAbstract = abstractMatch[1].replace(/\*\*/g, '').trim();
            }

            if (typeof msg.content === 'string') {
                parts.push({ text: msg.content });
            } else if (Array.isArray(msg.content)) {
                for (const part of msg.content) {
                    if (part.type === "text") {
                        parts.push({ text: part.text || "" });
                    } else if (part.type === "image_url") {
                        const imgUrl = (part.image_url && part.image_url.url) ? part.image_url.url : "";
                        if (imgUrl.startsWith("data:application/pdf;base64,")) {
                            const b64Data = imgUrl.split(",")[1];
                            parts.push({
                                inline_data: {
                                    mime_type: "application/pdf",
                                    data: b64Data
                                }
                            });
                        } else if (imgUrl.startsWith("data:image/")) {
                            const mime = imgUrl.split(";")[0].split(":")[1];
                            const b64Data = imgUrl.split(",")[1];
                            parts.push({
                                inline_data: {
                                    mime_type: mime,
                                    data: b64Data
                                }
                            });
                        }
                    }
                }
            }

            const role = ["user", "system"].includes(msg.role) ? "user" : "model";
            contents.push({ role: role, parts: parts });
        }

        const geminiPayload = {
            contents: contents,
            generationConfig: {
                temperature: openaiPayload.temperature !== undefined ? openaiPayload.temperature : 0.6,
                maxOutputTokens: openaiPayload.max_tokens !== undefined ? openaiPayload.max_tokens : 8192
            }
        };

        const extraConfigStr = this.extraConfigs[endpointUrl] || "";
        if (extraConfigStr) {
            try {
                const extraConf = JSON.parse(extraConfigStr);
                if (extraConf.temperature !== undefined && extraConf.temperature !== null) {
                    geminiPayload.generationConfig.temperature = parseFloat(extraConf.temperature);
                }
                if (extraConf.maxOutputTokens !== undefined && extraConf.maxOutputTokens !== null) {
                    geminiPayload.generationConfig.maxOutputTokens = parseInt(extraConf.maxOutputTokens);
                }
                if (extraConf.thinkingLevel && extraConf.thinkingLevel !== "none") {
                    const isGemini3 = modelName.toLowerCase().includes("gemini-3");
                    const isGemini25 = modelName.toLowerCase().includes("gemini-2.5");

                    if (isGemini3) {
                        geminiPayload.generationConfig.thinkingConfig = {
                            thinkingLevel: extraConf.thinkingLevel || "low"
                        };
                    } else if (isGemini25) {
                        let budget = parseInt(extraConf.thinkingBudget || 1024);
                        if (budget < 1024) budget = 1024;
                        geminiPayload.generationConfig.thinkingConfig = {
                            thinkingBudgetTokens: budget
                        };
                    }
                }
                if (extraConf.serviceTier === "flex") {
                    geminiPayload.service_tier = "flex";
                }
            } catch (e) {
                logger.error(`Failed to parse or apply Gemini extra_config: ${e.message}`);
            }
        }

        const streamId = crypto.randomUUID();

        const startPayload = {
            type: "start",
            stream_id: streamId,
            title: paperTitle,
            abstract: paperAbstract,
            endpoint_url: endpointUrl,
            label: this.endpointLabels[endpointUrl] || endpointUrl,
            prompt: promptText
        };
        if (openaiPayload.has_pdf) {
            startPayload.has_pdf = true;
            startPayload.req_hash = reqHash;
            if (openaiPayload.pdf_hash) startPayload.pdf_hash = openaiPayload.pdf_hash;
        }

        streamBroadcaster.broadcast(JSON.stringify(startPayload));

        let fullContent = "";
        let nativeThinkingText = "";
        let usage = {};

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload),
        });

        if (!response.ok) {
            throw new Error(`Gemini API HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;

                const dataStr = line.substring(6).trim();
                if (dataStr === "[DONE]") continue;

                try {
                    const chunk = JSON.parse(dataStr);
                    const candidates = chunk.candidates || [];
                    if (candidates.length > 0) {
                        const parts = candidates[0].content ? (candidates[0].content.parts || []) : [];
                        for (const part of parts) {
                            const textPiece = part.text || "";
                            const isThought = part.thought || false;

                            if (isThought) {
                                nativeThinkingText += textPiece;
                            } else {
                                fullContent += textPiece;
                            }

                            streamBroadcaster.broadcast(JSON.stringify({
                                type: "content",
                                stream_id: streamId,
                                content: textPiece,
                                in_thinking: isThought,
                                endpoint_url: endpointUrl
                            }));
                        }
                    }

                    if (chunk.usageMetadata) {
                        const usageMetadata = chunk.usageMetadata;
                        usage = {
                            prompt_tokens: usageMetadata.promptTokenCount || 0,
                            completion_tokens: usageMetadata.candidatesTokenCount || 0,
                            total_tokens: usageMetadata.totalTokenCount || 0,
                            thoughts_tokens: usageMetadata.thoughtsTokenCount || 0
                        };
                    }
                } catch (e) {
                    continue;
                }
            }
        }

        streamBroadcaster.broadcast(JSON.stringify({
            type: "end",
            stream_id: streamId,
            endpoint_url: endpointUrl
        }));

        let cleanedContent = extractJsonFromMixedText(fullContent);
        if (fullContent.includes("<think>")) {
            const thinkMatch = fullContent.match(/(<think>[\s\S]*?<\/think>)/);
            if (thinkMatch) {
                cleanedContent = `${thinkMatch[1]}\n\n${cleanedContent}`;
            }
        } else if (fullContent.includes("### LOGIC TRACE")) {
            const logicMatch = fullContent.match(/(### LOGIC TRACE[\s\S]*?(?=### FINAL DECISION|\{))/);
            if (logicMatch) {
                cleanedContent = `<think>\n${logicMatch[1].trim()}\n</think>\n\n${cleanedContent}`;
            }
        }

        const msg = { role: "assistant", content: cleanedContent };
        if (nativeThinkingText) {
            msg.thinking = nativeThinkingText;
        }

        const res = {
            id: `chatcmpl-${Math.floor(Date.now() / 1000)}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: modelName,
            choices: [{
                index: 0,
                message: msg,
                finish_reason: "stop"
            }],
            usage: usage,
            endpoint_url: endpointUrl
        };

        if (openaiPayload.has_pdf) {
            res.has_pdf = true;
            res.req_hash = reqHash;
            if (openaiPayload.pdf_hash) res.pdf_hash = openaiPayload.pdf_hash;
        }

        return res;
    }
}

module.exports = { OllamaService, streamBroadcaster };
