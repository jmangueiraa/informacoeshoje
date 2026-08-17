# Plano: Exibição de Usuários para o Administrador

O objetivo é permitir que o administrador visualize a lista de todos os usuários cadastrados no sistema através do Painel ADM.

## Alterações Técnicas

### Backend (Server Functions)
- **src/lib/admin.functions.ts**:
    - Criar a função `getAdminUsers` para buscar todos os registros da tabela `profiles`.
    - Garantir que a função verifique se o solicitante tem a role `admin`.

### Frontend (UI)
- **src/routes/_authenticated/admin/index.tsx**:
    - Adicionar uma nova seção (Card) abaixo das estatísticas globais contendo uma tabela de usuários.
    - Utilizar os componentes de UI (`Table`, `Badge`) para uma visualização limpa.
    - Exibir colunas: Usuário (Avatar/Nome), Plano, Status e Data de Criação.

## User Review Required
> [!IMPORTANT]
> A tabela `profiles` armazena informações públicas dos usuários. Por padrão, o e-mail fica na tabela `auth.users` (privada do Supabase). Se precisar exibir o e-mail na lista, precisarei de uma lógica adicional ou garantir que o e-mail foi sincronizado com o `profiles`. Deseja ver o e-mail dos usuários nesta lista agora?

## Passos de Verificação
- Acessar o Painel ADM com a conta de administrador.
- Validar se a lista de usuários carrega corretamente.
- Verificar se usuários não-administradores continuam sem acesso à rota.
