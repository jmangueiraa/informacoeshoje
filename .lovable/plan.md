---
name: Reverter para Domínio Padrão Lovable
description: Remove o subdomínio personalizado e volta a utilizar o domínio nativo da plataforma para links e redirecionamentos.
type: feature
---

# Plano para Reverter Domínio

O usuário deseja remover o subdomínio personalizado e voltar a utilizar o domínio padrão do Lovable (`informacoeshoje.lovable.app`).

## Alterações Técnicas

### Backend (Banco de Dados)
- Atualizar a tabela `profiles` para limpar a coluna `custom_domain` de todos os usuários que estão utilizando `noticiasviraisctv.lovable.app` como se fosse um domínio customizado.
- Garantir que a lógica de geração de links utilize a constante da plataforma.

### Frontend
- Ajustar `src/lib/constants.ts` para refletir o domínio correto do projeto: `informacoeshoje.lovable.app`.
- Verificar `src/utils/domain-resolver.ts` para garantir que ele priorize o domínio principal.

## Passos de Execução

1. **Configuração de Constantes:**
   - Alterar `PLATFORM_DOMAIN` em `src/lib/constants.ts` para `informacoeshoje.lovable.app`.

2. **Limpeza de Dados:**
   - Executar migração SQL para remover referências ao domínio antigo na tabela `profiles`.

3. **Validação:**
   - Testar a geração de novos links e verificar se a URL gerada aponta para `informacoeshoje.lovable.app`.
