import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlusCircle, Link2, BarChart3, MousePointer2, ArrowUpRight, Copy, ExternalLink, Activity } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { getDashboardStats } from "@/lib/analytics.functions"
import { getUserLinks } from "@/lib/links.functions"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

export function DashboardHome() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => getDashboardStats(),
  })

  const { data: links, isLoading: linksLoading } = useQuery({
    queryKey: ['user-links'],
    queryFn: () => getUserLinks(),
  })

  const copyToClipboard = (link: any) => {
    const domain = link.custom_domain || profile?.custom_domain || window.location.origin
    const url = domain.startsWith('http') ? `${domain}/${link.slug}` : `https://${domain}/${link.slug}`
    navigator.clipboard.writeText(url)
    toast.success("Link copiado para a área de transferência!")
  }

  const { data: profile } = useQuery({
    queryKey: ['user-profile'],
    queryFn: () => getUserProfile(),
  })

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Gerencie seus links de afiliado e acompanhe resultados.</p>
        </div>
        <Button asChild size="lg" className="gap-2 bg-primary hover:bg-primary/90">
          <Link to="/links">
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
                        {link.clicks_count || 0}
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant={link.status === 'active' ? 'secondary' : 'outline'} className={link.status === 'active' ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' : ''}>
                          {link.status === 'active' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="icon" variant="ghost" onClick={() => copyToClipboard(link)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" asChild>
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

function TrendingUp(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  )
}
