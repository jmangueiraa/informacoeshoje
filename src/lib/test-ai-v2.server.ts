import OpenAI from "openai";

export async function testOpenAI(apiKey: string) {
  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: "https://api.lovable.dev/v1/ai",
  });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 5,
    });
    return { ok: true, data: response.choices[0]?.message?.content };
  } catch (e: any) {
    return { ok: false, error: e.message, status: e.status, name: e.name };
  }
}

export async function testDirect(apiKey: string) {
    const url = "https://api.lovable.dev/v1/ai/chat/completions";
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: "hi" }],
                max_tokens: 5
            })
        });
        const status = response.status;
        const ok = response.ok;
        const body = await response.text();
        return { url, status, ok, body };
    } catch (e: any) {
        return { url, error: e.message };
    }
}

