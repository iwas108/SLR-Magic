import json
import asyncio
import httpx
import re
import itertools
from datetime import datetime
import hashlib
import os
import base64

from middleman.config import logger

def optimistic_repair_json(text: str) -> str:
    # A robust regex to find JSON string values and escape unescaped double quotes and newlines
    pattern = re.compile(r'("\w+"\s*:\s*")(.*?)("\s*(?:,|}|]))', re.DOTALL)

    def replacer(match):
        start = match.group(1)
        content = match.group(2)
        end = match.group(3)

        # Escape double quotes by unescaping first to avoid double-escaping, then escape all
        content = content.replace('\\"', '"').replace('"', '\\"')
        # Escape newlines
        content = content.replace('\n', '\\n').replace('\r', '')
        return start + content + end

    return pattern.sub(replacer, text)

def extract_json_from_mixed_text(text: str) -> str:
    # First, strip valid think blocks
    text_no_think = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)

    # Check if it has markdown json block
    match = re.search(r"```(?:json)?\s*(.*?)\s*```", text_no_think, re.DOTALL | re.IGNORECASE)
    if match:
        extracted = match.group(1).strip()
        try:
            json.loads(extracted)
            return extracted
        except json.JSONDecodeError:
            pass

    # Global basic repair for trailing commas to help raw_decode
    text_repaired = re.sub(r",\s*([}\]])", r"\1", text_no_think)

    valid_blocks = []
    decoder = json.JSONDecoder()

    # Find all valid JSON objects/arrays by attempting to decode
    i = 0
    while i < len(text_repaired):
        if text_repaired[i] in '{[':
            try:
                obj, idx = decoder.raw_decode(text_repaired[i:])
                if isinstance(obj, (dict, list)):
                    valid_blocks.append(text_repaired[i:i+idx])
                    i += idx
                    continue
            except json.JSONDecodeError:
                pass
        i += 1

    if valid_blocks:
        # Return the LAST valid block found (safest against unclosed <think> containing JSON)
        return valid_blocks[-1]

    # If no valid blocks found, attempt optimistic repair on the whole repaired text
    repaired_text = optimistic_repair_json(text_repaired)
    valid_blocks_repaired = []

    i = 0
    while i < len(repaired_text):
        if repaired_text[i] in '{[':
            try:
                obj, idx = decoder.raw_decode(repaired_text[i:])
                if isinstance(obj, (dict, list)):
                    valid_blocks_repaired.append(repaired_text[i:i+idx])
                    i += idx
                    continue
            except json.JSONDecodeError:
                pass
        i += 1

    if valid_blocks_repaired:
        return valid_blocks_repaired[-1]

    return text

# =====================================================================
# Service Layer (The OpenAI -> Native Translator)
# =====================================================================

import base64
import os

class StreamBroadcaster:
    def __init__(self):
        self.listeners = []
        self.active_streams = {}

    def broadcast(self, message: str):
        self._update_state(message)
        for queue in self.listeners:
            try:
                # Use put_nowait to avoid blocking the terminal if web client is slow
                queue.put_nowait(message)
            except asyncio.QueueFull:
                pass # Drop messages if the client can't keep up

    def _update_state(self, message_str: str):
        try:
            data = json.loads(message_str)
            stream_id = data.get("stream_id")
            if not stream_id:
                return

            msg_type = data.get("type")
            if msg_type == "start":
                self.active_streams[stream_id] = {
                    "endpointUrl": data.get("endpoint_url"),
                    "title": data.get("title"),
                    "abstract": data.get("abstract"),
                    "content_chunks": [],
                    "current_chunk": None
                }
            elif msg_type == "content":
                if stream_id in self.active_streams:
                    stream_state = self.active_streams[stream_id]
                    in_thinking = data.get("in_thinking", False)
                    content = data.get("content", "")

                    if stream_state["current_chunk"] is None or stream_state["current_chunk"]["in_thinking"] != in_thinking:
                        stream_state["current_chunk"] = {"in_thinking": in_thinking, "content": ""}
                        stream_state["content_chunks"].append(stream_state["current_chunk"])

                    stream_state["current_chunk"]["content"] += content
            elif msg_type == "end":
                if stream_id in self.active_streams:
                    del self.active_streams[stream_id]
        except Exception:
            pass

    def add_listener(self) -> asyncio.Queue:
        q = asyncio.Queue(maxsize=1000) # Buffer up to 1000 messages
        self.listeners.append(q)
        return q

    def remove_listener(self, q: asyncio.Queue):
        if q in self.listeners:
            self.listeners.remove(q)

