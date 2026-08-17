# Plano de Implementação: Módulo de Tendências e Imagens Virais

Adição de funcionalidade de pesquisa de tendências e sugestão de imagens/títulos para o FakeNews Studio.

## 1. Banco de Dados (Lovable Cloud)

*   **Tabela `trending_topics`**:
    *   `id` (uuid, primary key)
    *   `subject` (text)
    *   `image_url` (text)
    *   `source` (text)
    *   `mentions` (integer)
    *   `trending_at` (timestamp with time zone)
    *   `suggested_title` (text)
    *   `created_at` (timestamp with time zone)

*   **Segurança**: RLS habilitado (SELECT público ou para authenticated).

## 2. API e Lógica de Servidor (TanStack Start)

*   **Server Function `getTrendingTopics`**:
    *   Responsável por buscar dados em alta (inicialmente mockado com dados reais simulados, preparado para integração com Google Trends/News API).
    *   Atualiza a tabela `trending_topics`.
*   **Server Function `searchImages`**:
    *   Busca imagens relacionadas ao tema usando APIs públicas (Unsplash/Pexels via Lovable Cloud connectors se disponível, ou mock robusto).

## 3. Frontend e UI

*   **Dashboard - Área "Em Alta Agora"**:
    *   Novo componente `TrendingSection.tsx` integrado ao `DashboardHome.tsx`.
    *   Grid de cards com: Assunto, Imagem, Fonte, Data/Hora, Menções.
    *   Botão "Usar imagem": Redireciona para o editor injetando os dados (imagem e título sugerido).
*   **Editor - Integração**:
    *   Funcionalidade "Imagem em Alta" dentro do editor para pesquisar e atualizar temas sem sair da edição.
    *   Botão "Atualizar" para forçar nova busca de tendências.

## 4. Fluxo de Trabalho

1.  Criar migração para a tabela `trending_topics`.
2.  Implementar `src/lib/news/trends.functions.ts` para lógica de busca e sugestão.
3.  Criar componente `TrendingSection` e adicionar ao Dashboard.
4.  Implementar botão de atualização de tendências.
5.  Integrar a seleção de tendência com o redirecionamento/preenchimento do Editor.

## Detalhes Técnicos

*   **IA Gateway**: Usar modelos Gemini ou GPT para gerar títulos criativos e sugestivos baseados no assunto em alta.
*   **Realtime**: (Opcional) Usar Supabase Realtime para atualizar a lista quando novos tópicos forem detectados.
