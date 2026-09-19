import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlusCircle, Link2, BarChart3, MousePointer2, Activity, Copy, ExternalLink, TrendingUp, RotateCcw } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { getDashboardStats } from "@/lib/analytics.functions"
import { getUserLinks, getUserProfile, resetLinkClicks } from "@/lib/links.functions"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { SubscriptionExpiredCard } from "@/components/subscription/SubscriptionExpiredCard"

export function DashboardHome() {
  const queryClient = useQueryClient()

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => getDashboardStats(),
    refetchOnWindowFocus: true,
  })

  const { data: links, isLoading: linksLoading } = useQuery({
    queryKey: ['user-links'],
    queryFn: () => getUserLinks(),
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    const channel = supabase
      .channel('links-changes-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'links' }, () => {
        queryClient.invalidateQueries({ queryKey: ['user-links'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clicks' }, () => {
        queryClient.invalidateQueries({ queryKey: ['user-links'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'link_clicks' }, () => {
        queryClient.invalidateQueries({ queryKey: ['user-links'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  const resetMutation = useMutation({
    mutationFn: async (id: string) => {
      await resetLinkClicks({ data: id })
      return id
    },
    onMutate: async (id: string) => {
      // Atualização otimista imediata na UI
      queryClient.setQueryData(['user-links'], (old: any) => {
        if (!Array.isArray(old)) return old
        return old.map((l: any) => (l.id === id ? { ...l, clicks_count: 0, clicks: 0 } : l))
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-links'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success("Cliques zerados com sucesso!")
    },
    onError: (err: any) => {
      queryClient.invalidateQueries({ queryKey: ['user-links'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.error(err.message || "Erro ao zerar cliques.")
    }
  })

  const copyToClipboard = (link: any) => {
    const profileDomain = profile && !('error' in profile) ? profile.custom_domain : null;
    const domain = link.custom_domain || profileDomain || "links.editaveisdocanva.com.br";
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const url = `https://${cleanDomain}/${link.slug}`
    navigator.clipboard.writeText(url)
    toast.success("Link copiado para a área de transferência!")
  }

  const { data: profile } = useQuery({
    queryKey: ['user-profile'],
    queryFn: () => getUserProfile(),
  })

  // Validação de expiração da assinatura ou teste de 7 dias
  const now = new Date().getTime();
  const expDateStr = profile && !('error' in profile) 
    ? (profile.subscription_expires_at || profile.trial_expires_at) 
    : null;
  const expDate = expDateStr ? new Date(expDateStr).getTime() : 0;
  const isTrial = profile && !('error' in profile) && (profile.subscription_type === 'trial_7d' || profile.is_trial === true);
  const isExpired = profile && !('error' in profile) && (
    (expDate > 0 && expDate < now) || profile.subscription_status === 'expired' || profile.subscription_status === 'suspended'
  );

  // Se a assinatura ou teste de 7 dias estiver expirado, exibe o Card de Bloqueio com Pix de R$ 30
  if (isExpired) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <SubscriptionExpiredCard 
          userName={profile && !('error' in profile) ? profile.full_name : undefined}
          expiresAt={expDateStr || undefined}
          isTrial={isTrial}
          onRenewSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['user-profile'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Banner discreto se estiver em teste grátis */}
      {isTrial && expDate > now && (
        <div className="bg-orange-500/10 border border-orange-500/30 text-orange-600 dark:text-orange-400 px-4 py-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-orange-500/50 bg-orange-500/20 text-orange-600 dark:text-orange-400 font-semibold">
              ⚡ Teste Grátis (7 Dias)
            </Badge>
            <span>Seu período de teste vence em <b>{new Date(expDate).toLocaleDateString('pt-BR')}</b> ({Math.ceil((expDate - now) / (24 * 3600 * 1000))} dias restantes).</span>
          </div>
        </div>
      )}

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Gerencie seus links de afiliado e acompanhe resultados.</p>
        </div>
        <Button asChild size="lg" className="gap-2 bg-primary hover:bg-primary/90">
          <Link to="/links" search={{ create: true }}>
            <PlusCircle className="h-5 w-5" />
            Criar Novo Link
          </Link>
        </Button>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Links</CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalLinks || 0}</div>
            <p className="text-xs text-muted-foreground">Links criados na conta</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cliques Totais</CardTitle>
            <MousePointer2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalClicks || 0}</div>
            <p className="text-xs text-muted-foreground">Acessos em todos os links</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cliques Hoje</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.clicksToday || 0}</div>
            <p className="text-xs text-muted-foreground">Últimas 24 horas</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Links Ativos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeLinks || 0}</div>
            <p className="text-xs text-muted-foreground">Links redirecionando</p>
          </CardContent>
        </Card>
      </div>

      {/* Links Recentes */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold tracking-tight">Links Recentes</h2>
          <Button variant="ghost" asChild>
            <Link to="/links">Ver todos</Link>
          </Button>
        </div>
        
        <div className="rounded-md border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-4 font-medium text-muted-foreground">Slug / Título</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">URL Destino</th>
                  <th className="text-center p-4 font-medium text-muted-foreground">Cliques</th>
                  <th className="text-center p-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {linksLoading ? (
                  Array(3).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={5} className="p-4 h-16 bg-muted/10"></td>
                    </tr>
                  ))
                ) : links?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      Você ainda não criou nenhum link.
                    </td>
                  </tr>
                ) : (
                  links?.slice(0, 5).map((link) => (
                    <tr key={link.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="font-medium text-foreground">/{link.slug}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {link.title || "Sem título"}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-xs text-muted-foreground truncate max-w-[250px] flex items-center gap-1">
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          {link.affiliate_url}
                        </div>
                      </td>
                      <td className="p-4 text-center font-semibold">
                        {Number(link.clicks_count ?? (link as any).clicks) || 0}
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant={link.status === 'active' ? 'secondary' : 'outline'} className={link.status === 'active' ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' : ''}>
                          {link.status === 'active' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="icon" variant="ghost" onClick={() => copyToClipboard(link)} title="Copiar Link">
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => resetMutation.mutate(link.id)} 
                            disabled={resetMutation.isPending}
                            title="Zerar Cliques"
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" asChild title="Ver Estatísticas">
                            <Link to="/links">
                              <BarChart3 className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}


