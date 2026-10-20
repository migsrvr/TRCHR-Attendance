/**
 * Accounts module.
 *
 * SKELETON: HR-driven provisioning and account lifecycle. Owns the onboarding
 * service (create/resume PENDING account, internship, activation audit) and the
 * authorization checks reused by protected services. No business logic yet.
 * See Technical Design v1.0 section 2.
 */

export interface ProvisionInternInput {
  readonly email: string;
  readonly name: string;
  readonly departmentId: string;
  readonly officeId: string;
  readonly requiredMinutes: number;
  readonly startDate: string;
  readonly endDate?: string;
}

export interface ProvisionInternResult {
  readonly userId: string;
  readonly internshipId: string;
  readonly status: "PENDING" | "ACTIVE";
}

export async function provisionIntern(
  _input: ProvisionInternInput,
): Promise<ProvisionInternResult> {
  throw new Error("provisionIntern is not implemented yet");
}