stream_broadcaster = StreamBroadcaster()

class OllamaService:
    def __init__(self, urls: list, stream_mode: bool):
        self.urls = urls
        self.stream_mode = stream_mode
        self.endpoint_queue = asyncio.Queue()
        self.endpoint_status = {url: "idle" for url in self.urls}
        self.pending_requests = 0
        self.custom_models = {}  # endpoint_url -> custom_model string
        self.api_keys = {} # endpoint_url -> api_key string
        self.extra_configs = {} # endpoint_url -> extra_config json string

        for url in self.urls:
            self.endpoint_queue.put_nowait(url)

    def sync_endpoints(self, configs: list):
        # configs is a list of dicts: [{"endpoint_url": "...", "enabled": True/False, "custom_model": "..."}]
        active_urls = [c["endpoint_url"] for c in configs if c.get("enabled")]
        self.custom_models = {c["endpoint_url"]: c.get("custom_model") for c in configs if c.get("enabled") and c.get("custom_model")}
        self.api_keys = {c["endpoint_url"]: c.get("api_key") for c in configs if c.get("enabled") and c.get("api_key")}
        self.extra_configs = {c["endpoint_url"]: c.get("extra_config") for c in configs if c.get("enabled") and c.get("extra_config")}

        # Remove urls that are no longer active
        for url in self.urls:
            if url not in active_urls:
                if url in self.endpoint_status:
                    del self.endpoint_status[url]

        # We need to recreate the queue with idle active urls, but preserve active ones
        # A simple way without locking is to clear the queue and re-add what's idle
        # We must be careful not to lose active processing ones.

        # Add new urls
        for url in active_urls:
            if url not in self.urls:
                self.endpoint_status[url] = "idle"

        self.urls = active_urls

        # Re-populate queue
        while not self.endpoint_queue.empty():
            try:
                self.endpoint_queue.get_nowait()
            except asyncio.QueueEmpty:
                break

        for url in self.urls:
            if self.endpoint_status.get(url) == "idle":
                self.endpoint_queue.put_nowait(url)

    async def fetch_completion(self, openai_payload: dict, req_hash: str = "") -> dict:
        messages = openai_payload.get("messages", [])

        # Extract default/basic options
        temperature = openai_payload.get("temperature", 0.6)
        max_tokens = openai_payload.get("max_tokens", 8192)

        # Allow fully customizable options from the frontend payload "options" dict
        custom_options = openai_payload.get("options", {})

        # 1. TRANSLATE TO NATIVE PAYLOAD
        # This safely applies our VRAM limits without crashing the server!

        raw_num_ctx = custom_options.get("num_ctx", 4096)
        try:
            parsed_num_ctx = int(raw_num_ctx)
        except (ValueError, TypeError):
            parsed_num_ctx = 4096

        native_options = {
            "temperature": temperature,
            "num_predict": max_tokens,
            "num_ctx": parsed_num_ctx  # Use custom options if provided
        }

        # Merge custom options provided by the caller (overriding defaults if specified)
        # Note: 'think' is a special top-level parameter in Ollama's API, not an option.
        think_param = custom_options.pop("think", None)

        raw_keep_alive = openai_payload.get("keep_alive", 0)
        try:
            parsed_keep_alive = int(raw_keep_alive)
        except (ValueError, TypeError):
            # If it's a string like "5m", keep it as string, otherwise default to 0
            parsed_keep_alive = raw_keep_alive if isinstance(raw_keep_alive, str) and raw_keep_alive.strip() != "" else 0

        native_options.update(custom_options)

        self.pending_requests += 1
        try:
            endpoint_url = await self.endpoint_queue.get()
        finally:
            self.pending_requests -= 1


        has_pdf = False
        pdf_hash = ""
        # PDF parsing logic
        for msg in messages:
            content = msg.get("content")
            if isinstance(content, list):
                for part in content:
                    if part.get("type") == "image_url":
                        url = part.get("image_url", {}).get("url", "")
                        if url.startswith("data:application/pdf;base64,"):
                            b64_data = url.split(",")[1]
                            raw_pdf_data = base64.b64decode(b64_data)
                            pdf_hash = hashlib.md5(raw_pdf_data).hexdigest()
                            pdf_path = os.path.join(os.path.dirname(__file__), "static", "pdfs", f"{pdf_hash}.pdf")
                            os.makedirs(os.path.dirname(pdf_path), exist_ok=True)
                            if not os.path.exists(pdf_path):
                                with open(pdf_path, "wb") as pdf_file:
                                    pdf_file.write(raw_pdf_data)
                            has_pdf = True

        if has_pdf:
            openai_payload["has_pdf"] = True
            openai_payload["req_hash"] = req_hash
            openai_payload["pdf_hash"] = pdf_hash

        # Use custom model if defined for this endpoint, else default
        base_model = openai_payload.get("model", "qwen3.5-slr")
        model_name = self.custom_models.get(endpoint_url) or base_model

        native_payload = {
            "model": model_name,
            "messages": messages,
            "keep_alive": parsed_keep_alive,
            "options": native_options
        }

        if think_param is not None:
            native_payload["think"] = think_param

        logger.debug(f"Translated Native Payload: {json.dumps(native_payload)}")

        self.endpoint_status[endpoint_url] = "active"
        short_hash = req_hash[:8] if req_hash else "Unknown"

        if model_name.lower().startswith("gemini") or model_name.lower().startswith("gemma"):
            logger.info(f"🚀 Dispatching request [{short_hash}] to endpoint: Gemini API (Model: {model_name})")
        else:
            logger.info(f"🚀 Dispatching request [{short_hash}] to endpoint: {endpoint_url} (Model: {model_name})")


        start_time = datetime.now()
        try:
            if model_name.lower().startswith("gemini") or model_name.lower().startswith("gemma"):
                api_key = self.api_keys.get(endpoint_url, "")
                if not api_key:
                    # fallback to any available key
                    for key in self.api_keys.values():
                        if key:
                            api_key = key
                            break
                if openai_payload.get("stream"):
                    result = await self._fetch_via_stream_gemini(openai_payload, model_name, endpoint_url, req_hash, api_key)
                else:
                    result = await self._fetch_gemini(openai_payload, model_name, endpoint_url, req_hash, api_key)
            elif self.stream_mode:
                native_payload["stream"] = True
                if openai_payload.get("has_pdf"):
                    native_payload["has_pdf"] = True
                    native_payload["req_hash"] = req_hash
                    if openai_payload.get("pdf_hash"):
                        native_payload["pdf_hash"] = openai_payload.get("pdf_hash")
                result = await self._fetch_via_stream(native_payload, model_name, messages, endpoint_url)
            else:
                native_payload["stream"] = False
                result = await self._fetch_standard(native_payload, model_name, endpoint_url)


            endpoint_duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            result["endpoint_duration_ms"] = endpoint_duration_ms
            return result
        finally:
            if endpoint_url in self.endpoint_status:
                self.endpoint_status[endpoint_url] = "idle"
            if endpoint_url in self.urls:
                self.endpoint_queue.put_nowait(endpoint_url)


    async def _fetch_gemini(self, openai_payload: dict, model_name: str, endpoint_url: str, req_hash: str, api_key: str) -> dict:
        import httpx
        import uuid

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

        contents = []
        for msg in openai_payload.get("messages", []):
            parts = []
            if isinstance(msg.get("content"), str):
                parts.append({"text": msg["content"]})
            elif isinstance(msg.get("content"), list):
                for part in msg["content"]:
                    if part.get("type") == "text":
                        parts.append({"text": part.get("text", "")})
                    elif part.get("type") == "image_url":
                        img_url = part.get("image_url", {}).get("url", "")
                        if img_url.startswith("data:application/pdf;base64,"):
                            b64_data = img_url.split(",")[1]
                            parts.append({
                                "inline_data": {
                                    "mime_type": "application/pdf",
                                    "data": b64_data
                                }
                            })
                        elif img_url.startswith("data:image/"):
                            mime = img_url.split(";")[0].split(":")[1]
                            b64_data = img_url.split(",")[1]
                            parts.append({
                                "inline_data": {
                                    "mime_type": mime,
                                    "data": b64_data
                                }
                            })

            # map system to user for now, gemini has system_instruction but standard chat api mixes it
            role = "user" if msg.get("role") in ["user", "system"] else "model"
            contents.append({"role": role, "parts": parts})

        gemini_payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": openai_payload.get("temperature", 0.6),
                "maxOutputTokens": openai_payload.get("max_tokens", 8192)
            }
        }

        extra_config_str = self.extra_configs.get(endpoint_url, "")
        if extra_config_str:
            try:
                extra_conf = json.loads(extra_config_str)
                if "temperature" in extra_conf and extra_conf["temperature"] is not None:
                    gemini_payload["generationConfig"]["temperature"] = float(extra_conf["temperature"])
                if "maxOutputTokens" in extra_conf and extra_conf["maxOutputTokens"] is not None:
                    gemini_payload["generationConfig"]["maxOutputTokens"] = int(extra_conf["maxOutputTokens"])
                if extra_conf.get("thinkingLevel") and extra_conf["thinkingLevel"] != "none":
                    # Thinking is only supported in specific gemini models
                    is_gemini_3 = "gemini-3" in model_name.lower()
                    is_gemini_2_5 = "gemini-2.5" in model_name.lower()

                    if is_gemini_3:
                         gemini_payload["generationConfig"]["thinkingConfig"] = {
                            "thinkingLevel": extra_conf.get("thinkingLevel", "low")
                         }
                    elif is_gemini_2_5:
                        budget = int(extra_conf.get("thinkingBudget", 1024))
                        if budget < 1024:
                            budget = 1024
                        gemini_payload["generationConfig"]["thinkingConfig"] = {
                            "thinkingBudgetTokens": budget
                        }
                    # If neither 2.5 nor 3, thinking config is simply not attached
            except Exception as e:
                logger.error(f"Failed to parse or apply Gemini extra_config: {e}")

        async with httpx.AsyncClient(timeout=900.0) as client:
            response = await client.post(url, json=gemini_payload)
            response.raise_for_status()
            data = response.json()

            candidates = data.get("candidates", [])
            if not candidates:
                raise Exception("No candidates returned from Gemini API")

            content_text = ""
            parts = candidates[0].get("content", {}).get("parts", [])
            if parts:
                content_text = parts[0].get("text", "")

            usage_metadata = data.get("usageMetadata", {})
            usage = {
                "prompt_tokens": usage_metadata.get("promptTokenCount", 0),
                "completion_tokens": usage_metadata.get("candidatesTokenCount", 0),
                "total_tokens": usage_metadata.get("totalTokenCount", 0)
            }

            cleaned_content = extract_json_from_mixed_text(content_text)

            res = {
                "id": f"chatcmpl-{int(datetime.now().timestamp())}",
                "object": "chat.completion",
                "created": int(datetime.now().timestamp()),
                "model": model_name,
                "choices": [{"index": 0, "message": {"role": "assistant", "content": cleaned_content}, "finish_reason": "stop"}],
                "usage": usage,
                "endpoint_url": "Gemini API"
            }
            if openai_payload.get("has_pdf"):
                res["has_pdf"] = True
                res["req_hash"] = req_hash
                if openai_payload.get("pdf_hash"):
                    res["pdf_hash"] = openai_payload.get("pdf_hash")
            return res

    async def _fetch_via_stream_gemini(self, openai_payload: dict, model_name: str, endpoint_url: str, req_hash: str, api_key: str) -> dict:
        import httpx
        import uuid
        import re

        # We will just reuse _fetch_gemini logic for now but fake the streaming via broadcaster
        # True streaming could be implemented with streamGenerateContent?alt=sse
        # but let's implement standard streaming for now.

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:streamGenerateContent?alt=sse&key={api_key}"

        contents = []
        paper_title = "Unknown Paper"
        paper_abstract = "No abstract available."

        for msg in openai_payload.get("messages", []):
            parts = []

            # Extract title abstract
            if msg.get("role") == "user":
                txt_content = ""
                if isinstance(msg.get("content"), str):
                    txt_content = msg.get("content", "")
                elif isinstance(msg.get("content"), list):
                    for part in msg.get("content"):
                        if part.get("type") == "text":
                            txt_content += part.get("text", "")

                title_match = re.search(r"(?i)Title:\s*(.*?)(?=\nAbstract:|\Z)", txt_content, re.DOTALL)
                abstract_match = re.search(r"(?i)Abstract:\s*(.*?)(?=\n[A-Za-z0-9_-]+:|\n\n|\Z)", txt_content, re.DOTALL)

                if title_match:
                    paper_title = title_match.group(1).replace('**', '').strip()
                if abstract_match:
                    paper_abstract = abstract_match.group(1).replace('**', '').strip()


            if isinstance(msg.get("content"), str):
                parts.append({"text": msg["content"]})
            elif isinstance(msg.get("content"), list):
                for part in msg["content"]:
                    if part.get("type") == "text":
                        parts.append({"text": part.get("text", "")})
                    elif part.get("type") == "image_url":
                        img_url = part.get("image_url", {}).get("url", "")
                        if img_url.startswith("data:application/pdf;base64,"):
                            b64_data = img_url.split(",")[1]
                            parts.append({
                                "inline_data": {
                                    "mime_type": "application/pdf",
                                    "data": b64_data
                                }
                            })
                        elif img_url.startswith("data:image/"):
                            mime = img_url.split(";")[0].split(":")[1]
                            b64_data = img_url.split(",")[1]
                            parts.append({
                                "inline_data": {
                                    "mime_type": mime,
                                    "data": b64_data
                                }
                            })

            role = "user" if msg.get("role") in ["user", "system"] else "model"
            contents.append({"role": role, "parts": parts})

        gemini_payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": openai_payload.get("temperature", 0.6),
                "maxOutputTokens": openai_payload.get("max_tokens", 8192)
            }
        }

        extra_config_str = self.extra_configs.get(endpoint_url, "")
        if extra_config_str:
            try:
                extra_conf = json.loads(extra_config_str)
                if "temperature" in extra_conf and extra_conf["temperature"] is not None:
                    gemini_payload["generationConfig"]["temperature"] = float(extra_conf["temperature"])
                if "maxOutputTokens" in extra_conf and extra_conf["maxOutputTokens"] is not None:
                    gemini_payload["generationConfig"]["maxOutputTokens"] = int(extra_conf["maxOutputTokens"])
                if extra_conf.get("thinkingLevel") and extra_conf["thinkingLevel"] != "none":
                    # Thinking is only supported in specific gemini models
                    is_gemini_3 = "gemini-3" in model_name.lower()
                    is_gemini_2_5 = "gemini-2.5" in model_name.lower()

                    if is_gemini_3:
                         gemini_payload["generationConfig"]["thinkingConfig"] = {
                            "thinkingLevel": extra_conf.get("thinkingLevel", "low")
                         }
                    elif is_gemini_2_5:
                        budget = int(extra_conf.get("thinkingBudget", 1024))
                        if budget < 1024:
                            budget = 1024
                        gemini_payload["generationConfig"]["thinkingConfig"] = {
                            "thinkingBudgetTokens": budget
                        }
                    # If neither 2.5 nor 3, thinking config is simply not attached
            except Exception as e:
                logger.error(f"Failed to parse or apply Gemini extra_config: {e}")

        stream_id = str(uuid.uuid4())

        start_payload = {
            "type": "start",
            "stream_id": stream_id,
            "title": paper_title,
            "abstract": paper_abstract,
            "endpoint_url": "Gemini API"
        }
        if openai_payload.get("has_pdf"):
            start_payload["has_pdf"] = True
            start_payload["req_hash"] = req_hash
            if openai_payload.get("pdf_hash"):
                start_payload["pdf_hash"] = openai_payload.get("pdf_hash")

        stream_broadcaster.broadcast(json.dumps(start_payload))

        full_content = ""
        usage = {}

        async with httpx.AsyncClient(timeout=900.0) as client:
            async with client.stream("POST", url, json=gemini_payload) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue

                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        continue

                    try:
                        chunk = json.loads(data_str)
                        candidates = chunk.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts:
                                text_piece = parts[0].get("text", "")
                                full_content += text_piece

                                is_thought = parts[0].get("thought", False)
                                stream_broadcaster.broadcast(json.dumps({
                                    "type": "content",
                                    "stream_id": stream_id,
                                    "content": text_piece,
                                    "in_thinking": is_thought,
                                    "endpoint_url": "Gemini API"
                                }))

                        if "usageMetadata" in chunk:
                            usage_metadata = chunk["usageMetadata"]
                            usage = {
                                "prompt_tokens": usage_metadata.get("promptTokenCount", 0),
                                "completion_tokens": usage_metadata.get("candidatesTokenCount", 0),
                                "total_tokens": usage_metadata.get("totalTokenCount", 0)
                            }
                    except json.JSONDecodeError:
                        continue

        stream_broadcaster.broadcast(json.dumps({
            "type": "end",
            "stream_id": stream_id,
            "endpoint_url": "Gemini API"
        }))

        final_content = extract_json_from_mixed_text(full_content)

        res = {
            "id": f"chatcmpl-{int(datetime.now().timestamp())}",
            "object": "chat.completion",
            "created": int(datetime.now().timestamp()),
            "model": model_name,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": final_content}, "finish_reason": "stop"}],
            "usage": usage,
            "endpoint_url": "Gemini API"
        }
        if openai_payload.get("has_pdf"):
            res["has_pdf"] = True
            res["req_hash"] = req_hash
            if openai_payload.get("pdf_hash"):
                res["pdf_hash"] = openai_payload.get("pdf_hash")
        return res

    async def _fetch_standard(self, native_payload: dict, model_name: str, endpoint_url: str) -> dict:
        async with httpx.AsyncClient(timeout=900.0) as client:
            response = await client.post(endpoint_url, json=native_payload)
            response.raise_for_status()
            chunk = response.json()

            usage = {
                "prompt_tokens": chunk.get("prompt_eval_count", 0),
                "completion_tokens": chunk.get("eval_count", 0),
                "total_tokens": chunk.get("prompt_eval_count", 0) + chunk.get("eval_count", 0)
            }

            msg = chunk.get("message", {})
            raw_content = msg.get("content", "")
            thinking = msg.get("thinking", "")

            cleaned_content = extract_json_from_mixed_text(raw_content)

            final_content = cleaned_content

            if thinking:
                final_content = f"<think>\n{thinking}\n</think>\n\n{cleaned_content}"
            elif "<think>" in raw_content:
                think_match = re.search(r"(<think>.*?</think>)", raw_content, re.DOTALL)
                if think_match:
                    final_content = f"{think_match.group(1)}\n\n{cleaned_content}"

            return {
                "id": f"chatcmpl-{int(datetime.now().timestamp())}",
                "object": "chat.completion",
                "created": int(datetime.now().timestamp()),
                "model": model_name,
                "choices": [{"index": 0, "message": {"role": "assistant", "content": final_content}, "finish_reason": "stop"}],
                "usage": usage,
                "endpoint_url": endpoint_url
            }

    async def _fetch_via_stream(self, native_payload: dict, model_name: str, messages: list, endpoint_url: str) -> dict:
        import re
        import uuid

        stream_id = str(uuid.uuid4())
        paper_title = "Unknown Paper"
        paper_abstract = "No abstract available."
        for msg in reversed(messages):
            if msg.get("role") == "user":
                content = msg.get("content", "")
                if isinstance(content, str):
                    # Extract Title and Abstract dynamically handling multiline markdown
                    title_match = re.search(r"(?i)Title:\s*(.*?)(?=\nAbstract:|\Z)", content, re.DOTALL)
                    abstract_match = re.search(r"(?i)Abstract:\s*(.*?)(?=\n[A-Za-z0-9_-]+:|\n\n|\Z)", content, re.DOTALL)

                    if title_match:
                        paper_title = title_match.group(1).replace('**', '').strip()
                    if abstract_match:
                        paper_abstract = abstract_match.group(1).replace('**', '').strip()

                    if title_match or abstract_match:
                        break
        start_payload = {
            "type": "start",
            "stream_id": stream_id,
            "title": paper_title,
            "abstract": paper_abstract,
            "endpoint_url": endpoint_url
        }
        if native_payload.get("has_pdf"):
            start_payload["has_pdf"] = True
            start_payload["req_hash"] = native_payload.get("req_hash", "")
            if native_payload.get("pdf_hash"):
                start_payload["pdf_hash"] = native_payload.get("pdf_hash")

        stream_broadcaster.broadcast(json.dumps(start_payload))

        # Prefill detection
        is_prefilled = False
        if messages and messages[-1].get("role") == "assistant" and "<think>" in messages[-1].get("content", ""):
            is_prefilled = True

        full_content = "<think>\n" if is_prefilled else ""
        usage = {}

        in_thinking = is_prefilled
        native_thinking_mode = False

        async with httpx.AsyncClient(timeout=900.0) as client:
            async with client.stream("POST", endpoint_url, json=native_payload) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if not line.strip():
                        continue

                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    msg = chunk.get("message", {})
                    # Ollama's newer API explicitly separates the thinking field
                    thinking_piece = msg.get("thinking", "")
                    content_piece = msg.get("content", "")

                    if thinking_piece:
                        if not in_thinking:
                            full_content += "<think>\n"
                            in_thinking = True
                            native_thinking_mode = True

                        full_content += thinking_piece

                        stream_broadcaster.broadcast(json.dumps({
                            "type": "content",
                            "stream_id": stream_id,
                            "content": thinking_piece,
                            "in_thinking": True,
                            "endpoint_url": endpoint_url
                        }))

                    if content_piece:
                        if native_thinking_mode:
                            full_content += "\n</think>\n\n"
                            in_thinking = False
                            native_thinking_mode = False

                        if not in_thinking and "<think>" in content_piece:
                            in_thinking = True

                        full_content += content_piece

                        stream_broadcaster.broadcast(json.dumps({
                            "type": "content",
                            "stream_id": stream_id,
                            "content": content_piece,
                            "in_thinking": in_thinking,
                            "endpoint_url": endpoint_url
                        }))

                        if in_thinking and "</think>" in content_piece:
                            in_thinking = False

                    # Native API sends telemetry when done=True
                    if chunk.get("done") is True:
                        usage = {
                            "prompt_tokens": chunk.get("prompt_eval_count", 0),
                            "completion_tokens": chunk.get("eval_count", 0),
                            "total_tokens": chunk.get("prompt_eval_count", 0) + chunk.get("eval_count", 0)
                        }

        stream_broadcaster.broadcast(json.dumps({
            "type": "end",
            "stream_id": stream_id,
            "endpoint_url": endpoint_url
        }))

        # 2. TRANSLATE BACK TO OPENAI FORMAT
        # Attempt to cleanly extract JSON from the final assembled content
        final_content = full_content
        if is_prefilled or "<think>" in full_content:
            # If thinking is present, we still want to return it but we ensure the non-thinking part is clean JSON
            think_part = ""
            think_match = re.search(r"(<think>.*?</think>)", full_content, re.DOTALL)
            if think_match:
                think_part = think_match.group(1) + "\n\n"
            cleaned_json = extract_json_from_mixed_text(full_content)
            final_content = think_part + cleaned_json
        else:
            final_content = extract_json_from_mixed_text(full_content)

        return {
            "id": f"chatcmpl-{int(datetime.now().timestamp())}",
            "object": "chat.completion",
            "created": int(datetime.now().timestamp()),
            "model": model_name,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": final_content}, "finish_reason": "stop"}],
            "usage": usage,
            "endpoint_url": endpoint_url
        }
