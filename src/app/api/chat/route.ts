import { NextRequest } from "next/server";
import { requireAuth, validateRequestBody } from "@/lib/api-auth";
import { storage } from "@/lib/storage";
import { generateChatResponse } from "@/lib/openai";
import { chatMessageSchema } from "@/lib/types";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();

  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const rawBody = await request.json();
    const bodyResult = validateRequestBody(rawBody, chatMessageSchema);

    if (bodyResult instanceof Response) {
      return bodyResult;
    }

    const { message } = bodyResult;
    const userId = authResult.id;

    // Save user message
    await storage.createChatMessage({
      userId,
      content: message,
      isUserMessage: true
    });

    // Get recent chat history for context
    const recentMessages = await storage.getUserChatMessages(userId);
    const context = recentMessages
      .slice(-5) // Last 5 messages
      .map(msg => `${msg.isUserMessage ? "User" : "Assistant"}: ${msg.content}`)
      .join("\n");

    // Generate AI response
    const aiResponse = await generateChatResponse(message, context);

    // Save AI response
    const savedResponse = await storage.createChatMessage({
      userId,
      content: aiResponse,
      isUserMessage: false
    });

    return Response.json({ message: aiResponse, id: savedResponse.id });
  } catch (error) {
    console.error("Error handling chat message:", error);
    return Response.json({ error: "Failed to process chat message" }, { status: 500 });
  }
}