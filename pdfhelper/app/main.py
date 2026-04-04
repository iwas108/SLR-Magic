import logging
from fastapi import FastAPI, APIRouter, Request, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, FileResponse
import asyncio
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

from app.services.downloader import run_downloader, DownloaderConfig
from app.services.verifier import run_verifier, VerifierConfig
from app.services.compressor import run_compressor
from app.services.syncer import run_syncer
import os

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="PDF Helper App")

# Templates setup
templates = Jinja2Templates(directory="app/templates")

# API Router
api_router = APIRouter()

# Simple global state for demonstration. In production, use a database or Redis.
task_state = {
    "downloader": {"status": "idle", "message": ""},
    "verifier": {"status": "idle", "message": ""},
    "compressor": {"status": "idle", "message": ""},
    "syncer": {"status": "idle", "message": ""}
}

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        await websocket.send_json({"type": "state", "data": task_state})

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error sending message to websocket: {e}")

manager = ConnectionManager()

def execute_task(task_name, func, loop=None):
    task_state[task_name]["status"] = "running"
    task_state[task_name]["message"] = "Processing..."
    if loop:
        asyncio.run_coroutine_threadsafe(manager.broadcast({"type": "state", "data": task_state}), loop)

    try:
        if task_name == "downloader" and loop:
            def progress_callback(current, total, title):
                asyncio.run_coroutine_threadsafe(
                    manager.broadcast({
                        "type": "progress",
                        "task": task_name,
                        "data": {
                            "current": current,
                            "total": total,
                            "title": title
                        }
                    }), loop
                )
            result = func(progress_callback=progress_callback)
        else:
            result = func()

        task_state[task_name]["status"] = result.get("status", "success")
        task_state[task_name]["message"] = result.get("message", "Completed")
    except Exception as e:
        logger.error(f"Error in {task_name}: {e}")
        task_state[task_name]["status"] = "error"
        task_state[task_name]["message"] = str(e)

    if loop:
        asyncio.run_coroutine_threadsafe(manager.broadcast({"type": "state", "data": task_state}), loop)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@api_router.post("/download")
async def start_download(background_tasks: BackgroundTasks):
    if task_state["downloader"]["status"] == "running":
        return {"message": "Download is already running"}
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
    background_tasks.add_task(execute_task, "downloader", run_downloader, loop)
    return {"message": "Download task started"}

@api_router.post("/verify")
async def start_verify(background_tasks: BackgroundTasks):
    if task_state["verifier"]["status"] == "running":
        return {"message": "Verify is already running"}
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
    background_tasks.add_task(execute_task, "verifier", run_verifier, loop)
    return {"message": "Verify task started"}

@api_router.post("/compress")
async def start_compress(background_tasks: BackgroundTasks):
    if task_state["compressor"]["status"] == "running":
        return {"message": "Compress is already running"}
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
    background_tasks.add_task(execute_task, "compressor", run_compressor, loop)
    return {"message": "Compress task started"}

@api_router.post("/sync")
async def start_sync(background_tasks: BackgroundTasks):
    if task_state["syncer"]["status"] == "running":
        return {"message": "Sync is already running"}
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
    background_tasks.add_task(execute_task, "syncer", run_syncer, loop)
    return {"message": "Sync task started"}

@api_router.get("/status")
async def get_status():
    return task_state

@api_router.get("/download-csv")
async def download_csv():
    file_path = VerifierConfig.OUTPUT_CSV
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type='text/csv', filename="verified_results.csv")
    return {"error": "File not found."}

app.include_router(api_router, prefix="/api")

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse(request, "index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
