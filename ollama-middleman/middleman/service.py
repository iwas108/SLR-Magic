import json
import asyncio
import httpx
import re
import itertools
from datetime import datetime

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

        for url in self.urls:
            self.endpoint_queue.put_nowait(url)

    def sync_endpoints(self, configs: list):
        # configs is a list of dicts: [{"endpoint_url": "...", "enabled": True/False, "custom_model": "..."}]
        active_urls = [c["endpoint_url"] for c in configs if c.get("enabled")]
        self.custom_models = {c["endpoint_url"]: c.get("custom_model") for c in configs if c.get("enabled") and c.get("custom_model")}

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
        logger.info(f"🚀 Dispatching request [{short_hash}] to endpoint: {endpoint_url} (Model: {model_name})")

        start_time = datetime.now()
        try:
            if self.stream_mode:
                native_payload["stream"] = True
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
        stream_broadcaster.broadcast(json.dumps({
            "type": "start",
            "stream_id": stream_id,
            "title": paper_title,
            "abstract": paper_abstract,
            "endpoint_url": endpoint_url
        }))

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
