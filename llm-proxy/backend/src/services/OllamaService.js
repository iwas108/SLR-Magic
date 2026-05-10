const EventEmitter = require('events');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { extractJsonFromMixedText } = require('../utils/parsers');

const logger = require('../utils/logger');

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
                    label: data.label,
                    prompt: data.prompt,
                    prompt_json: data.prompt_json,
                    title: data.title,
                    abstract: data.abstract,
                    content_chunks: [],
                    current_chunk: null,
                    startTime: Date.now()
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
            } else if (msgType === "error") {
                if (this.activeStreams[streamId]) {
                    this.activeStreams[streamId].status = "error";
                    this.activeStreams[streamId].error = data.error;
                    this.activeStreams[streamId].endTime = data.endTime || Date.now();

                    // Cleanup memory after a brief delay to let frontend fetch it if needed,
                    // or immediately. Frontend relies on live WS events so we can delete it shortly.
                    setTimeout(() => {
                        if (this.activeStreams[streamId]) {
                            delete this.activeStreams[streamId];
                        }
                    }, 60000);
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
        this.endpointStatus = {};
        this.activeConnections = {};
        this.queuedRequests = 0;
        this.activeRequests = 0;
        this.totalProcessed = 0;
        this.maxConcurrentRequests = 0;

        this.customModels = {}; // endpoint_url -> custom_model string
        this.apiKeys = {};      // endpoint_url -> api_key string
        this.extraConfigs = {}; // endpoint_url -> extra_config json string
        this.streamModes = {};  // endpoint_url -> boolean
        this.endpointLabels = {}; // endpoint_url -> string label

        this.endpointModelsCache = {}; // endpoint_url -> { models: [...], timestamp: Date.now() }

        for (const url of this.urls) {
            this.endpointStatus[url] = "idle";
            this.activeConnections[url] = 0;
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
                    delete this.activeConnections[url];
                }
            }
        }

        // Add new urls
        for (const url of activeUrls) {
            if (!this.urls.includes(url)) {
                this.endpointStatus[url] = "idle";
                this.activeConnections[url] = 0;
            }
        }

        this.urls = activeUrls;
    }

    async getBestLocalEndpoint(requestedModel) {
        let bestUrl = null;
        let minConnections = Infinity;

        for (const endpointUrl of this.urls) {
            const baseModel = requestedModel || "qwen3.5-slr";
            let modelName = this.customModels[endpointUrl] || baseModel;

            let availableModels = [];
            const cacheEntry = this.endpointModelsCache[endpointUrl];
            // Cache for 5 minutes
            if (cacheEntry && (Date.now() - cacheEntry.timestamp < 300000)) {
                availableModels = cacheEntry.models;
            } else {
                try {
                    let baseUrl = endpointUrl;
                    if (baseUrl.endsWith('/v1/chat/completions')) baseUrl = baseUrl.replace('/v1/chat/completions', '');
                    else if (baseUrl.endsWith('/v1/completions')) baseUrl = baseUrl.replace('/v1/completions', '');
                    else if (baseUrl.endsWith('/api/chat')) baseUrl = baseUrl.replace('/api/chat', '');
                    else if (baseUrl.endsWith('/api/generate')) baseUrl = baseUrl.replace('/api/generate', '');
                    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

                    const tagsResponse = await fetch(`${baseUrl}/api/tags`, { timeout: 3000 });
                    if (tagsResponse.ok) {
                        const data = await tagsResponse.json();
                        if (data && data.models) {
                            availableModels = data.models.map(m => m.name);
                            this.endpointModelsCache[endpointUrl] = { models: availableModels, timestamp: Date.now() };
                        }
                    }
                } catch (err) {
                    logger.warn(`Failed to fetch models for endpoint ${endpointUrl} during fallback check: ${err.message}`);
                }
            }

            if (availableModels.length > 0 && !availableModels.includes(modelName)) {
                logger.info(`Model ${modelName} not found on ${endpointUrl}, skipping...`);
                continue;
            }

            // Found an endpoint that has the model or couldn't verify (assume it might have it)
            const activeConns = this.activeConnections[endpointUrl] || 0;
            if (activeConns < minConnections) {
                minConnections = activeConns;
                bestUrl = endpointUrl;
            }
        }

        return bestUrl;
    }

    async fetchCompletion(openaiPayload, reqHash = "", endpointUrl) {
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

        const baseModel = openaiPayload.model || "qwen3.5-slr";

        this.activeRequests += 1;
        if (this.activeConnections[endpointUrl] === undefined) {
            this.activeConnections[endpointUrl] = 0;
        }
        this.activeConnections[endpointUrl] += 1;
        this.maxConcurrentRequests = Math.max(this.maxConcurrentRequests, this.activeRequests);

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

        let modelName = this.customModels[endpointUrl] || baseModel;

        const nativePayload = {
            model: modelName,
            messages: messages,
            keep_alive: parsedKeepAlive,
            options: nativeOptions
        };

        if (thinkParam !== undefined) {
            nativePayload.think = thinkParam;
        }



        this.endpointStatus[endpointUrl] = "active";
        const shortHash = reqHash ? reqHash.substring(0, 8) : "Unknown";

        logger.info(`🚀 Dispatching request [${shortHash}] to endpoint: ${endpointUrl} (Model: ${modelName})`);

        const startTime = Date.now();
        try {
            let result;
            if (this.streamModes[endpointUrl]) {
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
            this.activeRequests -= 1;
            if (this.activeConnections[endpointUrl] > 0) {
                this.activeConnections[endpointUrl] -= 1;
            }
            if (this.endpointStatus[endpointUrl] !== undefined) {
                this.endpointStatus[endpointUrl] = "idle";
            }
            this.totalProcessed += 1;
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
            prompt: promptText,
            prompt_json: nativePayload
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

        let response;
        try {
            response = await fetch(endpointUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nativePayload),
            });
        } catch (err) {
            const errorMsg = `Fetch error: ${err.message}`;
            streamBroadcaster.broadcast(JSON.stringify({
                type: "error",
                stream_id: streamId,
                endpoint_url: endpointUrl,
                error: errorMsg,
                endTime: Date.now()
            }));
            throw err;
        }

        if (!response.ok) {
            let errorText = "";
            try {
                errorText = await response.text();
            } catch (e) {}
            const errorMsg = `HTTP error! status: ${response.status} ${errorText}`;
            streamBroadcaster.broadcast(JSON.stringify({
                type: "error",
                stream_id: streamId,
                endpoint_url: endpointUrl,
                error: errorMsg,
                endTime: Date.now()
            }));
            throw new Error(errorMsg);
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

}

module.exports = { OllamaService, streamBroadcaster };
