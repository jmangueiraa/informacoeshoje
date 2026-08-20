import { createServerFn } from "@tanstack/react-start";

export const testAiGateway = createServerFn({ method: "POST" })
  .handler(async () => {
    const apiKey = process.env['LOVABLE_API_KEY'];
    if (!apiKey) return { error: "No API key" };

    const urls = [
      "https://api.lovable.dev/v1/ai/chat/completions",
      "https://api.lovable.dev/v1/chat/completions",
      "https://api.lovable.ai/v1/openai/chat/completions"
    ];

    const results = [];

    for (const url of urls) {
      try {
        const response = await fetch(url, {
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
        results.push({ url, status: response.status, ok: response.ok });
      } catch (e: any) {
        results.push({ url, error: e.message });
      }
    }
    return { results };
  });
