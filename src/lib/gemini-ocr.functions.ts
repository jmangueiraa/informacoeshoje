import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const processarComprovanteComGemini = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    base64: z.string(),
    mimeType: z.string(),
    index: z.number(),
    apiKey: z.string()
  }).parse(data))
  .handler(async ({ data }) => {
    const { base64, mimeType, index, apiKey } = data;

    if (!apiKey) {
      return { 
        primeiroNome: `Cliente ${String(index + 1).padStart(5, '0')}`, 
        contato: 'Sem Chave API' 
      };
    }

    // Using gemini-1.5-flash as the multimodal model
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{
        parts: [
          {
            text: `Analise a imagem deste comprovante de entrega da Shopee/SPX e extraia:
1. primeiro_nome: Apenas o primeiro nome da pessoa recebedora (ex: Jéssica, Marta, Carlos, Antonia). NUNCA retorne ruídos como Beulé, Ifroe, Brc, nomes de ruas ou palavras de interface. Se não encontrar um nome humano real legível, retorne null.
2. contato: O número de WhatsApp/celular formatado no padrão (XX) 9XXXX-XXXX.

Responda estritamente em formato JSON:
{"primeiro_nome": "string ou null", "contato": "string"}`
          },
          {
            inlineData: {
              mimeType: mimeType || 'image/png',
              data: base64
            }
          }
        ]
      }],
      generationConfig: { 
        responseMimeType: 'application/json' 
      }
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Gemini API error: ${res.status} ${errorText}`);
      }

      const responseData = await res.json();
      
      if (!responseData.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error("Resposta da IA vazia ou inválida");
      }

      const parsed = JSON.parse(responseData.candidates[0].content.parts[0].text);
      
      const primeiroNome = parsed.primeiro_nome && parsed.primeiro_nome !== 'null'
        ? parsed.primeiro_nome
        : `Cliente ${String(index + 1).padStart(5, '0')}`;

      return {
        primeiroNome,
        contato: parsed.contato || 'Não encontrado'
      };
    } catch (err) {
      console.error('Erro na chamada multimodal Gemini:', err);
      return { 
        primeiroNome: `Cliente ${String(index + 1).padStart(5, '0')}`, 
        contato: 'Erro na leitura' 
      };
    }
  });
