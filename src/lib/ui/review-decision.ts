/**
 * HR's decision on a correction. Every decision carries a note the intern
 * reads, so a bare "approved" or "no" is never sent.
 */

export type ReviewDecision = "APPROVE" | "REJECT" | "ASK_INFO";

export const DECISION_NOTE_MIN = 5;
export const DECISION_NOTE_MAX = 2000;

/** An error message, or null when the note can be sent. */
export function validateDecisionNote(note: string): string | null {
  const trimmed = note.trim();
  if (trimmed.length < DECISION_NOTE_MIN) return "Write a short note. The intern sees it with your decision.";
  if (trimmed.length > DECISION_NOTE_MAX) return "Keep the note under 2,000 characters.";
  return null;
}
