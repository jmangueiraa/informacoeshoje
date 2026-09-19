import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Função utilitária interna para enviar notificações no Telegram
 */
export async function dispatchTelegramMessage(message: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Busca as configurações de admin
    const { data: settings } = await supabaseAdmin
      .from("admin_settings" as any)
      .select("telegram_bot_token, telegram_chat_id")
      .eq("id", 1)
      .maybeSingle();

    const botToken = settings?.telegram_bot_token || process.env['TELEGRAM_BOT_TOKEN'];
    const chatId = settings?.telegram_chat_id || process.env['TELEGRAM_CHAT_ID'];

    if (!botToken || !chatId) {
      console.warn("[Telegram Bot] Token ou Chat ID não configurados.");
      return { success: false, error: "Telegram Bot não configurado no SuperAdmin." };
    }

    const cleanToken = botToken.trim();
    const cleanChatId = chatId.trim();

    const response = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      console.error("[Telegram Bot] Erro retornado pela API do Telegram:", result);
      return { success: false, error: result.description || "Erro na API do Telegram" };
    }

    return { success: true };
  } catch (error: any) {
    console.error("[Telegram Bot] Exceção ao enviar mensagem:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Server function para testar o envio de notificação no Telegram a partir do SuperAdmin
 */
export const testTelegramBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    botToken: z.string().optional(),
    chatId: z.string().optional(),
    message: z.string().optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const allowedAdminEmail = 'ajpentretedimento@hotmail.com';
    const userEmail = typeof context.claims.email === 'string' ? context.claims.email.toLowerCase() : '';

    if (userEmail !== allowedAdminEmail) {
      throw new Error("Não autorizado: Acesso SuperAdmin apenas.");
    }

    const { botToken, chatId, message } = data;

    if (botToken && chatId) {
      const testMsg = message || `🤖 <b>TESTE DE INTEGRAÇÃO DO BOT TELEGRAM</b>\n\n✅ Conexão estabelecida com sucesso!\n🕒 Data/Hora: ${new Date().toLocaleString('pt-BR')}\n🚀 Sistema LinkAfiliado pronto para enviar notificações em tempo real.`;
      
      const response = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text: testMsg,
          parse_mode: 'HTML',
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.description || "Erro ao conectar com a API do Telegram.");
      }
      return { success: true };
    }

    // Se não passou token/chatId específicos, usa os salvos no banco
    const res = await dispatchTelegramMessage(
      `🤖 <b>TESTE DE NOTIFICAÇÃO DO SISTEMA</b>\n\n✅ Bot conectado com sucesso!\n🕒 Data: ${new Date().toLocaleString('pt-BR')}\n🚀 Notificações de novos clientes e pagamentos ativas.`
    );

    if (!res.success) {
      throw new Error(res.error || "Falha ao enviar notificação de teste.");
    }

    return { success: true };
  });
