import { createServerFn } from "@tanstack/react-start";

export type ContentType = 'image' | 'video';
export type Category = 'trending' | 'news' | 'humor' | 'sports' | 'entertainment' | 'curiosities' | 'world' | 'brazil' | 'social' | 'games' | 'automotive';

const TRENDING_MOCK = [
  {
    subject: "Novas diretrizes econômicas no Brasil",
    image_url: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e",
    video_url: "",
    source_url: "https://noticias.uol.com.br/politica/ultimas-noticias/2026/08/17/diretrizes-economicas.htm",
    type: 'image' as const,
    category: 'news' as const,
    source: "UOL Notícias",
    score: 92,
    suggested_title: "Entenda o impacto das novas medidas na sua carteira",
    mentions: 28000,
  },
  {
    subject: "Escândalo nos bastidores da TV",
    image_url: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf",
    video_url: "",
    source_url: "https://oglobo.globo.com/cultura/noticia/2026/08/17/escandalo-tv.ghtml",
    type: 'image' as const,
    category: 'entertainment' as const,
    source: "O Globo",
    score: 85,
    suggested_title: "Exclusivo: A verdade por trás do cancelamento da série",
    mentions: 15000,
  },
  {
    subject: "Descoberta científica em Marte",
    image_url: "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9",
    video_url: "",
    source_url: "https://g1.globo.com/ciencia/noticia/2026/08/17/descoberta-marte.ghtml",
    type: 'image' as const,
    category: 'curiosities' as const,
    source: "G1 / Ciência",
    score: 78,
    suggested_title: "NASA encontra evidências de água líquida em cratera",
    mentions: 12000,
  },
  {
    subject: "Final do campeonato estadual",
    image_url: "https://images.unsplash.com/photo-1574629810360-7efbbe195018",
    video_url: "",
    source_url: "https://www.uol.com.br/esporte/futebol/campeonatos/2026/08/17/final-estadual.htm",
    type: 'image' as const,
    category: 'sports' as const,
    source: "UOL Esporte",
    score: 96,
    suggested_title: "Tudo o que você precisa saber sobre o clássico de domingo",
    mentions: 52000,
  },
  {
    subject: "Gatinho Pianista Viraliza",
    image_url: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba",
    video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    source_url: "https://www.tiktok.com/@catpianist/video/123456789",
    type: 'video' as const,
    category: 'humor' as const,
    source: "TikTok",
    score: 88,
    suggested_title: "Você não vai acreditar no que este gato fez",
    mentions: 32000,
  }
];

export const getViralContent = createServerFn({ method: "GET" })
  .validator((data: { category?: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    let query = supabaseAdmin.from('viral_contents').select('*');
    
    if (data.category && data.category !== 'trending') {
      query = query.eq('category', data.category);
    }
    
    const { data: results, error } = await query.order('score', { ascending: false });
    
    if (error) throw error;
    
    if (!results || results.length === 0) {
      // Usando upsert para garantir unicidade baseada no 'subject' (que agora tem restrição UNIQUE)
      await supabaseAdmin.from('viral_contents').upsert(
        TRENDING_MOCK, 
        { onConflict: 'subject' }
      );
      
      const { data: seeded } = await supabaseAdmin.from('viral_contents').select('*').order('score', { ascending: false });
      return seeded || [];
    }
    
    return results;
  });

export const refreshViralRadar = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from('viral_contents').select('*');
    
    if (existing) {
      for (const item of existing) {
        const currentScore = item.score ?? 0;
        const newScore = Math.min(100, Math.max(0, currentScore + (Math.random() * 10 - 5)));
        await supabaseAdmin.from('viral_contents').update({ 
          score: Math.floor(newScore),
          updated_at: new Date().toISOString()
        }).eq('id', item.id);
      }
    }
    
    return { success: true };
  });
