# Plano de Correção: Erro de Banco de Dados no Cadastro

O usuário confirmou que deseja corrigir a trigger de banco de dados para resolver o erro "Database error saving new user".

## Ações Propostas

### 1. Atualizar Trigger handle_new_user
- Criar uma nova migração Supabase.
- Modificar a função `public.handle_new_user` para ser mais resiliente.
- Usar `COALESCE` para garantir que campos obrigatórios em `public.profiles` recebam valores padrão caso os metadados do `auth.users` estejam ausentes.
- Adicionar um bloco `EXCEPTION` para garantir que erros na criação do perfil não bloqueiem a criação do usuário no sistema de autenticação.

### 2. Validar Fluxo
- Testar o cadastro com um novo usuário fictício.

---
*Nota: A função continuará sendo SECURITY DEFINER e manterá o search_path para segurança.*