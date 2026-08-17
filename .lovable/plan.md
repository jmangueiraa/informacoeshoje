# Plano de Implementação: Domínio Personalizado (ajp.com.br)

O usuário deseja acrescentar o domínio `ajp.com.br` ao sistema LinkShopee. Como o projeto está no Lovable Cloud (Supabase), a gestão de domínios personalizados para o projeto como um todo é feita via plataforma, mas a lógica de aplicação no SaaS exige suporte no banco de dados para que os links gerados possam usar esse domínio.

## Alterações Propostas

### 1. Banco de Dados (Supabase)
- Adicionar coluna `custom_domain` na tabela `public.links` para permitir que links específicos usem um domínio diferente do padrão.
- Adicionar coluna `custom_domain` na tabela `public.profiles` (ou uma nova tabela `user_domains`) para gerenciar domínios validados por usuário.
- Atualizar políticas de RLS.

### 2. Backend (Server Functions)
- **`src/lib/links.functions.ts`**: Atualizar `createCustomLink` para aceitar um domínio personalizado opcional.
- **`src/lib/analytics.functions.ts`**: Ajustar `registerClick` para identificar o link não apenas pelo slug, mas também pelo host da requisição, caso um domínio personalizado seja usado.

### 3. Frontend (Dashboard & Redirect)
- **`src/routes/_authenticated/links.tsx`**: Adicionar campo de seleção de domínio no formulário de criação de link.
- **`src/routes/$slug.tsx`**: Ajustar a lógica de exibição do link para refletir o domínio configurado (ex: `ajp.com.br/meu-link` em vez de `linkshopee.app/meu-link`).

### 4. Configuração de Infraestrutura (Instrução ao Usuário)
- Informar que para `ajp.com.br` funcionar, ele precisa ser configurado no painel do projeto (DNS) e apontar para os servidores do Lovable Cloud.

## Detalhes Técnicos
- Migração SQL para adicionar colunas necessárias.
- Lógica de detecção de `request.headers.get('host')` nas server functions para resolver links via domínio customizado.

## Próximos Passos
- Executar migração SQL.
- Atualizar tipos e funções de gerenciamento de links.
- Modificar interface de criação de links.
