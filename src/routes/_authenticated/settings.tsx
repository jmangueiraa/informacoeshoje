import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUserProfile, updateProfileSettings } from '@/lib/links.functions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Save, Shield, Database, User } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const queryClient = useQueryClient()
  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: () => getUserProfile(),
  })

  const [formData, setFormData] = useState({
    full_name: '',
    shopee_app_id: '',
    shopee_app_secret: '',
    shopee_api_key: '',
  })

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

  const mutation = useMutation({
    mutationFn: (data: any) => updateProfileSettings({ data }),
    onSuccess: (result: any) => {
      if (result.error) {
        toast.error(result.error)
      } else {
        queryClient.invalidateQueries({ queryKey: ['user-profile'] })
        toast.success("Configurações salvas com sucesso!")
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao salvar configurações")
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(formData)
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl space-y-8 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded"></div>
        <div className="h-64 bg-muted rounded"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie suas chaves de API e informações de perfil.</p>
      </div>

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
            <div className="grid gap-2">
              <Label>Domínio Padrão</Label>
              <Input
                value={profile && !('error' in profile) ? profile.custom_domain || 'Não configurado' : ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">O domínio padrão é configurado automaticamente.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-orange-500" />
              Shopee Affiliate API
            </CardTitle>
            <CardDescription>Configurações necessárias para integração com a plataforma Shopee.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="shopee_app_id">App ID</Label>
              <Input
                id="shopee_app_id"
                value={formData.shopee_app_id}
                onChange={(e) => setFormData({ ...formData, shopee_app_id: e.target.value })}
                placeholder="Ex: 123456789"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="shopee_app_secret">App Secret</Label>
              <Input
                id="shopee_app_secret"
                type="password"
                value={formData.shopee_app_secret}
                onChange={(e) => setFormData({ ...formData, shopee_app_secret: e.target.value })}
                placeholder="••••••••••••••••"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-500" />
              Domínio & API Key
            </CardTitle>
            <CardDescription>Chave de acesso para o domínio principal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="shopee_api_key">API Key do Domínio</Label>
              <Input
                id="shopee_api_key"
                value={formData.shopee_api_key}
                onChange={(e) => setFormData({ ...formData, shopee_api_key: e.target.value })}
                placeholder="Sua chave de API do domínio principal"
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between items-center border-t px-6 py-4">
            <p className="text-sm text-muted-foreground">Certifique-se de salvar após as alterações.</p>
            <Button type="submit" disabled={mutation.isPending} className="gap-2">
              <Save className="h-4 w-4" />
              {mutation.isPending ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}