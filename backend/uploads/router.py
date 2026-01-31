
from fastapi import APIRouter, File, UploadFile, HTTPException, status, Form,Depends
from fastapi.responses import JSONResponse
import os, mimetypes, uuid, traceback, re, datetime
from pydantic import BaseModel
from supabase import create_client, Client
from models import User, RestaurantOwner # ✅ 1. Import User and RestaurantOwner
from auth.auth_handler import get_current_active_user
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from sqlalchemy import select

router = APIRouter(prefix="/uploads", tags=["Uploads"])

# --- Env ---
SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "menu_item_images")
SUPABASE_VIDEO_BUCKET = os.getenv("SUPABASE_VIDEO_BUCKET", "allvids")
WEBSITE_FILES_BUCKET = os.getenv("SUPABASE_WEBSITE_BUCKET", "website-uploads")
SUPABASE_FOLDER_PREFIX = os.getenv("SUPABASE_FOLDER_PREFIX", "").strip("/")

# Optional: your Cloudflare media host (if you want backend to also return a CDN URL)
MEDIA_BASE = os.getenv("MEDIA_BASE", "https://media.zygoflow.com").rstrip("/")
STORAGE_LIMIT_BYTES = int(os.getenv("DEFAULT_STORAGE_LIMIT_BYTES", 1_000_000_000)) # 1GB default

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


# ------------ helpers ------------
def _today_path() -> str:
    d = datetime.datetime.utcnow()
    return f"{d.year:04d}/{d.month:02d}/{d.day:02d}"

def _safe_name(s: str) -> str:
    base = re.sub(r"\.[^./\\]+$", "", s).lower()
    base = re.sub(r"[^a-z0-9\-_.]+", "-", base).strip("-_")
    return base or "file"

def _ext_for(filename: str, content_type: str | None) -> str:
    ext = os.path.splitext(filename)[1]
    if not ext and content_type:
        guessed = mimetypes.guess_extension(content_type) or ""
        ext = guessed
    return (ext or "").lower()

def _make_object_key(filename: str, content_type: str | None, user_id: str) -> str:
    # Example path: {user_id}/2025/08/31/my-video-uuid.mp4
    key = f"{user_id}/{_today_path()}/{_safe_name(filename)}-{uuid.uuid4().hex}{_ext_for(filename, content_type)}"
    return f"{SUPABASE_FOLDER_PREFIX}/{key}" if SUPABASE_FOLDER_PREFIX else key


def _public_url(bucket: str, object_key: str) -> str:
    return f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{object_key}"

def _relative_public_path(bucket: str, object_key: str) -> str:
    return f"/storage/v1/object/public/{bucket}/{object_key}"

def _cdn_url(bucket: str, object_key: str) -> str:
    return f"{MEDIA_BASE}/storage/v1/object/public/{bucket}/{object_key}"


# ------------ IMAGE: direct server upload ------------
@router.post("/image", status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user) # Get the logged-in user
):
    try:
        # --- Check User's Storage Limit ---
        owner = await db.scalar(select(RestaurantOwner).where(RestaurantOwner.user_id == current_user.id))
        if not owner:
            raise HTTPException(status_code=404, detail="Restaurant owner not found.")

        data = await file.read()
        file_size = len(data)

        if owner.storage_bytes_used + file_size > STORAGE_LIMIT_BYTES:
            raise HTTPException(status_code=413, detail="Storage limit exceeded. Cannot upload file.")
        
        # --- Continue with upload logic ---
        content_type = file.content_type or mimetypes.guess_type(file.filename)[0]
        if not content_type or not content_type.startswith("image/"):
            raise HTTPException(400, "File provided is not an image.")

        object_key = _make_object_key(file.filename, content_type, str(current_user.id))
        
        res = supabase.storage.from_(SUPABASE_BUCKET).upload(
            path=object_key,
            file=data,
            file_options={"contentType": content_type, "upsert": "true", "cacheControl": "3600"},
        )
        if isinstance(res, dict) and res.get("error"):
            raise RuntimeError(f"Supabase upload error: {res['error']}")
            
        # --- Update the user's storage usage in the database ---
        owner.storage_bytes_used += file_size
        await db.commit()

        # --- Return URLs ---
        public_url = _public_url(SUPABASE_BUCKET, object_key)
        relative_url = _relative_public_path(SUPABASE_BUCKET, object_key)
        
        return JSONResponse(
            {"image_url": public_url, "relative_url": relative_url},
            status_code=201,
        )

    except HTTPException:
        raise
    except Exception as e:
        print("UPLOAD ERROR:", e)
        raise HTTPException(500, f"Upload failed: {e}")


