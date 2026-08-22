import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUserLinks, createCustomLink, deleteLink, toggleLinkStatus, getUserProfile, updateProfileDomain } from '@/lib/links.functions'
import { getUserDomains } from '@/lib/domains.functions'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  PlusCircle, 
  Link2, 
  Copy, 
  Trash2, 
  ExternalLink, 
  Search, 
  Filter,
  MoreVertical,
  BarChart3,
  Calendar,
  MousePointer2,
  Settings2
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/_authenticated/links')({
  component: LinksPage,
})

function LinksPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newLink, setNewLink] = useState<{ title: string; slug: string; affiliate_url: string; domain_id: string | null }>({ title: '', slug: '', affiliate_url: '', domain_id: null })
  
  const queryClient = useQueryClient()

  const { data: profile } = useQuery({
    queryKey: ['user-profile'],
    queryFn: () => getUserProfile(),
  })

  // Buscar domínios do usuário para o formulário
  const { data: domains } = useQuery({
    queryKey: ['user-domains'],
    queryFn: () => getUserDomains(),
  })

  // Sincronizar o domínio principal ao abrir o diálogo
  useEffect(() => {
    if (domains && domains.length > 0 && !newLink.domain_id && isCreateOpen) {
      const primary = domains.find((d: any) => d.is_primary && d.verification_status === 'verified')
      if (primary) {
        setNewLink(prev => ({ ...prev, domain_id: primary.id }));
      }
    }
  }, [domains, isCreateOpen]);

  const { data: links, isLoading } = useQuery({
    queryKey: ['user-links'],
    queryFn: () => getUserLinks(),
    refetchOnWindowFocus: true,
  })

  // Realtime: atualiza a tabela sempre que um clique for registrado
  useEffect(() => {
    const channel = supabase
      .channel('links-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'links' }, () => {
        queryClient.invalidateQueries({ queryKey: ['user-links'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clicks' }, () => {
        queryClient.invalidateQueries({ queryKey: ['user-links'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  // A atualização automática de domínio foi removida para respeitar a nova lógica de user_domains

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Enviando dados para criação:", data);
      try {
        const result = await createCustomLink({ 
          data: {
            affiliateUrl: data.affiliate_url,
            slug: data.slug,
            title: data.title || undefined,
            domainId: data.domain_id || null
          }
        });
        return result;
      } catch (err: any) {
        console.error("Erro capturado na mutação:", err);
        throw err;
      }
    },
    onSuccess: (result: any) => {
      if (result?.error) {
        toast.error(result.error)
      } else {
        queryClient.invalidateQueries({ queryKey: ['user-links'] })
        toast.success("Link criado com sucesso!")
        setIsCreateOpen(false)
        setNewLink({ title: '', slug: '', affiliate_url: '', domain_id: null })
      }
    },
    onError: (error: any) => {
      console.error("Erro na mutação:", error);
      toast.error(error.message || "Erro ao criar link. Verifique os dados e tente novamente.");
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLink({ data: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-links'] })
      toast.success("Link excluído com sucesso!")
    }
  })

  const copyToClipboard = (link: any) => {
    // Usar a URL atual como base para links sem domínio customizado específico
    const currentOrigin = window.location.origin
    
    // Priorizar o domínio associado ao link ou o domínio principal do usuário
    const userPrimaryDomain = domains?.find((d: any) => d.is_primary && d.verification_status === 'verified')
    
    let baseUrl = currentOrigin
    
    if (userPrimaryDomain) {
      // Garantir que o domínio tenha protocolo
      const domainName = userPrimaryDomain.domain
      baseUrl = domainName.startsWith('http') ? domainName : `https://${domainName}`
    }

    const url = `${baseUrl}/${link.slug}`
    navigator.clipboard.writeText(url)
    toast.success("Link copiado!")
  }

  const filteredLinks = links?.filter(link => 
    link.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    link.slug.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="container mx-auto p-6 space-y-8 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus Links</h1>
          <p className="text-muted-foreground">Gerencie e monitore o desempenho dos seus links de afiliado.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Criar Link
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Novo Link Personalizado</DialogTitle>
              <DialogDescription>
                Insira a URL do produto Shopee e escolha um slug curto.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Título Interno</Label>
                <Input 
                  id="title" 
                  placeholder="Ex: Tênis Esportivo Promoção" 
                  value={newLink.title}
                  onChange={(e) => setNewLink({...newLink, title: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="url">URL Afiliado</Label>
                <Input 
                  id="url" 
                  placeholder="https://shopee.com.br/..." 
                  value={newLink.affiliate_url}
                  onChange={(e) => setNewLink({...newLink, affiliate_url: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slug">Slug Personalizado</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm shrink-0">
                    {domains?.find((d: any) => d.id === newLink.domain_id)?.domain || "linkafiliado.app"}/
                  </span>
                  <Input 
                    id="slug" 
                    placeholder="tenis-promo" 
                    value={newLink.slug}
                    onChange={(e) => setNewLink({...newLink, slug: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="domain_id">Domínio para este Link</Label>
                <select 
                  id="domain_id"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newLink.domain_id || ''}
                  onChange={(e) => setNewLink({...newLink, domain_id: e.target.value || null})}
                >
                  <option value="">Padrão da Plataforma</option>
                  {domains?.filter((d: any) => d.verification_status === 'verified').map((d: any) => (
                    <option key={d.id} value={d.id}>{d.domain}</option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Selecione um domínio verificado ou use o padrão da plataforma.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
              <Button onClick={() => createMutation.mutate(newLink)} disabled={createMutation.isPending || !newLink.affiliate_url || !newLink.slug}>
                Criar Link
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Pesquisar por título ou slug..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filtros
        </Button>
      </div>

      <div className="grid gap-6">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-32 bg-muted/20"></div>
            </Card>
          ))
        ) : filteredLinks?.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/10">
            <Link2 className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <h3 className="mt-4 text-lg font-medium">Nenhum link encontrado</h3>
            <p className="text-muted-foreground">Comece criando seu primeiro link personalizado.</p>
          </div>
        ) : (
          filteredLinks?.map((link) => (
            <Card key={link.id} className="group hover:border-primary/50 transition-all">
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row md:items-center">
                  <div className="p-6 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold group-hover:text-primary transition-colors">/{link.slug}</h3>
                      <Badge variant={link.status === 'active' ? 'secondary' : 'outline'} className={link.status === 'active' ? 'bg-green-500/10 text-green-500' : ''}>
                        {link.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground line-clamp-1">{link.title || "Sem título"}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(link.created_at).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1 max-w-[300px] truncate">
                        <ExternalLink className="h-3 w-3" />
                        {link.affiliate_url}
                      </span>
                    </div>
                  </div>
                  
                  <div className="px-6 pb-6 md:pb-0 md:py-6 flex items-center gap-8 border-t md:border-t-0 md:border-l">
                    <div className="text-center min-w-[80px]">
                      <div className="text-2xl font-bold">{link.clicks_count || 0}</div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cliques</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(link)} title="Copiar Link">
                        <Copy className="h-4 w-4" />
                      </Button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => {
                            const userPrimaryDomain = domains?.find((d: any) => d.is_primary && d.verification_status === 'verified')
                            let baseUrl = window.location.origin
                            if (userPrimaryDomain) {
                              const domainName = userPrimaryDomain.domain
                              baseUrl = domainName.startsWith('http') ? domainName : `https://${domainName}`
                            }
                            const url = `${baseUrl}/${link.slug}`
                            window.open(url, '_blank', 'noopener,noreferrer')
                          }} className="gap-2">
                            <ExternalLink className="h-4 w-4" /> Abrir Link
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyToClipboard(link)} className="gap-2">
                            <Copy className="h-4 w-4" /> Copiar Link
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate({ to: '/dashboard' })} className="gap-2">
                            <BarChart3 className="h-4 w-4" /> Estatísticas
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate({ to: '/settings' })} className="gap-2">
                            <Settings2 className="h-4 w-4" /> Configurações
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive focus:bg-destructive/10 focus:text-destructive gap-2"
                            onClick={() => deleteMutation.mutate(link.id)}
                          >
                            <Trash2 className="h-4 w-4" /> Excluir Link
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
