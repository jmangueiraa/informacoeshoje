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
  console.log(`\n========== CAPTURA GEMINI DEBUG ==========`);
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

  const base64Data = imageBase64;

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    // Chamada direta via fetch para diagnóstico detalhado
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType || "image/jpeg",
                data: base64Data
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

    console.log("[DEBUG] Iniciando fetch para Gemini API...");
    const fetchResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!fetchResponse.ok) {
      const errorText = await fetchResponse.text();
      console.error("[DEBUG GEMINI ERROR RAW]:", fetchResponse.status, errorText);
      throw new Error(`Gemini API falhou (${fetchResponse.status}): ${errorText}`);
    }

    const responseJson = await fetchResponse.json();
    const rawContent = responseJson.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log("[DEBUG GEMINI SUCCESS TEXT]:", rawContent);
    
    if (!rawContent) {
      throw new Error("Resposta do Gemini vazia ou sem conteúdo textual");
    }
    
    let contactsData: any[] = [];
    try {
      // Limpeza de markdown e caracteres invisíveis
      const cleanJson = rawContent.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      
      // Mapeia para garantir compatibilidade com o retorno esperado pelo processador
      const items = Array.isArray(parsed) ? parsed : [parsed];
      contactsData = items.map(item => ({
        name: item.name || "",
        phone: item.phone || "",
        ...item
      }));
    } catch (e) {
      console.error("[IMPORT] Erro ao parsear JSON do Gemini:", e);
      // Fallback: tentar encontrar JSON no texto se houver lixo em volta
      const jsonMatch = rawContent.match(/\[.*\]|\{.*\}/s);
      if (jsonMatch) {
        try {
          const parsedMatch = JSON.parse(jsonMatch[0]);
          const items = Array.isArray(parsedMatch) ? parsedMatch : [parsedMatch];
          contactsData = items.map(item => ({
            name: item.name || "",
            phone: item.phone || ""
          }));
        } catch (innerError) {
          console.error("[IMPORT] Falha no fallback de parse:", innerError);
        }
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

      // Se encontrar nome e telefone válidos, garante que o status seja 'new' (needsReview: false)
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
    console.error("10. LOCAL DA DECISÃO: analyzeImageForContacts - Exceção Gemini:", error);
    return {
      contacts: [],
      needsReview: true,
      reviewReason: "Erro no processamento Gemini: " + (error instanceof Error ? error.message : String(error))
    };
  }
}