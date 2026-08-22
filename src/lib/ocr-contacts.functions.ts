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

    // Usando o Lovable AI Gateway para segurança e confiabilidade, apontando para o modelo Gemini
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
            content: `Você é um extrator de contatos de comprovantes de entrega da Shopee/SPX.
O texto abaixo contém dados do recebedor e telefone:
"""
${data.text}
"""

Regras obrigatórias:
- primeiro_nome: Extraia APENAS o primeiro nome da pessoa recebedora (ex: se o texto tiver 'Jéssica De Araújo Dos Santos_', retorne 'Jéssica'; se tiver 'Marta Lúcia...', retorne 'Marta'; se tiver 'Dario...', retorne 'Dario'). Ignore underlines, pontos ou códigos.
- contato: Formate o telefone como '(XX) 9XXXX-XXXX'.
- Apenas use 'Cliente XXXXX' se absolutamente nenhum nome humano estiver legível.

Responda em formato JSON:
{"primeiro_nome": "...", "contato": "..."}`
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