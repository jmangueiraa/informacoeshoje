# Plano de Ajuste na Extração de Contatos

Ajustar a lógica de salvamento de contatos para que, quando o nome não for identificado ou for inválido, o sistema gere automaticamente um nome sequencial (ex: Cliente00001) em vez de marcar para revisão, desde que o telefone seja válido.

## Alterações Técnicas

### Backend (Server Functions)

1.  **`src/lib/contacts.functions.ts`**:
    *   Modificar `saveContact` para lidar com a geração do nome sequencial.
    *   Antes de inserir, se o nome for considerado inválido ou genérico ("Cliente"):
        *   Consultar no banco o último contato do usuário que segue o padrão "Cliente%".
        *   Extrair o número sequencial mais alto.
        *   Gerar o próximo nome (ex: Cliente00001 -> Cliente00002).
    *   Garantir que se o telefone for válido, `needs_review` seja `false` mesmo com o nome gerado.

2.  **`src/lib/contacts.server.ts`**:
    *   Ajustar `analyzeImageForContacts` para não marcar `needsReview` apenas por causa do nome, se o telefone for válido.
    *   Isso permitirá que o fluxo de salvamento automático no frontend tente gravar o registro como "Novo".

### Frontend (UI)

*   Nenhuma alteração visual direta é necessária, pois a lógica reside no processamento dos dados. A tabela apenas refletirá os nomes "ClienteXXXXX" e o status "OK" (verde).

## Verificação

1.  Fazer upload de uma imagem onde o nome é ilegível mas o telefone está claro.
2.  Verificar se o contato é salvo com um nome como `Cliente00001`.
3.  Verificar se o status do contato é "OK" (não "Revisar").
4.  Fazer um segundo upload semelhante e verificar se o número incrementa para `Cliente00002`.
