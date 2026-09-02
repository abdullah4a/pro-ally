import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { upsertFilters } from "@/lib/repositories/filters";
import { filtersFormSchema } from "@/lib/schemas/filters";

function splitKeywords(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Please sign in to update your search filters." },
      { status: 401 },
    );
  }

  const body = await request.json();
  const parsed = filtersFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const filters = await upsertFilters(session.user.id, {
      keywords: splitKeywords(parsed.data.keywords),
      excludeKeywords: splitKeywords(parsed.data.excludeKeywords),
      platforms: parsed.data.platforms,
      minTrustScore: parsed.data.minTrustScore,
      minMatchScore: parsed.data.minMatchScore,
      pollIntervalMins: parsed.data.pollIntervalMins,
    });

    return NextResponse.json(filters);
  } catch (error) {
    console.error("Filters save error:", error);
    return NextResponse.json(
      { error: "We couldn't save your filters right now. Please try again in a moment." },
      { status: 500 },
    );
  }
}
