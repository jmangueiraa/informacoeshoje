import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dispatchTelegramMessage } from "./telegram.functions";

const MASTER_SUPERADMIN_EMAIL = 'ajpentretedimento@hotmail.com';

/**
 * Verifica se o usuário atual é o SuperAdmin Master
 */
export const checkIsSuperAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase: authenticatedSupabase } = context;
    const userEmail = typeof context.claims.email === 'string' ? context.claims.email.toLowerCase() : '';

    if (userEmail === MASTER_SUPERADMIN_EMAIL) {
      return true;
    }

    const { data: adminRole } = await authenticatedSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    return !!adminRole;
  });

/**
 * Retorna as estatísticas financeiras consolidadas para o SuperAdmin
 */
export const getSuperAdminFinancialStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userEmail = typeof context.claims.email === 'string' ? context.claims.email.toLowerCase() : '';
    if (userEmail !== MASTER_SUPERADMIN_EMAIL) {
      const { data: role } = await context.supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', context.userId)
        .eq('role', 'admin')
        .maybeSingle();
      if (!role) throw new Error("Não autorizado: Acesso exclusivo SuperAdmin.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Busca todos os perfis com seus dados de assinatura
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("*");

    if (profilesError) throw profilesError;

    const allProfiles = profiles || [];
    const now = new Date().getTime();
    const in3Days = now + 3 * 24 * 60 * 60 * 1000;
    const in7Days = now + 7 * 24 * 60 * 60 * 1000;

    let totalUsers = allProfiles.length;
    let activeUsers = 0;
    let expiredUsers = 0;
    let trialUsers = 0;
    let mrr = 0;
    let expiringIn3DaysCount = 0;
    let expiringIn7DaysCount = 0;

    const expiringSoonList: any[] = [];

    allProfiles.forEach((profile: any) => {
      // Ignora o próprio superadmin dos cálculos de mensalidade
      const isMasterAdmin = profile.id === context.userId;

      const expDate = profile.subscription_expires_at 
        ? new Date(profile.subscription_expires_at).getTime()
        : (profile.trial_expires_at ? new Date(profile.trial_expires_at).getTime() : 0);

      const isTrial = profile.subscription_type === 'trial_7d' || profile.is_trial === true;
      const isExpired = expDate > 0 && expDate < now;
      const isSuspended = profile.subscription_status === 'suspended';

      if (isTrial) {
        trialUsers++;
      }

      if (isExpired || isSuspended) {
        expiredUsers++;
      } else {
        activeUsers++;
        if (!isTrial && !isMasterAdmin) {
          const price = Number(profile.subscription_price) || 30.00;
          mrr += price;
        }
      }

      // Vencimentos próximos
      if (!isExpired && !isSuspended && expDate > now) {
        if (expDate <= in3Days) {
          expiringIn3DaysCount++;
          expiringSoonList.push({
            id: profile.id,
            name: profile.full_name || profile.username || 'Sem nome',
            phone: profile.phone_number || '',
            expires_at: profile.subscription_expires_at || profile.trial_expires_at,
            type: profile.subscription_type || 'monthly',
            days_left: Math.ceil((expDate - now) / (24 * 3600 * 1000)),
          });
        } else if (expDate <= in7Days) {
          expiringIn7DaysCount++;
        }
      }
    });

    // 2. Busca contagem de links e cliques globais
    const [linksCount, clicksCount, ordersCount] = await Promise.all([
      supabaseAdmin.from("links").select("*", { count: 'exact', head: true }),
      supabaseAdmin.from("clicks").select("*", { count: 'exact', head: true }),
      supabaseAdmin.from("payment_orders" as any).select("*", { count: 'exact', head: true }),
    ]);

    return {
      mrr,
      annualProjection: mrr * 12,
      totalUsers,
      activeUsers,
      expiredUsers,
      trialUsers,
      expiringIn3DaysCount,
      expiringIn7DaysCount,
      expiringSoonList,
      totalLinks: linksCount.count || 0,
      totalClicks: clicksCount.count || 0,
      totalOrders: ordersCount.count || 0,
    };
  });

