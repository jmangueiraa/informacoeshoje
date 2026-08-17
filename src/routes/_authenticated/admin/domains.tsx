import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAdminDomains, deleteAdminDomain } from '@/lib/admin.functions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Globe, ShieldCheck, User, Calendar, ExternalLink, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const Route = createFileRoute('/_authenticated/admin/domains')({
  component: AdminDomainsPage,
})

function AdminDomainsPage() {
  const queryClient = useQueryClient()
  const { data: domains, isLoading } = useQuery({
    queryKey: ['admin-domains'],
    queryFn: () => getAdminDomains(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdminDomain({ data: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-domains'] })
      toast.success("Domínio removido pelo administrador.")
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao remover domínio.")
    }
  })

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl space-y-6">
        <Skeleton className="h-8 w-[200px]" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[150px]" />
            <Skeleton className="h-4 w-[250px]" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gerenciamento de Domínios</h1>
        <p className="text-muted-foreground">Monitore todos os domínios e subdomínios configurados pelos usuários.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Domínios do Sistema
          </CardTitle>
          <CardDescription>Lista completa de todos os endereços personalizados vinculados.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domínio</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum domínio encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  domains?.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{d.domain}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {d.profiles?.full_name || d.profiles?.email || 'Usuário Desconhecido'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {d.domain_type === 'subdomain' ? 'Subdomínio' : 'Personalizado'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={d.verification_status === 'verified' ? 'default' : 'secondary'}
                          className={d.verification_status === 'verified' ? 'bg-green-500 hover:bg-green-600' : ''}
                        >
                          {d.verification_status === 'verified' ? 'Verificado' : 'Pendente'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {d.is_primary ? (
                          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">Sim</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">Não</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(d.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a 
                            href={`https://${d.domain}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 gap-1.5"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Abrir
                          </a>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              if (window.confirm(`Remover domínio ${d.domain}? Esta ação não pode ser desfeita.`)) {
                                deleteMutation.mutate(d.id)
                              }
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}