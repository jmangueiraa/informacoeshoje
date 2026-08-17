# Plano: Remover Duplicidade de Notícias

O objetivo é evitar a repetição de cards de notícias no dashboard e na página Viral Agora, garantindo que cada conteúdo seja único e a interface permaneça limpa.

## Alterações de Backend

### 1. Funções de Servidor (`src/lib/news/viral.functions.ts` e `src/lib/news/trends.functions.ts`)
- Implementar verificação de existência antes de inserir mocks ou novos tópicos.
- Adicionar lógica de `ON CONFLICT` nas inserções para evitar duplicatas baseadas no `subject` ou `url`.
- Ajustar a limpeza de dados na função `refreshTrendingTopics` para ser mais precisa.

## Alterações de Banco de Dados

### 1. Restrições de Unicidade
- Criar uma nova migração para adicionar restrições `UNIQUE` nas colunas `subject` das tabelas `viral_contents` e `trending_topics`. Isso impedirá fisicamente a inserção de duplicatas.

## Alterações de Frontend

### 1. Componentes de Lista (`src/routes/_authenticated/viral.tsx` e `src/components/dashboard/TrendingSection.tsx`)
- Adicionar um filtro de segurança no frontend (ex: usando `Set` ou `Map`) para garantir que itens com IDs duplicados não sejam renderizados, caso o backend retorne dados inconsistentes durante a transição.

## Validação
- Verificar no banco de dados se existem linhas duplicadas.
- Testar os botões de "Atualizar Radar" e "Atualizar Tendências" para garantir que novos itens não criem duplicatas.
