# Plano de Remoção do Card de Diagnóstico

Remover o card "Diagnóstico da Última Captura" da página de contatos conforme solicitado pelo usuário, para simplificar a interface após a validação da funcionalidade.

## Alterações Propostas

### Frontend

#### `src/routes/_authenticated/contacts.tsx`
- Remover o bloco condicional que renderiza `{debugData && (...)}`.
- Remover o estado `debugData` e as chamadas `setDebugData(...)` dentro da função `processImages`.
- Remover a importação do ícone `Search` de `lucide-react` se ele não estiver sendo usado em outro lugar (ele é usado no input de busca, então deve ser mantido).

## Considerações Técnicas
- O estado `debugData` era usado apenas para este card informativo de depuração.
- A funcionalidade principal de extração e salvamento de contatos não será afetada.
