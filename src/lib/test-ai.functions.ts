import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const testAiGateway = createServerFn({ method: "POST" })
  .handler(async () => {
    const apiKey = process.env['LOVABLE_API_KEY'];
    if (!apiKey) return { error: "No API key" };

    try {
      const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5,
        }),
      });
      return { status: response.status, statusText: response.statusText, ok: response.ok };
    } catch (e: any) {
      return { error: e.message };
    }
  });
