import os
import aiofiles
from app.config import settings

# Check if real AWS credentials are configured
HAS_REAL_AWS = (
    settings.AWS_ACCESS_KEY_ID
    and settings.AWS_SECRET_ACCESS_KEY
    and settings.AWS_ACCESS_KEY_ID != "your_aws_access_key"
    and settings.AWS_SECRET_ACCESS_KEY != "your_aws_secret_key"
)

if HAS_REAL_AWS:
    import boto3
    from botocore.exceptions import ClientError
    from botocore.config import Config


def get_s3_client():
    if not HAS_REAL_AWS:
        return None
    return boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )


# ── Local file storage fallback ──────────────────────────────────────────────

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")


def _ensure_local_dir(s3_key: str) -> str:
    """Create local directory structure and return full file path."""
    local_path = os.path.join(UPLOAD_DIR, s3_key.replace("/", os.sep))
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    return local_path


def _save_bytes_locally(data: bytes, s3_key: str) -> str:
    """Save bytes to local uploads directory and return URL."""
    local_path = _ensure_local_dir(s3_key)
    with open(local_path, "wb") as f:
        f.write(data)
    return f"{settings.BACKEND_URL}/uploads/{s3_key}"


def _save_file_locally(file_path: str, s3_key: str) -> str:
    """Copy file to local uploads directory and return URL."""
    import shutil
    local_path = _ensure_local_dir(s3_key)
    shutil.copy2(file_path, local_path)
    return f"{settings.BACKEND_URL}/uploads/{s3_key}"


# ── S3 upload functions (with local fallback) ────────────────────────────────

async def upload_file_to_s3(file_path: str, s3_key: str, content_type: str = "application/octet-stream") -> str:
    """Upload a local file to S3 and return the URL. Falls back to local storage."""
    if not HAS_REAL_AWS:
        return _save_file_locally(file_path, s3_key)

    s3 = get_s3_client()
    try:
        s3.upload_file(
            file_path,
            settings.S3_BUCKET_NAME,
            s3_key,
            ExtraArgs={"ContentType": content_type, "ServerSideEncryption": "AES256"},
        )
        if settings.CLOUDFRONT_URL and settings.CLOUDFRONT_URL != "https://your-cloudfront-domain.cloudfront.net":
            return f"{settings.CLOUDFRONT_URL}/{s3_key}"
        return f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/{s3_key}"
    except ClientError as e:
        # Fallback to local
        return _save_file_locally(file_path, s3_key)


async def upload_bytes_to_s3(data: bytes, s3_key: str, content_type: str = "application/octet-stream") -> str:
    """Upload bytes directly to S3. Falls back to local storage."""
    if not HAS_REAL_AWS:
        return _save_bytes_locally(data, s3_key)

    s3 = get_s3_client()
    try:
        s3.put_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=s3_key,
            Body=data,
            ContentType=content_type,
            ServerSideEncryption="AES256",
        )
        if settings.CLOUDFRONT_URL and settings.CLOUDFRONT_URL != "https://your-cloudfront-domain.cloudfront.net":
            return f"{settings.CLOUDFRONT_URL}/{s3_key}"
        return f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/{s3_key}"
    except ClientError as e:
        # Fallback to local
        return _save_bytes_locally(data, s3_key)


def upload_bytes_to_s3_sync(data: bytes, s3_key: str, content_type: str = "application/octet-stream") -> str:
    """Synchronous version for use in Celery tasks / inline calls."""
    if not HAS_REAL_AWS:
        return _save_bytes_locally(data, s3_key)

    s3 = get_s3_client()
    try:
        s3.put_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=s3_key,
            Body=data,
            ContentType=content_type,
            ServerSideEncryption="AES256",
        )
        if settings.CLOUDFRONT_URL and settings.CLOUDFRONT_URL != "https://your-cloudfront-domain.cloudfront.net":
            return f"{settings.CLOUDFRONT_URL}/{s3_key}"
        return f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/{s3_key}"
    except ClientError:
        return _save_bytes_locally(data, s3_key)


def generate_presigned_url(s3_key: str, expiry_seconds: int = 14400) -> str:
    """Generate a pre-signed URL for private S3 objects (default 4h for videos)."""
    if not HAS_REAL_AWS:
        return f"{settings.BACKEND_URL}/uploads/{s3_key}"
    s3 = get_s3_client()
    try:
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.S3_BUCKET_NAME, "Key": s3_key},
            ExpiresIn=expiry_seconds,
        )
        return url
    except Exception:
        return f"{settings.BACKEND_URL}/uploads/{s3_key}"
