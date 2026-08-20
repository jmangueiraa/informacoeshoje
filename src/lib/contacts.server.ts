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

export async function analyzeImageForContacts(imageBase64: string, filename: string = "arquivo_upload.jpg", mimeType: string = "image/jpeg") {
  console.log(`\n========== CAPTURA GEMINI SDK DEBUG ==========`);
  console.log(`[DEBUG] Arquivo: ${filename}`);
  console.log(`[DEBUG] MimeType: ${mimeType}`);
  console.log(`[DEBUG] Tamanho Base64 recebido: ${imageBase64?.length}`);
  
  const apiKey = process.env['GEMINI_API_KEY'];
  console.log("[DEBUG] API Key presente?:", !!apiKey);

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

    // Chamada direta via fetch para o endpoint v1 (mais estável)
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const payload = {
      contents: [
        {
          parts: [
            {
              text: "Você é um extrator de contatos de comprovantes de entrega da Shopee. Encontre o bloco 'Informações do recebedor' ou destinatário. Extraia o nome da pessoa e o telefone com DDD. Retorne estritamente um JSON: {\"name\": \"...\", \"phone\": \"...\"}"
            },
            {
              inline_data: {
                mime_type: mimeType || "image/jpeg",
                data: cleanBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    };

    console.log("[DEBUG] Iniciando fetch direto para Gemini API v1...");
    const fetchResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!fetchResponse.ok) {
      const errorText = await fetchResponse.text();
      console.error("[DEBUG GEMINI ERROR RAW]:", fetchResponse.status, errorText);
      
      // Tenta fallback para v1beta se v1 falhar
      if (fetchResponse.status === 404) {
        console.log("[DEBUG] Fallback para v1beta...");
        const betaUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const betaResponse = await fetch(betaUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        
        if (!betaResponse.ok) {
          const betaError = await betaResponse.text();
          throw new Error(`Gemini API falhou em v1 e v1beta (v1beta status: ${betaResponse.status}): ${betaError}`);
        }
        
        const responseJson = await betaResponse.json();
        return parseGeminiResponse(responseJson);
      }
      
      throw new Error(`Gemini API falhou (${fetchResponse.status}): ${errorText}`);
    }

    const responseJson = await fetchResponse.json();
    return parseGeminiResponse(responseJson);

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
 * Função auxiliar para parsear a resposta do Gemini e manter a compatibilidade
 */
function parseGeminiResponse(responseJson: any) {
  const rawContent = responseJson.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log("[GEMINI_SUCCESS_TEXT]:", rawContent);
  
  if (!rawContent) {
    throw new Error("Resposta do Gemini vazia ou sem conteúdo textual");
  }
  
  let contactsData: any[] = [];
  try {
    const cleanJson = rawContent.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    contactsData = items.map((item: any) => ({
      name: item.name || "",
      phone: item.phone || "",
      ...item
    }));
  } catch (e) {
    console.error("[IMPORT] Erro ao parsear JSON do Gemini:", e);
    const jsonMatch = rawContent.match(/\[.*\]|\{.*\}/s);
    if (jsonMatch) {
      try {
        const parsedMatch = JSON.parse(jsonMatch[0]);
        const items = Array.isArray(parsedMatch) ? parsedMatch : [parsedMatch];
        contactsData = items.map((item: any) => ({
          name: item.name || "",
          phone: item.phone || ""
        }));
      } catch (innerError) {
        console.error("[IMPORT] Falha no fallback de parse:", innerError);
      }
    }
  }
  
  // Reutiliza a lógica de processamento já existente no analyzeImageForContacts (que foi mantida abaixo no arquivo)
  // Mas aqui precisamos retornar os contatos brutos para o mapeamento final
  return contactsData;
}

// Nota: A lógica de mapeamento e validação final foi movida para dentro do analyzeImageForContacts original
// Vou refatorar analyzeImageForContacts para usar esse novo fluxo.


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

      if (isNameValid && isPhoneValid) {
        finalNeedsReview = false;
        reviewReason = "";
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
    console.error("10. LOCAL DA DECISÃO: analyzeImageForContacts - Exceção Gemini SDK:", error);
    return {
      contacts: [],
      needsReview: true,
      reviewReason: "Erro no processamento Gemini SDK: " + (error instanceof Error ? error.message : String(error))
    };
  }
}