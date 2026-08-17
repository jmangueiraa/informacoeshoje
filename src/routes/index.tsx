import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { supabase } from '@/integrations/supabase/client'
import { lovable } from '@/integrations/lovable/index'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

export const Route = createFileRoute('/')({
  validateSearch: z.object({
    redirect: z.string().optional(),
  }),
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AuthPage,
})

function AuthPage() {
  const search = Route.useSearch()
  const redirectPath = search.redirect
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleEmailAuth = async (type: 'login' | 'signup') => {
    setLoading(true)
    console.log(`Starting ${type} for:`, email)
    try {
      const { data, error } = type === 'login' 
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })

      if (error) {
        console.error(`${type} error detail:`, error)
        throw error
      }
      
      console.log(`${type} result:`, data)

      if (type === 'signup') {
        toast.success('Conta criada com sucesso!')
        navigate({ to: redirectPath || '/dashboard' })
      } else {
        const dest = redirectPath || '/dashboard'
        toast.success('Entrando...')
        
        setTimeout(() => {
          navigate({ to: dest })
        }, 500)
      }
    } catch (error: any) {
      console.error('Auth handler error:', error)
      toast.error(error.message || 'Erro na autenticação. Verifique os dados e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin + '/dashboard',
      })
      if (result.error) throw result.error
    } catch (error: any) {
      toast.error(error.message || 'Erro com Google Auth')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold tracking-tight text-primary">LinkAfiliado</CardTitle>
          <CardDescription>Gerencie seus links de afiliado com inteligência</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="nome@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button className="w-full" onClick={() => handleEmailAuth('login')} disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
          Ao continuar, você concorda com nossos termos de uso.
        </CardFooter>
      </Card>
    </div>
  )
}