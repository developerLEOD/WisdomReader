/**
 * Access control configuration for BLC (Book Learning Circle) Planner.
 * Note: These account emails are strictly evaluated for authorization
 * and MUST NEVER be displayed or exposed in the UI.
 */
export const AUTHORIZED_BLC_EMAILS = [
  'araizhasan00@gmail.com',
  'developertwl@gmail.com',
  'raotashfeen6@gmail.com',
  'iqradreamer@gmail.com',
] as const;

const AUTHORIZED_EMAILS_SET = new Set<string>(
  AUTHORIZED_BLC_EMAILS.map(email => email.trim().toLowerCase())
);

export function isAuthorizedBlcEmail(email?: string | null): boolean {
  if (!email) return false;
  return AUTHORIZED_EMAILS_SET.has(email.trim().toLowerCase());
}
