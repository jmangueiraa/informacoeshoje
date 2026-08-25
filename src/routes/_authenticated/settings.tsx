import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUserProfile, updateProfileSettings } from '@/lib/links.functions'
import { 
  getUserDomains, 
  addUserDomain, 
  deleteUserDomain, 
  setPrimaryDomain, 
  verifyDomainDNS 
} from '@/lib/domains.functions'
import { PLATFORM_DOMAIN } from '@/lib/constants'
import { checkIsAdmin } from '@/lib/admin.functions'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { 
  Save, 
  Shield, 
  User, 
  Globe, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ExternalLink,
  Trash2,
  Check
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const queryClient = useQueryClient()
  
  // Profile Data
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: () => getUserProfile(),
  })

  // Verifica se o usuário é administrador
  const { data: isAdmin } = useQuery({
    queryKey: ['is-admin'],
    queryFn: () => checkIsAdmin(),
  })

  // Domains Data
  const { data: domains, isLoading: domainsLoading } = useQuery({
    queryKey: ['user-domains'],
    queryFn: () => getUserDomains(),
    enabled: !!isAdmin,
  })


  const [formData, setFormData] = useState({
    full_name: '',
    shopee_app_id: '',
    shopee_app_secret: '',
    shopee_api_key: '',
  })

  const [subdomain, setSubdomain] = useState('')
  const [customDomain, setCustomDomain] = useState('')

  useEffect(() => {
    if (profile && !('error' in profile)) {
      setFormData({
        full_name: profile.full_name || '',
        shopee_app_id: (profile as any).shopee_app_id || '',
        shopee_app_secret: (profile as any).shopee_app_secret || '',
        shopee_api_key: (profile as any).shopee_api_key || '',
      })
    }
  }, [profile])

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => updateProfileSettings({ data }),
    onSuccess: (result: any) => {
      if (result.error) {
        toast.error(result.error)
      } else {
        queryClient.invalidateQueries({ queryKey: ['user-profile'] })
        toast.success("Configurações salvas com sucesso!")
      }
    }
  })

  const addDomainMutation = useMutation({
    mutationFn: (data: { domain: string, type: 'subdomain' | 'custom' }) => addUserDomain({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-domains'] })
      toast.success("Domínio adicionado com sucesso!")
      setSubdomain('')
      setCustomDomain('')
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao adicionar domínio")
    }
  })

  const deleteDomainMutation = useMutation({
    mutationFn: (id: string) => deleteUserDomain({ data: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-domains'] })
      toast.success("Domínio removido")
    }
  })

  const setPrimaryMutation = useMutation({
    mutationFn: (id: string) => setPrimaryDomain({ data: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-domains'] })
      queryClient.invalidateQueries({ queryKey: ['user-profile'] })
      toast.success("Domínio principal alterado")
    }
  })

  const verifyDNSMutation = useMutation({
    mutationFn: (id: string) => verifyDomainDNS({ data: id }),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['user-domains'] })
      if (result.status === 'verified') {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateProfileMutation.mutate(formData)
  }

  const handleAddSubdomain = () => {
    if (!subdomain) return
    addDomainMutation.mutate({ domain: subdomain, type: 'subdomain' })
  }

  const handleAddCustomDomain = () => {
    if (!customDomain) return
    addDomainMutation.mutate({ domain: customDomain, type: 'custom' })
  }

  const isLoading = profileLoading || domainsLoading

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl space-y-8 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded"></div>
        <div className="h-64 bg-muted rounded"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie suas chaves de API, perfil e domínios personalizados.</p>
      </div>

      <div className="space-y-6">
        {/* DOMÍNIO DO USUÁRIO SECTION */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              🌐 Domínio para seus Links
            </CardTitle>
            <CardDescription>
              Cadastre um domínio próprio para personalizar os links que você gerar.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <Tabs defaultValue="subdomain" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="subdomain">Subdomínio Gratuito</TabsTrigger>
                <TabsTrigger value="custom">Domínio Personalizado</TabsTrigger>
              </TabsList>

              <TabsContent value="subdomain" className="space-y-4">
                <div className="grid gap-2">
                  <Label>Escolha seu subdomínio</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        value={subdomain}
                        onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="seu-nome"
                        className="pr-32"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground text-sm border-l pl-3 bg-muted/50 rounded-r-md">
                        .{PLATFORM_DOMAIN}
                      </div>
                    </div>
                    <Button 
                      onClick={handleAddSubdomain}
                      disabled={addDomainMutation.isPending || !subdomain}
                    >
                      {addDomainMutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : "Salvar subdomínio"}
                    </Button>
                  </div>
                  {subdomain && (
                    <p className="text-xs text-muted-foreground">
                      Seu endereço será: <span className="text-primary font-medium">https://{subdomain}.{PLATFORM_DOMAIN}</span>
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="custom" className="space-y-4">
                <div className="grid gap-2">
                  <Label>Seu domínio próprio</Label>
                  <div className="flex gap-2">
                    <Input
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value.toLowerCase())}
                      placeholder="www.meudominio.com.br"
                    />
                    <Button 
                      onClick={handleAddCustomDomain}
                      disabled={addDomainMutation.isPending || !customDomain}
                    >
                      {addDomainMutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : "Adicionar domínio"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ex: links.suaempresa.com ou www.seusite.com.br
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            {/* LISTA DE DOMÍNIOS */}
            {domains && domains.length > 0 && (
              <div className="space-y-4 border-t pt-6">
                <h3 className="text-sm font-medium">Seus Domínios</h3>
                <div className="grid gap-3">
                  {domains.map((d: any) => (
                    <div 
                      key={d.id} 
                      className={`flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border bg-card transition-all ${d.is_primary ? 'ring-2 ring-primary/20 border-primary/30' : ''}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{d.domain}</span>
                          {d.is_primary && (
                            <Badge variant="default" className="text-[10px] h-5 px-1.5 uppercase tracking-wider">Principal</Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 uppercase">{d.domain_type}</Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            {d.verification_status === 'verified' ? (
                              <>
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                <span className="text-xs text-green-600 font-medium italic">Domínio verificado</span>
                              </>
                            ) : d.verification_status === 'failed' ? (
                              <>
                                <AlertCircle className="h-3 w-3 text-red-500" />
                                <span className="text-xs text-red-600 font-medium italic">Configuração incorreta</span>
                              </>
                            ) : (
                              <>
                                <Loader2 className="h-3 w-3 text-amber-500 animate-spin" />
                                <span className="text-xs text-amber-600 font-medium italic">Aguardando configuração</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-4 md:mt-0">
                        {d.domain_type === 'custom' && d.verification_status !== 'verified' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-xs gap-1.5"
                            onClick={() => verifyDNSMutation.mutate(d.id)}
                            disabled={verifyDNSMutation.isPending}
                          >
                            {verifyDNSMutation.isPending ? <Loader2 className="animate-spin h-3 w-3" /> : "Verificar DNS"}
                          </Button>
                        )}
                        
                        {!d.is_primary && d.verification_status === 'verified' && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-xs gap-1.5 text-primary hover:text-primary hover:bg-primary/10"
                            onClick={() => setPrimaryMutation.mutate(d.id)}
                            disabled={setPrimaryMutation.isPending}
                          >
                            {setPrimaryMutation.isPending ? <Loader2 className="animate-spin h-3 w-3" /> : "Definir Principal"}
                          </Button>
                        )}

                        <a 
                          href={`https://${d.domain}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 gap-1.5"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Acessar
                        </a>

                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            if (window.confirm("Remover este domínio?")) {
                              deleteDomainMutation.mutate(d.id)
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* DNS INSTRUCTIONS FOR CUSTOM DOMAIN */}
                      {d.domain_type === 'custom' && d.verification_status !== 'verified' && (
                        <div className="w-full mt-4 p-3 bg-muted/50 rounded-md border border-dashed text-xs space-y-2 col-span-full">
                          <p className="font-semibold flex items-center gap-1 text-amber-600">
                            <Shield className="h-3 w-3" /> 🟡 Aguardando configuração DNS
                          </p>
                          <div className="grid grid-cols-3 gap-2 bg-background p-2 rounded border">
                            <div>
                              <span className="text-muted-foreground uppercase text-[10px]">Tipo</span>
                              <p className="font-mono">CNAME</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground uppercase text-[10px]">Nome (Host)</span>
                              <p className="font-mono">{d.domain.split('.')[0] === 'www' ? 'www' : '@'}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground uppercase text-[10px]">Destino</span>
                              <p className="font-mono">{PLATFORM_DOMAIN}</p>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            * Após configurar no seu provedor, aguarde alguns minutos e clique em "Verificar DNS".
                          </p>
                        </div>
                      )}
                      
                      {d.domain_type === 'custom' && d.verification_status === 'verified' && (
                        <div className="w-full mt-2 text-xs col-span-full">
                           <p className="font-semibold flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-3 w-3" /> 🟢 Domínio verificado
                          </p>
                        </div>
                      )}

                      {d.domain_type === 'custom' && d.verification_status === 'failed' && (
                        <div className="w-full mt-2 text-xs col-span-full">
                           <p className="font-semibold flex items-center gap-1 text-red-600">
                            <AlertCircle className="h-3 w-3" /> 🔴 DNS não configurado
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Perfil do Usuário
              </CardTitle>
              <CardDescription>Suas informações básicas de identificação.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="full_name">Nome Completo</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Seu nome"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-50 grayscale pointer-events-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-500" />
                Shopee Affiliate API
              </CardTitle>
              <CardDescription>Esta funcionalidade está temporariamente desativada.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 text-sm text-muted-foreground italic">
                A integração com a API da Shopee está em manutenção.
              </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center border-t px-6 py-4">
              <p className="text-sm text-muted-foreground">O formulário de perfil abaixo continua ativo.</p>
              <Button type="button" disabled className="gap-2">
                <Save className="h-4 w-4" />
                Salvar Perfil
              </Button>
            </CardFooter>
          </Card>
          
          <div className="flex justify-end">
            <Button type="submit" disabled={updateProfileMutation.isPending} className="gap-2">
              <Save className="h-4 w-4" />
              {updateProfileMutation.isPending ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}