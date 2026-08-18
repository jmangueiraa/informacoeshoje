# Plano de Correção dos Contadores de Cliques

O usuário reportou que os cliques em "Links Recentes" estão aparecendo como 0 no Dashboard, mesmo quando o contador global ou de cliques hoje mostra atividade.

## Análise do Problema
1.  O Dashboard exibe `clicks_count` da tabela `links` para a lista de links recentes.
2.  Existe uma discrepância entre o total geral de cliques (calculado pela soma ou contagem na tabela `clicks`) e o campo `clicks_count` individual.
3.  A função `increment_link_clicks` pode estar bloqueando incrementos devido à trava de 24h por IP, ou por falha na resolução do IP do visitante em ambiente de preview.

## Ações Propostas

### 1. Sincronização e Ajuste de Banco de Dados
*   Executar migração para sincronizar `links.clicks_count` com o total real de registros em `clicks`.
*   Refinar a função `increment_link_clicks` para:
    *   Tratar IPs nulos, vazios ou 'unknown' permitindo o incremento (essencial para previews).
    *   Manter a trava de 24h apenas para IPs válidos.
    *   Garantir permissões de execução para `service_role`.

### 2. Refinamento das Server Functions
*   Revisar `src/lib/analytics.functions.ts` para garantir que o incremento ocorra via `supabaseAdmin` de forma robusta.

### 3. Verificação de UI
*   Garantir que `DashboardHome.tsx` está interpretando o valor de `clicks_count` como número e exibindo corretamente.

## Resumo Técnico SQL
```sql
UPDATE public.links l SET clicks_count = (SELECT count(*) FROM public.clicks c WHERE c.link_id = l.id);
-- ... ajuste da function increment_link_clicks ...
```
