import { supabase } from "@/integrations/supabase/client";
import { PLATFORM_DOMAIN, LINK_DOMAIN } from "@/lib/constants";

export interface ResolvedDomain {
  userId: string;
  domain: string;
  type: 'subdomain' | 'custom' | 'platform';
}

export async function resolveDomain(hostname: string): Promise<ResolvedDomain | null> {
  const normalizedHost = hostname.toLowerCase().trim().replace(/^www\./, '');
  const platformDomainNormalized = PLATFORM_DOMAIN.toLowerCase().trim().replace(/^www\./, '');

  // 1. Se for o domínio principal da plataforma ou ambiente de desenvolvimento
  if (
    normalizedHost === platformDomainNormalized || 
    normalizedHost === LINK_DOMAIN || 
    normalizedHost.includes('lovable.app') || 
    normalizedHost.includes('localhost') ||
    normalizedHost.includes('127.0.0.1')
  ) {
    return {
      userId: '',
      domain: normalizedHost,
      type: 'platform'
    };
  }

  // 2. Buscar no banco de dados por user_domains
  const { data, error } = await supabase
    .from("user_domains")
    .select("id, user_id, domain, domain_type, verification_status")
    .eq("domain", normalizedHost)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  // Se for domínio customizado, verificar se está validado
  if (data.domain_type === 'custom' && data.verification_status !== 'verified') {
    return null;
  }

  return {
    userId: data.user_id,
    domain: data.domain,
    type: data.domain_type as 'subdomain' | 'custom'
  };
}
