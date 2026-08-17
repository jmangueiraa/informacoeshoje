# Plano: Remover Landing Page e Redirecionar para Login

O usuário deseja que a Landing Page seja removida e que a rota raiz (`/`) leve diretamente para a página de login e senha.

## Ações a serem tomadas

### Roteamento (TanStack Router)
- Modificar o arquivo `src/routes/index.tsx` para atuar como um redirecionador ou exibir o componente de autenticação.
- A melhor prática no TanStack Router para redirecionamento é usar a propriedade `beforeLoad` ou simplesmente renderizar o componente `AuthPage` na rota raiz.
- No entanto, para manter a consistência e permitir que a rota `/auth` continue existindo (caso seja necessária para links externos), vamos atualizar `src/routes/index.tsx` para redirecionar usuários não autenticados para `/auth` ou, mais diretamente, substituir o conteúdo de `src/routes/index.tsx` pelo conteúdo de `src/routes/auth.tsx`.

### Ajustes de Componentes
- Como a página de login em `src/routes/auth.tsx` já está pronta e funcional, moveremos a lógica da `AuthPage` para `src/routes/index.tsx` ou faremos um redirecionamento automático via `loader`.
- Vou optar por transformar `src/routes/index.tsx` em um componente que renderiza a lógica de autenticação diretamente, tornando-a a página inicial.

## Detalhes Técnicos
- Mover a definição da `AuthPage` e seus hooks/lógica para `src/routes/index.tsx`.
- Garantir que a navegação pós-login continue funcionando para o `/dashboard`.
- Remover o arquivo `src/routes/auth.tsx` ou mantê-lo como um alias/redirecionamento se for útil.

---
**Nota:** Ao acessar o domínio principal, o usuário verá imediatamente o formulário de login/cadastro em vez da página informativa.
