-- Top Realty Intern Attendance System
-- Migration: 0_init_constraints
--
-- Raw PostgreSQL constraints and indexes that Prisma cannot express directly.
-- Review together with prisma/schema.prisma before applying to any environment.
-- Requirements: PostgreSQL (btree_gist extension, availability depends on provider).

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ---------------------------------------------------------------------------
-- One active internship per intern
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS internship_one_active_per_intern
  ON "internship" ("intern_user_id")
  WHERE "status" = 'ACTIVE';

-- ---------------------------------------------------------------------------
-- One unclosed work interval per internship (IN present, OUT absent, OPEN or REVIEW)
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS attendance_session_one_unclosed_per_internship
  ON "attendance_session" ("internship_id")
  WHERE "effective_time_in_utc" IS NOT NULL
    AND "effective_time_out_utc" IS NULL
    AND "status" IN ('OPEN', 'REVIEW');

-- ---------------------------------------------------------------------------
-- Valid completed interval
-- ---------------------------------------------------------------------------

ALTER TABLE "attendance_session"
  ADD CONSTRAINT attendance_session_complete_requires_times
  CHECK (
    "status" <> 'COMPLETE'
    OR ("effective_time_in_utc" IS NOT NULL AND "effective_time_out_utc" IS NOT NULL)
  );

ALTER TABLE "attendance_session"
  ADD CONSTRAINT attendance_session_time_out_after_time_in
  CHECK (
    "effective_time_in_utc" IS NULL
    OR "effective_time_out_utc" IS NULL
    OR "effective_time_out_utc" > "effective_time_in_utc"
  );

-- ---------------------------------------------------------------------------
-- No overlapping work intervals
-- Half-open range ['[)', so adjacent intervals may touch. Excludes VOID and
-- unbounded rows (missing IN or OUT).
-- ---------------------------------------------------------------------------

ALTER TABLE "attendance_session"
  ADD CONSTRAINT attendance_session_no_overlap
  EXCLUDE USING gist (
    "internship_id" WITH =,
    tsrange("effective_time_in_utc", "effective_time_out_utc", '[)') WITH &&
  )
  WHERE (
    "status" <> 'VOID'
    AND "effective_time_in_utc" IS NOT NULL
    AND "effective_time_out_utc" IS NOT NULL
  );

-- ---------------------------------------------------------------------------
-- One accepted action per session (IN or OUT) on ACCEPTED scans with a session
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS attendance_scan_one_accepted_action_per_session
  ON "attendance_scan" ("session_id", "action_snapshot")
  WHERE "validation_status" = 'ACCEPTED'
    AND "session_id" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- One review of the current proposal
--   * existing-session requests: at most one open request per session
--   * missing-day requests: at most one open request per internship/local date
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS correction_request_one_open_per_session
  ON "correction_request" ("session_id")
  WHERE "status" IN ('PENDING', 'NEEDS_INFO')
    AND "session_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS correction_request_one_open_missing_day
  ON "correction_request" ("internship_id", "attendance_date")
  WHERE "status" IN ('PENDING', 'NEEDS_INFO')
    AND "session_id" IS NULL;

-- ---------------------------------------------------------------------------
-- Sanity checks
-- ---------------------------------------------------------------------------

ALTER TABLE "office"
  ADD CONSTRAINT office_geofence_radius_positive
  CHECK ("geofence_radius_meters" > 0);

ALTER TABLE "office"
  ADD CONSTRAINT office_max_accuracy_positive
  CHECK ("max_accuracy_meters" > 0);

ALTER TABLE "internship"
  ADD CONSTRAINT internship_required_minutes_positive
  CHECK ("required_minutes" > 0);

ALTER TABLE "internship"
  ADD CONSTRAINT internship_date_range
  CHECK ("end_date" IS NULL OR "end_date" >= "start_date");

ALTER TABLE "review_job"
  ADD CONSTRAINT review_job_attempts_nonnegative
  CHECK ("attempts" >= 0);

-- ---------------------------------------------------------------------------
-- Notes on invariants enforced by the Prisma schema itself (not repeated here):
--   * One final result per scan key: UNIQUE (actor_id, request_key) on scan_receipt.
--   * One application of an approval: UNIQUE (review_id) on attendance_revision.
--   * Unique AI work identity: UNIQUE on jev_assessment and review_job over
--     (correction_request_id, input_fingerprint, model_version, criteria_version).
--   * Attendance parent deletion uses ON DELETE RESTRICT; accounts are disabled.
-- ---------------------------------------------------------------------------
