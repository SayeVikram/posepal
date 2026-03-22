from pydantic import BaseModel, EmailStr
from typing import Any


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "patient"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str  # supabase_uid (UUID string)


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

class UserProfile(BaseModel):
    id: int
    supabase_uid: str | None = None
    email: str
    name: str
    role: str
    avatar: str | None = None
    created_at: str | None = None


# ---------------------------------------------------------------------------
# Pose templates
# ---------------------------------------------------------------------------

class PoseTemplateCreate(BaseModel):
    name: str
    pose_class: str
    instructions: str
    reference_image_url: str | None = None
    reference_video_url: str | None = None


class PoseTemplateResponse(BaseModel):
    id: int
    therapist_id: int
    name: str
    pose_class: str
    instructions: str
    reference_image_url: str | None = None
    reference_video_url: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


# ---------------------------------------------------------------------------
# Assignments
# ---------------------------------------------------------------------------

class AssignmentCreate(BaseModel):
    patient_id: int
    pose_template_id: int
    due_date: str | None = None
    notes: str | None = None
    required_days: int | None = None
    max_sessions_per_day: int | None = None
    demo_video_url: str | None = None
    demo_image_url: str | None = None


class AssignmentUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None
    due_date: str | None = None
    required_days: int | None = None
    max_sessions_per_day: int | None = None
    demo_video_url: str | None = None
    demo_image_url: str | None = None


class AssignmentResponse(BaseModel):
    id: int
    therapist_id: int
    patient_id: int
    pose_template_id: int
    assigned_at: str | None = None
    due_date: str | None = None
    status: str | None = None
    notes: str | None = None
    required_days: int | None = None
    max_sessions_per_day: int | None = None
    demo_video_url: str | None = None
    demo_image_url: str | None = None
    pose_templates: dict | None = None  # joined pose template row


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------

class ProfileUpdate(BaseModel):
    name: str | None = None


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

class SessionResult(BaseModel):
    id: int
    assignment_id: int
    patient_id: int
    video_path: str | None = None
    video_url: str | None = None
    recorded_at: str | None = None
    processed: bool = False
    processing_error: str | None = None
    duration_seconds: float | None = None


class SessionStatus(BaseModel):
    id: int
    processed: bool
    processing_error: str | None = None


# ---------------------------------------------------------------------------
# Session analyses
# ---------------------------------------------------------------------------

class SessionAnalysis(BaseModel):
    id: int
    session_id: int
    overall_correctness: float
    total_frames: int
    correct_frames: int
    areas_of_concern: list[Any] | None = None
    timeline: list[Any] | None = None
    frame_analyses: list[Any] | None = None
    snippets_generated: bool = False
    created_at: str | None = None


# ---------------------------------------------------------------------------
# Feedbacks
# ---------------------------------------------------------------------------

class FeedbackCreate(BaseModel):
    content: str


class FeedbackResponse(BaseModel):
    id: int
    session_id: int
    therapist_id: int
    content: str
    is_reviewed: bool = False
    created_at: str | None = None


# ---------------------------------------------------------------------------
# Patient management
# ---------------------------------------------------------------------------

class AddPatientRequest(BaseModel):
    patient_id: int


# ---------------------------------------------------------------------------
# Realtime pose detection
# ---------------------------------------------------------------------------

class DetectPoseRequest(BaseModel):
    image: str  # base64-encoded image bytes
    expected_pose: str | None = None


class DetectPoseResponse(BaseModel):
    pose: str | None
    confidence: float | None
    is_correct: bool | None = None
    keypoints: list[float] | None = None
