-- =============================================================================
-- 001_pairing_system.sql
-- Secure Pairing / Unpairing / Audit system
--
-- Run once in the Supabase SQL Editor (Settings → SQL Editor).
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE / ON CONFLICT.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE 1 · pairing_codes
--   Stores HMAC-SHA256 hashes of therapist-generated 6-char codes.
--   Raw codes are NEVER stored — only the hash.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pairing_codes (
    id           BIGSERIAL    PRIMARY KEY,
    therapist_id BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash    TEXT         NOT NULL,
    expires_at   TIMESTAMPTZ  NOT NULL,                       -- NOW() + 24 h
    is_used      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Partial index: only index un-used codes — the only ones ever looked up
CREATE UNIQUE INDEX IF NOT EXISTS idx_pairing_codes_hash_active
    ON pairing_codes (code_hash)
    WHERE is_used = FALSE;

CREATE INDEX IF NOT EXISTS idx_pairing_codes_therapist
    ON pairing_codes (therapist_id);

CREATE INDEX IF NOT EXISTS idx_pairing_codes_expiry
    ON pairing_codes (expires_at);

-- ---------------------------------------------------------------------------
-- TABLE 2 · therapist_patient_relationships
--   Explicit consent record for every therapist ↔ patient pair.
--   Status: 'ACTIVE' | 'REVOKED'
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapist_patient_relationships (
    id           BIGSERIAL    PRIMARY KEY,
    therapist_id BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id   BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status       TEXT         NOT NULL DEFAULT 'ACTIVE',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    revoked_at   TIMESTAMPTZ,
    CONSTRAINT uq_therapist_patient UNIQUE (therapist_id, patient_id)
);

CREATE INDEX IF NOT EXISTS idx_tpr_therapist ON therapist_patient_relationships (therapist_id);
CREATE INDEX IF NOT EXISTS idx_tpr_patient   ON therapist_patient_relationships (patient_id);
CREATE INDEX IF NOT EXISTS idx_tpr_status    ON therapist_patient_relationships (status);

-- ---------------------------------------------------------------------------
-- TABLE 3 · audit_archive
--   Immutable record of revoked relationships.
--   Data retention: never delete (medical record compliance).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_archive (
    id                       BIGSERIAL    PRIMARY KEY,
    original_relationship_id BIGINT       NOT NULL,
    therapist_id             BIGINT       NOT NULL,
    patient_id               BIGINT       NOT NULL,
    status                   TEXT         NOT NULL DEFAULT 'REVOKED',
    paired_at                TIMESTAMPTZ  NOT NULL,  -- when relationship was created
    revoked_at               TIMESTAMPTZ  NOT NULL,  -- when it was revoked
    archived_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- TABLE 4 · audit_logs
--   Append-only compliance log for every pairing / unpairing event.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id                     BIGSERIAL    PRIMARY KEY,
    logged_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    action_type            TEXT         NOT NULL,   -- 'PAIRED' | 'UNPAIRED'
    patient_id             BIGINT,
    therapist_id           BIGINT,
    patient_supabase_uid   TEXT,
    therapist_supabase_uid TEXT,
    ip_address             TEXT,
    metadata               JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action    ON audit_logs (action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_patient   ON audit_logs (patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_therapist ON audit_logs (therapist_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ts        ON audit_logs (logged_at DESC);

-- ---------------------------------------------------------------------------
-- FUNCTION · consume_pairing_code
--   Called when a patient submits a code.
--   Runs atomically (single transaction):
--     1. Acquires row-level lock on the matching code  ← race-condition guard
--     2. Validates expiry and single-use constraint
--     3. Voids the code (is_used = TRUE)
--     4. Creates / reactivates the relationship record
--     5. Writes audit log entry
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION consume_pairing_code(
    p_code_hash            TEXT,
    p_patient_id           BIGINT,
    p_patient_supabase_uid TEXT,
    p_ip_address           TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code_id         BIGINT;
    v_therapist_id    BIGINT;
    v_relationship_id BIGINT;
BEGIN
    -- Step 1: Lock matching row; SKIP LOCKED means a concurrent call
    --         won't block — it simply won't find the row and will return
    --         'invalid_or_expired_code', preventing double-consumption.
    SELECT id, therapist_id
    INTO   v_code_id, v_therapist_id
    FROM   pairing_codes
    WHERE  code_hash  = p_code_hash
      AND  is_used    = FALSE
      AND  expires_at > NOW()
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error',   'invalid_or_expired_code'
        );
    END IF;

    -- Step 2: Prevent self-pairing
    IF v_therapist_id = p_patient_id THEN
        RETURN json_build_object(
            'success', false,
            'error',   'cannot_pair_with_self'
        );
    END IF;

    -- Step 3: Void the code — single use
    UPDATE pairing_codes
    SET    is_used = TRUE
    WHERE  id = v_code_id;

    -- Step 4: Create or reactivate the relationship
    INSERT INTO therapist_patient_relationships
               (therapist_id, patient_id, status, created_at, revoked_at)
    VALUES     (v_therapist_id, p_patient_id, 'ACTIVE', NOW(), NULL)
    ON CONFLICT (therapist_id, patient_id)
    DO UPDATE SET status = 'ACTIVE', revoked_at = NULL
    RETURNING id INTO v_relationship_id;

    -- Step 5: Compliance audit log
    INSERT INTO audit_logs
               (action_type, patient_id, therapist_id, patient_supabase_uid, ip_address)
    VALUES     ('PAIRED', p_patient_id, v_therapist_id, p_patient_supabase_uid, p_ip_address);

    RETURN json_build_object(
        'success',         true,
        'relationship_id', v_relationship_id,
        'therapist_id',    v_therapist_id
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- FUNCTION · revoke_relationship
--   Called when a patient chooses to unregister from a therapist.
--   Runs atomically (single transaction):
--     1. Acquires row-level lock on the active relationship
--     2. Sets status → REVOKED
--     3. Inserts archive record (data never deleted)
--     4. Writes audit log entry
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION revoke_relationship(
    p_patient_id           BIGINT,
    p_patient_supabase_uid TEXT,
    p_ip_address           TEXT,
    p_relationship_id      BIGINT DEFAULT NULL  -- NULL = revoke the only active one
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rel RECORD;
BEGIN
    -- Step 1: Lock the target relationship row
    SELECT id, therapist_id, patient_id, status, created_at
    INTO   v_rel
    FROM   therapist_patient_relationships
    WHERE  patient_id = p_patient_id
      AND  status     = 'ACTIVE'
      AND  (p_relationship_id IS NULL OR id = p_relationship_id)
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error',   'no_active_relationship'
        );
    END IF;

    -- Step 2: Mark REVOKED — therapist loses access immediately
    UPDATE therapist_patient_relationships
    SET    status     = 'REVOKED',
           revoked_at = NOW()
    WHERE  id = v_rel.id;

    -- Step 3: Archive (medical record retention — do NOT delete)
    INSERT INTO audit_archive
               (original_relationship_id, therapist_id, patient_id,
                status, paired_at, revoked_at)
    VALUES     (v_rel.id, v_rel.therapist_id, v_rel.patient_id,
                'REVOKED', v_rel.created_at, NOW());

    -- Step 4: Compliance audit log
    INSERT INTO audit_logs
               (action_type, patient_id, therapist_id, patient_supabase_uid, ip_address)
    VALUES     ('UNPAIRED', v_rel.patient_id, v_rel.therapist_id,
                p_patient_supabase_uid, p_ip_address);

    RETURN json_build_object(
        'success',      true,
        'therapist_id', v_rel.therapist_id
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- BACK-FILL: create ACTIVE relationship records for all existing
--   therapist-patient pairs derived from the assignments table.
--   This ensures existing data is governed by the new access-control layer.
-- ---------------------------------------------------------------------------
INSERT INTO therapist_patient_relationships
           (therapist_id, patient_id, status, created_at)
SELECT DISTINCT
    a.therapist_id,
    a.patient_id,
    'ACTIVE',
    MIN(a.assigned_at)
FROM   assignments a
GROUP BY a.therapist_id, a.patient_id
ON CONFLICT (therapist_id, patient_id) DO NOTHING;
