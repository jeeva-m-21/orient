from fastapi import APIRouter
from ..models import ItemModel

router = APIRouter(prefix="/items", tags=["items"])

@router.get("/")
async def list_items():
    return [{"id": 1, "name": "Item 1", "price": 9.99}]

@router.post("/")
async def create_item(item: ItemModel):
    return {"created": item.name}
