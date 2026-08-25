import { normalizeContactPhone } from "./phone";

/**
 * Normaliza números brasileiros.
 * Aceita formatos como: (16) 99999-9999, +55 16 99999-9999, 5516999999999, etc.
 * Retorna apenas os dígitos relevantes sem o prefixo DDI 55 (se presente).
 */
export function normalizeBrazilianPhone(phone: string | null | undefined): { normalized: string; isValid: boolean; reason: string | undefined } {
  if (!phone) {
    return { normalized: "", isValid: false, reason: "Telefone vazio ou não identificado" };
  }

  const digits = normalizeContactPhone(phone);

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
      
      // Função de sanitização rigorosa conforme solicitado no backend/frontend
      const cleanAndValidateName = (name: string): string => {
        if (!name) return "ILEGÍVEL";
        
        // 1. Remove pontos, sublinhados, traços, asteriscos, tils
        const sanitized = name.replace(/[\._\-\*~]/g, '').trim();
        
        // 2. Se tiver menos de 3 letras válidas ou tiver caracteres de truncamento (..)
        // Note: O regex /[\.]{2,}/.test(name) verifica o original para detectar truncamento/reticências
        if (sanitized.length < 3 || /[\.]{2,}/.test(name)) {
          return "ILEGÍVEL";
        }
        
        return sanitized;
      };

      const sanitized = cleanAndValidateName(rawName);
      let cleanName = "";
      
      if (sanitized === "ILEGÍVEL") {
        cleanName = "ILEGÍVEL"; 
      } else {
        const firstName = sanitized.split(' ')[0] || "";
        const cleaned = firstName.replace(/[^a-zA-ZÀ-ÿ]/g, '');
        if (cleaned.length < 3) {
          cleanName = "ILEGÍVEL";
        } else {
          cleanName = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
        }
      }
      
      const isNameIllegible = cleanName === "ILEGÍVEL";
      let finalNeedsReview = false;
      let reviewReason = "";

      // phoneResult já foi declarado na linha 133
      const isPhoneValid = phoneResult.isValid || (phoneResult.normalized.length >= 8 && phoneResult.normalized.length <= 15);

      // Regra: Se o telefone for válido, o status é OK (não precisa de revisão)
      if (isPhoneValid) {
        finalNeedsReview = false;
        reviewReason = "";
      } else {
        finalNeedsReview = true;
        reviewReason = isNameIllegible ? "Nome ilegível e telefone inválido" : (phoneResult.reason || "Telefone inválido");
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
