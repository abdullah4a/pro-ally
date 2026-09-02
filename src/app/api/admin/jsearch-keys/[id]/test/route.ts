import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { fetchRapidApiJobs } from "@/lib/jobs/fetchers";
import { findJsearchKeyById, recordJsearchFetchResult } from "@/lib/repositories/jsearchKeys";

const STATUS_MESSAGES: Record<string, string> = {
  ok: "This key is working — it returned real job results.",
  quota_exceeded:
    "This key has hit its monthly JSearch request limit. Add a new key or wait for the plan to reset.",
  invalid: "This key was rejected by RapidAPI — it may be invalid, revoked, or not subscribed to JSearch.",
  error: "We couldn't reach JSearch to test this key. Please try again in a moment.",
};

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
    const key = await findJsearchKeyById(id);
    if (!key) {
      return NextResponse.json({ error: "We couldn't find that key." }, { status: 404 });
    }

    const result = await fetchRapidApiJobs("Software Engineer", "", key.apiKey);
    await recordJsearchFetchResult(id, result);

    return NextResponse.json({
      status: result.status,
      message:
        result.status === "ok"
          ? `This key is working — it returned ${result.jobs.length} sample job${result.jobs.length === 1 ? "" : "s"}.`
          : (result.statusMessage ?? STATUS_MESSAGES[result.status] ?? STATUS_MESSAGES.error),
      jobsFound: result.jobs.length,
      requestsRemaining: result.requestsRemaining,
      requestsLimit: result.requestsLimit,
    });
  } catch (error) {
    console.error("JSearch key test error:", error);
    return NextResponse.json(
      { error: "We couldn't test this key right now. Please try again in a moment." },
      { status: 500 },
    );
  }
}
