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
    imageBase64: z.string(),
    filename: z.string().optional()
  }).parse(data))
  .handler(async ({ data }) => {
    return analyzeImageForContacts(data.imageBase64, data.filename);
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
    
    // Normalização básica para garantir que o telefone esteja limpo antes do banco
    const cleanName = data.name.trim();
    const phoneDigits = data.phone.replace(/\D/g, '');
    
    // Verificar se já existe (Duplicado)
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('phone_normalized', phoneDigits)
      .maybeSingle();

    if (existing) {
      throw new Error('DUPLICATE_CONTACT');
    }

    const { data: contact, error } = await supabase
      .from('contacts')
      .insert([{
        name: cleanName,
        phone_normalized: phoneDigits,
        needs_review: data.needsReview === true, // Garante booleano estrito
        review_reason: data.reviewReason || null,
        raw_data: data.rawData || null
      }])
      .select()
      .single();
      
    if (error) {
      throw error;
    }
    return contact;
  });

export const runControlledTest = createServerFn({ method: "POST" })
  .inputValidator((data: any) => z.object({
    name: z.string(),
    phone: z.string()
  }).parse(data))
  .handler(async ({ data }) => {
    const { analyzeImageForContacts } = await import("./contacts.server");
    
    // Mocking the result that would come from OCR/IA but controlled
    // We bypass the actual IA call but use the SAME normalization and classification logic
    const { normalizeBrazilianPhone } = await import("./contacts.server");
    
    const phoneResult = normalizeBrazilianPhone(data.phone);
    const cleanName = data.name.replace(/[_*]/g, " ").replace(/\s+/g, " ").trim();
    
    const isNameValid = cleanName.length >= 3 && !cleanName.toLowerCase().includes("shopee");
    const isPhoneValid = phoneResult.isValid;
    
    let needsReview = false;
    let reviewReason = "";

    const isErrorString = (s: string) => ["erro na ia", "null", "undefined", "cliente"].includes(s.toLowerCase());
    const isNameValid = cleanName.length >= 2 && !isErrorString(cleanName) && !cleanName.toLowerCase().includes("shopee");
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

    return {
      name: cleanName,
      phone: phoneResult.normalized,
      needsReview,
      reviewReason,
      isNameValid,
      isPhoneValid,
      raw_data: { test: true, originalName: data.name, originalPhone: data.phone }
    };
  });