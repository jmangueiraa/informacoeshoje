import { createServerFn } from "@tanstack/react-start";
import { testOpenAI, testDirect } from "./test-ai-v2.server";

export const testAiGateway = createServerFn({ method: "POST" })
  .handler(async () => {
    const apiKey = process.env['LOVABLE_API_KEY'];
    if (!apiKey) return { error: "No API key" };

    const openaiResult = await testOpenAI(apiKey);
    const directResult = await testDirect(apiKey);
    
    return { openaiResult, directResult };
  });
