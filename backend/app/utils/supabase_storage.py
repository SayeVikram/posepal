import mimetypes
import uuid
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from urllib.parse import quote

import boto3
from botocore.signers import CloudFrontSigner
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

from app.config import settings
from app.utils.supabase_client import get_client


@lru_cache(maxsize=1)
def _s3_client():
    return boto3.client(
        "s3",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
    )


@lru_cache(maxsize=1)
def _cloudfront_signer() -> CloudFrontSigner | None:
    if not settings.CLOUDFRONT_KEY_PAIR_ID:
        return None

    pem = settings.CLOUDFRONT_PRIVATE_KEY
    if not pem and settings.CLOUDFRONT_PRIVATE_KEY_PATH:
        try:
            with open(settings.CLOUDFRONT_PRIVATE_KEY_PATH, "r", encoding="utf-8") as fh:
                pem = fh.read()
        except FileNotFoundError:
            return None
    if not pem:
        return None
    # Support both literal newlines and escaped '\n' in env vars.
    if "\\n" in pem:
        pem = pem.replace("\\n", "\n")
    private_key = serialization.load_pem_private_key(
        pem.encode("utf-8"),
        password=None,
    )

    def _rsa_signer(message: bytes) -> bytes:
        return private_key.sign(message, padding.PKCS1v15(), hashes.SHA1())

    return CloudFrontSigner(settings.CLOUDFRONT_KEY_PAIR_ID, _rsa_signer)


def _content_type_for(filename: str) -> str:
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "application/octet-stream"


def _s3_key(prefix: str, owner_id: int, filename: str) -> str:
    safe_name = filename.replace(" ", "_")
    return f"{prefix}/{owner_id}/{uuid.uuid4()}_{safe_name}"


async def upload_video(data: bytes, user_id: int, filename: str) -> str:
    key = _s3_key(settings.S3_VIDEOS_PREFIX, user_id, filename)
    _s3_client().put_object(
        Bucket=settings.S3_BUCKET,
        Key=key,
        Body=data,
        ContentType=_content_type_for(filename),
    )
    return key


async def upload_snippet(data: bytes, session_id: int, filename: str) -> str:
    key = _s3_key(settings.S3_SNIPPETS_PREFIX, session_id, filename)
    _s3_client().put_object(
        Bucket=settings.S3_BUCKET,
        Key=key,
        Body=data,
        ContentType=_content_type_for(filename),
    )
    return key


async def get_delivery_url(key: str) -> str:
    signer = _cloudfront_signer()
    if signer and settings.CLOUDFRONT_DOMAIN:
        encoded_key = quote(key)
        url = f"https://{settings.CLOUDFRONT_DOMAIN}/{encoded_key}"
        return signer.generate_presigned_url(
            url,
            date_less_than=datetime.now(timezone.utc)
            + timedelta(seconds=settings.SIGNED_URL_EXPIRES_SECONDS),
        )

    # Fallback for local/dev when CloudFront config is incomplete.
    return _s3_client().generate_presigned_url(
        ClientMethod="get_object",
        Params={"Bucket": settings.S3_BUCKET, "Key": key},
        ExpiresIn=settings.SIGNED_URL_EXPIRES_SECONDS,
    )

AVATAR_BUCKET = "avatars"
DEMO_BUCKET = "demo-media"
async def upload_avatar(data: bytes, user_id: int, filename: str, content_type: str) -> str:
    sb = get_client()
    path = f"{user_id}/{uuid.uuid4()}_{filename}"
    sb.storage.from_(AVATAR_BUCKET).upload(path, data, {"content-type": content_type})
    return sb.storage.from_(AVATAR_BUCKET).get_public_url(path)


async def upload_demo_media(data: bytes, assignment_id: int, filename: str, content_type: str) -> str:
    sb = get_client()
    path = f"{assignment_id}/{uuid.uuid4()}_{filename}"
    sb.storage.from_(DEMO_BUCKET).upload(path, data, {"content-type": content_type})
    return sb.storage.from_(DEMO_BUCKET).get_public_url(path)