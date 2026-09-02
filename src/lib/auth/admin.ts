/**
 * Admin is defined the same way everywhere in this app: the signed-in user's
 * email matches ADMIN_EMAIL (see src/lib/auth/authorize.ts). There is no
 * separate role field — keep this check consistent with that.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL);
}
