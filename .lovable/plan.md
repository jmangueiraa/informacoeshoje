# Plano de Implementação - FakeNews Studio

Sistema completo para criação de imagens de notícias virais com editor visual, templates e banco de dados.

## 1. Banco de Dados e Segurança (Lovable Cloud)

*   **Tabelas:**
    *   `profiles`: Dados básicos do usuário.
    *   `news_projects`: Armazena os metadados da notícia (título, subtítulo, portal, template, etc.).
    *   `news_templates`: Definições de layouts disponíveis.
*   **RLS:** Políticas para garantir que cada usuário gerencie apenas seus projetos.
*   **Storage:** Bucket para uploads de logos e imagens das notícias.

## 2. Estrutura de Rotas (TanStack Router)

*   `/_authenticated/dashboard`: Listagem de criações e estatísticas.
*   `/_authenticated/editor/$id`: Interface de edição (suporta novo ou existente).
*   `/auth`: Login e cadastro.

## 3. Componentes Principais

*   **Editor Form:** Campos para preenchimento dos dados da notícia.
*   **Live Preview Canvas:** Renderização dinâmica da notícia usando CSS Grid/Flexbox ou HTML Canvas (para exportação).
*   **Template Selector:** Galeria de modelos visuais.
*   **Image Uploader:** Com suporte a crop básico (usando library leve).
*   **Watermark Layer:** Camada fixa na pré-visualização e exportação com "FakeNews Studio - Imagem Gerada por IA".

## 4. Funcionalidades Técnicas

*   **Gerador de Imagem:** Utilizar `html-to-image` ou similar para converter o DOM do preview em PNG/JPG.
*   **Automação:** Botão para preencher com "Notícias Quentes" (via mock inicial, expansível para API).
*   **Exportação:** Lógica para redimensionamento nos formatos solicitados (Insta, Story, FB).

## Detalhes Técnicos

*   **Estilização:** Tailwind CSS v4 para layouts responsivos e modernos.
*   **Gerenciamento de Estado:** TanStack Query para sincronização com o banco de dados.
*   **Segurança:** Middleware Supabase para proteção de rotas e validação de sessão.
*   **Design:** Sidebar persistente no desktop e Drawer/Menu inferior no mobile.
