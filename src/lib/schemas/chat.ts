import { ObjectId } from "mongodb";
import { z } from "zod";

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(6000),
  createdAt: z.date(),
});

export const chatSessionSchema = z.object({
  userId: z.instanceof(ObjectId),
  title: z.string().min(1).max(200),
  messages: z.array(chatMessageSchema).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const sendChatMessageSchema = z.object({
  message: z.string().min(1).max(2000),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatSessionDocument = z.infer<typeof chatSessionSchema>;
export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>;
