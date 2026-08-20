import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { analyzeImageForContacts } from "./contacts.server";

export const getContacts = createServerFn({ method: "GET" })
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return data;
  });

export const processImageOCR = createServerFn({ method: "POST" })
  .inputValidator((data: any) => z.object({
    imageBase64: z.string()
  }).parse(data))
  .handler(async ({ data }) => {
    return analyzeImageForContacts(data.imageBase64);
  });

export const saveContact = createServerFn({ method: "POST" })
  .inputValidator((data: any) => z.object({
    name: z.string(),
    phone: z.string(),
    needsReview: z.boolean().optional(),
    reviewReason: z.string().optional(),
    rawData: z.any().optional()
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    
    // Pegar o primeiro nome apenas se for salvar como contato direto,
    // mas se for para revisão talvez queiramos o nome completo.
    // O usuário pediu "Nome completo" no objetivo, mas em outra parte disse "primeiro nome".
    // Vou manter o nome completo se for novo contato.
    const cleanName = data.name.trim();
    const phoneDigits = data.phone.replace(/\D/g, '');
    
    const { data: contact, error } = await supabase
      .from('contacts')
      .insert([{
        name: cleanName,
        phone_normalized: phoneDigits,
        needs_review: data.needsReview ?? false,
        review_reason: data.reviewReason,
        raw_data: data.rawData
      }])
      .select()
      .single();
      
    if (error) {
      // Se for erro de duplicidade (23505), retornar erro específico para o front tratar
      if (error.code === '23505') {
        throw new Error('DUPLICATE_CONTACT');
      }
      throw error;
    }
    return contact;
  });