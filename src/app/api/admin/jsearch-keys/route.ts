import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { env } from "@/lib/env";
import { addJsearchKey, listJsearchKeys } from "@/lib/repositories/jsearchKeys";
import { addJsearchKeySchema } from "@/lib/schemas/jsearchKeys";

function maskKey(key: string): string {
  if (key.length <= 4) return "•".repeat(key.length);
  return `${"•".repeat(8)}${key.slice(-4)}`;
}

export async function GET() {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  try {
    const keys = await listJsearchKeys();

    return NextResponse.json({
      keys: keys.map((k) => ({
        id: k._id.toString(),
        label: k.label,
        keyPreview: maskKey(k.apiKey),
        isActive: k.isActive,
        status: k.status,
        statusMessage: k.statusMessage,
        lastCheckedAt: k.lastCheckedAt,
        monthlyLimit: k.monthlyLimit,
        requestsRemainingKnown: k.requestsRemainingKnown,
        lastFetchedAt: k.lastFetchedAt,
        fetchIntervalMinutes: k.fetchIntervalMinutes,
        createdAt: k.createdAt,
      })),
      usingEnvFallback: !keys.some((k) => k.isActive) && Boolean(env.JSEARCH_API_KEY),
    });
  } catch (error) {
    console.error("JSearch keys list error:", error);
    return NextResponse.json(
      { error: "We couldn't load your saved keys right now. Please try again in a moment." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await request.json();
  const parsed = addJsearchKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const label = parsed.data.label?.trim() || "JSearch key";
    const created = await addJsearchKey(parsed.data.apiKey.trim(), label, check.userId);

    return NextResponse.json({
      message: created.isActive
        ? "Your key has been added and activated."
        : "Your key has been added. Activate it below to start using it for job matching.",
      key: {
        id: created._id.toString(),
        label: created.label,
        keyPreview: maskKey(created.apiKey),
        isActive: created.isActive,
        createdAt: created.createdAt,
      },
    });
  } catch (error) {
    console.error("JSearch key add error:", error);
    return NextResponse.json(
      { error: "We couldn't save this key right now. Please try again in a moment." },
      { status: 500 },
    );
  }
}
