/**
 * Pure expiry classification for printed office QR checkpoints.
 * Dates are office-local "YYYY-MM-DD" strings.
 */

export type QrExpiryState = "expired" | "expiring-soon" | "valid" | "none";

export interface QrExpiryStatus {
  readonly state: QrExpiryState;
  /** Whole calendar days until expiry (negative if already expired, null if no expiry). */
  readonly daysLeft: number | null;
}

export const QR_EXPIRING_SOON_DAYS = 7;

export const QR_EXPIRY_OPTIONS = [
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days · monthly (recommended)" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "180 days" },
  { value: "365", label: "365 days" },
] as const;

export const DEFAULT_QR_EXPIRY_OPTION = "30";

function toUtcDayMs(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`);
}

export function classifyCheckpointExpiry(
  expiresIso: string | null,
  todayIso: string,
  soonThresholdDays = QR_EXPIRING_SOON_DAYS,
): QrExpiryStatus {
  if (!expiresIso) {
    return { state: "none", daysLeft: null };
  }
  const diffDays = Math.round((toUtcDayMs(expiresIso) - toUtcDayMs(todayIso)) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) {
    return { state: "expired", daysLeft: diffDays };
  }
  if (diffDays <= soonThresholdDays) {
    return { state: "expiring-soon", daysLeft: diffDays };
  }
  return { state: "valid", daysLeft: diffDays };
}
