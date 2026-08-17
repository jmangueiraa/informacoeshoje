# Plano: Remoção de Opções de Assinatura e Unificação de Conta

Remover referências a múltiplos planos e assinaturas, deixando o sistema preparado para uma conta única pré-definida.

## Alterações

### Frontend
- **Sidebar (`src/components/layout/AppSidebar.tsx`)**: Remover o item de menu "Assinatura".
- **Landing Page (`src/routes/index.tsx`)**: Remover a seção de "Planos" e referências no menu de navegação.
- **Admin Dashboard (`src/routes/_authenticated/admin/index.tsx`)**: Remover a coluna "Plano" da tabela de usuários.

### Banco de Dados
- **Migração SQL**:
    - Remover ou simplificar a tabela `plans` se necessário (opcional, mantê-la vazia ou ignorá-la é mais seguro para o histórico).
    - Remover a coluna `plan_id` da tabela `profiles` ou definir um valor padrão único para todos.
    - Remover lógica de trial/limites de links baseados em plano.

## Detalhes Técnicos
- As políticas de RLS e funções de servidor que verificam limites de links serão simplificadas para permitir o uso total na "conta única".
- A interface de configurações não mostrará mais informações de assinatura.
