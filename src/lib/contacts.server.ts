import { z } from "zod";

const AnalysisResultSchema = z.object({
  name: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  needsReview: z.boolean(),
});

type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export async function analyzeImageForContacts(imageBase64: string): Promise<AnalysisResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  
  if (!apiKey) {
    throw new Error("LOVABLE_API_KEY is not configured.");
  }

  // Remove data URL prefix if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  try {
    const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Você é um extrator de dados especializado em capturar informações de recebedores em prints de logística/entregas.
            Seu objetivo é extrair APENAS o NOME e o TELEFONE.
            Ignore endereços, datas, códigos de rastreio, nomes de produtos, etc.
            
            Regras:
            1. Retorne um JSON com os campos: "name", "phone" e "needsReview".
            2. "name": Nome completo do recebedor/cliente.
            3. "phone": Número de telefone (mantenha como está no texto).
            4. "needsReview": true se as informações não forem claras ou estiverem incompletas, false caso contrário.
            5. Se não encontrar o dado, retorne null para o campo.
            6. Seja preciso. Não invente dados.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extraia o nome e telefone desta imagem."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Data}`
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      throw new Error(`Failed to analyze image: ${response.statusText}`);
    }

    const result = await response.json();
    const content = JSON.parse(result.choices[0].message.content);
    
    return AnalysisResultSchema.parse(content);
  } catch (error) {
    console.error("Error analyzing image:", error);
    return {
      name: null,
      phone: null,
      needsReview: true,
    };
  }
}
