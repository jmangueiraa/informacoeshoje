# Plano: Filtro de Cliques por IP (Anti-Fraude)

Este plano descreve as alterações necessárias para evitar a contabilização de cliques múltiplos originados do mesmo endereço IP para o mesmo link em um intervalo de 24 horas.

## Alterações

### 1. Banco de Dados (Supabase)
- Criar uma migração para adicionar a coluna `ip_address` (tipo `INET` ou `TEXT`) na tabela `public.clicks`.
- Atualizar a função `increment_link_clicks` para aceitar opcionalmente o IP e verificar se já houve um clique recente antes de incrementar o contador global na tabela `links`.

### 2. Backend (Server Functions)
- **`src/lib/analytics.functions.ts`**:
    - Capturar o IP do visitante através dos headers da requisição (`x-forwarded-for` ou similar) dentro do handler da `registerClick`.
    - Passar o IP para a inserção na tabela `clicks`.
    - Condicionar a chamada da RPC `increment_link_clicks` à inexistência de um clique do mesmo IP nas últimas 24 horas (ou mover essa lógica para dentro da própria RPC no banco de dados para garantir atomicidade).

### 3. Frontend
- Nenhuma alteração visual necessária, pois a lógica é processada inteiramente no redirecionamento.

## Detalhes Técnicos
- O IP será extraído no servidor para garantir confiabilidade.
- A tabela `clicks` continuará registrando todos os acessos para auditoria, mas o contador `clicks_count` da tabela `links` (usado nos gráficos rápidos) refletirá apenas cliques únicos por IP/dia.

## Verificação
- Realizar cliques repetidos no mesmo link e verificar se o `clicks_count` no dashboard aumenta apenas uma vez.
- Verificar se a tabela `clicks` registra o IP corretamente em cada acesso.
