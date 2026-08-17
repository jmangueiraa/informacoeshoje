import { createFileRoute, useNavigate } from '@tanstack/react-router'
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

export const Route = createFileRoute('/auth')({
  validateSearch: z.object({
    redirect: z.string().optional(),
  }),
  component: AuthPage,
})

function AuthPage() {
  const search = Route.useSearch()
  const redirect = search.redirect
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
        navigate({ to: redirect || '/dashboard' })
      } else {
        const dest = redirect || '/dashboard'
        console.log('Login successful, waiting for session sync...')
        toast.success('Entrando...')
        
        // Wait a small moment for Supabase to persist the session to localStorage
        // before performing a hard navigation
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.href = dest
          } else {
            navigate({ to: dest })
          }
        }, 800)
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
          <div className="grid grid-cols-1 gap-2">
            <Button variant="outline" onClick={handleGoogleAuth} className="w-full">
              <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
              Continuar com Google
            </Button>
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Ou com e-mail</span>
            </div>
          </div>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar Conta</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="space-y-4 pt-4">
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
            </TabsContent>
            <TabsContent value="signup" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email">E-mail</Label>
                <Input id="signup-email" type="email" placeholder="nome@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Senha</Label>
                <Input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button className="w-full" variant="secondary" onClick={() => handleEmailAuth('signup')} disabled={loading}>
                {loading ? 'Criando conta...' : 'Criar Conta'}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
          Ao continuar, você concorda com nossos termos de uso.
        </CardFooter>
      </Card>
    </div>
  )
}
