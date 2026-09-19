import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dispatchTelegramMessage } from "./telegram.functions";

/**
 * Criação de Pedido Pix via API Mercado Pago (R$ 30,00)
 */
export const createMercadoPagoPixOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    amount: z.number().optional().default(30.00),
  }).optional().default({ amount: 30.00 }))
  .handler(async ({ data, context }) => {
    const { userId, supabase: authenticatedSupabase } = context;
    const userEmail = typeof context.claims.email === 'string' ? context.claims.email : 'cliente@linkafiliado.com';
    const amount = data?.amount || 30.00;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Busca dados do perfil do usuário
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, username, phone_number")
      .eq("id", userId)
      .maybeSingle();

    const clientName = profile?.full_name || profile?.username || userEmail.split('@')[0];

    // 2. Busca configurações do Mercado Pago no banco
    const { data: settings } = await supabaseAdmin
      .from("admin_settings" as any)
      .select("mercadopago_access_token, pix_key, default_monthly_price")
      .eq("id", 1)
      .maybeSingle();

    const accessToken = settings?.mercadopago_access_token || process.env['MERCADOPAGO_ACCESS_TOKEN'];
    const pixKey = settings?.pix_key || '';

    // Se tiver Access Token do Mercado Pago, cria pagamento nativo Pix
    if (accessToken && accessToken.trim()) {
      try {
        const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken.trim()}`,
            "X-Idempotency-Key": `pix-${userId}-${Date.now()}`,
          },
          body: JSON.stringify({
            transaction_amount: Number(amount),
            description: `Mensalidade LinkAfiliado - ${clientName}`,
            payment_method_id: "pix",
            payer: {
              email: userEmail,
              first_name: clientName,
            },
          }),
        });

        const mpData = await mpResponse.json();

        if (mpResponse.ok && mpData.id) {
          const qrCode = mpData.point_of_interaction?.transaction_data?.qr_code || '';
          const qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64 || '';
          const mpPaymentId = String(mpData.id);

          // Salva pedido no banco
          const { data: order, error: orderError } = await supabaseAdmin
            .from("payment_orders" as any)
            .insert({
              user_id: userId,
              mercadopago_payment_id: mpPaymentId,
              amount: amount,
              status: "pending",
              payment_method: "pix",
              qr_code: qrCode,
              qr_code_base64: qrCodeBase64,
            })
            .select()
            .single();

          if (orderError) {
            console.error("Erro ao salvar payment_order:", orderError);
          }

          // Notifica no Telegram
          dispatchTelegramMessage(
            `💳 <b>NOVO PIX GERADO (MERCADO PAGO)</b>\n\n` +
            `👤 <b>Cliente:</b> ${clientName}\n` +
            `📧 <b>E-mail:</b> ${userEmail}\n` +
            `💰 <b>Valor:</b> R$ ${amount.toFixed(2).replace('.', ',')}\n` +
            `🆔 <b>ID Mercado Pago:</b> <code>${mpPaymentId}</code>\n` +
            `⏳ <i>Aguardando pagamento no app do banco...</i>`
          ).catch(console.error);

          return {
            success: true,
            orderId: order?.id || mpPaymentId,
            paymentId: mpPaymentId,
            qrCode,
            qrCodeBase64,
            amount,
            isNativeMp: true,
          };
        } else {
          console.error("Erro retornado pelo Mercado Pago API:", mpData);
        }
      } catch (mpErr: any) {
        console.error("Exceção na chamada Mercado Pago:", mpErr);
      }
    }

    // Fallback: Chave Pix direta se o token do MP não estiver configurado
    const fallbackOrderId = `manual-${Date.now()}`;
    await supabaseAdmin
      .from("payment_orders" as any)
      .insert({
        user_id: userId,
        mercadopago_payment_id: fallbackOrderId,
        amount: amount,
        status: "pending",
        payment_method: "pix_manual",
        qr_code: pixKey || "ajpentretedimento@hotmail.com",
      });

    dispatchTelegramMessage(
      `💳 <b>SOLICITAÇÃO DE PAGAMENTO PIX</b>\n\n` +
      `👤 <b>Cliente:</b> ${clientName}\n` +
      `📧 <b>E-mail:</b> ${userEmail}\n` +
      `💰 <b>Valor:</b> R$ ${amount.toFixed(2).replace('.', ',')}\n` +
      `📌 <b>Chave Pix:</b> ${pixKey || 'ajpentretedimento@hotmail.com'}`
    ).catch(console.error);

    return {
      success: true,
      orderId: fallbackOrderId,
      paymentId: fallbackOrderId,
      qrCode: pixKey || "ajpentretedimento@hotmail.com",
      qrCodeBase64: "",
      amount,
      isNativeMp: false,
    };
  });

/**
 * Consulta o status do pagamento no Mercado Pago e renova automaticamente se aprovado
 */
export const checkMercadoPagoPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    paymentId: z.string(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { paymentId } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Verifica se a ordem já foi marcada como aprovada no banco
    const { data: existingOrder } = await supabaseAdmin
      .from("payment_orders" as any)
      .select("*")
      .eq("user_id", userId)
      .or(`mercadopago_payment_id.eq.${paymentId},id.eq.${paymentId}`)
      .maybeSingle();

    if (existingOrder?.status === 'approved') {
      return { paid: true, status: 'approved' };
    }

    // 2. Se for número do Mercado Pago, consulta a API
    const isMpId = /^\d+$/.test(paymentId);
    if (isMpId) {
      const { data: settings } = await supabaseAdmin
        .from("admin_settings" as any)
        .select("mercadopago_access_token")
        .eq("id", 1)
        .maybeSingle();

      const accessToken = settings?.mercadopago_access_token || process.env['MERCADOPAGO_ACCESS_TOKEN'];

      if (accessToken && accessToken.trim()) {
        try {
          const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: {
              "Authorization": `Bearer ${accessToken.trim()}`,
            },
          });

          if (mpResponse.ok) {
            const mpPayment = await mpResponse.json();
            
            if (mpPayment.status === 'approved') {
              // 3. Atualiza o pedido para aprovado
              await supabaseAdmin
                .from("payment_orders" as any)
                .update({ status: 'approved', paid_at: new Date().toISOString() })
                .eq("mercadopago_payment_id", paymentId);

              // 4. Renova a assinatura do usuário por +30 dias de forma garantida
              const [{ data: userProfile }, authUserRes] = await Promise.all([
                supabaseAdmin
                  .from("profiles")
                  .select("*")
                  .eq("id", userId)
                  .maybeSingle(),
                supabaseAdmin.auth.admin.getUserById(userId).catch(() => ({ data: { user: null } }))
              ]);

              const authUser = authUserRes?.data?.user;
              const nowTime = new Date().getTime();
              const currentExpStr = userProfile?.subscription_expires_at 
                || userProfile?.trial_expires_at 
                || authUser?.user_metadata?.subscription_expires_at;

              let currentExp = currentExpStr ? new Date(currentExpStr).getTime() : 0;
              if (!currentExp && authUser?.created_at) {
                currentExp = new Date(authUser.created_at).getTime() + 30 * 24 * 3600 * 1000;
              }

              const baseTime = (currentExp > nowTime) ? currentExp : nowTime;
              const newExpiresAt = new Date(baseTime + 30 * 24 * 3600 * 1000).toISOString();
              const clientName = userProfile?.full_name || authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || 'Cliente';
              const clientPhone = userProfile?.phone_number || authUser?.user_metadata?.phone_number || authUser?.phone || null;

              await supabaseAdmin
                .from("profiles")
                .upsert({
                  id: userId,
                  full_name: clientName,
                  phone_number: clientPhone,
                  subscription_expires_at: newExpiresAt,
                  trial_expires_at: newExpiresAt,
                  subscription_status: 'active',
                  subscription_type: 'monthly',
                  subscription_price: 30.00,
                  is_trial: false,
                  updated_at: new Date().toISOString(),
                }, { onConflict: 'id' });

              if (authUser) {
                try {
                  await supabaseAdmin.auth.admin.updateUserById(userId, {
                    user_metadata: {
                      ...(authUser.user_metadata || {}),
                      subscription_expires_at: newExpiresAt,
                      trial_expires_at: newExpiresAt,
                      subscription_status: 'active',
                      subscription_type: 'monthly',
                      subscription_price: 30.00,
                      is_trial: false,
                    }
                  });
                } catch (_) {}
              }

              try {
                await supabaseAdmin.rpc('superadmin_renew_subscription' as any, {
                  p_user_id: userId,
                  p_days_to_add: 30,
                  p_new_price: 30.00,
                  p_new_type: 'monthly',
                });
              } catch (_) {}

              // 5. Notifica no Telegram o pagamento aprovado
              const formattedExp = new Date(newExpiresAt).toLocaleDateString('pt-BR');
              dispatchTelegramMessage(
                `🎉 <b>PAGAMENTO CONFIRMADO! (MERCADO PAGO)</b>\n\n` +
                `👤 <b>Cliente:</b> ${clientName}\n` +
                `💰 <b>Valor:</b> R$ 30,00\n` +
                `✅ <b>Status:</b> Aprovado\n` +
                `📅 <b>Nova Validade:</b> ${formattedExp}\n` +
                `🚀 <i>Acesso liberado automaticamente no sistema!</i>`
              ).catch(console.error);

              return { paid: true, status: 'approved', newExpiresAt };
            }

            return { paid: false, status: mpPayment.status };
          }
        } catch (err) {
          console.error("Erro ao verificar status no Mercado Pago:", err);
        }
      }
    }

    return { paid: false, status: existingOrder?.status || 'pending' };
  });

/**
 * Testar conexão com a API do Mercado Pago
 */
export const testMercadoPagoToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    accessToken: z.string(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const allowedAdminEmail = 'ajpentretedimento@hotmail.com';
    const userEmail = typeof context.claims.email === 'string' ? context.claims.email.toLowerCase() : '';

    if (userEmail !== allowedAdminEmail) {
      throw new Error("Não autorizado.");
    }

    const { accessToken } = data;
    const cleanToken = accessToken.trim();

    const response = await fetch("https://api.mercadopago.com/users/me", {
      headers: {
        "Authorization": `Bearer ${cleanToken}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Token do Mercado Pago inválido.");
    }

    return {
      success: true,
      nickname: result.nickname || result.first_name || "Conta Mercado Pago",
      email: result.email || "",
    };
  });
