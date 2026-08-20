
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

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

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
}
