from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.models.schemas import (
    AddPatientRequest,
    AssignmentCreate,
    AssignmentUpdate,
    FeedbackCreate,
    PoseTemplateCreate,
)
from app.utils.auth import require_role
from app.utils.supabase_storage import upload_demo_media
from app.utils.supabase_db import (
    create_assignment,
    create_feedback,
    create_pose_template,
    delete_assignment,
    get_all_patients,
    get_assignment,
    get_patient_sessions,
    get_session,
    get_session_analysis,
    get_therapist_patient_assignments,
    get_therapist_patients,
    get_therapist_pose_templates,
    mark_feedbacks_reviewed,
    update_assignment,
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
        required_days=body.required_days,
        max_sessions_per_day=body.max_sessions_per_day,
        demo_video_url=body.demo_video_url,
        demo_image_url=body.demo_image_url,
    )


@router.post("/assignment/{assignment_id}/upload-demo")
async def upload_assignment_demo(
    assignment_id: int,
    file: UploadFile = File(...),
    user=Depends(require_role("therapist")),
):
    assignment = await get_assignment(assignment_id)
    if not assignment or assignment.get("therapist_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    data = await file.read()
    url = await upload_demo_media(data, assignment_id, file.filename or "demo", file.content_type or "application/octet-stream")
    content_type = file.content_type or ""
    field = "demo_video_url" if content_type.startswith("video/") else "demo_image_url"
    updated = await update_assignment(assignment_id, **{field: url})
    return {"url": url, "type": "video" if field == "demo_video_url" else "image", "assignment": updated}


@router.get("/patient/{patient_id}/assignments")
async def patient_assignments(patient_id: int, user=Depends(require_role("therapist"))):
    return await get_therapist_patient_assignments(user["id"], patient_id)


@router.delete("/assignment/{assignment_id}")
async def delete_assignment_endpoint(
    assignment_id: int,
    user=Depends(require_role("therapist")),
):
    assignment = await get_assignment(assignment_id)
    if not assignment or assignment.get("therapist_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    deleted = await delete_assignment(assignment_id, user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"deleted": True}


@router.patch("/assignment/{assignment_id}")
async def update_assignment_endpoint(
    assignment_id: int,
    body: AssignmentUpdate,
    user=Depends(require_role("therapist")),
):
    assignment = await get_assignment(assignment_id)
    if not assignment or assignment.get("therapist_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        return assignment
    return await update_assignment(assignment_id, **fields)


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
