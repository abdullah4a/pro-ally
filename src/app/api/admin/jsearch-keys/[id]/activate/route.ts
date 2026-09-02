import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { activateJsearchKey } from "@/lib/repositories/jsearchKeys";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { id } = await params;

  try {
    await activateJsearchKey(id);
    return NextResponse.json({
      message: "This key is now active. Any other saved key has been deactivated.",
    });
  } catch (error) {
    console.error("JSearch key activate error:", error);
    return NextResponse.json(
      { error: "We couldn't activate this key right now. Please try again in a moment." },
      { status: 500 },
    );
  }
}
