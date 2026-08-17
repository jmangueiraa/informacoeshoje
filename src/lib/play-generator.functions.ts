import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const savePlayAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({
    originalUrl: z.string(),
    finalUrl: z.string(),
    settings: z.any()
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    
    const { data: asset, error } = await supabase
      .from("play_assets" as any) // Tabela criada via migração
      .insert({
        user_id: userId,
        original_url: data.originalUrl,
        final_url: data.finalUrl,
        settings: data.settings
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return asset;
  });

export const getPlayAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    
    const { data: assets, error } = await supabase
      .from("play_assets" as any)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return assets;
  });

export const deletePlayAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({
    id: z.string()
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    
    const { error } = await supabase
      .from("play_assets" as any)
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { success: true };
  });
