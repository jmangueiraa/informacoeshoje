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
    
    // Lógica de validação do Nome (sincronizada com o servidor)
    const rawName = data.name.trim();
    const hasEllipsis = rawName.includes("...");
    const hasSpecialChars = /[#@$%&|\\/]/.test(rawName);
    const hasAsterisks = /[*_]{2,}/.test(rawName);
    
    const cleanedForLength = rawName
      .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const firstNameForLength = cleanedForLength.split(' ')[0] || "";
    const isNameTooShort = firstNameForLength.length < 3;

    const isNameInvalid = !rawName || 
                         rawName === "ILEGÍVEL" || 
                         hasEllipsis || 
                         hasSpecialChars || 
                         hasAsterisks || 
                         isNameTooShort ||
                         rawName.toLowerCase().includes("shopee");

    let cleanName = "";
    if (isNameInvalid) {
      // Gerar nome sequencial: Cliente00001, etc.
      const { data: lastClients, error: fetchError } = await supabase
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

      cleanName = `Cliente${String(nextNumber).padStart(5, '0')}`;
    } else {
      const firstName = rawName.split(' ')[0] || "Cliente";
      cleanName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    }
    
    const phoneDigits = data.phone.replace(/\D/g, '');
    
    // Se o telefone for válido (10 ou 11 dígitos), aprovamos o registro mesmo com nome substituto
    const isPhoneValid = phoneDigits.length >= 10 && phoneDigits.length <= 11;
    const finalNeedsReview = data.needsReview === true && !isPhoneValid;

    console.log(`[CAPTURA] saveContact - Processando:`, { 
      name: cleanName, 
      phone: phoneDigits, 
      needsReview: finalNeedsReview,
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
      needs_review: finalNeedsReview, 
      review_reason: finalNeedsReview ? (data.reviewReason || "Revisão necessária") : null,
      raw_data: data.rawData || null,
      user_id: userId
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
    
    // Regras de validação do Nome (sincronizada com o servidor)
    const rawName = data.name.trim();
    const hasEllipsis = rawName.includes("...");
    const hasSpecialChars = /[#@$%&|\\/]/.test(rawName);
    const hasAsterisks = /[*_]{2,}/.test(rawName);
    
    const cleanedForLength = rawName
      .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const firstNameForLength = cleanedForLength.split(' ')[0] || "";
    const isNameTooShort = firstNameForLength.length < 3;

    const isNameIllegible = !rawName || 
                           rawName === "ILEGÍVEL" || 
                           hasEllipsis || 
                           hasSpecialChars || 
                           hasAsterisks || 
                           isNameTooShort;

    let cleanName = "";
    if (isNameIllegible) {
      cleanName = "Cliente00000"; // Mock sequencial para teste
    } else {
      const firstName = rawName.split(' ')[0] || "Cliente";
      cleanName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    }
    
    const isPhoneValid = phoneResult.isValid;
    
    let needsReview = false;
    let reviewReason = "";

    if (!isNameValid) {
      needsReview = true;
      reviewReason = "Nome não identificado claramente";
    } else if (!isPhoneValid) {
      if (phoneResult.normalized.length >= 8 && phoneResult.normalized.length < 10) {
        needsReview = true;
        reviewReason = "Telefone capturado sem DDD";
      } else {
        needsReview = true;
        reviewReason = phoneResult.reason || "Telefone inválido";
      }
    }

    const testResult = {
      name: cleanName,
      phone: phoneResult.normalized,
      needsReview,
      reviewReason,
      isNameValid,
      isPhoneValid,
      user_id: userId,
      raw_data: { test: true, originalName: data.name, originalPhone: data.phone }
    };
    
    console.log(`[TESTE-SERVER] Resultado calculado:`, testResult);
    return testResult;
  });