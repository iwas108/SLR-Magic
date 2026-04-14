import asyncio
from playwright.async_api import async_playwright
import http.server
import socketserver
import threading
import os
import time
import subprocess

PORT = 8081

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass # silent

def run_server():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()

async def main():
    # Start static server
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    # Start llm-proxy backend
    proxy_proc = subprocess.Popen(["python", "middleman.py"], cwd="llm-proxy", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(3) # Wait for startup

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # 1. Verify App Script Configuration UI
        await page.goto(f"http://localhost:{PORT}/ConfigurationUI.html")

        # Inject mock
        await page.evaluate("""
            window.google = {
                script: {
                    run: {
                        withSuccessHandler: function(callback) {
                            return {
                                withFailureHandler: function() {
                                    return {
                                        getConfiguration: function() {
                                            callback({
                                                "LLM_API_PROVIDER": "Gemini",
                                                "API_KEY": "test",
                                                "GEMINI_SERVICE_TIER": "standard"
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            };
            loadConfig();
            document.getElementById("loading").style.display = "none";
            document.getElementById("main-content").style.display = "block";
            openTab('general');
        """)

        await page.wait_for_timeout(1000)
        await page.screenshot(path="screenshot_app_script.png", full_page=True)

        # 2. Verify llm-proxy UI
        await page.goto("http://localhost:8899")
        await page.wait_for_timeout(2000)

        # Click the Gemini settings button (using standard page evaluate to show modal for reliability)
        await page.evaluate("""
            var modalEl = document.getElementById('geminiConfigModal');
            var modal = new bootstrap.Modal(modalEl);
            modal.show();
        """)
        await page.wait_for_timeout(1000)
        await page.screenshot(path="screenshot_llm_proxy.png", full_page=True)

        await browser.close()

    proxy_proc.terminate()

if __name__ == "__main__":
    asyncio.run(main())
