import json
import asyncio
import httpx
from datetime import datetime

from middleman.config import logger

# =====================================================================
# Service Layer (The OpenAI -> Native Translator)
# =====================================================================

class StreamBroadcaster:
    def __init__(self):
        self.listeners = []

    def broadcast(self, message: str):
        for queue in self.listeners:
            try:
                # Use put_nowait to avoid blocking the terminal if web client is slow
                queue.put_nowait(message)
            except asyncio.QueueFull:
                pass # Drop messages if the client can't keep up

    def add_listener(self) -> asyncio.Queue:
        q = asyncio.Queue(maxsize=1000) # Buffer up to 1000 messages
        self.listeners.append(q)
        return q

    def remove_listener(self, q: asyncio.Queue):
        if q in self.listeners:
            self.listeners.remove(q)

stream_broadcaster = StreamBroadcaster()

class OllamaService:
    def __init__(self, url: str, stream_mode: bool):
        self.url = url
        self.stream_mode = stream_mode

    async def fetch_completion(self, openai_payload: dict) -> dict:
        model_name = openai_payload.get("model", "qwen3.5-slr")
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

        native_payload = {
            "model": model_name,
            "messages": messages,
            "keep_alive": parsed_keep_alive,
            "options": native_options
        }

        if think_param is not None:
            native_payload["think"] = think_param

        logger.debug(f"Translated Native Payload: {json.dumps(native_payload)}")

        if self.stream_mode:
            native_payload["stream"] = True
            return await self._fetch_via_stream(native_payload, model_name, messages)

        native_payload["stream"] = False
        return await self._fetch_standard(native_payload, model_name)

    async def _fetch_standard(self, native_payload: dict, model_name: str) -> dict:
        async with httpx.AsyncClient(timeout=900.0) as client:
            response = await client.post(self.url, json=native_payload)
            response.raise_for_status()
            chunk = response.json()

            usage = {
                "prompt_tokens": chunk.get("prompt_eval_count", 0),
                "completion_tokens": chunk.get("eval_count", 0),
                "total_tokens": chunk.get("prompt_eval_count", 0) + chunk.get("eval_count", 0)
            }

            return {
                "id": f"chatcmpl-{int(datetime.now().timestamp())}",
                "object": "chat.completion",
                "created": int(datetime.now().timestamp()),
                "model": model_name,
                "choices": [{"index": 0, "message": {"role": "assistant", "content": chunk.get("message", {}).get("content", "")}, "finish_reason": "stop"}],
                "usage": usage
            }

    async def _fetch_via_stream(self, native_payload: dict, model_name: str, messages: list) -> dict:
        logger.info("📡 Receiving native stream from Ollama...")

        import re
        paper_title = "Unknown Paper"
        paper_abstract = "No abstract available."
        for msg in reversed(messages):
            if msg.get("role") == "user":
                content = msg.get("content", "")
                if isinstance(content, str):
                    match = re.search(r"Title:\s*(.*?)\nAbstract:\s*(.*)", content, re.DOTALL | re.IGNORECASE)
                    if match:
                        paper_title = match.group(1).strip()
                        paper_abstract = match.group(2).strip()
                        break
        stream_broadcaster.broadcast(json.dumps({
            "type": "start",
            "title": paper_title,
            "abstract": paper_abstract
        }))

        # Prefill detection
        is_prefilled = False
        if messages and messages[-1].get("role") == "assistant" and "<think>" in messages[-1].get("content", ""):
            is_prefilled = True

        full_content = "<think>\n" if is_prefilled else ""
        usage = {}

        in_thinking = is_prefilled
        has_printed_thinking_header = is_prefilled

        if is_prefilled:
            print("\n\033[90m[🤔 Thinking... (Prefilled)]\033[0m\n\033[90m", end="", flush=True)

        async with httpx.AsyncClient(timeout=900.0) as client:
            async with client.stream("POST", self.url, json=native_payload) as response:
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

                        full_content += thinking_piece

                        if not in_thinking and not has_printed_thinking_header:
                            print("\n\033[90m[🤔 Thinking...]\033[0m\n\033[90m", end="")
                            has_printed_thinking_header = True

                        in_thinking = True
                        print(thinking_piece, end="", flush=True)

                        stream_broadcaster.broadcast(json.dumps({
                            "content": thinking_piece,
                            "in_thinking": True
                        }))

                    if content_piece:
                        if in_thinking:
                            full_content += "\n</think>\n\n"
                            print("\033[0m\n\n\033[92m[💡 Final Output]\033[0m\n", end="")
                            in_thinking = False

                        full_content += content_piece
                        print(content_piece, end="", flush=True)

                        stream_broadcaster.broadcast(json.dumps({
                            "content": content_piece,
                            "in_thinking": False
                        }))

                    # Native API sends telemetry when done=True
                    if chunk.get("done") is True:
                        usage = {
                            "prompt_tokens": chunk.get("prompt_eval_count", 0),
                            "completion_tokens": chunk.get("eval_count", 0),
                            "total_tokens": chunk.get("prompt_eval_count", 0) + chunk.get("eval_count", 0)
                        }

        if in_thinking:
            print("\033[0m", end="")

        print("\n")
        logger.info("✅ Stream complete.")

        stream_broadcaster.broadcast(json.dumps({
            "type": "end"
        }))

        # 2. TRANSLATE BACK TO OPENAI FORMAT
        return {
            "id": f"chatcmpl-{int(datetime.now().timestamp())}",
            "object": "chat.completion",
            "created": int(datetime.now().timestamp()),
            "model": model_name,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": full_content}, "finish_reason": "stop"}],
            "usage": usage
        }