/**
 * Retorna a lista completa de usuários gerenciados pelo SuperAdmin
 */
export const getSuperAdminUsersList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userEmail = typeof context.claims.email === 'string' ? context.claims.email.toLowerCase() : '';
    if (userEmail !== MASTER_SUPERADMIN_EMAIL) {
      const { data: role } = await context.supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', context.userId)
        .eq('role', 'admin')
        .maybeSingle();
      if (!role) throw new Error("Não autorizado.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Busca usuários no Auth do Supabase
    const { data: authUsersData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (authError) throw authError;

    // 2. Busca perfis, links e cliques
    const [profilesRes, linksRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("*"),
      supabaseAdmin.from("links").select("id, user_id, clicks_count"),
    ]);

    const profilesMap = new Map<string, any>();
    (profilesRes.data || []).forEach(p => profilesMap.set(p.id, p));

    const linksByUser = new Map<string, { count: number; clicks: number }>();
    (linksRes.data || []).forEach(l => {
      const curr = linksByUser.get(l.user_id) || { count: 0, clicks: 0 };
      curr.count += 1;
      curr.clicks += (l.clicks_count || 0);
      linksByUser.set(l.user_id, curr);
    });

    const now = new Date().getTime();

    const usersList = (authUsersData.users || []).map(u => {
      const profile = profilesMap.get(u.id) || {};
      const stats = linksByUser.get(u.id) || { count: 0, clicks: 0 };

      const expDateStr = profile.subscription_expires_at || profile.trial_expires_at;
      const expDate = expDateStr ? new Date(expDateStr).getTime() : 0;
      const isExpired = expDate > 0 && expDate < now;
      const isTrial = profile.subscription_type === 'trial_7d' || profile.is_trial === true;

      const diffMs = expDate - now;
      const daysRemaining = expDate > 0 ? Math.ceil(diffMs / (24 * 3600 * 1000)) : 0;

      let status = profile.subscription_status || (isTrial ? 'trial' : 'active');
      if (isExpired && status !== 'suspended') {
        status = 'expired';
      }

      return {
        id: u.id,
        email: u.email || '',
        full_name: profile.full_name || u.user_metadata?.full_name || '',
        phone_number: profile.phone_number || '',
        notes: profile.notes || '',
        subscription_type: profile.subscription_type || (isTrial ? 'trial_7d' : 'monthly'),
        subscription_price: Number(profile.subscription_price) || 30.00,
        subscription_status: status,
        subscription_expires_at: expDateStr,
        is_trial: isTrial,
        is_expired: isExpired,
        days_remaining: daysRemaining,
        created_at: u.created_at,
        links_count: stats.count,
        clicks_count: stats.clicks,
      };
    });

    // Ordena pelos mais recentes
    return usersList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  });

/**
 * Criação de Novo Usuário pelo SuperAdmin (Opção Teste 7 Dias ou Mensal R$ 30)
 */
