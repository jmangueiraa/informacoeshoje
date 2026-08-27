import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { analyzeImageForContacts } from "./contacts.server";
import { normalizeContactPhone } from "./phone";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("[CAPTURA] Erro ao buscar contatos:", error);
      throw error;
    }

    return (data ?? []).map((row: any) => {
      const raw = (row.raw_data && typeof row.raw_data === 'object') ? row.raw_data : {};
      return {
        id: row.id as string,
        name: row.name as string,
        phone: row.phone_normalized as string,
        lastContact: (row.last_send ?? null) as string | null,
        nextReminder: (raw.nextReminder ?? null) as string | null,
        trackingSlug: (raw.trackingSlug ?? null) as string | null,
        extractionDate: (raw.extractionDate ?? row.created_at) as string,
      };
    });
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
    rawData: z.any().optional()
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    
    // Função de sanitização rigorosa conforme solicitado no backend/frontend
    const cleanAndValidateName = (name: string, nextSequential: string): string => {
      if (!name) return nextSequential;
      
      // 1. Remove pontos, sublinhados, traços, asteriscos, tils
      const sanitized = name.replace(/[\._\-\*~]/g, '').trim();
      
      // 2. Se tiver menos de 3 letras válidas ou tiver caracteres de truncamento (..)
      // Note: O regex /[\.]{2,}/.test(name) verifica o original para detectar truncamento/reticências
      if (sanitized.length < 3 || /[\.]{2,}/.test(name)) {
        return nextSequential;
      }
      
      return sanitized;
    };

    // Primeiro, precisamos buscar o próximo nome sequencial para o caso de falha
    const { data: lastClients } = await supabase
      .from('contacts')
      .select('name')
      .eq('user_id', userId)
      .like('name', 'Cliente%')
      .order('name', { ascending: false })
      .limit(1);

    let nextNumber = 1;
    if (lastClients && lastClients.length > 0) {
      const lastNames = lastClients.map((c: any) => c.name);
      const sequentials = lastNames
        .map((n: any) => {
          const nameStr = String(n || "");
          const match = nameStr.match(/Cliente(\d+)/);
          if (!match || !match[1]) return null;
          return parseInt(match[1], 10);
        })
        .filter((n: number | null): n is number => n !== null);

      if (sequentials.length > 0) {
        nextNumber = Math.max(...sequentials) + 1;
      }
    }
    const nextSequentialName = `Cliente${String(nextNumber).padStart(5, '0')}`;

    const rawName = data.name.trim();
    const sanitizedName = cleanAndValidateName(rawName, nextSequentialName);
    
    let cleanName = sanitizedName;
    if (sanitizedName !== nextSequentialName) {
      const firstName = sanitizedName.split(' ')[0] || "Cliente";
      const cleaned = firstName.replace(/[^a-zA-ZÀ-ÿ]/g, '');
      if (cleaned.length < 3) {
        cleanName = nextSequentialName;
      } else {
        cleanName = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
      }
    }
    
    const phoneDigits = normalizeContactPhone(data.phone);
    
    // Se o telefone for válido (10 ou 11 dígitos), aprovamos o registro mesmo com nome substituto
    const isPhoneValid = phoneDigits.length === 10 || phoneDigits.length === 11;
    if (!isPhoneValid) {
      throw new Error("INVALID_PHONE");
    }
    const finalNeedsReview = data.needsReview === true && !isPhoneValid;

    console.log(`[CAPTURA] saveContact - Processando:`, { 
      name: cleanName, 
      phone: phoneDigits, 
      needsReview: finalNeedsReview,
      userId: userId
    });

    // 1. Montagem do Payload Exato
    const payload = {
      name: cleanName,
      phone_normalized: phoneDigits,
      needs_review: finalNeedsReview, 
      review_reason: finalNeedsReview ? (data.reviewReason || "Revisão necessária") : null,
      raw_data: data.rawData || null,
      user_id: userId
    };


    console.log(`[CAPTURA] saveContact - Payload Enviado ao Supabase:`, payload);

    // 2. Inserção idempotente: se já existir, ignora sem criar duplicado
    const { data: contact, error: insertError } = await supabase
      .from('contacts')
      .upsert([payload], { onConflict: 'user_id,phone_normalized', ignoreDuplicates: true })
      .select()
      .maybeSingle();
      
    if (insertError) {
      console.error(`[IMPORT_ERROR] Supabase insert failure:`, insertError);
      throw new Error(`DB_INSERT_ERROR: ${insertError.code} - ${insertError.message}`);
    }

    if (!contact) {
      console.log(`[CAPTURA] saveContact - DUPLICADO ignorado para ${phoneDigits}`);
      return { duplicate: true, phone_normalized: phoneDigits };
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
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    name: z.string(),
    phone: z.string()
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    
    console.log(`[TESTE-SERVER] Iniciando teste para:`, { name: data.name, phone: data.phone, userId });

    const { normalizeBrazilianPhone } = await import("./contacts.server");
    
    const phoneResult = normalizeBrazilianPhone(data.phone);
    
    // Função de sanitização rigorosa conforme solicitado no backend/frontend
    const cleanAndValidateName = (name: string, nextSequential: string): string => {
      if (!name) return nextSequential;
      
      // 1. Remove pontos, sublinhados, traços, asteriscos, tils
      const sanitized = name.replace(/[\._\-\*~]/g, '').trim();
      
      // 2. Se tiver menos de 3 letras válidas ou tiver caracteres de truncamento (..)
      if (sanitized.length < 3 || /[\.]{2,}/.test(name)) {
        return nextSequential;
      }
      
      return sanitized;
    };

    const rawName = data.name.trim();
    const sanitizedName = cleanAndValidateName(rawName, "Cliente00000");
    
    let cleanName = sanitizedName;
    const isNameIllegible = sanitizedName === "Cliente00000";

    if (!isNameIllegible) {
      const firstName = sanitizedName.split(' ')[0] || "Cliente";
      cleanName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    }

    
    const isPhoneValid = phoneResult.isValid;
    
    let needsReview = false;
    let reviewReason = "";

    if (isNameIllegible) {
      needsReview = !isPhoneValid;
      reviewReason = isPhoneValid ? "" : "Nome ilegível e telefone inválido";
    } else if (!isPhoneValid) {
      needsReview = true;
      if (phoneResult.normalized.length >= 8 && phoneResult.normalized.length < 10) {
        reviewReason = "Telefone capturado sem DDD";
      } else {
        reviewReason = phoneResult.reason || "Telefone inválido";
      }
    }

    const testResult = {
      name: cleanName,
      phone: phoneResult.normalized,
      needsReview,
      reviewReason,
      isNameValid: !isNameIllegible,
      isPhoneValid,
      user_id: userId,
      raw_data: { test: true, originalName: data.name, originalPhone: data.phone }
    };
    
    console.log(`[TESTE-SERVER] Resultado calculado:`, testResult);
    return testResult;
  });
