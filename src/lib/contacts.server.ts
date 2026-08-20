import { z } from "zod";

/**
 * Normaliza números brasileiros.
 * Aceita formatos como: (16) 99999-9999, +55 16 99999-9999, 5516999999999, etc.
 * Retorna apenas os dígitos relevantes sem o prefixo DDI 55 (se presente).
 */
export function normalizeBrazilianPhone(phone: string): { normalized: string; isValid: boolean; reason: string | undefined } {
  // Remove tudo que não é dígito
  let digits = phone.replace(/\D/g, "");
  
  console.log(`[CAPTURA] Normalizando telefone bruto: "${phone}" -> dígitos: "${digits}"`);

  // Se o número for muito curto (menos de 8 dígitos), é inválido de cara
  if (digits.length < 8) {
    return { normalized: digits, isValid: false, reason: "Telefone muito curto" };
  }

  // Se tiver 12 ou 13 dígitos e começar com 55, remove o 55 (DDI Brasil)
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.substring(2);
    console.log(`[CAPTURA] Removido prefixo 55 -> "${digits}"`);
  }

  // Se o número tiver 9 dígitos e não tiver DDD, ele é problemático para salvar, 
  // mas vamos aceitar se tiver 10 ou 11 (DDD + Número)
  const isValid = digits.length >= 10 && digits.length <= 11;
  
  let reason;
  if (!isValid) {
    reason = `Formato suspeito (${digits.length} dígitos). Verifique o DDD.`;
  }

  return { 
    normalized: digits, 
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
            content: `Você é um especialista em OCR e extração de dados de alta precisão para logística (Shopee).
            Sua missão é extrair o NOME e o TELEFONE do DESTINATÁRIO da imagem.

            REGRAS CRÍTICAS:
            1. O NOME geralmente aparece próximo a "Destinatário:", "Recebedor:" ou em destaque no topo da etiqueta/detalhe do pedido.
            2. O TELEFONE pode estar formatado como (XX) XXXXX-XXXX, XX XXXXXXXXX, ou apenas números. 
            3. Ignore nomes de entregadores ou motoristas. Foque no CLIENTE.
            4. IMPORTANTE: Se o telefone parecer cortado ou incompleto, tente inferir os dígitos faltantes se o padrão for óbvio, caso contrário, retorne o que encontrar.
            5. Limpe o NOME de caracteres especiais como underscores (_), asteriscos (*) ou barras.
            6. Retorne OBRIGATORIAMENTE um JSON puro.

            FORMATO DE RETORNO (JSON):
            {
              "name": "Nome Completo",
              "phone": "Telefone (apenas números, incluindo DDD)",
              "confidence_name": 0.0 a 1.0,
              "confidence_phone": 0.0 a 1.0,
              "is_shopee_print": true/false,
              "observation": "Explique brevemente onde encontrou os dados"
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

    // Se a IA encontrou um telefone com confiança mínima, vamos tentar aceitar
    // mesmo que a normalização aponte problemas de DDD, para não perder o lead.
    if (phoneResult.normalized.length < 8) {
      finalNeedsReview = true;
      reviewReason = "Telefone não identificado ou muito curto";
    } else if (!hasName) {
      finalNeedsReview = true;
      reviewReason = "Nome não identificado";
    } else if (!phoneResult.isValid) {
      // Se tiver entre 8 e 9 dígitos, provavelmente falta o DDD, mas vamos salvar
      // e marcar para revisão apenas para o usuário conferir o DDD.
      finalNeedsReview = true;
      reviewReason = "Verificar DDD do telefone";
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