export const createSuperAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    email: z.string().email("E-mail inválido"),
    password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
    full_name: z.string().min(2, "Nome é obrigatório"),
    phone_number: z.string().optional(),
    plan_type: z.enum(['trial_7d', 'monthly', 'quarterly', 'yearly', 'custom']),
    price: z.number().optional().default(30.00),
    days: z.number().optional(),
    notes: z.string().optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const userEmail = typeof context.claims.email === 'string' ? context.claims.email.toLowerCase() : '';
    if (userEmail !== MASTER_SUPERADMIN_EMAIL) {
      const { data: role } = await context.supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', context.userId)
        .eq('role', 'admin')
        .maybeSingle();
      if (!role) throw new Error("Não autorizado.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const isTrial = data.plan_type === 'trial_7d';
    let daysToAdd = 30;
    if (isTrial) daysToAdd = 7;
    else if (data.plan_type === 'quarterly') daysToAdd = 90;
    else if (data.plan_type === 'yearly') daysToAdd = 365;
    else if (data.days) daysToAdd = data.days;

    const expiresAt = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();
    const finalPrice = isTrial ? 0.00 : (data.price || 30.00);

    // 1. Cria usuário no Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.trim().toLowerCase(),
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name.trim(),
      },
    });

    if (createError) {
      console.error("Erro ao criar usuário no auth:", createError);
      throw new Error(createError.message || "Erro ao criar conta de usuário.");
    }

    const newUserId = newUser.user.id;

    // 2. Atualiza profile com plano e expiração
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name.trim(),
        phone_number: data.phone_number?.trim() || null,
        notes: data.notes?.trim() || null,
        subscription_type: data.plan_type,
        subscription_price: finalPrice,
        subscription_status: isTrial ? 'trial' : 'active',
        subscription_expires_at: expiresAt,
        trial_expires_at: expiresAt,
        is_trial: isTrial,
        updated_at: new Date().toISOString(),
      })
      .eq("id", newUserId);

    // 3. Notifica no Telegram
    const formattedExp = new Date(expiresAt).toLocaleDateString('pt-BR');
    dispatchTelegramMessage(
      `🚀 <b>NOVO USUÁRIO CADASTRADO NO SISTEMA!</b>\n\n` +
      `👤 <b>Nome:</b> ${data.full_name}\n` +
      `📧 <b>E-mail:</b> ${data.email}\n` +
      `📱 <b>Telefone:</b> ${data.phone_number || 'Não informado'}\n` +
      `📋 <b>Tipo:</b> ${isTrial ? '⚡ Teste Grátis (7 Dias)' : `💳 Mensal (R$ ${finalPrice.toFixed(2).replace('.', ',')})`}\n` +
      `📅 <b>Vencimento:</b> ${formattedExp}\n` +
      `🔐 <b>Senha gerada:</b> <code>${data.password}</code>`
    ).catch(console.error);

    return {
      success: true,
      userId: newUserId,
      email: data.email,
      password: data.password,
      expiresAt,
    };
  });

/**
 * Renovação de Assinatura pelo SuperAdmin com 1 Clique (+30 dias ou custom)
 */
export const renewUserSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    userId: z.string(),
    daysToAdd: z.number().default(30),
    price: z.number().optional().default(30.00),
    planType: z.string().optional().default('monthly'),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const userEmail = typeof context.claims.email === 'string' ? context.claims.email.toLowerCase() : '';
    if (userEmail !== MASTER_SUPERADMIN_EMAIL) {
      const { data: role } = await context.supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', context.userId)
        .eq('role', 'admin')
        .maybeSingle();
      if (!role) throw new Error("Não autorizado.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Executa a RPC de renovação atômica
    const { data: rpcRes, error } = await supabaseAdmin.rpc('superadmin_renew_subscription' as any, {
      p_user_id: data.userId,
      p_days_to_add: data.daysToAdd,
      p_new_price: data.price,
      p_new_type: data.planType,
    });

    if (error) {
      // Fallback manual caso a migration da RPC ainda não tenha sido executada
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("subscription_expires_at, full_name, username")
        .eq("id", data.userId)
        .single();

      const now = new Date().getTime();
      const currentExp = profile?.subscription_expires_at ? new Date(profile.subscription_expires_at).getTime() : 0;
      const baseTime = currentExp > now ? currentExp : now;
      const newExpiresAt = new Date(baseTime + data.daysToAdd * 24 * 3600 * 1000).toISOString();

      await supabaseAdmin
        .from("profiles")
        .update({
          subscription_expires_at: newExpiresAt,
          subscription_status: 'active',
          subscription_type: data.planType,
          subscription_price: data.price,
          is_trial: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.userId);

      return { success: true, newExpiresAt };
    }

    return rpcRes;
  });

/**
 * Atualização dos Dados de um Usuário pelo SuperAdmin
 */
export const updateSuperAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    userId: z.string(),
    full_name: z.string().optional(),
    phone_number: z.string().optional(),
    notes: z.string().optional(),
    subscription_type: z.string().optional(),
    subscription_price: z.number().optional(),
    subscription_status: z.enum(['active', 'expired', 'trial', 'suspended']).optional(),
    subscription_expires_at: z.string().optional(),
    new_password: z.string().optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const userEmail = typeof context.claims.email === 'string' ? context.claims.email.toLowerCase() : '';
    if (userEmail !== MASTER_SUPERADMIN_EMAIL) {
      const { data: role } = await context.supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', context.userId)
        .eq('role', 'admin')
        .maybeSingle();
      if (!role) throw new Error("Não autorizado.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Atualiza senha no Auth se informada
    if (data.new_password && data.new_password.trim().length >= 6) {
      await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        password: data.new_password.trim(),
      });
    }

    // 2. Atualiza profile
    const updateData: any = { updated_at: new Date().toISOString() };
    if (data.full_name !== undefined) updateData.full_name = data.full_name;
    if (data.phone_number !== undefined) updateData.phone_number = data.phone_number;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.subscription_type !== undefined) updateData.subscription_type = data.subscription_type;
    if (data.subscription_price !== undefined) updateData.subscription_price = data.subscription_price;
    if (data.subscription_status !== undefined) updateData.subscription_status = data.subscription_status;
    if (data.subscription_expires_at !== undefined) updateData.subscription_expires_at = data.subscription_expires_at;

    const { error } = await supabaseAdmin
      .from("profiles")
      .update(updateData)
      .eq("id", data.userId);

    if (error) throw error;

    return { success: true };
  });

