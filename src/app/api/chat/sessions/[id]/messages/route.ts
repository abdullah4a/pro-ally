import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { chatWithLlm } from "@/lib/llm/client";
import { appendMessage, findSessionById } from "@/lib/repositories/chatSessions";
import { findActiveCvByUserId } from "@/lib/repositories/cvs";
import { sendChatMessageSchema } from "@/lib/schemas/chat";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Please sign in to chat with ProAlly AI." },
      { status: 401 },
    );
  }

  const { id } = await params;

  const body = await request.json();
  const parsed = sendChatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const chatSession = await findSessionById(session.user.id, id);
  if (!chatSession) {
    return NextResponse.json(
      { error: "We couldn't find that chat." },
      { status: 404 },
    );
  }

  // The prior turns (before this new message) are what the LLM should treat
  // as conversation history — the new message itself is passed separately.
  const history = chatSession.messages
    .map((m) => ({ role: m.role, content: m.content }))
    .slice(-10);

  const isFirstMessage = chatSession.messages.length === 0;
  const title = isFirstMessage
    ? parsed.data.message.slice(0, 60).trim() || "New chat"
    : chatSession.title;

  // Save the user's message first so it survives even if the LLM call below
  // fails — the same "never lose what the user typed" principle as CV upload.
  await appendMessage(
    session.user.id,
    id,
    { role: "user", content: parsed.data.message, createdAt: new Date() },
    isFirstMessage ? title : undefined,
  );

  try {
    const cv = await findActiveCvByUserId(session.user.id);
    const context = cv
      ? `Candidate skills: ${cv.parsed.skills.join(", ")}\nPast job titles: ${cv.parsed.jobTitles.join(", ")}\nYears of experience: ${cv.parsed.experienceYears}`
      : undefined;

    const reply = await chatWithLlm(parsed.data.message, { history, context });

    await appendMessage(session.user.id, id, {
      role: "assistant",
      content: reply,
      createdAt: new Date(),
    });

    return NextResponse.json({ reply, title });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      {
        error: "ProAlly AI is briefly unavailable. Please try again in a moment.",
        title,
      },
      { status: 503 },
    );
  }
}
