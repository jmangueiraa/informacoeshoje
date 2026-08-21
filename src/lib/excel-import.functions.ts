import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    for (const contact of data.contacts) {
      try {
        const phoneDigits = contact.phone.replace(/\D/g, '');
        if (phoneDigits.length < 10 || phoneDigits.length > 11) {
          results.errors++;
          continue;
        }

        const name = cleanAndValidateName(contact.name);

        // Check duplicate
        const { data: existing } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', userId)
          .eq('phone_normalized', phoneDigits)
          .maybeSingle();

        if (existing) {
          results.duplicates++;
          continue;
        }

        const { error: insertError } = await supabase
          .from('contacts')
          .insert([{
            name,
            phone_normalized: phoneDigits,
            user_id: userId,
            needs_review: false
          }]);

        if (insertError) {
          results.errors++;
        } else {
          results.imported++;
        }
      } catch (err) {
        results.errors++;
      }
    }

    return results;
  });
