import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { analyzeImageForContacts } from "./contacts.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error("[CAPTURA] Erro ao buscar contatos:", error);
      throw error;
    }
    
    console.log(`[CAPTURA] getContacts - Total retornados: ${data?.length || 0}`);
    return data;
  });

export const processImageOCR = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    imageBase64: z.string(),
    filename: z.string().optional(),
    mimeType: z.string().optional()
  }).parse(data))
  .handler(async ({ data }) => {
    return analyzeImageForContacts(data.imageBase64, data.filename, data.mimeType);
  });

export const saveContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    name: z.string(),
    phone: z.string(),
    needsReview: z.boolean().optional(),
    reviewReason: z.string().nullish(),
    rawData: z.any().optional(),
    status: z.string().optional() // Campo status opcional para facilitar controle do frontend
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    
    // Normalização agressiva: Captura apenas o primeiro nome em Title Case
    const rawName = data.name.trim().replace(/[_*]/g, " ").replace(/\s+/g, " ");
    const firstName = rawName.split(' ')[0] || "Cliente";
    const cleanName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    
    const phoneDigits = data.phone.replace(/\D/g, '');
    
    console.log(`[CAPTURA] saveContact - Processando:`, { 
      name: cleanName, 
      phone: phoneDigits, 
      needsReview: data.needsReview,
      userId: userId
    });

    // 1. Verificar se já existe (Duplicado)
    const { data: existing, error: checkError } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', userId)
      .eq('phone_normalized', phoneDigits)
      .maybeSingle();

    if (checkError) {
      console.error(`[CAPTURA] Erro na verificação de duplicidade:`, checkError);
    }

    if (existing) {
      console.log(`[CAPTURA] saveContact - DUPLICADO detectado para ${phoneDigits}`);
      throw new Error('DUPLICATE_CONTACT');
    }

    // 2. Montagem do Payload Exato
    const payload = {
      name: cleanName,
      phone_normalized: phoneDigits,
      needs_review: data.needsReview === true, 
      review_reason: data.reviewReason || null,
      raw_data: data.rawData || null,
      user_id: userId // Agora garantido pelo middleware
    };

    console.log(`[CAPTURA] saveContact - Payload Enviado ao Supabase:`, payload);

    // 3. Inserção
    const { data: contact, error: insertError } = await supabase
      .from('contacts')
      .insert([payload])
      .select()
      .single();
      
    if (insertError) {
      if (insertError.code === '23505') {
        console.log(`[CAPTURA] saveContact - DUPLICADO detectado via constraint para ${phoneDigits}`);
        throw new Error('DUPLICATE_CONTACT');
      }
      console.error(`[IMPORT_ERROR] Supabase insert failure:`, insertError);
      throw new Error(`DB_INSERT_ERROR: ${insertError.code} - ${insertError.message}`);
    }

    console.log(`[IMPORT] Sucesso ao salvar contato no banco:`, contact);
    return contact;
  });

export const updateLastSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    contactId: z.string(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    
    const { data: contact, error } = await supabase
      .from('contacts')
      .update({ last_send: new Date().toISOString() })
      .eq('id', data.contactId)
      .select()
      .single();

    if (error) {
      console.error("[CAPTURA] Erro ao atualizar último envio:", error);
      throw error;
    }

    return contact;
  });

export const runControlledTest = createServerFn({ method: "POST" })
... elided ...