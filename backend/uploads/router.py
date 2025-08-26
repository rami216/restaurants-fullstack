# from fastapi import APIRouter, File, UploadFile, HTTPException, status,Form
# from fastapi.responses import JSONResponse
# import os, mimetypes, uuid, traceback
# from supabase import create_client, Client

# router = APIRouter(prefix="/uploads", tags=["Uploads"])

# SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
# SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
# SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "menu_item_images")
# SUPABASE_FOLDER_PREFIX = os.getenv("SUPABASE_FOLDER_PREFIX", "").strip("/")
# SUPABASE_VIDEO_BUCKET = os.getenv("SUPABASE_VIDEO_BUCKET", "all_vids")

# supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# def _object_path(filename: str) -> str:
#     return f"{SUPABASE_FOLDER_PREFIX}/{filename}" if SUPABASE_FOLDER_PREFIX else filename

# @router.post("/image", status_code=status.HTTP_201_CREATED)
# async def upload_image(file: UploadFile = File(...)):
#     try:
#         content_type = file.content_type or mimetypes.guess_type(file.filename)[0]
#         if not content_type or not content_type.startswith("image/"):
#             raise HTTPException(400, "File provided is not an image.")

#         ext = os.path.splitext(file.filename)[1] or mimetypes.guess_extension(content_type) or ""
#         name = f"{uuid.uuid4()}{ext}"
#         object_path = _object_path(name)

#         data = await file.read()  # bytes
#         res = supabase.storage.from_(SUPABASE_BUCKET).upload(
#             path=object_path,
#             file=data,
#             file_options={
#                 "contentType": content_type,
#                 "upsert": "true",       # <-- string, not bool
#                 "cacheControl": "3600", # optional
#             },
#         )

#         # Handle SDK error shape
#         if isinstance(res, dict) and res.get("error"):
#             raise RuntimeError(f"Supabase upload error: {res['error']}")

#         public_url = f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{object_path}"
#         return JSONResponse({"image_url": public_url}, status_code=201)

#     except HTTPException:
#         raise
#     except Exception as e:
#         print("UPLOAD ERROR:", e)
#         print(traceback.format_exc())
#         raise HTTPException(500, f"Upload failed: {e}")


# # ---------- NEW: SIGNED VIDEO UPLOAD (BROWSER -> SUPABASE) ----------
# @router.post("/video/signed-url")
# async def get_video_signed_url(
#     file_name: str = Form(...),
#     content_type: str = Form(...),
# ):
#     """
#     Returns a one-time signed URL so the browser can PUT the file directly to Supabase.
#     """
#     try:
#         # build a unique object name
#         ext = os.path.splitext(file_name)[1] or mimetypes.guess_extension(content_type) or ""
#         name = f"{uuid.uuid4()}{ext}"

#         # create signed upload URL
#         res = supabase.storage.from_(SUPABASE_VIDEO_BUCKET).create_signed_upload_url(name)
#         # SDK response might use signedUrl or signed_url depending on version
#         signed_url = (res.get("signedUrl") or res.get("signed_url"))
#         if not signed_url:
#             raise RuntimeError(f"Failed to create signed upload URL: {res}")

#         public_url = f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_VIDEO_BUCKET}/{name}"

#         # You PUT the file to signed_url with Content-Type and x-upsert headers
#         return {
#             "upload_url": signed_url,
#             "path": name,
#             "public_url": public_url,
#             "content_type": content_type,
#             "bucket": SUPABASE_VIDEO_BUCKET,
#         }
#     except Exception as e:
#         print("SIGNED URL ERROR (video):", e)
#         print(traceback.format_exc())
#         raise HTTPException(500, f"Could not create signed upload URL: {e}")
# routes/uploads.py
from fastapi import APIRouter, File, UploadFile, HTTPException, status, Form
from fastapi.responses import JSONResponse
import os, mimetypes, uuid, traceback, re, datetime
from supabase import create_client, Client

router = APIRouter(prefix="/uploads", tags=["Uploads"])

