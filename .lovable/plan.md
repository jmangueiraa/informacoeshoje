---
title: Corrigir falha no redirecionamento de login
---

## Problema
O usuário relatou que "não está fazendo login na página". Ao investigar os logs e o código, observamos que o fluxo de autenticação por e-mail no arquivo `src/routes/auth.tsx` pode estar falhando em completar o redirecionamento ou capturar erros silenciosos, e o `_authenticated` layout pode estar bloqueando acessos legítimos se o estado da sessão não for sincronizado corretamente.

## Solução
1.  **Refatorar o fluxo de login**: Garantir que o `supabase.auth.signInWithPassword` limpe qualquer estado anterior e que o redirecionamento use o parâmetro `redirect` da busca (search params) se disponível.
2.  **Melhorar o feedback de erro**: Adicionar logs detalhados e garantir que o `toast.error` capture a mensagem real do backend.
3.  **Ajustar a guarda de rota**: Garantir que o `beforeLoad` em `src/routes/_authenticated.tsx` seja resiliente a verificações de sessão assíncronas.

## Etapas de implementação

### Frontend
- **src/routes/auth.tsx**:
    - Atualizar `handleEmailAuth` para usar o parâmetro de redirecionamento da URL após login bem-sucedido.
    - Adicionar log de console para depuração em tempo real durante falhas.
- **src/routes/_authenticated.tsx**:
    - Refinar a lógica de `beforeLoad` para garantir que a sessão seja verificada corretamente antes de disparar o redirecionamento para `/auth`.

## Validação
- Executar script Playwright para simular login e verificar se o redirecionamento para `/dashboard` (ou a URL pretendida) ocorre.
- Verificar se erros de "Invalid credentials" são exibidos corretamente via toast.