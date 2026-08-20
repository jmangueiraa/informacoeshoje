---
name: Fix Contacts Page Access
description: Libera o acesso à página de Captura de Contatos para todos os usuários logados, mantendo apenas a exclusividade administrativa para ajpentretedimento@hotmail.com.
type: preference
---

O usuário relatou que a página de Captura de Contatos não aparece ao clicar no menu. A investigação revelou que a rota `src/routes/_authenticated/contacts.tsx` possui um gate de segurança `beforeLoad` que redireciona qualquer usuário não-admin para o dashboard.

### Alterações:
1.  **Remover a restrição `beforeLoad`**: Permitir que todos os usuários autenticados acessem a rota `/contacts`.
2.  **Ajustar a UI**: Embora a barra lateral já mostre o link para todos, a rota estava bloqueando o carregamento.

### Detalhes Técnicos:
- Arquivo: `src/routes/_authenticated/contacts.tsx`
- Mudança: Remover a verificação `has_role('admin')` dentro do `beforeLoad` da rota.
- Manutenção: As permissões de edição/exclusão já são tratadas via RLS e lógica de botão, então a visualização da página pode ser pública para usuários logados.

---
*Nota: A restrição administrativa deve ser mantida apenas para funções sensíveis (excluir contatos, métricas ADM, etc), mas o acesso à funcionalidade de captura deve ser geral conforme solicitado anteriormente.*
