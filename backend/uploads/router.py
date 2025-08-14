from fastapi import APIRouter, File, UploadFile, HTTPException, status
from fastapi.responses import JSONResponse
import os, mimetypes, uuid, traceback
from supabase import create_client, Client

router = APIRouter(prefix="/uploads", tags=["Uploads"])

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "menu_item_images")
SUPABASE_FOLDER_PREFIX = os.getenv("SUPABASE_FOLDER_PREFIX", "").strip("/")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def _object_path(filename: str) -> str:
    return f"{SUPABASE_FOLDER_PREFIX}/{filename}" if SUPABASE_FOLDER_PREFIX else filename

@router.post("/image", status_code=status.HTTP_201_CREATED)
async def upload_image(file: UploadFile = File(...)):
    try:
        content_type = file.content_type or mimetypes.guess_type(file.filename)[0]
        if not content_type or not content_type.startswith("image/"):
            raise HTTPException(400, "File provided is not an image.")

        ext = os.path.splitext(file.filename)[1] or mimetypes.guess_extension(content_type) or ""
        name = f"{uuid.uuid4()}{ext}"
        object_path = _object_path(name)

        data = await file.read()  # bytes
        res = supabase.storage.from_(SUPABASE_BUCKET).upload(
            path=object_path,
            file=data,
            file_options={
                "contentType": content_type,
                "upsert": "true",       # <-- string, not bool
                "cacheControl": "3600", # optional
            },
        )

        # Handle SDK error shape
        if isinstance(res, dict) and res.get("error"):
            raise RuntimeError(f"Supabase upload error: {res['error']}")

        public_url = f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{object_path}"
        return JSONResponse({"image_url": public_url}, status_code=201)

    except HTTPException:
        raise
    except Exception as e:
        print("UPLOAD ERROR:", e)
        print(traceback.format_exc())
        raise HTTPException(500, f"Upload failed: {e}")
