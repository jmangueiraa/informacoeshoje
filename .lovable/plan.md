# Plano de Correção: Erro ao Cadastrar (Database error saving new user)

O usuário relatou o erro "Database error saving new user" ao tentar se cadastrar. Esse erro geralmente ocorre no Supabase Auth quando uma trigger  na tabela  falha, impedindo a conclusão da transação de criação do usuário.

## Problemas Identificados / Hipóteses

1.  **Conflito na Trigger **: A trigger tenta inserir em  e .
2.  **Permissões de Escrita**: Embora a função seja , pode haver um problema com os s nas tabelas de destino para o dono da função.
3.  **Restrição de Unicidade ou Nulidade**: Se algum dado esperado (, ) estiver ausente ou causar erro na inserção em , a trigger falha.
4.  **Loop ou Recursão**: Menos provável, mas possível em triggers complexas.

## Ações Propostas

### 1. Robustez na Trigger de Banco de Dados
- Modificar a função  para ser mais resiliente.
- Adicionar blocos  para capturar e ignorar erros não fatais (ou pelo menos permitir que o cadastro no Auth continue mesmo que o profile falhe temporariamente).
- Garantir que a inserção em  e  use valores padrão se os metadados estiverem ausentes.

### 2. Verificação de Permissões
- Re-executar os s necessários para garantir que o esquema  esteja acessível durante a execução da trigger pela role do sistema.

### 3. Validação no Frontend
- Verificar em  se os metadados () estão sendo enviados corretamente no  (embora o erro de banco sugira falha na persistência, não no envio).

## Detalhes Técnicos

- **Arquivo de Migração**: Criar uma nova migração para atualizar .
- **Lógica da Trigger**:
    

---
*Nota: Este erro interrompe o fluxo de autenticação do Supabase, então a correção no banco de dados é a prioridade zero.*
