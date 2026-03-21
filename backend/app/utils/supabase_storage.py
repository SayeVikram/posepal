import uuid

from app.utils.supabase_client import get_client

VIDEO_BUCKET = "videos"
SNIPPET_BUCKET = "snippets"


async def upload_video(data: bytes, user_id: int, filename: str) -> str:
    sb = get_client()
    path = f"{user_id}/{uuid.uuid4()}_{filename}"
    sb.storage.from_(VIDEO_BUCKET).upload(path, data, {"content-type": "video/mp4"})
    return sb.storage.from_(VIDEO_BUCKET).get_public_url(path)


async def upload_snippet(data: bytes, session_id: int, filename: str) -> str:
    sb = get_client()
    path = f"{session_id}/{uuid.uuid4()}_{filename}"
    sb.storage.from_(SNIPPET_BUCKET).upload(path, data, {"content-type": "video/mp4"})
    return sb.storage.from_(SNIPPET_BUCKET).get_public_url(path)
