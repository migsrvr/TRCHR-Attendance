/**
 * Password rules shown as a live checklist on the set-password screen.
 * Lengths match Better Auth's defaults (minPasswordLength 8, max 128);
 * change them together with src/lib/auth.ts if HR wants stricter rules.
 */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export interface PasswordCheck {
  minLength: boolean;
  notTooLong: boolean;
  notEmail: boolean;
  matches: boolean;
  allMet: boolean;
}

export function checkPassword({ password, repeat, email }: { password: string; repeat: string; email: string }): PasswordCheck {
  const lower = password.toLowerCase();
  const address = email.toLowerCase();
  const localPart = address.split("@")[0] ?? "";

  const minLength = password.length >= MIN_PASSWORD_LENGTH;
  const notTooLong = password.length <= MAX_PASSWORD_LENGTH;
  const notEmail = lower.length > 0 && lower !== address && lower !== localPart;
  const matches = password.length > 0 && password === repeat;
  return { minLength, notTooLong, notEmail, matches, allMet: minLength && notTooLong && notEmail && matches };
}
