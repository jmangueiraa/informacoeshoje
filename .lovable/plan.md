# Plano de Restrição de Acesso: Captura de Contatos

Restringir a funcionalidade "Captura de Contatos" exclusivamente para usuários com a role `admin` (e-mail `ajpentretedimento@hotmail.com`), aplicando proteção na interface, rotas e backend.

## 1. Proteção de Interface e Rotas
- **Sidebar:** Modificar `src/components/layout/AppSidebar.tsx` para ocultar o item "Captura de Contatos" caso o usuário não tenha a role `admin`.
- **Proteção de Rota:** Adicionar uma verificação de role na rota `/_authenticated/contacts` em `src/routes/_authenticated/contacts.tsx` para redirecionar usuários não autorizados.
- **Hook de Auth:** Criar ou atualizar um hook/função para verificar se o usuário é admin de forma reativa no frontend.

## 2. Proteção de Backend (Server Functions)
- **Middleware:** Atualizar `src/lib/contacts.functions.ts` para validar a role do usuário em todas as funções (`getContacts`, `saveContact`, `deleteContact`, `processImageOCR`).
- **Verificação:** Utilizar a função `has_role` do banco de dados (via RPC) para confirmar a permissão do usuário autenticado no contexto da requisição.

## 3. Segurança do Banco de Dados (RLS)
- **Migração SQL:** Atualizar as políticas de RLS da tabela `public.contacts` para permitir operações apenas se `public.has_role(auth.uid(), 'admin')` for verdadeiro.

## Detalhes Técnicos
- **Role:** `admin`
- **Tabela:** `public.contacts`
- **RLS:** `alter policy ... using (public.has_role(auth.uid(), 'admin'))`
- **Redirecionamento:** Usuários não-admin que tentarem acessar a página serão mandados de volta para o dashboard.
