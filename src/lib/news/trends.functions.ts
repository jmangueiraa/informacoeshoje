import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const TRENDS_MOCK = [
  {
    subject: "IA generativa no jornalismo",
    image_url: "https://images.unsplash.com/photo-1677442136019-21780ecad995",
    source: "Tech Trends",
    mentions: 12500,
    suggested_title: "Como a IA está transformando as redações em 2026",
  },
  {
    subject: "Reforma Tributária 2026",
    image_url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f",
    source: "O Globo",
    mentions: 35000,
    suggested_title: "O que muda no seu imposto de renda com a nova reforma",
  },
  {
    subject: "IA no mercado de trabalho",
    image_url: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e",
    source: "UOL Tech",
    mentions: 22000,
    suggested_title: "As profissões que mais serão impactadas pela IA este ano",
  },
  {
    subject: "Exploração espacial: Marte mais perto",
    image_url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa",
    source: "Space Daily",
    mentions: 15700,
    suggested_title: "Missão 2026: Primeiros humanos a caminho de Marte?",
  }
];

export const getTrendingTopics = createServerFn({ method: "GET" })
  .handler(async () => {
    // Em um cenário real, aqui chamaríamos uma API externa (Google Trends, etc.)
    // E atualizaríamos o banco de dados. Para o MVP, usaremos mocks e salvaremos no DB.
    
    const { data: existing } = await supabaseAdmin
      .from('trending_topics')
      .select('id')
      .limit(1);

    if (!existing || existing.length === 0) {
      await supabaseAdmin
        .from('trending_topics')
        .insert(TRENDS_MOCK);
    }

    const { data, error } = await supabaseAdmin
      .from('trending_topics')
      .select('*')
      .order('mentions', { ascending: false });

    if (error) throw error;
    return data;
  });

export const refreshTrendingTopics = createServerFn({ method: "POST" })
  .handler(async () => {
    // Limpa e recarrega para simular atualização
    await supabaseAdmin.from('trending_topics').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Simula variação nas menções
    const updatedMock = TRENDS_MOCK.map(t => ({
      ...t,
      mentions: Math.floor(t.mentions * (0.8 + Math.random() * 0.4)),
      trending_at: new Date().toISOString()
    }));

    const { data, error } = await supabaseAdmin
      .from('trending_topics')
      .insert(updatedMock)
      .select();

    if (error) throw error;
    return data;
  });
