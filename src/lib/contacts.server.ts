import { z } from "zod";

/**
 * Normaliza números brasileiros.
 * Aceita formatos como: (16) 99999-9999, +55 16 99999-9999, 5516999999999, etc.
 * Retorna apenas os dígitos relevantes sem o prefixo DDI 55 (se presente).
 */
export function normalizeBrazilianPhone(phone: string): { normalized: string; isValid: boolean; reason: string | undefined } {
  // Remove tudo que não é dígito
  let digits = phone.replace(/\D/g, "");
  
  // Se o número for muito curto (menos de 8 dígitos), é inválido de cara
  if (digits.length < 8) {
    return { normalized: digits, isValid: false, reason: "Telefone muito curto" };
  }

  // Se tiver 12 ou 13 dígitos e começar com 55, remove o 55 (DDI Brasil)
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.substring(2);
  }

  // O usuário quer que 10 ou 11 dígitos sejam considerados válidos (DDD + Número)
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

export async function analyzeImageForContacts(imageBase64: string, filename: string = "arquivo_upload.jpg") {
  console.log(`\n========== CAPTURA DEBUG ==========\n1. ARQUIVO:\n   nome: ${filename}\n   tamanho: ~${Math.round(imageBase64.length * 0.75 / 1024)} KB`);
  
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) {
    console.error("10. LOCAL DA DECISÃO: analyzeImageForContacts - Erro: API Key ausente");
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
      console.error(`10. LOCAL DA DECISÃO: analyzeImageForContacts - Erro API IA (${response.status})`);
      return {
        name: "Erro na IA",
        phone: "",
        needsReview: true,
        reviewReason: "Falha na comunicação com o provedor de IA"
      };
    }

    const result = await response.json();
    const rawContent = result.choices[0].message.content;
    console.log("2. RESULTADO BRUTO DO OCR/IA:", rawContent);
    
    const content = JSON.parse(rawContent);
    const rawName = content.name || "";
    const rawPhone = content.phone || "";
    
    console.log(`3. DADOS EXTRAÍDOS:\n   nome = ${rawName}\n   telefone = ${rawPhone}`);

    // Normalização e Validação
    const phoneResult = normalizeBrazilianPhone(rawPhone);
    const cleanName = rawName.replace(/_/g, " ").trim();
    const isNameValid = cleanName.length >= 2;
    const isPhoneValid = phoneResult.isValid;
    
    console.log(`4. DADOS NORMALIZADOS:\n   nome = ${cleanName}\n   telefone = ${phoneResult.normalized}`);
    console.log(`5. VALIDAÇÃO:\n   nome válido = ${isNameValid}\n   telefone válido = ${isPhoneValid}`);
    console.log(`6. CONFIANÇA:\n   confidence nome = ${content.confidence_name}\n   confidence telefone = ${content.confidence_phone}`);

    // Lógica de Classificação Final (REGRA DE NEGÓCIO SOLICITADA)
    // SE nome válido E telefone válido (DDD incluso) -> NÃO mandar para revisar.
    let finalNeedsReview = false;
    let reviewReason = "";

    if (isNameValid && isPhoneValid) {
      // Será decidido se é NOVO ou DUPLICADO na função saveContact (backend)
      finalNeedsReview = false;
      reviewReason = "";
    } else {
      finalNeedsReview = true;
      if (!isNameValid) reviewReason = "Nome não identificado ou inválido";
      else if (!isPhoneValid) reviewReason = phoneResult.reason || "Telefone inválido ou sem DDD";
    }

    console.log(`8. STATUS CALCULADO: ${finalNeedsReview ? 'review' : 'valid'}`);
    console.log(`9. MOTIVO: ${reviewReason || 'Dados Claros (Nome + Telefone válidos)'}`);
    console.log("10. LOCAL DA DECISÃO: analyzeImageForContacts (backend)\n====================================\n");

    return {
      name: cleanName || "Cliente",
      phone: phoneResult.normalized,
      needsReview: finalNeedsReview,
      reviewReason: reviewReason,
      raw_data: content
    };

  } catch (error) {
    console.error("10. LOCAL DA DECISÃO: analyzeImageForContacts - Exceção crítica");
    return {
      name: "Erro no Sistema",
      phone: "",
      needsReview: true,
      reviewReason: "Erro interno no processamento da imagem"
    };
  }
}