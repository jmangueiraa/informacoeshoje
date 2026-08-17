# Plano de Implementação: Configuração de Domínio Padrão (ajpvip.com.br)

Este plano descreve as alterações necessárias para configurar `ajpvip.com.br` como o domínio padrão no perfil do usuário e garantir que a interface reflita essa preferência na criação de novos links.

## Alterações Técnicas

### Banco de Dados (Supabase)
- Identificar o perfil do usuário logado e atualizar a coluna `custom_domain` para `ajpvip.com.br`.
- Adicionar o domínio à tabela `user_domains` para garantir que ele seja reconhecido pelo sistema de redirecionamento.

### Backend (Server Functions)
- Criar ou atualizar uma função em `src/lib/links.functions.ts` para permitir a atualização do domínio padrão do perfil.
- Garantir que `getUserLinks` ou uma nova função de perfil retorne o domínio configurado.

### Frontend (UI)
- **src/routes/_authenticated/links.tsx**: 
    - Buscar o domínio padrão do perfil do usuário.
    - Atualizar o estado inicial do formulário de criação de link para usar `ajpvip.com.br` como o domínio sugerido/selecionado por padrão.
    - Exibir o domínio correto no prefixo do slug (substituindo o placeholder `linkshopee.app/` pelo domínio do usuário quando disponível).

## Passos de Execução

1. **Atualização de Dados**: Executar um comando SQL para definir o domínio no perfil do usuário atual (ou via server function se necessário para persistência dinâmica).
2. **Integração na UI**: Modificar o componente `LinksPage` para carregar o domínio do perfil e aplicá-lo ao `newLink` state.
3. **Validação**: Verificar se ao abrir o diálogo de criação de link, o domínio `ajpvip.com.br` aparece como a base do link curto.