# --- Env ---
SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "menu_item_images")
SUPABASE_VIDEO_BUCKET = os.getenv("SUPABASE_VIDEO_BUCKET", "all_vids")
SUPABASE_FOLDER_PREFIX = os.getenv("SUPABASE_FOLDER_PREFIX", "").strip("/")

# Optional: your Cloudflare media host (if you want backend to also return a CDN URL)
MEDIA_BASE = os.getenv("MEDIA_BASE", "https://media.zygoflow.com").rstrip("/")

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

def _make_object_key(filename: str, content_type: str | None) -> str:
    key = f"{_today_path()}/{_safe_name(filename)}-{uuid.uuid4().hex}{_ext_for(filename, content_type)}"
    return f"{SUPABASE_FOLDER_PREFIX}/{key}" if SUPABASE_FOLDER_PREFIX else key

def _public_url(bucket: str, object_key: str) -> str:
    return f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{object_key}"

def _relative_public_path(bucket: str, object_key: str) -> str:
    return f"/storage/v1/object/public/{bucket}/{object_key}"

def _cdn_url(bucket: str, object_key: str) -> str:
    return f"{MEDIA_BASE}/storage/v1/object/public/{bucket}/{object_key}"


# ------------ IMAGE: direct server upload ------------
@router.post("/image", status_code=status.HTTP_201_CREATED)
async def upload_image(file: UploadFile = File(...)):
    try:
        content_type = file.content_type or mimetypes.guess_type(file.filename)[0]
        if not content_type or not content_type.startswith("image/"):
            raise HTTPException(400, "File provided is not an image.")

        object_key = _make_object_key(file.filename, content_type)
        data = await file.read()

        res = supabase.storage.from_(SUPABASE_BUCKET).upload(
            path=object_key,
            file=data,
            file_options={
                "contentType": content_type,
                "upsert": "true",        # must be string per API
                "cacheControl": "3600",
            },
        )

        # supabase-py may return dict or an object; handle common shapes
        if isinstance(res, dict) and res.get("error"):
            raise RuntimeError(f"Supabase upload error: {res['error']}")

        public_url = _public_url(SUPABASE_BUCKET, object_key)
        relative_url = _relative_public_path(SUPABASE_BUCKET, object_key)
        cdn_url = _cdn_url(SUPABASE_BUCKET, object_key)

        return JSONResponse(
            {
                "image_url": public_url,          # origin URL (works with resolver)
                "relative_url": relative_url,     # handy if you prefer storing paths
                "cdn_url": cdn_url,               # already through Cloudflare (optional)
                "bucket": SUPABASE_BUCKET,
                "path": object_key,
                "content_type": content_type,
            },
            status_code=201,
        )

    except HTTPException:
        raise
    except Exception as e:
        print("UPLOAD ERROR:", e)
        print(traceback.format_exc())
        raise HTTPException(500, f"Upload failed: {e}")


# ------------ VIDEO: signed URL for browser PUT ------------
@router.post("/video/signed-url")
async def get_video_signed_url(
    file_name: str = Form(...),
    content_type: str = Form(...),
):
    """
    Returns a signed URL so the browser can PUT the file directly to Supabase.
    Frontend must set headers: { "Content-Type": content_type, "x-upsert": "true" }.
    """
    try:
        if not content_type.startswith(("video/", "application/")):
            # Allow HLS playlists/segments too if you plan to upload them:
            # application/x-mpegURL (.m3u8), video/MP2T (.ts)
            pass

        object_key = _make_object_key(file_name, content_type)

        # Call SDK; handle both {'data': {...}} and flat dict shapes
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
            "upload_url": signed_url,   # PUT here from the browser
            "public_url": origin_public,   # origin (frontend resolver rewrites to CDN)
            "relative_url": relative_url,  # optional to store
            "cdn_url": cdn_public,         # optional convenience
            "bucket": SUPABASE_VIDEO_BUCKET,
            "path": object_key,
            "content_type": content_type,
        }

    except Exception as e:
        print("SIGNED URL ERROR (video):", e)
        print(traceback.format_exc())
        raise HTTPException(500, f"Could not create signed upload URL: {e}")
