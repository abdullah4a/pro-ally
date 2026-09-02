import bcrypt from "bcryptjs";

import { createUser, findUserByEmail } from "@/lib/repositories/users";
import { loginSchema } from "@/lib/schemas/user";

export async function authorizeCredentials(
  credentials: Record<string, unknown> | undefined,
) {
  const parsed = loginSchema.safeParse(credentials);
  if (!parsed.success) {
    return null;
  }

  // 1. Check ENV Admin credentials. Backed by a real DB user (created on first
  // login) rather than a fake id, since profile/filters/CV all key off a real
  // ObjectId — a placeholder id like "admin-static-id" breaks every one of them.
  if (
    process.env.ADMIN_EMAIL &&
    process.env.ADMIN_PASSWORD &&
    parsed.data.email === process.env.ADMIN_EMAIL &&
    parsed.data.password === process.env.ADMIN_PASSWORD
  ) {
    const existing = await findUserByEmail(parsed.data.email);
    if (existing) {
      return { id: existing._id.toString(), email: existing.email };
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const created = await createUser({ email: parsed.data.email, passwordHash });
    return { id: created._id.toString(), email: created.email };
  }

  // 2. Check Database
  const user = await findUserByEmail(parsed.data.email);
  if (!user) {
    return null;
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    return null;
  }

  return {
    id: user._id.toString(),
    email: user.email,
  };
}
