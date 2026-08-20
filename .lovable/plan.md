# Plano para Correção da Função de Administrador

A função "Captura de Contatos" não está aparecendo para o administrador `ajpentretedimento@hotmail.com` devido a uma duplicidade de papéis (roles) no banco de dados e possíveis inconsistências na verificação de permissões no frontend.

## Alterações Propostas

### 1. Banco de Dados (SQL)
- Remover a role redundante 'user' para o usuário `ajpentretedimento@hotmail.com` (ID: `ad0645db-a78f-4c1b-bbe8-46bb4fd88261`), deixando-o apenas como 'admin'.
- Isso evita qualquer ambiguidade em consultas que possam retornar o primeiro registro encontrado.

### 2. Frontend
- Revisar o componente `src/components/layout/AppSidebar.tsx` para garantir que o estado `isAdmin` seja recuperado e atualizado corretamente.
- Adicionar um log temporário ou verificação extra se necessário para depurar o motivo da aba não renderizar.

### 3. Segurança
- Confirmar que a função `has_role` no banco de dados está sendo chamada corretamente pelas Server Functions.

## Detalhes Técnicos
- **Migração SQL**: `DELETE FROM public.user_roles WHERE user_id = 'ad0645db-a78f-4c1b-bbe8-46bb4fd88261' AND role = 'user';`
- **Validação**: Verificar através do preview se a aba "Captura de Contatos" passa a ser visível após a limpeza da role e atualização do cache do navegador.
