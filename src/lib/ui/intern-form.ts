/**
 * The Add intern form. HR creates every account (no public sign-up); saving
 * creates the account and the internship, then emails a setup link.
 */

/** The usual requirement on the canvas; HR can change it per intern. */
export const DEFAULT_REQUIRED_HOURS = 486;
export const MAX_REQUIRED_HOURS = 2000;

export interface NewInternDraft {
  name: string;
  email: string;
  department: string;
  /** As typed, so "4.5" can be reported instead of silently rounded. */
  requiredHours: string;
  startDate: string;
  /** Optional; "" when not set. */
  endDate: string;
}

export type NewInternErrors = Partial<Record<keyof NewInternDraft, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateNewIntern(draft: NewInternDraft, departments: string[]): NewInternErrors {
  const errors: NewInternErrors = {};
  if (draft.name.trim().length < 2) errors.name = "Enter the intern's full name.";
  if (!EMAIL.test(draft.email.trim())) errors.email = "Enter a valid email address.";
  if (!departments.includes(draft.department)) errors.department = "Choose a department.";

  const hours = Number(draft.requiredHours);
  if (!/^\d+$/.test(draft.requiredHours.trim()) || hours < 1 || hours > MAX_REQUIRED_HOURS) {
    errors.requiredHours = `Enter whole hours between 1 and ${MAX_REQUIRED_HOURS}.`;
  }

  if (!ISO_DATE.test(draft.startDate)) errors.startDate = "Choose a start date.";
  if (draft.endDate) {
    if (!ISO_DATE.test(draft.endDate)) errors.endDate = "Choose a valid end date.";
    else if (ISO_DATE.test(draft.startDate) && draft.endDate < draft.startDate) {
      errors.endDate = "End date must be on or after the start date.";
    }
  }
  return errors;
}
