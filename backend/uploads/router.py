from fastapi import APIRouter, File, UploadFile, HTTPException, status
import shutil
import os
from uuid import uuid4

router = APIRouter(prefix="/uploads", tags=["Uploads"])

UPLOAD_DIR = "static/images"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/image", status_code=status.HTTP_201_CREATED)
async def upload_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File provided is not an image.")

    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{uuid4()}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    finally:
        file.file.close()
    
    # UPDATED: This creates a clean, cross-platform URL path.
    # It will correctly return "/static/images/your-file.jpg"
    image_url = f"/static/images/{unique_filename}" 

    return {"image_url": image_url}