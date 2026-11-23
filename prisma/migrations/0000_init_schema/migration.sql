-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('INTERN', 'HR');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "InternshipStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PolicyVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "CheckpointAction" AS ENUM ('TIME_IN', 'TIME_OUT');

-- CreateEnum
CREATE TYPE "AttendanceSessionStatus" AS ENUM ('OPEN', 'COMPLETE', 'REVIEW', 'VOID');

-- CreateEnum
CREATE TYPE "ScanValidationStatus" AS ENUM ('ACCEPTED', 'REJECTED', 'UNCERTAIN');

-- CreateEnum
CREATE TYPE "CorrectionReasonCategory" AS ENUM ('MISSED_CLOCK_IN', 'MISSED_CLOCK_OUT', 'WRONG_ACTION', 'TECHNICAL_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "CorrectionRequestStatus" AS ENUM ('PENDING', 'NEEDS_INFO', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "HrDecision" AS ENUM ('APPROVE', 'REJECT', 'NEEDS_INFO');

-- CreateEnum
CREATE TYPE "JevRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ReviewJobState" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'MANUAL_REVIEW');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'INTERN',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "setup_link_sent_at_utc" TIMESTAMP(3),
    "last_sign_in_at_utc" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" UUID NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" UUID NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deactivated_at_utc" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "office" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "geofence_radius_meters" INTEGER NOT NULL,
    "max_accuracy_meters" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "config_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internship" (
    "id" UUID NOT NULL,
    "intern_user_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "required_minutes" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "status" "InternshipStatus" NOT NULL DEFAULT 'ACTIVE',
    "attendance_version" INTEGER NOT NULL DEFAULT 1,
    "provision_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internship_assignment" (
    "id" UUID NOT NULL,
    "internship_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "effective_from_date" DATE NOT NULL,
    "effective_to_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internship_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_policy_version" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PolicyVersionStatus" NOT NULL DEFAULT 'PUBLISHED',
    "copied_from_version" INTEGER,
    "schedule_rules" JSONB NOT NULL,
    "break_rules" JSONB NOT NULL,
    "credit_rules" JSONB NOT NULL,
    "effective_from_utc" TIMESTAMP(3) NOT NULL,
    "published_at_utc" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_policy_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_checkpoint" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "action" "CheckpointAction" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "credential_version" INTEGER NOT NULL DEFAULT 1,
    "credential_expires_at_utc" TIMESTAMP(3),
    "revoked_at_utc" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qr_checkpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_session" (
    "id" UUID NOT NULL,
    "internship_id" UUID NOT NULL,
    "policy_version_id" UUID NOT NULL,
    "attendance_date" DATE NOT NULL,
    "effective_time_in_utc" TIMESTAMP(3),
    "effective_time_out_utc" TIMESTAMP(3),
    "status" "AttendanceSessionStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "timezone_snapshot" TEXT NOT NULL,
    "department_id_snapshot" UUID NOT NULL,
    "correction_requested_at_utc" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_scan" (
    "id" UUID NOT NULL,
    "internship_id" UUID NOT NULL,
    "checkpoint_id" UUID NOT NULL,
    "session_id" UUID,
    "received_at_utc" TIMESTAMP(3) NOT NULL,
    "location_evidence" JSONB NOT NULL,
    "validation_status" "ScanValidationStatus" NOT NULL,
    "validation_flags" JSONB NOT NULL,
    "receipt_id" UUID,
    "action_snapshot" "CheckpointAction" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correction_request" (
    "id" UUID NOT NULL,
    "internship_id" UUID NOT NULL,
    "session_id" UUID,
    "base_session_version" INTEGER,
    "request_version" INTEGER NOT NULL DEFAULT 1,
    "client_request_id" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "attendance_date" DATE NOT NULL,
    "proposed_time_in_utc" TIMESTAMP(3),
    "proposed_time_out_utc" TIMESTAMP(3),
    "reason_category" "CorrectionReasonCategory" NOT NULL DEFAULT 'OTHER',
    "reason" TEXT NOT NULL,
    "status" "CorrectionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "previous_request_id" UUID,
    "submitted_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "correction_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_review" (
    "id" UUID NOT NULL,
    "correction_request_id" UUID NOT NULL,
    "reviewer_user_id" UUID NOT NULL,
    "operation_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "decision" "HrDecision" NOT NULL,
    "note" TEXT,
    "reviewed_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correction_comment" (
    "id" UUID NOT NULL,
    "correction_request_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "created_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correction_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_revision" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "before_values" JSONB NOT NULL,
    "after_values" JSONB NOT NULL,
    "applied_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jev_assessment" (
    "id" UUID NOT NULL,
    "correction_request_id" UUID NOT NULL,
    "request_version" INTEGER NOT NULL,
    "model_version" TEXT NOT NULL,
    "criteria_version" TEXT NOT NULL,
    "input_fingerprint" TEXT NOT NULL,
    "input_snapshot" JSONB NOT NULL,
    "typed_results" JSONB,
    "run_status" "JevRunStatus" NOT NULL DEFAULT 'PENDING',
    "evaluated_at_utc" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jev_assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_intent" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "internship_id" UUID NOT NULL,
    "checkpoint_id" UUID NOT NULL,
    "action_snapshot" "CheckpointAction" NOT NULL,
    "credential_version" INTEGER NOT NULL,
    "expected_attendance_version" INTEGER NOT NULL,
    "expected_session_id" UUID,
    "expected_session_version" INTEGER,
    "issued_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at_utc" TIMESTAMP(3) NOT NULL,
    "consumed_receipt_id" UUID,

    CONSTRAINT "scan_intent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_receipt" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "request_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "received_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "http_status" INTEGER NOT NULL,
    "decision_code" TEXT NOT NULL,
    "result_snapshot" JSONB NOT NULL,

    CONSTRAINT "scan_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_job" (
    "id" UUID NOT NULL,
    "correction_request_id" UUID NOT NULL,
    "input_fingerprint" TEXT NOT NULL,
    "model_version" TEXT NOT NULL,
    "criteria_version" TEXT NOT NULL,
    "state" "ReviewJobState" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_run_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_token" TEXT,
    "lease_expires_at_utc" TIMESTAMP(3),
    "last_error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "before_values" JSONB,
    "after_values" JSONB,
    "occurred_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlation_id" TEXT NOT NULL,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- CreateIndex
CREATE INDEX "account_user_id_idx" ON "account"("user_id");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "department_name_key" ON "department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "internship_provision_key_key" ON "internship"("provision_key");

-- CreateIndex
CREATE INDEX "internship_department_id_idx" ON "internship"("department_id");

-- CreateIndex
CREATE INDEX "internship_office_id_idx" ON "internship"("office_id");

-- CreateIndex
CREATE INDEX "internship_assignment_internship_id_effective_from_date_idx" ON "internship_assignment"("internship_id", "effective_from_date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_policy_version_office_id_version_key" ON "attendance_policy_version"("office_id", "version");

-- CreateIndex
CREATE INDEX "attendance_session_internship_id_attendance_date_status_idx" ON "attendance_session"("internship_id", "attendance_date", "status");

-- CreateIndex
CREATE INDEX "attendance_scan_internship_id_received_at_utc_idx" ON "attendance_scan"("internship_id", "received_at_utc");

-- CreateIndex
CREATE INDEX "correction_request_status_submitted_at_utc_id_idx" ON "correction_request"("status", "submitted_at_utc", "id");

-- CreateIndex
CREATE UNIQUE INDEX "correction_request_internship_id_client_request_id_key" ON "correction_request"("internship_id", "client_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_review_operation_key_key" ON "hr_review"("operation_key");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_revision_review_id_key" ON "attendance_revision"("review_id");

-- CreateIndex
CREATE UNIQUE INDEX "jev_assessment_correction_request_id_request_version_input__key" ON "jev_assessment"("correction_request_id", "request_version", "input_fingerprint", "model_version", "criteria_version");

-- CreateIndex
CREATE INDEX "scan_intent_actor_id_expires_at_utc_idx" ON "scan_intent"("actor_id", "expires_at_utc");

-- CreateIndex
CREATE UNIQUE INDEX "scan_receipt_actor_id_request_key_key" ON "scan_receipt"("actor_id", "request_key");

-- CreateIndex
CREATE INDEX "review_job_state_next_run_at_utc_idx" ON "review_job"("state", "next_run_at_utc");

-- CreateIndex
CREATE UNIQUE INDEX "review_job_correction_request_id_input_fingerprint_model_ve_key" ON "review_job"("correction_request_id", "input_fingerprint", "model_version", "criteria_version");

-- CreateIndex
CREATE INDEX "audit_event_resource_type_resource_id_occurred_at_utc_idx" ON "audit_event"("resource_type", "resource_id", "occurred_at_utc");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internship" ADD CONSTRAINT "internship_intern_user_id_fkey" FOREIGN KEY ("intern_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internship" ADD CONSTRAINT "internship_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internship" ADD CONSTRAINT "internship_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internship_assignment" ADD CONSTRAINT "internship_assignment_internship_id_fkey" FOREIGN KEY ("internship_id") REFERENCES "internship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internship_assignment" ADD CONSTRAINT "internship_assignment_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internship_assignment" ADD CONSTRAINT "internship_assignment_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_policy_version" ADD CONSTRAINT "attendance_policy_version_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_checkpoint" ADD CONSTRAINT "qr_checkpoint_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_session" ADD CONSTRAINT "attendance_session_internship_id_fkey" FOREIGN KEY ("internship_id") REFERENCES "internship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_session" ADD CONSTRAINT "attendance_session_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "attendance_policy_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_scan" ADD CONSTRAINT "attendance_scan_internship_id_fkey" FOREIGN KEY ("internship_id") REFERENCES "internship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_scan" ADD CONSTRAINT "attendance_scan_checkpoint_id_fkey" FOREIGN KEY ("checkpoint_id") REFERENCES "qr_checkpoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_scan" ADD CONSTRAINT "attendance_scan_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_scan" ADD CONSTRAINT "attendance_scan_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "scan_receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_request" ADD CONSTRAINT "correction_request_internship_id_fkey" FOREIGN KEY ("internship_id") REFERENCES "internship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_request" ADD CONSTRAINT "correction_request_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_request" ADD CONSTRAINT "correction_request_previous_request_id_fkey" FOREIGN KEY ("previous_request_id") REFERENCES "correction_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_review" ADD CONSTRAINT "hr_review_correction_request_id_fkey" FOREIGN KEY ("correction_request_id") REFERENCES "correction_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_review" ADD CONSTRAINT "hr_review_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_comment" ADD CONSTRAINT "correction_comment_correction_request_id_fkey" FOREIGN KEY ("correction_request_id") REFERENCES "correction_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_comment" ADD CONSTRAINT "correction_comment_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_revision" ADD CONSTRAINT "attendance_revision_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_revision" ADD CONSTRAINT "attendance_revision_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "hr_review"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jev_assessment" ADD CONSTRAINT "jev_assessment_correction_request_id_fkey" FOREIGN KEY ("correction_request_id") REFERENCES "correction_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_intent" ADD CONSTRAINT "scan_intent_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_intent" ADD CONSTRAINT "scan_intent_internship_id_fkey" FOREIGN KEY ("internship_id") REFERENCES "internship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_intent" ADD CONSTRAINT "scan_intent_checkpoint_id_fkey" FOREIGN KEY ("checkpoint_id") REFERENCES "qr_checkpoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_receipt" ADD CONSTRAINT "scan_receipt_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_job" ADD CONSTRAINT "review_job_correction_request_id_fkey" FOREIGN KEY ("correction_request_id") REFERENCES "correction_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

