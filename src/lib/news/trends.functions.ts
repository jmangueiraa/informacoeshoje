import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const TRENDS_MOCK = [
  {
    subject: "IA generativa no jornalismo",
    image_url: "https://images.unsplash.com/photo-1677442136019-21780ecad995",
    source: "Unsplash / Tech Trends",
    mentions: 12500,
    suggested_title: "Como a IA está transformando as redações em 2026",
  },
  {
    subject: "Crise climática e soluções globais",
    image_url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05",
    source: "Unsplash / Eco News",
    mentions: 8900,
    suggested_title: "Novas tecnologias prometem frear aquecimento global",
  },
  {
    subject: "Exploração espacial: Marte mais perto",
    image_url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa",
    source: "Unsplash / Space Daily",
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
