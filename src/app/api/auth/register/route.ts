import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { createUser, findUserByEmail } from "@/lib/repositories/users";
import { registerSchema } from "@/lib/schemas/user";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const existing = await findUserByEmail(parsed.data.email);
    if (existing) {
      return NextResponse.json(
        { error: { email: ["An account with this email already exists"] } },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await createUser({
      email: parsed.data.email,
      passwordHash,
    });

    return NextResponse.json(
      {
        id: user._id.toString(),
        email: user.email,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "We couldn't create your account right now. Please try again in a moment." },
      { status: 500 },
    );
  }
}
