# Plano: Alteração de Domínio Padrão

Este plano detalha a substituição do domínio `ajpvip.com.br` pelo domínio nativo da aplicação `noticiasviraisctv.lovable.app` em todas as configurações e referências de código.

## Alterações Realizadas

### Frontend e Configurações
- **src/routes/_authenticated/links.tsx**:
    - Atualizado o middleware que força a configuração do domínio padrão para usar `noticiasviraisctv.lovable.app`.
    - Alterado o placeholder e as instruções de configuração de CNAME no modal de criação de links.
- **src/lib/analytics.functions.ts**:
    - Atualizado o comentário da função `registerClick` para refletir o novo domínio de referência.
- **mem://features/dns-configuration.md**:
    - Atualizado o guia de configuração de DNS para apontar para o domínio correto.

### Backend (Próximos Passos)
- É necessário verificar e atualizar manualmente (se possível via ferramentas de DB) a tabela `profiles` e `links` para substituir qualquer ocorrência de `ajpvip.com.br` por `noticiasviraisctv.lovable.app` ou NULL, conforme a lógica de fallback do sistema.

## Verificação
- [x] O código não contém mais referências ativas a `ajpvip.com.br` que forcem seu uso.
- [x] A interface sugere o domínio da Lovable por padrão.
- [x] As instruções de DNS foram atualizadas.
