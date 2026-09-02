import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { upsertProfile } from "@/lib/repositories/profiles";
import { profileFormSchema } from "@/lib/schemas/profile";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Please sign in to update your profile." },
      { status: 401 },
    );
  }

  const body = await request.json();
  const parsed = profileFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const profile = await upsertProfile(session.user.id, {
      ...parsed.data,
      onboardingComplete: true,
    });

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Profile save error:", error);
    return NextResponse.json(
      { error: "We couldn't save your profile right now. Please try again in a moment." },
      { status: 500 },
    );
  }
}