# ------------ VIDEO: signed URL for browser PUT ------------
@router.post("/video/signed-url")
async def get_video_signed_url(
    file_name: str = Form(...),
    content_type: str = Form(...),
    current_user: User = Depends(get_current_active_user) # Authenticate the user
):
    """
    Returns a signed URL so the browser can PUT the file directly to Supabase.
    """
    try:
        if not content_type.startswith(("video/", "application/")):
            pass

        # Create an object key that includes the user's ID
        object_key = _make_object_key(file_name, content_type, str(current_user.id))

        sdk_res = supabase.storage.from_(SUPABASE_VIDEO_BUCKET).create_signed_upload_url(object_key)
        data = sdk_res.get("data", sdk_res) if isinstance(sdk_res, dict) else sdk_res
        signed_url = None
        if isinstance(data, dict):
            signed_url = data.get("signedUrl") or data.get("signed_url") or data.get("url")

        if not signed_url:
            raise RuntimeError(f"Failed to create signed upload URL: {sdk_res}")

        origin_public = _public_url(SUPABASE_VIDEO_BUCKET, object_key)
        relative_url = _relative_public_path(SUPABASE_VIDEO_BUCKET, object_key)
        cdn_public = _cdn_url(SUPABASE_VIDEO_BUCKET, object_key)

        return {
            "upload_url": signed_url,
            "public_url": origin_public,
            "relative_url": relative_url,
            "cdn_url": cdn_public,
            "bucket": SUPABASE_VIDEO_BUCKET,
            "path": object_key,
            "content_type": content_type,
        }

    except Exception as e:
        print("SIGNED URL ERROR (video):", e)
        raise HTTPException(500, f"Could not create signed upload URL: {e}")



class DeleteObjectPayload(BaseModel):
    bucket: str
    path: str

@router.post("/delete-object")
async def delete_storage_object(
    payload: DeleteObjectPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Deletes an object from Supabase storage, but only if the user owns it.
    """
    try:
        # The user ID is the first part of the file path (e.g., "3/...")
        owner_user_id_str = payload.path.split('/')[0]
        if not owner_user_id_str.isdigit() or int(owner_user_id_str) != current_user.id:
            raise HTTPException(status_code=403, detail="You do not have permission to delete this file.")

        # If permission is granted, delete the file
        res = supabase.storage.from_(payload.bucket).remove([payload.path])

        return {"status": "success", "data": res}
    except Exception as e:
        print(f"Error deleting storage object: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete file from storage.")


# ==========================================
# ✅ UNIVERSAL UPLOAD (With Correct Headers)
# ==========================================
@router.post("/", status_code=status.HTTP_201_CREATED)
async def upload_generic_file(
    file: UploadFile = File(...),
):
    try:
        MAX_FILE_SIZE = 10 * 1024 * 1024 # 10 MB
        file_bytes = await file.read()
        
        if len(file_bytes) > MAX_FILE_SIZE:
             raise HTTPException(status_code=413, detail="File too large (Max 10MB).")

        # 1. Force PDF Content-Type based on extension
        filename_lower = file.filename.lower()
        content_type = None

        if filename_lower.endswith(".pdf"):
            content_type = "application/pdf"
        elif filename_lower.endswith((".jpg", ".jpeg")):
            content_type = "image/jpeg"
        elif filename_lower.endswith(".png"):
            content_type = "image/png"
        
        # 2. Fallback
        if not content_type:
            guessed_type, _ = mimetypes.guess_type(file.filename)
            content_type = guessed_type or file.content_type or "application/octet-stream"

        # Generate unique ID
        anon_id = f"public_{uuid.uuid4().hex[:8]}"
        object_key = _make_object_key(file.filename, content_type, anon_id)
        
        # 3. UPLOAD WITH CORRECT HEADER KEY ("content-type")
        res = supabase.storage.from_(WEBSITE_FILES_BUCKET).upload(
            path=object_key,
            file=file_bytes,
            # FIX: "contentType" -> "content-type"
            file_options={"content-type": content_type, "upsert": "true"} 
        )
        
        public_url = _public_url(WEBSITE_FILES_BUCKET, object_key)
        return JSONResponse({"url": public_url}, status_code=201)

    except Exception as e:
        print("GENERIC UPLOAD ERROR:", e)
        raise HTTPException(500, f"Upload failed: {str(e)}")