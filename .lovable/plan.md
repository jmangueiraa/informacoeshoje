# Plano: Restrição de Acesso Administrativo

O objetivo é garantir que apenas o e-mail `ajpentretedimento@hotmail.com` possua privilégios de administrador no sistema, removendo o acesso de qualquer outro usuário (como `beatrizcosta.costa1994@gmail.com` ou `augusto_mangueira@hotmail.com`).

## Alterações no Banco de Dados (Supabase)

1. **Nova Migração SQL**:
   - Criar uma migração que:
     - Identifique o ID do usuário correspondente a `ajpentretedimento@hotmail.com`.
     - Remova todas as entradas da tabela `public.user_roles` onde o `role` é 'admin', exceto para o ID identificado.
     - (Opcional) Garanta que o usuário `ajpentretedimento@hotmail.com` tenha a role 'admin' caso ainda não tenha.

## Verificação Técnica

1. **Execução do SQL**: Aplicar a migração via ferramenta de banco de dados.
2. **Validação**: Verificar na tabela `public.user_roles` se apenas um registro com `role = 'admin'` permanece.

---

## Detalhes Técnicos (para o usuário)
Esta alteração remove o "poder de administrador" de todas as contas, exceto da conta principal especificada (`ajpentretedimento@hotmail.com`). As outras contas continuarão funcionando normalmente para criar links, mas não terão mais acesso ao painel de controle global (estatísticas de todos os usuários, gestão de domínios, etc).
