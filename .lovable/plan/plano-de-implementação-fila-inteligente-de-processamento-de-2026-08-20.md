# Plano de Implementação: Fila Inteligente de Processamento de Imagens

Este plano descreve a implementação de um sistema de fila para processamento de imagens usando a API do Gemini, com tratamento robusto para o erro 429 (limite de requisições) e interface de acompanhamento detalhada.

## Alterações Propostas

### Backend e Lógica Central

1.  **Refatoração de `src/lib/gemini.ts`**:
    *   Aprimorar o tratamento de erros para capturar especificamente o status `429`.
    *   Extrair o campo `retryDelay` da resposta de erro da API do Google, se disponível.
    *   Retornar um objeto de erro estruturado contendo o tempo de espera recomendado.

2.  **Segurança em `src/lib/contacts.functions.ts` e `src/lib/contacts.server.ts`**:
    *   Garantir que as funções de salvamento e processamento verifiquem rigorosamente a role `admin` do usuário autenticado através do context do TanStack Start.

### Frontend e Interface do Usuário

3.  **Novo Gerenciador de Fila em `src/routes/_authenticated/contacts.tsx`**:
    *   Implementar um estado complexo para gerenciar a fila de arquivos: `Pendente`, `Processando`, `Concluída`, `Aguardando`, `Erro`, `Ignorada`.
    *   Implementar lógica de processamento em lotes (máximo 5 requisições simultâneas).
    *   Integrar lógica de retry com backoff progressivo (60s, 120s, 180s) e respeito ao `retryDelay` da API.
    *   Adicionar persistência de estado local para não perder o progresso em caso de falhas temporárias.

4.  **Interface de Acompanhamento**:
    *   Criar um componente de "Painel de Processamento" que mostre:
        *   Contadores em tempo real (Total, Concluídas, Processando, Pendentes, Erros).
        *   Barra de progresso percentual.
        *   Alerta visual quando o limite da API for atingido, com contador regressivo (ex: "Próxima tentativa em: 42s").
        *   Botões de controle: Pausar, Continuar e Cancelar.

5.  **Refinamento de UX**:
    *   Garantir que a página de captura seja acessível apenas por administradores, tanto no roteamento quanto na renderização.
    *   Manter a normalização de telefone e deduplicação já existente.

## Detalhes Técnicos

*   **Lotes**: Divisão do array de arquivos em sub-arrays de tamanho 5.
*   **Controle de Concorrência**: Uso de `Promise.all` limitado ou execução sequencial por lotes.
*   **Tratamento 429**:
    ```typescript
    if (response.status === 429) {
      const errorBody = await response.json();
      const retryAfter = errorBody.error?.details?.find(d => d.retryDelay)?.retryDelay || "60s";
      throw { status: 429, retryAfterSeconds: parseSeconds(retryAfter) };
    }
    ```
*   **Estados da Fila**:
    ```typescript
    type QueueItemStatus = 'pending' | 'processing' | 'completed' | 'waiting' | 'error' | 'ignored';
    interface QueueItem {
      file: File;
      status: QueueItemStatus;
      error?: string;
    }
    ```

## Validação

1.  **Teste de Admin**: Tentar acessar com conta não-admin e verificar bloqueio.
2.  **Teste de Carga**: Selecionar >10 imagens e observar a divisão em lotes.
3.  **Simulação de 429**: Mockar ou forçar limite da API para validar o contador regressivo e a retomada automática.
4.  **Deduplicação**: Validar que telefones repetidos no mesmo lote não geram entradas duplicadas no banco.
