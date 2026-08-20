import { z } from "zod";

/**
 * Normaliza números brasileiros.
 * Aceita formatos como: (16) 99999-9999, +55 16 99999-9999, 5516999999999, etc.
 * Retorna apenas os dígitos relevantes sem o prefixo DDI 55 (se presente).
 */
export function normalizeBrazilianPhone(phone: string): { normalized: string; isValid: boolean; reason: string | undefined } {
  // Remove tudo que não é dígito
  let digits = phone.replace(/\D/g, "");
  
  // LOGICA AGRESSIVA DE EXTRAÇÃO DE DDD/NÚMERO
  // Se tiver 12 ou 13 dígitos e começar com 55, remove o 55 (DDI Brasil)
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.substring(2);
  }

  // Se o número começar com 0 e tiver 11 ou 12 dígitos, remove o 0 inicial
  if (digits.startsWith("0") && (digits.length === 11 || digits.length === 12)) {
    digits = digits.substring(1);
  }

  // Validação: No Brasil, números válidos com DDD tem 10 ou 11 dígitos.
  // Casos comuns em etiquetas: DDD colado ou espaços estranhos.
  const isValid = digits.length >= 10 && digits.length <= 11;
  
  let reason;
  if (digits.length < 8) {
    reason = "Telefone muito curto";
  } else if (!isValid) {
    reason = `Formato suspeito (${digits.length} dígitos). Verifique o DDD.`;
  }

  return { 
    normalized: digits, 
    isValid: isValid,
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
            content: `Você é um especialista em OCR e extração de dados para logística da SHOPEE.
            Sua única tarefa é extrair NOME e TELEFONE do DESTINATÁRIO das imagens enviadas.

            INSTRUÇÕES TÉCNICAS:
            1. IDENTIFICAÇÃO DO DESTINATÁRIO: Procure por "Destinatário:", "Consumidor:", "Recebedor:", ou pelo nome que geralmente aparece na metade superior esquerda de uma etiqueta de envio.
            2. NOME: Extraia o nome completo. Remova sufixos como (1/2) ou códigos estranhos se possível. Limpe underscore (_).
            3. TELEFONE: Procure por sequências numéricas de 10 a 11 dígitos. Muitas vezes aparece perto do nome ou em um campo "Telefone:".
            4. Se o telefone tiver 8 ou 9 dígitos sem DDD, retorne apenas os dígitos.
            5. IGNORE dados do Remetente.

            RETORNO OBRIGATÓRIO (JSON):
            {
              "name": "NOME DO CLIENTE",
              "phone": "SOMENTE DÍGITOS",
              "confidence": 0.0 a 1.0,
              "is_logistics_label": true/false
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
    
    console.log(`3. DADOS EXTRAÍDOS PELA IA:\n   nome = ${rawName}\n   telefone = ${rawPhone}`);

    // Normalização agressiva
    const phoneResult = normalizeBrazilianPhone(rawPhone);
    const cleanName = rawName.replace(/[_*]/g, " ").replace(/\s+/g, " ").trim();
    
    const isNameValid = cleanName.length >= 3 && !cleanName.toLowerCase().includes("shopee");
    const isPhoneValid = phoneResult.isValid;
    
    console.log(`4. PÓS-PROCESSAMENTO:\n   nome limpo = ${cleanName}\n   telefone normalizado = ${phoneResult.normalized}`);
    console.log(`5. VALIDAÇÃO:\n   nome ok = ${isNameValid}\n   telefone ok = ${isPhoneValid}`);

    // LOGICA DE REVISÃO
    let finalNeedsReview = false;
    let reviewReason = "";

    if (!isNameValid) {
      finalNeedsReview = true;
      reviewReason = "Nome não identificado claramente";
    } else if (!isPhoneValid) {
      finalNeedsReview = true;
      reviewReason = phoneResult.reason || "Telefone inválido (faltando DDD?)";
    } else {
      // Nome e Telefone parecem OK
      finalNeedsReview = false;
      reviewReason = "";
    }

    // Se o telefone for capturado MAS for curto, ainda salvamos mas pedimos revisão
    if (!isPhoneValid && phoneResult.normalized.length >= 8) {
       finalNeedsReview = true;
       reviewReason = "Telefone capturado sem DDD";
    }

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