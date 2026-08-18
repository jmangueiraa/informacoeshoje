# Plano de Correção: Contagem de Cliques Totais

O objetivo deste plano é corrigir a falha na contagem de cliques totais no dashboard. Identificamos que, embora o registro individual de cliques na tabela `clicks` esteja funcionando, o contador denormalizado `clicks_count` na tabela `links` pode estar dessincronizado ou a lógica de filtragem de IP (24h) está impedindo incrementos esperados pelo usuário durante testes.

## Alterações Propostas

### 1. Banco de Dados (Supabase)
- Criar uma nova migração para sincronizar todos os contadores `clicks_count` da tabela `links` com o número real de registros na tabela `clicks`.
- Ajustar a função `increment_link_clicks` para garantir que o incremento ocorra corretamente, mantendo a regra de "clique único por IP a cada 24h" mas garantindo que a inserção na tabela `clicks` (que já ocorre no frontend) seja a fonte da verdade se necessário.
- Verificar e corrigir permissões de execução da função RPC.

### 2. Lógica de Backend (TanStack Start)
- Revisar `src/lib/analytics.functions.ts` para garantir que a chamada ao `registerClick` e à RPC `increment_link_clicks` esteja disparando corretamente e tratando erros.
- Otimizar a função `getDashboardStats` para garantir que ela reflita os dados mais recentes.

### 3. Interface (Dashboard)
- Garantir que o componente `DashboardHome.tsx` invalide o cache do React Query após a criação de um link ou quando um clique é detectado (embora cliques geralmente ocorram em abas separadas).

## Detalhes Técnicos
- **Migração SQL:** `UPDATE public.links l SET clicks_count = (SELECT count(*) FROM public.clicks c WHERE c.link_id = l.id)`.
- **Validação:** Realizar um teste de clique em um link existente e verificar se o `clicks_count` aumenta na tabela `links` e se o dashboard reflete a mudança.

## Checklist de Verificação
- [ ] Executar script SQL de sincronização.
- [ ] Testar redirecionamento de link.
- [ ] Verificar logs de execução da RPC.
- [ ] Confirmar atualização do número no dashboard.
