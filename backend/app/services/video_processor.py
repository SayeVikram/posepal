import os
import tempfile
import uuid

import cv2
from fastapi import UploadFile

from app.config import settings
from app.services.pose_analyzer import classify_pose, extract_keypoints
from app.utils.supabase_db import (
    create_session,
    create_session_analysis,
    get_assignment,
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

    # Resolve the expected pose class from the assignment so we can tell
    # whether each classified frame actually matches what was assigned.
    assignment = await get_assignment(assignment_id)
    pose_template = (assignment or {}).get("pose_templates") or {}
    expected_pose_class: str | None = pose_template.get("pose_class") or None

    # Create session record immediately so we have an ID for storage path
    session = await create_session(assignment_id=assignment_id, patient_id=patient_id)
    session_id = session["id"]

    try:
        frame_analyses, duration = _analyze_video(tmp_path, expected_pose_class)
        video_path = await upload_video(contents, patient_id, file.filename or f"{uuid.uuid4()}.mp4")

        total_frames = len(frame_analyses)
        correct_frames = sum(1 for f in frame_analyses if f["is_correct"])
        overall_correctness = correct_frames / total_frames if total_frames > 0 else 0.0

        session = await update_session(
            session_id,
            video_url=None,
            video_path=video_path,
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

        return session
    except Exception as exc:
        await update_session(session_id, processed=True, processing_error=str(exc))
        raise
    finally:
        os.unlink(tmp_path)


def _analyze_video(path: str, expected_pose_class: str | None) -> tuple[list, float]:
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_analyses = []
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
                # A frame is correct only when the classifier predicts the right
                # pose AND is confident enough.  Checking score alone inflates
                # accuracy whenever the model confidently predicts the wrong pose.
                is_correct = (
                    score >= settings.CORRECTNESS_THRESHOLD
                    and (expected_pose_class is None or label == expected_pose_class)
                )
                frame_analyses.append({
                    "frame": frame_idx,
                    "label": label,
                    "score": score,
                    "is_correct": is_correct,
                    "ts": round(frame_idx / fps, 3),
                })
        frame_idx += 1

    cap.release()
    duration = total_frame_count / fps if fps > 0 else 0.0
    return frame_analyses, duration