// ===== Persistência da lista de "Resultados Extraídos" (fonte única: banco) =====

const extractedContactSchema = z.object({
  name: z.string(),
  phone: z.string(),
  trackingSlug: z.string().nullish(),
  extractionDate: z.string().nullish(),
  lastContact: z.string().nullish(),
  nextReminder: z.string().nullish(),
});

export const upsertExtractedContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    contacts: z.array(extractedContactSchema)
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    const unique = new Map<string, any>();
    for (const c of data.contacts) {
      const phone = normalizeContactPhone(c.phone);
      if (phone.length !== 10 && phone.length !== 11) continue;
      if (unique.has(phone)) continue;
      unique.set(phone, {
        user_id: userId,
        name: (c.name || "Cliente").trim() || "Cliente",
        phone_normalized: phone,
        needs_review: false,
        last_send: c.lastContact || null,
        raw_data: {
          trackingSlug: c.trackingSlug || null,
          extractionDate: c.extractionDate || new Date().toISOString(),
          nextReminder: c.nextReminder || null,
        },
      });
    }

    if (unique.size === 0) return { inserted: 0, skipped: 0, rows: [] as any[] };

    const { data: rows, error } = await supabase
      .from('contacts')
      .upsert(Array.from(unique.values()), { onConflict: 'user_id,phone_normalized', ignoreDuplicates: true })
      .select();

    if (error) {
      console.error("[CONTACTS] Erro no upsert:", error);
      throw error;
    }

    const inserted = rows?.length ?? 0;
    return { inserted, skipped: unique.size - inserted, rows: rows ?? [] };
  });

export const updateContactRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    id: z.string(),
    name: z.string().optional(),
    phone: z.string().optional(),
    lastContact: z.string().nullish(),
    nextReminder: z.string().nullish(),
    trackingSlug: z.string().nullish(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    const { data: existing, error: fetchError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', data.id)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) throw new Error("CONTACT_NOT_FOUND");

    const raw = (existing.raw_data && typeof existing.raw_data === 'object') ? existing.raw_data : {};
    const patch: any = {};

    if (data.name !== undefined) patch.name = data.name.trim() || "Cliente";
    if (data.phone !== undefined) {
      const phone = normalizeContactPhone(data.phone);
      if (phone.length !== 10 && phone.length !== 11) throw new Error("INVALID_PHONE");
      patch.phone_normalized = phone;
    }
    if (data.lastContact !== undefined) patch.last_send = data.lastContact;

    if (data.nextReminder !== undefined || data.trackingSlug !== undefined) {
      patch.raw_data = {
        ...raw,
        ...(data.nextReminder !== undefined ? { nextReminder: data.nextReminder } : {}),
        ...(data.trackingSlug !== undefined ? { trackingSlug: data.trackingSlug } : {}),
      };
    }

    const { data: updated, error } = await supabase
      .from('contacts')
      .update(patch)
      .eq('id', data.id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return updated;
  });

export const deleteContactRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { error } = await supabase.from('contacts').delete().eq('id', data.id).eq('user_id', userId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteAllContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { error } = await supabase.from('contacts').delete().eq('user_id', userId);
    if (error) throw error;
    return { ok: true };
  });
