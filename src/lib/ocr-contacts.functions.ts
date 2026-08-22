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

    // We use the Lovable AI Gateway for safety and reliability, pointing it to the Gemini model
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
            content: `Você é um extrator de dados especializado em comprovantes de entrega (Shopee/SPX).
Sua tarefa é analisar o texto bruto vindo de um OCR e extrair informações do recebedor com precisão absoluta para EXATAMENTE UM contato por imagem.

Regras de Extração e Localização:
1. Como localizar o Nome:
   - O nome da pessoa está SEMPRE localizado no bloco de texto 'Informações do recebedor'.
   - Ele é a primeira palavra da PRIMEIRA linha útil que aparece imediatamente após o cabeçalho 'Informações do recebedor'.
   - Se houver quebra de linha (ex: nome em uma linha e sobrenome na outra), capture APENAS a primeira palavra da primeira linha (ex: "Jéssica").
   - NUNCA pegue palavras de outros blocos como 'Detalhes', 'Entregue', 'Rua', 'Informações' ou códigos de rastreio.
   - Remova pontos finais ou caracteres extras (ex: "Viviane." vira "Viviane"; "Marta Lúcia..." vira "Marta").
   - Se o bloco 'Informações do recebedor' estiver vazio ou ilegível, use a linha imediatamente ACIMA da linha do telefone como fallback, pegando a primeira palavra.

2. Como localizar o Celular/Contato:
   - O telefone está SEMPRE na linha que começa com "Tel", "Tel:", "Telefone" ou "+55".
   - Capture o número de telefone completo. Remova o +55 se houver.
   - NUNCA capture códigos de rastreio (ex: sequências numéricas longas que começam com 26... ou códigos que começam com BR) no campo de telefone.
   - Formate o número final como (XX) 9XXXX-XXXX (ex: +5516991272583 deve virar (16) 99127-2583).

3. Saída:
   - Retorne EXCLUSIVAMENTE um objeto JSON no formato {"primeiro_nome": "...", "contato": "(XX) 9XXXX-XXXX"}.

Texto para análise:
${data.text}`
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