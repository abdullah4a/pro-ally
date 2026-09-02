import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/auth/admin";
import { canCreateSession } from "@/lib/chat/limits";
import { env } from "@/lib/env";
import {
  countSessionsByUserId,
  createSession,
  listSessionsByUserId,
} from "@/lib/repositories/chatSessions";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Please sign in to view your chats." },
      { status: 401 },
    );
  }

  try {
    const sessions = await listSessionsByUserId(session.user.id);
    const admin = isAdminEmail(session.user.email);

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s._id.toString(),
        title: s.title,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: s.messages.length,
      })),
      limit: {
        max: env.MAX_CHAT_SESSIONS_PER_USER,
        used: sessions.length,
        isAdmin: admin,
        canCreate: canCreateSession(sessions.length, admin, env.MAX_CHAT_SESSIONS_PER_USER),
      },
    });
  } catch (error) {
    console.error("Chat sessions list error:", error);
    return NextResponse.json(
      { error: "We couldn't load your chats right now. Please try again in a moment." },
      { status: 500 },
    );
  }
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Please sign in to start a new chat." },
      { status: 401 },
    );
  }

  try {
    const admin = isAdminEmail(session.user.email);
    const currentCount = await countSessionsByUserId(session.user.id);

    if (!canCreateSession(currentCount, admin, env.MAX_CHAT_SESSIONS_PER_USER)) {
      return NextResponse.json(
        {
          error: `You've reached your limit of ${env.MAX_CHAT_SESSIONS_PER_USER} chat sessions. Please continue one of your existing conversations.`,
        },
        { status: 403 },
      );
    }

    const created = await createSession(session.user.id, "New chat");

    return NextResponse.json({
      id: created._id.toString(),
      title: created.title,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      messageCount: 0,
    });
  } catch (error) {
    console.error("Chat session create error:", error);
    return NextResponse.json(
      { error: "We couldn't start a new chat right now. Please try again in a moment." },
      { status: 500 },
    );
  }
}
