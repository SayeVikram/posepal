from app.utils.supabase_client import get_client


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

async def get_user_by_supabase_uid(supabase_uid: str) -> dict | None:
    sb = get_client()
    res = sb.table("users").select("*").eq("supabase_uid", supabase_uid).maybe_single().execute()
    return res.data if res else None


async def get_user_by_id(user_id: int) -> dict | None:
    sb = get_client()
    res = sb.table("users").select("*").eq("id", user_id).maybe_single().execute()
    return res.data if res else None


async def upsert_user_from_jwt(
    supabase_uid: str,
    email: str,
    name: str,
    role: str,
) -> dict:
    """
    Called when no row exists for the given supabase_uid.
    Tries to find an existing row by email first (handles manually-created
    demo accounts), updates it with the UID, or inserts a fresh row.
    """
    sb = get_client()

    # 1. Try to find existing row by email
    res = sb.table("users").select("*").eq("email", email).maybe_single().execute()
    existing = res.data if res else None

    if existing:
        if not existing.get("supabase_uid"):
            update_res = (
                sb.table("users")
                .update({"supabase_uid": supabase_uid})
                .eq("id", existing["id"])
                .execute()
            )
            return update_res.data[0] if update_res.data else existing
        return existing

    # 2. No row at all — insert one
    insert_res = sb.table("users").insert({
        "supabase_uid": supabase_uid,
        "email": email,
        "name": name,
        "role": role,
    }).execute()
    return insert_res.data[0] if insert_res.data else {}


async def get_all_patients() -> list[dict]:
    sb = get_client()
    res = sb.table("users").select("*").eq("role", "patient").execute()
    return res.data or []


async def get_therapist_patients(therapist_id: int) -> list[dict]:
    """Return distinct patients who have at least one assignment from this therapist."""
    sb = get_client()
    # Step 1: get distinct patient_ids from assignments
    res = (
        sb.table("assignments")
        .select("patient_id")
        .eq("therapist_id", therapist_id)
        .execute()
    )
    patient_ids = list({row["patient_id"] for row in (res.data or [])})
    if not patient_ids:
        return []

    # Step 2: fetch the actual user rows
    users_res = sb.table("users").select("*").in_("id", patient_ids).execute()
    return users_res.data or []


# ---------------------------------------------------------------------------
# Pose templates
# ---------------------------------------------------------------------------

async def create_pose_template(
    therapist_id: int,
    name: str,
    pose_class: str,
    instructions: str,
    reference_image_url: str | None,
    reference_video_url: str | None,
) -> dict:
    sb = get_client()
    res = sb.table("pose_templates").insert({
        "therapist_id": therapist_id,
        "name": name,
        "pose_class": pose_class,
        "instructions": instructions,
        "reference_image_url": reference_image_url,
        "reference_video_url": reference_video_url,
    }).execute()
    return res.data[0] if res.data else {}


async def get_therapist_pose_templates(therapist_id: int) -> list[dict]:
    sb = get_client()
    res = (
        sb.table("pose_templates")
        .select("*")
        .eq("therapist_id", therapist_id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


# ---------------------------------------------------------------------------
# Assignments
# ---------------------------------------------------------------------------

async def create_assignment(
    therapist_id: int,
    patient_id: int,
    pose_template_id: int,
    due_date: str | None,
    notes: str | None,
) -> dict:
    sb = get_client()
    res = sb.table("assignments").insert({
        "therapist_id": therapist_id,
        "patient_id": patient_id,
        "pose_template_id": pose_template_id,
        "due_date": due_date,
        "notes": notes,
    }).execute()
    return res.data[0] if res.data else {}


async def get_user_assignments(patient_id: int) -> list[dict]:
    sb = get_client()
    res = (
        sb.table("assignments")
        .select("*, pose_templates(*)")
        .eq("patient_id", patient_id)
        .order("assigned_at", desc=True)
        .execute()
    )
    return res.data or []


async def get_assignment(assignment_id: int) -> dict | None:
    sb = get_client()
    res = (
        sb.table("assignments")
        .select("*, pose_templates(*)")
        .eq("id", assignment_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

async def create_session(assignment_id: int, patient_id: int) -> dict:
    sb = get_client()
    res = sb.table("sessions").insert({
        "assignment_id": assignment_id,
        "patient_id": patient_id,
        "processed": False,
    }).execute()
    return res.data[0] if res.data else {}


async def update_session(session_id: int, **fields) -> dict:
    sb = get_client()
    res = sb.table("sessions").update(fields).eq("id", session_id).execute()
    return res.data[0] if res.data else {}


async def get_session(session_id: int) -> dict | None:
    sb = get_client()
    res = (
        sb.table("sessions")
        .select("*, assignments(pose_templates(name))")
        .eq("id", session_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


async def get_patient_sessions(patient_id: int) -> list[dict]:
    sb = get_client()
    res = (
        sb.table("sessions")
        .select("*, assignments(pose_templates(name))")
        .eq("patient_id", patient_id)
        .order("recorded_at", desc=True)
        .execute()
    )
    return res.data or []


async def get_user_sessions(patient_id: int) -> list[dict]:
    return await get_patient_sessions(patient_id)


# ---------------------------------------------------------------------------
# Session analyses
# ---------------------------------------------------------------------------

async def create_session_analysis(
    session_id: int,
    overall_correctness: float,
    total_frames: int,
    correct_frames: int,
    areas_of_concern: list | None,
    timeline: list | None,
    frame_analyses: list | None,
) -> dict:
    sb = get_client()
    res = sb.table("session_analyses").insert({
        "session_id": session_id,
        "overall_correctness": overall_correctness,
        "total_frames": total_frames,
        "correct_frames": correct_frames,
        "areas_of_concern": areas_of_concern,
        "timeline": timeline,
        "frame_analyses": frame_analyses,
        "snippets_generated": False,
    }).execute()
    return res.data[0] if res.data else {}


async def get_session_analysis(session_id: int) -> dict | None:
    sb = get_client()
    res = (
        sb.table("session_analyses")
        .select("*")
        .eq("session_id", session_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


# ---------------------------------------------------------------------------
# Feedbacks
# ---------------------------------------------------------------------------

async def create_feedback(session_id: int, therapist_id: int, content: str) -> dict:
    sb = get_client()
    res = sb.table("feedbacks").insert({
        "session_id": session_id,
        "therapist_id": therapist_id,
        "content": content,
    }).execute()
    return res.data[0] if res.data else {}


async def get_session_feedbacks(session_id: int) -> list[dict]:
    sb = get_client()
    res = (
        sb.table("feedbacks")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


async def mark_feedbacks_reviewed(session_id: int) -> None:
    sb = get_client()
    sb.table("feedbacks").update({"is_reviewed": True}).eq("session_id", session_id).execute()
