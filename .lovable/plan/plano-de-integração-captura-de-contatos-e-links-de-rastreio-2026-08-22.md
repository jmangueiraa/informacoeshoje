# Plano de Integração: Captura de Contatos e Links de Rastreio

Integrar o módulo de Captura de Contatos diretamente com o sistema de links do LinkAfiliado, permitindo a geração automática de links curtos para cada contato e sua inclusão nas mensagens de WhatsApp.

## Alterações Técnicas

### 1. Novo Schema e Lógica de Geração de Links
- Criar a função `generateTrackingLink` em `src/lib/links.functions.ts` para criar registros na tabela `links` a partir de dados de contato.
- O link será criado com:
    - `title`: "Rastreio - [Nome] ([Telefone])"
    - `slug`: `rastreio-[nomeLimpo]-[4UltimosDigitos]`
    - `affiliate_url`: URL original fornecida pelo usuário.

### 2. Fluxo de Processamento em Lote (`contacts.tsx`)
- Adicionar um campo "URL de Destino (SSA)" na interface de importação.
- Ao salvar um contato extraído, chamar a função de criação de link.
- Armazenar o `slug` ou `linkId` no objeto do contato (persistido no `localStorage`).

### 3. Integração com WhatsApp (`contacts.tsx`)
- Adicionar suporte à variável `{linkRastreamento}` nos templates de mensagem.
- No `getFormattedMessage`, resolver a URL completa usando o domínio configurado do usuário ou o domínio padrão da plataforma.
- Atualizar o `handleDispatch` para garantir que o link seja incluído na mensagem enviada.

### 4. Interface do Usuário
- Adicionar campo de configuração da URL de destino no topo da página de contatos.
- Mostrar indicador de link gerado na tabela de contatos.

## Detalhes de Implementação

- **Slug Único:** A lógica de slug usará `rastreio-` prefixado para evitar conflitos com links manuais e facilitar filtros no dashboard.
- **Domínio:** A URL final usará o domínio customizado verificado do usuário (se houver) ou `infomacoeshoje.online`.
- **Persistência:** O ID do link será salvo junto com o contato no `localStorage` para que disparos futuros usem o mesmo link.

