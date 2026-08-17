# Plano de Correção: Criação de Conta (Sign-up)

O usuário relatou que não está conseguindo criar uma conta no FakeNews Studio. O sistema utiliza Supabase Auth para gerenciar usuários e possui uma trigger no banco de dados para criar perfis automaticamente.

## Problemas Identificados / Hipóteses
1. **Confirmação de E-mail**: O Supabase, por padrão, exige confirmação de e-mail. Se o usuário tentar logar imediatamente após o cadastro sem confirmar, o login falhará.
2. **Erros Silenciosos**: O feedback visual pode não estar capturando erros específicos do processo de `signUp`.
3. **Trigger de Banco de Dados**: Se a trigger `handle_new_user` falhar (por exemplo, erro de permissão ou violação de restrição), a criação do usuário no Auth também falha.

## Ações Propostas

### 1. Diagnóstico e Visibilidade
- Adicionar logs mais detalhados no processo de `signUp` no arquivo `src/routes/auth.tsx`.
- Garantir que o `toast` exiba a mensagem de erro retornada pelo Supabase.

### 2. Melhoria da UX de Cadastro
- No `src/routes/auth.tsx`, após um `signUp` bem-sucedido, exibir uma mensagem clara instruindo o usuário a verificar a caixa de entrada (incluindo spam).
- Adicionar um estado visual indicando que o e-mail de confirmação foi enviado.

### 3. Ajustes de Banco de Dados (se necessário)
- Verificar se a trigger `handle_new_user` tem as permissões corretas para inserir em `profiles` e `user_roles`. (Já revisado: a função é `SECURITY DEFINER`, o que é correto).

## Detalhes Técnicos
- **Arquivo**: `src/routes/auth.tsx`
- **Função**: `handleEmailAuth`
- **Melhoria**: Adicionar tratamento específico para o retorno do `signUp`, diferenciando entre erro real e necessidade de confirmação.

---
*Nota: Como este é um ambiente de sandbox, a criação de conta real depende da configuração do projeto Supabase. Se o e-mail de confirmação estiver ativado, o usuário precisará de um e-mail válido.*
