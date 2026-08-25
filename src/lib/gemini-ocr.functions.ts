import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeContactPhone } from "./phone";

export function extrairPrimeiroNomeReal(textoBruto: string, index: number): string {
  const linhas = textoBruto
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const blacklist = [
    'br', 'bra', 'brg', 'bsb', 'bal', 'ball', 'bull', 'bem', 'bém', 'beaule', 'beaulé', 
    'bragança', 'braganca', 'estrada', 'rua', 'avenida', 'av', 'entregue', 'detalhes', 
    'informações', 'informacoes', 'recebedor', 'pedido', 'tempo', 'tel', 'screenshot', 
    'hub', 'lm', 'spx', 'shopee', 'não', 'encontrado', 'cliente', 'destinatario', 'para'
  ];

  // Localiza a linha do telefone
  const indexTel = linhas.findIndex(l => /tel|\+55|\b55\d{8,11}\b|\(\d{2}\)/i.test(l));

  // 1. Procura especificamente na linha imediatamente anterior ao telefone
  if (indexTel > 0) {
    for (let i = indexTel - 1; i >= 0; i--) {
      const linha = linhas[i];
      if (!linha) continue;
      // Pega as palavras da linha que tenham apenas letras
      const palavras = linha.split(/[\s,.-]+/).map(p => p.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '').trim()).filter(p => p.length >= 3);
      
      for (const palavra of palavras) {
        if (!blacklist.includes(palavra.toLowerCase())) {
          return palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase();
        }
      }
    }
  }

  // 2. Se não achar antes do telefone, varre o texto completo ignorando a blacklist
  for (const linha of linhas) {
    const palavras = linha.split(/[\s,.-]+/).map(p => p.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '').trim()).filter(p => p.length >= 3);
    for (const palavra of palavras) {
      if (!blacklist.includes(palavra.toLowerCase())) {
        return palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase();
      }
    }
  }

  return `Cliente ${String(index + 1).padStart(5, '0')}`;
}

export const processarTextoComGemini = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    textoBruto: z.string(),
    apiKey: z.string(),
    index: z.number()
  }).parse(data))
  .handler(async ({ data }) => {
    const { textoBruto, apiKey, index } = data;
    
    // Log para depuração solicitado pelo usuário
    console.log('TEXTO_BRUTO_OCR:', textoBruto);

    const fallbackNome = extrairPrimeiroNomeReal(textoBruto, index);
    
    if (!apiKey) {
      return { primeiroNome: fallbackNome, contato: extrairTelefoneValido(textoBruto) };
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = `
Extraia os dados do recebedor deste comprovante de entrega:
Texto:
"""
${textoBruto}
"""

Regras:
1. primeiro_nome: Retorne apenas o primeiro nome próprio da pessoa recebedora. Use o texto bruto como referência.
2. contato: Retorne apenas os números brutos (apenas dígitos).

Formato de resposta JSON obrigatório:
{"primeiro_nome": "NomeOuNull", "contato": "ApenasNumeros"}
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
      
      let contato = 'Não encontrado';
      if (json.contato) {
        contato = extrairTelefoneValido(json.contato);
        if (contato === 'Não encontrado') {
          contato = extrairTelefoneValido(textoBruto);
        }
      }

      // Se a IA falhar no nome ou retornar algo genérico, usa a nova lógica local
      const nomeIA = json.primeiro_nome && json.primeiro_nome !== 'null' ? json.primeiro_nome : null;
      
      return {
        primeiroNome: nomeIA || fallbackNome,
        contato
      };
    } catch (e) {
      console.error('Fallback acionado:', e);
      return { primeiroNome: fallbackNome, contato: extrairTelefoneValido(textoBruto) };
    }
  });

export function extrairTelefoneValido(textoBruto: string): string {
  const candidates: string[] = [];
  const linhas = textoBruto.split('\n');

  for (const linha of linhas) {
    if (/tel|telefone|contato|cel|whats|\+55/i.test(linha)) {
      candidates.push(linha);
    }
  }

  candidates.push(textoBruto);

  for (const candidate of candidates) {
    const digitGroups = candidate.match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}/g) || [];
    for (const group of digitGroups) {
      const normalized = normalizeContactPhone(group);
      if (normalized.length === 10 || normalized.length === 11) {
        return normalized;
      }
    }

    const compact = normalizeContactPhone(candidate);
    if (compact.length === 10 || compact.length === 11) {
      return compact;
    }
  }

  return 'Não encontrado';
}
