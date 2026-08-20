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
    phone: z.string()
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    
    // Simplificar nome para o primeiro nome e limpar caracteres
    const firstName = data.name.split(/[_\s]/)[0] || 'Cliente';
    const phoneDigits = data.phone.replace(/\D/g, '');
    
    const { data: contact, error } = await supabase
      .from('contacts')
      .insert([{
        name: firstName,
        phone_normalized: phoneDigits,
      }])
      .select()
      .single();
      
    if (error) throw error;
    return contact;
  });
