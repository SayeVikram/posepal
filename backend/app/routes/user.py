import base64

import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.models.schemas import (
    AssignmentResponse,
    DetectPoseRequest,
    DetectPoseResponse,
    SessionResult,
    SessionStatus,
)
from app.services.video_processor import process_session_video
from app.utils.auth import get_db_user
from app.utils.supabase_db import (
    get_assignment,
    get_session,
    get_session_analysis,
    get_session_feedbacks,
    get_user_assignments,
    get_user_sessions,
)

router = APIRouter()


@router.post("/detect-pose", response_model=DetectPoseResponse)
async def detect_pose(body: DetectPoseRequest, user=Depends(get_db_user)):
    try:
        from app.services.pose_analyzer import classify_pose, extract_keypoints

        img_bytes = base64.b64decode(body.image)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            raise HTTPException(status_code=400, detail="Invalid image data")

        kp = extract_keypoints(frame)
        if kp is None:
            return DetectPoseResponse(pose=None, confidence=None, keypoints=None)

        label, confidence = classify_pose(kp)
        is_correct = None
        if body.expected_pose is not None:
            is_correct = label == body.expected_pose

        return DetectPoseResponse(
            pose=label,
            confidence=confidence,
            is_correct=is_correct,
            keypoints=kp.tolist(),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/assignments")
async def get_assignments(user=Depends(get_db_user)):
    return await get_user_assignments(user["id"])


@router.get("/assignments/{assignment_id}")
async def get_assignment_by_id(assignment_id: int, user=Depends(get_db_user)):
    assignment = await get_assignment(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return assignment


@router.post("/session")
async def upload_session(
    assignment_id: int = Form(...),
    video: UploadFile = File(...),
    user=Depends(get_db_user),
):
    return await process_session_video(video, user["id"], assignment_id)


@router.get("/sessions", response_model=list[SessionResult])
async def sessions(user=Depends(get_db_user)):
    return await get_user_sessions(user["id"])


@router.get("/session/{session_id}", response_model=SessionResult)
async def get_session_by_id(session_id: int, user=Depends(get_db_user)):
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/session/{session_id}/status", response_model=SessionStatus)
async def get_session_status(session_id: int, user=Depends(get_db_user)):
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "id": session["id"],
        "processed": session.get("processed", False),
        "processing_error": session.get("processing_error"),
    }


@router.get("/session/{session_id}/analysis")
async def get_session_analysis_route(session_id: int, user=Depends(get_db_user)):
    analysis = await get_session_analysis(session_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not available yet")
    return analysis


@router.get("/session/{session_id}/feedback")
async def get_session_feedback(session_id: int, user=Depends(get_db_user)):
    feedbacks = await get_session_feedbacks(session_id)
    return {"session_id": session_id, "feedbacks": feedbacks}
