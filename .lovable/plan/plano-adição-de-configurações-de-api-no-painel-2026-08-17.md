# Plano: Adição de Configurações de API no Painel

Este plano detalha a criação de uma página de configurações para que o usuário possa gerenciar suas chaves de API, especificamente voltadas para a integração com a Shopee e configurações do domínio principal.

## Alterações no Banco de Dados
- Criar uma nova migração para adicionar as seguintes colunas à tabela `public.profiles`:
    - `shopee_app_id` (TEXT): ID do aplicativo na Shopee.
    - `shopee_app_secret` (TEXT): Segredo do aplicativo na Shopee.
    - `shopee_api_key` (TEXT): Chave de API geral ou do domínio.

## Backend (Server Functions)
- Adicionar a função `updateProfileSettings` em `src/lib/links.functions.ts` para permitir a atualização desses novos campos.
- Garantir que a função `getUserProfile` retorne os novos campos.

## Frontend e UI
- Criar a rota `src/routes/_authenticated/settings.tsx`:
    - Interface profissional para edição de perfil.
    - Seção "Configurações de API" com campos para App ID, App Secret e API Key.
    - Feedback visual de salvamento.
- Atualizar `src/components/layout/AppSidebar.tsx`:
    - Mudar o link de "Configurações" de `/dashboard` para `/settings`.

## Verificação
- [ ] Acessar `/settings` e verificar se os campos são carregados.
- [ ] Salvar novos valores e verificar se persistem após recarregar.
- [ ] Verificar se o Sidebar direciona corretamente para a nova página.
