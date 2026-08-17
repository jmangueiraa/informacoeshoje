# Plano de Implementação: LinkShopee SaaS

LinkShopee é uma plataforma SaaS multitenant para criação e gerenciamento de links personalizados de afiliados da Shopee com estatísticas detalhadas.

## 1. Banco de Dados e Segurança (Concluído)
- Tabelas `plans`, `links`, `clicks` e `subscriptions` criadas.
- RLS configurado para isolamento de dados.
- Planos iniciais (Gratuito, Pro, Premium) inseridos.

## 2. Autenticação e Layout (Próximo Passo)
- **src/routes/auth.tsx**: Atualizar a interface de login/cadastro para o branding LinkShopee.
- **src/components/layout/AppSidebar.tsx**: Reformular a barra lateral com rotas: Dashboard, Meus Links, Criar Link, Estatísticas, Planos e Configurações.
- **src/routes/__root.tsx**: Garantir que o Toaster e metadados básicos estejam corretos.

## 3. Dashboard e Gerenciamento de Links
- **src/lib/links.functions.ts**: Criar funções de servidor para CRUD de links (validar URL Shopee, verificar slug único, criar link).
- **src/routes/_authenticated/dashboard.tsx**: Implementar os cards de estatísticas globais (Total de links, cliques, cliques hoje) e gráfico de tendência.
- **src/routes/_authenticated/links/index.tsx**: Tabela de gerenciamento de links com filtros e busca.
- **src/routes/_authenticated/links/create.tsx**: Formulário de criação com feedback em tempo real da disponibilidade do slug.

## 4. Sistema de Redirecionamento e Analytics
- **src/routes/$slug.tsx**: Rota dinâmica de alto nível para processar o redirecionamento.
- **src/lib/analytics.server.ts**: Lógica para extrair Device, OS, Browser do User-Agent.
- **src/lib/analytics.functions.ts**: Função de servidor para registrar o clique e retornar a URL de destino.
- Implementar verificação de expiração e status (ativo/inativo).

## 5. Estatísticas Detalhadas e Planos
- **src/routes/_authenticated/links/$id/stats.tsx**: Página de analytics específica por link com gráficos detalhados.
- **src/routes/_authenticated/billing.tsx**: Página de seleção de planos e status de assinatura.
- **Lógica de Limites**: Middleware ou verificação nas funções de servidor para impedir criação de links além do limite do plano.

## 6. Área Administrativa
- **src/routes/admin/index.tsx**: Dashboard global para o administrador gerenciar usuários, links e visualizar métricas da plataforma.
