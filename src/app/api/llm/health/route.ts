import { NextResponse } from "next/server";

import { checkLlmHealth } from "@/lib/llm/client";

export async function GET() {
  const status = await checkLlmHealth();
  return NextResponse.json(status, {
    status: status.online ? 200 : 503,
  });
}
