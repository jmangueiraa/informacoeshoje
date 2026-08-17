# Plano de Correção: Links e Consistência do Viral Agora

O usuário relatou que ao clicar na "fonte" a informação não está carregando/abrindo corretamente e que as informações podem estar inconsistentes.

## Alterações Propostas

### 1. Banco de Dados (Migração)
- Criar migração para adicionar a coluna `source_url` nas tabelas `viral_contents` e `trending_topics`.
- A coluna `source_url` armazenará o link original da notícia.

### 2. Backend (Funções de Servidor)
- **`src/lib/news/viral.functions.ts`**:
    - Atualizar `TRENDING_MOCK` para incluir links reais (`source_url`) para UOL, G1, etc.
    - Garantir que o `upsert` inclua o novo campo.
- **`src/lib/news/trends.functions.ts`**:
    - Atualizar `TRENDS_MOCK` para incluir links reais (`source_url`).

### 3. Frontend (Interface)
- **`src/routes/_authenticated/viral.tsx`**:
    - Corrigir o botão "Abrir Original" para usar o campo `source_url`.
    - Adicionar um link clicável no nome da fonte dentro do card.
- **`src/components/dashboard/TrendingSection.tsx`**:
    - Transformar o texto da "Fonte" em um link clicável para a `source_url`.

## Verificação
- Validar se o clique no botão "Abrir Original" no módulo Viral Agora abre o site da fonte em nova aba.
- Validar se os links no Dashboard estão funcionando e apontando para os portais corretos.

