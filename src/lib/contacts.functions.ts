import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ContactSchema = z.object({
  name: z.string(),
  phone: z.string(),
});

const ProcessedResultSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  needsReview: z.boolean(),
  error: z.string().optional(),
});

export const getContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase: authenticatedSupabase } = context;

    // Verificar se é admin
    const { data: isAdmin } = await authenticatedSupabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin'
    });

    if (!isAdmin) throw new Error("Acesso negado: apenas administradores podem ver contatos.");

    const { data, error } = await authenticatedSupabase
      .from("contacts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  });


export const saveContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ContactSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId, supabase: authenticatedSupabase } = context;
    const { name, phone } = data;

    // Verificar se é admin
    const { data: isAdmin } = await authenticatedSupabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin'
    });

    if (!isAdmin) throw new Error("Acesso negado: apenas administradores podem salvar contatos.");

    // Normalizar telefone
    const phoneNormalized = phone.replace(/\D/g, "");

    const { data: saved, error } = await authenticatedSupabase
      .from("contacts")
      .insert([
        {
          user_id: userId,
          name,
          phone_normalized: phoneNormalized,
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("Este telefone já está cadastrado.");
      }
      throw error;
    }

    return saved;
  });


export const deleteContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((id: unknown) => z.string().parse(id))
  .handler(async ({ data: id, context }) => {
    const { userId, supabase: authenticatedSupabase } = context;

    const { error } = await authenticatedSupabase
      .from("contacts")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return { success: true };
  });

export const updateContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => 
    z.object({
      id: z.string(),
      name: z.string(),
      phone: z.string(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase: authenticatedSupabase } = context;
    const { id, name, phone } = data;

    const phoneNormalized = phone.replace(/\D/g, "");

    const { data: updated, error } = await authenticatedSupabase
      .from("contacts")
      .update({
        name,
        phone_normalized: phoneNormalized,
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("Este telefone já está cadastrado.");
      }
      throw error;
    }

    return updated;
  });

export const processImageOCR = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ imageBase64: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId, supabase: authenticatedSupabase } = context;
    
    // Import dynamically to keep the function thin
    const { analyzeImageForContacts } = await import("./contacts.server");
    
    return await analyzeImageForContacts(data.imageBase64);
  });
