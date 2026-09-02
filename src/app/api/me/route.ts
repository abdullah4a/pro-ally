import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { findActiveCvByUserId } from "@/lib/repositories/cvs";
import { getDefaultFilters } from "@/lib/repositories/filters";
import { findProfileByUserId } from "@/lib/repositories/profiles";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Please sign in to view your account." },
      { status: 401 },
    );
  }

  try {
    const [profile, cv, filters] = await Promise.all([
      findProfileByUserId(session.user.id),
      findActiveCvByUserId(session.user.id),
      getDefaultFilters(session.user.id),
    ]);

    return NextResponse.json({
      profile,
      cv: cv
        ? {
            id: cv._id.toString(),
            fileName: cv.fileName,
            parsed: cv.parsed,
            parsingIncomplete: cv.parsingIncomplete,
            uploadedAt: cv.uploadedAt,
          }
        : null,
      filters,
    });
  } catch (error) {
    console.error("Account data fetch error:", error);
    return NextResponse.json(
      { error: "We couldn't load your account right now. Please try again in a moment." },
      { status: 500 },
    );
  }
}
