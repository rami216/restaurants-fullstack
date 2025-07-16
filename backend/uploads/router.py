# uploads/router.py

from fastapi import APIRouter, File, UploadFile, HTTPException
import shutil
import os
from uuid import uuid4

router = APIRouter(prefix="/uploads", tags=["Uploads"])

# Create a directory to store images if it doesn't exist
UPLOAD_DIR = "static/images"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/image")
async def upload_menu_item_image(file: UploadFile = File(...)):
    """
    Handles uploading an image file.
    In a real app, this would upload to cloud storage (S3, etc.).
    Here, we save it locally and return a path.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File provided is not an image.")

    # Create a unique filename
    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{uuid4()}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    finally:
        file.file.close()
    
    # In a real app, you would return the full public URL from your cloud storage.
    # For local development, we return a relative path.
    # The frontend will need to know the base URL for static files.
    # Example: http://localhost:8000/static/images/your-file.jpg
    image_url = f"/{file_path}" 

    return {"image_url": image_url}