/**
 * Excluir Usuário pelo SuperAdmin
 */
export const deleteSuperAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((id: unknown) => z.string().parse(id))
  .handler(async ({ data: userId, context }) => {
    const userEmail = typeof context.claims.email === 'string' ? context.claims.email.toLowerCase() : '';
    if (userEmail !== MASTER_SUPERADMIN_EMAIL) {
      const { data: role } = await context.supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', context.userId)
        .eq('role', 'admin')
        .maybeSingle();
      if (!role) throw new Error("Não autorizado.");
    }

    if (userId === context.userId) {
      throw new Error("Você não pode excluir a sua própria conta de SuperAdmin.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;

    return { success: true };
  });

/**
 * Buscar Configurações Administrativas (Mercado Pago, Telegram Bot, etc.)
 */
export const getAdminSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userEmail = typeof context.claims.email === 'string' ? context.claims.email.toLowerCase() : '';
    if (userEmail !== MASTER_SUPERADMIN_EMAIL) {
      const { data: role } = await context.supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', context.userId)
        .eq('role', 'admin')
        .maybeSingle();
      if (!role) throw new Error("Não autorizado.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: settings } = await supabaseAdmin
      .from("admin_settings" as any)
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    return settings || {
      id: 1,
      mercadopago_access_token: '',
      mercadopago_public_key: '',
      telegram_bot_token: '',
      telegram_chat_id: '',
      pix_key: '',
      support_whatsapp: '5519981356505',
      default_monthly_price: 30.00,
    };
  });

/**
 * Salvar Configurações Administrativas
 */
export const updateAdminSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    mercadopago_access_token: z.string().optional(),
    mercadopago_public_key: z.string().optional(),
    telegram_bot_token: z.string().optional(),
    telegram_chat_id: z.string().optional(),
    pix_key: z.string().optional(),
    support_whatsapp: z.string().optional(),
    default_monthly_price: z.number().optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const userEmail = typeof context.claims.email === 'string' ? context.claims.email.toLowerCase() : '';
    if (userEmail !== MASTER_SUPERADMIN_EMAIL) {
      const { data: role } = await context.supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', context.userId)
        .eq('role', 'admin')
        .maybeSingle();
      if (!role) throw new Error("Não autorizado.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("admin_settings" as any)
      .upsert({
        id: 1,
        ...data,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    return { success: true };
  });
