import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  executeQueueTick,
  getQueueConfigRow,
  saveQueueConfigRow,
  getSaoPauloDateString,
  initQueueBackgroundWorker,
} from "./evolution.server";
import { normalizeContactPhone } from "./phone";
import type { QueueState } from "./evolution.types";

// Inicia o worker de segundo plano no servidor
try {
  initQueueBackgroundWorker();
} catch (e) {
  console.warn("[EVOLUTION-QUEUE] Aviso ao iniciar worker:", e);
}

/**
 * Consulta o estado atual da fila de envios automáticos
 */
export const getEvolutionQueueState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QueueState> => {
    const { supabase, userId } = context as any;

    const now = new Date();
    const todayInSP = getSaoPauloDateString(now);

    const config = await getQueueConfigRow(supabase, userId);

    let dailySentCount = Number(config.daily_sent_count || 0);
    let dailySentDate = config.daily_sent_date || todayInSP;

    if (dailySentDate !== todayInSP) {
      dailySentCount = 0;
      dailySentDate = todayInSP;
    }

    // Busca contatos elegíveis para contar pendências
    const { data: rawContacts } = await supabase
      .from("contacts")
      .select("*")
      .eq("user_id", userId)
      .neq("name", "__evolution_queue_config__")
      .neq("phone_normalized", "0000000000");

    const eligibleContacts = (rawContacts || []).filter((c: any) => {
      if (c.needs_review) return false;
      const phone = normalizeContactPhone(c.phone_normalized);
      if (phone.length !== 10 && phone.length !== 11) return false;

      const raw = (c.raw_data && typeof c.raw_data === 'object') ? c.raw_data : {};
      if (raw.unsubscribed === true) return false;

      if (c.last_send) {
        const nextTime = raw.nextReminder ? new Date(raw.nextReminder).getTime() : new Date(c.last_send).getTime() + 7 * 24 * 60 * 60 * 1000;
        if (nextTime > now.getTime()) {
          return false;
        }
      }

      return true;
    });

    const totalEligible = eligibleContacts.length;

    const key = config.evolution_api_key || "";
    const maskedKey = key ? `••••••••${key.slice(-4)}` : "";

    return {
      isRunning: Boolean(config.is_running),
      isPaused: Boolean(config.is_paused),
      currentContactId: config.current_contact_id || null,
      currentContactName: config.current_contact_name || null,
      currentContactPhone: config.current_contact_phone || null,
      currentContactPreview: config.current_contact_preview || null,
      currentStatus: config.current_status || "idle",
      currentError: config.current_error || null,
      lastSentAt: config.last_sent_at || null,
      nextRunAt: config.next_run_at || null,
      dailySentCount,
      dailySentDate,
      totalEligible,
      evolutionConfigured: Boolean(config.evolution_api_url && config.evolution_api_key && config.evolution_instance_name),
      evolutionApiUrl: config.evolution_api_url || "",
      evolutionInstanceName: config.evolution_instance_name || "",
      evolutionApiKeyMasked: maskedKey,
    };
  });

/**
 * Salva as configurações da Evolution API e da fila
 */
export const saveEvolutionSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    apiUrl: z.string().optional(),
    apiKey: z.string().optional(),
    instanceName: z.string().optional(),
    affiliateUrl: z.string().optional(),
    msgTemplates: z.object({
      first: z.string().optional(),
      reminder: z.string().optional(),
    }).optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    const patch: any = {};
    if (data.apiUrl !== undefined && data.apiUrl.trim()) {
      patch.evolution_api_url = data.apiUrl.trim();
    }
    // Só atualiza a apiKey se o usuário digitou uma nova chave não vazia e não mascarada
    if (data.apiKey && data.apiKey.trim().length > 0 && !data.apiKey.includes("••••")) {
      patch.evolution_api_key = data.apiKey.trim();
    }
    if (data.instanceName !== undefined && data.instanceName.trim()) {
      patch.evolution_instance_name = data.instanceName.trim();
    }
    if (data.affiliateUrl !== undefined) patch.affiliate_url = data.affiliateUrl.trim();
    if (data.msgTemplates !== undefined) patch.msg_templates = data.msgTemplates;

    await saveQueueConfigRow(supabase, userId, patch);
    return { ok: true };
  });

/**
 * Inicia a fila automática
 */
export const startEvolutionQueueAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    affiliateUrl: z.string().optional(),
    msgTemplates: z.object({
      first: z.string().optional(),
      reminder: z.string().optional(),
    }).optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    const patch: any = {
      is_running: true,
      is_paused: false,
      current_error: null,
      current_status: "sending",
    };

    if (data.affiliateUrl) patch.affiliate_url = data.affiliateUrl.trim();
    if (data.msgTemplates) patch.msg_templates = data.msgTemplates;

    await saveQueueConfigRow(supabase, userId, patch);

    // Executa imediatamente o primeiro envio
    return executeQueueTick(supabase, userId);
  });

/**
 * Pausa a fila automática
 */
export const pauseEvolutionQueueAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;

    const updated = await saveQueueConfigRow(supabase, userId, {
      is_paused: true,
      current_status: "paused",
    });

    const now = new Date();
    const todayInSP = getSaoPauloDateString(now);
    return {
      ok: true,
      isPaused: true,
      dailySentCount: updated.daily_sent_count || 0,
      dailySentDate: updated.daily_sent_date || todayInSP,
    };
  });

/**
 * Retoma a fila automática
 */
export const resumeEvolutionQueueAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;

    await saveQueueConfigRow(supabase, userId, {
      is_running: true,
      is_paused: false,
    });

    return executeQueueTick(supabase, userId);
  });

/**
 * Encerra a fila automática
 */
export const stopEvolutionQueueAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;

    await saveQueueConfigRow(supabase, userId, {
      is_running: false,
      is_paused: false,
      current_status: "idle",
      current_contact_id: null,
      current_contact_name: null,
      current_contact_phone: null,
      current_contact_preview: null,
      next_run_at: null,
      current_error: null,
    });

    return { ok: true, isRunning: false };
  });

/**
 * Pula o contato atual e avança para o próximo
 */
export const skipEvolutionQueueContactAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    return executeQueueTick(supabase, userId, { skipCurrent: true });
  });
