# website_builder/render_api.py
import os, httpx

RENDER_API_KEY = os.getenv("RENDER_API_KEY")
RENDER_SERVICE_ID = os.getenv("RENDER_SERVICE_ID")
RENDER_BASE = "https://api.render.com/v1"

headers = {"Authorization": f"Bearer {RENDER_API_KEY}", "Content-Type": "application/json"}

async def render_add_custom_domain(domain: str) -> dict:   # <-- str
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            f"{RENDER_BASE}/services/{RENDER_SERVICE_ID}/custom-domains",
            headers=headers,
            json={"name": domain},
        )
        r.raise_for_status()
        return r.json()

async def render_get_custom_domain(cd_id: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{RENDER_BASE}/custom-domains/{cd_id}", headers=headers)
        r.raise_for_status()
        return r.json()

async def render_delete_custom_domain(cd_id: str) -> None:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.delete(f"{RENDER_BASE}/custom-domains/{cd_id}", headers=headers)
        r.raise_for_status()
