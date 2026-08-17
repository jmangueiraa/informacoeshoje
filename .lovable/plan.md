# Plano de Ação: Estabilização da Sessão de Usuário

O usuário relatou que, após a última atualização, o sistema parou de reconhecer o usuário e senha (dificuldade de entrar). Isso geralmente ocorre quando há uma dessincronização entre o estado de autenticação no cliente (Supabase JS) e o motor de rotas do TanStack Router, ou quando o redirecionamento `beforeLoad` falha em aguardar a inicialização da sessão.

## Problemas Identificados
1. **Verificação de Sessão Apressada**: O guard `beforeLoad` em `src/routes/_authenticated.tsx` pode estar rodando antes que o SDK do Supabase termine de ler o token do `localStorage`, causando redirecionamentos falsos para `/auth`.
2. **Ciclo de Redirecionamento**: Se o usuário for redirecionado para `/auth` enquanto ainda está sendo autenticado, ele pode ficar preso em um loop ou perder o contexto da sessão.
3. **Falta de Reconhecimento de Senha**: Se o login via senha "não entra mais", pode ser um erro no tratamento de erros ou no redirecionamento pós-sucesso em `src/routes/auth.tsx`.

## Proposta de Soluções

### 1. Reforço da Verificação em `_authenticated.tsx`
Vou adicionar uma pequena espera (retry) ou uma verificação mais robusta que aguarde a inicialização da auth, garantindo que o `redirect` só aconteça se a sessão realmente não existir após a hidratação.

### 2. Melhoria no Fluxo de Login em `auth.tsx`
Ajustar o `handleEmailAuth` para garantir que a navegação ocorra apenas quando o estado `SIGNED_IN` for confirmado, evitando disparar redirecionamentos manuais que conflitem com o `onAuthStateChange` global.

### 3. Sincronização Global em `__root.tsx`
Garantir que o `onAuthStateChange` seja resiliente a atualizações de página e não limpe o estado de forma agressiva durante o `TOKEN_REFRESHED`.

## Detalhes Técnicos
- Modificar `src/routes/_authenticated.tsx` para usar uma abordagem mais resiliente no `beforeLoad`.
- Refatorar a lógica de redirecionamento no `src/routes/auth.tsx`.
- Validar se o `localStorage` está sendo persistido corretamente no `client.ts` (já está configurado, mas vou reforçar a verificação).

---
**Nota:** Não alterarei o comportamento de "não deslogar ao atualizar", apenas tornarei o reconhecimento do login mais confiável para que a sessão persista conforme o esperado.
