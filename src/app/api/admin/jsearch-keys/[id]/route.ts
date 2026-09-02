import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { deleteJsearchKey } from "@/lib/repositories/jsearchKeys";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { id } = await params;

  try {
    await deleteJsearchKey(id);
    return NextResponse.json({ message: "The key has been deleted." });
  } catch (error) {
    console.error("JSearch key delete error:", error);
    return NextResponse.json(
      { error: "We couldn't delete this key right now. Please try again in a moment." },
      { status: 500 },
    );
  }
}
