# Plano de Correção: Erro ao Cadastrar (Database error saving new user)

O usuário relatou o erro "Database error saving new user" ao tentar se cadastrar. Esse erro geralmente ocorre no Supabase Auth quando uma trigger AFTER INSERT na tabela auth.users falha.

## Problemas Identificados / Hipóteses

1. Conflito na Trigger handle_new_user: A trigger tenta inserir em public.profiles e public.user_roles e falha por restrições ou falta de dados.
2. Permissões de Escrita: Garantir que o service_role e o authenticated tenham as permissões corretas.

## Ações Propostas

### 1. Robustez na Trigger de Banco de Dados
- Modificar a função handle_new_user para ser mais resiliente, usando COALESCE para valores nulos e tratando exceções.

### 2. Verificação de Permissões
- Garantir os GRANTS necessários.

---
*Nota: Este erro interrompe o fluxo de autenticação do Supabase.*