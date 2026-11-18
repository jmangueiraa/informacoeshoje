import { createClient } from "@supabase/supabase-js";
import { normalizeContactPhone } from "./phone";
import { LINK_DOMAIN } from "./constants";
import type { EvolutionConfig, QueueState } from "./evolution.types";

/**
 * Retorna a data no formato YYYY-MM-DD no fuso horário America/Sao_Paulo
 */
export function getSaoPauloDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

/**
 * Envia mensagem de texto via Evolution API
 */
export async function sendEvolutionTextMessage(params: {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
  phone: string;
  message: string;
}): Promise<{ success: boolean; messageId: string; responseData: any }> {
  const { apiUrl, apiKey, instanceName, phone, message } = params;

  if (!apiUrl || !apiKey || !instanceName) {
    throw new Error("Evolution API não configurada. Preencha URL, Chave de API e Nome da Instância.");
  }

  // Sanitização e normalização do telefone (somente dígitos com DDI 55)
  const cleanDigits = phone.replace(/\D/g, '');
  const normalizedPhone = cleanDigits.startsWith('55') ? cleanDigits : `55${cleanDigits}`;

  if (normalizedPhone.length < 12 || normalizedPhone.length > 13) {
    throw new Error(`Número de telefone inválido para envio: ${phone} (normalizado: ${normalizedPhone})`);
  }

  const cleanBaseUrl = apiUrl.trim().replace(/\/+$/, '');
  const endpoint = `${cleanBaseUrl}/message/sendText/${encodeURIComponent(instanceName.trim())}`;

  console.log(`[EVOLUTION-API] Enviando mensagem para ${normalizedPhone} via ${endpoint}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "apikey": apiKey.trim(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        number: normalizedPhone,
        text: message,
        delay: 1200,
        linkPreview: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    let responseData: any = {};
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      const errDetail = responseData?.message || responseData?.error || response.statusText || responseText;
      console.error(`[EVOLUTION-API] Erro HTTP ${response.status}:`, errDetail);
      throw new Error(`Evolution API retornou erro ${response.status}: ${errDetail}`);
    }

    if (responseData?.status === "ERROR" || responseData?.error) {
      const errDetail = responseData?.message || responseData?.error;
      console.error(`[EVOLUTION-API] Erro no corpo da resposta:`, errDetail);
      throw new Error(`Falha no envio da Evolution API: ${errDetail}`);
    }

    const messageId = responseData?.key?.id || responseData?.id || responseData?.messageId || "ok";
    console.log(`[EVOLUTION-API] Mensagem enviada com sucesso para ${normalizedPhone}! ID: ${messageId}`);

    return {
      success: true,
      messageId,
      responseData,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error("Tempo limite esgotado ao conectar com a Evolution API (Timeout 25s).");
    }
    throw err;
  }
}

/**
 * Garante link de rastreio para o contato no Supabase
 */
export async function ensureTrackingLinkDirect(
  supabase: any,
  userId: string,
  params: { name: string; phone: string; affiliateUrl: string }
): Promise<string> {
  const cleanPhone = normalizeContactPhone(params.phone);
  const firstName = (params.name.trim().split(/\s+/)[0] || "cliente")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
  const base = firstName.length >= 2 ? firstName : "cliente";

  // 1. Reutiliza link existente
  const { data: existing } = await supabase
    .from("links")
    .select("id, slug, affiliate_url")
    .eq("user_id", userId)
    .like("title", `%${cleanPhone}%`)
    .order("created_at", { ascending: false })
    .limit(1);

  const found = existing?.[0];
  if (found) {
    if (params.affiliateUrl && found.affiliate_url !== params.affiliateUrl) {
      await supabase.from("links").update({ affiliate_url: params.affiliateUrl }).eq("id", found.id);
    }
    return found.slug;
  }

  // 2. Cria novo slug único
  const { data: taken } = await supabase
    .from("links")
    .select("slug")
    .or(`slug.eq.${base},slug.like.${base}-%`);

  const takenSet = new Set((taken || []).map((l: any) => l.slug));
  let slug = base;
  let i = 1;
  while (takenSet.has(slug)) {
    slug = `${base}-${i}`;
    i++;
  }

  const { data: link, error } = await supabase
    .from("links")
    .insert({
      user_id: userId,
      slug,
      affiliate_url: params.affiliateUrl || "https://shopee.com.br",
      title: `Rastreio - ${params.name} (${cleanPhone})`,
      status: "active",
      clicks_count: 0,
    } as any)
    .select("slug")
    .single();

  if (error) {
    console.error("[EVOLUTION-QUEUE] Erro ao criar link de rastreio:", error);
    return slug;
  }

  return link.slug;
}

/**
 * Formata mensagem dinâmica do WhatsApp
 */
export function formatContactMessage(
  contact: { name: string; phone: string; trackingSlug?: string | null },
  isFirst: boolean,
  templates: { first?: string; reminder?: string },
  domain: string,
  slugOverride?: string | null
): string {
  const defaultFirst = `Olá, {primeiroNome}! Tudo bem?
Tivemos uma instabilidade no fluxo de envio do seu pacote.

Acompanhe a rota atualizada pelo rastreamento:
🔗 {linkRastreamento}

(Caso já tenha recebido a sua encomenda, favor nos responder apenas com um OK por aqui).

Equipe Shopee!`;

  const defaultReminder = `Olá {primeiroNome}, passando para saber se deu tudo certo com seu pedido! {linkRastreamento}

Equipe Shopee!`;

  const rawTemplate = isFirst ? templates?.first : templates?.reminder;
  const template = (rawTemplate && rawTemplate.trim().length > 0 && rawTemplate.replace(/Equipe Shopee!/gi, "").trim().length > 5)
    ? rawTemplate
    : (isFirst ? defaultFirst : defaultReminder);

  const nomeExibicao = contact.name.split(' ')[0] || "Cliente";

  let message = template
    .replace(/{primeiroNome}/g, nomeExibicao)
    .replace(/{contato}/g, contact.phone || "");

  const slug = slugOverride ?? contact.trackingSlug;
  const trackingUrl = slug ? `https://${domain}/${slug}` : "";

  if (/{linkRastreamento}|{link}/.test(template)) {
    if (trackingUrl) {
      message = message.replace(/{linkRastreamento}/g, trackingUrl).replace(/{link}/g, trackingUrl);
    } else {
      message = message.replace(/{linkRastreamento}/g, "").replace(/{link}/g, "");
    }
  } else {
    // Se o template já contém um link (ex: https://www.shopeerastreamento.com.br/pedido), não duplica!
    const hasExistingLink = /https?:\/\//i.test(template);
    if (!hasExistingLink && trackingUrl) {
      message = `${message.trimEnd()}\n\n🔗 ${trackingUrl}`;
    }
  }

  // Evita duplicar o rodapé se o texto já contiver "Equipe Shopee!"
  if (!/Equipe Shopee!/i.test(message)) {
    message = `${message.trimEnd()}\n\nEquipe Shopee!`;
  }

  return message.trim();
}

/**
 * Busca a configuração e estado da fila do usuário
 */
export async function getQueueConfigRow(supabase: any, userId: string): Promise<any> {
  const { data: rows } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", userId)
    .or("name.eq.__evolution_queue_config__,phone_normalized.eq.0000000000,phone_normalized.eq.__queue_config__")
    .order("created_at", { ascending: false });

  const data = rows?.[0];
  const raw = (data?.raw_data && typeof data.raw_data === "object") ? data.raw_data : {};

  // Verifica também variáveis de ambiente como fallback
  const envApiUrl = process.env['EVOLUTION_API_URL'] || '';
  const envApiKey = process.env['EVOLUTION_API_KEY'] || '';
  const envInstance = process.env['EVOLUTION_INSTANCE_NAME'] || '';

  const apiUrl = raw.evolution_api_url || envApiUrl;
  const apiKey = raw.evolution_api_key || envApiKey;
  const instanceName = raw.evolution_instance_name || envInstance;

  return {
    ...raw,
    evolution_api_url: apiUrl,
    evolution_api_key: apiKey,
    evolution_instance_name: instanceName,
    daily_limit: 100,
    interval_minutes: 10,
    recurrence_days: 7,
  };
}

/**
 * Salva a configuração e estado da fila no Supabase
 */
export async function saveQueueConfigRow(supabase: any, userId: string, patch: any): Promise<any> {
  const current = await getQueueConfigRow(supabase, userId);
  const updated = { ...current, ...patch };

  const { data, error } = await supabase
    .from("contacts")
    .upsert({
      user_id: userId,
      name: "__evolution_queue_config__",
      phone_normalized: "0000000000",
      needs_review: false,
      raw_data: updated,
    }, { onConflict: "user_id,phone_normalized" })
    .select()
    .single();

  if (error) {
    console.error("[EVOLUTION-QUEUE] Erro no upsert da configuração da fila:", error);
    await supabase
      .from("contacts")
      .update({ raw_data: updated })
      .eq("user_id", userId)
      .eq("name", "__evolution_queue_config__");
  }

  return updated;
}

const queueProcessingLocks = new Set<string>();

/**
 * Executa um ciclo (tick) da fila automática
 */
export async function executeQueueTick(
  supabase: any,
  userId: string,
  options?: { forceContactId?: string; skipCurrent?: boolean }
): Promise<QueueState> {
  const now = new Date();
  const todayInSP = getSaoPauloDateString(now);

  const config = await getQueueConfigRow(supabase, userId);

  // 1. Controle do limite diário (100 envios no fuso America/Sao_Paulo)
  let dailySentCount = Number(config.daily_sent_count || 0);
  let dailySentDate = config.daily_sent_date || todayInSP;

  if (dailySentDate !== todayInSP) {
    dailySentCount = 0;
    dailySentDate = todayInSP;
  }

  // Previne processamento simultâneo/concorrente para o mesmo usuário
  if (queueProcessingLocks.has(userId)) {
    console.log(`[EVOLUTION-QUEUE] Processamento já em andamento para o usuário ${userId}. Ignorando tick concorrente.`);
    return buildQueueStateResponse(config, 0, dailySentCount, dailySentDate);
  }

  queueProcessingLocks.add(userId);
  try {

  // 2. Se a fila estiver pausada ou encerrada, retorna estado
  if (!config.is_running || config.is_paused) {
    return buildQueueStateResponse(config, 0, dailySentCount, dailySentDate);
  }

  // 3. Verifica limite diário
  if (dailySentCount >= 100) {
    const updated = await saveQueueConfigRow(supabase, userId, {
      is_running: false,
      current_status: "waiting",
      current_error: "Limite diário de 100 envios confirmados atingido hoje.",
      daily_sent_count: dailySentCount,
      daily_sent_date: dailySentDate,
    });
    return buildQueueStateResponse(updated, 0, dailySentCount, dailySentDate);
  }

  // 4. Verifica credenciais da Evolution API
  const apiUrl = config.evolution_api_url;
  const apiKey = config.evolution_api_key;
  const instanceName = config.evolution_instance_name;

  if (!apiUrl || !apiKey || !instanceName) {
    const updated = await saveQueueConfigRow(supabase, userId, {
      is_running: false,
      current_status: "error",
      current_error: "Evolution API não configurada. Preencha URL, Chave de API e Nome da Instância.",
    });
    return buildQueueStateResponse(updated, 0, dailySentCount, dailySentDate);
  }

  // 5. Busca contatos elegíveis
  const { data: rawContacts, error: contactsErr } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", userId)
    .neq("name", "__evolution_queue_config__")
    .neq("phone_normalized", "0000000000")
    .order("created_at", { ascending: true });

  if (contactsErr) {
    console.error("[EVOLUTION-QUEUE] Erro ao buscar contatos:", contactsErr);
    throw contactsErr;
  }

  // Filtra contatos elegíveis:
  // - Telefone válido
  // - needs_review !== true
  // - raw_data.unsubscribed !== true (respeita descadastros)
  // - Recorrência individual de 7 dias: !last_send OU new Date(nextReminder || last_send) <= now
  const eligibleContacts = (rawContacts || []).filter((c: any) => {
    if (c.needs_review) return false;
    const phone = normalizeContactPhone(c.phone_normalized);
    if (phone.length !== 10 && phone.length !== 11) return false;

    const raw = (c.raw_data && typeof c.raw_data === 'object') ? c.raw_data : {};
    if (raw.unsubscribed === true) return false;

    // Se já foi enviado, verifica se já passaram 7 dias corridos
    if (c.last_send) {
      const nextTime = raw.nextReminder ? new Date(raw.nextReminder).getTime() : new Date(c.last_send).getTime() + 7 * 24 * 60 * 60 * 1000;
      if (nextTime > now.getTime()) {
        return false;
      }
    }

    return true;
  });

  const totalEligible = eligibleContacts.length;

  if (totalEligible === 0) {
    const updated = await saveQueueConfigRow(supabase, userId, {
      is_running: false,
      current_status: "idle",
      current_error: null,
      current_contact_id: null,
      current_contact_name: null,
      current_contact_phone: null,
      current_contact_preview: null,
      next_run_at: null,
      daily_sent_count: dailySentCount,
      daily_sent_date: dailySentDate,
    });
    return buildQueueStateResponse(updated, 0, dailySentCount, dailySentDate);
  }

  // 6. Seleciona o contato a ser processado
  let targetContact = eligibleContacts[0];
  if (options?.forceContactId) {
    const found = eligibleContacts.find((c: any) => c.id === options.forceContactId);
    if (found) targetContact = found;
  } else if (options?.skipCurrent && config.current_contact_id) {
    const currentIndex = eligibleContacts.findIndex((c: any) => c.id === config.current_contact_id);
    if (currentIndex >= 0 && currentIndex < eligibleContacts.length - 1) {
      targetContact = eligibleContacts[currentIndex + 1];
    } else {
      targetContact = eligibleContacts[0];
    }
  }

  const rawData = (targetContact.raw_data && typeof targetContact.raw_data === 'object') ? targetContact.raw_data : {};
  const isFirst = !targetContact.last_send;

  // Busca domínio personalizado do perfil
  const { data: profile } = await supabase
    .from("profiles")
    .select("custom_domain")
    .eq("id", userId)
    .maybeSingle();

  const domain = profile?.custom_domain || LINK_DOMAIN;

  // Garante link personalizado
  let slug = rawData.trackingSlug || null;
  const affiliateUrl = config.affiliate_url || "https://shopee.com.br";

  if (!slug) {
    try {
      slug = await ensureTrackingLinkDirect(supabase, userId, {
        name: targetContact.name,
        phone: targetContact.phone_normalized,
        affiliateUrl,
      });
    } catch (linkErr) {
      console.warn("[EVOLUTION-QUEUE] Erro ao gerar link de rastreio:", linkErr);
    }
  }

  const formattedMsg = formatContactMessage(
    { name: targetContact.name, phone: targetContact.phone_normalized, trackingSlug: slug },
    isFirst,
    config.msg_templates || {},
    domain,
    slug
  );

  // Atualiza estado pré-envio
  await saveQueueConfigRow(supabase, userId, {
    current_contact_id: targetContact.id,
    current_contact_name: targetContact.name,
    current_contact_phone: targetContact.phone_normalized,
    current_contact_preview: formattedMsg,
    current_status: "sending",
    current_error: null,
  });

  // 7. Envio para a Evolution API
  let sendSuccess = false;
  let sendError: string | null = null;
  let messageId = "";

  try {
    const sendResult = await sendEvolutionTextMessage({
      apiUrl,
      apiKey,
      instanceName,
      phone: targetContact.phone_normalized,
      message: formattedMsg,
    });
    sendSuccess = true;
    messageId = sendResult.messageId;
  } catch (err: any) {
    sendSuccess = false;
    sendError = err.message || "Erro desconhecido ao enviar pela Evolution API";
  }

  const sendTimestamp = new Date();
  const nextReminder = new Date(sendTimestamp.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 dias corridos
  const nextRunAt = new Date(sendTimestamp.getTime() + 10 * 60 * 1000); // 10 minutos de intervalo

  const existingHistory = Array.isArray(rawData.history) ? rawData.history : [];

  if (sendSuccess) {
    // SUCESSO: Marca envio confirmado, agenda recorrência de 7 dias, incrementa contador diário
    dailySentCount += 1;

    const updatedRaw = {
      ...rawData,
      trackingSlug: slug,
      nextReminder: nextReminder.toISOString(),
      status: "sent",
      last_error: null,
      history: [
        ...existingHistory,
        {
          sent_at: sendTimestamp.toISOString(),
          status: "sent",
          message_id: messageId,
        },
      ],
    };

    await supabase
      .from("contacts")
      .update({
        last_send: sendTimestamp.toISOString(),
        raw_data: updatedRaw,
      })
      .eq("id", targetContact.id);

    const updatedConfig = await saveQueueConfigRow(supabase, userId, {
      current_contact_id: targetContact.id,
      current_contact_name: targetContact.name,
      current_contact_phone: targetContact.phone_normalized,
      current_contact_preview: formattedMsg,
      current_status: "sent",
      current_error: null,
      last_sent_at: sendTimestamp.toISOString(),
      next_run_at: nextRunAt.toISOString(),
      daily_sent_count: dailySentCount,
      daily_sent_date: dailySentDate,
      is_running: dailySentCount < 100, // Para se atingiu 100
    });

    return buildQueueStateResponse(updatedConfig, totalEligible - 1, dailySentCount, dailySentDate);
  } else {
    // ERRO: Registra tentativa e erro, NÃO marca como confirmado, aguarda 10 minutos antes do próximo
    const updatedRaw = {
      ...rawData,
      status: "error",
      last_error: sendError,
      attempts: (Number(rawData.attempts) || 0) + 1,
      history: [
        ...existingHistory,
        {
          attempted_at: sendTimestamp.toISOString(),
          status: "error",
          error: sendError,
        },
      ],
    };

    await supabase
      .from("contacts")
      .update({
        raw_data: updatedRaw,
      })
      .eq("id", targetContact.id);

    const updatedConfig = await saveQueueConfigRow(supabase, userId, {
      current_contact_id: targetContact.id,
      current_contact_name: targetContact.name,
      current_contact_phone: targetContact.phone_normalized,
      current_contact_preview: formattedMsg,
      current_status: "error",
      current_error: `Erro ao enviar para ${targetContact.name}: ${sendError}`,
      last_sent_at: null,
      next_run_at: nextRunAt.toISOString(),
      daily_sent_count: dailySentCount,
      daily_sent_date: dailySentDate,
    });

    return buildQueueStateResponse(updatedConfig, totalEligible, dailySentCount, dailySentDate);
  }
  } finally {
    queueProcessingLocks.delete(userId);
  }
}

/**
 * Constrói o objeto de resposta de estado para o frontend
 */
function buildQueueStateResponse(
  config: any,
  totalEligible: number,
  dailySentCount: number,
  dailySentDate: string
): QueueState {
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
}

// =======================================================================
// WORKER EM SEGUNDO PLANO NO SERVIDOR (PERSISTENTE)
// =======================================================================
let globalWorkerInterval: any = null;
let isWorkerRunning = false;

export function initQueueBackgroundWorker() {
  if (globalWorkerInterval) return;

  console.log("[EVOLUTION-QUEUE-WORKER] Inicializando agendador em segundo plano...");

  const SUPABASE_URL = process.env['SUPABASE_URL'] || 'https://pkqacvnjbqgqrxwcvriw.supabase.co';
  const SUPABASE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] || process.env['SUPABASE_PUBLISHABLE_KEY'] || '';

  if (!SUPABASE_KEY) {
    console.warn("[EVOLUTION-QUEUE-WORKER] Chave do Supabase ausente. O worker aguardará inicialização.");
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Intervalo de verificação a cada 20 segundos
  globalWorkerInterval = setInterval(async () => {
    if (isWorkerRunning) return;
    isWorkerRunning = true;

    try {
      // Busca todas as configurações de fila ativas
      const { data: activeConfigs, error } = await supabase
        .from("contacts")
        .select("user_id, raw_data")
        .or("name.eq.__evolution_queue_config__,phone_normalized.eq.0000000000");

      if (error || !activeConfigs) {
        isWorkerRunning = false;
        return;
      }

      const now = new Date();

      for (const row of activeConfigs) {
        const raw = (row.raw_data && typeof row.raw_data === 'object') ? row.raw_data : {};
        if (raw.is_running && !raw.is_paused) {
          const nextRunAt = raw.next_run_at ? new Date(raw.next_run_at) : null;
          // Se chegou a hora do próximo envio (ou se não há next_run_at agendado)
          if (!nextRunAt || nextRunAt <= now) {
            console.log(`[EVOLUTION-QUEUE-WORKER] Executando próximo envio para usuário ${row.user_id}...`);
            try {
              await executeQueueTick(supabase, row.user_id);
            } catch (tickErr) {
              console.error(`[EVOLUTION-QUEUE-WORKER] Erro no tick do usuário ${row.user_id}:`, tickErr);
            }
          }
        }
      }
    } catch (workerErr) {
      console.error("[EVOLUTION-QUEUE-WORKER] Erro no ciclo do worker:", workerErr);
    } finally {
      isWorkerRunning = false;
    }
  }, 20000);
}
