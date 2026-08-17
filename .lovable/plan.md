# Plano de Correção: Links e Consistência do Viral Agora

O usuário relatou que ao clicar na "fonte" a informação não está carregando/abrindo corretamente e que as informações podem estar inconsistentes.

## Alterações Propostas

### 1. Backend (Funções de Servidor)
- **Tabelas do Banco de Dados**: Verificar se a coluna para o link original (URL) existe e está populada.
- **`src/lib/news/viral.functions.ts`**:
    - Atualizar o `TRENDING_MOCK` com URLs reais para as fontes (UOL, G1, O Globo).
    - Adicionar uma coluna `source_url` ou similar se não existir no mock e garantir que seja salva no banco.
- **`src/lib/news/trends.functions.ts`**:
    - Adicionar links reais para os assuntos em alta.

### 2. Frontend (Interface)
- **`src/routes/_authenticated/viral.tsx`**:
    - Ajustar o botão "Abrir Original" para usar a URL real da notícia.
    - Garantir que o clique na fonte leve ao link externo.
- **`src/components/dashboard/TrendingSection.tsx`**:
    - Tornar o nome da fonte um link clicável que abre em uma nova aba.

### 3. Banco de Dados (Migração)
- Adicionar coluna `source_url` nas tabelas `viral_contents` e `trending_topics` caso não existam.
- Popular com dados reais de exemplo.

## Detalhes Técnicos
- Utilizar `target="_blank"` e `rel="noopener noreferrer"` para todos os links externos.
- Validar as URLs com Zod nas server functions.

## Verificação
- Testar os links no Dashboard.
- Testar os links na página Viral Agora.
