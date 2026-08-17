# Plano: Acesso ao Painel Administrativo

O usuário perguntou como acessar o painel administrativo. Atualmente, o projeto possui um dashboard para usuários autenticados em `/dashboard`, mas não há uma área de administração global visível na interface para gerenciar usuários ou configurações do sistema.

## Objetivos
1. Criar uma rota administrativa protegida para usuários com a role `admin`.
2. Adicionar um link de acesso ao painel administrativo na barra lateral (`AppSidebar`) apenas para administradores.
3. Implementar uma página inicial simples para o painel administrativo.

## Detalhes Técnicos

### 1. Verificação de Role
Utilizar a função `has_role` (já existente no banco de dados) para verificar se o usuário é um administrador.

### 2. Novas Rotas
- `src/routes/_authenticated/admin.tsx`: Layout pai para rotas administrativas que verifica a role `admin`.
- `src/routes/_authenticated/admin/index.tsx`: Página inicial do painel administrativo.

### 3. Alterações na Interface
- **AppSidebar**: Adicionar um item de menu "Administração" que só aparece se o usuário tiver a role `admin`.

### 4. Segurança
- Garantir que as Server Functions que lidam com dados administrativos usem `.middleware([requireSupabaseAuth])` e verifiquem a role no servidor.

## Etapas de Implementação

1. Criar a rota de layout administrativo `src/routes/_authenticated/admin.tsx` com verificação de role no `beforeLoad`.
2. Criar a página `src/routes/_authenticated/admin/index.tsx` com estatísticas globais (total de usuários, links, cliques).
3. Atualizar `src/components/layout/AppSidebar.tsx` para buscar a role do usuário e exibir o link "Painel ADM" condicionalmente.
