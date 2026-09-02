import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { findSessionById } from "@/lib/repositories/chatSessions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Please sign in to view this chat." },
      { status: 401 },
    );
  }

  const { id } = await params;

  try {
    const chatSession = await findSessionById(session.user.id, id);

    if (!chatSession) {
      return NextResponse.json(
        { error: "We couldn't find that chat." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: chatSession._id.toString(),
      title: chatSession.title,
      messages: chatSession.messages,
      createdAt: chatSession.createdAt,
      updatedAt: chatSession.updatedAt,
    });
  } catch (error) {
    console.error("Chat session fetch error:", error);
    return NextResponse.json(
      { error: "We couldn't load that chat right now. Please try again in a moment." },
      { status: 500 },
    );
  }
}
