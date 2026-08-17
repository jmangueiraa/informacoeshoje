# Plano: Correção de Cliques Totais no Dashboard

O usuário relatou que as estatísticas de cliques totais no dashboard não estão funcionando. Após análise, identifiquei que a função `increment_link_clicks` (responsável por atualizar o contador `clicks_count` na tabela `links`) e a lógica de contagem na tabela `clicks` estão corretas, mas há uma discrepância nos dados: existem registros na tabela `clicks`, mas os contadores `clicks_count` nos links estão zerados. Além disso, a função de incremento possui uma restrição de 24 horas por IP para cliques únicos, o que pode passar a impressão de que não está funcionando se o usuário testar repetidamente com o mesmo IP.

## Alterações Propostas

### 1. Banco de Dados (Supabase)
- Criar uma migração para sincronizar os contadores `clicks_count` existentes na tabela `links` com o número real de registros na tabela `clicks`.
- Ajustar a função `increment_link_clicks` para garantir que ela seja robusta e lide corretamente com a contagem de cliques únicos.

### 2. Backend (Server Functions)
- Revisar `getDashboardStats` em `src/lib/analytics.functions.ts` para garantir que a soma de cliques está sendo feita corretamente a partir de `clicks_count`.

## Detalhes Técnicos
- Executar `UPDATE links SET clicks_count = (SELECT count(*) FROM clicks WHERE clicks.link_id = links.id)` para corrigir dados legados.
- Garantir que a RLS da tabela `clicks` permita a leitura correta pelo `service_role` ou via funções `security definer`.

## Etapas de Verificação
- Verificar se o dashboard exibe o número correto de cliques após a sincronização.
- Realizar um clique de teste (simulando um novo IP ou limpando os registros de teste) e validar o incremento.
