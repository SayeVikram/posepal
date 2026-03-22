"""
Session video processor.

The frontend sends a JSON array of per-frame accuracy samples collected by the
live TF.js model during recording.  Each sample is:

    { "ts": <float seconds>, "score": <float 0-1> }

where `score` is the model's softmax probability for the assigned pose class —
exactly what the live ring displays to the patient.  We store this array
directly and derive all statistics from it.  There is no server-side
re-classification; the frontend model is the single source of truth.
"""

import json
import os
import tempfile
import uuid
from datetime import datetime, timezone

import cv2
from fastapi import UploadFile

from app.config import settings
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
    frame_analyses_json: str | None = None,
) -> dict:
    # Diagnostic: confirm this is the new code path (no YOLO)
    print(
        f"[video_processor] process_session_video called | "
        f"patient={patient_id} assignment={assignment_id} | "
        f"frame_analyses_json={'<empty>' if not frame_analyses_json else f'{len(frame_analyses_json)} chars'}"
    )
    contents = await file.read()

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    session = await create_session(assignment_id=assignment_id, patient_id=patient_id)
    session_id = session["id"]

    try:
        # ------------------------------------------------------------------
        # Parse per-frame samples sent by the frontend TF.js model.
        # Each entry: { ts: float, score: float }
        # ------------------------------------------------------------------
        frame_analyses: list[dict] = []
        if frame_analyses_json:
            parsed = json.loads(frame_analyses_json)
            if isinstance(parsed, list):
                for item in parsed:
                    ts = float(item.get("ts", 0))
                    score = float(item.get("score", 0))
                    frame_analyses.append({
                        "ts": round(ts, 3),
                        "score": round(score, 4),
                        "is_correct": score >= settings.CORRECTNESS_THRESHOLD,
                    })

        print(
            f"[video_processor] Parsed {len(frame_analyses)} frame samples. "
            + (
                f"First: {frame_analyses[0]} | Last: {frame_analyses[-1]}"
                if frame_analyses
                else "No samples received — frontend may not have sent any."
            )
        )

        # Get video duration (fast — no frame decoding).
        duration = _get_video_duration(tmp_path)

        video_path = await upload_video(
            contents, patient_id, file.filename or f"{uuid.uuid4()}.mp4"
        )

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

        await _check_and_auto_complete(assignment_id)

        return session

    except Exception as exc:
        await update_session(session_id, processed=True, processing_error=str(exc))
        raise
    finally:
        os.unlink(tmp_path)


async def recheck_assignment_after_session_delete(assignment_id: int) -> None:
    """After a session is deleted, revert a completed assignment to pending if day count drops below required."""
    assignment = await get_assignment(assignment_id)
    if not assignment or assignment.get("status") != "completed":
        return

    required_days = assignment.get("required_days")
    if not required_days:
        return  # No day requirement; manual completion — leave it alone

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
                qualifying_dates.add(recorded_at[:10])

    if len(qualifying_dates) < required_days:
        await update_assignment(assignment_id, status="pending")


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


def _get_video_duration(path: str) -> float:
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
    cap.release()
    return frame_count / fps if fps > 0 else 0.0
