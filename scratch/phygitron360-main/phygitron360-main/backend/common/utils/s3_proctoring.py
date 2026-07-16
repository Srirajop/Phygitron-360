import os
import boto3
import uuid
import logging
from botocore.exceptions import ClientError
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
PROCTORING_BUCKET = os.getenv("PROCTORING_S3_BUCKET", "phygitron360-proctoring-data")

def get_s3_client():
    if not AWS_ACCESS_KEY or not AWS_SECRET_KEY:
        logger.warning("AWS credentials not configured. S3 upload will be skipped or mocked.")
        return None
    return boto3.client(
        "s3",
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY,
        region_name=AWS_REGION
    )

def ensure_bucket_and_lifecycle():
    """Ensure the bucket exists and has a 30-day expiration lifecycle rule for GDPR."""
    s3 = get_s3_client()
    if not s3:
        return False
    try:
        s3.head_bucket(Bucket=PROCTORING_BUCKET)
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == '404':
            try:
                if AWS_REGION == 'us-east-1':
                    s3.create_bucket(Bucket=PROCTORING_BUCKET)
                else:
                    s3.create_bucket(
                        Bucket=PROCTORING_BUCKET,
                        CreateBucketConfiguration={'LocationConstraint': AWS_REGION}
                    )
            except Exception as ce:
                logger.error(f"Failed to create bucket: {ce}")
                return False
        else:
            logger.error(f"Error checking bucket: {e}")
            return False

    # Ensure lifecycle rule is set
    try:
        lifecycle_config = {
            'Rules': [
                {
                    'ID': 'DeleteOldProctoringData',
                    'Filter': {'Prefix': ''},
                    'Status': 'Enabled',
                    'Expiration': {'Days': 30}
                }
            ]
        }
        s3.put_bucket_lifecycle_configuration(
            Bucket=PROCTORING_BUCKET,
            LifecycleConfiguration=lifecycle_config
        )
    except Exception as e:
        logger.error(f"Failed to set lifecycle rule on bucket: {e}")
    return True

def upload_proctoring_artifact(file_bytes: bytes, content_type: str, file_extension: str, assessment_result_id: int) -> str:
    """Uploads proctoring snapshot/audio to S3 and returns the URL. Uses 30-day lifecycle bucket."""
    s3 = get_s3_client()
    if not s3:
        # Fallback to local storage if S3 not configured
        from backend.core.database import DATA_DIR
        local_dir = os.path.join(DATA_DIR, "proctoring", str(assessment_result_id))
        os.makedirs(local_dir, exist_ok=True)
        filename = f"{uuid.uuid4().hex}.{file_extension}"
        filepath = os.path.join(local_dir, filename)
        with open(filepath, "wb") as f:
            f.write(file_bytes)
        return f"/uploads/proctoring/{assessment_result_id}/{filename}"

    ensure_bucket_and_lifecycle()
    object_key = f"{assessment_result_id}/{uuid.uuid4().hex}.{file_extension}"
    
    try:
        s3.put_object(
            Bucket=PROCTORING_BUCKET,
            Key=object_key,
            Body=file_bytes,
            ContentType=content_type,
            # No ACL='public-read' as this is sensitive GDPR data.
        )
        return f"https://{PROCTORING_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{object_key}"
    except Exception as e:
        logger.error(f"S3 Upload failed: {e}")
        return ""
