from fastapi import APIRouter, Depends, HTTPException

from app.models.schemas import (
    AddPatientRequest,
    AssignmentCreate,
    FeedbackCreate,
    PoseTemplateCreate,
)
from app.utils.auth import require_role
from app.utils.supabase_db import (
    create_assignment,
    create_feedback,
    create_pose_template,
    get_all_patients,
    get_patient_sessions,
    get_session,
    get_session_analysis,
    get_therapist_patients,
    get_therapist_pose_templates,
    mark_feedbacks_reviewed,
)

router = APIRouter()


@router.post("/poses")
async def create_pose(body: PoseTemplateCreate, user=Depends(require_role("therapist"))):
    return await create_pose_template(
        therapist_id=user["id"],
        name=body.name,
        pose_class=body.pose_class,
        instructions=body.instructions,
        reference_image_url=body.reference_image_url,
        reference_video_url=body.reference_video_url,
    )


@router.get("/poses")
async def list_poses(user=Depends(require_role("therapist"))):
    return await get_therapist_pose_templates(user["id"])


@router.post("/assign")
async def assign_pose(body: AssignmentCreate, user=Depends(require_role("therapist"))):
    return await create_assignment(
        therapist_id=user["id"],
        patient_id=body.patient_id,
        pose_template_id=body.pose_template_id,
        due_date=body.due_date,
        notes=body.notes,
    )


@router.get("/patients")
async def patients(user=Depends(require_role("therapist"))):
    return await get_therapist_patients(user["id"])


@router.get("/all-patients")
async def all_patients(user=Depends(require_role("therapist"))):
    return await get_all_patients()


@router.post("/add-patient")
async def add_patient(body: AddPatientRequest, user=Depends(require_role("therapist"))):
    """
    Verifies the patient exists and returns them. The therapist-patient
    relationship is established implicitly through assignments.
    """
    from app.utils.supabase_db import get_user_by_id
    patient = await get_user_by_id(body.patient_id)
    if not patient or patient.get("role") != "patient":
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.get("/session/{session_id}", response_model=None)
async def get_session_detail(session_id: int, user=Depends(require_role("therapist"))):
    """Return session row (with fresh signed video URL) for therapist replay."""
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/sessions/{patient_id}")
async def patient_sessions(patient_id: int, user=Depends(require_role("therapist"))):
    return await get_patient_sessions(patient_id)


@router.get("/session/{session_id}/analysis")
async def session_analysis(session_id: int, user=Depends(require_role("therapist"))):
    analysis = await get_session_analysis(session_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return analysis


@router.post("/session/{session_id}/feedback")
async def session_feedback(
    session_id: int,
    body: FeedbackCreate,
    user=Depends(require_role("therapist")),
):
    return await create_feedback(session_id, user["id"], body.content)


@router.post("/session/{session_id}/mark-reviewed")
async def session_mark_reviewed(
    session_id: int,
    user=Depends(require_role("therapist")),
):
    await mark_feedbacks_reviewed(session_id)
    return {"session_id": session_id, "reviewed": True}
