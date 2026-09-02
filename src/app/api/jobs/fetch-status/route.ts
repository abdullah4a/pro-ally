import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { env } from "@/lib/env";
import { isDueForFetch } from "@/lib/jobs/fetchCadence";
import { getActiveJsearchKey } from "@/lib/repositories/jsearchKeys";

/**
 * Any signed-in user can see *when* ProAlly will next check for jobs — it's
 * scheduling info, not the key itself, so this deliberately isn't admin-gated
 * (contrast with /api/admin/jsearch-keys, which does expose the key list).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  try {
    const activeKey = await getActiveJsearchKey();

    if (!activeKey) {
      return NextResponse.json({
        configured: Boolean(env.JSEARCH_API_KEY),
        nextFetchAt: null,
        intervalMinutes: null,
      });
    }

    const dueNow = isDueForFetch(activeKey.lastFetchedAt, activeKey.fetchIntervalMinutes);
    const intervalMinutes = activeKey.fetchIntervalMinutes;
    const nextFetchAt =
      !dueNow && activeKey.lastFetchedAt && intervalMinutes
        ? new Date(activeKey.lastFetchedAt.getTime() + intervalMinutes * 60_000)
        : null;

    return NextResponse.json({
      configured: true,
      nextFetchAt,
      intervalMinutes,
    });
  } catch (error) {
    console.error("Fetch status error:", error);
    return NextResponse.json(
      { error: "We couldn't load scan status right now." },
      { status: 500 },
    );
  }
}
