import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getViralContent, refreshViralRadar, Category } from '@/lib/news/viral.functions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Flame, Play, Eye, ExternalLink, RefreshCcw, Download, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_authenticated/viral')({
  component: ViralAgoraPage,
})

const CATEGORIES: { label: string; value: Category; icon: string }[] = [
  { label: 'Mais viralizados', value: 'trending', icon: '🔥' },
  { label: 'Notícias', value: 'news', icon: '📰' },
  { label: 'Humor', value: 'humor', icon: '😂' },
  { label: 'Esportes', value: 'sports', icon: '⚽' },
  { label: 'Entretenimento', value: 'entertainment', icon: '🎬' },
  { label: 'Curiosidades', value: 'curiosities', icon: '👀' },
  { label: 'Mundo', value: 'world', icon: '🌎' },
  { label: 'Brasil', value: 'brazil', icon: '🇧🇷' },
  { label: 'Redes sociais', value: 'social', icon: '📱' },
  { label: 'Games', value: 'games', icon: '🎮' },
  { label: 'Automóveis', value: 'automotive', icon: '🚗' },
]

function ViralAgoraPage() {
  const [activeCategory, setActiveCategory] = useState<Category>('trending')
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: contents, isLoading } = useQuery({
    queryKey: ['viral-content', activeCategory],
    queryFn: () => getViralContent({ data: { category: activeCategory } }),
  })

  const refreshMutation = useMutation({
    mutationFn: () => refreshViralRadar(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['viral-content'] })
      toast.success("Radar Viral atualizado com sucesso!")
    }
  })

  const handleUseContent = (item: any) => {
    navigate({
      to: '/editor/$id',
      params: { id: 'new' },
      search: {
        imageUrl: item.image_url || undefined,
        title: item.suggested_title || item.subject,
        source: item.source || undefined
      }
    })
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-orange-600 bg-orange-100 dark:bg-orange-950/30'
    if (score >= 70) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-950/30'
    return 'text-blue-600 bg-blue-100 dark:bg-blue-950/30'
  }

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            VIRAL AGORA <Flame className="text-orange-500 fill-orange-500" />
          </h1>
          <p className="text-muted-foreground">Monitore o que está bombando na internet em tempo real.</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refreshMutation.mutate()} 
          disabled={refreshMutation.isPending}
          className="gap-2"
        >
          <RefreshCcw className={`h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          Atualizar Radar
        </Button>
      </div>

      <Tabs defaultValue="trending" onValueChange={(v) => setActiveCategory(v as Category)}>
        <TabsList className="w-full flex flex-wrap h-auto bg-transparent border-b rounded-none p-0 gap-6 justify-start overflow-x-auto pb-2">
          {CATEGORIES.map((cat) => (
            <TabsTrigger 
              key={cat.value} 
              value={cat.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 pb-2 font-medium transition-all hover:text-primary"
            >
              <span className="mr-2">{cat.icon}</span>
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
          {isLoading ? (
            Array(8).fill(0).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))
          ) : contents?.filter((item, index, self) => 
            index === self.findIndex((t) => t.subject === item.subject)
          ).map((item) => (
            <Card key={item.id} className="group overflow-hidden border-border/50 hover:border-primary/50 transition-all hover:shadow-xl hover:-translate-y-1">
              <div className="relative aspect-video overflow-hidden bg-muted">
                {item.image_url && (
                  <img 
                    src={item.image_url} 
                    alt={item.subject}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                )}
                <div className="absolute top-2 right-2 flex flex-col items-end gap-2">
                  <Badge className={`${getScoreColor(item.score ?? 0)} border-none font-bold backdrop-blur-md`}>
                    🔥 {item.score ?? 0}/100
                  </Badge>
                  {['UOL', 'O Globo', 'G1'].some(source => item.source?.includes(source)) && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] backdrop-blur-md">
                      ✓ Fonte Verificada
                    </Badge>
                  )}
                  {item.type === 'video' && (
                    <Badge variant="secondary" className="backdrop-blur-md bg-black/50 text-white border-none">
                      <Play className="h-3 w-3 mr-1 fill-white" /> VÍDEO
                    </Badge>
                  )}
                </div>
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <Button size="icon" variant="secondary" className="rounded-full">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="secondary" className="rounded-full">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider px-1.5 py-0 h-5">
                    {CATEGORIES.find(c => c.value === item.category)?.label}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <CardTitle className="text-lg line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                  {item.subject}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                  <a 
                    href={item.source_url || '#'} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" /> {item.source || 'Desconhecido'}
                  </a>
                  <span className="flex items-center gap-1 font-medium text-orange-500">
                    <TrendingUp className="h-3 w-3" /> {(item.mentions ?? 0).toLocaleString()} menções
                  </span>
                </div>
              </CardContent>
              <CardFooter className="p-4 pt-0 grid grid-cols-2 gap-2">
                {item.type === 'video' ? (
                  <>
                    <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                      <a href={item.source_url || item.video_url || '#'} target="_blank" rel="noopener noreferrer">
                        Abrir Original
                      </a>
                    </Button>
                    <Button size="sm" className="w-full text-xs" onClick={() => handleUseContent(item)}>
                      Usar Referência
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                      <a href={item.source_url || '#'} target="_blank" rel="noopener noreferrer">
                        Abrir Original
                      </a>
                    </Button>
                    <Button size="sm" className="w-full text-xs" onClick={() => handleUseContent(item)}>
                      Usar Imagem
                    </Button>
                  </>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      </Tabs>

      <Card className="bg-gradient-to-br from-orange-500/5 to-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="text-primary" /> Radar Viral — Agente IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm uppercase text-muted-foreground tracking-wider">Crescimento Rápido</h4>
              <p className="text-sm">Assuntos como <span className="font-bold">"Futebol"</span> e <span className="font-bold">"Tecnologia"</span> estão acelerando nas últimas 2 horas.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm uppercase text-muted-foreground tracking-wider">Atenção do Público</h4>
              <p className="text-sm">Conteúdos de <span className="font-bold">Humor</span> possuem a maior taxa de compartilhamento atual.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm uppercase text-muted-foreground tracking-wider">Próximos Virais</h4>
              <p className="text-sm">Radar identifica potencial viral em notícias de <span className="font-bold">Curiosidades Espaciais</span>.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
