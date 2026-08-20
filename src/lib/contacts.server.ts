import { z } from "zod";

/**
 * Normaliza números brasileiros.
 * Aceita formatos como: (16) 99999-9999, +55 16 99999-9999, 5516999999999, etc.
 * Retorna apenas os dígitos relevantes sem o prefixo DDI 55 (se presente).
 */
export function normalizeBrazilianPhone(phone: string | null | undefined): { normalized: string; isValid: boolean; reason: string | undefined } {
  if (!phone) {
    return { normalized: "", isValid: false, reason: "Telefone vazio ou não identificado" };
  }

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
  const isValid = digits.length >= 10 && digits.length <= 11;
  
  let reason;
  if (digits.length === 0) {
    reason = "Telefone não identificado";
  } else if (digits.length < 8) {
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
  console.log(`\n========== CAPTURA GEMINI DEBUG ==========\n1. ARQUIVO:\n   nome: ${filename}\n   tamanho: ~${Math.round(imageBase64.length * 0.75 / 1024)} KB`);
  
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    console.error("10. LOCAL DA DECISÃO: analyzeImageForContacts - Erro: GEMINI_API_KEY ausente");
    return {
      contacts: [],
      needsReview: true,
      reviewReason: "Configuração de IA (Gemini) ausente"
    };
  }

  const base64Data = imageBase64.includes('base64,') 
    ? imageBase64.split('base64,')[1] 
    : imageBase64;

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      }
    });

    const prompt = `Você é um extrator de dados de comprovantes de entrega e logística (Shopee/Transportadoras).
    Analise a imagem e localize os dados da pessoa que recebeu ou vai receber o pedido.
    Procure por rótulos como: "Informações do recebedor", "Recebedor", "Destinatário", "Comprador", "Cliente".

    Regras:
    1. Extraia o nome completo da pessoa. Remova pontuações soltas ou caracteres especiais das pontas (como _ ou -).
    2. Extraia o número de telefone completo (incluindo DDD). Extraia apenas os dígitos.
    
    Retorne estritamente o JSON:
    {
      "name": "Nome da pessoa",
      "phone": "Telefone com DDD (somente dígitos)"
    }
    Se absolutamente nenhum nome ou telefone for legível, retorne:
    {
      "name": "",
      "phone": ""
    }`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data || "",
          mimeType: "image/jpeg"
        }
      }
    ]);

    const response = await result.response;
    let rawContent = response.text();
    console.log("[IMPORT] Resposta bruta do Gemini:", rawContent);
    
    // Sanitização rigorosa de JSON
    if (rawContent.includes("```")) {
      rawContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
    }
    
    // Às vezes o Gemini retorna apenas um objeto em vez de um array se houver apenas um contato.
    // Vamos garantir que seja um array.
    let contactsData: any[] = [];
    try {
      const parsed = JSON.parse(rawContent);
      contactsData = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      console.error("[IMPORT] Erro ao parsear JSON do Gemini:", e);
      // Fallback: tentar encontrar JSON no texto se houver lixo em volta
      const jsonMatch = rawContent.match(/\[.*\]|\{.*\}/s);
      if (jsonMatch) {
        const parsedMatch = JSON.parse(jsonMatch[0]);
        contactsData = Array.isArray(parsedMatch) ? parsedMatch : [parsedMatch];
      }
    }

    const processedContacts = contactsData.map(content => {
      const rawName = content.name || "";
      const rawPhone = content.phone || "";
      
      const phoneResult = normalizeBrazilianPhone(rawPhone);
      const cleanName = rawName
        .replace(/Tel|Nome|Contato|Recebedor/gi, "") // Remove palavras de sistema
        .replace(/^[^a-zA-ZáéíóúÁÉÍÓÚñÑ]+|[^a-zA-ZáéíóúÁÉÍÓÚñÑ]+$/g, "") // Remove caracteres não alfabéticos das bordas
        .replace(/\s+/g, " ")
        .trim();
      
      const isErrorString = (s: string) => ["erro", "null", "undefined", "cliente", "desconhecido"].includes(s.toLowerCase());
      const isNameValid = cleanName.length >= 2 && !isErrorString(cleanName) && !cleanName.toLowerCase().includes("shopee") && !cleanName.toLowerCase().includes("entrega");
      const isPhoneValid = phoneResult.isValid || (phoneResult.normalized.length >= 8 && phoneResult.normalized.length <= 13);

      let finalNeedsReview = false;
      let reviewReason = "";

      if (!isNameValid) {
        finalNeedsReview = true;
        reviewReason = "Nome não identificado claramente";
      } else if (!isPhoneValid) {
        if (phoneResult.normalized.length >= 8 && phoneResult.normalized.length < 10) {
          finalNeedsReview = true;
          reviewReason = "Telefone capturado sem DDD";
        } else {
          finalNeedsReview = true;
          reviewReason = phoneResult.reason || "Telefone inválido";
        }
      }

      return {
        name: cleanName || "Cliente",
        phone: phoneResult.normalized,
        needsReview: finalNeedsReview,
        reviewReason: reviewReason,
        raw_data: content
      };
    });

    return {
      contacts: processedContacts,
      needsReview: processedContacts.length === 0,
      reviewReason: processedContacts.length === 0 ? "Nenhum contato legível encontrado" : ""
    };

  } catch (error) {
    console.error("10. LOCAL DA DECISÃO: analyzeImageForContacts - Exceção Gemini:", error);
    return {
      contacts: [],
      needsReview: true,
      reviewReason: "Erro no processamento Gemini: " + (error instanceof Error ? error.message : String(error))
    };
  }
}