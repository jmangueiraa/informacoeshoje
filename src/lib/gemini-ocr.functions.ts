import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const processarTextoComGemini = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    textoBruto: z.string(),
    apiKey: z.string(),
    index: z.number()
  }).parse(data))
  .handler(async ({ data }) => {
    const { textoBruto, apiKey, index } = data;
    const fallbackNome = `Cliente ${String(index + 1).padStart(5, '0')}`;
    
    if (!apiKey) {
      return extrairRegexLocal(textoBruto, fallbackNome);
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = `
Extraia os dados do recebedor deste comprovante de entrega:
Texto:
"""
${textoBruto}
"""

Regras:
1. primeiro_nome: Retorne apenas o primeiro nome próprio da pessoa recebedora (ex: Jessica, Marta, Antonia, Dario, Igor). Descarte termos como 'Beule', 'Ifroe', 'Br', 'Estrada', 'Entregue', 'Hub'. Se não houver nome claro, retorne null.
2. contato: Retorne o celular formatado como '(XX) 9XXXX-XXXX'.

Formato de resposta JSON obrigatório:
{"primeiro_nome": "NomeOuNull", "contato": "(XX) 9XXXX-XXXX"}
`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });

      if (!res.ok) throw new Error('Falha na resposta da API');

      const responseData = await res.json();
      const json = JSON.parse(responseData.candidates[0].content.parts[0].text);

      return {
        primeiroNome: json.primeiro_nome && json.primeiro_nome !== 'null' ? json.primeiro_nome : fallbackNome,
        contato: json.contato || 'Não encontrado'
      };
    } catch (e) {
      console.error('Fallback acionado:', e);
      return extrairRegexLocal(textoBruto, fallbackNome);
    }
  });

function extrairRegexLocal(texto: string, fallbackNome: string) {
  let contato = 'Não encontrado';
  const matchTel = texto.match(/(?:tel|\+55)?\s*\(?(\d{2})\)?\s*(9?\d{4})[-.\s]?(\d{4})/i) || texto.match(/\b55(\d{2})(\d{5})(\d{4})\b/);
  if (matchTel) {
    if (matchTel[0].startsWith('55') && matchTel[0].length >= 12) {
      const ddd = matchTel[0].substring(2, 4);
      const p1 = matchTel[0].substring(4, 9);
      const p2 = matchTel[0].substring(9);
      contato = `(${ddd}) ${p1}-${p2}`;
    } else if (matchTel[1] && matchTel[2] && matchTel[3]) {
      contato = `(${matchTel[1]}) ${matchTel[2]}-${matchTel[3]}`;
    }
  }
  return { primeiroNome: fallbackNome, contato };
}
