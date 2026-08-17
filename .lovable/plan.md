# Plan: Conceder Acesso Administrativo e Gerar Credenciais

O usuário solicitou liberar acesso para o e-mail `beatrizcosta.costa1994@gmail.com` com a senha `20032023@Bia`. Como o sistema já possui uma infraestrutura de administradores exclusivos (anteriormente configurada para `augusto_mangueira@hotmail.com`), este plano visa incluir o novo usuário como administrador no banco de dados e garantir que as credenciais funcionem.

## Ações a serem tomadas

### Banco de Dados (Supabase)
- Criar uma migração SQL para:
    1. Inserir o novo usuário na tabela `auth.users` com o e-mail e senha fornecidos.
    2. Associar o `user_id` gerado à role `admin` na tabela `public.user_roles`.
    3. Garantir que o perfil (`public.profiles`) seja criado corretamente (caso a trigger não dispare ou o usuário já exista).
    4. Manter o administrador anterior (`augusto_mangueira@hotmail.com`) ou ajustar para acesso compartilhado se necessário (seguindo a instrução "somente ele" anterior, mas agora adicionando um novo, interpretarei como "adicionar Beatriz à lista de admins").

### Segurança
- As senhas no Supabase são armazenadas com hash. A inserção direta via SQL usará a extensão `pgcrypto` ou funções nativas do Supabase para garantir que a autenticação funcione.

## Detalhes Técnicos
- Utilização de `supabase--migration` para executar os comandos SQL de forma segura.
- Verificação da existência do usuário antes da inserção para evitar duplicidade.
- Garantia de que a função `has_role` reconheça o novo administrador para acesso ao painel `/admin`.

---
**Nota:** O acesso administrativo permitirá que este novo usuário visualize estatísticas globais, gerencie links e visualize a lista de usuários do sistema LinkAfiliado.
