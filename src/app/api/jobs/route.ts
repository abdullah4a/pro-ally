import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db/mongodb";
import { jobUpdateSchema } from "@/lib/schemas/job";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Please sign in to view your job pipeline." },
      { status: 401 },
    );
  }

  try {
    const db = await getDb();

    const jobs = await db
      .collection("jobs")
      .find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    const serialized = jobs.map((job) => ({
      _id: job._id.toString(),
      title: job.title || "Untitled",
      company: job.company || "Unknown",
      description: job.description || "",
      url: job.url || "#",
      source: job.source || "Unknown",
      publisher: job.publisher || null,
      matchScore: job.matchScore || 0,
      status: job.status || "new",
      postedAt: job.postedAt || job.createdAt,
      createdAt: job.createdAt,
      savedAt: job.savedAt || null,
      notes: job.notes || "",
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Jobs fetch error:", error);
    return NextResponse.json(
      { error: "We couldn't load your job pipeline right now. Please try again in a moment." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Please sign in to update this job." },
      { status: 401 },
    );
  }

  const body = await request.json();
  const parsed = jobUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "We couldn't find that job. Please refresh and try again." },
      { status: 400 },
    );
  }

  const { jobId, status, notes, action } = parsed.data;

  try {
    const db = await getDb();
    const now = new Date();

    // "applied_confirmed" implies status "applied" — the whole point of the
    // apply-confirmation prompt is to turn a link click into a real pipeline
    // transition — but an explicit `status` in the same request always wins.
    const resolvedStatus = status ?? (action === "applied_confirmed" ? "applied" : undefined);

    const update: Record<string, unknown> = {};
    if (resolvedStatus) update.status = resolvedStatus;
    if (notes !== undefined) update.notes = notes;

    const mongoUpdate: Record<string, unknown> = {};
    if (Object.keys(update).length > 0) mongoUpdate.$set = update;
    if (action) {
      mongoUpdate.$push = {
        activity: { type: action, at: now, ...(resolvedStatus ? { toStatus: resolvedStatus } : {}) },
      };
    }

    if (Object.keys(mongoUpdate).length > 0) {
      await db.collection("jobs").updateOne({ _id: jobId }, mongoUpdate);
    }

    return NextResponse.json({ success: true, status: resolvedStatus ?? null });
  } catch (error) {
    console.error("Job update error:", error);
    return NextResponse.json(
      { error: "We couldn't save that change right now. Please try again in a moment." },
      { status: 500 },
    );
  }
}
