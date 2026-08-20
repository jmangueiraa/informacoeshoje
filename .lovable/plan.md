# Plano: Correção da Visibilidade do Menu no Mobile

O menu lateral (sidebar) não está aparecendo ou não possui um gatilho visível em dispositivos móveis. Em telas menores, o componente `Sidebar` do shadcn entra em modo "Sheet" (gaveta) e requer um `SidebarTrigger` para ser aberto.

## Alterações Propostas

### 1. Ajuste no Layout Autenticado
- Adicionar um cabeçalho (header) visível apenas no mobile (`md:hidden`) na rota `src/routes/_authenticated.tsx`.
- Este cabeçalho conterá o `SidebarTrigger` e o título do app, permitindo que o usuário abra o menu.

### 2. Validação
- Testar o layout em diferentes viewports (mobile e desktop) para garantir que o trigger apareça corretamente apenas quando necessário.
- Garantir que o `SidebarTrigger` funcione para abrir a gaveta no mobile.

## Detalhes Técnicos
- O componente `SidebarTrigger` já foi importado e adicionado ao layout.
- O header mobile usa as classes `h-16 shrink-0 items-center gap-2 border-b px-4 md:hidden` do Tailwind.
- O conteúdo principal (`main`) agora inclui este header no topo, seguido pelo `<Outlet />`.
