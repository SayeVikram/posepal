"""
Pairing API  —  /api/pairing

Module 1 · Secure Pairing
  POST /generate        (therapist) Generate a one-time 6-char pairing code
  GET  /codes           (therapist) List own active (unused, unexpired) codes

Module 2 · Autonomous Unpairing
  POST /submit          (patient)   Submit a code to pair with a therapist
  GET  /relationships   (patient)   List own relationships with status
  POST /unpair          (patient)   Revoke a therapist relationship

All write operations are atomic via PostgreSQL stored procedures.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.models.schemas import (
    PairingCodeResponse,
    RelationshipResponse,
    SubmitCodeRequest,
    UnpairRequest,
)
from app.utils.auth import require_role
from app.utils.pairing_codes import generate_pairing_code, hash_submitted_code
from app.utils.supabase_db import (
    consume_pairing_code_rpc,
    get_active_codes_for_therapist,
    get_patient_relationships,
    get_user_by_id,
    revoke_relationship_rpc,
    store_pairing_code,
)

router = APIRouter()

_CODE_TTL_HOURS = 24


def _client_ip(request: Request) -> str:
    """
    Extract the real client IP respecting common reverse-proxy headers.
    Falls back to the direct connection address.
    """
    for header in ("X-Forwarded-For", "X-Real-IP", "CF-Connecting-IP"):
        value = request.headers.get(header)
        if value:
            return value.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ---------------------------------------------------------------------------
# MODULE 1 — Therapist: generate a pairing code
# ---------------------------------------------------------------------------

@router.post("/generate", response_model=PairingCodeResponse, status_code=status.HTTP_201_CREATED)
async def generate_code(user=Depends(require_role("therapist"))):
    """
    Generate a cryptographically random 6-character pairing code.

    * The raw code is returned exactly once — it is NOT stored.
    * Only the HMAC-SHA256 hash is persisted in ``pairing_codes``.
    * The code expires automatically after 24 hours and is single-use.

    Collision safety: the UNIQUE partial index on ``code_hash WHERE is_used = FALSE``
    guarantees that no two live codes share the same hash.  In the astronomically
    unlikely event of a hash collision the INSERT will fail — the caller can retry.
    """
    raw_code, code_hash = generate_pairing_code()
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=_CODE_TTL_HOURS)).isoformat()

    try:
        await store_pairing_code(
            therapist_id=user["id"],
            code_hash=code_hash,
            expires_at=expires_at,
        )
    except Exception:
        # Extremely rare hash collision — tell the client to retry
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Code collision — please try again.",
        )

    return PairingCodeResponse(code=raw_code, expires_at=expires_at)


@router.get("/codes")
async def list_active_codes(user=Depends(require_role("therapist"))):
    """
    List the therapist's currently active (unused, unexpired) codes.
    Raw codes are never returned — only metadata (id, created_at, expires_at).
    """
    return await get_active_codes_for_therapist(user["id"])


# ---------------------------------------------------------------------------
# MODULE 1 + 2 — Patient: submit a code to establish a relationship
# ---------------------------------------------------------------------------

@router.post("/submit", response_model=RelationshipResponse, status_code=status.HTTP_201_CREATED)
async def submit_code(
    body: SubmitCodeRequest,
    request: Request,
    user=Depends(require_role("patient")),
):
    """
    Patient submits the code given to them by their therapist.

    The atomic ``consume_pairing_code`` SQL function:
      1. Locks the matching code row (FOR UPDATE SKIP LOCKED)
      2. Verifies it hasn't expired or been used
      3. Voids it (single-use)
      4. Creates / reactivates the relationship record
      5. Writes a PAIRED audit log entry

    Two concurrent submissions of the same code cannot both succeed —
    the second will see the row already locked or used.
    """
    code_hash = hash_submitted_code(body.code)
    ip = _client_ip(request)

    result = await consume_pairing_code_rpc(
        code_hash=code_hash,
        patient_id=user["id"],
        patient_supabase_uid=user.get("supabase_uid", ""),
        ip_address=ip,
    )

    if not result.get("success"):
        error = result.get("error", "unknown_error")
        if error == "invalid_or_expired_code":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired pairing code.",
            )
        if error == "cannot_pair_with_self":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot pair with yourself.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Pairing failed: {error}",
        )

    # Hydrate the relationship with therapist info for the response
    therapist_id = result.get("therapist_id")
    therapist = await get_user_by_id(therapist_id) if therapist_id else None

    return RelationshipResponse(
        id=result["relationship_id"],
        therapist_id=therapist_id,
        patient_id=user["id"],
        status="ACTIVE",
        therapist=therapist,
    )


# ---------------------------------------------------------------------------
# MODULE 2 — Patient: list & revoke relationships
# ---------------------------------------------------------------------------

@router.get("/relationships")
async def list_relationships(user=Depends(require_role("patient"))):
    """
    List all relationships for the authenticated patient, including revoked ones.
    Each entry includes the therapist's public profile.
    """
    rels = await get_patient_relationships(user["id"])

    # Hydrate with therapist info
    hydrated: list[dict] = []
    for rel in rels:
        therapist = await get_user_by_id(rel["therapist_id"])
        hydrated.append({**rel, "therapist": therapist})
    return hydrated


@router.post("/unpair", status_code=status.HTTP_200_OK)
async def unpair(
    body: UnpairRequest,
    request: Request,
    user=Depends(require_role("patient")),
):
    """
    Patient autonomously revokes a therapist relationship.

    The atomic ``revoke_relationship`` SQL function:
      1. Locks the active relationship row
      2. Sets status → REVOKED  (therapist access terminated immediately)
      3. Inserts an immutable record into ``audit_archive``
         (data retained for medical record compliance — never deleted)
      4. Writes an UNPAIRED audit log entry

    The patient's sessions and assignments are NOT deleted; only the
    therapist's ability to access them is revoked.
    """
    ip = _client_ip(request)

    result = await revoke_relationship_rpc(
        patient_id=user["id"],
        patient_supabase_uid=user.get("supabase_uid", ""),
        ip_address=ip,
        relationship_id=body.relationship_id,
    )

    if not result.get("success"):
        error = result.get("error", "unknown_error")
        if error == "no_active_relationship":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active relationship found with that ID.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unpair failed: {error}",
        )

    return {"success": True, "message": "Relationship revoked. Therapist access terminated."}
