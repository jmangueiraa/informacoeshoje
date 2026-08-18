# Plano de Correção do Domínio Principal (infomacoeshoje.online)

O usuário relatou que o domínio **infomacoeshoje.online** não está funcionando.
Investigações mostram que o domínio já está conectado e verificado no painel da plataforma, mas as configurações de roteamento no código e no banco de dados podem precisar de ajustes finos para garantir que os links sejam resolvidos corretamente sob este novo domínio.

## Diagnóstico Técnico
1. **Configuração de Código**: `PLATFORM_DOMAIN` foi alterado para `infomacoeshoje.online`, mas o motor de redirecionamento (`resolveDomain`) trata o domínio da plataforma como "estático" e não processa slugs de usuários se o host for o domínio principal, a menos que o link tenha sido criado especificamente para a plataforma.
2. **Conflito de Fluxo**: Como o domínio principal agora é `infomacoeshoje.online`, ele é usado tanto para o painel (dashboard/login) quanto para os links. Se um usuário acessa `infomacoeshoje.online/slug`, o sistema deve diferenciar se é uma rota de app ou um link de afiliado.
3. **Domínios Customizados**: O banco de dados tem domínios antigos e o novo. Precisamos garantir que o sistema não tente resolver `infomacoeshoje.online` como um domínio customizado "externo", mas sim como a base da plataforma.

## Ações Propostas

### 1. Ajuste no Resolutor de Domínio
Modificar `src/utils/domain-resolver.ts` para garantir que o domínio `infomacoeshoje.online` seja identificado corretamente como o domínio da plataforma, permitindo a resolução de links universais.

### 2. Sincronização de Banco de Dados
Executar migração para:
- Remover registros de domínios antigos que possam causar confusão.
- Garantir que o perfil do administrador tenha `infomacoeshoje.online` como domínio selecionado.
- Marcar `infomacoeshoje.online` explicitamente como o domínio principal na tabela `user_domains`.

### 3. Verificação de Rotas
Garantir que a rota `/$slug` no TanStack Router capture corretamente os acessos no domínio principal que não correspondam a rotas estáticas (como `/dashboard`, `/settings`, etc).

## Detalhes Técnicos
- **Arquivo**: `src/utils/domain-resolver.ts` -> Atualizar lógica de comparação de `normalizedHost`.
- **Banco**: Atualizar `public.user_domains` para o ID do administrador.
- **Vite/TanStack**: Verificar se a prioridade da rota `/$slug` está correta em relação à raiz `/`.

---
*Nota: Como o domínio já está "Active" e "Connected" no sistema, o erro "não está funcionando" geralmente indica que o link clicado retorna 404 ou redireciona para a página de erro por falta de correspondência no banco.*
