import asyncio
from middleman.service import OllamaService

async def main():
    service = OllamaService(["url1", "url2"], False)
    # Fetch first url
    url1 = await service.endpoint_queue.get()
    print("Got", url1)
    # Fetch second url
    url2 = await service.endpoint_queue.get()
    print("Got", url2)
    # Try fetching third url, should block, so we will use wait_for and it should timeout
    try:
        await asyncio.wait_for(service.endpoint_queue.get(), timeout=0.1)
        print("Error: Got third url")
    except asyncio.TimeoutError:
        print("Blocked correctly")

    # Put one back
    service.endpoint_queue.put_nowait(url1)

    # Try fetching again
    url3 = await service.endpoint_queue.get()
    print("Got", url3)

if __name__ == "__main__":
    asyncio.run(main())
