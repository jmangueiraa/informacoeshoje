# Plano: Sistema de Domínios Personalizados LinkAfiliado

Implementar um sistema completo de domínios personalizados (subdomínios gratuitos e domínios próprios) para cada usuário, com verificação de DNS e resolução automática de conteúdo.

## 1. Banco de Dados (Supabase)
- **Alteração na tabela `user_domains`**:
    - Adicionar colunas: `domain_type` (subdomain/custom), `verification_status` (pending/verified/failed), `is_primary` (boolean), `updated_at` (timestamp).
    - Adicionar restrição UNIQUE para o campo `domain`.
    - Garantir que apenas um domínio por usuário seja `is_primary`.
- **Políticas RLS**:
    - `SELECT`: Usuário autenticado vê apenas seus domínios.
    - `INSERT/UPDATE/DELETE`: Apenas se `auth.uid() = user_id`.
    - `GRANT`: Garantir permissões para `authenticated` e `service_role`.

## 2. Backend (Server Functions)
- **Novo arquivo `src/lib/domains.functions.ts`**:
    - `getUserDomains`: Lista domínios do usuário logado.
    - `addUserDomain`: Adiciona novo domínio (subdomínio ou custom). Normaliza a URL (remove protocol, lowercase, trim).
    - `setPrimaryDomain`: Define o domínio principal do usuário.
    - `deleteUserDomain`: Remove um domínio.
    - `verifyDomainDNS`: Função para verificar se o CNAME aponta para o endereço da plataforma (usando API DoH do Google/Cloudflare).
- **Adaptação no `registerClick` (`src/lib/analytics.functions.ts`)**:
    - Melhorar a lógica de busca do link para identificar o usuário pelo `host` antes de procurar o `slug`.

## 3. Frontend (UI/UX)
- **Página de Configurações (`src/routes/_authenticated/settings.tsx`)**:
    - Refatorar a seção "Perfil do Usuário" para a nova seção "🌐 Domínio do Usuário".
    - Implementar as duas abas/seções: "Subdomínio Gratuito" e "Domínio Personalizado".
    - Adicionar feedbacks visuais de status (🟡 Aguardando, 🔵 Verificando, 🟢 Ativo, 🔴 Erro).
    - Adicionar instruções CNAME para domínios personalizados.
- **Painel Administrativo (`src/routes/_authenticated/admin/domains.tsx`)**:
    - Nova tela para o administrador gerenciar todos os domínios do sistema.
    - Listagem com filtros e status.

## 4. Resolução de Domínio
- **Utilitário `src/utils/domain-resolver.ts`**:
    - Função `resolveDomain(hostname)` para retornar o `user_id` e o tipo de acesso.
    - Integração com o `registerClick` e loaders de conteúdo (caso existam páginas específicas por usuário).

## 5. Configurações Globais
- Definir `PLATFORM_DOMAIN` em um arquivo de constantes (ex: `linkafiliado.com.br`).

## Detalhes Técnicos de DNS
- A verificação de CNAME será feita via chamada externa para um provedor DoH, comparando se o `TXT` ou `CNAME` do domínio inserido aponta para o domínio base do projeto Lovable.

## Passos de Verificação
- Criar um subdomínio e verificar se ele aparece no dashboard.
- Tentar adicionar um domínio customizado e ver as instruções DNS.
- Testar a exclusividade do subdomínio.
- Simular um acesso via domínio diferente (se possível no ambiente de preview).
