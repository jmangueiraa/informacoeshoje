# Plano de Implementação: LinkShopee SaaS

LinkShopee é uma plataforma SaaS multitenant para criação e gerenciamento de links personalizados de afiliados da Shopee com estatísticas detalhadas.

## 1. Banco de Dados e Segurança
- Executar migração para criar as tabelas `plans`, `links`, `clicks` e `subscriptions`.
- Configurar RLS para garantir isolamento total entre usuários.
- Adicionar índices de performance para slugs e analytics.
- Atualizar a tabela `profiles` para incluir referências a planos.

## 2. Autenticação e Layout Base
- Criar fluxo de Auth (Login, Cadastro, Recuperação) com Supabase.
- Desenvolver `AppSidebar` e layout principal para o Dashboard.
- Proteger rotas autenticadas.

## 3. Dashboard e Gerenciamento de Links
- Desenvolver cards de resumo (Total de links, cliques, hoje).
- Implementar lista de links com ações (copiar, editar, status).
- Criar formulário de criação de link com validação de URL Shopee e verificação de slug.

## 4. Redirecionamento e Analytics
- Criar rota pública `/:slug` para processar redirecionamentos.
- Implementar lógica de captura de metadados do visitante (Browser, OS, Dispositivo).
- Registrar cliques no banco de dados antes do redirect 302.
- Criar página de estatísticas detalhadas por link com gráficos.

## 5. Estrutura SaaS e Planos
- Implementar verificação de limites do plano na criação de links.
- Preparar componentes de visualização de planos e upgrade.
- Criar área administrativa básica para gestão da plataforma.

## Detalhes Técnicos
- **Frontend:** React 19 + TanStack Start (Router + Server Functions).
- **Estilização:** Tailwind CSS v4 + Shadcn UI.
- **Backend:** Supabase Auth/DB/RLS.
- **Analytics:** Captura de User-Agent e Referrer.
