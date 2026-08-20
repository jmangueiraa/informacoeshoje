
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

  // Lista de modelos para tentativa de fallback
  // Modelo recomendado: gemini-3.6-flash
  const models = ["gemini-3.6-flash"];
  let lastError = "";

  for (const model of models) {
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
        const errorText = await response.text();
        // Se for 404 (modelo não encontrado) ou 400 (parâmetro inválido para o modelo), tenta o próximo
        if (response.status === 404 || response.status === 400) {
          console.warn(`Modelo ${model} não disponível ou não suportado. Tentando fallback...`);
          lastError = `Erro Gemini (${response.status} no modelo ${model}): ${errorText}`;
          continue;
        }
        throw new Error(`Erro Gemini (${response.status}): ${errorText}`);
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
      if (err.message.includes("IA não retornou") || err.message.includes("formato inválido")) {
        throw err;
      }
      lastError = err.message;
      console.error(`Erro na tentativa com ${model}:`, err);
    }
  }

  throw new Error(`Falha em todos os modelos do Gemini. Último erro: ${lastError}`);
}
