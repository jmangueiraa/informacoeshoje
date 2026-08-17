import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

export type ContentType = 'image' | 'video';
export type Category = 'trending' | 'news' | 'humor' | 'sports' | 'entertainment' | 'curiosities' | 'world' | 'brazil' | 'social' | 'games' | 'automotive';

const TRENDING_MOCK = [
  {
    subject: "Novo Recorde no Futebol",
    image_url: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2",
    video_url: "",
    type: 'image' as const,
    category: 'sports' as const,
    source: "Global Sports",
    score: 95,
    suggested_title: "Fenômeno quebra recorde histórico hoje",
    mentions: 45000,
  },
  {
    subject: "Gatinho Pianista Viraliza",
    image_url: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba",
    video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    type: 'video' as const,
    category: 'humor' as const,
    source: "TikTok",
    score: 88,
    suggested_title: "Você não vai acreditar no que este gato fez",
    mentions: 32000,
  }
];

export const getViralContent = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ category: z.string().optional() }).parse(data))
  .handler(async ({ data }) => {
    // Import helper dynamic to avoid type issues before schema sync if needed
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    let query = supabaseAdmin.from('viral_contents').select('*');
    
    if (data.category && data.category !== 'trending') {
      query = query.eq('category', data.category as any);
    }
    
    const { data: results, error } = await query.order('score', { ascending: false });
    
    if (error) throw error;
    
    if (!results || results.length === 0) {
      await supabaseAdmin.from('viral_contents').insert(TRENDING_MOCK as any);
      const { data: seeded } = await supabaseAdmin.from('viral_contents').select('*').order('score', { ascending: false });
      return (seeded || []) as any[];
    }
    
    return results as any[];
  });

export const refreshViralRadar = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from('viral_contents').select('*');
    
    if (existing) {
      for (const item of existing) {
        const newScore = Math.min(100, Math.max(0, (item as any).score + (Math.random() * 10 - 5)));
        await supabaseAdmin.from('viral_contents').update({ 
          score: Math.floor(newScore),
          updated_at: new Date().toISOString()
        } as any).eq('id', (item as any).id);
      }
    }
    
    return { success: true };
  });
