import { z } from "zod";

/**
 * Normaliza números brasileiros.
 * Aceita formatos como: (16) 99999-9999, +55 16 99999-9999, 5516999999999, etc.
 * Retorna apenas os dígitos relevantes sem o prefixo DDI 55 (se presente).
 */
export function normalizeBrazilianPhone(phone: string): { normalized: string; isValid: boolean; reason: string | undefined } {
  const digits = phone.replace(/\D/g, "");
  
  console.log(`[CAPTURA] Normalizando telefone bruto: "${phone}" -> dígitos: "${digits}"`);

  let result = digits;
  
  // Se começar com 55 e tiver 12 ou 13 dígitos, remove o 55
  if (result.startsWith("55") && (result.length === 12 || result.length === 13)) {
    result = result.substring(2);
    console.log(`[CAPTURA] Removido prefixo 55 -> "${result}"`);
  }

  // Validação básica de tamanho para Brasil (DDD + Número)
  // Celular: 11 dígitos (Ex: 11988887777)
  // Fixo: 10 dígitos (Ex: 1133334444)
  const isValid = result.length === 10 || result.length === 11;
  
  let reason;
  if (!isValid) {
    if (result.length === 0) reason = "Telefone não identificado";
    else reason = `Formato inválido (${result.length} dígitos)`;
  }

  return { 
    normalized: result, 
    isValid,
    reason
  };
}

export async function analyzeImageForContacts(imageBase64: string) {
  console.log("[CAPTURA] Imagem recebida para processamento");
  
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) {
    console.error("[CAPTURA] ERRO: LOVABLE_API_KEY ausente");
    return {
      name: "Erro de Configuração",
      phone: "",
      needsReview: true,
      reviewReason: "Configuração de IA ausente"
    };
  }

  const base64Data = imageBase64.includes('base64,') 
    ? imageBase64.split('base64,')[1] 
    : imageBase64;

  try {
    console.log("[CAPTURA] OCR iniciado via GPT-4o-mini");
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
            content: `Você é um especialista em extração de dados de logística e e-commerce (Shopee, Mercado Livre, etc).
            Sua tarefa é encontrar o NOME e o TELEFONE do destinatário em prints de telas de celular, etiquetas ou conversas.

            INSTRUÇÕES:
            1. Procure por labels como: "Destinatário", "Recebedor", "Cliente", "Enviar para", "Nome".
            2. Procure por números de telefone brasileiros (com ou sem DDD, com ou sem parênteses/traços).
            3. Identifique o nome completo se disponível.
            4. Se encontrar vários nomes, foque no que parece ser o cliente/destinatário final.
            5. Retorne OBRIGATORIAMENTE um JSON puro no formato abaixo.

            FORMATO DE RETORNO (JSON):
            {
              "name": "Nome Completo Encontrado",
              "phone": "Telefone Encontrado (mantenha original)",
              "confidence_name": 0.0 a 1.0,
              "confidence_phone": 0.0 a 1.0,
              "observation": "Breve nota se algo estiver estranho"
            }`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extraia o nome e telefone do destinatário desta imagem de logística:"
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
      console.error(`[CAPTURA] Erro na API de IA (${response.status}):`, errorText);
      return {
        name: "Erro na IA",
        phone: "",
        needsReview: true,
        reviewReason: "Falha na comunicação com o provedor de IA"
      };
    }

    const result = await response.json();
    const rawContent = result.choices[0].message.content;
    console.log("[CAPTURA] Resultado bruto da IA:", rawContent);
    
    const content = JSON.parse(rawContent);
    
    const rawName = content.name || "";
    const rawPhone = content.phone || "";
    
    // Normalização e Validação
    const phoneResult = normalizeBrazilianPhone(rawPhone);
    
    // Limpeza de nome: remove underscores, garante capitalização básica se necessário
    // mas mantém o nome completo conforme solicitado
    const cleanName = rawName.replace(/_/g, " ").trim();
    const hasName = cleanName.length >= 2;
    
    console.log("[CAPTURA] Nome extraído:", cleanName);
    console.log("[CAPTURA] Telefone extraído:", rawPhone);
    console.log("[CAPTURA] Telefone normalizado:", phoneResult.normalized);
    console.log("[CAPTURA] Confiança Nome:", content.confidence_name);
    console.log("[CAPTURA] Confiança Telefone:", content.confidence_phone);

    // Lógica de Classificação Final
    let finalNeedsReview = false;
    let reviewReason = "";

    if (!phoneResult.isValid) {
      finalNeedsReview = true;
      reviewReason = phoneResult.reason || "Telefone inválido";
    } else if (!hasName) {
      finalNeedsReview = true;
      reviewReason = "Nome não identificado";
    }

    console.log(`[CAPTURA] Classificação final: ${finalNeedsReview ? 'REVISAR' : 'OK'} - Motivo: ${reviewReason || 'Dados Claros'}`);

    return {
      name: cleanName || "Cliente",
      phone: phoneResult.normalized,
      needsReview: finalNeedsReview,
      reviewReason: reviewReason,
      raw_data: content
    };

  } catch (error) {
    console.error("[CAPTURA] Erro crítico no processamento:", error);
    return {
      name: "Erro no Sistema",
      phone: "",
      needsReview: true,
      reviewReason: "Erro interno no processamento da imagem"
    };
  }
}
