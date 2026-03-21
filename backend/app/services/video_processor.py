import os
import tempfile
import uuid
from datetime import datetime, timezone

import cv2
import numpy as np
from fastapi import UploadFile

from app.config import settings
from app.services.pose_analyzer import classify_pose, extract_keypoints
from app.utils.supabase_db import (
    create_session,
    create_session_analysis,
    get_assignment,
    get_assignment_sessions_with_analysis,
    update_assignment,
    update_session,
)
from app.utils.supabase_storage import upload_video


async def process_session_video(
    file: UploadFile,
    patient_id: int,
    assignment_id: int,
) -> dict:
    contents = await file.read()

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    # Create session record immediately so we have an ID for storage path
    session = await create_session(assignment_id=assignment_id, patient_id=patient_id)
    session_id = session["id"]

    try:
        frame_analyses, labels, scores, duration = _analyze_video(tmp_path)
        video_url = await upload_video(contents, patient_id, file.filename or f"{uuid.uuid4()}.mp4")

        total_frames = len(frame_analyses)
        correct_frames = sum(
            1 for f in frame_analyses if f["score"] >= settings.CORRECTNESS_THRESHOLD
        )
        overall_correctness = correct_frames / total_frames if total_frames > 0 else 0.0

        session = await update_session(
            session_id,
            video_url=video_url,
            video_path=file.filename or "",
            processed=True,
            duration_seconds=duration,
        )

        await create_session_analysis(
            session_id=session_id,
            overall_correctness=overall_correctness,
            total_frames=total_frames,
            correct_frames=correct_frames,
            areas_of_concern=None,
            timeline=None,
            frame_analyses=frame_analyses,
        )

        await _check_and_auto_complete(assignment_id)

        return session
    except Exception as exc:
        await update_session(session_id, processed=True, processing_error=str(exc))
        raise
    finally:
        os.unlink(tmp_path)


async def _check_and_auto_complete(assignment_id: int) -> None:
    """Mark an assignment completed when enough qualifying days have been recorded."""
    assignment = await get_assignment(assignment_id)
    if not assignment or assignment.get("status") != "pending":
        return

    required_days = assignment.get("required_days")
    if not required_days:
        return  # No day requirement set; skip auto-completion

    due_date_str = assignment.get("due_date")
    if due_date_str:
        due_date = datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > due_date:
            return  # Past deadline; don't auto-complete

    sessions = await get_assignment_sessions_with_analysis(assignment_id)
    qualifying_dates: set[str] = set()
    for s in sessions:
        analyses = s.get("session_analyses") or []
        if isinstance(analyses, dict):
            analyses = [analyses]
        correctness = analyses[0].get("overall_correctness", 0) if analyses else 0
        if correctness >= settings.CORRECTNESS_THRESHOLD:
            recorded_at = s.get("recorded_at", "")
            if recorded_at:
                qualifying_dates.add(recorded_at[:10])  # YYYY-MM-DD

    if len(qualifying_dates) >= required_days:
        await update_assignment(assignment_id, status="completed")


def _analyze_video(path: str) -> tuple[list, list, list, float]:
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_analyses, labels, scores = [], [], []
    frame_interval = 5
    frame_idx = 0
    total_frame_count = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        total_frame_count += 1
        if frame_idx % frame_interval == 0:
            kp = extract_keypoints(frame)
            if kp is not None:
                label, score = classify_pose(kp)
                labels.append(label)
                scores.append(score)
                frame_analyses.append({"frame": frame_idx, "label": label, "score": score})
        frame_idx += 1

    cap.release()
    duration = total_frame_count / fps if fps > 0 else 0.0
    return frame_analyses, labels, scores, duration
