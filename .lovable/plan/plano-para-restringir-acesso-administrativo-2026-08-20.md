# Plano para Restringir Acesso Administrativo

O objetivo é garantir que apenas o e-mail **ajpentretedimento@hotmail.com** tenha privilégios de administrador no sistema, removendo quaisquer outros administradores que possam ter sido adicionados anteriormente.

## Ações Sugeridas

### 1. Banco de Dados (Supabase)
*   Criar uma nova migração SQL para:
    *   Remover a role `admin` de todos os usuários na tabela `public.user_roles`, exceto para o e-mail `ajpentretedimento@hotmail.com`.
    *   Garantir que `ajpentretedimento@hotmail.com` tenha a role `admin`.
    *   (Opcional) Adicionar uma trigger ou restrição para evitar que novos admins sejam criados sem ser este e-mail específico, embora o controle por migração seja o padrão atual.

### 2. Memória do Projeto
*   Atualizar `mem://index.md` e `mem://constraint/admin-access-restriction.md` para refletir que este é o **único** administrador permitido.

## Detalhes Técnicos
*   **Tabela:** `public.user_roles`
*   **Filtro:** `auth.users.email = 'ajpentretedimento@hotmail.com'`
*   **Role:** `admin` (tipo `app_role`)

Deseja que eu execute a migração agora para garantir essa restrição exclusiva?
