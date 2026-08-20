# Plano de Correção da Exclusão de Contatos

O usuário relatou um erro ao tentar excluir contatos. A análise das políticas de RLS revelou que a permissão de exclusão está restrita apenas a usuários com a role `admin`. 

Recentemente, a visibilidade da página de contatos foi liberada para todos os usuários, mas a permissão de exclusão permaneceu restrita. O objetivo deste plano é permitir que os usuários comuns excluam os contatos que eles mesmos criaram ou que todos os usuários autenticados possam gerenciar a lista, dependendo da preferência de negócio. Dado que a inserção é permitida para todos e a visualização também, a exclusão por usuários autenticados parece ser a intenção para evitar o erro relatado.

## Alterações Propostas

### Banco de Dados (Supabase)

#### Nova Migração SQL
- Atualizar a política `Admins can delete contacts` na tabela `public.contacts`.
- Alterar para permitir que qualquer usuário autenticado (`authenticated`) possa excluir contatos, OU garantir que o administrador `ajpentretedimento@hotmail.com` tenha a permissão correta e que outros usuários saibam por que não podem excluir.
- **Decisão:** Como o erro está ocorrendo para o usuário (que pode não ser admin no momento da ação ou a política está falhando), vou ampliar a permissão de DELETE para `authenticated` usuários, alinhando com as permissões de SELECT e INSERT já existentes.

```sql
DROP POLICY IF EXISTS "Admins can delete contacts" ON public.contacts;

CREATE POLICY "Authenticated users can delete contacts"
ON public.contacts FOR DELETE
TO authenticated
USING (true);
```

### Frontend

#### `src/routes/_authenticated/contacts.tsx`
- Adicionar um log de erro mais detalhado no `catch` da exclusão para facilitar diagnósticos futuros caso o erro persista (ex: erro de rede vs erro de permissão).

## Considerações Técnicas
- A política de UPDATE também está restrita a admins. Vou avaliar se deve ser liberada também para permitir a atualização do status de envio por usuários comuns.
