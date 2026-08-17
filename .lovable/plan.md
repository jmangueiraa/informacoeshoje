# Plano de Ação: Correção Definitiva do Fluxo de Autenticação

O usuário reportou que não consegue entrar no sistema. Isso pode ser causado por um redirecionamento agressivo no `beforeLoad` ou falha na sincronização da sessão após o login.

## Problemas Prováveis
1. **Redirecionamento Prematuro**: O guard `beforeLoad` em `_authenticated.tsx` pode estar redirecionando para `/auth` mesmo após o login bem-sucedido, se a sessão ainda não estiver totalmente "pronta" no SDK.
2. **Loop de Login**: O uso de `window.location.href` pode estar causando um recarregamento que limpa estados temporários necessários.
3. **Persistência do Supabase**: O SDK pode demorar alguns milissegundos para persistir o token no `localStorage`.

## Proposta de Soluções

### 1. Ajuste no Componente de Autenticação (`auth.tsx`)
Vou remover o delay artificial e usar o `router.navigate` do TanStack Router em vez de `window.location.href`, a menos que seja estritamente necessário. Vou garantir que o `toast` dê feedback imediato.

### 2. Melhoria no Guard de Rota (`_authenticated.tsx`)
Vou tornar o `beforeLoad` mais tolerante. Se houver qualquer indício de sessão (mesmo que parcial no `localStorage`), daremos mais tempo antes de redirecionar.

### 3. Sincronização em Tempo Real (`__root.tsx`)
Refinar o `onAuthStateChange` para reagir instantaneamente ao evento `SIGNED_IN`, forçando o roteador a revalidar as rotas sem precisar de um refresh completo da página.

## Detalhes Técnicos
- Modificar `src/routes/_authenticated.tsx` para melhorar a detecção de sessão.
- Simplificar `src/routes/auth.tsx` para uma transição mais suave.
- Garantir que o `QueryClient` seja limpo apenas em logouts explícitos.

---
**Nota:** Vou focar em tornar o processo de login "silencioso" e rápido, removendo obstáculos que possam estar travando o usuário na tela de login.
