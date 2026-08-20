import { z } from "zod";

export async function analyzeImageForContacts(imageBase64: string) {
  const apiKey = process.env['LOVABLE_API_KEY'];
  
  if (!apiKey) {
    console.error("LOVABLE_API_KEY is missing");
    throw new Error("Configuração de IA ausente");
  }

  // Removendo prefixo data:image/...;base64, se existir
  const base64Data = imageBase64.includes('base64,') 
    ? imageBase64.split('base64,')[1] 
    : imageBase64;

  try {
    // Usando o endpoint correto do Lovable AI Gateway para projetos TanStack Start
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
            content: `Você é um extrator de dados para prints de logística da Shopee.
            Extraia o NOME e o TELEFONE do recebedor.
            
            REGRAS:
            1. Retorne JSON: {"name": string, "phone": string, "needsReview": boolean}.
            2. "name": Apenas o primeiro nome (ex: "Maria").
            3. "phone": Apenas números (ex: "5511999999999").
            4. Se encontrar qualquer sequência de 8+ dígitos, use como telefone e defina needsReview=false.
            5. Limpe o nome de caracteres como "_" ou "*" frequentemente encontrados em OCR.`
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
      
      // Fallback para falha técnica: não travar a UI, mas marcar para revisão
      return {
        name: "Erro na extração",
        phone: "",
        needsReview: true
      };
    }

    const result = await response.json();
    const content = JSON.parse(result.choices[0].message.content);
    
    // Pós-processamento de segurança
    const phone = (content.phone || "").replace(/\D/g, "");
    const needsReview = phone.length < 8;

    return {
      name: (content.name || "Cliente").split(/[_\s]/)[0],
      phone: phone,
      needsReview: needsReview
    };
  } catch (error) {
    console.error("Failed to analyze image:", error);
    return {
      name: "Erro processamento",
      phone: "",
      needsReview: true
    };
  }
}
