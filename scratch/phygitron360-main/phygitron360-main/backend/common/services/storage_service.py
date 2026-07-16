import os
import shutil
import logging
from fastapi import UploadFile
from backend.core.database import DATA_DIR

logger = logging.getLogger(__name__)

BASE_UPLOADS_DIR = os.path.join(DATA_DIR, 'uploads')

# S3 config — read once at import time
_S3_BUCKET   = os.environ.get('AWS_S3_BUCKET', '')
_S3_REGION   = os.environ.get('AWS_S3_REGION', 'us-east-1')
_S3_ENDPOINT = os.environ.get('AWS_S3_ENDPOINT_URL', '')   # for LocalStack: http://localhost:4566
_USE_S3      = bool(_S3_BUCKET)

# Lazy-load boto3 only when actually needed
_s3_client = None

def _get_s3():
    global _s3_client
    if _s3_client is None:
        import boto3
        kwargs = {'region_name': _S3_REGION}
        if _S3_ENDPOINT:                     # LocalStack / custom endpoint
            kwargs['endpoint_url'] = _S3_ENDPOINT
        _s3_client = boto3.client('s3', **kwargs)
    return _s3_client


def save_uploaded_file(uploaded_file: UploadFile, tenant_id: str, module_name: str, data_type: str, identifier: str, suffix: str) -> str:
    """
    Save an uploaded file.
    - If AWS_S3_BUCKET is set  → upload to S3, return public HTTPS URL.
    - Otherwise               → save to local disk, return relative path
    """
    if not uploaded_file:
        return None

    # Build filename
    ext     = os.path.splitext(uploaded_file.filename or '')[1] or '.bin'
    safe_id = identifier.replace('/', '_').replace('\\', '_').strip()
    filename = f"{safe_id}_{suffix}{ext}"

    # ── Path structure ───────────────────────────────────────────────────────
    # e.g. tenant_dev/deploy/pfp/EMP001_pfp.jpg
    relative_path = f"{tenant_id}/{module_name}/{data_type}/{filename}"

    # ── S3 path ──────────────────────────────────────────────────────────────
    if _USE_S3:
        try:
            uploaded_file.file.seek(0)          # rewind in case already read
            _get_s3().upload_fileobj(
                uploaded_file.file,
                _S3_BUCKET,
                relative_path,
                ExtraArgs={'ContentType': uploaded_file.content_type or 'application/octet-stream'},
            )
            if _S3_ENDPOINT:                    # LocalStack — build URL manually
                url = f"{_S3_ENDPOINT}/{_S3_BUCKET}/{relative_path}"
            else:
                url = f"https://{_S3_BUCKET}.s3.{_S3_REGION}.amazonaws.com/{relative_path}"
            logger.info(f"[S3] Uploaded {relative_path} → {url}")
            return url
        except Exception as e:
            logger.error(f"[S3] Upload failed for {relative_path}: {e}")
            raise Exception(f"S3 Upload Error: {str(e)}")

    # ── Local disk fallback ───────────────────────────────────────────────────
    try:
        folder_path = os.path.join(DATA_DIR, tenant_id, module_name, data_type)
        os.makedirs(folder_path, exist_ok=True)
        filepath = os.path.join(folder_path, filename)
        uploaded_file.file.seek(0)              # rewind after possible S3 attempt
        with open(filepath, "wb") as buf:
            shutil.copyfileobj(uploaded_file.file, buf)
        logger.info(f"[LocalDisk] Saved {filepath}")
        return filepath
    except Exception as e:
        logger.error(f"[LocalDisk] Save failed for {filename}: {e}")
        return None

