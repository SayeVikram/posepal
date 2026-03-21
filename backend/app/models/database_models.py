"""
Mirrors the Supabase table structure for reference.
Actual tables live in Supabase; these are not SQLAlchemy models.
"""

# users
# -----
# id              bigserial   primary key
# supabase_uid    text        unique  (FK → auth.users.id)
# email           text        unique not null
# password_hash   text        not null default ''
# name            text        not null
# role            text        not null default 'patient'  ('patient' | 'therapist')
# avatar          text        nullable
# created_at      timestamptz not null default now()
# updated_at      timestamptz not null default now()

# pose_templates
# --------------
# id                  bigserial   primary key
# name                text        not null
# pose_class          text        not null
# instructions        text        not null
# reference_image_url text        nullable
# reference_video_url text        nullable
# therapist_id        bigint      not null  FK → users(id) on delete cascade
# created_at          timestamptz not null default now()
# updated_at          timestamptz not null default now()

# assignments
# -----------
# id                bigserial   primary key
# therapist_id      bigint      not null  FK → users(id) on delete cascade
# patient_id        bigint      not null  FK → users(id) on delete cascade
# pose_template_id  bigint      not null  FK → pose_templates(id) on delete cascade
# assigned_at       timestamptz not null default now()
# due_date          timestamptz nullable
# status            text        not null default 'pending'  ('pending' | 'completed' | 'overdue')
# notes             text        nullable

# sessions
# --------
# id                bigserial           primary key
# assignment_id     bigint      not null FK → assignments(id) on delete cascade
# patient_id        bigint      not null FK → users(id) on delete cascade
# video_path        text        nullable
# video_url         text        nullable
# recorded_at       timestamptz not null default now()
# processed         boolean     not null default false
# processing_error  text        nullable
# duration_seconds  double precision nullable

# session_analyses
# ----------------
# id                  bigserial   primary key
# session_id          bigint      not null unique FK → sessions(id) on delete cascade
# overall_correctness double precision not null
# total_frames        integer     not null
# correct_frames      integer     not null
# areas_of_concern    jsonb       nullable
# timeline            jsonb       nullable
# frame_analyses      jsonb       nullable
# snippets_generated  boolean     not null default false
# created_at          timestamptz not null default now()

# feedbacks
# ---------
# id            bigserial   primary key
# session_id    bigint      not null FK → sessions(id) on delete cascade
# therapist_id  bigint      not null FK → users(id) on delete cascade
# content       text        not null
# is_reviewed   boolean     not null default false
# created_at    timestamptz not null default now()
