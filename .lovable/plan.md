# Plano para Corrigir Visibilidade da "Captura de Contatos"

A funcionalidade "Captura de Contatos" está configurada para aparecer apenas para usuários com a role `admin`. Como o acesso administrativo foi recentemente restrito exclusivamente a **ajpentretedimento@hotmail.com**, o usuário relatou que a opção não está aparecendo. Isso pode ocorrer por um atraso na atualização do cache do cliente ou pela lógica de renderização condicional no componente da barra lateral.

## Ações Propostas

### 1. Verificar e Ajustar o Componente Sidebar
*   Revisar `src/components/layout/AppSidebar.tsx`.
*   Garantir que a lógica `isAdmin || isAdminLoading` seja robusta o suficiente para exibir o item de menu assim que o status for verificado.
*   Remover dependências de cache obsoletas se necessário.

### 2. Validar o Status do Administrador no Navegador
*   Usar scripts de inspeção no navegador (Playwright) para verificar se o usuário logado possui a role `admin` e se o elemento está presente no DOM, mas oculto ou não renderizado.

### 3. Melhorar a Persistência do Status de Admin
*   Garantir que a verificação de admin seja reexecutada após o login e durante a navegação, para que a interface reflita a mudança de privilégios imediatamente.

## Detalhes Técnicos
*   **Componente:** `AppSidebar.tsx`
*   **Função de Verificação:** `checkIsAdmin` em `src/lib/admin.functions.ts`
*   **Controle de Estado:** TanStack Query (`useQuery`)

Deseja que eu proceda com a inspeção da interface para identificar por que o botão não está visível para o seu usuário?