def save_file_content(content: bytes, filename: str, content_type: str, tenant_id: str, module_name: str, data_type: str) -> str:
    """Save raw bytes to S3 or Local storage."""
    relative_path = f"{tenant_id}/{module_name}/{data_type}/{filename}"
    
    if _USE_S3:
        try:
            from io import BytesIO
            _get_s3().upload_fileobj(
                BytesIO(content),
                _S3_BUCKET,
                relative_path,
                ExtraArgs={'ContentType': content_type},
            )
            if _S3_ENDPOINT:
                url = f"{_S3_ENDPOINT}/{_S3_BUCKET}/{relative_path}"
            else:
                url = f"https://{_S3_BUCKET}.s3.{_S3_REGION}.amazonaws.com/{relative_path}"
            logger.info(f"[S3] Uploaded {relative_path} → {url}")
            return url
        except Exception as e:
            logger.error(f"[S3] Upload failed for {relative_path}: {e}")
            raise Exception(f"S3 Upload Error: {str(e)}")
            
    # Local fallback
    try:
        folder_path = os.path.join(DATA_DIR, tenant_id, module_name, data_type)
        os.makedirs(folder_path, exist_ok=True)
        filepath = os.path.join(folder_path, filename)
        with open(filepath, "wb") as buf:
            buf.write(content)
        logger.info(f"[LocalDisk] Saved {filepath}")
        return filepath
    except Exception as e:
        logger.error(f"[LocalDisk] Save failed for {filename}: {e}")
        return None

def generate_presigned_url(s3_url: str, expiry_seconds: int = 900) -> str:
    """
    Given a full S3 HTTPS URL, generate a pre-signed URL valid for `expiry_seconds`.
    Falls back to the original URL if S3 is not configured or generation fails.
    """
    if not _USE_S3:
        return s3_url
    try:
        s3 = _get_s3()
        # Extract the S3 key from the full URL
        # URL format: https://<bucket>.s3.<region>.amazonaws.com/<key>
        # or for endpoint: <endpoint>/<bucket>/<key>
        if _S3_ENDPOINT:
            prefix = f"{_S3_ENDPOINT}/{_S3_BUCKET}/"
        else:
            prefix = f"https://{_S3_BUCKET}.s3.{_S3_REGION}.amazonaws.com/"
        
        if not s3_url.startswith(prefix):
            logger.warning(f"[S3] URL does not match expected prefix: {s3_url}")
            return s3_url
        
        key = s3_url[len(prefix):]
        presigned = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': _S3_BUCKET, 'Key': key},
            ExpiresIn=expiry_seconds
        )
        logger.info(f"[S3] Generated presigned URL for key: {key}")
        return presigned
    except Exception as e:
        logger.error(f"[S3] Failed to generate presigned URL: {e}")
        return s3_url


def delete_tenant_directory(tenant_id: str):
    """Permanently delete a tenant's entire storage folder from both S3 and Local Disk."""
    if not tenant_id or tenant_id == "." or tenant_id == "/":
        return
        
    if _USE_S3:
        try:
            s3 = _get_s3()
            # S3 doesn't have folders, so we list and delete all objects with the prefix
            prefix = f"{tenant_id}/"
            paginator = s3.get_paginator('list_objects_v2')
            for page in paginator.paginate(Bucket=_S3_BUCKET, Prefix=prefix):
                if 'Contents' in page:
                    objects_to_delete = [{'Key': obj['Key']} for obj in page['Contents']]
                    s3.delete_objects(Bucket=_S3_BUCKET, Delete={'Objects': objects_to_delete})
            logger.info(f"[S3] Deleted all objects for tenant {tenant_id}")
        except Exception as e:
            logger.error(f"[S3] Failed to delete tenant directory {tenant_id}: {e}")
            
    # Always try to delete local fallback just in case
    try:
        folder_path = os.path.join(DATA_DIR, tenant_id)
        if os.path.exists(folder_path) and os.path.isdir(folder_path):
            shutil.rmtree(folder_path, ignore_errors=True)
            logger.info(f"[LocalDisk] Deleted tenant folder {folder_path}")
    except Exception as e:
        logger.error(f"[LocalDisk] Failed to delete tenant folder {tenant_id}: {e}")
