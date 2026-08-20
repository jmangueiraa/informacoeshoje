
/**
 * Utilitário para chamada direta à API do Gemini no frontend.
 * Isso permite depuração imediata e evita intermediários no servidor para a extração OCR.
 */
export async function extractContactFromGemini(imageBase64: string, mimeType: string = "image/jpeg") {
  // Tenta ler do localStorage primeiro, depois do env, depois do fallback padrão
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY_LOCAL') : null;
  const apiKey = storedKey || import.meta.env['VITE_GEMINI_API_KEY'] || "AQ.Ab8RN6JmrTCG3VhxLQnIrq0PjpCSbiiKEJZMZxukNvh1PQprgA";
  
  if (!apiKey) {
    throw new Error("API Key do Gemini não encontrada.");
  }

  // Garante que o base64 está limpo (sem prefixo data:image/...)
  const cleanBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;


  const model = "gemini-3.6-flash";
  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Você é um leitor de etiquetas e telas de pedidos/entrega da Shopee. Encontre o nome do destinatário/recebedor em 'Informações do recebedor' e o número de telefone com DDD. Retorne ESTRITAMENTE um JSON no formato: {\"name\": \"Nome\", \"phone\": \"Telefone com DDD\"}. Se houver múltiplos, retorne um array de objetos JSON."
              },
              {
                inlineData: {
                  mimeType: mimeType,
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
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 429) {
        // Tenta extrair retryDelay: "44s"
        let retrySeconds = 60;
        const details = errorData.error?.details || [];
        const quotaFailure = details.find((d: any) => d.retryDelay);
        
        if (quotaFailure && quotaFailure.retryDelay) {
          const match = quotaFailure.retryDelay.match(/(\d+)s/);
          if (match) retrySeconds = parseInt(match[1], 10);
        }

        const error: any = new Error("RESOURCE_EXHAUSTED");
        error.status = 429;
        error.retryAfter = retrySeconds;
        throw error;
      }

      throw new Error(`Erro Gemini (${response.status}): ${errorData.error?.message || JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawText) {
      throw new Error("A IA não retornou nenhum texto processável.");
    }

    try {
      const parsed = JSON.parse(rawText);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      console.error("Falha ao parsear JSON da IA:", rawText);
      throw new Error("A IA retornou um formato inválido: " + rawText.substring(0, 100));
    }
  } catch (err: any) {
    console.error(`Erro na chamada Gemini:`, err);
    throw err;
  }
}

