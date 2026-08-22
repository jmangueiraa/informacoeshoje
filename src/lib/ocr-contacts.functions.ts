import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ContactSchema = z.object({
  primeiro_nome: z.string().nullable(),
  contato: z.string().nullable(),
});

export const extractContactsWithAI = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ 
    text: z.string(),
    userApiKey: z.string().optional()
  }).parse(data))
  .handler(async ({ data }) => {
    const apiKey = data.userApiKey || process.env['LOVABLE_API_KEY'];
    if (!apiKey) {
      throw new Error("API Key não configurada. Por favor, configure nas configurações.");
    }

    // We use the Lovable AI Gateway for safety and reliability, pointing it to the Gemini model
    const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-1.5-flash",
        messages: [
          {
            role: "user",
            content: `Você é um assistente de extração de dados de comprovantes de entrega da Shopee/SPX.
Analise o texto do comprovante e extraia:
1. primeiro_nome: Apenas o PRIMEIRO NOME do recebedor (ex: Jéssica, Marta, Carlos). Ignore termos como 'BR', 'Detalhes', 'Entregue', 'LM Hub', etc. Se o nome não estiver presente, retorne 'Cliente XXXXX'.
2. contato: O número de telefone/celular com DDD no formato '(XX) 9XXXX-XXXX'.

Responda ESTRITAMENTE em formato JSON puro:
{"primeiro_nome": "...", "contato": "..."}

Texto para análise:
${data.text}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI extraction error:", errorText);
      throw new Error(`Failed to extract contacts: ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    
    try {
      const parsed = ContactSchema.parse(JSON.parse(content));
      return parsed;
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Invalid response format from AI");
    }
  });