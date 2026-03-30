import asyncio
import httpx
import json

async def run_test():
    payload = {
        "model": "qwen3.5-slr",
        "messages": [{"role": "user", "content": "Hello, world!"}],
        "temperature": 0.7,
        "max_tokens": 100,
        "options": {
            "think": True,
            "top_k": 40
        }
    }

    # Send a request to our proxy (which will fail to hit a real Ollama backend on port 11434,
    # but the logic for parsing the payload and starting the cache process should run).
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post("http://localhost:8000/v1/chat/completions", json=payload, timeout=2.0)
            print("Status:", resp.status_code)
            print("Response:", resp.text)
        except Exception as e:
            print("Request failed as expected (no ollama):", e)

asyncio.run(run_test())
