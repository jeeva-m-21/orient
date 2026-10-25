from fastapi import FastAPI
from .routers.items import router as items_router

app = FastAPI(title="Fixture FastAPI App")

app.include_router(items_router)

@app.get("/health")
async def health_check():
    return {"status": "ok"}
