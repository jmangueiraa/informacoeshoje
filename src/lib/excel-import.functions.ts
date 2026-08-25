import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeContactPhone } from "./phone";

export const importContactsFromExcel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    contacts: z.array(z.object({
      name: z.string(),
      phone: z.string()
    }))
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    
    // Normalization functions
    const cleanAndValidateName = (name: string): string => {
      if (!name) return "Cliente";
      const sanitized = name.replace(/[\._\-\*~]/g, '').trim();
      const firstName = sanitized.split(' ')[0] || "Cliente";
      const cleaned = firstName.replace(/[^a-zA-ZÀ-ÿ]/g, '');
      if (cleaned.length < 3) return "Cliente";
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
    };

    const results = {
      imported: 0,
      duplicates: 0,
      errors: 0
    };

    const uniqueContacts = new Map<string, { name: string; phone_normalized: string; user_id: string; needs_review: boolean }>();

    for (const contact of data.contacts) {
      const phoneDigits = normalizeContactPhone(contact.phone);
      if (phoneDigits.length !== 10 && phoneDigits.length !== 11) {
        results.errors++;
        continue;
      }

      if (uniqueContacts.has(phoneDigits)) {
        results.duplicates++;
        continue;
      }

      uniqueContacts.set(phoneDigits, {
        name: cleanAndValidateName(contact.name),
        phone_normalized: phoneDigits,
        user_id: userId,
        needs_review: false
      });
    }

    if (uniqueContacts.size === 0) {
      return results;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('contacts')
      .upsert(Array.from(uniqueContacts.values()), { onConflict: 'user_id,phone_normalized', ignoreDuplicates: true })
      .select('id');

    if (insertError) {
      console.error('[IMPORT_ERROR] Falha ao importar contatos:', insertError);
      results.errors += uniqueContacts.size;
      return results;
    }

    results.imported = inserted?.length || 0;
    results.duplicates += uniqueContacts.size - results.imported;
    return results;
  });
