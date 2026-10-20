/**
 * Rules for the intern's correction request form (Technical Design section 8).
 *
 * For a day that has a session, only the times the intern changes are sent
 * (an omitted time means "unchanged"). A day with no scans needs both times.
 * Proposed times are same-day only; the server re-checks everything.
 */

export type CorrectionReason = "missed_clock_out" | "missed_clock_in" | "technical_issue" | "wrong_action" | "other";

/** Same keys as Jev's explanation categories, so HR sees one vocabulary. */
export const CORRECTION_REASONS: readonly { value: CorrectionReason; label: string }[] = [
  { value: "missed_clock_out", label: "Forgot to scan OUT" },
  { value: "missed_clock_in", label: "Forgot to scan IN" },
  { value: "technical_issue", label: "Scan or location failed" },
  { value: "wrong_action", label: "Scanned the wrong code" },
  { value: "other", label: "Something else" },
];

export function reasonLabel(reason: CorrectionReason): string {
  return CORRECTION_REASONS.find((item) => item.value === reason)?.label ?? "Something else";
}

/** "You proposed Time out 18:05", or "Time in set to 09:10" once approved. */
export function describeProposal(proposal: { timeIn?: string; timeOut?: string }, approved = false): string {
  if (proposal.timeIn && proposal.timeOut) {
    return approved ? `Set to ${proposal.timeIn}–${proposal.timeOut}` : `You proposed ${proposal.timeIn}–${proposal.timeOut}`;
  }
  const [label, value] = proposal.timeIn ? ["Time in", proposal.timeIn] : ["Time out", proposal.timeOut ?? ""];
  return approved ? `${label} set to ${value}` : `You proposed ${label} ${value}`;
}

/** Office-local "HH:MM" times recorded that day, or null if there were no scans. */
export interface RecordedDay {
  timeIn: string | null;
  timeOut: string | null;
}

export interface CorrectionDraft {
  dateIso: string;
  reason: CorrectionReason | null;
  /** "" when empty, as an <input type="time"> reports it. */
  timeIn: string;
  timeOut: string;
  explanation: string;
  recorded: RecordedDay | null;
}

export type CorrectionField = "dateIso" | "reason" | "timeIn" | "timeOut" | "explanation";

export interface CorrectionProposal {
  timeIn?: string;
  timeOut?: string;
}

export type CorrectionValidation =
  | { ok: true; proposal: CorrectionProposal }
  | { ok: false; errors: Partial<Record<CorrectionField, string>> };

const MIN_EXPLANATION_LENGTH = 15;

export function suggestReason(recorded: RecordedDay | null): CorrectionReason | null {
  if (!recorded) return null;
  if (recorded.timeIn && !recorded.timeOut) return "missed_clock_out";
  if (!recorded.timeIn && recorded.timeOut) return "missed_clock_in";
  return null;
}

export function validateCorrection(draft: CorrectionDraft, todayIso: string): CorrectionValidation {
  const errors: Partial<Record<CorrectionField, string>> = {};

  if (draft.dateIso > todayIso) errors.dateIso = "Pick today or an earlier day.";
  if (!draft.reason) errors.reason = "Choose what happened.";
  if (draft.explanation.trim().length < MIN_EXPLANATION_LENGTH) {
    errors.explanation = "Say what happened in a sentence, and who can confirm it.";
  }

  const proposal: CorrectionProposal = {};
  let effectiveIn: string | null;
  let effectiveOut: string | null;

  if (!draft.recorded) {
    if (!draft.timeIn) errors.timeIn = "Add the time you arrived.";
    if (!draft.timeOut) errors.timeOut = "Add the time you left.";
    if (draft.timeIn) proposal.timeIn = draft.timeIn;
    if (draft.timeOut) proposal.timeOut = draft.timeOut;
    effectiveIn = draft.timeIn || null;
    effectiveOut = draft.timeOut || null;
  } else {
    if (draft.timeIn && draft.timeIn !== draft.recorded.timeIn) proposal.timeIn = draft.timeIn;
    if (draft.timeOut && draft.timeOut !== draft.recorded.timeOut) proposal.timeOut = draft.timeOut;
    if (!proposal.timeIn && !proposal.timeOut) errors.timeOut = "Change at least one time.";
    effectiveIn = proposal.timeIn ?? draft.recorded.timeIn;
    effectiveOut = proposal.timeOut ?? draft.recorded.timeOut;
  }

  // Zero-padded "HH:MM" strings compare correctly as text.
  if (!errors.timeOut && !errors.timeIn && effectiveIn && effectiveOut && effectiveOut <= effectiveIn) {
    errors.timeOut = "Time out must be later than Time in.";
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, proposal };
}
