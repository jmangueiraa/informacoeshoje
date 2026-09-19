import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  PlusCircle, 
  Link2, 
  BarChart3, 
  MousePointer2, 
  Activity, 
  Copy, 
  ExternalLink, 
  TrendingUp, 
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Search,
  RefreshCw
} from "lucide-react"
import { Link } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/integrations/supabase/client"
import { getDashboardStats, getIpCooldownList } from "@/lib/analytics.functions"
import { getUserLinks, getUserProfile, resetLinkClicks } from "@/lib/links.functions"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

export function DashboardHome() {
  const queryClient = useQueryClient()
  const [ipSearch, setIpSearch] = useState("")

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

  const { data: cooldownList, isLoading: cooldownLoading, refetch: refetchCooldown } = useQuery({
    queryKey: ['ip-cooldown-list'],
    queryFn: () => getIpCooldownList(),
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
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
        queryClient.invalidateQueries({ queryKey: ['ip-cooldown-list'] })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'link_clicks' }, () => {
        queryClient.invalidateQueries({ queryKey: ['user-links'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
        queryClient.invalidateQueries({ queryKey: ['ip-cooldown-list'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ip_cooldown' }, () => {
        queryClient.invalidateQueries({ queryKey: ['ip-cooldown-list'] })
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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    try {
      const d = new Date(dateStr)
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(d)
    } catch (_) {
      return dateStr
    }
  }

  // Filtragem da lista de IPs por busca
  const filteredCooldownList = useMemo(() => {
    if (!cooldownList || !Array.isArray(cooldownList)) return []
    if (!ipSearch.trim()) return cooldownList
    const query = ipSearch.toLowerCase().trim()
    return cooldownList.filter((item: any) => 
      item.ip_address?.toLowerCase().includes(query) ||
      item.status?.toLowerCase().includes(query) ||
      item.formatted_time_remaining?.toLowerCase().includes(query)
    )
  }, [cooldownList, ipSearch])

  // Contadores de quarentena
  const quarantineCount = useMemo(() => {
    if (!cooldownList || !Array.isArray(cooldownList)) return 0
    return cooldownList.filter((item: any) => item.status === 'Em Quarentena' || (item.days_remaining && item.days_remaining > 0)).length
  }, [cooldownList])

  const releasedCount = useMemo(() => {
    if (!cooldownList || !Array.isArray(cooldownList)) return 0
    return cooldownList.filter((item: any) => item.status === 'Liberado' || !item.days_remaining || item.days_remaining === 0).length
  }, [cooldownList])

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
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

      {/* Seção: Controle de Quarentena de IPs (Janela de Atribuição de 7 Dias da Shopee) */}
      <div className="space-y-4 pt-4 border-t">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <h2 className="text-xl font-semibold tracking-tight">Rastreamento de IPs e Janela de 7 Dias (Shopee)</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Controle de quarentena de cliques únicos por IP e Cookies para espelhar a janela de comissionamento da Shopee.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar por IP ou status..."
                value={ipSearch}
                onChange={(e) => setIpSearch(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetchCooldown()}
              disabled={cooldownLoading}
              className="h-9 gap-1"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${cooldownLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
            <Button variant="ghost" size="sm" asChild className="h-9">
              <Link to="/quarentena">Ver Completo</Link>
            </Button>
          </div>
        </div>

        {/* Resumo de Quarentena */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-muted/40 p-3 rounded-lg border flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Total de IPs Registrados:</span>
            <span className="text-sm font-bold text-foreground">{cooldownList?.length || 0}</span>
          </div>
          <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/20 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-red-500" />
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">Em Quarentena:</span>
            </div>
            <span className="text-sm font-bold text-red-600 dark:text-red-400">{quarantineCount}</span>
          </div>
          <div className="bg-green-500/10 p-3 rounded-lg border border-green-500/20 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">Liberados para Clique:</span>
            </div>
            <span className="text-sm font-bold text-green-600 dark:text-green-400">{releasedCount}</span>
          </div>
        </div>

        {/* Tabela de IPs e Dias Faltantes */}
        <div className="rounded-md border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 border-b text-xs">
                <tr>
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Endereço IP</th>
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Último Clique Registrado</th>
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Data de Liberação (+7 dias)</th>
                  <th className="text-center p-3.5 font-semibold text-muted-foreground">Dias Restantes</th>
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Tempo Restante</th>
                  <th className="text-center p-3.5 font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                {cooldownLoading ? (
                  Array(3).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="p-4 h-12 bg-muted/10"></td>
                    </tr>
                  ))
                ) : filteredCooldownList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      {ipSearch ? "Nenhum IP encontrado com este filtro." : "Nenhum IP registrado em quarentena ainda. Os acessos aos links aparecerão aqui."}
                    </td>
                  </tr>
                ) : (
                  filteredCooldownList.map((item: any) => {
                    const isQuarantine = item.status === 'Em Quarentena' || (item.days_remaining && item.days_remaining > 0);
                    return (
                      <tr key={item.ip_address} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 font-mono font-medium text-foreground">
                          {item.ip_address}
                        </td>
                        <td className="p-3.5 text-muted-foreground">
                          {formatDate(item.last_click_at)}
                        </td>
                        <td className="p-3.5 text-muted-foreground">
                          {formatDate(item.cooldown_until)}
                        </td>
                        <td className="p-3.5 text-center font-semibold">
                          <span className={isQuarantine ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}>
                            {Number(item.days_remaining || 0).toFixed(1)} dias
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-medium text-foreground">
                            {item.formatted_time_remaining || (isQuarantine ? `${item.days_remaining}d restantes` : 'Liberado para novo clique')}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          {isQuarantine ? (
                            <Badge 
                              variant="outline" 
                              className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 gap-1 font-medium"
                            >
                              <span>🔴</span> Em Quarentena
                            </Badge>
                          ) : (
                            <Badge 
                              variant="outline" 
                              className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30 gap-1 font-medium"
                            >
                              <span>🟢</span> Liberado
                            </Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}


