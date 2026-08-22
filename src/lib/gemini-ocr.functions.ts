import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
  // 1. Procura primeiro pela linha que contém 'Tel' ou '+55'
  const linhas = textoBruto.split('\n');
  for (const linha of linhas) {
    if (/tel|\+55/i.test(linha)) {
      const apenasDigitos = linha.replace(/\D/g, '');
      
      // Se começar com 55 e tiver 13 dígitos (55 + DDD + 9 dígitos)
      if (apenasDigitos.startsWith('55') && apenasDigitos.length === 13) {
        const ddd = apenasDigitos.substring(2, 4);
        const p1 = apenasDigitos.substring(4, 9);
        const p2 = apenasDigitos.substring(9, 13);
        return `(${ddd}) ${p1}-${p2}`;
      }
      
      // Se tiver 11 dígitos direto (DDD + 9 dígitos)
      if (apenasDigitos.length === 11 && (apenasDigitos[2] === '9' || apenasDigitos.length === 11)) {
        const ddd = apenasDigitos.substring(0, 2);
        const p1 = apenasDigitos.substring(2, 7);
        const p2 = apenasDigitos.substring(7, 11);
        return `(${ddd}) ${p1}-${p2}`;
      }
    }
  }

  // 2. Fallback de busca global no texto inteiro
  const todosNumeros = textoBruto.replace(/\D/g, ' ');
  const blocos = todosNumeros.split(/\s+/).filter(b => b.length >= 10);

  for (const b of blocos) {
    if (b.startsWith('55') && b.length === 13) {
      return `(${b.substring(2, 4)}) ${b.substring(4, 9)}-${b.substring(9, 13)}`;
    }
    if (b.length === 11 && b[2] === '9') {
      return `(${b.substring(0, 2)}) ${b.substring(2, 7)}-${b.substring(7, 11)}`;
    }
  }

  return 'Não encontrado';
}
