import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlusCircle, Newspaper, TrendingUp, Clock } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

export function DashboardHome() {
  const { data: stats } = useQuery({
    queryKey: ['news-stats'],
    queryFn: async () => {
      const { count } = await supabase
        .from('news_projects')
        .select('*', { count: 'exact', head: true })
      return { total: count || 0 }
    }
  })

  const { data: recentNews } = useQuery({
    queryKey: ['recent-news'],
    queryFn: async () => {
      const { data } = await supabase
        .from('news_projects')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)
      return data || []
    }
  })

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Bem-vindo ao FakeNews Studio.</p>
        </div>
        <Button asChild size="lg" className="gap-2">
          <Link to="/editor/$id" params={{ id: 'new' }}>
            <PlusCircle className="h-5 w-5" />
            Criar Nova Notícia
          </Link>
        </Button>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Criações</CardTitle>
            <Newspaper className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">Imagens geradas no total</p>
          </CardContent>
        </Card>
        {/* Adicionar mais stats aqui */}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Criações Recentes</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recentNews?.length === 0 ? (
            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-lg bg-muted/20">
              <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">Nenhuma notícia ainda</h3>
              <p className="text-muted-foreground">Comece criando sua primeira imagem viral!</p>
            </div>
          ) : (
            recentNews?.map((news) => (
              <Card key={news.id} className="overflow-hidden">
                <div className="aspect-video bg-muted relative flex items-center justify-center">
                  {news.main_image ? (
                    <img src={news.main_image} alt={news.title} className="object-cover w-full h-full" />
                  ) : (
                    <Newspaper className="h-12 w-12 text-muted-foreground/30" />
                  )}
                </div>
                <CardHeader>
                  <CardTitle className="line-clamp-1">{news.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    {new Date(news.created_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="bg-muted/30 p-4 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link to="/editor/$id" params={{ id: news.id }}>Editar</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
