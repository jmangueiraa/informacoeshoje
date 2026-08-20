import { z } from "zod";

export async function analyzeImageForContacts(imageBase64: string) {
  const apiKey = process.env['LOVABLE_API_KEY'];
  
  if (!apiKey) {
    console.error("LOVABLE_API_KEY is missing");
    throw new Error("Configuração de IA ausente");
  }

  const base64Data = imageBase64.includes('base64,') 
    ? imageBase64.split('base64,')[1] 
    : imageBase64;

  try {
    // Attempting the most standard AI Gateway endpoint for TanStack Start
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
            content: `Você é um extrator de dados para prints de logística da Shopee (especialmente prints de conversa ou detalhes do pedido).
            Extraia o NOME e o TELEFONE do destinatário.

            REGRAS DE EXTRAÇÃO:
            1. Retorne APENAS um JSON: {"name": string, "phone": string, "needsReview": boolean}.
            2. Procure por padrões como "Destinatário:", "Nome:", "Recebedor:" ou um nome no topo.
            3. Procure por telefones em formatos brasileiros: (XX) XXXXX-XXXX, XX XXXXX XXXX, ou apenas os números.
            4. Mesmo que o telefone esteja incompleto ou mascarado (ex: ****), tente extrair os dígitos visíveis.
            5. "needsReview" deve ser false se você encontrar qualquer sequência que pareça um número de telefone.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extraia os dados deste print de entrega Shopee:"
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
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI Gateway error (${response.status}):`, errorText);
      
      // Fallback: Se a IA falhar, retornamos o objeto marcado para revisão
      return {
        name: "Revisão Necessária",
        phone: "",
        needsReview: true,
        error: errorText // Passar o erro para log interno
      };
    }

    const result = await response.json();
    const content = JSON.parse(result.choices[0].message.content);
    
    const nameRaw = content.name || "Cliente";
    const name = nameRaw
      .split(/[_\s]/)[0]
      .replace(/[^a-zA-ZáàâãéèêíïóôõöúçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ]/g, "")
      .trim() || "Cliente";
    
    const phone = (content.phone || "").replace(/\D/g, "");
    
    // Forçar needsReview=false se tivermos pelo menos 8 dígitos
    const hasPhone = phone.length >= 8;
    const finalNeedsReview = hasPhone ? false : (content.needsReview ?? true);

    console.log("Extraction results:", { name, phone, finalNeedsReview, rawName: nameRaw });

    return {
      name: name || "Cliente",
      phone: phone,
      needsReview: finalNeedsReview && !hasPhone
    };
  } catch (error) {
    console.error("Failed to analyze image:", error);
    return {
      name: "Erro no Processamento",
      phone: "",
      needsReview: true
    };
  }
}
