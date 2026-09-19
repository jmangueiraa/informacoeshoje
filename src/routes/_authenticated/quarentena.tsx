import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  ShieldAlert, 
  ShieldCheck, 
  Clock, 
  Search, 
  RefreshCw, 
  Info,
  CheckCircle2,
  AlertTriangle
} from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/integrations/supabase/client"
import { getIpCooldownList } from "@/lib/analytics.functions"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

export const Route = createFileRoute('/_authenticated/quarentena')({
  component: QuarentenaPage,
})

export function QuarentenaPage() {
  const queryClient = useQueryClient()
  const [ipSearch, setIpSearch] = useState("")

  const { data: cooldownList, isLoading: cooldownLoading, refetch: refetchCooldown } = useQuery({
    queryKey: ['ip-cooldown-list'],
    queryFn: () => getIpCooldownList(),
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  })

  useEffect(() => {
    const channel = supabase
      .channel('quarentena-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ip_cooldown' }, () => {
        queryClient.invalidateQueries({ queryKey: ['ip-cooldown-list'] })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clicks' }, () => {
        queryClient.invalidateQueries({ queryKey: ['ip-cooldown-list'] })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'link_clicks' }, () => {
        queryClient.invalidateQueries({ queryKey: ['ip-cooldown-list'] })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

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
          <div className="flex items-center gap-2">
            <Clock className="h-7 w-7 text-orange-500" />
            <h1 className="text-3xl font-bold tracking-tight">Quarentena de IPs (Shopee)</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Controle de contagem regressiva e liberação de cliques únicos na janela de atribuição de 7 dias da Shopee.
          </p>
        </div>

        <Button 
          variant="outline" 
          size="default" 
          onClick={() => refetchCooldown()}
          disabled={cooldownLoading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${cooldownLoading ? 'animate-spin' : ''}`} />
          <span>Atualizar Dados</span>
        </Button>
      </header>

      {/* Cards de Métricas Rápidas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de IPs Registrados</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cooldownList?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Dispositivos / redes que acessaram os links</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 bg-red-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-600 dark:text-red-400">Em Quarentena (Bloqueados)</CardTitle>
            <ShieldAlert className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{quarantineCount}</div>
            <p className="text-xs text-red-600/70 dark:text-red-400/70">Dentro do prazo de 7 dias da Shopee</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 bg-green-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-600 dark:text-green-400">Liberados para Novo Clique</CardTitle>
            <ShieldCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{releasedCount}</div>
            <p className="text-xs text-green-600/70 dark:text-green-400/70">Janela de 7 dias encerrada com sucesso</p>
          </CardContent>
        </Card>
      </div>

      {/* Caixa Informativa */}
      <Card className="bg-muted/30 border border-muted-foreground/10">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Como funciona a Validação Dupla de 7 Dias:</p>
            <p>
              A Shopee atribui comissões baseando-se em uma janela de <strong>7 dias</strong>. Nosso sistema valida simultaneamente o <strong>Cookie de Navegador</strong> (<code className="text-foreground bg-muted px-1 py-0.5 rounded">shopee_click_cooldown</code>) e o <strong>Endereço IP</strong> no banco de dados. Isso impede contagens duplicadas mesmo em casos de troca de rede (Wi-Fi para 4G) ou IPs compartilhados (CGNAT).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Seção Principal da Tabela */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl font-semibold tracking-tight">Status Individual dos Endereços IP</h2>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por IP, status ou tempo..."
              value={ipSearch}
              onChange={(e) => setIpSearch(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
        </div>

        {/* Tabela Formatada */}
        <div className="rounded-md border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 border-b text-xs">
                <tr>
                  <th className="text-left p-4 font-semibold text-muted-foreground">Endereço IP</th>
                  <th className="text-left p-4 font-semibold text-muted-foreground">Último Clique Registrado</th>
                  <th className="text-left p-4 font-semibold text-muted-foreground">Data de Liberação (+7 dias)</th>
                  <th className="text-center p-4 font-semibold text-muted-foreground">Dias Restantes</th>
                  <th className="text-left p-4 font-semibold text-muted-foreground">Tempo Restante</th>
                  <th className="text-center p-4 font-semibold text-muted-foreground">Status</th>
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
                      {ipSearch ? "Nenhum IP localizado para a busca informada." : "Nenhum endereço IP registrado ainda. Os cliques nos links aparecerão aqui automaticamente."}
                    </td>
                  </tr>
                ) : (
                  filteredCooldownList.map((item: any) => {
                    const isQuarantine = item.status === 'Em Quarentena' || (item.days_remaining && item.days_remaining > 0);
                    return (
                      <tr key={item.ip_address} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4 font-mono font-medium text-foreground">
                          {item.ip_address}
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {formatDate(item.last_click_at)}
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {formatDate(item.cooldown_until)}
                        </td>
                        <td className="p-4 text-center font-semibold">
                          <span className={isQuarantine ? 'text-orange-600 dark:text-orange-400 font-bold' : 'text-green-600 dark:text-green-400 font-bold'}>
                            {Number(item.days_remaining || 0).toFixed(1)} dias
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="font-medium text-foreground">
                            {item.formatted_time_remaining || (isQuarantine ? `${item.days_remaining}d restantes` : 'Liberado para novo clique')}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {isQuarantine ? (
                            <Badge 
                              variant="outline" 
                              className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 gap-1 font-semibold"
                            >
                              <span>🔴</span> Em Quarentena
                            </Badge>
                          ) : (
                            <Badge 
                              variant="outline" 
                              className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30 gap-1 font-semibold"
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
