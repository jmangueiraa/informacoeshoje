import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
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


  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-5 overflow-auto p-10 select-none">
        <pre className="text-[10px] leading-tight text-foreground whitespace-pre-wrap max-w-4xl">
{`Prompt para colar no Lovable:
"Substitua o texto padrão da mensagem de primeiro contato pela mensagem oficial de rastreamento e garanta a codificação correta para o WhatsApp Web:

1. Template Oficial (Atualize o valor inicial no código e no localStorage):

JavaScript
const templatePadrao = \`Olá, {primeiroNome}! Tudo bem?
Tivemos uma instabilidade no fluxo de envio do seu pacote.

Acompanhe a rota atualizada pelo rastreamento:
🔗 {linkRastreamento}

(Caso já tenha recebido a sua encomenda, favor nos responder apenas com um OK por aqui).\`;
2. Geração da URL do WhatsApp:
Certifique-se de substituir as variáveis e aplicar encodeURIComponent para preservar as quebras de linha:

JavaScript
function gerarLinkWhatsApp(contato: string, primeiroNome: string, slugLink: string) {
  const numeroLimpo = contato.replace(/\\D/g, '');
  const numeroCompleto = numeroLimpo.startsWith('55') ? numeroLimpo : \`55\${numeroLimpo}\`;
  
  const urlRastreio = \`\${window.location.origin}/rastreio/\${slugLink}\`;
  
  let mensagemFinal = templatePadrao
    .replace('{primeiroNome}', primeiroNome)
    .replace('{linkRastreamento}', urlRastreio);

  return \`https://wa.me/\${numeroCompleto}?text=\${encodeURIComponent(mensagemFinal)}\`;
}
3. Aplicação:

Ao clicar no botão de WhatsApp da tabela ou da fila de envios, use gerarLinkWhatsApp para abrir a conversa já com a mensagem completa formatada."`}
{`nao esta contabilizando os cliques verificar e corrigir
o contador de cliques nao esta funcionando
o contador de cliques nao esta funcionando
"Corrija a contabilização de cliques dos links encurtados/rastreio:

1. Lógica de Incremento na Rota do Link (/rastreio/:slug ou /:slug):

Quando o usuário acessar a URL com o slug, adicione um useEffect que executa imediatamente ao carregar a página:

Localiza o link correspondente pelo slug nos links cadastrados.

Incrementa a contagem de cliques em +1 (cliques: link.cliques + 1).

Salva a atualização no banco de dados (ou no localStorage sob a chave de links).

Se o link tiver uma URL de Destino externa (redirect) configurada, redirecione o usuário após registrar o clique (window.location.href = link.urlDestino). Se for a visualização da tela de rastreamento interna, mantenha o usuário na tela exibindo os dados normalmente.

2. Exemplo de Implementação:

TypeScript
useEffect(() => {
  if (!slug) return;

  // 1. Busca lista de links
  const linksSalvos = JSON.parse(localStorage.getItem('app_links') || '[]');
  const linkIndex = linksSalvos.findIndex((l: any) => l.slug.replace('/', '') === slug.replace('/', ''));

  if (linkIndex !== -1) {
    // 2. Incrementa cliques
    linksSalvos[linkIndex].cliques = (linksSalvos[linkIndex].cliques || 0) + 1;
    localStorage.setItem('app_links', JSON.stringify(linksSalvos));
    
    // Dispara evento para atualizar o Dashboard/Meus Links em tempo real
    window.dispatchEvent(new Event('links_updated'));

    // 3. Se for link de redirecionamento puro:
    if (linksSalvos[linkIndex].urlDestino && linksSalvos[linkIndex].tipo === 'redirect') {
      window.location.href = linksSalvos[linkIndex].urlDestino;
    }
  }
}, [slug]);
3. Atualização em Tempo Real nas Telas:

Na tela 'Meus Links' e no 'Dashboard', adicione um listener para atualizar o estado e re-renderizar o número de cliques assim que um clique ocorrer."
"Corrija a contabilização de cliques dos links encurtados/rastreio:

1. Lógica de Incremento na Rota do Link (/rastreio/:slug ou /:slug):

Quando o usuário acessar a URL com o slug, adicione um useEffect que executa imediatamente ao carregar a página:

Localiza o link correspondente pelo slug nos links cadastrados.

Incrementa a contagem de cliques em +1 (cliques: link.cliques + 1).

Salva a atualização no banco de dados (ou no localStorage sob a chave de links).

Se o link tiver uma URL de Destino externa (redirect) configurada, redirecione o usuário após registrar o clique (window.location.href = link.urlDestino). Se for a visualização da tela de rastreamento interna, mantenha o usuário na tela exibindo os dados normalmente.

2. Exemplo de Implementação:

TypeScript
useEffect(() => {
  if (!slug) return;

  // 1. Busca lista de links
  const linksSalvos = JSON.parse(localStorage.getItem('app_links') || '[]');
  const linkIndex = linksSalvos.findIndex((l: any) => l.slug.replace('/', '') === slug.replace('/', ''));

  if (linkIndex !== -1) {
    // 2. Incrementa cliques
    linksSalvos[linkIndex].cliques = (linksSalvos[linkIndex].cliques || 0) + 1;
    localStorage.setItem('app_links', JSON.stringify(linksSalvos));
    
    // Dispara evento para atualizar o Dashboard/Meus Links em tempo real
    window.dispatchEvent(new Event('links_updated'));

    // 3. Se for link de redirecionamento puro:
    if (linksSalvos[linkIndex].urlDestino && linksSalvos[linkIndex].tipo === 'redirect') {
      window.location.href = linksSalvos[linkIndex].urlDestino;
    }
  }
}, [slug]);
3. Atualização em Tempo Real nas Telas:

Na tela 'Meus Links' e no 'Dashboard', adicione um listener para atualizar o estado e re-renderizar o número de cliques assim que um clique ocorrer."`}
{`"O contador de cliques está zerado para usuários externos porque os cliques não estão sendo sincronizados no banco de dados (Supabase).

1. Rota de Redirecionamento e Incremento Global (/:slug):

Crie ou ajuste o componente de rota dinâmica [slug] (ex: pages/[slug].tsx ou app/[slug]/page.tsx ou componente de rota React Router correspondente).

Ao carregar essa rota pelo slug público:

Faça uma query direta no Supabase buscando o link pelo slug:

TypeScript
const { data: link, error } = await supabase
  .from('links')
  .select('*')
  .eq('slug', slugSemBarra)
  .single();
Se encontrar o link, incremente imediatamente no Supabase usando RPC or update direto:

TypeScript
await supabase
  .from('links')
  .update({ cliques: (link.cliques || 0) + 1 })
  .eq('id', link.id);
Em seguida, execute o redirecionamento imediato para a URL de destino:

TypeScript
if (link.urlDestino || link.url_destino) {
  window.location.replace(link.urlDestino || link.url_destino);
}
2. Tabela 'Meus Links' e Dashboard:

Na listagem da tabela 'Meus Links', certifique-se de que a coluna Cliques leia a coluna cliques retornada da tabela do Supabase.

Adicione um canal de supabase.channel('links-changes') (Realtime) para atualizar a tabela na tela automaticamente sempre que um novo clique for registrado."
"O contador de cliques está zerado para usuários externos porque os cliques não estão sendo sincronizados no banco de dados (Supabase).

1. Rota de Redirecionamento e Incremento Global (/:slug):

Crie ou ajuste o componente de rota dinâmica [slug] (ex: pages/[slug].tsx ou app/[slug]/page.tsx ou componente de rota React Router correspondente).

Ao carregar essa rota pelo slug público:

Faça uma query direta no Supabase buscando o link pelo slug:

TypeScript
const { data: link, error } = await supabase
  .from('links')
  .select('*')
  .eq('slug', slugSemBarra)
  .single();
Se encontrar o link, incremente imediatamente no Supabase usando RPC or update direto:

TypeScript
await supabase
  .from('links')
  .update({ cliques: (link.cliques || 0) + 1 })
  .eq('id', link.id);
Em seguida, execute o redirecionamento imediato para a URL de destino:

TypeScript
if (link.urlDestino || link.url_destino) {
  window.location.replace(link.urlDestino || link.url_destino);
}
2. Tabela 'Meus Links' e Dashboard:

Na listagem da tabela 'Meus Links', certifique-se de que a coluna Cliques leia a coluna cliques retornada da tabela do Supabase.

Adicione um canal de supabase.channel('links-changes') (Realtime) para atualizar a tabela na tela automaticamente sempre que um novo clique for registrado."
"O contador de cliques está zerado para usuários externos porque os cliques não estão sendo sincronizados no banco de dados (Supabase).

1. Rota de Redirecionamento e Incremento Global (/:slug):

Crie ou ajuste o componente de rota dinâmica [slug] (ex: pages/[slug].tsx ou app/[slug]/page.tsx ou componente de rota React Router correspondente).

Ao carregar essa rota pelo slug público:

Faça uma query direta no Supabase buscando o link pelo slug:

TypeScript
const { data: link, error } = await supabase
  .from('links')
  .select('*')
  .eq('slug', slugSemBarra)
  .single();
Se encontrar o link, incremente imediatamente no Supabase usando RPC or update direto:

TypeScript
await supabase
  .from('links')
  .update({ cliques: (link.cliques || 0) + 1 })
  .eq('id', link.id);
Em seguida, execute o redirecionamento imediato para a URL de destino:

TypeScript
if (link.urlDestino || link.url_destino) {
  window.location.replace(link.urlDestino || link.url_destino);
}
2. Tabela 'Meus Links' e Dashboard:

Na listagem da tabela 'Meus Links', certifique-se de que a coluna Cliques leia a coluna cliques retornada da tabela do Supabase.

Adicione um canal de supabase.channel('links-changes') (Realtime) para atualizar a tabela na tela automaticamente sempre que um novo clique for registrado."
"O contador de cliques está zerado para usuários externos porque os cliques não estão sendo sincronizados no banco de dados (Supabase).

1. Rota de Redirecionamento e Incremento Global (/:slug):

Crie ou ajuste o componente de rota dinâmica [slug] (ex: pages/[slug].tsx ou app/[slug]/page.tsx ou componente de rota React Router correspondente).

Ao carregar essa rota pelo slug público:

Faça uma query direta no Supabase buscando o link pelo slug:

TypeScript
const { data: link, error } = await supabase
  .from('links')
  .select('*')
  .eq('slug', slugSemBarra)
  .single();
Se encontrar o link, incremente imediatamente no Supabase usando RPC or update direto:

TypeScript
await supabase
  .from('links')
  .update({ cliques: (link.cliques || 0) + 1 })
  .eq('id', link.id);
Em seguida, execute o redirecionamento imediato para a URL de destino:

TypeScript
if (link.urlDestino || link.url_destino) {
  window.location.replace(link.urlDestino || link.url_destino);
}
2. Tabela 'Meus Links' e Dashboard:

Na listagem da tabela 'Meus Links', certifique-se de que a coluna Cliques leia a coluna cliques retornada da tabela do Supabase.

Adicione um canal de supabase.channel('links-changes') (Realtime) para atualizar a tabela na tela automaticamente sempre que um novo clique for registrado."`}
        </pre>
      </div>

      <Card className="w-full max-w-md relative z-10 shadow-2xl">
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
              {loading ? 'Entrando...' : 'VAMOS  COMECAR'}
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground border-t pt-4">
          <p>Ao continuar, você concorda com nossos termos de uso.</p>
          <div className="text-xs opacity-70 mt-2 flex flex-col items-center">
            <p>Desenvolvido pela AJP Entretenimento, responsável pela criação e produção deste projeto</p>
            <p className="font-semibold mt-1">CONTATO: 19981356505</p>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
