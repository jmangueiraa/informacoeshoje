# Plano de Correção das Estatísticas

O usuário reportou que as estatísticas não estão funcionando. A análise revelou que `registerClick` e `getDashboardStats` em `src/lib/analytics.functions.ts` utilizam o cliente `supabase` exportado diretamente, o que pode causar falhas de autenticação/RLS em ambiente de servidor (TanStack Start). Além disso, a extração do IP precisa ser validada.

## Alterações

### 1. Servidor (Funções)
- **src/lib/analytics.functions.ts**:
    - Refatorar `registerClick` e `getDashboardStats` para usar `context.supabase` via middleware `requireSupabaseAuth` (onde aplicável) ou garantir que a requisição do servidor esteja corretamente vinculada.
    - Como `registerClick` é chamado de uma página pública (`/$slug`), ele não pode usar `requireSupabaseAuth`. Vou garantir que ele use o cliente administrativo ou o cliente injetado corretamente para bypassar/respeitar RLS de inserção anônima.
    - Corrigir a extração de IP para usar `event.request.headers` de forma mais robusta no contexto do TanStack Start.

### 2. Frontend (Dashboard)
- **src/components/dashboard/DashboardHome.tsx**:
    - Verificar se o `queryKey` está sendo invalidado corretamente após ações (opcional, mas bom para UX).

## Detalhes Técnicos
- O erro "estatísticas não funcionando" geralmente ocorre porque `supabase.auth.getUser()` retorna null em `createServerFn` se o middleware de autenticação não estiver presente ou se o token não for passado.
- Para cliques anônimos, a política de RLS permite INSERT, mas a leitura do link depende de `maybeSingle()`.

```typescript
// Exemplo de correção no registerClick
.handler(async ({ data, context }) => {
  // Obter IP via headers da requisição
  const ip = getRequest().headers.get("x-forwarded-for") || ...
  // ... rest of the logic
})
```

## Validação
- Testar o redirecionamento de um link existente.
- Verificar se o registro na tabela `clicks` é criado.
- Verificar se o dashboard reflete o novo clique (respeitando a regra de 24h por IP).
