const { GoogleGenAI } = require('@google/genai');
const { extractJsonFromMixedText } = require('../utils/parsers');
const logger = require('../utils/logger');
const crypto = require('crypto');

class CloudService {
    constructor(cacheRepo, streamBroadcaster) {
        this.cacheRepo = cacheRepo;
        this.streamBroadcaster = streamBroadcaster;
    }

    _convertOpenAIToGeminiPayload(messages) {
        const contents = [];
        let systemInstruction = "";

        for (const msg of messages) {
            if (msg.role === 'system') {
                systemInstruction += msg.content + "\n";
            } else if (msg.role === 'user') {
                contents.push({ role: 'user', parts: [{ text: msg.content }] });
            } else if (msg.role === 'assistant') {
                contents.push({ role: 'model', parts: [{ text: msg.content }] });
            }
        }

        return { contents, systemInstruction: systemInstruction.trim() };
    }

    async generateSchemaFromTemplate(template) {
        try {
            const parsed = JSON.parse(template);

            const inferSchema = (obj) => {
                if (obj === null) return { type: 'string', nullable: true };
                if (Array.isArray(obj)) {
                    return {
                        type: 'array',
                        items: obj.length > 0 ? inferSchema(obj[0]) : { type: 'string' }
                    };
                }
                if (typeof obj === 'object') {
                    const properties = {};
                    const required = [];
                    for (const key of Object.keys(obj)) {
                        properties[key] = inferSchema(obj[key]);
                        required.push(key);
                    }
                    return { type: 'object', properties, required };
                }
                if (typeof obj === 'number') return { type: 'number' };
                if (typeof obj === 'boolean') return { type: 'boolean' };
                return { type: 'string' }; // default to string for strings and anything else
            };

            return inferSchema(parsed);
        } catch (e) {
            throw new Error(`Failed to parse JSON template for structured output: ${e.message}`);
        }
    }

    async fetchCompletion(cloudEndpoint, payload, reqHash) {
        const ai = new GoogleGenAI({ apiKey: cloudEndpoint.api_key });
        const { contents, systemInstruction } = this._convertOpenAIToGeminiPayload(payload.messages);

        const config = {};

        if (systemInstruction) {
            config.systemInstruction = systemInstruction;
        }

        if (cloudEndpoint.flex_inference) {
            config.serviceTier = 'flex';
        }

        if (cloudEndpoint.thinking_mode) {
            config.thinkingConfig = { includeThoughts: true };
        }

        if (cloudEndpoint.structured_output) {
            config.responseMimeType = "application/json";
            // extract JSON template from prompt
            const fullPrompt = payload.messages.map(m => m.content).join("\n");
            const templateStr = extractJsonFromMixedText(fullPrompt);
            if (!templateStr) {
                throw new Error("Structured Output enabled but no valid JSON template found in the prompt.");
            }
            config.responseSchema = await this.generateSchemaFromTemplate(templateStr);
        }

        if (payload.temperature !== undefined) {
            config.temperature = payload.temperature;
        }

        const isStream = !!payload.stream && cloudEndpoint.streaming;

        const requestData = {
            model: payload.model,
            contents,
            config
        };

        const startTime = Date.now();

        if (isStream) {
            return this._handleStreaming(ai, requestData, cloudEndpoint, reqHash, startTime);
        } else {
            return this._handleStandard(ai, requestData, cloudEndpoint, startTime);
        }
    }

    async _handleStandard(ai, requestData, cloudEndpoint, startTime) {
        try {
            const response = await ai.models.generateContent(requestData);

            let text = "";
            let thoughts = "";

            if (response.candidates && response.candidates.length > 0) {
                const parts = response.candidates[0].content.parts;
                for (const part of parts) {
                    if (part.thought) {
                        thoughts += part.text;
                    } else if (part.text) {
                        text += part.text;
                    }
                }
            } else if (response.text) {
                 text = response.text;
            }

            if (thoughts) {
                text = `<think>\n${thoughts}\n</think>\n\n${text}`;
            }

            const endpointDurationMs = Date.now() - startTime;

            return {
                id: crypto.randomUUID(),
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: requestData.model,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: text
                    },
                    finish_reason: 'stop'
                }],
                usage: {
                    prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
                    completion_tokens: response.usageMetadata?.candidatesTokenCount || 0,
                    total_tokens: response.usageMetadata?.totalTokenCount || 0
                },
                endpoint_duration_ms: endpointDurationMs,
                endpoint_url: `google-gemini-${cloudEndpoint.id}`
            };
        } catch (e) {
            logger.error(`Gemini Standard Request Failed: ${e.message}`);
            throw e;
        }
    }

    async _handleStreaming(ai, requestData, cloudEndpoint, reqHash, startTime) {
        try {
            const streamId = reqHash || crypto.randomUUID();

            // Broadcast start
            this.streamBroadcaster.broadcast(JSON.stringify({
                type: "start",
                stream_id: streamId,
                endpoint_url: `google-gemini-${cloudEndpoint.id}`,
                model: requestData.model,
                prompt_json: requestData
            }));

            const responseStream = await ai.models.generateContentStream(requestData);

            let fullText = "";
            let fullThoughts = "";
            let promptTokens = 0;
            let completionTokens = 0;
            let totalTokens = 0;

            for await (const chunk of responseStream) {
                if (chunk.usageMetadata) {
                    promptTokens = chunk.usageMetadata.promptTokenCount || promptTokens;
                    completionTokens = chunk.usageMetadata.candidatesTokenCount || completionTokens;
                    totalTokens = chunk.usageMetadata.totalTokenCount || totalTokens;
                }

                if (chunk.candidates && chunk.candidates.length > 0) {
                    for (const part of chunk.candidates[0].content.parts) {
                        if (part.thought) {
                            fullThoughts += part.text;
                            this.streamBroadcaster.broadcast(JSON.stringify({
                                type: "chunk",
                                stream_id: streamId,
                                text: part.text,
                                in_thinking: true
                            }));
                        } else if (part.text) {
                            fullText += part.text;
                            this.streamBroadcaster.broadcast(JSON.stringify({
                                type: "chunk",
                                stream_id: streamId,
                                text: part.text,
                                in_thinking: false
                            }));
                        }
                    }
                } else if (chunk.text) {
                     fullText += chunk.text;
                     this.streamBroadcaster.broadcast(JSON.stringify({
                         type: "chunk",
                         stream_id: streamId,
                         text: chunk.text,
                         in_thinking: false
                     }));
                }
            }

            const endpointDurationMs = Date.now() - startTime;

            this.streamBroadcaster.broadcast(JSON.stringify({
                type: "end",
                stream_id: streamId,
                duration_ms: endpointDurationMs
            }));

            let combinedText = fullText;
            if (fullThoughts) {
                combinedText = `<think>\n${fullThoughts}\n</think>\n\n${fullText}`;
            }

            return {
                id: streamId,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: requestData.model,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: combinedText
                    },
                    finish_reason: 'stop'
                }],
                usage: {
                    prompt_tokens: promptTokens,
                    completion_tokens: completionTokens,
                    total_tokens: totalTokens
                },
                endpoint_duration_ms: endpointDurationMs,
                endpoint_url: `google-gemini-${cloudEndpoint.id}`
            };

        } catch (e) {
            logger.error(`Gemini Streaming Request Failed: ${e.message}`);
            throw e;
        }
    }
}

module.exports = CloudService;
