# Plano de Restauração e Persistência do Extrator de Contatos

Restaurar a interface completa do extrator de contatos com foco em uma tabela estruturada, persistência via localStorage e correção da lógica de limpeza de dados.

## Alterações

### Frontend (`src/routes/_authenticated/contacts.tsx`)

- **Persistência de Dados**:
    - Implementar `useEffect` para carregar contatos do `localStorage` ao montar o componente.
    - Sincronizar o estado `extractedContacts` com o `localStorage` sempre que houver mudanças.
    - Manter o `clientCounter` também persistente para evitar nomes duplicados ("Cliente 00001").

- **Refinação Visual (Aba 'Contatos')**:
    - Centralizar as ações principais (Limpar Contatos, Copiar Lista, Exportar CSV) no topo da tabela.
    - Garantir que a tabela exiba: Miniatura da Imagem, Primeiro Nome (editável), Contato (editável) e Ações (Copiar, WhatsApp).

- **Lógica de Limpeza**:
    - **Botão 'Limpar' (Fila)**: Resetar apenas o estado `images` (arquivos pendentes), sem tocar nos contatos já extraídos.
    - **Botão 'Limpar Contatos' (Tabela)**: Resetar `extractedContacts`, `clientCounter` e limpar o `localStorage`.

- **Fluxo de Extração**:
    - Ajustar `processOCR` para usar a função `setExtractedContacts` com a abordagem funcional `prev => [...prev, ...newItems]`, garantindo que novos resultados sejam anexados ao final da lista existente.

## Detalhes Técnicos

- **Storage Key**: `linkafiliado_contacts_storage`.
- **Formatação de WhatsApp**: Ajustar o link para `https://wa.me/55...` garantindo que o prefixo internacional seja aplicado corretamente se necessário.
- **Componentes Shadcn**: Utilizar `Table`, `Button`, `Input` e `Card` para manter a consistência visual.

---
*Nota: A interface será simplificada para remover abas desnecessárias se o foco principal for a tabela de contatos conforme solicitado.*
