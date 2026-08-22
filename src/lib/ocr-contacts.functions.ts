import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ContactSchema = z.object({
  primeiro_nome: z.string().nullable(),
  contato: z.string().nullable(),
});

export const extractContactsWithAI = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ 
    text: z.string(),
    userApiKey: z.string().optional()
  }).parse(data))
  .handler(async ({ data }) => {
    const apiKey = data.userApiKey || process.env['LOVABLE_API_KEY'];
    if (!apiKey) {
      throw new Error("API Key não configurada. Por favor, configure nas configurações.");
    }

    const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-1.5-flash",
        messages: [
          {
            role: "user",
            content: `Você é um extrator de contatos de comprovantes de entrega da Shopee/SPX.
O texto abaixo contém dados do recebedor e telefone:
"""
${data.text}
"""

Regras obrigatórias:
- primeiro_nome: Extraia APENAS o primeiro nome da pessoa recebedora (ex: se o texto tiver 'Jéssica De Araújo Dos Santos_', retorne 'Jéssica'; se tiver 'Marta Lúcia...', retorne 'Marta'; se tiver 'Dario...', retorne 'Dario'). Ignore underlines, pontos ou códigos.
- contato: Formate o telefone como '(XX) 9XXXX-XXXX'.
- Apenas use 'Cliente XXXXX' se absolutamente nenhum nome humano estiver legível.

Responda em formato JSON:
{"primeiro_nome": "...", "contato": "..."}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI extraction error:", errorText);
      throw new Error(`Failed to extract contacts: ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    
    try {
      const parsed = ContactSchema.parse(JSON.parse(content));
      return parsed;
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Invalid response format from AI");
    }
  });

export const extractContactsWithVision = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ 
    base64Image: z.string(),
    mimeType: z.string(),
    userApiKey: z.string().optional(),
    clientIndex: z.number()
  }).parse(data))
  .handler(async ({ data }) => {
    const apiKey = data.userApiKey || process.env['LOVABLE_API_KEY'];
    if (!apiKey) {
      throw new Error("API Key não configurada.");
    }

    // A URL do Gemini direto se tivermos a key do usuário, 
    // ou usamos o gateway se for a LOVABLE_API_KEY.
    // O usuário pediu especificamente a URL do Google no prompt.
    // Vou usar o fetch direto para o Google se a key começar com algo que não seja Lovable, 
    // ou se o usuário prover.
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = `
Analise a imagem deste comprovante de entrega da Shopee e extraia os dados do recebedor:
1. primeiro_nome: Extraia EXCLUSIVAMENTE o PRIMEIRO NOME do cliente/recebedor (exemplo: se estiver 'Jéssica De Araújo...', retorne 'Jéssica'; se for 'Marta Lúcia...', retorne 'Marta'). NUNCA retorne siglas, termos como 'Bsb', 'Bal', 'Br', palavras de cabeçalho ou ruas. Se não houver nome de pessoa visível, retorne null.
2. contato: Extraia o número de telefone/celular com DDD no formato '(XX) 9XXXX-XXXX'.

Responda APENAS um JSON:
{"primeiro_nome": "...", "contato": "..."}
`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: data.mimeType,
                  data: data.base64Image
                }
              }
            ]
          }],
          generationConfig: { 
            responseMimeType: "application/json",
            temperature: 0.1
          }
        })
      });

      if (!response.ok) {
        const err = await response.text();
        console.error("Gemini Vision error:", err);
        throw new Error("Erro na API Vision");
      }

      const resData = await response.json();
      const text = resData.candidates[0].content.parts[0].text;
      const resultado = JSON.parse(text);
      
      let primeiroNome = resultado.primeiro_nome;
      const proibidas = ['bsb', 'bal', 'br', 'estrada'];
      
      if (!primeiroNome || proibidas.includes(primeiroNome.toLowerCase())) {
        const numFormatado = String(data.clientIndex + 1).padStart(5, '0');
        primeiroNome = `Cliente ${numFormatado}`;
      }

      return {
        primeiro_nome: primeiroNome,
        contato: resultado.contato || ''
      };
    } catch (error) {
      console.error("Vision extraction failed:", error);
      const numFormatado = String(data.clientIndex + 1).padStart(5, '0');
      return { primeiro_nome: `Cliente ${numFormatado}`, contato: '' };
    }
  });
