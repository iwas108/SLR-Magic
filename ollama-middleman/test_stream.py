import asyncio
import json
import httpx

async def test_ollama_stream():
    url = "http://localhost:11434/api/chat"
    payload = {
        "model": "qwen3.5-slr",
        "messages": [{"role": "user", "content": "Title: A study on X\nAbstract: This is a test."}],
        "stream": True,
        "options": {"think": True}
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            async with client.stream("POST", url, json=payload) as response:
                async for line in response.aiter_lines():
                    if line:
                        print(line)
    except Exception as e:
        print("Failed to connect to Ollama:", e)

asyncio.run(test_ollama_stream())
