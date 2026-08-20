import { z } from "zod";

const AnalysisResultSchema = z.object({
  name: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  needsReview: z.boolean(),
});

type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

/**
 * Nota para o Agente Lovable:
 * O endpoint correto para o AI Gateway é "https://api.lovable.dev/v1/ai/chat/completions".
 * Se receber 404, verifique se a conexão AI Gateway está ativa no painel do projeto.
 */

export async function analyzeImageForContacts(imageBase64: string): Promise<AnalysisResult> {
  const apiKey = process.env['LOVABLE_API_KEY'];
  
  if (!apiKey) {
    throw new Error("LOVABLE_API_KEY is not configured. Please enable AI Gateway in the project settings.");
  }

  // Remove data URL prefix if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  try {
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
            - Frequentemente são prints de apps como Shopee, iFood, Loggi.
            - O nome do recebedor geralmente aparece acima do telefone.
            - O telefone pode vir precedido de "Tel", "Telefone", "Celular" ou ícones.
            - Procure por campos como "Informações do recebedor" ou "Destinatário".

            Regras CRÍTICAS:
            1. Retorne um JSON: {"name": string, "phone": string, "needsReview": boolean}.
            2. "name": Extraia APENAS o primeiro nome. Se o nome for "Jéssica De Araújo Dos Santos_", retorne "Jéssica". Remova qualquer caractere especial como "_" no final.
            3. "phone": Extraia o número de telefone completo. Remova parênteses, espaços e hifens. Mantenha o código do país se disponível (ex: 5516994345806).
            4. "needsReview": Defina como FALSE se você encontrou um nome e um telefone. Só defina como TRUE se não encontrar NADA.
            5. NUNCA ignore o telefone se ele estiver visível na imagem, mesmo que esteja em formato internacional.
            6. Seja extremamente literal com o que vê na imagem.`
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
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error (${response.status}): ${errorText || response.statusText}`);
    }

    const result = await response.json();
    const content = JSON.parse(result.choices[0].message.content);
    
    // Safeguard to ensure only first name is used and cleaned
    if (content.name) {
      const cleaned = content.name.replace(/[_\W]+$/, '');
      content.name = cleaned.split(' ')[0].split('_')[0].trim();
    }
    
    // Additional phone validation
    if (content.phone && content.phone.length >= 8) {
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
