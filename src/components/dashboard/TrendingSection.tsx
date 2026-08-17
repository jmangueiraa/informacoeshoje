import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getTrendingTopics, refreshTrendingTopics } from "@/lib/news/trends.functions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, RefreshCw, Newspaper, ArrowRight } from "lucide-react"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"

export function TrendingSection() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  
  const { data: trends, isLoading } = useQuery({
    queryKey: ['trending-topics'],
    queryFn: () => getTrendingTopics()
  })

  const refreshMutation = useMutation({
    mutationFn: () => refreshTrendingTopics(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trending-topics'] })
      toast.success("Tendências atualizadas com sucesso!")
    },
    onError: () => {
      toast.error("Erro ao atualizar tendências")
    }
  })

  const handleUseImage = (trend: any) => {
    // Redireciona para o editor com parâmetros via query ou estado
    // Aqui vamos usar search params para simplicidade no MVP
    navigate({
      to: '/editor/$id',
      params: { id: 'new' },
      search: {
        imageUrl: trend.image_url,
        title: trend.suggested_title,
        source: trend.source
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Em Alta Agora</h2>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
        >
          <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse bg-muted/50 h-64" />
          ))
        ) : (
          trends?.map((trend) => (
            <Card key={trend.id} className="overflow-hidden group hover:border-primary/50 transition-colors">
              <div className="aspect-video relative overflow-hidden bg-muted">
                {trend.image_url ? (
                  <img 
                    src={trend.image_url} 
                    alt={trend.subject} 
                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300" 
                  />
                ) : (
                  <Newspaper className="h-12 w-12 text-muted-foreground/30 absolute inset-0 m-auto" />
                )}
                <div className="absolute top-2 right-2 bg-background/80 backdrop-blur px-2 py-1 rounded text-xs font-bold border">
                  {trend.mentions?.toLocaleString()} menções
                </div>
              </div>
              <CardHeader className="p-4">
                <CardTitle className="text-base line-clamp-1">{trend.subject}</CardTitle>
                <CardDescription className="text-xs">Fonte: {trend.source}</CardDescription>
              </CardHeader>
              <CardContent className="px-4 py-0">
                <p className="text-sm text-muted-foreground italic line-clamp-2">
                  "{trend.suggested_title}"
                </p>
              </CardContent>
              <CardFooter className="p-4">
                <Button 
                  className="w-full gap-2" 
                  onClick={() => handleUseImage(trend)}
                >
                  Usar imagem e título
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
