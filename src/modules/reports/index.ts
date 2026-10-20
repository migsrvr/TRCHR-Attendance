/**
 * Reports module.
 *
 * SKELETON: reusable read models and the daily CSV export (DTR). Must reuse the
 * calculation module and policy versions; generate from a short repeatable-read
 * snapshot and stream after the transaction closes. See Technical Design v1.0
 * section 12.
 */

export interface DtrFilter {
  readonly internshipId?: string;
  readonly departmentId?: string;
  readonly fromDate: string;
  readonly toDate: string;
}

export interface DtrRow {
  readonly internshipId: string;
  readonly attendanceDate: string;
  readonly creditedMinutes: number;
  readonly requiredMinutes: number;
  readonly remainingMinutes: number;
  readonly timezone: string;
  readonly policyVersion: number;
}

export function buildDtrRows(_filter: DtrFilter): Promise<readonly DtrRow[]> {
  throw new Error("buildDtrRows is not implemented yet");
}

export function toCsv(_rows: readonly DtrRow[]): string {
  throw new Error("toCsv is not implemented yet");
}
