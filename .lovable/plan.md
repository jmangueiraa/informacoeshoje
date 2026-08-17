# Plano: Configuração de Administrador Exclusivo

O usuário solicitou que o e-mail `augusto_mangueira@hotmail.com` (com a senha fornecida) seja o único administrador do sistema.

## Objetivos
1. Criar uma migração para garantir que o usuário com o e-mail especificado tenha a role `admin`.
2. Remover a role `admin` de qualquer outro usuário para garantir exclusividade.
3. Ajustar a trigger de novos usuários para garantir que ninguém mais receba a role `admin` automaticamente.

## Detalhes Técnicos

### 1. Migração de Banco de Dados
A migração executará as seguintes operações:
- Buscar o `id` do usuário pelo e-mail na tabela `auth.users`.
- Inserir ou atualizar a role `admin` para este `id` na tabela `public.user_roles`.
- Remover a role `admin` de todos os outros `user_id` na tabela `public.user_roles`.

### 2. Segurança da Trigger
Revisar a trigger `handle_new_user` para confirmar que ela atribui apenas a role `user` por padrão (conforme visto na migração inicial).

## Etapas de Implementação

1. Criar uma nova migração SQL `supabase/migrations/20260817190000_set_exclusive_admin.sql`.
2. A migração deve:
    - Identificar o UUID do usuário `augusto_mangueira@hotmail.com`.
    - Upsert da role `admin` para esse UUID.
    - Delete de registros `admin` na `user_roles` onde o `user_id` não seja esse UUID.
3. Nota: Como não posso criar usuários diretamente no `auth.users` via migração (é gerenciado pelo Supabase Auth), a migração deve ser resiliente e funcionar assim que o usuário se cadastrar ou se já existir.

## Considerações
- O usuário mencionou uma senha (`30101695`). Como agente, não gerencio senhas de usuários no banco de dados por questões de segurança e limitações da plataforma (o Supabase Auth cuida disso). O usuário deve se cadastrar com esse e-mail e senha se ainda não o fez.
