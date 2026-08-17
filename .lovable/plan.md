# Plano: Corrigir Botões de Ação no Dashboard e Links

O usuário relatou que os botões de ação não estão funcionando. Identifiquei erros de lógica em mutações e ações incompletas em menus de contexto.

## Alterações

### 1. Correção de Erros Críticos (`src/routes/_authenticated/links.tsx`)
- **Mutação de Exclusão**: Corrigir `deleteMutation` para passar o ID corretamente para a Server Function `deleteLink`. Atualmente ela envia um objeto `{ id }` onde a função espera apenas a string do ID, causando falha na validação Zod.
- **Ações do Dropdown**: 
    - Implementar funcionalidade no botão "Abrir Link" para usar a mesma lógica de URL do "Copiar Link".
    - Adicionar redirecionamento para `/dashboard` no botão "Estatísticas".
    - Adicionar redirecionamento para `/settings` no botão "Configurações".
    - Corrigir o fechamento do dropdown ao clicar em "Copiar Link" movendo a ação para um `DropdownMenuItem`.

### 2. Sidebar (`src/components/layout/AppSidebar.tsx`)
- **Acessibilidade**: Adicionar o texto "Estatísticas" ao item de menu na sidebar, que atualmente exibe apenas o ícone.

### 3. Dashboard (`src/components/dashboard/DashboardHome.tsx`)
- **Navegação**: Garantir que o botão de "Estatísticas" nos links recentes redirecione corretamente.

## Detalhes Técnicos
- Arquivo `src/routes/_authenticated/links.tsx`:
    - Ajustar `deleteMutation` (linha 123).
    - Adicionar `DropdownMenuItem` para "Copiar Link".
    - Preencher `onClick` para "Estatísticas" e "Configurações".
- Arquivo `src/components/layout/AppSidebar.tsx`:
    - Adicionar `<span>Estatísticas</span>` (linha 75).
