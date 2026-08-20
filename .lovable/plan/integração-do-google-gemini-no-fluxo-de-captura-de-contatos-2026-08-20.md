# Integração do Google Gemini no Fluxo de Captura de Contatos

Este plano descreve a substituição do motor de OCR atual (GPT-4o mini) pelo Google Gemini 1.5 Flash para extração de dados de etiquetas de logística, além da unificação da lógica de salvamento e deduplicação conforme solicitado.

## Alterações

### Backend (Processamento de Imagem)
- **Arquivo**: `src/lib/contacts.server.ts`
- **Ação**: 
  - Substituir as chamadas à API da OpenAI pelo Google Gemini via `@google/generative-ai` ou `fetch` direto (preferencialmente `fetch` para evitar dependências extras se possível, ou instalar o SDK oficial).
  - Configurar o prompt do Gemini para retornar **estritamente um JSON estruturado** (array de objetos `{name, phone}`).
  - Utilizar o modelo `gemini-1.5-flash`.
  - Implementar o uso da variável de ambiente `GEMINI_API_KEY`.
  - Retornar campos vazios `""` se os dados não forem legíveis.

### Server Functions (Integração e Salvamento)
- **Arquivo**: `src/lib/contacts.functions.ts`
- **Ação**:
  - Garantir que a função `saveContact` normalize o telefone antes da verificação de duplicidade.
  - Manter a verificação de duplicidade via `user_id` e `phone_normalized`.
  - Incrementar o contador de duplicados e descartar a inserção quando necessário.
  - Definir `status: 'new'` e `needs_review: false` para contatos válidos.

### Frontend (Interface e Feedback)
- **Arquivo**: `src/routes/_authenticated/contacts.tsx`
- **Ação**:
  - Atualizar o pipeline de processamento para lidar com o novo retorno (que pode ser um array de contatos por imagem).
  - Garantir a atualização em tempo real dos cards e da tabela após o processamento bem-sucedido.
  - Preservar os logs de diagnóstico para facilitar a validação.

## Detalhes Técnicos
- **Modelo**: `gemini-1.5-flash`
- **Variável**: `GEMINI_API_KEY` (já configurada nos segredos do projeto).
- **Formato de Saída**: JSON estrito sem markdown.
- **Normalização**: DDD + 8/9 dígitos (ex: `11999999999`).

## Verificação
1. Realizar upload de uma imagem de teste.
2. Validar nos logs `[IMPORT]` se o Gemini foi chamado e o JSON foi processado.
3. Verificar na tabela de contatos se os dados foram inseridos corretamente.
4. Testar duplicidade enviando a mesma imagem duas vezes.
