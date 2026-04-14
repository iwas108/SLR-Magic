import asyncio
from playwright.async_api import async_playwright
import subprocess
import time

async def main():
    proxy_proc = subprocess.Popen(["python", "middleman.py"], cwd="llm-proxy", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(3) # Wait for startup

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        await page.goto("http://localhost:8899")
        await page.wait_for_timeout(2000)

        await page.click("#history-tab")
        await page.wait_for_timeout(1000)

        await page.evaluate("""
            historyData = [
                {
                    "id": 1,
                    "model_name": "test-model",
                    "endpoint_url": "http://localhost:11434",
                    "created_at": "2024-01-01T00:00:00Z",
                    "duration_ms": 1000,
                    "request_json": '{"messages": [{"role": "user", "content": "Title: This is a test\\nAbstract: Test abstract\\nHello"}]}',
                    "response_json": '{"message": {"content": "Hi there"}}'
                }
            ];
            renderHistory(1, 1, 50);
        """)
        await page.wait_for_timeout(1000)

        await page.evaluate("showDetails(0)")
        await page.wait_for_timeout(1000)

        # Open the <details> tag if it exists
        await page.evaluate("""
            const details = document.querySelector('details');
            if (details) details.open = true;
        """)
        await page.wait_for_timeout(500)

        await page.screenshot(path="screenshot_history_prompt.png")

        await browser.close()

    proxy_proc.terminate()

if __name__ == "__main__":
    asyncio.run(main())
