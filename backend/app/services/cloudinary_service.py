import cloudinary
import cloudinary.uploader
import logging
import uuid
from app.config import settings

logger = logging.getLogger(__name__)

_cloudinary_configured = False


def _configure_cloudinary():
    global _cloudinary_configured
    if not _cloudinary_configured:
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )
        _cloudinary_configured = True


def upload_image_to_cloudinary(
    file_bytes: bytes,
    original_filename: str,
    user_id: int,
) -> dict:
    """
    Upload image to Cloudinary.
    Returns dict with cloudinary metadata or raises exception.
    Never logs api_secret.
    """
    _configure_cloudinary()

    folder = f"{settings.CLOUDINARY_FOLDER}/user_{user_id}"
    safe_name = original_filename.rsplit(".", 1)[0] if "." in original_filename else original_filename
    public_id = f"{folder}/{safe_name}_{uuid.uuid4().hex[:8]}"

    result = cloudinary.uploader.upload(
        file_bytes,
        public_id=public_id,
        overwrite=False,
        resource_type="image",
    )

    secure_url = result.get("secure_url", "")
    # Thumbnail: 300x300 crop
    thumbnail_url = cloudinary.CloudinaryImage(result["public_id"]).build_url(
        width=300,
        height=300,
        crop="fill",
        secure=True,
    )

    return {
        "cloudinary_public_id": result.get("public_id", ""),
        "cloudinary_secure_url": secure_url,
        "cloudinary_thumbnail_url": thumbnail_url,
        "cloudinary_format": result.get("format", ""),
        "cloudinary_width": result.get("width", 0),
        "cloudinary_height": result.get("height", 0),
        "cloudinary_bytes": result.get("bytes", 0),
    }
