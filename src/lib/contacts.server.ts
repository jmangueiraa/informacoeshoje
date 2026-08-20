import { z } from "zod";

const AnalysisResultSchema = z.object({
  name: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  needsReview: z.boolean(),
});

type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export async function analyzeImageForContacts(imageBase64: string): Promise<AnalysisResult> {
  const apiKey = process.env['LOVABLE_API_KEY'];
  
  if (!apiKey) {
    throw new Error("LOVABLE_API_KEY is not configured. Please enable AI Gateway in the project settings.");
  }

  // Remove data URL prefix if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  try {
    // Tentando o endpoint padrão do AI Gateway que deveria funcionar
    const response = await fetch("https://api.lovable.dev/v1/ai/chat/completions", {
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
            content: `Você é um extrator de dados altamente preciso especializado em capturar informações de recebedores em prints de logística/entregas.
            Seu objetivo é extrair APENAS o NOME e o TELEFONE do recebedor/cliente.

            CONTEXTO DA IMAGEM:
            - A imagem é um print de detalhes de pedido (ex: Shopee).
            - O nome do recebedor geralmente aparece abaixo de "Informações do recebedor".
            - O telefone aparece logo abaixo ou ao lado do nome, geralmente com "+55".

            Regras CRÍTICAS:
            1. Retorne um JSON: {"name": string, "phone": string, "needsReview": boolean}.
            2. "name": Extraia APENAS o primeiro nome. Exemplo: "Jéssica De Araújo..." -> "Jéssica". Limpe caracteres como "_".
            3. "phone": Extraia o número completo (ex: 5516994345806).
            4. "needsReview": SEMPRE defina como FALSE se encontrar um telefone válido (8+ dígitos).
            5. Procure por padrões numéricos longos caso não encontre etiquetas claras.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extraia o nome e telefone desta imagem de entrega."
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
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error (${response.status})`);
    }

    const result = await response.json();
    const content = JSON.parse(result.choices[0].message.content);
    
    // Limpeza extra garantida no servidor
    if (content.name) {
      const cleaned = content.name.replace(/[_\W]+$/, '');
      content.name = cleaned.split(' ')[0].split('_')[0].trim();
    }
    
    // Força validade se houver telefone
    if (content.phone && content.phone.replace(/\D/g, '').length >= 8) {
      content.needsReview = false;
    }
    
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
