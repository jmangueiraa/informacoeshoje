# Plano de Correção: Captura de Contatos

Investigação detalhada revelou que a classificação como "Revisar" ocorre porque a lógica atual no frontend (`contacts.tsx`) e backend (`contacts.server.ts`) é baseada em limites arbitrários e falta de normalização robusta. Além disso, o sistema não armazena o motivo da revisão e não trata variações de números brasileiros (DDD, DDI 55) corretamente.

## Alterações Propostas

### 1. Banco de Dados (Migração SQL)
- Adicionar coluna `review_reason` na tabela `contacts` para persistir por que um contato foi para revisão.
- Adicionar coluna `needs_review` (booleano) para identificar contatos pendentes.
- Adicionar coluna `raw_data` (JSONB) para guardar o retorno original da IA para depuração e correção manual.
- Atualizar políticas de RLS para permitir acesso a esses novos campos.

### 2. Backend (IA e Lógica de Negócio)
- **Prompt da IA (`contacts.server.ts`):**
    - Instruir a IA a retornar um JSON estruturado com campos de confiança e observações.
    - Focar na extração de padrões específicos de nomes e telefones (Destinatário, Cliente, etc).
- **Normalização de Telefone:**
    - Criar função utilitária para normalizar números brasileiros: remover prefixo "55", validar se tem 10 ou 11 dígitos (com DDD).
    - Implementar logs de depuração detalhados em cada etapa (IA, Normalização, Validação).
- **Classificação Inteligente:**
    - `NOVO`: Telefone válido normalizado + Nome plausível + Não existe no banco.
    - `DUPLICADO`: Telefone normalizado já existe para o usuário.
    - `REVISAR`: Telefone ausente/inválido, nome ausente, ou dados ambíguos.
    - **Remover** o bloqueio por "confiança" baixa se o dado for legível e válido.

### 3. Frontend (Interface do Usuário)
- **Componente de Contatos (`contacts.tsx`):**
    - Atualizar a contagem de "Revisar" para ler do banco de dados (ou estado do processamento).
    - Melhorar a área de exibição de resultados para mostrar o **motivo da revisão**.
    - Implementar logs no console do navegador para acompanhar o fluxo de processamento conforme solicitado.
    - Ajustar a lógica de upload para enviar os novos metadados.

## Detalhes Técnicos
- Utilização de Regex aprimorado para captura de telefones brasileiros.
- Tratamento de JSON retornado pela IA para evitar quebras por texto extra ou Markdown.
- Idempotência baseada em `user_id` + `phone_normalized`.

## Verificação
- Testar com imagens nítidas (deve resultar em 0 revisões).
- Testar com formatos variados: `(11) 99999-9999`, `+5511999999999`, `11999999999`.
- Verificar se o log no console exibe cada etapa do processo.
