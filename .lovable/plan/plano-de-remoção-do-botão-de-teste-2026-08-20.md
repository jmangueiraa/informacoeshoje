# Plano de Remoção do Botão de Teste

Remover o botão de teste de classificação e a interface de resultados associada na página de contatos para limpar a interface de produção.

## Alterações Propostas

### Frontend

#### `src/routes/_authenticated/contacts.tsx`
- Remover o botão "🧪 TESTAR CLASSIFICAÇÃO" do cabeçalho da página.
- Remover a exibição do card de resultados "TESTE CONTROLADO".
- Remover o estado `testResults` e `isTesting`.
- Remover a função `handleControlledTest`.
- Remover o ícone `Beaker` das importações de `lucide-react`.

## Considerações Técnicas
- A lógica de processamento real de imagens permanece intacta.
- A função de servidor `runControlledTest` em `src/lib/contacts.functions.ts` não será removida para evitar quebras caso seja usada em outros lugares (como testes internos), mas não estará mais acessível via interface do usuário.
