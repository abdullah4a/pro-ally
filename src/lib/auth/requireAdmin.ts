import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/auth/admin";

type RequireAdminResult =
  | { userId: string }
  | { error: string; status: 401 | 403 };

/**
 * Kept separate from lib/auth/admin.ts, which stays framework-free on
 * purpose — importing @/auth (next-auth) breaks Vitest's ESM resolution for
 * anything that pulls it in (see src/lib/auth/authorize.ts for the same
 * reasoning). Only import this from route handlers, not from pure logic.
 */
export async function requireAdmin(): Promise<RequireAdminResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Please sign in.", status: 401 };
  }
  if (!isAdminEmail(session.user.email)) {
    return { error: "This setting is only available to the admin account.", status: 403 };
  }
  return { userId: session.user.id };
}
