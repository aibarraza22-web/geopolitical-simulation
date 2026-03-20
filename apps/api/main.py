import structlog
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from apps.api.config import settings
from apps.api.routers import alerts, entities, intelligence, risk, scenarios

log = structlog.get_logger()

app = FastAPI(
    title="Geopolitical Risk Intelligence API",
    version="0.1.0",
    description="Real-time geopolitical risk scores, scenario simulation, and intelligence aggregation.",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(risk.router)
app.include_router(intelligence.router)
app.include_router(scenarios.router)
app.include_router(alerts.router)
app.include_router(entities.router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


# ── WebSocket: real-time score updates ───────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)

    async def broadcast(self, message: dict):
        for ws in list(self.active):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(ws)


manager = ConnectionManager()


@app.websocket("/v1/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            data = await ws.receive_json()
            # Client can send: {"type": "subscribe", "entity_ids": [...], "themes": [...]}
            if data.get("type") == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(ws)


@app.on_event("startup")
async def startup():
    log.info("api.startup", env=settings.app_env)


@app.on_event("shutdown")
async def shutdown():
    log.info("api.shutdown")
