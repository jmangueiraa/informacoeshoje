# Plano para Correção de Erro de RLS (Row-Level Security)

O erro "new row violates row-level security policy for table 'links'" ocorre porque as **Server Functions** estão utilizando o cliente Supabase do navegador (importado de `@/integrations/supabase/client`) em vez do cliente autenticado fornecido pelo middleware de segurança. No ambiente do servidor, o cliente padrão não possui o token de sessão do usuário, fazendo com que o banco de dados rejeite a operação mesmo que o middleware tenha validado o usuário.

## Alterações Propostas

### 1. Refatoração de `src/lib/links.functions.ts`
- Substituir todas as chamadas `supabase.from(...)` por `context.supabase.from(...)` dentro das funções que possuem o middleware `requireSupabaseAuth`.
- Manter o uso do cliente padrão apenas em funções públicas (como `checkSlugAvailability`) se elas não dependerem de autenticação.
- Remover o import não utilizado de `supabase` se todas as funções forem migradas para o contexto.

### 2. Refatoração de `src/lib/play-generator.functions.ts`
- Aplicar a mesma lógica: utilizar `context.supabase` em `savePlayAsset`, `getPlayAssets` e `deletePlayAsset`.

## Detalhes Técnicos
- O middleware `requireSupabaseAuth` injeta no `context` uma instância do cliente Supabase configurada com o token de autorização do usuário.
- Ao usar `context.supabase`, o cabeçalho `Authorization: Bearer <token>` é enviado corretamente, permitindo que as políticas de RLS `USING (auth.uid() = user_id)` funcionem como esperado.

## Verificação
1. Testar a criação de um novo link no dashboard.
2. Testar o upload e salvamento de uma imagem no Gerador de Play.
3. Verificar se a listagem de links e assets continua funcionando corretamente.
