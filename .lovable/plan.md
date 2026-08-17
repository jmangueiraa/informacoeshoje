# Plano: Corrigir Botões de Ação no Dashboard e Links

O usuário relatou que os botões de ação não estão funcionando. Após investigar o código, identifiquei alguns problemas de navegação e lógica nos componentes `DashboardHome.tsx` e `AppSidebar.tsx` que podem causar confusão ou mau funcionamento.

## Alterações

### 1. Dashboard (`src/components/dashboard/DashboardHome.tsx`)
- **Navegação**: O botão "Estatísticas" (BarChart3) nos links recentes apenas redireciona para `/links`. Vou garantir que o redirecionamento faça sentido ou que a ação seja clara.
- **Consistência**: Verificar se o botão de cópia (`copyToClipboard`) está funcionando corretamente com o domínio padrão do perfil.

### 2. Sidebar (`src/components/layout/AppSidebar.tsx`)
- **Links de Navegação**:
    - "Meus Links" e "Criar Link" estão ambos apontando para `/links`. Embora `/links` tenha o modal de criação, o item "Estatísticas" na sidebar também aponta para `/links` e está sem label de texto (apenas ícone).
    - Vou adicionar o texto "Estatísticas" ao item de menu correspondente para melhorar a acessibilidade e usabilidade.

### 3. Página de Links (`src/routes/_authenticated/links.tsx`)
- **Dropdown de Ações**:
    - O botão "Estatísticas" no dropdown de cada link não tem uma ação definida (apenas fecha o menu).
    - O botão "Configurações" no dropdown também não tem uma ação definida.
    - Vou adicionar mensagens de "Em breve" ou redirecionamentos apropriados para essas ações para que o usuário não sinta que o botão "não funciona".

## Detalhes Técnicos
- Corrigir a falta de label no item "Estatísticas" da sidebar.
- Adicionar feedbacks visuais (toasts) ou redirecionamentos para ações que atualmente são placeholders.
- Validar se os botões de exclusão e cópia estão disparando as mutações corretamente.
