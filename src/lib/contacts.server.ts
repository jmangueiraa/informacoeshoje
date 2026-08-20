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
  // Se tiver de 12 a 13 dígitos e começar com 55, remove o 55 (DDI Brasil)
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

/**
 * Função principal para analisar a imagem e extrair contatos
 */
export async function analyzeImageForContacts(imageBase64: string, filename: string = "arquivo_upload.jpg", mimeType: string = "image/jpeg") {
  console.log(`\n========== CAPTURA GEMINI DEBUG ==========`);
  console.log(`[DEBUG] Arquivo: ${filename}`);
  console.log(`[DEBUG] MimeType: ${mimeType}`);
  console.log(`[DEBUG] Tamanho Base64 recebido: ${imageBase64?.length}`);
  
  const apiKey = process.env['GEMINI_API_KEY'] || "AQ.Ab8RN6JmrTCG3VhxLQnIrq0PjpCSbiiKEJZMZxukNvh1PQprgA";
  
  if (!apiKey) {
    console.error("10. LOCAL DA DECISÃO: analyzeImageForContacts - Erro: GEMINI_API_KEY ausente");
    return {
      contacts: [],
      needsReview: true,
      reviewReason: "Configuração de IA (Gemini) ausente"
    };
  }

  try {
    // Garante que o base64 está limpo (sem prefixo data:image/...)
    const cleanBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;

    // Tentativa com v1 (mais estável em alguns ambientes edge)
    const promptText = "Você é um especialista em OCR para logística. Analise esta imagem de comprovante da Shopee e extraia o NOME e TELEFONE do recebedor/destinatário. O telefone geralmente está próximo ao nome ou no campo 'Contato'. Extraia apenas o NOME e o TELEFONE com DDD. Responda APENAS um JSON no formato: {\"name\": \"...\", \"phone\": \"...\"}. Se encontrar múltiplos, retorne uma lista de objetos JSON.";
    
    let contactsData: any[] = [];
    
    try {
      console.log("[DEBUG] Iniciando fetch para Gemini API v1beta...");
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: promptText },
              { inline_data: { mime_type: mimeType || "image/jpeg", data: cleanBase64 } }
            ]
          }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[DEBUG] Requisição falhou (${response.status}): ${errorText}. Tentando novamente com o mesmo modelo em v1beta...`);
        
        // Fallback para v1beta
        const betaUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
        const betaResponse = await fetch(betaUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: promptText },
                { inline_data: { mime_type: mimeType || "image/jpeg", data: cleanBase64 } }
              ]
            }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
          })
        });

        if (!betaResponse.ok) {
          throw new Error(`Gemini API falhou em ambas as tentativas.`);
        }
        
        const betaJson = await betaResponse.json();
        contactsData = parseGeminiJson(betaJson);
      } else {
        const v1Json = await response.json();
        contactsData = parseGeminiJson(v1Json);
      }
    } catch (apiErr) {
      console.error("[DEBUG] Erro em ambas as versões da API:", apiErr);
      throw apiErr;
    }

    // Processamento e normalização dos contatos extraídos
    const processedContacts = contactsData.map(content => {
      const rawName = content.name || "";
      const rawPhone = content.phone || "";
      
      const phoneResult = normalizeBrazilianPhone(rawPhone);
      
      // Normalização agressiva: Captura apenas o primeiro nome em Title Case
      const rawCleanedName = rawName
        .replace(/Tel|Nome|Contato|Recebedor|Destinatário/gi, "")
        .replace(/[_*]/g, " ")
        .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
        
      const firstName = rawCleanedName.split(' ')[0] || "Cliente";
      const cleanName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
      
      const isErrorString = (s: string) => ["erro", "null", "undefined", "cliente", "desconhecido"].includes(s.toLowerCase());
      const isNameValid = cleanName.length >= 2 && !isErrorString(cleanName) && !cleanName.toLowerCase().includes("shopee") && !cleanName.toLowerCase().includes("entrega");
      const isPhoneValid = phoneResult.isValid || (phoneResult.normalized.length >= 8 && phoneResult.normalized.length <= 15);

      let finalNeedsReview = false;
      let reviewReason = "";

      // Alteração na regra: Se o telefone for válido, NÃO marca para revisão mesmo com nome inválido
      if (isPhoneValid) {
        finalNeedsReview = false;
        reviewReason = "";
      } else if (!isNameValid) {
        finalNeedsReview = true;
        reviewReason = "Nome não identificado claramente";
      } else {
        finalNeedsReview = true;
        reviewReason = phoneResult.reason || "Telefone inválido";
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
    console.error("10. LOCAL DA DECISÃO: analyzeImageForContacts - Exceção:", error);
    return {
      contacts: [],
      needsReview: true,
      reviewReason: "Erro no processamento Gemini: " + (error instanceof Error ? error.message : String(error))
    };
  }
}

/**
 * Helper para extrair JSON da resposta da API
 */
function parseGeminiJson(responseJson: any): any[] {
  const rawContent = responseJson.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log("[GEMINI_RAW_RESPONSE]:", rawContent);
  
  if (!rawContent) return [];
  
  try {
    const cleanJson = rawContent.replace(/```json|```/gi, '').trim();
    const parsed = JSON.parse(cleanJson);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    const jsonMatch = rawContent.match(/\[.*\]|\{.*\}/s);
    if (jsonMatch) {
      try {
        const parsedMatch = JSON.parse(jsonMatch[0]);
        return Array.isArray(parsedMatch) ? parsedMatch : [parsedMatch];
      } catch (inner) {
        return [];
      }
    }
    return [];
  }
}
