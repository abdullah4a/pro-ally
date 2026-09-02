import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import {
  chatMessageSchema,
  chatSessionSchema,
  sendChatMessageSchema,
} from "../chat";

describe("chatMessageSchema", () => {
  const valid = { role: "user" as const, content: "Hello", createdAt: new Date() };

  it("accepts a valid user message", () => {
    expect(chatMessageSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a valid assistant message", () => {
    expect(
      chatMessageSchema.safeParse({ ...valid, role: "assistant" }).success,
    ).toBe(true);
  });

  it("rejects an unknown role", () => {
    expect(
      chatMessageSchema.safeParse({ ...valid, role: "system" }).success,
    ).toBe(false);
  });

  it("rejects empty content", () => {
    expect(chatMessageSchema.safeParse({ ...valid, content: "" }).success).toBe(
      false,
    );
  });

  it("accepts content at the 6000-char boundary, rejects over it", () => {
    expect(
      chatMessageSchema.safeParse({ ...valid, content: "a".repeat(6000) })
        .success,
    ).toBe(true);
    expect(
      chatMessageSchema.safeParse({ ...valid, content: "a".repeat(6001) })
        .success,
    ).toBe(false);
  });

  it("rejects createdAt as an ISO string rather than a Date instance", () => {
    expect(
      chatMessageSchema.safeParse({ ...valid, createdAt: valid.createdAt.toISOString() })
        .success,
    ).toBe(false);
  });
});

describe("chatSessionSchema", () => {
  const valid = {
    userId: new ObjectId(),
    title: "New chat",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("accepts a session with no messages yet and defaults messages to []", () => {
    const result = chatSessionSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.messages).toEqual([]);
    }
  });

  it("accepts a session with messages", () => {
    expect(
      chatSessionSchema.safeParse({
        ...valid,
        messages: [{ role: "user", content: "hi", createdAt: new Date() }],
      }).success,
    ).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(chatSessionSchema.safeParse({ ...valid, title: "" }).success).toBe(
      false,
    );
  });

  it("rejects when userId is a hex string instead of an ObjectId instance", () => {
    expect(
      chatSessionSchema.safeParse({ ...valid, userId: valid.userId.toHexString() })
        .success,
    ).toBe(false);
  });

  it("rejects an invalid message inside the messages array", () => {
    expect(
      chatSessionSchema.safeParse({
        ...valid,
        messages: [{ role: "narrator", content: "hi", createdAt: new Date() }],
      }).success,
    ).toBe(false);
  });
});

describe("sendChatMessageSchema", () => {
  it("accepts a normal message", () => {
    expect(sendChatMessageSchema.safeParse({ message: "Hello" }).success).toBe(
      true,
    );
  });

  it("rejects an empty message", () => {
    expect(sendChatMessageSchema.safeParse({ message: "" }).success).toBe(
      false,
    );
  });

  it("accepts a message at the 2000-char boundary, rejects over it", () => {
    expect(
      sendChatMessageSchema.safeParse({ message: "a".repeat(2000) }).success,
    ).toBe(true);
    expect(
      sendChatMessageSchema.safeParse({ message: "a".repeat(2001) }).success,
    ).toBe(false);
  });

  it("rejects a missing message field", () => {
    expect(sendChatMessageSchema.safeParse({}).success).toBe(false);
  });
});
