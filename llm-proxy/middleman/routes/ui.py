from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

ui_router = APIRouter()

import os
templates_dir = os.path.join(os.path.dirname(__file__), "..", "templates")
templates = Jinja2Templates(directory=templates_dir)

@ui_router.get("/", response_class=HTMLResponse)
async def review_ui(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")
