# Plano de Registro de Administrador

Cadastrar o usuário `ajpentretedimento@hotmail.com` como administrador do sistema.

## Alterações Técnicas

### Banco de Dados (Supabase)
- Criar uma nova migração SQL que:
    1. Verifica se o usuário já existe no esquema `auth.users`.
    2. Cria o usuário caso não exista, utilizando a senha `30101695` (criptografada com `crypt`).
    3. Garante a criação do perfil na tabela `public.profiles`.
    4. Atribui a função (role) de `admin` na tabela `public.user_roles`.

## Passos de Execução
1. Gerar e aplicar a migração SQL com o script de criação do usuário e atribuição de privilégios.
2. Validar se o registro foi bem-sucedido.
